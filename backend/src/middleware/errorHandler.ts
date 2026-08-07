import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  console.error(`[ERROR] ${statusCode} — ${err.message}`, {
    stack: err.stack,
    code: err.code,
  });

  res.status(statusCode).json({
    error: err.code || "INTERNAL_ERROR",
    message,
  });
}

/** Helper to create typed errors with status codes */
export function createError(
  statusCode: number,
  message: string,
  code?: string
): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
