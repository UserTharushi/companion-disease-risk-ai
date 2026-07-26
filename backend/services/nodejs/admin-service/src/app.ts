import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { approvalRouter, auditRouter, ticketRouter } from "./routes/admin.routes";

const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

async function connectMongoWithFallback() {
  const localUri = "mongodb://root:rootpassword@localhost:27017/companion_ai?authSource=admin";
  const dockerUri = "mongodb://root:rootpassword@mongodb:27017/companion_ai?authSource=admin";

  const candidates = [process.env.MONGODB_URI, process.env.MONGO_URI, localUri, dockerUri]
    .filter((uri): uri is string => Boolean(uri))
    .filter((uri, index, list) => list.indexOf(uri) === index);

  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    for (const uri of candidates) {
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
        console.log(`[admin-service] MongoDB connected (${uri.includes("@mongodb:") ? "docker" : "local/env"})`);
        return;
      } catch (err) {
        lastError = err;
        console.warn(`[admin-service] MongoDB connection failed for URI: ${uri}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.error("[admin-service] MongoDB error", lastError);
}

connectMongoWithFallback();

app.get("/health", (_req, res) => res.json({ status: "ok", service: "admin-service" }));
app.use("/api/approvals", approvalRouter);
app.use("/api/tickets", ticketRouter);
app.use("/api/audit", auditRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[admin-service]", err);
  res.status(500).json({ success: false, message: err.message || "Internal server error" });
});

export default app;
