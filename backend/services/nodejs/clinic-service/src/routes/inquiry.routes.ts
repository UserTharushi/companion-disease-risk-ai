import { Router, type Request } from "express";
import {
  InquiryModel,
  SurgeonModel,
  MAX_THREAD_MESSAGES,
  deriveInquiryStatus,
  type InquiryDocument,
  type InquiryMessage,
} from "../models/clinic.models";
import { notifyCopy, recipientLanguage } from "../services/notify-i18n";

export const inquiryRouter = Router();

// Identity headers stamped by the api-gateway from a verified JWT
function identity(req: Request): { uid: string; role: string } | null {
  const uid = req.headers["x-user-id"];
  const role = req.headers["x-user-role"];
  if (typeof uid === "string" && uid) {
    return { uid, role: typeof role === "string" ? role : "owner" };
  }
  return null;
}

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4004";

/**
 * Surgeon listings belonging to a veterinarian's auth account.
 *
 * A vet may only see and answer inquiries addressed to their own listing.
 * Previously the list was unfiltered, so any vet could read — and reply to —
 * every owner's question, including those sent to another clinic entirely.
 */
async function surgeonIdsForVet(uid: string): Promise<string[]> {
  const surgeons = await SurgeonModel.find({ userId: uid }).select("_id").lean();
  return surgeons.map((surgeon) => String(surgeon._id));
}

/** Fire-and-forget: a notification failure must not fail the message itself. */
async function notify(params: {
  userId: string;
  type: "inquiry_replied" | "inquiry_message";
  title: string;
  body: string;
  dedupeKey: string;
}) {
  if (!params.userId) return;
  try {
    await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.warn("[clinic-service] inquiry notification failed", err);
  }
}

/** Resolve copy in the recipient's own language before sending. */
async function notifyLocalized(params: {
  userId: string;
  type: "inquiry_replied" | "inquiry_message";
  copyKey: string;
  petName?: string;
  dedupeKey: string;
}) {
  if (!params.userId) return;
  const language = await recipientLanguage(params.userId);
  const pet = (params.petName ?? "").trim();
  const { title, body } = notifyCopy(pet ? params.copyKey : `${params.copyKey}_generic`, language, pet);
  await notify({ userId: params.userId, type: params.type, title, body, dedupeKey: params.dedupeKey });
}

function mapInquiry(inquiry: any) {
  const messages: InquiryMessage[] = inquiry.messages ?? [];
  return {
    id: inquiry._id.toString(),
    ownerId: inquiry.ownerId,
    clinicId: inquiry.clinicId,
    clinicName: inquiry.clinicName,
    surgeonId: inquiry.surgeonId,
    surgeonName: inquiry.surgeonName,
    petId: inquiry.petId,
    petName: inquiry.petName,
    message: inquiry.message,
    messages: messages.map((m) => ({
      senderRole: m.senderRole,
      body: m.body,
      createdAt: m.createdAt,
    })),
    status: inquiry.status,
    remainingMessages: Math.max(0, MAX_THREAD_MESSAGES - messages.length),
    maxMessages: MAX_THREAD_MESSAGES,
    createdAt: inquiry.createdAt,
    updatedAt: inquiry.updatedAt,
  };
}

// List inquiries. Owners see their own; vets see only threads addressed to a
// surgeon listing linked to their account; admins see everything.
inquiryRouter.get("/", async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.ownerId) filter.ownerId = String(req.query.ownerId);

    const user = identity(req);
    if (user?.role === "owner") {
      filter.ownerId = user.uid;
    } else if (user?.role === "vet") {
      const mine = await surgeonIdsForVet(user.uid);
      // Fail closed: a vet with no linked listing sees nothing rather than all.
      if (!mine.length) return res.json({ success: true, data: [] });
      filter.surgeonId = { $in: mine };
    }

    const inquiries = await InquiryModel.find(filter).sort({ updatedAt: -1 }).lean();
    res.json({ success: true, data: inquiries.map(mapInquiry) });
  } catch (err) {
    next(err);
  }
});

// Owner opens a thread with a clinic/surgeon about a pet.
inquiryRouter.post("/", async (req, res, next) => {
  try {
    const message = String(req.body.message ?? "").trim();
    if (!message) return res.status(400).json({ success: false, message: "message is required" });

    const user = identity(req);
    const ownerId = user?.role === "owner" ? user.uid : String(req.body.ownerId ?? "");
    const inquiry = await InquiryModel.create({
      ownerId,
      clinicId: req.body.clinicId ?? "",
      clinicName: req.body.clinicName ?? "",
      surgeonId: req.body.surgeonId ?? "",
      surgeonName: req.body.surgeonName ?? "",
      petId: req.body.petId ?? "",
      petName: req.body.petName ?? "",
      message,
      messages: [{ senderRole: "owner", senderId: ownerId, body: message, createdAt: new Date() }],
      status: "awaiting_vet",
    });

    await notifyCounterparty(inquiry, "owner");
    res.status(201).json({ success: true, data: mapInquiry(inquiry.toObject()) });
  } catch (err) {
    next(err);
  }
});

/** Tell whoever did not just speak that there is something to read. */
async function notifyCounterparty(inquiry: InquiryDocument, senderRole: "owner" | "vet") {
  const index = inquiry.messages.length;
  if (senderRole === "owner") {
    const surgeon = await SurgeonModel.findById(inquiry.surgeonId).lean().catch(() => null);
    const vetUserId = (surgeon as { userId?: string } | null)?.userId;
    if (!vetUserId) return;
    await notifyLocalized({
      userId: vetUserId,
      type: "inquiry_message",
      copyKey: "inquiry_message",
      petName: inquiry.petName,
      dedupeKey: `inquiry_msg:${String(inquiry._id)}:${index}`,
    });
    return;
  }
  await notifyLocalized({
    userId: inquiry.ownerId,
    type: "inquiry_replied",
    copyKey: "inquiry_replied",
    petName: inquiry.petName,
    dedupeKey: `inquiry_msg:${String(inquiry._id)}:${index}`,
  });
}

/**
 * Append a turn to a thread.
 *
 * Shared by the owner follow-up and the vet reply so the cap, the authorisation
 * check and the status derivation cannot drift apart between the two.
 */
async function appendMessage(req: Request, inquiryId: string) {
  const body = String(req.body.body ?? req.body.reply ?? req.body.message ?? "").trim();
  if (!body) return { status: 400 as const, payload: { success: false, message: "A message is required" } };

  const inquiry = await InquiryModel.findById(inquiryId);
  if (!inquiry) return { status: 404 as const, payload: { success: false, message: "Inquiry not found" } };

  const user = identity(req);
  let senderRole: "owner" | "vet";

  if (user?.role === "owner") {
    if (inquiry.ownerId !== user.uid) {
      return { status: 403 as const, payload: { success: false, message: "This is not your inquiry" } };
    }
    senderRole = "owner";
  } else if (user?.role === "vet") {
    const mine = await surgeonIdsForVet(user.uid);
    if (!mine.includes(String(inquiry.surgeonId))) {
      return {
        status: 403 as const,
        payload: { success: false, message: "This inquiry was not sent to you" },
      };
    }
    senderRole = "vet";
  } else if (user?.role === "admin") {
    senderRole = "vet";
  } else {
    return { status: 403 as const, payload: { success: false, message: "Authentication required" } };
  }

  if (inquiry.messages.length >= MAX_THREAD_MESSAGES) {
    return {
      status: 409 as const,
      payload: {
        success: false,
        message: "This conversation has reached its limit. Please book an appointment to continue.",
      },
    };
  }

  inquiry.messages.push({ senderRole, senderId: user?.uid ?? "", body, createdAt: new Date() });
  inquiry.status = deriveInquiryStatus(inquiry.messages);
  await inquiry.save();

  await notifyCounterparty(inquiry, senderRole);
  return { status: 200 as const, payload: { success: true, data: mapInquiry(inquiry.toObject()) } };
}

// Either party adds a turn.
inquiryRouter.post("/:inquiryId/messages", async (req, res, next) => {
  try {
    const result = await appendMessage(req, req.params.inquiryId);
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
});

// Legacy vet-reply route, kept so a stale frontend bundle keeps working. Owners
// must use /messages — replying here would misattribute the turn to the vet.
inquiryRouter.patch("/:inquiryId/reply", async (req, res, next) => {
  try {
    const user = identity(req);
    if (user?.role === "owner") {
      return res.status(403).json({ success: false, message: "Only veterinary staff can reply to inquiries" });
    }
    const result = await appendMessage(req, req.params.inquiryId);
    res.status(result.status).json(result.payload);
  } catch (err) {
    next(err);
  }
});
