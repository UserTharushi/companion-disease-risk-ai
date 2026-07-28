import { getAccessToken } from "./session";

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:4000";

export type ApprovalItem = {
  id: string;
  type: "clinic" | "veterinarian";
  name: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  submittedBy?: string;
  decidedBy?: string;
  decidedAt?: string;
  notes?: string;
};

export type Ticket = {
  id: string;
  category: "booking" | "clinic" | "billing" | "abuse";
  subject: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in-progress" | "resolved";
  raisedBy: string;
  body?: string;
  resolvedAt?: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  target: string;
  at: string;
  actorUid?: string;
  actorRole?: string;
};

type ApiResponse<T> = { success: boolean; data: T; message?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });
  const body = await response.json();
  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || "Request failed");
  }
  return (body as ApiResponse<T>).data;
}

export async function listApprovals(status?: string): Promise<ApprovalItem[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<ApprovalItem[]>(`/api/approvals${suffix}`);
}

export async function submitApproval(input: {
  type: "clinic" | "veterinarian";
  name: string;
  notes?: string;
}): Promise<ApprovalItem> {
  return request<ApprovalItem>("/api/approvals", { method: "POST", body: JSON.stringify(input) });
}

export async function decideApproval(id: string, status: "approved" | "rejected"): Promise<ApprovalItem> {
  return request<ApprovalItem>(`/api/approvals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function listTickets(status?: string): Promise<Ticket[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<Ticket[]>(`/api/tickets${suffix}`);
}

export async function raiseTicket(input: {
  category: Ticket["category"];
  subject: string;
  priority?: Ticket["priority"];
  raisedBy?: string;
  body?: string;
}): Promise<Ticket> {
  return request<Ticket>("/api/tickets", { method: "POST", body: JSON.stringify(input) });
}

export async function updateTicketStatus(id: string, status: Ticket["status"]): Promise<Ticket> {
  return request<Ticket>(`/api/tickets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/**
 * Platform announcements. Readable by any authenticated user (each sees only
 * those addressed to their role); created and withdrawn by admins.
 */
export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: "all" | "owner" | "vet";
  severity: "info" | "warning";
  active: boolean;
  publishedAt: string;
  expiresAt?: string;
};

export async function listAnnouncements(includeInactive = false): Promise<Announcement[]> {
  return request<Announcement[]>(`/api/announcements${includeInactive ? "?all=true" : ""}`);
}

export async function createAnnouncement(input: {
  title?: string;
  body: string;
  audience?: Announcement["audience"];
  severity?: Announcement["severity"];
}): Promise<Announcement> {
  return request<Announcement>("/api/announcements", { method: "POST", body: JSON.stringify(input) });
}

/** Withdraw rather than delete, so the publication record survives. */
export async function setAnnouncementActive(id: string, active: boolean): Promise<Announcement> {
  return request<Announcement>(`/api/announcements/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function listAudit(limit = 50): Promise<AuditEntry[]> {
  return request<AuditEntry[]>(`/api/audit?limit=${limit}`);
}

/** Append-only: the service exposes no update or delete for audit entries. */
export async function recordAudit(action: string, target: string): Promise<AuditEntry> {
  return request<AuditEntry>("/api/audit", { method: "POST", body: JSON.stringify({ action, target }) });
}
