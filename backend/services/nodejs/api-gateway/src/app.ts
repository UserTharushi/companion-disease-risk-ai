import express, { type Request } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import proxy from "express-http-proxy";
import type { OutgoingHttpHeaders } from "http";
import { authenticate, type AuthenticatedRequest } from "./middleware/auth";

const app = express();

// ── CORS ───────────────────────────────────────
// ALLOWED_ORIGINS lists localhost ports only, which is right for a browser on
// the development machine and wrong for anything else. Opening the app on a
// phone serves it from the laptop's LAN address, so requests arrive with an
// origin like http://192.168.1.11:3001, no allow header came back, and every
// call failed in the browser ("Load failed" on iOS) even though the request
// itself reached the gateway.
//
// A LAN address cannot be configured ahead of time - it changes with the
// network - so private-network origins are accepted outside production, where
// they are unreachable from the internet anyway. A deployed gateway keeps the
// strict allowlist.
const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const PRIVATE_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

const allowPrivateNetwork = process.env.NODE_ENV !== "production";

function isAllowedOrigin(origin?: string): boolean {
  // No Origin header at all: curl, server-to-server, health checks.
  if (!origin) return true;
  if (configuredOrigins.length === 0) return true;
  if (configuredOrigins.includes(origin)) return true;
  return allowPrivateNetwork && PRIVATE_ORIGIN.test(origin);
}

// ── Security Middleware ────────────────────────
app.use(helmet());
// Refuse a disallowed origin here rather than leaving it to the cors package.
// Told `false`, that package simply adds no header and calls next(), so the
// request continues into the proxy and is answered by a service whose own
// cors() allows everything - the allowlist would look enforced while handing
// out Access-Control-Allow-Origin: *.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ success: false, message: "Origin not allowed" });
  }
  return next();
});

app.use(
  cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
  }),
);
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
const ADMIN_URL        = process.env.ADMIN_SERVICE_URL        || "http://localhost:4006";
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
app.use("/api/inquiries",    proxyTo(CLINIC_URL));
app.use("/api/access-grants", proxyTo(CLINIC_URL));
app.use("/api/notifications",proxyTo(NOTIFICATION_URL));
app.use("/api/vaccinations", proxyTo(VACCINATION_URL));
app.use("/api/approvals",    proxyTo(ADMIN_URL));
app.use("/api/tickets",      proxyTo(ADMIN_URL));
app.use("/api/audit",        proxyTo(ADMIN_URL));
app.use("/api/announcements", proxyTo(ADMIN_URL));
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
