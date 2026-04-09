import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { authRouter } from "./routes/auth.routes";
import { errorHandler } from "./middleware/errorHandler";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://root:rootpassword@localhost:27017/companion_ai?authSource=admin";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("[auth-service] MongoDB connected"))
  .catch((err) => console.error("[auth-service] MongoDB connection error:", err));

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "auth-service" });
});

app.use("/api/auth", authRouter);
app.use(errorHandler);

export default app;
