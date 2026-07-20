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

    const reply = String(req.body.reply ?? "").trim();
    if (reply) inquiry.reply = reply;
    inquiry.status = "replied";
    await inquiry.save();
    res.json({ success: true, data: mapInquiry(inquiry.toObject()) });
  } catch (err) {
    next(err);
  }
});
