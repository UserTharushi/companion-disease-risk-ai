import { Router } from "express";
import { register, login, logout, refreshToken, verifyToken, forgotPassword, getProfile, updateProfile, resetPassword, changePassword } from "../controllers/auth.controller";
import { getUserLanguage } from "../services/auth.service";

export const authRouter = Router();

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
