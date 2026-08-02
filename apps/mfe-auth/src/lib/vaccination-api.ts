import { getAccessToken } from "./session";
import { getOwnerId } from "./pet-api";
import { API_BASE_URL } from "./api-base";


export type VaccinationRecord = {
  id: string;
  petId: string;
  ownerId?: string;
  vaccineName: string;
  administeredAt: string;
  nextDueAt: string;
  administeredBy?: string;
  batchNumber?: string;
  notes?: string;
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
  return body as T;
}

export async function listVaccinations(petId: string): Promise<VaccinationRecord[]> {
  const response = await request<ApiResponse<VaccinationRecord[]>>(`/api/vaccinations?petId=${encodeURIComponent(petId)}`);
  return response.data;
}

export async function listUpcomingVaccinations(petId: string): Promise<VaccinationRecord[]> {
  const response = await request<ApiResponse<VaccinationRecord[]>>(`/api/vaccinations/upcoming/${encodeURIComponent(petId)}`);
  return response.data;
}

export async function createVaccination(input: Omit<VaccinationRecord, "id" | "ownerId">): Promise<VaccinationRecord> {
  const response = await request<ApiResponse<VaccinationRecord>>(`/api/vaccinations`, {
    method: "POST",
    body: JSON.stringify({ ...input, ownerId: getOwnerId() }),
  });
  return response.data;
}

export async function updateVaccination(id: string, input: Partial<Omit<VaccinationRecord, "id">>): Promise<VaccinationRecord> {
  const response = await request<ApiResponse<VaccinationRecord>>(`/api/vaccinations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function deleteVaccination(id: string): Promise<void> {
  await request<ApiResponse<{ message?: string }>>(`/api/vaccinations/${encodeURIComponent(id)}`, { method: "DELETE" });
}
