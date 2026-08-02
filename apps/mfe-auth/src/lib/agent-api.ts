import { getAccessToken } from "./session";
import { getAppLanguage } from "./language";
import { buildPredictionPayload, type DiseaseRisk, type PredictionInput, type PredictionResult } from "./prediction-api";
import { API_BASE_URL } from "./api-base";


export type AgentRecommendation = {
  type: "vet_visit" | "vaccination" | "home_monitoring" | "emergency" | string;
  title?: string;
  message: string;
  urgency_hours?: number | null;
};

export type ClinicSuggestion = {
  id: string;
  name: string;
  address: string;
  distance_km?: number | null;
  surgeon?: string | null;
  next_slot?: string | null;
  recommended?: boolean;
  match_reason?: string | null;
  external?: boolean;
};

export type AgentSummary = {
  agent: string;
  status: string;
  summary: string;
};

export type AgentResponse = {
  recommendations: AgentRecommendation[];
  urgency_hours: number | null;
  explanation: string;
  agent_trace: string[];
  degraded: boolean;
  clinic_suggestions: ClinicSuggestion[];
  agents?: AgentSummary[];
  required_specialization?: string | null;
  prediction?: PredictionResult | null;
  image_findings?: string | null;
};

export type RecommendationInput = {
  petId: string;
  riskLevel: string;
  confidenceScore: number;
  predictedDiseases: DiseaseRisk[];
  symptoms: string[];
  notes?: string;
  predictionId?: string;
  ownerLocation?: { lat: number; lng: number } | null;
};

// Full three-agent pipeline: Disease Risk Prediction Agent (calls the ML
// service) -> Explainable Care Recommendation Agent -> Vet Discovery & Booking
// Agent. One call replaces submitPrediction + getRecommendations.
export async function analyzeCase(
  input: PredictionInput,
  ownerLocation: { lat: number; lng: number } | null,
  imageDataUrl?: string,
): Promise<AgentResponse> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/agent/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...buildPredictionPayload(input),
      owner_location: ownerLocation,
      image_data_url: imageDataUrl || null,
    }),
  });

  if (!response.ok) {
    throw new Error(`Analyze request failed (${response.status})`);
  }

  return (await response.json()) as AgentResponse;
}

export type ChatTurn = { role: "owner" | "assistant"; text: string };

// Real Gemini-backed pet-health assistant (agent-service /chat), with the same
// graceful degradation as the rest of the agentic layer.
export async function sendChatMessage(message: string, history: ChatTurn[] = []): Promise<{ reply: string; degraded: boolean }> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      language: getAppLanguage(),
      history: history.slice(-6),
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed (${response.status})`);
  }

  return (await response.json()) as { reply: string; degraded: boolean };
}

export async function getRecommendations(input: RecommendationInput): Promise<AgentResponse> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/agent/recommend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      pet_id: input.petId,
      risk_level: input.riskLevel,
      confidence_score: input.confidenceScore,
      predicted_diseases: input.predictedDiseases,
      symptoms: input.symptoms,
      notes: input.notes ?? "",
      prediction_id: input.predictionId ?? null,
      owner_location: input.ownerLocation ?? null,
      language: getAppLanguage(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Agent request failed (${response.status})`);
  }

  return (await response.json()) as AgentResponse;
}
