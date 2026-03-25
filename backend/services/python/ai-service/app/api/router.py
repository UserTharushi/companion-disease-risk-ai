from fastapi import APIRouter
from app.schemas.prediction import SymptomPayload, PredictionResponse, DiseaseRisk

router = APIRouter()

@router.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}

@router.post("/predict", response_model=PredictionResponse)
def predict(payload: SymptomPayload):
    risk_level = "low"
    confidence = 0.62

    if payload.vomiting_frequency in {"persistent", "multiple"} or payload.activity_level == "lethargic":
        risk_level = "medium"
        confidence = 0.74
    if payload.symptom_duration_days >= 3 and payload.appetite_level in {"reduced", "none"}:
        risk_level = "high"
        confidence = 0.86

    return PredictionResponse(
        risk_level=risk_level,
        confidence_score=confidence,
        predicted_diseases=[
            DiseaseRisk(disease="Gastrointestinal Disorder", probability=0.44),
            DiseaseRisk(disease="Kidney Disease", probability=0.31),
            DiseaseRisk(disease="Metabolic Disorder", probability=0.25),
        ],
    )
