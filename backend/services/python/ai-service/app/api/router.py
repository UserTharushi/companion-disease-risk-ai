from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.prediction import (
    DiagnosisRequest,
    FeedbackRequest,
    PredictionResponse,
    SymptomPayload,
)
from app.services import model_store, names_i18n, ontology, prediction_repo, predictor

router = APIRouter()


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
):
    items = prediction_repo.history(pet_id=petId, owner_id=ownerId, limit=limit)
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
def prediction_detail(prediction_id: str):
    doc = prediction_repo.get(prediction_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Prediction not found")
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
def prediction_diagnosis(prediction_id: str, body: DiagnosisRequest, vetId: Optional[str] = Query(default=None)):
    ok = prediction_repo.set_diagnosis(prediction_id, body.diagnosis, body.notes, vetId)
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
