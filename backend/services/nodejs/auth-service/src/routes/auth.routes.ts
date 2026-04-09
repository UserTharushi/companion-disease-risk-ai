import { Router } from "express";
import { register, login, logout, refreshToken, verifyToken, forgotPassword } from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/register",        register);
authRouter.post("/login",           login);
authRouter.post("/logout",          logout);
authRouter.post("/refresh-token",   refreshToken);
authRouter.get("/verify",           verifyToken);
authRouter.post("/forgot-password", forgotPassword);
