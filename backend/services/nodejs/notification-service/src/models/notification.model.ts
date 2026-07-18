import { Schema, model, Document } from "mongoose";
import type { Notification } from "@companion-ai/shared-types";

export interface NotificationDocument extends Omit<Notification, "id" | "createdAt">, Document {
  petId?: string;
  urgency?: string;
  dedupeKey?: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    userId:    { type: String, required: true, index: true },
    type:      { type: String, required: true },
    title:     { type: String, required: true },
    body:      { type: String, required: true },
    data:      { type: Map, of: String },
    read:      { type: Boolean, default: false },
    petId:     { type: String, index: true },
    urgency:   { type: String },
    dedupeKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

export const NotificationModel = model<NotificationDocument>("Notification", NotificationSchema);

export function toNotification(doc: NotificationDocument) {
  return {
    id: String(doc._id),
    userId: doc.userId,
    type: doc.type,
    title: doc.title,
    body: doc.body,
    data: doc.data ? Object.fromEntries(doc.data as unknown as Map<string, string>) : undefined,
    read: doc.read,
    petId: doc.petId,
    urgency: doc.urgency,
    createdAt: doc.createdAt?.toISOString?.() ?? String(doc.createdAt),
  };
}
