import { Schema, model, type Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  phoneNumber?: string;
  address?: string;
  photoURL?: string;
  dateOfBirth?: string;
  specialization?: string;
  bio?: string;
  preferredLanguage: "en" | "si" | "ta";
  mustChangePassword: boolean;
  role: "owner" | "vet" | "admin";
  // Admin-provisioned veterinarian details. These lived only in the admin's
  // browser (localStorage "managed veterinarians"), so the roster vanished on
  // another machine even though the accounts existed here.
  doctorRegistrationNumber?: string;
  age?: string;
  gender?: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<UserDocument>(
  {
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName:  { type: String, required: true, trim: true },
    phoneNumber:  { type: String, trim: true },
    address:      { type: String, trim: true },
    photoURL:     { type: String, trim: true },
    dateOfBirth:  { type: String, trim: true },
    specialization: { type: String, trim: true },
    bio:          { type: String, trim: true },
    preferredLanguage: { type: String, enum: ["en", "si", "ta"], default: "en" },
    mustChangePassword: { type: Boolean, default: false },
    role:         { type: String, enum: ["owner", "vet", "admin"], default: "owner", index: true },
    doctorRegistrationNumber: { type: String, trim: true },
    age:          { type: String, trim: true },
    gender:       { type: String, trim: true },
    status:       { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = async function (candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
};

export const UserModel = model<UserDocument>("User", userSchema);
