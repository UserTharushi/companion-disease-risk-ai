import { Router } from "express";
import { register, login, logout, refreshToken, verifyToken, forgotPassword, getProfile, updateProfile, resetPassword, changePassword } from "../controllers/auth.controller";
import { getUserLanguage } from "../services/auth.service";
import { UserModel } from "../models/user.model";

export const authRouter = Router();

// UI role names -> stored role. Mirrors normalizeRole in auth.service (not
// exported there); keep the two in step.
function toSystemRole(role: string): "owner" | "vet" | "admin" | null {
  if (role === "admin") return "admin";
  if (role === "veterinarian" || role === "vet") return "vet";
  if (role === "pet-owner" || role === "owner") return "owner";
  return null;
}

// Shape the admin roster expects. Never include passwordHash.
function toManagedUser(user: Record<string, any>) {
  return {
    id: String(user._id),
    doctorRegistrationNumber: user.doctorRegistrationNumber || "",
    name: user.displayName || "",
    age: user.age || "",
    email: user.email || "",
    phone: user.phoneNumber || "",
    gender: user.gender || "",
    dateOfBirth: user.dateOfBirth || "",
    specialization: user.specialization || "",
    address: user.address || "",
    photoDataUrl: user.photoURL || "",
    status: user.status === "inactive" ? "inactive" : "active",
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
  };
}

authRouter.post("/register",        register);
authRouter.post("/login",           login);
authRouter.post("/logout",          logout);
authRouter.post("/refresh-token",   refreshToken);
authRouter.get("/verify",           verifyToken);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);
authRouter.get("/profile",          getProfile);
authRouter.patch("/profile",        updateProfile);
authRouter.post("/change-password", changePassword);

/**
 * POST /api/auth/users/resolve — service-to-service name lookup.
 *
 * clinic-service uses this to attach owner names to appointments so a
 * veterinarian knows who is bringing the animal. Deliberately NOT exposed to
 * vets directly: routing it through clinic-service means a vet only ever sees
 * owners attached to their own appointments and cannot enumerate accounts.
 * Returns display name and phone only - no email, address or date of birth.
 */
authRouter.post("/users/resolve", async (req, res) => {
  const serviceKey = process.env.SERVICE_KEY || "internal-dev-key";
  if (req.headers["x-service-key"] !== serviceKey) {
    return res.status(403).json({ success: false, message: "Service key required" });
  }
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 200) : [];
  if (!ids.length) return res.json({ success: true, data: [] });
  try {
    const users = await UserModel.find({ _id: { $in: ids } })
      .select("displayName phoneNumber")
      .lean();
    res.json({
      success: true,
      data: users.map((u) => ({
        id: String(u._id),
        name: u.displayName || "",
        phone: u.phoneNumber || "",
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Veterinarian directory, readable by any authenticated user. Owners need to
// pick a vet to share a pet with, but must not see the admin roster: this
// returns name and specialization only — no email, phone, address or DOB.
authRouter.get("/vets/directory", async (_req, res) => {
  try {
    const vets = await UserModel.find({ role: "vet", status: { $ne: "inactive" } })
      .sort({ displayName: 1 })
      .limit(200)
      .lean();
    res.json({
      success: true,
      data: vets.map((vet) => ({
        id: String(vet._id),
        name: vet.displayName || "",
        specialization: vet.specialization || "",
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Admin roster: list accounts by role (used for the managed-veterinarian list,
// which previously lived only in the admin's localStorage).
authRouter.get("/users", async (req, res) => {
  if (req.headers["x-user-role"] && req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ success: false, message: "Admin role required" });
  }
  try {
    const query: Record<string, unknown> = {};
    const role = typeof req.query.role === "string" ? toSystemRole(req.query.role) : null;
    if (role) query.role = role;
    const users = await UserModel.find(query).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ success: true, data: users.map(toManagedUser) });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Admin edits a managed account (vet details, activate/deactivate).
authRouter.patch("/users/:uid", async (req, res) => {
  if (req.headers["x-user-role"] && req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ success: false, message: "Admin role required" });
  }
  const allowed = [
    "displayName", "phoneNumber", "address", "photoURL", "dateOfBirth",
    "specialization", "doctorRegistrationNumber", "age", "gender", "status",
  ] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) update[key] = req.body[key];
  }
  try {
    const user = await UserModel.findByIdAndUpdate(req.params.uid, update, { new: true }).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: toManagedUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Admin removes a managed account outright.
// Safe for the research loop: a vet's confirmed diagnosis is stored as text on
// the prediction document, and feedback_summary() joins on that text, never on
// vet_id — so agreement metrics survive the account being deleted.
authRouter.delete("/users/:uid", async (req, res) => {
  if (req.headers["x-user-role"] && req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ success: false, message: "Admin role required" });
  }
  if (req.headers["x-user-id"] === req.params.uid) {
    return res.status(400).json({ success: false, message: "You cannot delete your own account" });
  }
  try {
    const user = await UserModel.findByIdAndDelete(req.params.uid).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, message: "Account deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Service-to-service: monitoring agent looks up a user's language preference
authRouter.get("/users/:uid/language", async (req, res) => {
  const serviceKey = process.env.SERVICE_KEY || "internal-dev-key";
  if (req.headers["x-service-key"] !== serviceKey) {
    return res.status(403).json({ success: false, message: "Service key required" });
  }
  try {
    const language = await getUserLanguage(req.params.uid);
    res.json({ success: true, data: { language } });
  } catch {
    res.json({ success: true, data: { language: "en" } });
  }
});
