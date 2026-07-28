import { Router, type Request } from "express";
import { InquiryModel } from "../models/clinic.models";

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

/** Fire-and-forget: a notification failure must not fail the reply itself. */
async function notifyOwnerOfReply(params: { ownerId: string; inquiryId: string; petName?: string }) {
  if (!params.ownerId) return;
  try {
    await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: params.ownerId,
        type: "inquiry_replied",
        title: "A veterinarian replied to your question",
        body: params.petName
          ? `Your question about ${params.petName} has been answered. Open Inquiries to read the reply.`
          : "Your question has been answered. Open Inquiries to read the reply.",
        dedupeKey: `inquiry_replied:${params.inquiryId}`,
      }),
    });
  } catch (err) {
    console.warn("[clinic-service] inquiry reply notification failed", err);
  }
}

function mapInquiry(inquiry: any) {
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
    reply: inquiry.reply ?? null,
    status: inquiry.status,
    createdAt: inquiry.createdAt,
    updatedAt: inquiry.updatedAt,
  };
}

// List inquiries. Owners see only their own; vets/admins see all (optionally
// filtered by ?status= or ?ownerId=).
inquiryRouter.get("/", async (req, res, next) => {
  try {
    const filter: Record<string, string> = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.ownerId) filter.ownerId = String(req.query.ownerId);

    const user = identity(req);
    if (user?.role === "owner") filter.ownerId = user.uid;

    const inquiries = await InquiryModel.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: inquiries.map(mapInquiry) });
  } catch (err) {
    next(err);
  }
});

// Owner sends an inquiry to a clinic/surgeon about a pet.
inquiryRouter.post("/", async (req, res, next) => {
  try {
    const message = String(req.body.message ?? "").trim();
    if (!message) return res.status(400).json({ success: false, message: "message is required" });

    const user = identity(req);
    const inquiry = await InquiryModel.create({
      ownerId: user?.role === "owner" ? user.uid : req.body.ownerId,
      clinicId: req.body.clinicId ?? "",
      clinicName: req.body.clinicName ?? "",
      surgeonId: req.body.surgeonId ?? "",
      surgeonName: req.body.surgeonName ?? "",
      petId: req.body.petId ?? "",
      petName: req.body.petName ?? "",
      message,
      status: "open",
    });
    res.status(201).json({ success: true, data: mapInquiry(inquiry) });
  } catch (err) {
    next(err);
  }
});

// Vet/admin replies to an inquiry (marks it replied). Owners cannot reply.
inquiryRouter.patch("/:inquiryId/reply", async (req, res, next) => {
  try {
    const user = identity(req);
    if (user && user.role === "owner") {
      return res.status(403).json({ success: false, message: "Only veterinary staff can reply to inquiries" });
    }
    const inquiry = await InquiryModel.findById(req.params.inquiryId);
    if (!inquiry) return res.status(404).json({ success: false, message: "Inquiry not found" });

    // Previously the status flipped to "replied" even with an empty body, so an
    // inquiry could be closed while the owner received nothing at all.
    const reply = String(req.body.reply ?? "").trim();
    if (!reply) {
      return res.status(400).json({ success: false, message: "A reply message is required" });
    }
    inquiry.reply = reply;
    inquiry.status = "replied";
    await inquiry.save();

    // Tell the owner their question was answered - otherwise they only find out
    // by chance, which for a health question is the wrong way round.
    await notifyOwnerOfReply({
      ownerId: inquiry.ownerId,
      inquiryId: String(inquiry._id),
      petName: inquiry.petName,
    });

    res.json({ success: true, data: mapInquiry(inquiry.toObject()) });
  } catch (err) {
    next(err);
  }
});
