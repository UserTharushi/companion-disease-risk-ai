import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { clinicRouter } from "./routes/clinic.routes";
import { appointmentRouter } from "./routes/appointment.routes";
import { inquiryRouter } from "./routes/inquiry.routes";
import { accessRouter } from "./routes/access.routes";
import { errorHandler } from "./middleware/errorHandler";
import { seedClinicData } from "./models/clinic.models";

const app = express();
app.use(helmet()); app.use(cors()); app.use(morgan("dev")); app.use(express.json());

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
        console.log(`[clinic-service] MongoDB connected (${uri.includes("@mongodb:") ? "docker" : "local/env"})`);
        await seedClinicData();
        return;
      } catch (err) {
        lastError = err;
        console.warn(`[clinic-service] MongoDB connection failed for URI: ${uri}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.error("[clinic-service] MongoDB error", lastError);
}

connectMongoWithFallback();

app.get("/health", (_req, res) => res.json({ status: "ok", service: "clinic-service" }));
app.use("/api/clinics",      clinicRouter);
app.use("/api/appointments", appointmentRouter);
app.use("/api/inquiries",    inquiryRouter);
app.use("/api/access-grants", accessRouter);
app.use(errorHandler);

export default app;
