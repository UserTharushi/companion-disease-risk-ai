import type { ApiResponse, VetClinic, Surgeon } from "@companion-ai/shared-types";

const CLINIC_SERVICE_URL = import.meta.env.VITE_CLINIC_SERVICE_URL || "http://localhost:4003";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CLINIC_SERVICE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body as T;
}

// ── Clinic Management ──────────────────────
export async function listAllClinics(): Promise<VetClinic[]> {
  const response = await request<ApiResponse<VetClinic[]>>(`/api/clinics`);
  return response.data;
}

export async function getClinic(clinicId: string): Promise<VetClinic> {
  const response = await request<ApiResponse<VetClinic>>(`/api/clinics/${clinicId}`);
  return response.data;
}

export async function createClinic(payload: Omit<VetClinic, "id" | "surgeons">): Promise<VetClinic> {
  const response = await request<ApiResponse<VetClinic>>(`/api/clinics`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateClinic(clinicId: string, payload: Partial<Omit<VetClinic, "id" | "surgeons">>): Promise<VetClinic> {
  const response = await request<ApiResponse<VetClinic>>(`/api/clinics/${clinicId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteClinic(clinicId: string): Promise<void> {
  await request(`/api/clinics/${clinicId}`, { method: "DELETE" });
}

// ── Surgeon Management ─────────────────────
export async function listSurgeons(clinicId: string): Promise<Surgeon[]> {
  const response = await request<ApiResponse<Surgeon[]>>(`/api/clinics/${clinicId}/surgeons`);
  return response.data;
}

export async function createSurgeon(clinicId: string, payload: Omit<Surgeon, "id" | "clinicId" | "availableSlots">): Promise<Surgeon> {
  const response = await request<ApiResponse<Surgeon>>(`/api/clinics/${clinicId}/surgeons`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateSurgeon(clinicId: string, surgeonId: string, payload: Partial<Omit<Surgeon, "id" | "clinicId">>): Promise<Surgeon> {
  const response = await request<ApiResponse<Surgeon>>(`/api/clinics/${clinicId}/surgeons/${surgeonId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteSurgeon(clinicId: string, surgeonId: string): Promise<void> {
  await request(`/api/clinics/${clinicId}/surgeons/${surgeonId}`, { method: "DELETE" });
}

// ── Analytics (optional) ───────────────────
export async function getSystemStats(): Promise<{
  totalClinics: number;
  totalSurgeons: number;
  totalAppointments: number;
  totalPets: number;
}> {
  const response = await request<ApiResponse<any>>(`/api/admin/stats`);
  return response.data;
}
