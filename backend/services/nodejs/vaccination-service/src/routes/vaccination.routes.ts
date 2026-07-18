import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { VaccinationModel, toRecord } from "../models/vaccination.model";

export const vaccinationRouter = Router();

const SERVICE_KEY = process.env.SERVICE_KEY || "internal-dev-key";

function isServiceCall(headerValue: unknown): boolean {
  return typeof headerValue === "string" && headerValue === SERVICE_KEY;
}

// GET /api/vaccinations?petId=
vaccinationRouter.get("/", async (req, res, next) => {
  try {
    const petId = req.query.petId ? String(req.query.petId) : "";
    const query: Record<string, string> = petId ? { petId } : {};
    // Owners without a petId filter only see their own records
    const uid = req.headers["x-user-id"];
    const role = req.headers["x-user-role"];
    if (!petId && typeof uid === "string" && uid && role === "owner") {
      query.ownerId = uid;
    }
    const docs = await VaccinationModel.find(query).sort({ administeredAt: -1 });
    res.json({ success: true, data: docs.map(toRecord) });
  } catch (err) {
    next(err);
  }
});

// GET /api/vaccinations/due?withinDays=14 — service-to-service (monitoring agent)
vaccinationRouter.get("/due", async (req, res, next) => {
  try {
    if (!isServiceCall(req.headers["x-service-key"])) {
      return res.status(403).json({ success: false, message: "Service key required" });
    }
    const withinDays = Math.max(0, Number(req.query.withinDays ?? 14));
    const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString();
    const docs = await VaccinationModel.find({ nextDueAt: { $lte: cutoff } }).sort({ nextDueAt: 1 });
    res.json({ success: true, data: docs.map(toRecord) });
  } catch (err) {
    next(err);
  }
});

// GET /api/vaccinations/overdue/:petId
vaccinationRouter.get("/overdue/:petId", async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const docs = await VaccinationModel.find({ petId: req.params.petId, nextDueAt: { $lt: now } }).sort({ nextDueAt: 1 });
    res.json({ success: true, data: docs.map(toRecord) });
  } catch (err) {
    next(err);
  }
});

// GET /api/vaccinations/upcoming/:petId
vaccinationRouter.get("/upcoming/:petId", async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const docs = await VaccinationModel.find({ petId: req.params.petId, nextDueAt: { $gte: now } }).sort({ nextDueAt: 1 });
    res.json({ success: true, data: docs.map(toRecord) });
  } catch (err) {
    next(err);
  }
});

// GET /api/vaccinations/:vaccinationId
vaccinationRouter.get("/:vaccinationId", async (req, res, next) => {
  try {
    const { vaccinationId } = req.params;
    if (!isValidObjectId(vaccinationId)) {
      return res.status(404).json({ success: false, message: "Vaccination record not found" });
    }
    const doc = await VaccinationModel.findById(vaccinationId);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Vaccination record not found" });
    }
    res.json({ success: true, data: toRecord(doc) });
  } catch (err) {
    next(err);
  }
});

// POST /api/vaccinations
vaccinationRouter.post("/", async (req, res, next) => {
  try {
    const { petId, vaccineName, administeredAt, nextDueAt } = req.body ?? {};
    if (!petId || !vaccineName || !administeredAt || !nextDueAt) {
      return res.status(400).json({
        success: false,
        message: "petId, vaccineName, administeredAt, and nextDueAt are required",
      });
    }
    const doc = await VaccinationModel.create({
      petId: String(petId),
      ownerId: req.body.ownerId ? String(req.body.ownerId) : undefined,
      vaccineName: String(vaccineName),
      administeredAt: String(administeredAt),
      nextDueAt: String(nextDueAt),
      administeredBy: req.body.administeredBy ? String(req.body.administeredBy) : undefined,
      batchNumber: req.body.batchNumber ? String(req.body.batchNumber) : undefined,
      notes: req.body.notes ? String(req.body.notes) : undefined,
    });
    res.status(201).json({ success: true, data: toRecord(doc) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/vaccinations/:vaccinationId
vaccinationRouter.patch("/:vaccinationId", async (req, res, next) => {
  try {
    const { vaccinationId } = req.params;
    if (!isValidObjectId(vaccinationId)) {
      return res.status(404).json({ success: false, message: "Vaccination record not found" });
    }
    const updatable = ["petId", "vaccineName", "administeredAt", "nextDueAt", "administeredBy", "batchNumber", "notes"] as const;
    const updates: Record<string, string | undefined> = {};
    for (const field of updatable) {
      if (req.body?.[field] !== undefined) {
        updates[field] = String(req.body[field]) || undefined;
      }
    }
    const doc = await VaccinationModel.findByIdAndUpdate(vaccinationId, updates, { new: true });
    if (!doc) {
      return res.status(404).json({ success: false, message: "Vaccination record not found" });
    }
    res.json({ success: true, data: toRecord(doc) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/vaccinations/:vaccinationId
vaccinationRouter.delete("/:vaccinationId", async (req, res, next) => {
  try {
    const { vaccinationId } = req.params;
    if (!isValidObjectId(vaccinationId)) {
      return res.status(404).json({ success: false, message: "Vaccination record not found" });
    }
    const doc = await VaccinationModel.findByIdAndDelete(vaccinationId);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Vaccination record not found" });
    }
    res.json({ success: true, message: "Vaccination record deleted" });
  } catch (err) {
    next(err);
  }
});
