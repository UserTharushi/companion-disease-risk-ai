import { Router } from "express";

export const appointmentRouter = Router();

appointmentRouter.get("/", async (_req, res) => {
  res.json({ success: true, data: [], message: "Appointment list endpoint scaffolded" });
});

appointmentRouter.post("/", async (req, res) => {
  res.status(201).json({ success: true, data: req.body, message: "Appointment create endpoint scaffolded" });
});
