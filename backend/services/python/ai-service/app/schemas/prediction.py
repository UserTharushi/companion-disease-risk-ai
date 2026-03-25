from pydantic import BaseModel
from typing import List

class SymptomPayload(BaseModel):
    pet_id: str
    appetite_level: str
    water_intake: str
    activity_level: str
    urine_frequency: str
    vomiting_frequency: str
    symptom_duration_days: int

class DiseaseRisk(BaseModel):
    disease: str
    probability: float

class PredictionResponse(BaseModel):
    risk_level: str
    confidence_score: float
    predicted_diseases: List[DiseaseRisk]
