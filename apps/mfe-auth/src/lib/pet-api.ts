type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

import { getAccessToken } from "./session";
import { API_BASE_URL } from "./api-base";

type PetSpeciesApi = "dog" | "cat";

type BackendPet = {
  id: string;
  _id?: string;
  ownerId: string;
  name: string;
  species: PetSpeciesApi;
  breed: string;
  ageYears: number;
  weightKg: number;
  sex: "male" | "female";
  neutered: boolean;
  photoURL?: string;
  vaccinationName?: string;
  vaccinationDate?: string;
  vaccinationFrequency?: string;
  nextVaccinationDate?: string;
  createdAt?: string;
  updatedAt?: string;
};

type CreateBackendPetInput = Omit<BackendPet, "id" | "createdAt" | "updatedAt">;
type UpdateBackendPetInput = Partial<Omit<BackendPet, "id" | "createdAt" | "updatedAt">>;

const OWNER_ID_KEY = "companion_ai_owner_id";

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(base64 + padding);
}

function getOwnerIdFromToken(token: string | null): string | null {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { uid?: string; sub?: string };
    const uid = (payload.uid || payload.sub || "").trim();
    return uid || null;
  } catch {
    return null;
  }
}

export function getOwnerId(): string {
  const ownerIdFromToken = getOwnerIdFromToken(getAccessToken());
  if (ownerIdFromToken) {
    localStorage.setItem(OWNER_ID_KEY, ownerIdFromToken);
    return ownerIdFromToken;
  }

  const stored = localStorage.getItem(OWNER_ID_KEY);
  if (stored) return stored;

  const generated = `owner-local-${Date.now()}`;
  localStorage.setItem(OWNER_ID_KEY, generated);
  return generated;
}

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

export async function listOwnerPets(ownerId: string): Promise<BackendPet[]> {
  const response = await request<ApiResponse<BackendPet[]>>(`/api/pets?ownerId=${encodeURIComponent(ownerId)}`);
  return response.data;
}

// Vet/admin: all pets (owners are scoped to their own server-side)
export async function listAllPets(): Promise<BackendPet[]> {
  const response = await request<ApiResponse<BackendPet[]>>(`/api/pets?pageSize=200`);
  return response.data;
}

export async function createOwnerPet(payload: CreateBackendPetInput): Promise<BackendPet> {
  const response = await request<ApiResponse<BackendPet>>(`/api/pets`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteOwnerPet(petId: string): Promise<void> {
  await request<ApiResponse<{ message?: string }>>(`/api/pets/${petId}`, {
    method: "DELETE",
  });
}

export async function updateOwnerPet(petId: string, payload: UpdateBackendPetInput): Promise<BackendPet> {
  const response = await request<ApiResponse<BackendPet>>(`/api/pets/${petId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export type { BackendPet, PetSpeciesApi, CreateBackendPetInput, UpdateBackendPetInput };
