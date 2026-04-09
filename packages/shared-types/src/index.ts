// ─────────────────────────────────────────────
// Companion Disease Risk AI — Shared Types
// ─────────────────────────────────────────────

// ── User & Auth ───────────────────────────────
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  role: "owner" | "admin" | "vet";
}

// ── Pet ───────────────────────────────────────
export type PetSpecies = "dog" | "cat";
export type PetSex = "male" | "female";

export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: PetSpecies;
  breed: string;
  ageYears: number;
  weightKg: number;
  sex: PetSex;
  neutered: boolean;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Symptom Input ─────────────────────────────
export type AppetiteLevel      = "normal" | "reduced" | "increased" | "none";
export type WaterIntakeLevel   = "normal" | "increased" | "decreased";
export type ActivityLevel      = "normal" | "lethargic" | "hyperactive";
export type UrineFrequency     = "normal" | "increased" | "decreased" | "absent";
export type VomitingFrequency  = "none" | "once" | "multiple" | "persistent";

export interface SymptomInput {
  petId: string;
  appetiteLevel: AppetiteLevel;
  waterIntake: WaterIntakeLevel;
  activityLevel: ActivityLevel;
  urineFrequency: UrineFrequency;
  vomitingFrequency: VomitingFrequency;
  diarrhoea: boolean;
  coughing: boolean;
  sneezing: boolean;
  skinIssues: boolean;
  eyeDischarge: boolean;
  weightLoss: boolean;
  swollenAbdomen: boolean;
  additionalNotes?: string;
  symptomDurationDays: number;
  submittedAt: string;
}

// ── Risk Prediction ───────────────────────────
export type RiskLevel = "low" | "medium" | "high";

export interface RiskPrediction {
  id: string;
  petId: string;
  symptomInputId: string;
  riskLevel: RiskLevel;
  confidenceScore: number;          // 0–1
  predictedDiseases: DiseaseRisk[];
  urgencyAction: string;
  explanation: string;              // Plain-language explainability
  topFeatures: FeatureImportance[];
  agentRecommendations: AgentRecommendation[];
  createdAt: string;
}

export interface DiseaseRisk {
  disease: string;
  probability: number;
}

export interface FeatureImportance {
  feature: string;
  weight: number;
}

export interface AgentRecommendation {
  type: "vet_visit" | "vaccination" | "home_monitoring" | "emergency";
  message: string;
  urgencyHours?: number;
}

// ── Vaccination ───────────────────────────────
export interface VaccinationRecord {
  id: string;
  petId: string;
  vaccineName: string;
  administeredAt: string;
  nextDueAt: string;
  administeredBy?: string;
  batchNumber?: string;
  notes?: string;
}

// ── Clinic & Booking ──────────────────────────
export interface VetClinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email?: string;
  specializations: string[];
  rating: number;
  reviewCount: number;
  isOpen: boolean;
  surgeons: Surgeon[];
}

export interface Surgeon {
  id: string;
  clinicId: string;
  name: string;
  specialization: string;
  qualifications: string[];
  photoURL?: string;
  rating: number;
  availableSlots: TimeSlot[];
}

export interface TimeSlot {
  id: string;
  surgeonId: string;
  datetime: string;
  durationMins: number;
  isBooked: boolean;
}

export interface Appointment {
  id: string;
  ownerId: string;
  petId: string;
  clinicId: string;
  surgeonId: string;
  slotId: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  notes?: string;
  createdAt: string;
}

// ── API Responses ─────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ── Notifications ─────────────────────────────
export type NotificationType =
  | "risk_alert"
  | "vaccination_due"
  | "appointment_reminder"
  | "appointment_confirmation"
  | "follow_up";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
}
