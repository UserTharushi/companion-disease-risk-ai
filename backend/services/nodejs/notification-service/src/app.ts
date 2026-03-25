import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "notification-service" }));
app.post("/api/notifications/send", async (req, res) => {
  res.json({ success: true, data: req.body, message: "Notification dispatch scaffolded" });
});

export default app;
