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

/**
 * A single turn in an inquiry thread.
 *
 * Threads are deliberately BOUNDED (see MAX_THREAD_MESSAGES). This is triage,
 * not consultation: a vet's answer is usually a clarifying question, and the
 * owner needs to be able to answer it — but an unbounded chat would turn into
 * free-text clinical advice, which this system does not provide. Once the cap
 * is reached the thread closes and the owner is pointed at a real appointment.
 */
export interface InquiryMessage {
  senderRole: "owner" | "vet";
  senderId: string;
  body: string;
  createdAt: Date;
}

/** Hard cap on turns per thread. Reaching it closes the thread. */
export const MAX_THREAD_MESSAGES = 10;

export interface InquiryDocument extends Document {
  ownerId: string;
  clinicId: string;
  clinicName: string;
  surgeonId: string;
  surgeonName: string;
  petId: string;
  petName: string;
  /**
   * The original question, mirrored from messages[0]. Retained because it is a
   * required field on existing documents; messages[] is the source of truth.
   */
  message: string;
  messages: InquiryMessage[];
  status: "awaiting_vet" | "answered" | "closed";
}

const InquiryMessageSchema = new Schema<InquiryMessage>(
  {
    senderRole: { type: String, enum: ["owner", "vet"], required: true },
    senderId: { type: String, default: "" },
    body: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
    messages: { type: [InquiryMessageSchema], default: [] },
    // Derived from who spoke last, never set directly — this is what makes the
    // vet's inquiry list a real work queue: an owner follow-up puts the thread
    // back into "awaiting_vet" instead of leaving it terminally "replied".
    status: {
      type: String,
      enum: ["awaiting_vet", "answered", "closed"],
      default: "awaiting_vet",
      index: true,
    },
  },
  { timestamps: true }
);

/** Status follows the last speaker; the cap wins over everything. */
export function deriveInquiryStatus(messages: InquiryMessage[]): InquiryDocument["status"] {
  if (messages.length >= MAX_THREAD_MESSAGES) return "closed";
  return messages[messages.length - 1]?.senderRole === "vet" ? "answered" : "awaiting_vet";
}

export const ClinicModel = model<ClinicDocument>("Clinic", ClinicSchema);
export const SurgeonModel = model<SurgeonDocument>("Surgeon", SurgeonSchema);
export const TimeSlotModel = model<TimeSlotDocument>("TimeSlot", TimeSlotSchema);
export const AppointmentModel = model<AppointmentDocument>("Appointment", AppointmentSchema);
export const InquiryModel = model<InquiryDocument>("Inquiry", InquirySchema);

/**
 * Fold pre-thread inquiries (message + optional reply) into messages[].
 *
 * Runs on every boot and is idempotent — it only touches documents that have no
 * thread yet. Without it, existing inquiries would render as empty threads and
 * effectively disappear from both dashboards.
 *
 * Uses the raw collection deliberately: `reply` is no longer in the schema, so a
 * Mongoose query would strip the very field being migrated.
 */
export async function migrateInquiryThreads(): Promise<number> {
  const collection = InquiryModel.collection;
  const legacy = await collection
    .find({ $or: [{ messages: { $exists: false } }, { messages: { $size: 0 } }] })
    .toArray();

  let migrated = 0;
  for (const doc of legacy) {
    const messages: InquiryMessage[] = [];
    const question = String(doc.message ?? "").trim();
    if (question) {
      messages.push({
        senderRole: "owner",
        senderId: String(doc.ownerId ?? ""),
        body: question,
        createdAt: doc.createdAt ?? new Date(),
      });
    }
    // A "replied" status with no reply text is the old broken behaviour: the
    // thread was closed while the owner received nothing. Folding it in without
    // a vet turn correctly puts it back in front of the vet.
    const reply = String(doc.reply ?? "").trim();
    if (reply) {
      messages.push({
        senderRole: "vet",
        senderId: "",
        body: reply,
        createdAt: doc.updatedAt ?? doc.createdAt ?? new Date(),
      });
    }
    if (!messages.length) continue;

    await collection.updateOne(
      { _id: doc._id },
      { $set: { messages, status: deriveInquiryStatus(messages) }, $unset: { reply: "" } }
    );
    migrated += 1;
  }

  if (migrated) console.log(`[clinic-service] migrated ${migrated} inquiry thread(s)`);
  return migrated;
}

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
