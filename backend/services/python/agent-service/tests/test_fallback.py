import pytest
from fastapi.testclient import TestClient

from app.agents.fallback import rule_based_recommendation
from app.core import cache
from app.main import app


@pytest.fixture(autouse=True)
def clear_cache():
    cache._store.clear()
    yield
    cache._store.clear()


@pytest.fixture
def client(monkeypatch):
    # Force degraded mode regardless of local env
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    with TestClient(app) as test_client:
        yield test_client


DISEASES = [{"disease": "Digestive Issues", "probability": 0.7}]


class TestRuleLadder:
    def test_high_risk_has_urgency(self):
        result = rule_based_recommendation("high", 0.9, DISEASES)
        assert result["urgency_hours"] == 12  # high confidence escalates
        assert result["degraded"] is True
        assert any(r["type"] in {"vet_visit", "emergency"} for r in result["recommendations"])

    def test_high_risk_low_confidence(self):
        assert rule_based_recommendation("high", 0.6, DISEASES)["urgency_hours"] == 24

    def test_medium_risk(self):
        result = rule_based_recommendation("medium", 0.8, DISEASES)
        assert result["urgency_hours"] == 48

    def test_low_risk_no_urgency(self):
        result = rule_based_recommendation("low", 0.6, [])
        assert result["urgency_hours"] is None
        assert all(r["type"] == "home_monitoring" for r in result["recommendations"])


class TestRecommendEndpoint:
    @pytest.mark.parametrize("risk_level", ["low", "medium", "high"])
    def test_degraded_output_for_all_risk_levels(self, client, risk_level):
        response = client.post("/recommend", json={
            "pet_id": f"p-{risk_level}",
            "risk_level": risk_level,
            "confidence_score": 0.8,
            "predicted_diseases": DISEASES,
            "symptoms": ["vomiting"],
        })
        assert response.status_code == 200
        body = response.json()
        assert body["degraded"] is True
        assert len(body["recommendations"]) > 0
        assert isinstance(body["agent_trace"], list) and body["agent_trace"]

    def test_response_is_cached(self, client):
        payload = {
            "pet_id": "cache-pet",
            "risk_level": "low",
            "confidence_score": 0.6,
            "predicted_diseases": [],
            "symptoms": [],
        }
        first = client.post("/recommend", json=payload).json()
        second = client.post("/recommend", json=payload).json()
        assert first == second


class TestLocalization:
    @pytest.mark.parametrize("lang", ["si", "ta"])
    def test_recommendations_localized(self, client, lang):
        response = client.post("/recommend", json={
            "pet_id": f"p-loc-{lang}",
            "risk_level": "high",
            "confidence_score": 0.9,
            "predicted_diseases": DISEASES,
            "symptoms": ["vomiting"],
            "language": lang,
        })
        assert response.status_code == 200
        body = response.json()
        text = " ".join(r["message"] + (r.get("title") or "") for r in body["recommendations"])
        # Tamil block U+0B80–U+0BFF, Sinhala block U+0D80–U+0DFF — both above U+0B00
        assert any(ord(ch) >= 0x0B00 for ch in text), f"expected {lang} script in: {text[:120]}"

    def test_language_isolated_in_cache(self, client):
        base = {
            "pet_id": "p-cache-lang", "risk_level": "low", "confidence_score": 0.6,
            "predicted_diseases": [], "symptoms": [],
        }
        en = client.post("/recommend", json={**base, "language": "en"}).json()
        si = client.post("/recommend", json={**base, "language": "si"}).json()
        assert en["recommendations"][0]["message"] != si["recommendations"][0]["message"]


class TestAnalyzePipeline:
    def test_analyze_without_ml_service_still_works(self, client):
        """ML service unreachable -> Agent 1 local heuristic fallback, never a 500."""
        response = client.post("/analyze", json={
            "pet_id": "p-analyze",
            "species": "dog",
            "appetite_level": "none",
            "activity_level": "lethargic",
            "vomiting_frequency": "persistent",
            "symptoms": ["lethargy", "loss-of-appetite"],
            "symptom_duration_days": 4,
            "language": "en",
        })
        assert response.status_code == 200
        body = response.json()
        assert body["prediction"] is not None
        assert body["prediction"]["risk_level"] == "high"  # duration>=3 + appetite none
        assert body["degraded"] is True
        assert len(body["agents"]) == 3
        assert body["agents"][0]["status"].startswith("agent-local-fallback")
        assert any(step.startswith("disease_risk_prediction_agent") for step in body["agent_trace"])

    def test_analyze_healthy_pet_low_risk(self, client):
        response = client.post("/analyze", json={"pet_id": "p-healthy", "language": "en"})
        assert response.status_code == 200
        body = response.json()
        assert body["prediction"]["risk_level"] == "low"
        assert body["agents"][2]["status"] == "skipped"


    def test_analyze_with_image_degraded_mode(self, client):
        """Without an LLM the photo is safely ignored — never an error."""
        tiny_png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        response = client.post("/analyze", json={
            "pet_id": "p-img",
            "species": "dog",
            "appetite_level": "reduced",
            "symptoms": ["skin-irritation"],
            "symptom_duration_days": 2,
            "language": "en",
            "image_data_url": tiny_png,
        })
        assert response.status_code == 200
        body = response.json()
        assert body["image_findings"] is None  # rules can't see
        assert any("photo received" in step for step in body["agent_trace"])
