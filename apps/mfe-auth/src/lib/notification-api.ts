import { getAccessToken } from "./session";
import { getOwnerId } from "./pet-api";

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:4000";

export type AppNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  petId?: string;
  urgency?: string;
  createdAt: string;
};

type ListResponse = {
  success: boolean;
  data: AppNotification[];
  meta?: { unreadCount: number };
};

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function listNotifications(unreadOnly = false, limit = 50): Promise<{ items: AppNotification[]; unreadCount: number }> {
  const params = new URLSearchParams({ userId: getOwnerId(), limit: String(limit) });
  if (unreadOnly) params.set("unreadOnly", "true");
  const response = await fetch(`${API_BASE_URL}/api/notifications?${params}`, { headers: authHeaders() });
  if (!response.ok) throw new Error(`Notifications request failed (${response.status})`);
  const body = (await response.json()) as ListResponse;
  return { items: body.data ?? [], unreadCount: body.meta?.unreadCount ?? 0 };
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    headers: authHeaders(),
  });
}

/**
 * Legacy `/send` alias, used to deliver admin-provisioned vet credentials.
 * Must carry the bearer token: the admin page called this with a bare fetch()
 * and only a Content-Type header, so with AUTH_ENFORCE=true the gateway
 * answered 401 and the new vet never received their sign-in details.
 */
export async function sendNotification(payload: {
  type: string;
  recipientEmail: string;
  subject: string;
  message: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/notifications/send`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Notification send failed (${response.status})`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ userId: getOwnerId() }),
  });
}
