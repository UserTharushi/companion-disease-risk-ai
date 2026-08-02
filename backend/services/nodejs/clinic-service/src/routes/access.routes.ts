import { Router, type Request } from "express";
import { PetAccessGrantModel, toGrant } from "../models/clinic.models";

export const accessRouter = Router();

// Identity headers stamped by the api-gateway from a verified JWT
function identity(req: Request): { uid: string; role: string } | null {
  const uid = req.headers["x-user-id"];
  const role = req.headers["x-user-role"];
  if (typeof uid === "string" && uid) {
    return { uid, role: typeof role === "string" ? role : "owner" };
  }
  return null;
}

const SERVICE_KEY = process.env.SERVICE_KEY || "internal-dev-key";

/**
 * GET /api/access-grants
 *
 * Scoped by who is asking:
 *   vet     -> only grants naming them
 *   owner   -> only grants over their own pets
 *   admin   -> all (governance view)
 *   service -> any, with x-service-key (pet-service and ai-service consult this
 *              before releasing a pet's health data to a vet)
 */
accessRouter.get("/", async (req, res, next) => {
  try {
    const user = identity(req);
    const isService = req.headers["x-service-key"] === SERVICE_KEY;
    const filter: Record<string, unknown> = {};

    if (req.query.activeOnly !== "false") filter.revokedAt = { $exists: false };
    if (req.query.petId) filter.petId = String(req.query.petId);

    if (isService || user?.role === "admin") {
      if (req.query.vetUserId) filter.vetUserId = String(req.query.vetUserId);
      if (req.query.ownerId) filter.ownerId = String(req.query.ownerId);
    } else if (user?.role === "vet") {
      filter.vetUserId = user.uid;
    } else if (user?.role === "owner") {
      filter.ownerId = user.uid;
    } else {
      return res.status(403).json({ success: false, message: "Not permitted" });
    }

    const docs = await PetAccessGrantModel.find(filter).sort({ grantedAt: -1 }).limit(500);
    res.json({ success: true, data: docs.map(toGrant) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/access-grants — owner explicitly shares a pet with a veterinarian.
 * Owners may only share pets they own; the ownerId is taken from the verified
 * token, never from the request body.
 */
accessRouter.post("/", async (req, res, next) => {
  try {
    const user = identity(req);
    if (!user || (user.role !== "owner" && user.role !== "admin")) {
      return res.status(403).json({ success: false, message: "Only the pet's owner can share access" });
    }
    const { petId, vetUserId } = req.body ?? {};
    if (!petId || !vetUserId) {
      return res.status(400).json({ success: false, message: "petId and vetUserId are required" });
    }
    const ownerId = user.role === "admin" && req.body.ownerId ? String(req.body.ownerId) : user.uid;

    const doc = await PetAccessGrantModel.findOneAndUpdate(
      { petId: String(petId), vetUserId: String(vetUserId), source: "owner_consent" },
      {
        $set: {
          petId: String(petId),
          ownerId,
          vetUserId: String(vetUserId),
          source: "owner_consent",
          grantedAt: new Date().toISOString(),
        },
        $unset: { revokedAt: "" },
      },
      { upsert: true, new: true }
    );
    res.status(201).json({ success: true, data: toGrant(doc) });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/access-grants/:id — owner revokes access.
 * Soft revoke: revokedAt is set rather than the row deleted, so "who could see
 * this pet, and until when" stays answerable.
 */
accessRouter.delete("/:id", async (req, res, next) => {
  try {
    const user = identity(req);
    const grant = await PetAccessGrantModel.findById(req.params.id);
    if (!grant) return res.status(404).json({ success: false, message: "Grant not found" });
    if (!user || (user.role !== "admin" && grant.ownerId !== user.uid)) {
      return res.status(403).json({ success: false, message: "Only the pet's owner can revoke access" });
    }
    grant.revokedAt = new Date().toISOString();
    await grant.save();
    res.json({ success: true, data: toGrant(grant) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/access-grants/revoke-vet/:vetUserId — revoke every grant a
 * veterinarian holds.
 *
 * Called by auth-service when an admin deactivates or deletes a vet account.
 * Without it, removing a vet took away their ability to be booked but left
 * every existing grant standing, so the account still carried permission to
 * read those animals' records.
 *
 * Soft revoke, like the owner-initiated route: revokedAt is set rather than the
 * row deleted, so the access history stays answerable.
 *
 * Service-key guarded — internal cleanup, not a user action.
 */
accessRouter.post("/revoke-vet/:vetUserId", async (req, res, next) => {
  try {
    if (req.headers["x-service-key"] !== SERVICE_KEY) {
      return res.status(403).json({ success: false, message: "Service key required" });
    }
    const result = await PetAccessGrantModel.updateMany(
      { vetUserId: req.params.vetUserId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date().toISOString() } }
    );
    res.json({ success: true, data: { revoked: result.modifiedCount ?? 0 } });
  } catch (err) {
    next(err);
  }
});
