import { getAccessToken } from "./session";
import { API_BASE_URL } from "./api-base";


/**
 * Relationship-based access control.
 *
 * A veterinarian can read a pet's health information only while an active grant
 * links them to that pet — created automatically by booking an appointment with
 * them, or explicitly by the owner. Enforcement lives in pet-service and
 * ai-service; these calls are the owner's controls over it.
 */
export type AccessGrant = {
  id: string;
  petId: string;
  ownerId: string;
  vetUserId: string;
  source: "appointment" | "owner_consent";
  appointmentId?: string;
  grantedAt: string;
  revokedAt?: string;
  active: boolean;
};

export type VetDirectoryEntry = {
  id: string;
  name: string;
  specialization: string;
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

/** Grants visible to the caller: a vet sees their own, an owner sees their pets'. */
export async function listAccessGrants(petId?: string): Promise<AccessGrant[]> {
  const suffix = petId ? `?petId=${encodeURIComponent(petId)}` : "";
  return request<AccessGrant[]>(`/api/access-grants${suffix}`);
}

export async function shareWithVet(petId: string, vetUserId: string): Promise<AccessGrant> {
  return request<AccessGrant>("/api/access-grants", {
    method: "POST",
    body: JSON.stringify({ petId, vetUserId }),
  });
}

/** Soft revoke — the grant is retained with revokedAt so access history stays auditable. */
export async function revokeAccessGrant(grantId: string): Promise<AccessGrant> {
  return request<AccessGrant>(`/api/access-grants/${encodeURIComponent(grantId)}`, { method: "DELETE" });
}

/** Name + specialization only; the full roster stays admin-only. */
export async function listVetDirectory(): Promise<VetDirectoryEntry[]> {
  return request<VetDirectoryEntry[]>("/api/auth/vets/directory");
}
