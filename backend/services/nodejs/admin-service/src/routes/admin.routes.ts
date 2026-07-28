import { Router, type Request, type Response, type NextFunction } from "express";
import {
  AnnouncementModel,
  ApprovalModel,
  AuditModel,
  TicketModel,
  toAnnouncement,
  toApproval,
  toAudit,
  toTicket,
} from "../models/admin.models";

export const approvalRouter = Router();
export const ticketRouter = Router();
export const auditRouter = Router();
export const announcementRouter = Router();

// Identity headers stamped by the api-gateway from a verified JWT.
function identity(req: Request): { uid: string; role: string } | null {
  const uid = req.headers["x-user-id"];
  const role = req.headers["x-user-role"];
  if (typeof uid === "string" && uid) {
    return { uid, role: typeof role === "string" ? role : "owner" };
  }
  return null;
}

// Matches clinic-service's requireStaff convention: reject a role that is
// present and wrong, pass through when no header exists so the stack still
// works with AUTH_ENFORCE=false in local dev.
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.headers["x-user-role"];
  if (typeof role === "string" && role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin role required" });
  }
  next();
}

// ── Approvals ────────────────────────────────────────────
// GET /api/approvals?status=pending
approvalRouter.get("/", requireAdmin, async (req, res, next) => {
  try {
    const query: Record<string, unknown> = {};
    if (typeof req.query.status === "string" && req.query.status) {
      query.status = req.query.status;
    }
    const docs = await ApprovalModel.find(query).sort({ submittedAt: -1 }).limit(200);
    res.json({ success: true, data: docs.map(toApproval) });
  } catch (err) {
    next(err);
  }
});

// POST /api/approvals — a clinic or vet applying; any authenticated user may submit.
approvalRouter.post("/", async (req, res, next) => {
  try {
    const { type, name, notes } = req.body ?? {};
    if (type !== "clinic" && type !== "veterinarian") {
      return res.status(400).json({ success: false, message: "type must be 'clinic' or 'veterinarian'" });
    }
    if (!name || typeof name !== "string") {
      return res.status(400).json({ success: false, message: "name is required" });
    }
    const doc = await ApprovalModel.create({
      type,
      name: name.trim(),
      notes,
      submittedAt: new Date().toISOString(),
      status: "pending",
      submittedBy: identity(req)?.uid,
    });
    res.status(201).json({ success: true, data: toApproval(doc) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/approvals/:id — record the decision.
approvalRouter.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body ?? {};
    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ success: false, message: "status must be 'approved' or 'rejected'" });
    }
    const who = identity(req);
    const doc = await ApprovalModel.findByIdAndUpdate(
      req.params.id,
      { status, decidedBy: who?.uid, decidedAt: new Date().toISOString() },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Approval not found" });
    res.json({ success: true, data: toApproval(doc) });
  } catch (err) {
    next(err);
  }
});

// ── Support tickets ──────────────────────────────────────
ticketRouter.get("/", requireAdmin, async (req, res, next) => {
  try {
    const query: Record<string, unknown> = {};
    if (typeof req.query.status === "string" && req.query.status) {
      query.status = req.query.status;
    }
    const docs = await TicketModel.find(query).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: docs.map(toTicket) });
  } catch (err) {
    next(err);
  }
});

// POST /api/tickets — raised by owners or vets, so no admin guard here.
ticketRouter.post("/", async (req, res, next) => {
  try {
    const { category, subject, priority, raisedBy, body } = req.body ?? {};
    const categories = ["booking", "clinic", "billing", "abuse"];
    if (!categories.includes(category)) {
      return res.status(400).json({ success: false, message: `category must be one of ${categories.join(", ")}` });
    }
    if (!subject || typeof subject !== "string") {
      return res.status(400).json({ success: false, message: "subject is required" });
    }
    const who = identity(req);
    const doc = await TicketModel.create({
      category,
      subject: subject.trim(),
      priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
      status: "open",
      raisedBy: raisedBy || who?.uid || "unknown",
      raisedByUid: who?.uid,
      body,
    });
    res.status(201).json({ success: true, data: toTicket(doc) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tickets/:id — advance open -> in-progress -> resolved.
ticketRouter.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body ?? {};
    if (!["open", "in-progress", "resolved"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be open, in-progress or resolved" });
    }
    const doc = await TicketModel.findByIdAndUpdate(
      req.params.id,
      { status, ...(status === "resolved" ? { resolvedAt: new Date().toISOString() } : {}) },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Ticket not found" });
    res.json({ success: true, data: toTicket(doc) });
  } catch (err) {
    next(err);
  }
});

// ── Announcements ────────────────────────────────────────
/**
 * GET /api/announcements
 *
 * Readable by any authenticated user; each caller receives only the
 * announcements addressed to them. Admins may pass ?all=true to see the full
 * history including withdrawn ones, for management.
 */
announcementRouter.get("/", async (req, res, next) => {
  try {
    const user = identity(req);
    const wantsAll = req.query.all === "true" && user?.role === "admin";
    const filter: Record<string, unknown> = {};

    if (!wantsAll) {
      filter.active = true;
      // "owner" is the system role for a pet owner.
      const audience = user?.role === "vet" ? "vet" : "owner";
      filter.audience = { $in: ["all", audience] };
    }

    const docs = await AnnouncementModel.find(filter).sort({ publishedAt: -1 }).limit(50);
    const now = new Date().toISOString();
    const rows = docs
      .map(toAnnouncement)
      .filter((a) => wantsAll || !a.expiresAt || a.expiresAt > now);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

announcementRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { title, body, audience, severity, expiresAt } = req.body ?? {};
    if (!body || typeof body !== "string" || !body.trim()) {
      return res.status(400).json({ success: false, message: "body is required" });
    }
    const doc = await AnnouncementModel.create({
      title: (title && String(title).trim()) || "Announcement",
      body: String(body).trim(),
      audience: ["all", "owner", "vet"].includes(audience) ? audience : "all",
      severity: severity === "warning" ? "warning" : "info",
      active: true,
      createdBy: identity(req)?.uid,
      publishedAt: new Date().toISOString(),
      expiresAt: expiresAt ? String(expiresAt) : undefined,
    });
    res.status(201).json({ success: true, data: toAnnouncement(doc) });
  } catch (err) {
    next(err);
  }
});

// Withdraw rather than delete, so the publication record survives.
announcementRouter.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const update: Record<string, unknown> = {};
    if (req.body?.active !== undefined) update.active = Boolean(req.body.active);
    if (req.body?.title !== undefined) update.title = String(req.body.title);
    if (req.body?.body !== undefined) update.body = String(req.body.body);
    const doc = await AnnouncementModel.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Announcement not found" });
    res.json({ success: true, data: toAnnouncement(doc) });
  } catch (err) {
    next(err);
  }
});

// ── Audit trail (append-only) ────────────────────────────
auditRouter.get("/", requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200));
    const docs = await AuditModel.find({}).sort({ at: -1 }).limit(limit);
    res.json({ success: true, data: docs.map(toAudit) });
  } catch (err) {
    next(err);
  }
});

auditRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { action, target } = req.body ?? {};
    if (!action || typeof action !== "string") {
      return res.status(400).json({ success: false, message: "action is required" });
    }
    const who = identity(req);
    const doc = await AuditModel.create({
      action: action.trim(),
      target: typeof target === "string" ? target.trim() : "",
      at: new Date().toISOString(),
      actorUid: who?.uid,
      actorRole: who?.role,
    });
    res.status(201).json({ success: true, data: toAudit(doc) });
  } catch (err) {
    next(err);
  }
});
