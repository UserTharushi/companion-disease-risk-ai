import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error & { statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.statusCode || 500;
  console.error(`[error] ${err.message}`, err.stack);
  res.status(status).json({ success: false, message: err.message || "Internal server error" });
}
