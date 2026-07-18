import type { ApiResponse, AgentRecommendation, SymptomInput } from "@companion-ai/shared-types";

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || "http://localhost:8002";
const OWNER_ID_KEY = "companion_ai_owner_id";

export function getOwnerId(): string {
  const stored = localStorage.getItem(OWNER_ID_KEY);
  if (stored) return stored;
  const generated = "owner-demo-001";
  localStorage.setItem(OWNER_ID_KEY, generated);
  return generated;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AGENT_SERVICE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body as T;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SymptomCheckerSession {
  sessionId: string;
  petId: string;
  messages: ChatMessage[];
  collectedSymptoms?: SymptomInput;
  isActive: boolean;
  createdAt: string;
}

export async function startSymptomCheckerSession(petId: string): Promise<SymptomCheckerSession> {
  const response = await request<ApiResponse<SymptomCheckerSession>>(`/api/sessions/start`, {
    method: "POST",
    body: JSON.stringify({ petId }),
  });
  return response.data;
}

export async function sendChatMessage(sessionId: string, message: string): Promise<{ reply: string; collectedData?: SymptomInput }> {
  const response = await request<ApiResponse<{ reply: string; collectedData?: SymptomInput }>>(`/api/sessions/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  return response.data;
}

export async function getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
  const response = await request<ApiResponse<ChatMessage[]>>(`/api/sessions/${sessionId}/history`);
  return response.data;
}

export async function endSymptomCheckerSession(sessionId: string): Promise<{ sessionId: string; finalRecommendations: AgentRecommendation[] }> {
  const response = await request<ApiResponse<{ sessionId: string; finalRecommendations: AgentRecommendation[] }>>(`/api/sessions/${sessionId}/end`, {
    method: "POST",
  });
  return response.data;
}
