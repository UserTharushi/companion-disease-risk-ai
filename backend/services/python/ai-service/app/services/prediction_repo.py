"""MongoDB persistence for predictions. Failure-tolerant: prediction still
returns even when Mongo is down (history just won't record)."""
from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId

logger = logging.getLogger("ai-service.repo")

# One submission can reach /predict twice. The agent pipeline calls it as its
# tool, and if the pipeline then fails further along, the front end falls back
# to calling /predict directly — by which point the first result is already
# stored. Owners also resubmit when a page seems stuck. All of those are one
# assessment from the owner's point of view, so an identical submission for the
# same pet inside this window updates nothing and returns the existing record.
_DUPLICATE_WINDOW = timedelta(minutes=2)


def _fingerprint(payload: dict) -> str:
    """Stable hash of a submission, so identical answers collide on purpose."""
    return hashlib.sha1(
        json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()

_client = None


def _collection():
    global _client
    if _client is None:
        from pymongo import MongoClient

        uri = (
            os.getenv("MONGODB_URI")
            or os.getenv("MONGO_URI")
            or "mongodb://root:rootpassword@localhost:27017/companion_ai?authSource=admin"
        )
        _client = MongoClient(uri, serverSelectionTimeoutMS=3000)
    db_name = os.getenv("MONGODB_DB_NAME", "companion_ai")
    return _client[db_name]["predictions"]


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    created = doc.get("created_at")
    if isinstance(created, datetime):
        # pymongo returns BSON datetimes tz-naive; they are stored as UTC, so
        # mark them UTC before serializing. Without this the ISO string has no
        # offset and clients (e.g. UTC+5:30) misread it as local time, showing
        # a constant "~5 hours ago" for freshly created records.
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        doc["created_at"] = created.isoformat()

    # Predictions saved before feature attribution existed carry bare n-grams
    # ("less", "has"). Replay the mapping against the stored payload so history
    # explains itself the same way a fresh assessment does.
    features = doc.get("top_features")
    if features:
        from app.services import predictor  # local import: avoids an import cycle

        doc["top_features"] = predictor.reattribute_stored(features, doc.get("payload"))
    return doc


def soft_delete(prediction_id: str, owner_id: str, is_admin: bool = False) -> str:
    """Remove an assessment from the owner's history.

    Marks the document rather than dropping it. The owner sees it gone, which
    is all they asked for, but the record still backs feedback_summary() — the
    AI-vs-vet agreement is computed by joining what the model predicted against
    what the vet later confirmed, and a removed row would take that evidence
    with it. It also keeps this consistent with access grants, which are
    revoked by stamping a date rather than deleting.

    Returns "deleted", "not_found" or "forbidden".
    """
    try:
        doc = _collection().find_one({"_id": ObjectId(prediction_id)}, {"owner_id": 1})
    except Exception:
        return "not_found"
    if doc is None:
        return "not_found"
    if not is_admin and str(doc.get("owner_id") or "") != owner_id:
        return "forbidden"

    _collection().update_one(
        {"_id": ObjectId(prediction_id)},
        {"$set": {"deleted_at": datetime.now(timezone.utc)}},
    )
    return "deleted"


def save(payload: dict, response: dict) -> Optional[str]:
    try:
        fingerprint = _fingerprint(payload)
        existing = _collection().find_one(
            {
                "fingerprint": fingerprint,
                "created_at": {"$gte": datetime.now(timezone.utc) - _DUPLICATE_WINDOW},
            },
            sort=[("created_at", -1)],
            projection={"_id": 1},
        )
        if existing is not None:
            logger.info("Duplicate submission within window; reusing %s", existing["_id"])
            return str(existing["_id"])

        doc = {
            "pet_id": payload.get("pet_id"),
            "owner_id": payload.get("owner_id"),
            "payload": payload,
            "fingerprint": fingerprint,
            "risk_level": response.get("risk_level"),
            "risk_score": response.get("risk_score"),
            "confidence_score": response.get("confidence_score"),
            "predicted_diseases": response.get("predicted_diseases", []),
            "ontology_links": response.get("ontology_links", []),
            "top_features": response.get("top_features", []),
            "disclaimer": response.get("disclaimer", ""),
            "model_version": response.get("model_version", "v1"),
            "created_at": datetime.now(timezone.utc),
        }
        result = _collection().insert_one(doc)
        return str(result.inserted_id)
    except Exception as ex:
        logger.warning("Could not persist prediction: %s", ex)
        return None


def history(pet_id: Optional[str] = None, owner_id: Optional[str] = None, limit: int = 20) -> list[dict]:
    try:
        # Removed assessments stay in the collection for feedback_summary()
        # but must not come back in anyone's history.
        query: dict = {"deleted_at": {"$exists": False}}
        if pet_id:
            query["pet_id"] = pet_id
        if owner_id:
            query["owner_id"] = owner_id
        cursor = _collection().find(query).sort("created_at", -1).limit(max(1, min(limit, 100)))
        return [_serialize(doc) for doc in cursor]
    except Exception as ex:
        logger.warning("Could not read prediction history: %s", ex)
        return []


def get(prediction_id: str) -> Optional[dict]:
    try:
        doc = _collection().find_one(
            {"_id": ObjectId(prediction_id), "deleted_at": {"$exists": False}}
        )
        return _serialize(doc) if doc else None
    except Exception as ex:
        logger.warning("Could not read prediction %s: %s", prediction_id, ex)
        return None


def set_feedback(prediction_id: str, rating: str, matched: Optional[str], comment: str, owner_id: Optional[str]) -> bool:
    """Owner feedback on a prediction (helpful / not_helpful, matched-vet-diagnosis, comment)."""
    try:
        fields = {
            "feedback_rating": rating,
            "feedback_matched_diagnosis": matched,
            "feedback_comment": comment,
            "feedback_owner_id": owner_id,
            "feedback_at": datetime.now(timezone.utc),
        }
        res = _collection().update_one({"_id": ObjectId(prediction_id)}, {"$set": fields})
        return res.matched_count > 0
    except Exception as ex:
        logger.warning("Could not save feedback for %s: %s", prediction_id, ex)
        return False


def set_diagnosis(prediction_id: str, diagnosis: str, notes: str, vet_id: Optional[str]) -> bool:
    """Vet's confirmed actual diagnosis for the case — enables AI-vs-actual comparison."""
    try:
        fields = {
            "vet_diagnosis": diagnosis,
            "vet_notes": notes,
            "vet_id": vet_id,
            "diagnosed_at": datetime.now(timezone.utc),
        }
        res = _collection().update_one({"_id": ObjectId(prediction_id)}, {"$set": fields})
        return res.matched_count > 0
    except Exception as ex:
        logger.warning("Could not save diagnosis for %s: %s", prediction_id, ex)
        return False


def feedback_summary() -> dict:
    """Research/eval aggregate: owner-feedback usefulness + AI-vs-vet-diagnosis agreement."""
    try:
        col = _collection()
        total = col.count_documents({})
        helpful = col.count_documents({"feedback_rating": "helpful"})
        not_helpful = col.count_documents({"feedback_rating": "not_helpful"})
        with_feedback = helpful + not_helpful
        # AI-vs-actual agreement (top-1 predicted disease == vet diagnosis)
        diagnosed = list(col.find({"vet_diagnosis": {"$exists": True, "$ne": ""}},
                                  {"predicted_diseases": 1, "vet_diagnosis": 1}))
        agree = 0
        for d in diagnosed:
            top = (d.get("predicted_diseases") or [{}])[0].get("disease", "")
            if top and top.strip().lower() == str(d.get("vet_diagnosis", "")).strip().lower():
                agree += 1
        n_diag = len(diagnosed)
        return {
            "total_predictions": total,
            "feedback_count": with_feedback,
            "helpful": helpful,
            "not_helpful": not_helpful,
            "helpful_rate": round(helpful / with_feedback, 4) if with_feedback else None,
            "diagnosed_count": n_diag,
            "ai_vs_vet_agreement": agree,
            "ai_vs_vet_agreement_rate": round(agree / n_diag, 4) if n_diag else None,
        }
    except Exception as ex:
        logger.warning("Could not compute feedback summary: %s", ex)
        return {"total_predictions": 0, "feedback_count": 0}
