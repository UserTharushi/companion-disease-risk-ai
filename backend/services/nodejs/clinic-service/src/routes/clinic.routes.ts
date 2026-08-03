import { Router, type Request, type Response, type NextFunction } from "express";
import { ClinicModel, SurgeonModel, TimeSlotModel } from "../models/clinic.models";

export const clinicRouter = Router();

// Clinic/surgeon/slot writes are for vets and admins only (identity headers
// are stamped by the api-gateway from a verified JWT)
function requireStaff(req: Request, res: Response, next: NextFunction) {
  const role = req.headers["x-user-role"];
  if (typeof role === "string" && role === "owner") {
    return res.status(403).json({ success: false, message: "Vet or admin role required" });
  }
  next();
}

function mapSlot(slot: any) {
  return {
    id: slot._id.toString(),
    surgeonId: slot.surgeonId,
    datetime: slot.datetime,
    durationMins: slot.durationMins,
    isBooked: slot.isBooked,
  };
}

function mapSurgeon(surgeon: any, slots: any[]) {
  return {
    id: surgeon._id.toString(),
    clinicId: surgeon.clinicId,
    name: surgeon.name,
    specialization: surgeon.specialization,
    qualifications: surgeon.qualifications,
    photoURL: surgeon.photoURL,
    userId: surgeon.userId,
    availableSlots: slots.filter((slot) => slot.surgeonId === surgeon._id.toString()).map(mapSlot),
  };
}

function mapClinic(clinic: any, surgeons: any[], slots: any[]) {
  return {
    id: clinic._id.toString(),
    name: clinic.name,
    address: clinic.address,
    latitude: clinic.latitude,
    longitude: clinic.longitude,
    phone: clinic.phone,
    email: clinic.email,
    specializations: clinic.specializations,
    isOpen: clinic.isOpen,
    surgeons: surgeons.map((surgeon) => mapSurgeon(surgeon, slots)),
  };
}

clinicRouter.get("/surgeons/:surgeonId", async (req, res, next) => {
  try {
    const surgeon = await SurgeonModel.findById(req.params.surgeonId).lean();
    if (!surgeon) return res.status(404).json({ success: false, message: "Surgeon not found" });
    const slots = await TimeSlotModel.find({ surgeonId: surgeon._id.toString() }).lean();
    res.json({ success: true, data: mapSurgeon(surgeon, slots) });
  } catch (err) {
    next(err);
  }
});

clinicRouter.get("/surgeons/:surgeonId/slots", async (req, res, next) => {
  try {
    const slots = await TimeSlotModel.find({ surgeonId: req.params.surgeonId }).lean();
    res.json({ success: true, data: slots.map(mapSlot) });
  } catch (err) {
    next(err);
  }
});

clinicRouter.post("/surgeons/:surgeonId/slots", requireStaff, async (req, res, next) => {
  try {
    const slot = await TimeSlotModel.create({
      surgeonId: req.params.surgeonId,
      datetime: req.body.datetime,
      durationMins: req.body.durationMins || 30,
      isBooked: Boolean(req.body.isBooked),
    });
    res.status(201).json({ success: true, data: mapSlot(slot) });
  } catch (err) {
    next(err);
  }
});

clinicRouter.get("/", async (req, res, next) => {
  try {
    const query = String(req.query.query || "").trim().toLowerCase();
    const clinics = await ClinicModel.find({}).lean();
    const surgeons = await SurgeonModel.find({}).lean();
    const slots = await TimeSlotModel.find({}).lean();
    const data = clinics
      .map((clinic) => mapClinic(clinic, surgeons.filter((surgeon) => surgeon.clinicId === clinic._id.toString()), slots))
      .filter((clinic) => {
        if (!query) return true;
        const searchable = [clinic.name, clinic.address, ...(clinic.specializations || []), ...(clinic.surgeons || []).map((surgeon: any) => surgeon.name)].join(" ").toLowerCase();
        return searchable.includes(query);
      });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

clinicRouter.post("/", requireStaff, async (req, res, next) => {
  try {
    const clinic = await ClinicModel.create(req.body);
    res.status(201).json({ success: true, data: { id: clinic._id.toString(), ...req.body } });
  } catch (err) {
    next(err);
  }
});

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

// ── Real-world discovery: OpenStreetMap veterinary POIs (free, no API key) ──
// External results are display-only (no surgeons/slots) and merged into /nearby.
const osmCache = new Map<string, { at: number; data: OsmClinic[] }>();
const OSM_CACHE_MS = 10 * 60 * 1000;

interface OsmClinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

async function fetchOsmVeterinary(lat: number, lng: number, radiusKm: number): Promise<OsmClinic[]> {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)},${Math.round(radiusKm)}`;
  const cached = osmCache.get(cacheKey);
  if (cached && Date.now() - cached.at < OSM_CACHE_MS) return cached.data;

  try {
    const radiusM = Math.min(radiusKm, 50) * 1000;
    const query = `[out:json][timeout:12];(node["amenity"="veterinary"](around:${radiusM},${lat},${lng});way["amenity"="veterinary"](around:${radiusM},${lat},${lng}););out center 25;`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 13000);
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Overpass usage policy requires an identifying User-Agent (406 otherwise)
        "User-Agent": "CompanionDiseaseRiskAI/1.0 (academic FYP; vet clinic discovery)",
        Accept: "application/json",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return [];
    const body = (await response.json()) as { elements?: Array<Record<string, any>> };
    const results: OsmClinic[] = (body.elements ?? [])
      .map((el) => {
        const elLat = typeof el.lat === "number" ? el.lat : el.center?.lat;
        const elLng = typeof el.lon === "number" ? el.lon : el.center?.lon;
        if (typeof elLat !== "number" || typeof elLng !== "number") return null;
        const tags = el.tags ?? {};
        const addressParts = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean);
        return {
          id: `osm-${el.type}-${el.id}`,
          name: tags.name || "Veterinary clinic",
          address: addressParts.join(", ") || tags["addr:full"] || "",
          latitude: elLat,
          longitude: elLng,
        };
      })
      .filter((entry): entry is OsmClinic => entry !== null);
    osmCache.set(cacheKey, { at: Date.now(), data: results });
    return results;
  } catch {
    return []; // Overpass down/slow — registry results still work
  }
}

/**
 * GET /api/clinics/geocode?q=<address> — turn an address into coordinates.
 *
 * Coordinates were only enterable by hand or by copying the admin's own
 * position, so a clinic in Colombo added by someone sitting in Warakapola was
 * placed in Warakapola. An address is the thing an administrator actually
 * knows, so look the position up from that instead.
 *
 * Uses Nominatim, the OpenStreetMap search service - free, no key, same family
 * as the Overpass lookup already used for nearby clinics. Several matches are
 * returned rather than one, because "PetVet Clinic" is not unique and silently
 * picking the first is how the original mistake happened.
 *
 * Must stay registered before /:clinicId.
 */
const geocodeCache = new Map<string, { at: number; data: unknown[] }>();
const GEOCODE_CACHE_MS = 60 * 60 * 1000;

clinicRouter.get("/geocode", requireStaff, async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "").trim();
    if (query.length < 3) {
      return res.status(400).json({ success: false, message: "Enter an address to search" });
    }

    const key = query.toLowerCase();
    const cached = geocodeCache.get(key);
    if (cached && Date.now() - cached.at < GEOCODE_CACHE_MS) {
      return res.json({ success: true, data: cached.data });
    }

    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=lk&q=" +
      encodeURIComponent(query);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let results: unknown[] = [];
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          // Nominatim's usage policy requires an identifying User-Agent.
          "User-Agent": "CompanionDiseaseRiskAI/1.0 (academic FYP; clinic geocoding)",
          "Accept-Language": "en",
        },
      });
      if (response.ok) {
        const body = (await response.json()) as Array<Record<string, unknown>>;
        results = body.map((row) => ({
          label: String(row.display_name ?? ""),
          latitude: Number(row.lat),
          longitude: Number(row.lon),
        }));
      }
    } finally {
      clearTimeout(timer);
    }

    geocodeCache.set(key, { at: Date.now(), data: results });
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// GET /api/clinics/nearby?lat=&lng=&maxKm=50 — must stay registered before /:clinicId
clinicRouter.get("/nearby", async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: "lat and lng are required numbers" });
    }
    const maxKm = Math.max(1, Number(req.query.maxKm ?? 50));
    const includeExternal = String(req.query.includeExternal ?? "true") !== "false";

    const [clinics, surgeons, slots, osmClinics] = await Promise.all([
      ClinicModel.find({}).lean(),
      SurgeonModel.find({}).lean(),
      TimeSlotModel.find({}).lean(),
      includeExternal ? fetchOsmVeterinary(lat, lng, maxKm) : Promise.resolve([]),
    ]);

    const registry = clinics
      .map((clinic) => ({
        clinic,
        distanceKm:
          typeof clinic.latitude === "number" && typeof clinic.longitude === "number"
            ? haversineKm(lat, lng, clinic.latitude, clinic.longitude)
            : Number.POSITIVE_INFINITY,
      }))
      .filter((entry) => entry.distanceKm <= maxKm)
      .map((entry) => ({
        ...mapClinic(entry.clinic, surgeons.filter((surgeon) => surgeon.clinicId === entry.clinic._id.toString()), slots),
        distanceKm: Math.round(entry.distanceKm * 10) / 10,
        external: false,
      }));

    // External OSM results — skip any that duplicate a registered clinic (same name, <300m)
    const external = osmClinics
      .map((poi) => ({ poi, distanceKm: haversineKm(lat, lng, poi.latitude, poi.longitude) }))
      .filter((entry) => entry.distanceKm <= maxKm)
      .filter((entry) =>
        !registry.some(
          (reg) =>
            // Same name within 2km = the registered clinic (admin coordinates are approximate)
            reg.name.trim().toLowerCase() === entry.poi.name.trim().toLowerCase()
            && haversineKm(reg.latitude, reg.longitude, entry.poi.latitude, entry.poi.longitude) < 2,
        ),
      )
      .map((entry) => ({
        id: entry.poi.id,
        name: entry.poi.name,
        address: entry.poi.address,
        latitude: entry.poi.latitude,
        longitude: entry.poi.longitude,
        phone: "",
        email: "",
        specializations: [] as string[],
        isOpen: true,
        surgeons: [] as unknown[],
        distanceKm: Math.round(entry.distanceKm * 10) / 10,
        external: true,
      }));

    const data = [...registry, ...external].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

clinicRouter.get("/:clinicId", async (req, res, next) => {
  try {
    const clinic = await ClinicModel.findById(req.params.clinicId).lean();
    if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });
    const surgeons = await SurgeonModel.find({ clinicId: req.params.clinicId }).lean();
    const slots = await TimeSlotModel.find({ surgeonId: { $in: surgeons.map((surgeon) => surgeon._id.toString()) } }).lean();
    res.json({ success: true, data: mapClinic(clinic, surgeons, slots) });
  } catch (err) {
    next(err);
  }
});

clinicRouter.patch("/:clinicId", requireStaff, async (req, res, next) => {
  try {
    const clinic = await ClinicModel.findByIdAndUpdate(req.params.clinicId, req.body, { new: true }).lean();
    if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });
    res.json({ success: true, data: clinic });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/clinics/:clinicId — removes the clinic with its surgeons and slots
clinicRouter.delete("/:clinicId", requireStaff, async (req, res, next) => {
  try {
    const clinic = await ClinicModel.findByIdAndDelete(req.params.clinicId);
    if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });
    const surgeons = await SurgeonModel.find({ clinicId: req.params.clinicId }).lean();
    await TimeSlotModel.deleteMany({ surgeonId: { $in: surgeons.map((s) => s._id.toString()) } });
    await SurgeonModel.deleteMany({ clinicId: req.params.clinicId });
    res.json({ success: true, message: "Clinic deleted" });
  } catch (err) {
    next(err);
  }
});

// POST /api/clinics/:clinicId/surgeons — add a surgeon to a clinic
clinicRouter.post("/:clinicId/surgeons", requireStaff, async (req, res, next) => {
  try {
    const clinic = await ClinicModel.findById(req.params.clinicId).lean();
    if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });
    if (!req.body?.name) return res.status(400).json({ success: false, message: "Surgeon name is required" });
    const surgeon = await SurgeonModel.create({
      clinicId: req.params.clinicId,
      name: String(req.body.name),
      specialization: String(req.body.specialization || "General"),
      qualifications: Array.isArray(req.body.qualifications) ? req.body.qualifications : [],
      photoURL: req.body.photoURL ? String(req.body.photoURL) : undefined,
      // Optional link to the veterinarian's auth account.
      userId: req.body.userId ? String(req.body.userId) : undefined,
    });
    res.status(201).json({ success: true, data: mapSurgeon(surgeon.toObject(), []) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/clinics/surgeons/:surgeonId — edit details or link/unlink the
// veterinarian's account. Pass userId: null to unlink.
clinicRouter.patch("/surgeons/:surgeonId", requireStaff, async (req, res, next) => {
  try {
    const set: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};
    if (req.body?.name !== undefined) set.name = String(req.body.name);
    if (req.body?.specialization !== undefined) set.specialization = String(req.body.specialization);
    if (req.body?.qualifications !== undefined) set.qualifications = req.body.qualifications;
    if (req.body?.photoURL !== undefined) set.photoURL = String(req.body.photoURL);
    if (req.body?.userId !== undefined) {
      // Mongoose drops `undefined` from an update object, so clearing the link
      // needs an explicit $unset — assigning undefined silently kept the old id.
      if (req.body.userId === null || req.body.userId === "") unset.userId = "";
      else set.userId = String(req.body.userId);
    }
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    const surgeon = await SurgeonModel.findByIdAndUpdate(req.params.surgeonId, update, { new: true }).lean();
    if (!surgeon) return res.status(404).json({ success: false, message: "Surgeon not found" });
    const slots = await TimeSlotModel.find({ surgeonId: req.params.surgeonId }).lean();
    res.json({ success: true, data: mapSurgeon(surgeon, slots) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/clinics/surgeons/:surgeonId — remove a surgeon and their slots
clinicRouter.delete("/surgeons/:surgeonId", requireStaff, async (req, res, next) => {
  try {
    const surgeon = await SurgeonModel.findByIdAndDelete(req.params.surgeonId);
    if (!surgeon) return res.status(404).json({ success: false, message: "Surgeon not found" });
    await TimeSlotModel.deleteMany({ surgeonId: req.params.surgeonId });
    res.json({ success: true, message: "Surgeon deleted" });
  } catch (err) {
    next(err);
  }
});
