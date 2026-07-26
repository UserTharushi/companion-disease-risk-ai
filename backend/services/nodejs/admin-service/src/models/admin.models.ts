import { Schema, model, Document } from "mongoose";

// Platform-administration domain: registration approvals, support tickets and
// an append-only audit trail. These three lived in the admin's localStorage,
// so they never survived a different browser and could not be reviewed by a
// second administrator.

export interface ApprovalDocument extends Document {
  type: "clinic" | "veterinarian";
  name: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  submittedBy?: string;
  decidedBy?: string;
  decidedAt?: string;
  notes?: string;
}

const ApprovalSchema = new Schema<ApprovalDocument>(
  {
    type:        { type: String, required: true, enum: ["clinic", "veterinarian"] },
    name:        { type: String, required: true },
    submittedAt: { type: String, required: true },
    status:      { type: String, required: true, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    submittedBy: { type: String },
    decidedBy:   { type: String },
    decidedAt:   { type: String },
    notes:       { type: String },
  },
  { timestamps: true }
);

export const ApprovalModel = model<ApprovalDocument>("Approval", ApprovalSchema);

export function toApproval(doc: ApprovalDocument) {
  return {
    id: String(doc._id),
    type: doc.type,
    name: doc.name,
    submittedAt: doc.submittedAt,
    status: doc.status,
    submittedBy: doc.submittedBy,
    decidedBy: doc.decidedBy,
    decidedAt: doc.decidedAt,
    notes: doc.notes,
  };
}

export interface TicketDocument extends Document {
  category: "booking" | "clinic" | "billing" | "abuse";
  subject: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in-progress" | "resolved";
  raisedBy: string;
  raisedByUid?: string;
  body?: string;
  resolvedAt?: string;
}

const TicketSchema = new Schema<TicketDocument>(
  {
    category:    { type: String, required: true, enum: ["booking", "clinic", "billing", "abuse"] },
    subject:     { type: String, required: true },
    priority:    { type: String, required: true, enum: ["low", "medium", "high"], default: "medium" },
    status:      { type: String, required: true, enum: ["open", "in-progress", "resolved"], default: "open", index: true },
    raisedBy:    { type: String, required: true },
    raisedByUid: { type: String, index: true },
    body:        { type: String },
    resolvedAt:  { type: String },
  },
  { timestamps: true }
);

export const TicketModel = model<TicketDocument>("SupportTicket", TicketSchema);

export function toTicket(doc: TicketDocument) {
  return {
    id: String(doc._id),
    category: doc.category,
    subject: doc.subject,
    priority: doc.priority,
    status: doc.status,
    raisedBy: doc.raisedBy,
    body: doc.body,
    resolvedAt: doc.resolvedAt,
  };
}

export interface AuditDocument extends Document {
  action: string;
  target: string;
  at: string;
  actorUid?: string;
  actorRole?: string;
}

// Append-only by design: the routes expose no update or delete. An audit trail
// an administrator can edit is not an audit trail.
const AuditSchema = new Schema<AuditDocument>(
  {
    action:    { type: String, required: true },
    target:    { type: String, required: true },
    at:        { type: String, required: true, index: true },
    actorUid:  { type: String },
    actorRole: { type: String },
  },
  { timestamps: true }
);

export const AuditModel = model<AuditDocument>("AuditEntry", AuditSchema);

export function toAudit(doc: AuditDocument) {
  return {
    id: String(doc._id),
    action: doc.action,
    target: doc.target,
    at: doc.at,
    actorUid: doc.actorUid,
    actorRole: doc.actorRole,
  };
}
