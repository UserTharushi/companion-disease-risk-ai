from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query

from app.schemas.prediction import (
    DiagnosisRequest,
    FeedbackRequest,
    PredictionResponse,
    SymptomPayload,
)
from app.services import access, model_store, names_i18n, ontology, prediction_repo, predictor

router = APIRouter()


def _caller(x_user_id: Optional[str], x_user_role: Optional[str]) -> tuple[str, str]:
    """Identity stamped by the api-gateway from a verified JWT."""
    return (x_user_id or "", (x_user_role or "").lower())


@router.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}


@router.post("/predict", response_model=PredictionResponse)
def predict(payload: SymptomPayload):
    response = predictor.predict(payload)
    prediction_id = prediction_repo.save(payload.model_dump(), response.model_dump())
    response.id = prediction_id
    return response


@router.get("/predictions/history")
def prediction_history(
    petId: Optional[str] = Query(default=None),
    ownerId: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    language: str = Query(default="en"),
    x_user_id: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    uid, role = _caller(x_user_id, x_user_role)
    items = prediction_repo.history(pet_id=petId, owner_id=ownerId, limit=limit)

    # A vet reads assessments only for pets they hold an active grant on. AI
    # risk assessments are the most sensitive records here, so this mirrors the
    # pet-service rule rather than trusting the caller's query parameters.
    if role == "vet":
        allowed = set(access.granted_pet_ids(uid))
        items = [item for item in items if str(item.get("pet_id")) in allowed]
    elif role == "owner":
        items = [item for item in items if str(item.get("owner_id")) == uid]

    for item in items:
        for disease in item.get("predicted_diseases", []):
            disease["disease_localized"] = names_i18n.localize_disease(disease.get("disease", ""), language)
    return {"success": True, "data": items}


# NOTE: registered before /predictions/{prediction_id} so the literal
# "feedback/summary" path is not captured by the {prediction_id} param.
@router.get("/predictions/feedback/summary")
def prediction_feedback_summary():
    return {"success": True, "data": prediction_repo.feedback_summary()}


@router.get("/predictions/{prediction_id}")
def prediction_detail(
    prediction_id: str,
    x_user_id: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    doc = prediction_repo.get(prediction_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Prediction not found")
    uid, role = _caller(x_user_id, x_user_role)
    # Without this the history filter would be cosmetic — the record is still
    # reachable by its id.
    if role == "vet" and not access.vet_may_access(uid, doc.get("pet_id")):
        raise HTTPException(status_code=403, detail="No active access grant for this pet")
    if role == "owner" and str(doc.get("owner_id")) != uid:
        raise HTTPException(status_code=403, detail="You can only view your own assessments")
    return {"success": True, "data": doc}


@router.post("/predictions/{prediction_id}/feedback")
def prediction_feedback(prediction_id: str, body: FeedbackRequest, ownerId: Optional[str] = Query(default=None)):
    ok = prediction_repo.set_feedback(
        prediction_id, body.rating, body.matched_diagnosis, body.comment, ownerId
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return {"success": True}


@router.post("/predictions/{prediction_id}/diagnosis")
def prediction_diagnosis(
    prediction_id: str,
    body: DiagnosisRequest,
    vetId: Optional[str] = Query(default=None),
    x_user_id: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
):
    uid, role = _caller(x_user_id, x_user_role)
    doc = prediction_repo.get(prediction_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Prediction not found")
    # Recording a diagnosis is care delivery: it requires the same relationship
    # as reading the case, not merely a vet role.
    if role == "vet" and not access.vet_may_access(uid, doc.get("pet_id")):
        raise HTTPException(status_code=403, detail="No active access grant for this pet")
    # Attribute to the verified caller, not a spoofable query parameter.
    ok = prediction_repo.set_diagnosis(prediction_id, body.diagnosis, body.notes, uid or vetId)
    if not ok:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return {"success": True}


@router.get("/model/info")
def model_info():
    return {"success": True, "data": model_store.model_info()}


@router.get("/ontology/summary")
def ontology_summary(language: str = Query(default="en")):
    summary = ontology.ontology_summary()
    if language in ("si", "ta") and summary.get("available"):
        # Display-only endpoint: show "localized (english)" pairs
        summary["diseases"] = [
            f"{names_i18n.localize_disease(name, language)} ({name})" for name in summary["diseases"]
        ]
        summary["symptoms"] = [
            f"{names_i18n.localize_symptom(name, language)} ({name})" for name in summary["symptoms"]
        ]
        summary["vaccines"] = [
            f"{names_i18n.localize_vaccine(name, language)} ({name})" for name in summary["vaccines"]
        ]
    return {"success": True, "data": summary}
