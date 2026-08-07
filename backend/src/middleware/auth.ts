import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { createError } from "./errorHandler.js";

export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Middleware that requires a valid JWT token.
 * Sets req.userId on success.
 */
export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(createError(401, "Authentication required", "NO_TOKEN"));
  }

  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, config.JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    next(createError(401, "Invalid or expired token", "INVALID_TOKEN"));
  }
}

/**
 * Middleware that optionally extracts userId from JWT if present.
 * Does NOT fail if no token is provided — allows guest access.
 */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, config.JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
  } catch {
    // Invalid token — treat as guest, don't fail
  }
  next();
}
