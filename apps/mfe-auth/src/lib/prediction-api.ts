import { getAccessToken } from "./session";
import { getAppLanguage } from "./language";
import { getOwnerId } from "./pet-api";

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:4000";

export type PredictionVitals = {
  activityLevel: string;
  appetiteLevel: string;
  urinationLevel: string;
  diarrheaLevel: string;
  vomitingLevel: string;
};

export type PredictionInput = {
  petId: string;
  species?: string;
  ageYears?: number;
  vitals: PredictionVitals;
  symptoms: string[];
  notes: string;
  symptomDurationDays: number;
};

export type DiseaseRisk = { disease: string; probability: number; disease_localized?: string | null };
export type OntologyLink = { symptom: string; disease: string; weight: number; symptom_localized?: string | null; disease_localized?: string | null };

export type PredictionResult = {
  id?: string | null;
  risk_level: "low" | "medium" | "high";
  confidence_score: number;
  risk_score: number;
  predicted_diseases: DiseaseRisk[];
  ontology_links: OntologyLink[];
  top_features: Array<{ feature: string; weight: number }>;
  model_version: string;
  disclaimer: string;
};

export type PredictionHistoryItem = {
  id: string;
  pet_id: string;
  owner_id?: string | null;
  risk_level: "low" | "medium" | "high";
  risk_score: number;
  confidence_score: number;
  predicted_diseases: DiseaseRisk[];
  model_version: string;
  created_at: string;
};

// UI severity scale (none/normal/mild/moderate/severe) -> backend enums
function mapAppetite(value: string): string {
  if (value === "mild" || value === "moderate") return "reduced";
  if (value === "severe") return "none";
  return "normal";
}

function mapActivity(value: string): string {
  if (value === "severe") return "lethargic";
  return value; // normal | mild | moderate handled by the backend severity index
}

function mapUrination(value: string): string {
  if (value === "mild" || value === "moderate" || value === "severe") return "increased";
  return "normal";
}

function mapVomiting(value: string): string {
  if (value === "mild") return "once";
  if (value === "moderate") return "multiple";
  if (value === "severe") return "persistent";
  return "none";
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function buildPredictionPayload(input: PredictionInput) {
  return {
    pet_id: input.petId,
    owner_id: getOwnerId(),
    species: input.species || "dog",
    age_years: input.ageYears ?? null,
    appetite_level: mapAppetite(input.vitals.appetiteLevel),
    water_intake: "normal",
    activity_level: mapActivity(input.vitals.activityLevel),
    urine_frequency: mapUrination(input.vitals.urinationLevel),
    vomiting_frequency: mapVomiting(input.vitals.vomitingLevel),
    diarrhea_level: input.vitals.diarrheaLevel || "none",
    symptoms: input.symptoms,
    notes: input.notes,
    symptom_duration_days: input.symptomDurationDays,
    language: getAppLanguage(),
  };
}

export async function submitPrediction(input: PredictionInput): Promise<PredictionResult> {
  const payload = buildPredictionPayload(input);

  const response = await fetch(`${API_BASE_URL}/api/predict`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Prediction request failed (${response.status})`);
  }

  return (await response.json()) as PredictionResult;
}

export async function getPredictionHistory(petId?: string, limit = 20): Promise<PredictionHistoryItem[]> {
  const params = new URLSearchParams();
  if (petId) params.set("petId", petId);
  else params.set("ownerId", getOwnerId());
  params.set("limit", String(limit));
  params.set("language", getAppLanguage());

  const response = await fetch(`${API_BASE_URL}/api/predictions/history?${params}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(`History request failed (${response.status})`);
  }

  const body = (await response.json()) as { success: boolean; data: PredictionHistoryItem[] };
  return body.data ?? [];
}

// Full stored prediction (result + the original symptom payload) for a saved
// assessment — used by the "View report" action to reopen a specific case.
export type StoredPrediction = PredictionResult & {
  pet_id: string;
  created_at?: string;
  payload?: {
    symptoms?: string[];
    notes?: string;
    activity_level?: string;
    appetite_level?: string;
    urine_frequency?: string;
    diarrhea_level?: string;
    vomiting_frequency?: string;
  };
};

export async function getPrediction(id: string): Promise<StoredPrediction> {
  const response = await fetch(`${API_BASE_URL}/api/predictions/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Prediction request failed (${response.status})`);
  }
  const body = (await response.json()) as { success: boolean; data: StoredPrediction };
  return body.data;
}
