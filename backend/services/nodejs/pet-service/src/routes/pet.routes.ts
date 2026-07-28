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

const CLINIC_SERVICE_URL = process.env.CLINIC_SERVICE_URL || "http://localhost:4003";
const SERVICE_KEY = process.env.SERVICE_KEY || "internal-dev-key";

/**
 * Pet ids a veterinarian is currently allowed to see.
 *
 * Access is relationship-based: clinic-service holds the grants, created when
 * the owner books this vet or explicitly shares the pet. Returns [] when the
 * registry cannot be reached — failing closed is the only safe default for an
 * authorization check, so a clinic-service outage hides records rather than
 * exposing every pet on the platform.
 */
const VACCINATION_SERVICE_URL = process.env.VACCINATION_SERVICE_URL || "http://localhost:4005";

/**
 * Remove the data that belongs to a deleted pet.
 *
 * Deleting a pet previously removed only the pet document, which left:
 *   - vaccination records orphaned and invisible (the history view filters by
 *     the current pet id, so a pet deleted and re-added appears to lose its
 *     history while the rows stay in the database)
 *   - time slots permanently marked booked, so nobody could ever book them again
 *   - veterinarians holding access grants to an animal that no longer exists
 *
 * Failures are logged, not thrown: the pet is already gone, and refusing to
 * acknowledge the deletion because a downstream service is unreachable would be
 * worse than leaving cleanup to be retried.
 */
async function cascadeDeletePetData(petId: string): Promise<void> {
  const targets: Array<[string, string]> = [
    ["vaccination-service", `${VACCINATION_SERVICE_URL}/api/vaccinations/pet/${encodeURIComponent(petId)}`],
    ["clinic-service", `${CLINIC_SERVICE_URL}/api/appointments/pet/${encodeURIComponent(petId)}`],
  ];
  for (const [name, url] of targets) {
    try {
      const response = await fetch(url, { method: "DELETE", headers: { "x-service-key": SERVICE_KEY } });
      if (!response.ok) {
        console.warn(`[pet-service] cleanup on ${name} returned ${response.status} for pet ${petId}`);
      }
    } catch (err) {
      console.warn(`[pet-service] cleanup on ${name} failed for pet ${petId}`, err);
    }
  }
}

async function grantedPetIds(vetUserId: string): Promise<string[]> {
  try {
    const response = await fetch(
      `${CLINIC_SERVICE_URL}/api/access-grants?vetUserId=${encodeURIComponent(vetUserId)}`,
      { headers: { "x-service-key": SERVICE_KEY } },
    );
    if (!response.ok) return [];
    const body = await response.json() as { data?: Array<{ petId: string; active: boolean }> };
    return (body.data ?? []).filter((grant) => grant.active).map((grant) => grant.petId);
  } catch (err) {
    console.warn("[pet-service] access-grant lookup failed; denying vet access", err);
    return [];
  }
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
    const filter: Record<string, unknown> = ownerId ? { ownerId: String(ownerId) } : {};

    // A vet sees only pets they hold an active grant for — established by an
    // appointment with them, or shared explicitly by the owner. Previously this
    // returned every pet on the platform.
    if (user?.role === "vet") {
      filter._id = { $in: await grantedPetIds(user.uid) };
    }
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
    const user = identity(req);
    if (isOwnerRole(req) && pet.ownerId !== user?.uid) {
      return res.status(403).json({ success: false, message: "You can only access your own pets" });
    }
    // Same rule as the list: without this, filtering the list would be
    // cosmetic — any vet could still fetch any pet by id.
    if (user?.role === "vet") {
      const allowed = await grantedPetIds(user.uid);
      if (!allowed.includes(String(pet._id))) {
        return res.status(403).json({ success: false, message: "No active access grant for this pet" });
      }
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
    await cascadeDeletePetData(req.params.id);
    res.json({ success: true, message: "Pet deleted" });
  } catch (err) { next(err); }
});
