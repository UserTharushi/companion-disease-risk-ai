import { Router } from "express";

export const clinicRouter = Router();

clinicRouter.get("/", async (_req, res) => {
  res.json({ success: true, data: [], message: "Clinic list endpoint scaffolded" });
});

clinicRouter.get("/:clinicId", async (req, res) => {
  res.json({ success: true, data: { id: req.params.clinicId }, message: "Clinic detail endpoint scaffolded" });
});
