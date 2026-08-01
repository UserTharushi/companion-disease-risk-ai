from pydantic import BaseModel, Field
from typing import List, Optional

DISCLAIMER_TEXT = (
    "This is a decision support tool, not a medical diagnosis. "
    "Always consult a licensed veterinarian for professional advice."
)

# NFR1 requires this notice on every result. It was previously English-only in
# all three languages, which made the one string that most needs to be
# understood the least readable one on the page.
DISCLAIMER_I18N: dict[str, str] = {
    "en": DISCLAIMER_TEXT,
    "si": (
        "මෙය තීරණ ගැනීමට සහාය වන මෙවලමකි, වෛද්‍ය රෝග විනිශ්චයක් නොවේ. "
        "වෘත්තීය උපදෙස් සඳහා සැමවිටම බලපත්‍රලාභී පශු වෛද්‍යවරයෙකුගෙන් විමසන්න."
    ),
    "ta": (
        "இது முடிவெடுக்க உதவும் கருவி, மருத்துவ நோயறிதல் அல்ல. "
        "தொழில்முறை ஆலோசனைக்கு எப்போதும் உரிமம் பெற்ற கால்நடை மருத்துவரை அணுகவும்."
    ),
}


def disclaimer_for(language: str | None) -> str:
    """The disclaimer in the caller's language, falling back to English."""
    return DISCLAIMER_I18N.get((language or "en").lower(), DISCLAIMER_TEXT)


class FeedbackRequest(BaseModel):
    rating: str  # "helpful" | "not_helpful"
    matched_diagnosis: Optional[str] = None  # "yes" | "no" | "unsure"
    comment: str = ""


class DiagnosisRequest(BaseModel):
    diagnosis: str  # the vet's confirmed actual diagnosis
    notes: str = ""


class SymptomPayload(BaseModel):
    pet_id: str
    owner_id: Optional[str] = None
    species: str = "dog"
    breed: str = ""
    age_years: Optional[float] = None
    weight_kg: Optional[float] = None
    appetite_level: str
    water_intake: str = "normal"
    activity_level: str
    urine_frequency: str
    vomiting_frequency: str
    diarrhea_level: str = "none"
    symptoms: List[str] = Field(default_factory=list)
    notes: str = ""
    symptom_duration_days: int = 1
    language: str = "en"  # en | si | ta — display language for names


class DiseaseRisk(BaseModel):
    disease: str  # canonical English name (ML class / ontology key)
    probability: float
    disease_localized: Optional[str] = None


class OntologyLink(BaseModel):
    symptom: str
    disease: str
    weight: float
    symptom_localized: Optional[str] = None
    disease_localized: Optional[str] = None


class TopFeature(BaseModel):
    # `feature` stays the raw model n-gram (back-compat for stored predictions
    # and the expert-review tooling). `field`/`value` are the form control the
    # n-gram came from — the frontend localizes those into a readable label and
    # falls back to `feature` when they are absent.
    feature: str
    weight: float
    field: Optional[str] = None
    value: Optional[str] = None


class PredictionResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    id: Optional[str] = None
    risk_level: str
    confidence_score: float
    risk_score: float = 0.0
    predicted_diseases: List[DiseaseRisk]
    ontology_links: List[OntologyLink] = Field(default_factory=list)
    top_features: List[TopFeature] = Field(default_factory=list)
    model_version: str = "v1"
    disclaimer: str = DISCLAIMER_TEXT
