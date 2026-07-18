import type { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.forgotPassword(req.body.email);
    res.json({ success: true, message: "If an account exists, reset instructions have been sent." });
  } catch (err) { next(err); }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const callerToken = req.headers.authorization?.split(" ")[1];
    const result = await authService.register(req.body, callerToken);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.logout(req.body.uid);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) { next(err); }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });
    const user = await authService.verifyToken(token);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });
    const profile = await authService.getProfile(token);
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });
    const profile = await authService.updateProfile(token, req.body ?? {});
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });
    await authService.changePassword(token, req.body?.currentPassword, req.body?.newPassword);
    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) { next(err); }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.resetPassword(req.body);
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) { next(err); }
}
