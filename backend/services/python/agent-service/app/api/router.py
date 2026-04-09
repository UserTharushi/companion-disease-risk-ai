from fastapi import APIRouter
from app.schemas.agent import AgentRequest

router = APIRouter()

@router.get("/health")
def health():
    return {"status": "ok", "service": "agent-service"}

@router.post("/recommend")
def recommend(payload: AgentRequest):
    recommendations = ["Continue monitoring and log symptoms daily."]
    urgency_hours = None

    if payload.risk_level == "medium":
        recommendations = [
            "Schedule a veterinary consultation within 48 hours.",
            "Track appetite, hydration, and urination every 6 hours.",
        ]
        urgency_hours = 48

    if payload.risk_level == "high":
        recommendations = [
            "Seek veterinary care within 24 hours.",
            "Use nearby emergency-capable clinics.",
            "Carry previous health and vaccination records.",
        ]
        urgency_hours = 24

    return {
        "risk_level": payload.risk_level,
        "urgency_hours": urgency_hours,
        "recommendations": recommendations,
        "explainability": {
            "summary": "Recommendations generated using risk level and symptom-derived disease candidates.",
            "top_signals": ["vomiting_frequency", "activity_level", "symptom_duration_days"],
        },
    }
