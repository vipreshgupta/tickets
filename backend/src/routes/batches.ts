import { Router, Response, NextFunction } from "express";
import { PrismaClient, BatchStatus } from "@prisma/client";
import { z } from "zod";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { optionalAuth, AuthRequest } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { createError } from "../middleware/errorHandler.js";
import { config } from "../config.js";

const router = Router();
const prisma = new PrismaClient();

// Redis connection for BullMQ
function createRedisConnection(): Redis {
  const url = new URL(config.REDIS_URL);
  const isTls = url.protocol === "rediss:";
  return new Redis({
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    tls: isTls ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
  });
}

const batchQueue = new Queue("batch-generation", {
  connection: createRedisConnection(),
});

const zoneSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0.5).max(100),
  height: z.number().min(0.5).max(100),
  row_index: z.number().int().min(0).max(2),
  column_index: z.number().int().min(0).max(8),
  font: z.string().default("Arial"),
  font_size: z.number().min(6).max(200).default(24),
  color: z.string().default("#000000"),
  align: z.enum(["left", "center", "right"]).default("center"),
});

const createBatchSchema = z.object({
  template_id: z.string().uuid().optional(),
  quantity: z.number().int().min(10).max(config.MAX_BATCH_QUANTITY),
  // Inline template (when not using a saved template)
  background_url: z.string().optional(),
  zones: z.array(zoneSchema).length(27).optional(),
});

/**
 * POST /api/batches — start a generation job
 * Guest access allowed for small batches; auth gives access to saved templates.
 */
router.post(
  "/",
  optionalAuth,
  upload.single("background"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      let bodyData: any = { ...req.body };
      // Parse zones if sent as JSON string (multipart form)
      if (typeof bodyData.zones === "string") {
        try {
          bodyData.zones = JSON.parse(bodyData.zones);
        } catch {
          throw createError(400, "Invalid zones JSON", "INVALID_ZONES");
        }
      }
      if (typeof bodyData.quantity === "string") {
        bodyData.quantity = parseInt(bodyData.quantity, 10);
      }

      const body = createBatchSchema.parse(bodyData);

      let templateId: string | null = null;
      let inlineTemplate: any = null;

      if (body.template_id) {
        // Using a saved template — verify ownership
        if (!req.userId) {
          throw createError(401, "Authentication required to use saved templates", "AUTH_REQUIRED");
        }
        const template = await prisma.template.findFirst({
          where: { id: body.template_id, userId: req.userId },
        });
        if (!template) {
          throw createError(404, "Template not found", "TEMPLATE_NOT_FOUND");
        }
        templateId = template.id;
      } else if (body.zones) {
        // Inline template
        const bgUrl = req.file
          ? `/uploads/${req.file.filename}`
          : body.background_url;

        if (!bgUrl) {
          throw createError(400, "Background image or template_id is required", "NO_TEMPLATE");
        }

        inlineTemplate = {
          backgroundImageUrl: bgUrl,
          zones: body.zones,
        };
      } else {
        throw createError(400, "Either template_id or zones must be provided", "NO_TEMPLATE");
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + config.BATCH_EXPIRY_DAYS);

      const batch = await prisma.batch.create({
        data: {
          templateId,
          userId: req.userId || null,
          quantity: body.quantity,
          status: "queued",
          progressPercent: 0,
          inlineTemplate,
          expiresAt,
        },
      });

      // Enqueue the job
      await batchQueue.add(
        "generate",
        { batchId: batch.id },
        {
          jobId: batch.id,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      res.status(202).json({
        job_id: batch.id,
        status: batch.status,
        message: "Batch generation queued",
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
        });
      }
      next(err);
    }
  }
);

/**
 * GET /api/batches/:id — polling fallback
 */
router.get("/:id", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: req.params.id as string },
      select: {
        id: true,
        status: true,
        progressPercent: true,
        quantity: true,
        pdfUrl: true,
        zipUrl: true,
        errorReason: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    if (!batch) {
      throw createError(404, "Batch not found", "NOT_FOUND");
    }

    res.json({ batch });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/batches/:id/progress — SSE stream
 */
router.get("/:id/progress", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const batch = await prisma.batch.findUnique({ where: { id: req.params.id as string } });
    if (!batch) {
      throw createError(404, "Batch not found", "NOT_FOUND");
    }

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": config.FRONTEND_URL,
    });

    res.write(`data: ${JSON.stringify({ status: batch.status, progress: batch.progressPercent })}\n\n`);

    // Poll DB every second for updates
    const interval = setInterval(async () => {
      try {
        const updated = await prisma.batch.findUnique({
          where: { id: req.params.id as string },
          select: {
            status: true,
            progressPercent: true,
            pdfUrl: true,
            zipUrl: true,
            errorReason: true,
          },
        });

        if (!updated) {
          clearInterval(interval);
          res.write(`data: ${JSON.stringify({ status: "failed", progress: 0, error: "Batch deleted" })}\n\n`);
          res.end();
          return;
        }

        res.write(
          `data: ${JSON.stringify({
            status: updated.status,
            progress: updated.progressPercent,
            pdf_url: updated.pdfUrl,
            zip_url: updated.zipUrl,
            error: updated.errorReason,
          })}\n\n`
        );

        // End stream when complete or failed
        if (updated.status === "complete" || updated.status === "failed" || updated.status === "cancelled") {
          clearInterval(interval);
          res.end();
        }
      } catch {
        clearInterval(interval);
        res.end();
      }
    }, 1000);

    // Clean up on client disconnect
    req.on("close", () => {
      clearInterval(interval);
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/batches/:id/download/pdf
 */
router.get("/:id/download/pdf", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const batch = await prisma.batch.findUnique({ where: { id: req.params.id as string } });

    if (!batch) throw createError(404, "Batch not found", "NOT_FOUND");
    if (batch.status !== "complete") throw createError(400, "Batch is not complete", "NOT_READY");
    if (!batch.pdfUrl) throw createError(404, "PDF not available", "NO_PDF");

    const filePath = `${config.STORAGE_PATH}/${batch.pdfUrl}`;
    res.download(filePath, `tambola-tickets-${batch.id.slice(0, 8)}.pdf`);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/batches/:id/download/zip
 */
router.get("/:id/download/zip", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const batch = await prisma.batch.findUnique({ where: { id: req.params.id as string } });

    if (!batch) throw createError(404, "Batch not found", "NOT_FOUND");
    if (batch.status !== "complete") throw createError(400, "Batch is not complete", "NOT_READY");
    if (!batch.zipUrl) throw createError(404, "ZIP not available", "NO_ZIP");

    const filePath = `${config.STORAGE_PATH}/${batch.zipUrl}`;
    res.download(filePath, `tambola-tickets-${batch.id.slice(0, 8)}.zip`);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/batches/:id/cancel — cancel a queued/in-progress job
 */
router.post("/:id/cancel", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const batch = await prisma.batch.findUnique({ where: { id: req.params.id as string } });
    if (!batch) throw createError(404, "Batch not found", "NOT_FOUND");

    if (batch.status === "complete" || batch.status === "failed") {
      throw createError(400, "Cannot cancel a completed or failed batch", "INVALID_STATE");
    }

    await prisma.batch.update({
      where: { id: req.params.id as string },
      data: { status: "cancelled", errorReason: "Cancelled by user" },
    });

    // Try to remove from queue
    const job = await batchQueue.getJob(req.params.id as string);
    if (job) await job.remove();

    res.json({ message: "Batch cancelled" });
  } catch (err) {
    next(err);
  }
});

export default router;
