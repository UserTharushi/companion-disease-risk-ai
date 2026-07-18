import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { petRouter } from "./routes/pet.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "10mb";

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: JSON_BODY_LIMIT }));

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
        console.log(`[pet-service] MongoDB connected (${uri.includes("@mongodb:") ? "docker" : "local/env"})`);
        return;
      } catch (err) {
        lastError = err;
        console.warn(`[pet-service] MongoDB connection failed for URI: ${uri}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.error("[pet-service] MongoDB error", lastError);
}

connectMongoWithFallback();

app.get("/health", (_req, res) => res.json({ status: "ok", service: "pet-service" }));
app.use("/api/pets", petRouter);
app.use(errorHandler);

export default app;
