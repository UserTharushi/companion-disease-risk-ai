import type { ApiResponse, Appointment, Pet, VetClinic } from "@companion-ai/shared-types";

const CLINIC_SERVICE_URL = import.meta.env.VITE_CLINIC_SERVICE_URL || "http://localhost:4003";
const PET_SERVICE_URL = import.meta.env.VITE_PET_SERVICE_URL || "http://localhost:4002";
const OWNER_ID_KEY = "companion_ai_owner_id";

export function getOwnerId(): string {
  const stored = localStorage.getItem(OWNER_ID_KEY);
  if (stored) return stored;
  const generated = "owner-demo-001";
  localStorage.setItem(OWNER_ID_KEY, generated);
  return generated;
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body as T;
}

export async function listClinics(query = ""): Promise<VetClinic[]> {
  const suffix = query ? `?query=${encodeURIComponent(query)}` : "";
  const response = await request<ApiResponse<VetClinic[]>>(CLINIC_SERVICE_URL, `/api/clinics${suffix}`);
  return response.data;
}

export async function getClinic(clinicId: string): Promise<VetClinic> {
  const response = await request<ApiResponse<VetClinic>>(CLINIC_SERVICE_URL, `/api/clinics/${clinicId}`);
  return response.data;
}

export async function getSurgeon(surgeonId: string) {
  const response = await request<ApiResponse<any>>(CLINIC_SERVICE_URL, `/api/clinics/surgeons/${surgeonId}`);
  return response.data;
}

export async function listAppointments(ownerId: string): Promise<Appointment[]> {
  const response = await request<ApiResponse<Appointment[]>>(CLINIC_SERVICE_URL, `/api/appointments?ownerId=${encodeURIComponent(ownerId)}`);
  return response.data;
}

export async function createAppointment(payload: Omit<Appointment, "id" | "createdAt">): Promise<Appointment> {
  const response = await request<ApiResponse<Appointment>>(CLINIC_SERVICE_URL, `/api/appointments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function listOwnerPets(ownerId: string): Promise<Pet[]> {
  const response = await request<ApiResponse<Pet[]>>(PET_SERVICE_URL, `/api/pets?ownerId=${encodeURIComponent(ownerId)}`);
  return response.data;
}
