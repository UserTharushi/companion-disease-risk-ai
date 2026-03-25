import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import type { User } from "@companion-ai/shared-types";
import { readFileSync } from "node:fs";

type RegisterBody = { email: string; password: string; displayName: string };
type LoginBody = { idToken: string };

type UiRole = "pet-owner" | "veterinarian" | "admin";
type SystemRole = "owner" | "vet" | "admin";

function normalizeRole(role: string | undefined): SystemRole {
  const safeRole = role as UiRole | undefined;
  if (safeRole === "admin") return "admin";
  if (safeRole === "veterinarian") return "vet";
  return "owner";
}

// Initialize Firebase Admin (singleton)
if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const JWT_EXPIRY = (process.env.JWT_EXPIRY as jwt.SignOptions["expiresIn"]) || "7d";

export async function register(body: RegisterBody & { role?: UiRole }) {
  if (!body.email || !body.password || !body.displayName) {
    const error = new Error("email, password, and displayName are required");
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }

  const firebaseUser = await admin.auth().createUser({
    email: body.email,
    password: body.password,
    displayName: body.displayName,
  });
  const role = normalizeRole(body.role);
  await admin.auth().setCustomUserClaims(firebaseUser.uid, { role });
  const token = jwt.sign({ uid: firebaseUser.uid, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  return { uid: firebaseUser.uid, email: firebaseUser.email, displayName: firebaseUser.displayName, role, token };
}

export async function login(body: LoginBody) {
  if (!body.idToken) {
    const error = new Error("idToken is required");
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }

  // Verify Firebase ID token from client-side Firebase Auth
  const decoded = await admin.auth().verifyIdToken(body.idToken);
  const role = normalizeRole((decoded.role as string | undefined) ?? "pet-owner");
  const token = jwt.sign({ uid: decoded.uid, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  return { uid: decoded.uid, role, token };
}

export async function logout(_uid: string) {
  // Token invalidation is handled on client side; could revoke Firebase sessions here
  return true;
}

export async function refreshToken(refreshToken: string) {
  const decoded = jwt.verify(refreshToken, JWT_SECRET) as { uid: string; role: string };
  const token = jwt.sign({ uid: decoded.uid, role: decoded.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  return { token };
}

export async function verifyToken(token: string): Promise<Partial<User>> {
  const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; role: string };
  const firebaseUser = await admin.auth().getUser(decoded.uid);
  return {
    uid:         firebaseUser.uid,
    email:       firebaseUser.email ?? "",
    displayName: firebaseUser.displayName ?? "",
    role: decoded.role as User["role"],
  };
}
