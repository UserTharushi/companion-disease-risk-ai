import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

const JWT_SECRET = "test-secret";

async function buildApp(enforce: boolean) {
  vi.resetModules();
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.AUTH_ENFORCE = String(enforce);
  const { authenticate } = await import("./auth");

  const app = express();
  app.use(authenticate);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.post("/api/auth/login", (_req, res) => res.json({ ok: true }));
  app.get("/api/pets", (req, res) =>
    res.json({ uid: req.headers["x-user-id"] ?? null, user: (req as never as { user?: unknown }).user ?? null })
  );
  return app;
}

function tokenFor(uid: string, role: string) {
  return jwt.sign({ uid, role }, JWT_SECRET, { expiresIn: "1h" });
}

describe("authenticate middleware (AUTH_ENFORCE=true)", () => {
  let app: express.Express;
  beforeEach(async () => {
    app = await buildApp(true);
  });

  it("rejects protected routes without a token", async () => {
    const response = await request(app).get("/api/pets");
    expect(response.status).toBe(401);
  });

  it("rejects invalid tokens", async () => {
    const response = await request(app).get("/api/pets").set("Authorization", "Bearer not-a-jwt");
    expect(response.status).toBe(401);
  });

  it("allows public auth routes without a token", async () => {
    expect((await request(app).get("/health")).status).toBe(200);
    expect((await request(app).post("/api/auth/login")).status).toBe(200);
  });

  it("accepts valid tokens and attaches the user", async () => {
    const response = await request(app)
      .get("/api/pets")
      .set("Authorization", `Bearer ${tokenFor("user-1", "owner")}`);
    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({ uid: "user-1", role: "owner" });
  });
});

describe("authenticate middleware (AUTH_ENFORCE=false)", () => {
  let app: express.Express;
  beforeEach(async () => {
    app = await buildApp(false);
  });

  it("passes requests without tokens through", async () => {
    const response = await request(app).get("/api/pets");
    expect(response.status).toBe(200);
    expect(response.body.user).toBeNull();
  });

  it("still decodes a valid token when present", async () => {
    const response = await request(app)
      .get("/api/pets")
      .set("Authorization", `Bearer ${tokenFor("user-2", "vet")}`);
    expect(response.body.user).toEqual({ uid: "user-2", role: "vet" });
  });

  it("tolerates invalid tokens without rejecting", async () => {
    const response = await request(app).get("/api/pets").set("Authorization", "Bearer junk");
    expect(response.status).toBe(200);
  });
});
