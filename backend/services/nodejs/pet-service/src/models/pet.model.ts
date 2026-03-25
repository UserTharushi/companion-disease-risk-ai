import { Schema, model, Document } from "mongoose";
import type { Pet } from "@companion-ai/shared-types";

export interface PetDocument extends Omit<Pet, "id">, Document {}

const PetSchema = new Schema<PetDocument>(
  {
    ownerId:  { type: String, required: true, index: true },
    name:     { type: String, required: true },
    species:  { type: String, enum: ["dog", "cat"], required: true },
    breed:    { type: String, required: true },
    ageYears: { type: Number, required: true },
    weightKg: { type: Number, required: true },
    sex:      { type: String, enum: ["male", "female"], required: true },
    neutered: { type: Boolean, default: false },
    photoURL: { type: String },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

export const PetModel = model<PetDocument>("Pet", PetSchema);
