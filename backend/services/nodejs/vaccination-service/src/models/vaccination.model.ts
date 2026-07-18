import { Schema, model, Document } from "mongoose";
import type { VaccinationRecord } from "@companion-ai/shared-types";

export interface VaccinationDocument extends Omit<VaccinationRecord, "id">, Document {
  ownerId?: string;
}

const VaccinationSchema = new Schema<VaccinationDocument>(
  {
    petId:          { type: String, required: true, index: true },
    ownerId:        { type: String, index: true },
    vaccineName:    { type: String, required: true },
    administeredAt: { type: String, required: true },
    nextDueAt:      { type: String, required: true, index: true },
    administeredBy: { type: String },
    batchNumber:    { type: String },
    notes:          { type: String },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

export const VaccinationModel = model<VaccinationDocument>("Vaccination", VaccinationSchema);

export function toRecord(doc: VaccinationDocument): VaccinationRecord & { ownerId?: string } {
  return {
    id: String(doc._id),
    petId: doc.petId,
    ownerId: doc.ownerId,
    vaccineName: doc.vaccineName,
    administeredAt: doc.administeredAt,
    nextDueAt: doc.nextDueAt,
    administeredBy: doc.administeredBy,
    batchNumber: doc.batchNumber,
    notes: doc.notes,
  };
}
