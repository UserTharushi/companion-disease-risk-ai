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
};

type LoginBody = {
  email: string;
  password: string;
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

export async function register(body: RegisterBody) {
  if (!body.email || !body.password || !body.displayName) {
    throw httpError("email, password, and displayName are required", 400);
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

  const token = jwt.sign({ uid: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

  return {
    uid: user._id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
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
    // TODO: integrate with notification-service to send actual reset email
    // For dev, just log the reset token
    const resetToken = jwt.sign({ uid: user._id, purpose: "password-reset" }, JWT_SECRET, { expiresIn: "1h" });
    console.log(`[auth-service] Password reset token for ${email}: ${resetToken}`);
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
    role: user.role as User["role"],
  };
}
