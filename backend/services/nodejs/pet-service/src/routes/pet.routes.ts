import { Router } from "express";
import { PetModel } from "../models/pet.model";

export const petRouter = Router();

// GET /api/pets?ownerId=:uid
petRouter.get("/", async (req, res, next) => {
  try {
    const { ownerId, page = 1, pageSize = 20 } = req.query;
    const filter = ownerId ? { ownerId: String(ownerId) } : {};
    const total = await PetModel.countDocuments(filter);
    const pets  = await PetModel.find(filter)
      .skip((Number(page) - 1) * Number(pageSize))
      .limit(Number(pageSize))
      .lean();
    res.json({ success: true, data: pets, meta: { page, pageSize, total, totalPages: Math.ceil(total / Number(pageSize)) } });
  } catch (err) { next(err); }
});

// GET /api/pets/:id
petRouter.get("/:id", async (req, res, next) => {
  try {
    const pet = await PetModel.findById(req.params.id).lean();
    if (!pet) return res.status(404).json({ success: false, message: "Pet not found" });
    res.json({ success: true, data: pet });
  } catch (err) { next(err); }
});

// POST /api/pets
petRouter.post("/", async (req, res, next) => {
  try {
    const pet = await PetModel.create(req.body);
    res.status(201).json({ success: true, data: pet });
  } catch (err) { next(err); }
});

// PATCH /api/pets/:id
petRouter.patch("/:id", async (req, res, next) => {
  try {
    const pet = await PetModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!pet) return res.status(404).json({ success: false, message: "Pet not found" });
    res.json({ success: true, data: pet });
  } catch (err) { next(err); }
});

// DELETE /api/pets/:id
petRouter.delete("/:id", async (req, res, next) => {
  try {
    await PetModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Pet deleted" });
  } catch (err) { next(err); }
});
