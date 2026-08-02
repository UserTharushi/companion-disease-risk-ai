import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { User } from "@companion-ai/shared-types";
import { UserModel } from "../models/user.model";

type UiRole = "pet-owner" | "veterinarian" | "admin";
type SystemRole = "owner" | "vet" | "admin";

type RegisterBody = {
  email: string;
  password: string;
  displayName: string;
  phoneNumber?: string;
  role?: UiRole;
  mustChangePassword?: boolean;
  // Optional veterinarian profile fields supplied by admin provisioning.
  doctorRegistrationNumber?: string;
  age?: string;
  gender?: string;
  dateOfBirth?: string;
  specialization?: string;
  address?: string;
  photoURL?: string;
};

type LoginBody = {
  email: string;
  password: string;
};

type UpdateProfileBody = {
  displayName?: string;
  phoneNumber?: string;
  address?: string;
  photoURL?: string;
  dateOfBirth?: string;
  specialization?: string;
  bio?: string;
  preferredLanguage?: string;
};

type ResetPasswordBody = {
  token: string;
  password: string;
};

type NotificationPayload = {
  type: "password_reset";
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  message: string;
  metadata: {
    resetToken: string;
    resetUrl: string;
    expiresInMinutes: number;
  };
};

function normalizeRole(role: string | undefined): SystemRole {
  if (role === "admin") return "admin";
  if (role === "veterinarian" || role === "vet") return "vet";
  return "owner";
}

function httpError(message: string, statusCode: number): Error {
  const err = new Error(message);
  (err as Error & { statusCode?: number }).statusCode = statusCode;
  return err;
}

const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const JWT_EXPIRY = (process.env.JWT_EXPIRY as jwt.SignOptions["expiresIn"]) || "7d";
const SALT_ROUNDS = 10;
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4004";

async function dispatchNotification(payload: NotificationPayload): Promise<void> {
  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL.replace(/\/$/, "")}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`notification-service responded with ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[auth-service] notification dispatch failed: ${message}`);
  }
}

export async function register(body: RegisterBody, callerToken?: string) {
  if (!body.email || !body.password || !body.displayName) {
    throw httpError("email, password, and displayName are required", 400);
  }

  // Veterinarian accounts are provisioned by an administrator only —
  // self-registration would bypass professional verification.
  if (normalizeRole(body.role) === "vet") {
    let callerRole = "";
    if (callerToken) {
      try {
        callerRole = (jwt.verify(callerToken, JWT_SECRET) as { role?: string }).role ?? "";
      } catch {
        callerRole = "";
      }
    }
    if (callerRole !== "admin") {
      throw httpError("Veterinarian accounts are created by an administrator", 403);
    }
  }

  const existing = await UserModel.findOne({ email: body.email.trim().toLowerCase() });
  if (existing) {
    throw httpError("An account with this email already exists", 409);
  }

  const role = normalizeRole(body.role);
  const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

  const user = await UserModel.create({
    email: body.email.trim().toLowerCase(),
    passwordHash,
    displayName: body.displayName,
    phoneNumber: body.phoneNumber,
    role,
    mustChangePassword: Boolean(body.mustChangePassword),
    doctorRegistrationNumber: body.doctorRegistrationNumber,
    age: body.age,
    gender: body.gender,
    dateOfBirth: body.dateOfBirth,
    specialization: body.specialization,
    address: body.address,
    photoURL: body.photoURL,
    status: "active",
  });

  const token = jwt.sign({ uid: user._id, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

  return {
    uid: user._id,
    email: user.email,
    displayName: user.displayName,
    role,
    token,
  };
}

export async function login(body: LoginBody) {
  if (!body.email || !body.password) {
    throw httpError("email and password are required", 400);
  }

  const user = await UserModel.findOne({ email: body.email.trim().toLowerCase() });
  if (!user) {
    throw httpError("Invalid email or password", 401);
  }

  const isMatch = await user.comparePassword(body.password);
  if (!isMatch) {
    throw httpError("Invalid email or password", 401);
  }

  // Deactivating an account only changed a field the login path never read, so
  // a vet an admin had removed could still sign in with their old password and
  // still held every access grant they had been given. Checked after the
  // password so the response does not reveal which emails exist.
  if (user.status === "inactive") {
    throw httpError("This account has been deactivated. Please contact an administrator.", 403);
  }

  const token = jwt.sign({ uid: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

  return {
    uid: user._id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
    token,
  };
}

export async function logout(_uid: string) {
  return true;
}

export async function refreshToken(refreshToken: string) {
  const decoded = jwt.verify(refreshToken, JWT_SECRET) as { uid: string; role: string };
  const token = jwt.sign({ uid: decoded.uid, role: decoded.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  return { token };
}

export async function forgotPassword(email: string) {
  if (!email) {
    throw httpError("email is required", 400);
  }
  // Check if user exists (don't reveal if they do or don't for security)
  const user = await UserModel.findOne({ email: email.trim().toLowerCase() });
  if (user) {
    const resetToken = jwt.sign({ uid: user._id, purpose: "password-reset" }, JWT_SECRET, { expiresIn: "1h" });
    const resetUrl = `${process.env.FRONTEND_BASE_URL || "http://localhost:3001"}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

    await dispatchNotification({
      type: "password_reset",
      recipientEmail: user.email,
      recipientName: user.displayName,
      subject: "Reset your Companion Disease Risk AI password",
      message: "Use the password reset link to choose a new password. This link expires in 60 minutes.",
      metadata: {
        resetToken,
        resetUrl,
        expiresInMinutes: 60,
      },
    });

    console.log(`[auth-service] Password reset notification prepared for ${email}`);
  }
  // Always return success to prevent email enumeration
  return true;
}

export async function verifyToken(token: string): Promise<Partial<User>> {
  const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; role: string };
  const user = await UserModel.findById(decoded.uid).select("-passwordHash");
  if (!user) {
    throw httpError("User not found", 404);
  }
  return {
    uid: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    phoneNumber: user.phoneNumber,
    address: user.address,
    photoURL: user.photoURL,
    dateOfBirth: user.dateOfBirth,
    specialization: user.specialization,
    bio: user.bio,
    role: user.role as User["role"],
  };
}

export async function getProfile(token: string): Promise<Partial<User>> {
  return verifyToken(token);
}

export async function updateProfile(token: string, body: UpdateProfileBody): Promise<Partial<User>> {
  const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; role: string };
  const user = await UserModel.findById(decoded.uid);
  if (!user) {
    throw httpError("User not found", 404);
  }

  if (typeof body.displayName === "string") {
    const nextDisplayName = body.displayName.trim();
    if (!nextDisplayName) {
      throw httpError("displayName cannot be empty", 400);
    }
    user.displayName = nextDisplayName;
  }

  if (typeof body.phoneNumber === "string") {
    user.phoneNumber = body.phoneNumber.trim() || undefined;
  }

  if (typeof body.address === "string") {
    user.address = body.address.trim() || undefined;
  }

  if (typeof body.photoURL === "string") {
    user.photoURL = body.photoURL.trim() || undefined;
  }

  if (typeof body.dateOfBirth === "string") {
    user.dateOfBirth = body.dateOfBirth.trim() || undefined;
  }

  if (typeof body.specialization === "string") {
    user.specialization = body.specialization.trim() || undefined;
  }

  if (typeof body.bio === "string") {
    user.bio = body.bio.trim() || undefined;
  }

  if (typeof body.preferredLanguage === "string" && ["en", "si", "ta"].includes(body.preferredLanguage)) {
    user.preferredLanguage = body.preferredLanguage as "en" | "si" | "ta";
  }

  await user.save();

  return {
    uid: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    phoneNumber: user.phoneNumber,
    address: user.address,
    photoURL: user.photoURL,
    dateOfBirth: user.dateOfBirth,
    specialization: user.specialization,
    bio: user.bio,
    preferredLanguage: user.preferredLanguage,
    role: user.role as User["role"],
  } as Partial<User> & { preferredLanguage?: string };
}

export async function changePassword(token: string, currentPassword: string, newPassword: string) {
  if (!currentPassword || !newPassword) {
    throw httpError("currentPassword and newPassword are required", 400);
  }
  if (newPassword.length < 8) {
    throw httpError("New password must be at least 8 characters", 400);
  }
  const decoded = jwt.verify(token, JWT_SECRET) as { uid: string };
  const user = await UserModel.findById(decoded.uid);
  if (!user) {
    throw httpError("User not found", 404);
  }
  const valid = await user.comparePassword(currentPassword);
  if (!valid) {
    throw httpError("Current password is incorrect", 401);
  }
  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.mustChangePassword = false;
  await user.save();
  return true;
}

// Service-to-service lookup used by the monitoring agent to localize notifications
export async function getUserLanguage(uid: string): Promise<string> {
  const user = await UserModel.findById(uid).select("preferredLanguage").lean();
  return user?.preferredLanguage ?? "en";
}

export async function resetPassword(body: ResetPasswordBody) {
  if (!body.token || !body.password) {
    throw httpError("token and password are required", 400);
  }

  if (body.password.length < 8) {
    throw httpError("password must be at least 8 characters", 400);
  }

  const decoded = jwt.verify(body.token, JWT_SECRET) as { uid?: string; purpose?: string };
  if (decoded.purpose !== "password-reset" || !decoded.uid) {
    throw httpError("Invalid or expired reset token", 400);
  }

  const user = await UserModel.findById(decoded.uid);
  if (!user) {
    throw httpError("User not found", 404);
  }

  user.passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
  await user.save();

  return true;
}
