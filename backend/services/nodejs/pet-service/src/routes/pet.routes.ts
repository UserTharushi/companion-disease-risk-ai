import { Router, type Request } from "express";
import { PetModel } from "../models/pet.model";

export const petRouter = Router();

// Identity headers are stamped by the api-gateway from a verified JWT.
function identity(req: Request): { uid: string; role: string } | null {
  const uid = req.headers["x-user-id"];
  const role = req.headers["x-user-role"];
  if (typeof uid === "string" && uid) {
    return { uid, role: typeof role === "string" ? role : "owner" };
  }
  return null;
}

function isOwnerRole(req: Request): boolean {
  return identity(req)?.role === "owner";
}

function mapPet(pet: any) {
  return {
    id: pet._id.toString(),
    ownerId: pet.ownerId,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    ageYears: pet.ageYears,
    weightKg: pet.weightKg,
    sex: pet.sex,
    neutered: pet.neutered,
    photoURL: pet.photoURL,
    vaccinationName: pet.vaccinationName,
    vaccinationDate: pet.vaccinationDate,
    vaccinationFrequency: pet.vaccinationFrequency,
    nextVaccinationDate: pet.nextVaccinationDate,
    createdAt: pet.createdAt,
    updatedAt: pet.updatedAt,
  };
}

// GET /api/pets?ownerId=:uid
petRouter.get("/", async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    let { ownerId } = req.query;
    // Owners can only list their own pets, regardless of the query param
    const user = identity(req);
    if (user?.role === "owner") {
      ownerId = user.uid;
    }
    const filter = ownerId ? { ownerId: String(ownerId) } : {};
    const total = await PetModel.countDocuments(filter);
    const pets  = await PetModel.find(filter)
      .skip((Number(page) - 1) * Number(pageSize))
      .limit(Number(pageSize))
      .lean();
    res.json({ success: true, data: pets.map(mapPet), meta: { page, pageSize, total, totalPages: Math.ceil(total / Number(pageSize)) } });
  } catch (err) { next(err); }
});

// GET /api/pets/:id
petRouter.get("/:id", async (req, res, next) => {
  try {
    const pet = await PetModel.findById(req.params.id).lean();
    if (!pet) return res.status(404).json({ success: false, message: "Pet not found" });
    if (isOwnerRole(req) && pet.ownerId !== identity(req)?.uid) {
      return res.status(403).json({ success: false, message: "You can only access your own pets" });
    }
    res.json({ success: true, data: mapPet(pet) });
  } catch (err) { next(err); }
});

// POST /api/pets
petRouter.post("/", async (req, res, next) => {
  try {
    const user = identity(req);
    const body = user?.role === "owner" ? { ...req.body, ownerId: user.uid } : req.body;
    const pet = await PetModel.create(body);
    res.status(201).json({ success: true, data: mapPet(pet) });
  } catch (err) { next(err); }
});

// PATCH /api/pets/:id
petRouter.patch("/:id", async (req, res, next) => {
  try {
    const existing = await PetModel.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success: false, message: "Pet not found" });
    if (isOwnerRole(req) && existing.ownerId !== identity(req)?.uid) {
      return res.status(403).json({ success: false, message: "You can only modify your own pets" });
    }
    const pet = await PetModel.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    res.json({ success: true, data: mapPet(pet) });
  } catch (err) { next(err); }
});

// DELETE /api/pets/:id
petRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await PetModel.findById(req.params.id).lean();
    if (!existing) return res.json({ success: true, message: "Pet deleted" });
    if (isOwnerRole(req) && existing.ownerId !== identity(req)?.uid) {
      return res.status(403).json({ success: false, message: "You can only delete your own pets" });
    }
    await PetModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Pet deleted" });
  } catch (err) { next(err); }
});
