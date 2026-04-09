import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "vaccination-service" }));
app.get("/api/vaccinations", async (_req, res) => {
  res.json({ success: true, data: [], message: "Vaccination list endpoint scaffolded" });
});
app.post("/api/vaccinations", async (req, res) => {
  res.status(201).json({ success: true, data: req.body, message: "Vaccination create endpoint scaffolded" });
});

export default app;
