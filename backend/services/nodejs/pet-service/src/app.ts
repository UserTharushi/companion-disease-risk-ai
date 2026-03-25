import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { petRouter } from "./routes/pet.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Connect MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/companion_ai")
  .then(() => console.log("[pet-service] MongoDB connected"))
  .catch(err => console.error("[pet-service] MongoDB error", err));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "pet-service" }));
app.use("/api/pets", petRouter);
app.use(errorHandler);

export default app;
