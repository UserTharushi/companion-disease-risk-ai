"""Loads and caches the trained model artifacts."""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

import joblib

logger = logging.getLogger("ai-service.models")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_DIR = os.path.join(BASE_DIR, "models")
CONDITION_MODEL_PATH = os.path.join(MODEL_DIR, "condition_model.joblib")
RISK_MODEL_PATH = os.path.join(MODEL_DIR, "risk_model.joblib")
CONDITION_METRICS_PATH = os.path.join(MODEL_DIR, "condition_metrics.json")
RISK_METRICS_PATH = os.path.join(MODEL_DIR, "risk_metrics.json")

_condition_model: Optional[Any] = None
_risk_artifact: Optional[dict] = None  # {"binarizer": ..., "model": ...}


def load_models() -> None:
    global _condition_model, _risk_artifact
    if os.path.exists(CONDITION_MODEL_PATH):
        try:
            _condition_model = joblib.load(CONDITION_MODEL_PATH)
            logger.info("Loaded condition model from %s", CONDITION_MODEL_PATH)
        except Exception as ex:
            logger.warning("Failed to load condition model: %s", ex)
    else:
        logger.warning("No condition model at %s — rule fallback active", CONDITION_MODEL_PATH)
    if os.path.exists(RISK_MODEL_PATH):
        try:
            _risk_artifact = joblib.load(RISK_MODEL_PATH)
            logger.info("Loaded risk model from %s", RISK_MODEL_PATH)
        except Exception as ex:
            logger.warning("Failed to load risk model: %s", ex)
    else:
        logger.warning("No risk model at %s — rule fallback active", RISK_MODEL_PATH)


def get_condition_model() -> Optional[Any]:
    return _condition_model


def get_risk_artifact() -> Optional[dict]:
    return _risk_artifact


def _read_json(path: str) -> Optional[dict]:
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return None


def model_info() -> dict:
    return {
        "condition_model_loaded": _condition_model is not None,
        "risk_model_loaded": _risk_artifact is not None,
        "condition_metrics": _read_json(CONDITION_METRICS_PATH),
        "risk_metrics": _read_json(RISK_METRICS_PATH),
    }
