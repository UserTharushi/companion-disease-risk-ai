import type { Appointment, VetClinic } from "@companion-ai/shared-types";
import { getAccessToken } from "./session";

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:4000";

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

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Request failed");
  }

  return data.data as T;
}

export async function listClinics(query = ""): Promise<VetClinic[]> {
  const suffix = query ? `?query=${encodeURIComponent(query)}` : "";
  return request<VetClinic[]>(`/api/clinics${suffix}`);
}

export type NearbyClinic = VetClinic & { distanceKm?: number; external?: boolean };

export async function listNearbyClinics(lat: number, lng: number, maxKm = 100): Promise<NearbyClinic[]> {
  return request<NearbyClinic[]>(`/api/clinics/nearby?lat=${lat}&lng=${lng}&maxKm=${maxKm}`);
}

export async function getClinic(clinicId: string): Promise<VetClinic> {
  return request<VetClinic>(`/api/clinics/${clinicId}`);
}

export async function listAppointments(ownerId: string): Promise<Appointment[]> {
  return request<Appointment[]>(`/api/appointments?ownerId=${encodeURIComponent(ownerId)}`);
}

// Admin: all appointments (identity headers scope owners server-side)
export async function listAllAppointments(): Promise<Appointment[]> {
  return request<Appointment[]>(`/api/appointments`);
}

// ── Admin clinic management (vet/admin role required by the service) ──

export type ClinicWritePayload = {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  specializations?: string[];
  isOpen?: boolean;
};

export async function createClinic(payload: ClinicWritePayload): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/clinics`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateClinic(clinicId: string, payload: Partial<ClinicWritePayload>): Promise<unknown> {
  return request<unknown>(`/api/clinics/${clinicId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteClinic(clinicId: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/clinics/${clinicId}`, {
    method: "DELETE",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || "Delete failed");
}

export async function addSurgeon(clinicId: string, payload: { name: string; specialization?: string }): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/clinics/${clinicId}/surgeons`, { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteSurgeon(surgeonId: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/clinics/surgeons/${surgeonId}`, {
    method: "DELETE",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || "Delete failed");
}

export async function addTimeSlot(surgeonId: string, datetime: string, durationMins = 30): Promise<unknown> {
  return request<unknown>(`/api/clinics/surgeons/${surgeonId}/slots`, {
    method: "POST",
    body: JSON.stringify({ datetime, durationMins }),
  });
}

export async function createAppointment(payload: Omit<Appointment, "id" | "createdAt">): Promise<Appointment> {
  return request<Appointment>("/api/appointments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAppointment(appointmentId: string, payload: Partial<Omit<Appointment, "id" | "createdAt">>): Promise<Appointment> {
  return request<Appointment>(`/api/appointments/${appointmentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}