import express, { type Request } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import proxy from "express-http-proxy";
import type { OutgoingHttpHeaders } from "http";
import { authenticate, type AuthenticatedRequest } from "./middleware/auth";

const app = express();

// ── Security Middleware ────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*", credentials: true }));
app.use(morgan("combined"));

// ── Rate Limiting ─────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// ── Health Check ──────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway", timestamp: new Date().toISOString() });
});

// ── Service Proxy Routes ───────────────────────
const AUTH_URL         = process.env.AUTH_SERVICE_URL         || "http://localhost:4001";
const PET_URL          = process.env.PET_SERVICE_URL          || "http://localhost:4002";
const CLINIC_URL       = process.env.CLINIC_SERVICE_URL       || "http://localhost:4003";
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4004";
const VACCINATION_URL  = process.env.VACCINATION_SERVICE_URL  || "http://localhost:4005";
const AI_URL           = process.env.AI_SERVICE_URL           || "http://localhost:8001";
const AGENT_URL        = process.env.AGENT_SERVICE_URL        || "http://localhost:8002";

// Verify JWTs and stamp identity headers before proxying
app.use(authenticate);

function identityHeaders<T extends { headers: OutgoingHttpHeaders }>(proxyReqOpts: T, srcReq: Request): T {
  const user = (srcReq as AuthenticatedRequest).user;
  delete proxyReqOpts.headers["x-user-id"];
  delete proxyReqOpts.headers["x-user-role"];
  if (user) {
    proxyReqOpts.headers["x-user-id"] = user.uid;
    proxyReqOpts.headers["x-user-role"] = user.role;
  }
  return proxyReqOpts;
}

// express-http-proxy buffers the request body with a 1mb default limit, which
// rejects base64 image uploads (profile photos, pet photos, symptom images).
// Streaming the body through (parseReqBody: false) removes that cap entirely —
// we never read the body at the gateway (identityHeaders only touches headers).
const PROXY_OPTS = { parseReqBody: false, proxyReqOptDecorator: identityHeaders } as const;

function proxyTo(target: string) {
  return proxy(target, {
    ...PROXY_OPTS,
    proxyReqPathResolver: (req) => req.originalUrl,
  });
}

// AI service exposes /predict and /predictions/* without the /api prefix
function proxyPredictions(target: string) {
  return proxy(target, {
    ...PROXY_OPTS,
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api\/predictions/, "/predictions"),
  });
}

app.use("/api/auth",         proxyTo(AUTH_URL));
app.use("/api/pets",         proxyTo(PET_URL));
app.use("/api/clinics",      proxyTo(CLINIC_URL));
app.use("/api/appointments", proxyTo(CLINIC_URL));
app.use("/api/notifications",proxyTo(NOTIFICATION_URL));
app.use("/api/vaccinations", proxyTo(VACCINATION_URL));
// AI service serves /predict without the /api prefix
app.use("/api/predict", proxy(AI_URL, { ...PROXY_OPTS, proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api\/predict/, "/predict") }));
// Compatibility: frontends call /api/predictions -> AI service serves /predictions/*
app.use("/api/predictions",  proxyPredictions(AI_URL));
// AI service admin/reference endpoints (no /api prefix on the service side)
app.use("/api/ontology", proxy(AI_URL, { ...PROXY_OPTS, proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api\/ontology/, "/ontology") }));
app.use("/api/model",    proxy(AI_URL, { ...PROXY_OPTS, proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api\/model/, "/model") }));
app.use("/api/agent",    proxy(AGENT_URL, { ...PROXY_OPTS, proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api\/agent/, "") }));

// ── 404 Handler ───────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

export default app;
