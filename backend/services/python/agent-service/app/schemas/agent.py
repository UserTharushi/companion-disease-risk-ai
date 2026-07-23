from typing import List, Optional

from pydantic import BaseModel, Field


class DiseaseRisk(BaseModel):
    disease: str
    probability: float
    disease_localized: Optional[str] = None


class OwnerLocation(BaseModel):
    lat: float
    lng: float


class ChatTurn(BaseModel):
    role: str  # "owner" | "assistant"
    text: str


class ChatRequest(BaseModel):
    """Free-text pet-health assistant chat, backed by Gemini with rule fallback."""

    message: str
    language: str = "en"  # en | si | ta
    history: List[ChatTurn] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    degraded: bool = False


class AgentRequest(BaseModel):
    """Legacy /recommend request — prediction already computed by the caller."""

    pet_id: str
    risk_level: str
    confidence_score: float
    predicted_diseases: List[DiseaseRisk]
    symptoms: List[str] = Field(default_factory=list)
    notes: str = ""
    owner_location: Optional[OwnerLocation] = None
    prediction_id: Optional[str] = None
    language: str = "en"  # en | si | ta — owner-facing text language


class AnalyzeRequest(BaseModel):
    """/analyze request — raw structured symptoms; the Disease Risk Prediction
    Agent calls the ML service itself (full three-agent pipeline)."""

    pet_id: str
    owner_id: Optional[str] = None
    species: str = "dog"
    breed: str = ""
    age_years: Optional[float] = None
    weight_kg: Optional[float] = None
    appetite_level: str = "normal"
    water_intake: str = "normal"
    activity_level: str = "normal"
    urine_frequency: str = "normal"
    vomiting_frequency: str = "none"
    diarrhea_level: str = "none"
    symptoms: List[str] = Field(default_factory=list)
    notes: str = ""
    symptom_duration_days: int = 1
    language: str = "en"
    owner_location: Optional[OwnerLocation] = None
    image_data_url: Optional[str] = None  # downscaled symptom photo (data URL)


class Recommendation(BaseModel):
    type: str  # vet_visit | vaccination | home_monitoring | emergency
    title: Optional[str] = None
    message: str
    urgency_hours: Optional[int] = None


class ClinicSuggestion(BaseModel):
    id: str
    name: str
    address: str
    distance_km: Optional[float] = None
    surgeon: Optional[str] = None
    next_slot: Optional[str] = None
    recommended: bool = False
    match_reason: Optional[str] = None
    external: bool = False  # OpenStreetMap listing — not bookable on the platform


class AgentSummary(BaseModel):
    agent: str
    status: str
    summary: str


class AgentResponse(BaseModel):
    recommendations: List[Recommendation]
    urgency_hours: Optional[int] = None
    explanation: str = ""
    agent_trace: List[str] = Field(default_factory=list)
    degraded: bool = False
    clinic_suggestions: List[ClinicSuggestion] = Field(default_factory=list)
    agents: List[AgentSummary] = Field(default_factory=list)
    required_specialization: Optional[str] = None
    prediction: Optional[dict] = None  # full ML prediction (/analyze only)
    image_findings: Optional[str] = None  # Gemini visual assessment of the symptom photo
