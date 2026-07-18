import type { ApiResponse, VaccinationRecord } from "@companion-ai/shared-types";

const VACCINATION_SERVICE_URL = import.meta.env.VITE_VACCINATION_SERVICE_URL || "http://localhost:4005";
const OWNER_ID_KEY = "companion_ai_owner_id";

export function getOwnerId(): string {
  const stored = localStorage.getItem(OWNER_ID_KEY);
  if (stored) return stored;
  const generated = "owner-demo-001";
  localStorage.setItem(OWNER_ID_KEY, generated);
  return generated;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${VACCINATION_SERVICE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body as T;
}

export async function listVaccinations(petId: string): Promise<VaccinationRecord[]> {
  const response = await request<ApiResponse<VaccinationRecord[]>>(`/api/vaccinations?petId=${encodeURIComponent(petId)}`);
  return response.data;
}

export async function getVaccination(vaccinationId: string): Promise<VaccinationRecord> {
  const response = await request<ApiResponse<VaccinationRecord>>(`/api/vaccinations/${vaccinationId}`);
  return response.data;
}

export async function createVaccination(payload: Omit<VaccinationRecord, "id">): Promise<VaccinationRecord> {
  const response = await request<ApiResponse<VaccinationRecord>>(`/api/vaccinations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateVaccination(vaccinationId: string, payload: Partial<Omit<VaccinationRecord, "id">>): Promise<VaccinationRecord> {
  const response = await request<ApiResponse<VaccinationRecord>>(`/api/vaccinations/${vaccinationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteVaccination(vaccinationId: string): Promise<void> {
  await request(`/api/vaccinations/${vaccinationId}`, { method: "DELETE" });
}

export async function getUpcomingVaccinations(petId: string): Promise<VaccinationRecord[]> {
  const response = await request<ApiResponse<VaccinationRecord[]>>(`/api/vaccinations/upcoming/${petId}`);
  return response.data;
}
