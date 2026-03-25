import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { clinicRouter } from "./routes/clinic.routes";
import { appointmentRouter } from "./routes/appointment.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(helmet()); app.use(cors()); app.use(morgan("dev")); app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/companion_ai")
  .then(() => console.log("[clinic-service] MongoDB connected"))
  .catch(err => console.error("[clinic-service] MongoDB error", err));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "clinic-service" }));
app.use("/api/clinics",      clinicRouter);
app.use("/api/appointments", appointmentRouter);
app.use(errorHandler);

export default app;
