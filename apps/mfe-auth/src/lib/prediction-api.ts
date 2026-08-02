import { getAccessToken } from "./session";
import { getAppLanguage } from "./language";
import { getOwnerId } from "./pet-api";
import { API_BASE_URL } from "./api-base";


export type PredictionVitals = {
  activityLevel: string;
  appetiteLevel: string;
  waterIntake: string;
  urinationLevel: string;
  diarrheaLevel: string;
  vomitingLevel: string;
};

export type PredictionInput = {
  petId: string;
  species?: string;
  breed?: string;
  ageYears?: number;
  weightKg?: number;
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
  // `field`/`value` name the form control the model term came from, so the UI
  // can show "Water intake: reduced" instead of the raw n-gram. Absent on
  // predictions stored before attribution existed — fall back to `feature`.
  top_features: Array<{ feature: string; weight: number; field?: string | null; value?: string | null }>;
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
    breed: input.breed || "",
    age_years: input.ageYears ?? null,
    weight_kg: input.weightKg ?? null,
    // Values are already the backend enums (chosen from clear per-field options)
    appetite_level: input.vitals.appetiteLevel || "normal",
    water_intake: input.vitals.waterIntake || "normal",
    activity_level: input.vitals.activityLevel || "normal",
    urine_frequency: input.vitals.urinationLevel || "normal",
    vomiting_frequency: input.vitals.vomitingLevel || "none",
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
  // Without the language the service returns the names stored when the
  // assessment was created, so reopening a Tamil assessment while the app is
  // in Sinhala showed Tamil conditions under a Sinhala interface.
  const params = new URLSearchParams({ language: getAppLanguage() });
  const response = await fetch(`${API_BASE_URL}/api/predictions/${encodeURIComponent(id)}?${params}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Prediction request failed (${response.status})`);
  }
  const body = (await response.json()) as { success: boolean; data: StoredPrediction };
  return body.data;
}

// --- Feedback / diagnosis loop -------------------------------------------
// Owner tells us whether a prediction was useful and (once seen by a vet)
// whether it matched the real diagnosis; the vet records the confirmed
// diagnosis. Together these close the AI-vs-actual continuous-learning loop.

export type PredictionFeedback = {
  rating: "helpful" | "not_helpful";
  matchedDiagnosis?: "yes" | "no" | "unsure";
  comment?: string;
};

export async function submitPredictionFeedback(predictionId: string, feedback: PredictionFeedback): Promise<void> {
  const params = new URLSearchParams({ ownerId: getOwnerId() });
  const response = await fetch(
    `${API_BASE_URL}/api/predictions/${encodeURIComponent(predictionId)}/feedback?${params}`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        rating: feedback.rating,
        matched_diagnosis: feedback.matchedDiagnosis ?? null,
        comment: feedback.comment ?? "",
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Feedback request failed (${response.status})`);
  }
}

export async function recordVetDiagnosis(
  predictionId: string,
  diagnosis: { diagnosis: string; notes?: string },
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/predictions/${encodeURIComponent(predictionId)}/diagnosis`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ diagnosis: diagnosis.diagnosis, notes: diagnosis.notes ?? "" }),
    },
  );
  if (!response.ok) {
    throw new Error(`Diagnosis request failed (${response.status})`);
  }
}

export type FeedbackSummary = {
  total_predictions: number;
  feedback_count: number;
  helpful: number;
  not_helpful: number;
  helpful_rate: number | null;
  diagnosed_count: number;
  ai_vs_vet_agreement: number;
  ai_vs_vet_agreement_rate: number | null;
};

export async function getFeedbackSummary(): Promise<FeedbackSummary> {
  const response = await fetch(`${API_BASE_URL}/api/predictions/feedback/summary`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Feedback summary request failed (${response.status})`);
  }
  const body = (await response.json()) as { success: boolean; data: FeedbackSummary };
  return body.data;
}

// The admin governance panel used to fetch these two with a bare fetch() and no
// Authorization header, so with AUTH_ENFORCE=true the gateway answered 401 and
// the panel silently rendered empty. Route them through authHeaders() like
// every other call.
export async function getModelInfo<T = unknown>(): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/model/info`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Model info request failed (${response.status})`);
  }
  const body = (await response.json()) as { success: boolean; data: T };
  return body.data;
}

export async function getOntologySummary<T = unknown>(language = "en"): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/ontology/summary?language=${encodeURIComponent(language)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Ontology summary request failed (${response.status})`);
  }
  const body = (await response.json()) as { success: boolean; data: T };
  return body.data;
}
