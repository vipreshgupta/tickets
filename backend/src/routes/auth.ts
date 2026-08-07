import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { createError } from "../middleware/errorHandler.js";

const router = Router();
const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as any,
  });
}

/**
 * POST /api/auth/register
 */
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw createError(409, "Email already registered", "EMAIL_EXISTS");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name || null,
      },
    });

    const token = signToken(user.id);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
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
});

/**
 * POST /api/auth/login
 */
router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      throw createError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      throw createError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    const token = signToken(user.id);

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
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
});

/**
 * GET /api/auth/me — get current user profile
 */
router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw createError(401, "No token provided", "NO_TOKEN");
    }

    const token = authHeader.substring(7);
    const payload = jwt.verify(token, config.JWT_SECRET) as { sub: string };

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw createError(401, "User not found", "USER_NOT_FOUND");
    }

    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "INVALID_TOKEN", message: "Invalid or expired token" });
    }
    next(err);
  }
});

export default router;
