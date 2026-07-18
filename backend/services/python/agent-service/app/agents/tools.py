"""Agent tools: HTTP calls to the Node microservices and Neo4j ontology queries.
Every call is failure-tolerant (3s timeout, empty defaults) so a missing
service never breaks the graph."""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger("agent-service.tools")

HTTP_TIMEOUT = 3.0


def _base(name: str, default_port: int) -> str:
    return os.getenv(name, f"http://localhost:{default_port}").rstrip("/")


def _get_json(url: str, params: Optional[dict] = None) -> Optional[dict | list]:
    try:
        response = httpx.get(url, params=params, timeout=HTTP_TIMEOUT)
        if response.status_code != 200:
            return None
        body = response.json()
        if isinstance(body, dict) and "data" in body:
            return body["data"]
        return body
    except Exception as ex:
        logger.warning("GET %s failed: %s", url, ex)
        return None


def predict_via_ml(symptom_payload: dict) -> Optional[dict]:
    """Tool of the Disease Risk Prediction Agent: call ai-service /predict.
    Returns the full prediction dict, or None when the ML service is unreachable."""
    try:
        response = httpx.post(
            f"{_base('AI_SERVICE_URL', 8001)}/predict",
            json=symptom_payload,
            timeout=10.0,
        )
        if response.status_code != 200:
            logger.warning("ML predict returned %s", response.status_code)
            return None
        return response.json()
    except Exception as ex:
        logger.warning("ML predict failed: %s", ex)
        return None


def get_pet(pet_id: str) -> dict:
    data = _get_json(f"{_base('PET_SERVICE_URL', 4002)}/api/pets/{pet_id}")
    return data if isinstance(data, dict) else {}


def get_vaccinations(pet_id: str) -> list[dict]:
    data = _get_json(f"{_base('VACCINATION_SERVICE_URL', 4005)}/api/vaccinations", {"petId": pet_id})
    return data if isinstance(data, list) else []


def find_clinics(lat: Optional[float] = None, lng: Optional[float] = None) -> list[dict]:
    base = _base("CLINIC_SERVICE_URL", 4003)
    if lat is not None and lng is not None:
        data = _get_json(f"{base}/api/clinics/nearby", {"lat": lat, "lng": lng, "maxKm": 100})
        if isinstance(data, list) and data:
            return data
    data = _get_json(f"{base}/api/clinics")
    return data if isinstance(data, list) else []


def post_notification(payload: dict) -> bool:
    """True only when a NEW notification was created (201); dedupe hits return 200."""
    try:
        response = httpx.post(
            f"{_base('NOTIFICATION_SERVICE_URL', 4004)}/api/notifications",
            json=payload,
            timeout=HTTP_TIMEOUT,
        )
        return response.status_code == 201
    except Exception as ex:
        logger.warning("POST notification failed: %s", ex)
        return False


# ── Neo4j ontology ────────────────────────────────────────────────

_driver = None


def _neo4j_session():
    global _driver
    if _driver is None:
        from neo4j import GraphDatabase

        _driver = GraphDatabase.driver(
            os.getenv("NEO4J_URI", "bolt://localhost:7687"),
            auth=(os.getenv("NEO4J_USERNAME", "neo4j"), os.getenv("NEO4J_PASSWORD", "your-neo4j-password")),
        )
    return _driver.session(database=os.getenv("NEO4J_DATABASE", "neo4j"))


def ontology_context(symptom_tokens: list[str], diseases: list[str]) -> dict:
    """{indicating: [{symptom, disease, weight}], preventing_vaccines: [{vaccine, disease}]}"""
    result = {"indicating": [], "preventing_vaccines": []}
    try:
        with _neo4j_session() as session:
            if symptom_tokens:
                records = session.run(
                    """
                    MATCH (s:Symptom)-[r:INDICATES]->(d:Disease)
                    WHERE toLower(s.name) IN $tokens
                    RETURN s.name AS symptom, d.name AS disease, r.weight AS weight
                    ORDER BY r.weight DESC LIMIT 10
                    """,
                    tokens=[t.lower() for t in symptom_tokens],
                )
                result["indicating"] = [
                    {"symptom": r["symptom"], "disease": r["disease"], "weight": float(r["weight"] or 0.5)}
                    for r in records
                ]
            if diseases:
                records = session.run(
                    """
                    MATCH (v:Vaccine)-[:PREVENTS]->(d:Disease)
                    WHERE toLower(d.name) IN $names
                    RETURN v.name AS vaccine, d.name AS disease
                    """,
                    names=[d.lower() for d in diseases],
                )
                result["preventing_vaccines"] = [{"vaccine": r["vaccine"], "disease": r["disease"]} for r in records]
    except Exception as ex:
        logger.warning("Ontology lookup failed: %s", ex)
    return result


# Frontend checklist ids -> ontology symptom names (mirror of ai-service feature_bridge)
CHECKLIST_TOKENS = {
    "lethargy": "lethargy",
    "coughing": "coughing",
    "fever": "fever",
    "reduced-activity": "reduced activity",
    "stiff-gait": "lameness",
    "loss-of-appetite": "loss of appetite",
    "skin-irritation": "skin lesions",
    "breathing-difficulty": "difficulty breathing",
    "ear-scratching": "ear scratching",
    "head-shaking": "head shaking",
}


def symptoms_to_tokens(symptoms: list[str]) -> list[str]:
    return [CHECKLIST_TOKENS.get(s, s.replace("-", " ")) for s in symptoms]
