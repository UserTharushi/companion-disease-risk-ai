import { Schema, model, type Document } from "mongoose";

export interface ClinicDocument extends Document {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email?: string;
  specializations: string[];
  rating: number;
  reviewCount: number;
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
  rating: number;
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
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
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
    rating: { type: Number, default: 0 },
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

export async function seedClinicData(): Promise<void> {
  const existingCount = await ClinicModel.countDocuments();
  if (existingCount > 0) return;

  const clinics = await ClinicModel.insertMany([
    {
      name: "GreenPaws Veterinary Center",
      address: "12 Palm Grove, Colombo 05",
      latitude: 6.9271,
      longitude: 79.8612,
      phone: "+94 11 234 5678",
      email: "hello@greenpaws.lk",
      specializations: ["Small Animals", "Dermatology"],
      rating: 4.8,
      reviewCount: 124,
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
      rating: 4.6,
      reviewCount: 89,
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
      rating: 4.9,
    },
    {
      clinicId: greenPaws._id.toString(),
      name: "Dr. Nimal Fernando",
      specialization: "General Practice",
      qualifications: ["DVM"],
      photoURL: "",
      rating: 4.7,
    },
    {
      clinicId: carePet._id.toString(),
      name: "Dr. Sashi Jayawardena",
      specialization: "Surgery",
      qualifications: ["DVM", "MS Surgery"],
      photoURL: "",
      rating: 4.8,
    },
    {
      clinicId: carePet._id.toString(),
      name: "Dr. Kavindya Silva",
      specialization: "Internal Medicine",
      qualifications: ["DVM", "PhD"],
      photoURL: "",
      rating: 4.7,
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
