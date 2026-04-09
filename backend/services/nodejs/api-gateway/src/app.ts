import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import proxy from "express-http-proxy";

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

function proxyTo(target: string) {
  return proxy(target, { proxyReqPathResolver: (req) => req.originalUrl });
}

app.use("/api/auth",         proxyTo(AUTH_URL));
app.use("/api/pets",         proxyTo(PET_URL));
app.use("/api/clinics",      proxyTo(CLINIC_URL));
app.use("/api/appointments", proxyTo(CLINIC_URL));
app.use("/api/notifications",proxyTo(NOTIFICATION_URL));
app.use("/api/vaccinations", proxyTo(VACCINATION_URL));
app.use("/api/predict",      proxyTo(AI_URL));
app.use("/api/agent",        proxyTo(AGENT_URL));

// ── 404 Handler ───────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

export default app;
