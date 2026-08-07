import { Router, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { createError } from "../middleware/errorHandler.js";

const router = Router();
const prisma = new PrismaClient();

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

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  zones: z.array(zoneSchema).length(27, "Exactly 27 zones required"),
});

/**
 * POST /api/templates — save a template
 * Requires auth. Accepts multipart form with background image + JSON zones.
 */
router.post(
  "/",
  requireAuth,
  upload.single("background"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw createError(400, "Background image is required", "NO_IMAGE");
      }

      // Parse zones from body (sent as JSON string in multipart)
      let zonesData: unknown;
      try {
        zonesData = JSON.parse(req.body.zones || "[]");
      } catch {
        throw createError(400, "Invalid zones JSON", "INVALID_ZONES");
      }

      const body = createTemplateSchema.parse({
        name: req.body.name,
        zones: zonesData,
      });

      // Validate zone constraints
      validateZoneConstraints(body.zones);

      const template = await prisma.template.create({
        data: {
          userId: req.userId!,
          name: body.name,
          backgroundImageUrl: `/uploads/${req.file.filename}`,
          zones: body.zones as any,
        },
      });

      res.status(201).json({ template });
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
 * GET /api/templates — list current user's templates
 */
router.get("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.template.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        backgroundImageUrl: true,
        zones: true,
        createdAt: true,
      },
    });

    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/templates/:id — get a single template
 */
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.template.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!template) {
      throw createError(404, "Template not found", "NOT_FOUND");
    }

    res.json({ template });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/templates/:id
 */
router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.template.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!template) {
      throw createError(404, "Template not found", "NOT_FOUND");
    }

    await prisma.template.delete({ where: { id: req.params.id } });
    res.json({ message: "Template deleted" });
  } catch (err) {
    next(err);
  }
});

/** Validate that zones form a valid Tambola 3x9 layout */
function validateZoneConstraints(zones: z.infer<typeof zoneSchema>[]) {
  const grid = new Set<string>();
  for (const zone of zones) {
    const key = `${zone.row_index}-${zone.column_index}`;
    if (grid.has(key)) {
      throw createError(400, `Duplicate zone at row ${zone.row_index}, col ${zone.column_index}`, "INVALID_ZONES");
    }
    grid.add(key);
  }
}

export default router;
