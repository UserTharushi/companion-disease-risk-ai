import { Router, type Request } from "express";
import { isValidObjectId } from "mongoose";
import { NotificationModel, toNotification } from "../models/notification.model";

export const notificationRouter = Router();

// Identity headers are stamped by the api-gateway from a verified JWT.
// Owners may only touch their own notifications, regardless of query params.
function ownerScopedUserId(req: Request, requested: string): string {
  const uid = req.headers["x-user-id"];
  const role = req.headers["x-user-role"];
  if (typeof uid === "string" && uid && role === "owner") {
    return uid;
  }
  return requested;
}

// POST /api/notifications — create (idempotent via dedupeKey)
notificationRouter.post("/", async (req, res, next) => {
  try {
    const { userId, type, title, body } = req.body ?? {};
    if (!userId || !type || !title || !body) {
      return res.status(400).json({
        success: false,
        message: "userId, type, title, and body are required",
      });
    }

    const dedupeKey = req.body.dedupeKey ? String(req.body.dedupeKey) : undefined;
    if (dedupeKey) {
      const existing = await NotificationModel.findOne({ dedupeKey });
      if (existing) {
        return res.json({ success: true, data: toNotification(existing), deduplicated: true });
      }
    }

    const doc = await NotificationModel.create({
      userId: String(userId),
      type: String(type),
      title: String(title),
      body: String(body),
      data: req.body.data,
      petId: req.body.petId ? String(req.body.petId) : undefined,
      urgency: req.body.urgency ? String(req.body.urgency) : undefined,
      dedupeKey,
    });
    res.status(201).json({ success: true, data: toNotification(doc) });
  } catch (err: unknown) {
    // Duplicate dedupeKey race — treat as deduplicated
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return res.json({ success: true, deduplicated: true });
    }
    next(err);
  }
});

// GET /api/notifications?userId=&unreadOnly=&limit=
notificationRouter.get("/", async (req, res, next) => {
  try {
    let userId = req.query.userId ? String(req.query.userId) : "";
    userId = ownerScopedUserId(req, userId);
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }
    const query: Record<string, unknown> = { userId };
    if (String(req.query.unreadOnly) === "true") {
      query.read = false;
    }
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
    const docs = await NotificationModel.find(query).sort({ createdAt: -1 }).limit(limit);
    const unreadCount = await NotificationModel.countDocuments({ userId, read: false });
    res.json({ success: true, data: docs.map(toNotification), meta: { unreadCount } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/read-all  { userId }
notificationRouter.patch("/read-all", async (req, res, next) => {
  try {
    let userId = req.body?.userId ? String(req.body.userId) : "";
    userId = ownerScopedUserId(req, userId);
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }
    const result = await NotificationModel.updateMany({ userId, read: false }, { read: true });
    res.json({ success: true, data: { modified: result.modifiedCount } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
notificationRouter.patch("/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    const existing = await NotificationModel.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    const uid = req.headers["x-user-id"];
    if (typeof uid === "string" && uid && req.headers["x-user-role"] === "owner" && existing.userId !== uid) {
      return res.status(403).json({ success: false, message: "You can only modify your own notifications" });
    }
    const doc = await NotificationModel.findByIdAndUpdate(id, { read: true }, { new: true });
    if (!doc) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    res.json({ success: true, data: toNotification(doc) });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/send — legacy alias used by auth-service (password reset).
// Persists when possible and logs; response shape kept identical.
notificationRouter.post("/send", async (req, res) => {
  const { type, recipientEmail, subject, message, metadata } = req.body ?? {};

  if (!type || !recipientEmail || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: "type, recipientEmail, subject, and message are required",
    });
  }

  console.log(`[notification-service] ${type} notification queued for ${recipientEmail}`);
  console.log(`[notification-service] subject: ${subject}`);
  console.log(`[notification-service] message: ${message}`);
  if (metadata) {
    console.log(`[notification-service] metadata: ${JSON.stringify(metadata)}`);
  }

  try {
    await NotificationModel.create({
      userId: String(recipientEmail),
      type: String(type),
      title: String(subject),
      body: String(message),
    });
  } catch {
    // Mongo unavailable — still accept, matching previous log-only behavior
  }

  res.json({
    success: true,
    message: "Notification accepted",
    data: { type, recipientEmail, subject },
  });
});
