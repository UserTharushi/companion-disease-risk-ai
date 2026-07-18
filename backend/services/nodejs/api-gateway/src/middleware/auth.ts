import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const AUTH_ENFORCE = String(process.env.AUTH_ENFORCE || "false").toLowerCase() === "true";

// Paths reachable without a token
const PUBLIC_PATTERNS: RegExp[] = [
  /^\/health/,
  /^\/api\/auth\/(register|login|refresh-token|forgot-password|reset-password|verify)/,
];

export interface AuthenticatedRequest extends Request {
  user?: { uid: string; role: string };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Always decode when a token is present so identity headers reach services,
  // but only reject missing/invalid tokens when enforcement is on.
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { uid?: string; role?: string };
      if (decoded.uid) {
        req.user = { uid: String(decoded.uid), role: String(decoded.role || "owner") };
      }
    } catch {
      if (AUTH_ENFORCE) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
      }
    }
  }

  if (!AUTH_ENFORCE) return next();
  if (PUBLIC_PATTERNS.some((pattern) => pattern.test(req.path))) return next();
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  return next();
}
