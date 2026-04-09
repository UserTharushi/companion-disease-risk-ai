import { Schema, model, type Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  phoneNumber?: string;
  role: "owner" | "vet" | "admin";
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
    role:         { type: String, enum: ["owner", "vet", "admin"], default: "owner" },
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = async function (candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
};

export const UserModel = model<UserDocument>("User", userSchema);
