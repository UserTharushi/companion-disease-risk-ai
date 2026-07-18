import importlib

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import model_store, prediction_repo

PAYLOAD = {
    "pet_id": "test-pet",
    "species": "dog",
    "appetite_level": "none",
    "water_intake": "normal",
    "activity_level": "lethargic",
    "urine_frequency": "normal",
    "vomiting_frequency": "persistent",
    "diarrhea_level": "moderate",
    "symptoms": ["lethargy", "loss-of-appetite"],
    "notes": "not eating for days",
    "symptom_duration_days": 4,
}


@pytest.fixture(autouse=True)
def no_mongo(monkeypatch):
    """Persistence must never break predictions — always stub it in tests."""
    monkeypatch.setattr(prediction_repo, "save", lambda payload, response: None)
    monkeypatch.setattr(prediction_repo, "history", lambda **kwargs: [])
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_predict_with_models(client):
    """Committed model artifacts must produce a real model prediction."""
    if model_store.get_condition_model() is None:
        pytest.skip("model artifacts not present")
    response = client.post("/predict", json=PAYLOAD)
    assert response.status_code == 200
    body = response.json()
    assert body["risk_level"] in {"low", "medium", "high"}
    assert 0.0 <= body["confidence_score"] <= 1.0
    assert 0.0 <= body["risk_score"] <= 1.0
    assert body["model_version"] == "v1"
    assert len(body["predicted_diseases"]) > 0
    diseases = {d["disease"] for d in body["predicted_diseases"]}
    # Severe GI symptoms should surface Digestive Issues among the top conditions
    assert "Digestive Issues" in diseases
    assert body["disclaimer"]


def test_predict_fallback_without_models(client, monkeypatch):
    """No artifacts -> rule fallback, never a 500."""
    monkeypatch.setattr(model_store, "get_condition_model", lambda: None)
    monkeypatch.setattr(model_store, "get_risk_artifact", lambda: None)
    response = client.post("/predict", json=PAYLOAD)
    assert response.status_code == 200
    body = response.json()
    assert body["model_version"] == "rule-fallback"
    assert body["risk_level"] == "high"  # duration>=3 and appetite none
    assert len(body["predicted_diseases"]) > 0


def test_predict_minimal_payload_backward_compatible(client):
    """The original 6-field payload from before the extension still works."""
    response = client.post("/predict", json={
        "pet_id": "p1",
        "appetite_level": "normal",
        "water_intake": "normal",
        "activity_level": "normal",
        "urine_frequency": "normal",
        "vomiting_frequency": "none",
        "symptom_duration_days": 1,
    })
    assert response.status_code == 200
    assert response.json()["risk_level"] == "low"


def test_history_endpoint(client):
    response = client.get("/predictions/history?petId=test-pet")
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_model_info(client):
    body = client.get("/model/info").json()
    assert body["success"] is True
    assert "condition_model_loaded" in body["data"]
