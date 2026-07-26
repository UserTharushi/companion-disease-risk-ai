import { Schema, model, type Document } from "mongoose";

export interface ClinicDocument extends Document {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email?: string;
  specializations: string[];
  isOpen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurgeonDocument extends Document {
  clinicId: string;
  name: string;
  specialization: string;
  qualifications: string[];
  photoURL?: string;
  /** Optional link to the veterinarian's auth account (users, role=vet). */
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeSlotDocument extends Document {
  surgeonId: string;
  datetime: string;
  durationMins: number;
  isBooked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentDocument extends Document {
  ownerId: string;
  petId: string;
  clinicId: string;
  surgeonId: string;
  slotId: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClinicSchema = new Schema<ClinicDocument>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    specializations: [{ type: String, required: true }],
    // No rating/reviewCount: there is no review feature in the system, so any
    // value here would be invented. Add them back alongside a real reviews
    // implementation, not before.
    isOpen: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const SurgeonSchema = new Schema<SurgeonDocument>(
  {
    clinicId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    specialization: { type: String, required: true },
    qualifications: [{ type: String, required: true }],
    photoURL: { type: String },
    userId: { type: String, index: true },
  },
  { timestamps: true }
);

const TimeSlotSchema = new Schema<TimeSlotDocument>(
  {
    surgeonId: { type: String, required: true, index: true },
    datetime: { type: String, required: true },
    durationMins: { type: Number, required: true },
    isBooked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const AppointmentSchema = new Schema<AppointmentDocument>(
  {
    ownerId: { type: String, required: true, index: true },
    petId: { type: String, required: true, index: true },
    clinicId: { type: String, required: true, index: true },
    surgeonId: { type: String, required: true, index: true },
    slotId: { type: String, required: true, index: true },
    status: { type: String, enum: ["pending", "confirmed", "cancelled", "completed"], default: "pending" },
    notes: { type: String },
  },
  { timestamps: true }
);

/**
 * Relationship-based access control.
 *
 * A veterinarian may read a pet's health information only while an active
 * grant exists linking them to that pet. Grants arise two ways:
 *
 *   "appointment"    — created automatically when the owner books a slot with a
 *                      surgeon whose listing is linked to a vet account. This is
 *                      what gives continuity of care: the grant outlives the
 *                      single visit, so a returning patient's history stays
 *                      available to the vet who treated them.
 *   "owner_consent"  — created explicitly by the owner, and revocable by them at
 *                      any time. This is the data-ownership escape hatch: sharing
 *                      records with a second opinion without a booking.
 *
 * Revoking sets revokedAt rather than deleting, so the access history itself is
 * auditable — who could see what, and when that ended.
 */
export interface PetAccessGrantDocument extends Document {
  petId: string;
  ownerId: string;
  vetUserId: string;
  source: "appointment" | "owner_consent";
  appointmentId?: string;
  grantedAt: string;
  revokedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PetAccessGrantSchema = new Schema<PetAccessGrantDocument>(
  {
    petId:         { type: String, required: true, index: true },
    ownerId:       { type: String, required: true, index: true },
    vetUserId:     { type: String, required: true, index: true },
    source:        { type: String, required: true, enum: ["appointment", "owner_consent"] },
    appointmentId: { type: String },
    grantedAt:     { type: String, required: true },
    revokedAt:     { type: String },
  },
  { timestamps: true }
);

// One live grant per (pet, vet, source); re-booking reuses it rather than
// stacking duplicates.
PetAccessGrantSchema.index({ petId: 1, vetUserId: 1, source: 1 });

export const PetAccessGrantModel = model<PetAccessGrantDocument>("PetAccessGrant", PetAccessGrantSchema);

export function toGrant(doc: PetAccessGrantDocument) {
  return {
    id: String(doc._id),
    petId: doc.petId,
    ownerId: doc.ownerId,
    vetUserId: doc.vetUserId,
    source: doc.source,
    appointmentId: doc.appointmentId,
    grantedAt: doc.grantedAt,
    revokedAt: doc.revokedAt,
    active: !doc.revokedAt,
  };
}

/**
 * Establish (or reactivate) the appointment-based grant for a booking.
 * No-op when the surgeon has no linked vet account — a clinic listing with no
 * system user cannot be given access to anything.
 */
export async function grantAccessForAppointment(params: {
  petId: string;
  ownerId: string;
  surgeonId: string;
  appointmentId: string;
}): Promise<void> {
  const surgeon = await SurgeonModel.findById(params.surgeonId).lean();
  const vetUserId = (surgeon as { userId?: string } | null)?.userId;
  if (!vetUserId || !params.petId || !params.ownerId) return;

  await PetAccessGrantModel.findOneAndUpdate(
    { petId: params.petId, vetUserId, source: "appointment" },
    {
      $set: {
        petId: params.petId,
        ownerId: params.ownerId,
        vetUserId,
        source: "appointment",
        appointmentId: params.appointmentId,
        grantedAt: new Date().toISOString(),
      },
      $unset: { revokedAt: "" },
    },
    { upsert: true, new: true }
  );
}

export interface InquiryDocument extends Document {
  ownerId: string;
  clinicId: string;
  clinicName: string;
  surgeonId: string;
  surgeonName: string;
  petId: string;
  petName: string;
  message: string;
  reply?: string;
  status: "open" | "replied";
}

const InquirySchema = new Schema<InquiryDocument>(
  {
    ownerId: { type: String, required: true, index: true },
    clinicId: { type: String, required: true, index: true },
    clinicName: { type: String, default: "" },
    surgeonId: { type: String, default: "", index: true },
    surgeonName: { type: String, default: "" },
    petId: { type: String, default: "" },
    petName: { type: String, default: "" },
    message: { type: String, required: true },
    reply: { type: String },
    status: { type: String, enum: ["open", "replied"], default: "open" },
  },
  { timestamps: true }
);

export const ClinicModel = model<ClinicDocument>("Clinic", ClinicSchema);
export const SurgeonModel = model<SurgeonDocument>("Surgeon", SurgeonSchema);
export const TimeSlotModel = model<TimeSlotDocument>("TimeSlot", TimeSlotSchema);
export const AppointmentModel = model<AppointmentDocument>("Appointment", AppointmentSchema);
export const InquiryModel = model<InquiryDocument>("Inquiry", InquirySchema);

function dayAt(hour: number, offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

/**
 * Inserts demo clinics, surgeons and time slots.
 *
 * Opt-in via SEED_DEMO_DATA=true. These are invented records (fixed names,
 * addresses and coordinates), so seeding them by default made the admin
 * dashboard report hardcoded rows as if they were real platform data. With the
 * flag off the platform starts empty and clinics are created through the admin
 * UI — which also exercises the real CRUD path.
 *
 * Note the booking, nearby-search, clinic-map and agent clinic-recommendation
 * flows all need at least one clinic to demo, so turn this on (or add a clinic
 * by hand) before a walkthrough.
 */
export async function seedClinicData(): Promise<void> {
  if (String(process.env.SEED_DEMO_DATA || "false").toLowerCase() !== "true") {
    console.log("[clinic-service] demo seed skipped (set SEED_DEMO_DATA=true to enable)");
    return;
  }

  const existingCount = await ClinicModel.countDocuments();
  if (existingCount > 0) return;
  console.log("[clinic-service] seeding demo clinics (SEED_DEMO_DATA=true)");

  const clinics = await ClinicModel.insertMany([
    {
      name: "GreenPaws Veterinary Center",
      address: "12 Palm Grove, Colombo 05",
      latitude: 6.9271,
      longitude: 79.8612,
      phone: "+94 11 234 5678",
      email: "hello@greenpaws.lk",
      specializations: ["Small Animals", "Dermatology"],
      isOpen: true,
    },
    {
      name: "CarePet Animal Hospital",
      address: "45 Hill Street, Kandy",
      latitude: 7.2906,
      longitude: 80.6337,
      phone: "+94 81 456 7890",
      email: "contact@carepet.lk",
      specializations: ["Surgery", "Internal Medicine"],
      isOpen: true,
    },
  ]);

  const [greenPaws, carePet] = clinics;

  const surgeons = await SurgeonModel.insertMany([
    {
      clinicId: greenPaws._id.toString(),
      name: "Dr. Anushka Perera",
      specialization: "Dermatology",
      qualifications: ["DVM", "MVetMed"],
      photoURL: "",
    },
    {
      clinicId: greenPaws._id.toString(),
      name: "Dr. Nimal Fernando",
      specialization: "General Practice",
      qualifications: ["DVM"],
      photoURL: "",
    },
    {
      clinicId: carePet._id.toString(),
      name: "Dr. Sashi Jayawardena",
      specialization: "Surgery",
      qualifications: ["DVM", "MS Surgery"],
      photoURL: "",
    },
    {
      clinicId: carePet._id.toString(),
      name: "Dr. Kavindya Silva",
      specialization: "Internal Medicine",
      qualifications: ["DVM", "PhD"],
      photoURL: "",
    },
  ]);

  const slotDocs = surgeons.flatMap((surgeon, index) => {
    const baseDay = index % 2 === 0 ? 0 : 1;
    return [
      { surgeonId: surgeon._id.toString(), datetime: dayAt(9, baseDay), durationMins: 30, isBooked: false },
      { surgeonId: surgeon._id.toString(), datetime: dayAt(11, baseDay), durationMins: 30, isBooked: false },
      { surgeonId: surgeon._id.toString(), datetime: dayAt(14, baseDay + 1), durationMins: 30, isBooked: false },
    ];
  });

  await TimeSlotModel.insertMany(slotDocs);
}
