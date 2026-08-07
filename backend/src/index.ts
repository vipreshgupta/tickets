import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { config } from "./config.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import templatesRouter from "./routes/templates.js";
import batchesRouter from "./routes/batches.js";
import verifyRouter from "./routes/verify.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { startWorker } from "./workers/batchWorker.js";

const app = express();

// ─── Security ──────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  })
);

// ─── Rate Limiting ─────────────────────────────────────────────────
const batchLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_BATCHES,
  message: {
    error: "RATE_LIMITED",
    message: `Too many batch requests. Max ${config.RATE_LIMIT_MAX_BATCHES} per hour.`,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Body Parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Ensure storage directories exist ──────────────────────────────
const uploadsDir = path.join(config.STORAGE_PATH, "uploads");
const outputDir = path.join(config.STORAGE_PATH, "output");
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

// ─── Static files (uploaded images) ────────────────────────────────
app.use("/uploads", express.static(uploadsDir));

// ─── Routes ────────────────────────────────────────────────────────
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/batches", batchLimiter, batchesRouter);
app.use("/verify", verifyRouter);

// ─── 404 Handler ───────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Endpoint not found" });
});

// ─── Error Handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server + Worker ─────────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   🎰 Tambola Ticket Generator — Backend API     ║
  ╠══════════════════════════════════════════════════╣
  ║   Port:     ${String(config.PORT).padEnd(36)}║
  ║   Env:      ${config.NODE_ENV.padEnd(36)}║
  ║   Health:   http://localhost:${config.PORT}/api/health${" ".repeat(Math.max(0, 14 - String(config.PORT).length))}║
  ╚══════════════════════════════════════════════════╝
  `);

  // Start the BullMQ worker in the same process
  startWorker();
});

export default app;
