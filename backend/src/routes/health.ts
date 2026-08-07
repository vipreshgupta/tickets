import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { config } from "../config.js";

const router = Router();

const prisma = new PrismaClient();

// Parse Upstash Redis URL (supports rediss:// TLS)
function createRedisClient(): Redis {
  const url = new URL(config.REDIS_URL);
  const isTls = url.protocol === "rediss:";

  return new Redis({
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    tls: isTls ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });
}

const redis = createRedisClient();

/**
 * GET /api/health
 * Returns service health including DB and Redis connectivity.
 */
router.get("/", async (_req: Request, res: Response) => {
  const health: {
    status: string;
    timestamp: string;
    uptime: number;
    db: string;
    redis: string;
    version: string;
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    db: "checking",
    redis: "checking",
    version: "1.0.0",
  };

  // Check Postgres
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.db = "connected";
  } catch (err) {
    health.db = "error";
    health.status = "degraded";
    console.error("[HEALTH] DB check failed:", err);
  }

  // Check Redis
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    const pong = await redis.ping();
    health.redis = pong === "PONG" ? "connected" : "error";
  } catch (err) {
    health.redis = "error";
    health.status = "degraded";
    console.error("[HEALTH] Redis check failed:", err);
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
