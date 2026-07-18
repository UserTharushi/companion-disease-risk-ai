import logging

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app.agents import fallback
from app.agents.graph import get_graph
from app.core import cache
from app.core.llm import invoke_text
from app.schemas.agent import (
    AgentRequest,
    AgentResponse,
    AnalyzeRequest,
    ChatRequest,
    ChatResponse,
)
from app.services.monitoring import last_run_summary, run_monitoring_cycle

logger = logging.getLogger("agent-service.router")

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "service": "agent-service"}


def _response_from_state(state: dict, include_prediction: bool) -> AgentResponse:
    # LangGraph initializes unset state channels to None — use None-safe defaults
    return AgentResponse(
        recommendations=state.get("recommendations") or [],
        urgency_hours=state.get("urgency_hours"),
        explanation=state.get("explanation") or "",
        agent_trace=state.get("agent_trace") or [],
        degraded=bool(state.get("degraded")),
        clinic_suggestions=state.get("clinic_suggestions") or [],
        agents=state.get("agents") or [],
        required_specialization=state.get("required_specialization"),
        prediction=state.get("prediction") if include_prediction else None,
        image_findings=state.get("image_findings"),
    )


def _fallback_response(risk_level: str, confidence: float, diseases: list[dict], language: str) -> AgentResponse:
    base = fallback.rule_based_recommendation(risk_level, confidence, diseases, language=language)
    return AgentResponse(
        recommendations=base["recommendations"],
        urgency_hours=base["urgency_hours"],
        explanation=base["explanation"],
        agent_trace=["graph_error: fell back to rule-based recommendations"],
        degraded=True,
    )


@router.post("/analyze", response_model=AgentResponse)
def analyze(payload: AnalyzeRequest):
    """Full three-agent pipeline: Disease Risk Prediction Agent (calls the ML
    service) -> Explainable Care Recommendation Agent -> Veterinary Discovery
    & Booking Agent."""
    symptom_payload = payload.model_dump(exclude={"owner_location", "image_data_url"})
    try:
        state = get_graph().invoke({
            "pet_id": payload.pet_id,
            "symptom_payload": symptom_payload,
            "symptoms": payload.symptoms,
            "notes": payload.notes,
            "owner_location": payload.owner_location.model_dump() if payload.owner_location else None,
            "language": payload.language,
            "image_data_url": payload.image_data_url,
            "agent_trace": [],
            "degraded": False,
        })
        return _response_from_state(state, include_prediction=True)
    except Exception as ex:
        logger.exception("Analyze pipeline failed — rule fallback: %s", ex)
        return _fallback_response("medium", 0.5, [], payload.language)


@router.post("/recommend", response_model=AgentResponse)
def recommend(payload: AgentRequest):
    """Legacy path: caller already has a prediction; Agent 1 passes it through."""
    diseases = ",".join(sorted(d.disease for d in payload.predicted_diseases))
    key = f"{payload.pet_id}|{payload.risk_level}|{diseases}|{bool(payload.owner_location)}|{payload.language}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    try:
        state = get_graph().invoke({
            "pet_id": payload.pet_id,
            "risk_level": payload.risk_level,
            "confidence_score": payload.confidence_score,
            "predicted_diseases": [d.model_dump() for d in payload.predicted_diseases],
            "symptoms": payload.symptoms,
            "notes": payload.notes,
            "owner_location": payload.owner_location.model_dump() if payload.owner_location else None,
            "prediction_id": payload.prediction_id,
            "language": payload.language,
            "agent_trace": [],
            "degraded": False,
        })
        response = _response_from_state(state, include_prediction=False)
    except Exception as ex:
        logger.exception("Agent graph failed — returning rule-based fallback: %s", ex)
        response = _fallback_response(
            payload.risk_level,
            payload.confidence_score,
            [d.model_dump() for d in payload.predicted_diseases],
            payload.language,
        )

    cache.put(key, response)
    return response


_CHAT_LANG_NAME = {"en": "English", "si": "Sinhala", "ta": "Tamil"}
_CHAT_FALLBACK = {
    "en": (
        "I can't reach the AI service right now. For any worrying symptom, monitor your pet "
        "for 12–24 hours and contact a veterinarian if it persists or worsens. For a detailed "
        "assessment, use the structured symptom report."
    ),
    "si": (
        "දැනට AI සේවාවට සම්බන්ධ විය නොහැක. කරදරකාරී රෝග ලක්ෂණයක් ඇත්නම් ඔබේ සුරතලා පැය 12–24ක් "
        "නිරීක්ෂණය කර, එය දිගටම පවතී නම් හෝ නරක අතට හැරේ නම් පශු වෛද්‍යවරයෙකු හමුවන්න. විස්තරාත්මක "
        "තක්සේරුවක් සඳහා ව්‍යුහගත රෝග ලක්ෂණ වාර්තාව භාවිතා කරන්න."
    ),
    "ta": (
        "இப்போது AI சேவையை அணுக முடியவில்லை. கவலையளிக்கும் அறிகுறி இருந்தால், உங்கள் செல்லப்பிராணியை "
        "12–24 மணிநேரம் கண்காணித்து, தொடர்ந்தால் அல்லது மோசமடைந்தால் கால்நடை மருத்துவரை அணுகவும். "
        "விரிவான மதிப்பீட்டிற்கு, கட்டமைக்கப்பட்ட அறிகுறி அறிக்கையைப் பயன்படுத்தவும்."
    ),
}


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    """Free-text pet-health guidance from Gemini, with a safe rule-based fallback.

    This is general triage-style guidance only — it never diagnoses, and always
    steers the owner to a vet or the structured symptom report for anything
    serious (NFR1 decision-support disclaimer)."""
    lang = payload.language if payload.language in _CHAT_LANG_NAME else "en"
    message = (payload.message or "").strip()
    if not message:
        return ChatResponse(reply=_CHAT_FALLBACK[lang], degraded=True)

    recent = payload.history[-6:]
    transcript = "\n".join(f"{'Owner' if t.role == 'owner' else 'Assistant'}: {t.text}" for t in recent)
    prompt = (
        "You are a companion-animal (dogs and cats) health assistant for pet owners in Sri Lanka. "
        "Give brief, practical, empathetic guidance (2–4 sentences). You are a decision-support "
        "assistant, NOT a veterinarian: never give a definitive diagnosis, and for any red-flag or "
        "worsening symptom advise seeing a vet. Only discuss companion-animal health; politely "
        "decline unrelated topics. Do not use markdown formatting.\n"
        f"Reply in {_CHAT_LANG_NAME[lang]}.\n\n"
        + (f"Conversation so far:\n{transcript}\n\n" if transcript else "")
        + f"Owner: {message}\nAssistant:"
    )

    reply = await run_in_threadpool(invoke_text, prompt)
    if not reply:
        return ChatResponse(reply=_CHAT_FALLBACK[lang], degraded=True)
    return ChatResponse(reply=reply, degraded=False)


@router.post("/monitor/run")
async def monitor_run():
    """Manual trigger for the autonomous monitoring cycle (demo/viva use)."""
    summary = await run_in_threadpool(run_monitoring_cycle)
    return {"success": True, "data": summary}


@router.get("/monitor/status")
def monitor_status():
    return {"success": True, "data": {"last_run": last_run_summary()}}
