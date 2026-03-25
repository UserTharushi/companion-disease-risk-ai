import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

// ── Security Middleware ────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*", credentials: true }));
app.use(morgan("combined"));

// ── Rate Limiting ─────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

app.use(express.json({ limit: "10mb" }));

// ── Health Check ──────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway", timestamp: new Date().toISOString() });
});

// ── Service Proxy Routes ───────────────────────
const AUTH_URL        = process.env.AUTH_SERVICE_URL        || "http://localhost:4001";
const PET_URL         = process.env.PET_SERVICE_URL         || "http://localhost:4002";
const CLINIC_URL      = process.env.CLINIC_SERVICE_URL      || "http://localhost:4003";
const NOTIFICATION_URL= process.env.NOTIFICATION_SERVICE_URL|| "http://localhost:4004";
const VACCINATION_URL = process.env.VACCINATION_SERVICE_URL || "http://localhost:4005";
const AI_URL          = process.env.AI_SERVICE_URL          || "http://localhost:8001";
const AGENT_URL       = process.env.AGENT_SERVICE_URL       || "http://localhost:8002";

app.use("/api/auth",         createProxyMiddleware({ target: AUTH_URL,         changeOrigin: true }));
app.use("/api/pets",         createProxyMiddleware({ target: PET_URL,          changeOrigin: true }));
app.use("/api/clinics",      createProxyMiddleware({ target: CLINIC_URL,       changeOrigin: true }));
app.use("/api/appointments", createProxyMiddleware({ target: CLINIC_URL,       changeOrigin: true }));
app.use("/api/notifications",createProxyMiddleware({ target: NOTIFICATION_URL, changeOrigin: true }));
app.use("/api/vaccinations", createProxyMiddleware({ target: VACCINATION_URL,  changeOrigin: true }));
app.use("/api/predict",      createProxyMiddleware({ target: AI_URL,           changeOrigin: true }));
app.use("/api/agent",        createProxyMiddleware({ target: AGENT_URL,        changeOrigin: true }));

// ── 404 Handler ───────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

export default app;
