import type { ApiResponse, Pet } from "@companion-ai/shared-types";

const PET_SERVICE_URL = import.meta.env.VITE_PET_SERVICE_URL || "http://localhost:4002";
const OWNER_ID_KEY = "companion_ai_owner_id";

export function getOwnerId(): string {
  const stored = localStorage.getItem(OWNER_ID_KEY);
  if (stored) return stored;
  const generated = "owner-demo-001";
  localStorage.setItem(OWNER_ID_KEY, generated);
  return generated;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PET_SERVICE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body as T;
}

export async function listPets(ownerId: string): Promise<Pet[]> {
  const response = await request<ApiResponse<Pet[]>>(`/api/pets?ownerId=${encodeURIComponent(ownerId)}`);
  return response.data;
}

export async function getPet(petId: string): Promise<Pet> {
  const response = await request<ApiResponse<Pet>>(`/api/pets/${petId}`);
  return response.data;
}

export async function createPet(payload: Omit<Pet, "id" | "createdAt" | "updatedAt">): Promise<Pet> {
  const response = await request<ApiResponse<Pet>>(`/api/pets`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updatePet(petId: string, payload: Partial<Omit<Pet, "id" | "createdAt" | "updatedAt">>): Promise<Pet> {
  const response = await request<ApiResponse<Pet>>(`/api/pets/${petId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deletePet(petId: string): Promise<void> {
  await request(`/api/pets/${petId}`, { method: "DELETE" });
}
