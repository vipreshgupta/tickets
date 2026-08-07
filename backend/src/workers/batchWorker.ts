import { Worker, Job } from "bullmq";
import { PrismaClient, BatchStatus } from "@prisma/client";
import Redis from "ioredis";
import { config } from "../config.js";
import { generateBatch, validateBatch } from "../engine/generator.js";
import { generateHmacSignature } from "../utils/hmac.js";
import { renderTicketImages, buildPdf, buildZip } from "../services/renderService.js";

const prisma = new PrismaClient();

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

async function updateBatchProgress(
  batchId: string,
  status: BatchStatus,
  progressPercent: number
): Promise<void> {
  await prisma.batch.update({
    where: { id: batchId },
    data: { status, progressPercent: Math.min(100, Math.round(progressPercent)) },
  });
}

async function processBatchJob(job: Job<{ batchId: string }>): Promise<void> {
  const { batchId } = job.data;

  try {
    // ── Phase 1: Validate input (0–5%) ─────────────────────────────
    await updateBatchProgress(batchId, "generating_numbers", 0);

    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: { template: true },
    });

    if (!batch) throw new Error("Batch not found");
    if (batch.status === "cancelled") return;

    // Get template data (from saved template or inline)
    const templateData = batch.template
      ? { backgroundImageUrl: batch.template.backgroundImageUrl, zones: batch.template.zones }
      : batch.inlineTemplate as any;

    if (!templateData) throw new Error("No template data found");

    await updateBatchProgress(batchId, "generating_numbers", 5);

    // ── Phase 2: Generate numbers (5–25%) ──────────────────────────
    const result = generateBatch({
      quantity: batch.quantity,
      onProgress: (generated, total) => {
        const pct = 5 + Math.round((generated / total) * 20);
        // Fire-and-forget progress update
        updateBatchProgress(batchId, "generating_numbers", pct).catch(() => {});
      },
    });

    // Validate the batch
    const validation = validateBatch(result.tickets);
    if (!validation.valid) {
      throw new Error(`Batch validation failed: ${validation.errors.join("; ")}`);
    }

    await updateBatchProgress(batchId, "generating_numbers", 25);

    // Check for cancellation
    const checkCancel = await prisma.batch.findUnique({ where: { id: batchId } });
    if (checkCancel?.status === "cancelled") return;

    // ── Phase 3: Store tickets in DB (25–30%) ──────────────────────
    const ticketRecords = result.tickets.map((ticket, index) => ({
      batchId,
      ticketIndex: index + 1,
      numbers: ticket.grid as any,
      qrSignature: generateHmacSignature(`${batchId}-${index + 1}`),
    }));

    // Batch insert in chunks
    const CHUNK_SIZE = 100;
    for (let i = 0; i < ticketRecords.length; i += CHUNK_SIZE) {
      const chunk = ticketRecords.slice(i, i + CHUNK_SIZE);
      await prisma.ticket.createMany({ data: chunk });
      const pct = 25 + Math.round(((i + chunk.length) / ticketRecords.length) * 5);
      await updateBatchProgress(batchId, "rendering_images", pct);
    }

    // ── Phase 4: Render images (30–75%) ────────────────────────────
    await updateBatchProgress(batchId, "rendering_images", 30);

    // Fetch all tickets with IDs for QR code generation
    const dbTickets = await prisma.ticket.findMany({
      where: { batchId },
      orderBy: { ticketIndex: "asc" },
    });

    const imagePaths = await renderTicketImages(
      dbTickets,
      templateData,
      batchId,
      async (rendered, total) => {
        const pct = 30 + Math.round((rendered / total) * 45);
        await updateBatchProgress(batchId, "rendering_images", pct);
      }
    );

    // ── Phase 5: Build PDF (75–90%) ────────────────────────────────
    await updateBatchProgress(batchId, "building_pdf", 75);

    const pdfPath = await buildPdf(imagePaths, batchId, async (pct) => {
      await updateBatchProgress(batchId, "building_pdf", 75 + Math.round(pct * 0.15));
    });

    // ── Phase 6: Build ZIP (90–100%) ───────────────────────────────
    await updateBatchProgress(batchId, "building_zip", 90);

    const zipPath = await buildZip(imagePaths, batchId, async (pct) => {
      await updateBatchProgress(batchId, "building_zip", 90 + Math.round(pct * 0.10));
    });

    // ── Done ───────────────────────────────────────────────────────
    await prisma.batch.update({
      where: { id: batchId },
      data: {
        status: "complete",
        progressPercent: 100,
        pdfUrl: pdfPath,
        zipUrl: zipPath,
      },
    });

    console.log(`✅ Batch ${batchId} complete: ${batch.quantity} tickets generated`);
  } catch (err: any) {
    console.error(`❌ Batch ${batchId} failed:`, err);
    await prisma.batch.update({
      where: { id: batchId },
      data: {
        status: "failed",
        errorReason: err.message || "Unknown error",
      },
    });
    throw err; // Re-throw for BullMQ retry tracking
  }
}

export function startWorker(): Worker {
  const worker = new Worker("batch-generation", processBatchJob, {
    connection: createRedisConnection(),
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`🎰 Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`💥 Job ${job?.id} failed:`, err.message);
  });

  console.log("🔧 Batch worker started, listening for jobs...");
  return worker;
}
