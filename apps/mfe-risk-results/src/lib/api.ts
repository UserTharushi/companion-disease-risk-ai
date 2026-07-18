import type { ApiResponse, RiskPrediction, SymptomInput } from "@companion-ai/shared-types";

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8001";
const OWNER_ID_KEY = "companion_ai_owner_id";

export function getOwnerId(): string {
  const stored = localStorage.getItem(OWNER_ID_KEY);
  if (stored) return stored;
  const generated = "owner-demo-001";
  localStorage.setItem(OWNER_ID_KEY, generated);
  return generated;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AI_SERVICE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body as T;
}

export async function getPrediction(petId: string, symptomInputId: string): Promise<RiskPrediction> {
  const response = await request<ApiResponse<RiskPrediction>>(`/api/predictions/${petId}/${symptomInputId}`);
  return response.data;
}

export async function listPredictionHistory(petId: string): Promise<RiskPrediction[]> {
  const response = await request<ApiResponse<RiskPrediction[]>>(`/api/predictions/history/${petId}`);
  return response.data;
}

export async function generatePrediction(symptomInput: SymptomInput): Promise<RiskPrediction> {
  const response = await request<ApiResponse<RiskPrediction>>(`/api/predictions`, {
    method: "POST",
    body: JSON.stringify(symptomInput),
  });
  return response.data;
}

export async function getHealthScore(petId: string): Promise<{ petId: string; healthScore: number; riskFactors: string[] }> {
  const response = await request<ApiResponse<{ petId: string; healthScore: number; riskFactors: string[] }>>(`/api/health-score/${petId}`);
  return response.data;
}
