from app.agents import nodes
from app.agents.graph import build_graph


def invoke(risk_level: str, urgency_hint: dict | None = None) -> dict:
    graph = build_graph()
    state = {
        "pet_id": "p1",
        "risk_level": risk_level,
        "confidence_score": 0.8,
        "predicted_diseases": [{"disease": "Digestive Issues", "probability": 0.7}],
        "symptoms": ["vomiting"],
        "notes": "",
        "owner_location": None,
        "agent_trace": [],
        "degraded": False,
    }
    if urgency_hint:
        state.update(urgency_hint)
    return graph.invoke(state)


class TestThreeAgentPipeline:
    def test_low_risk_skips_vet_discovery(self):
        result = invoke("low")
        assert not any("vet_discovery_booking_agent" in step for step in result["agent_trace"])

    def test_high_risk_runs_all_three_agents(self):
        result = invoke("high")
        trace = result["agent_trace"]
        assert any(step.startswith("disease_risk_prediction_agent") for step in trace)
        assert any(step.startswith("explainable_care_recommendation_agent") for step in trace)
        assert any(step.startswith("vet_discovery_booking_agent") for step in trace)

    def test_all_nodes_traced_in_order(self):
        trace = invoke("high")["agent_trace"]
        names = [step.split(":")[0] for step in trace]
        assert names == [
            "disease_risk_prediction_agent",
            "context_agent",
            "explainable_care_recommendation_agent",
            "vet_discovery_booking_agent",
            "response_composer",
        ]

    def test_agents_breakdown_present(self):
        result = invoke("high")
        agents = result.get("agents", [])
        assert len(agents) == 3
        assert agents[0]["status"] == "precomputed"  # /recommend path
        assert agents[2]["status"] in {"completed", "skipped"}

    def test_low_risk_marks_vet_agent_skipped(self):
        result = invoke("low")
        agents = result.get("agents", [])
        assert agents[2]["status"] == "skipped"


class TestNeedsVet:
    def test_medium_risk_routes_to_vet(self):
        assert nodes.needs_vet({"risk_level": "medium", "urgency_hours": None}) == "vet_discovery"

    def test_low_risk_with_urgent_hours_routes_to_vet(self):
        assert nodes.needs_vet({"risk_level": "low", "urgency_hours": 24}) == "vet_discovery"

    def test_low_risk_no_urgency_skips(self):
        assert nodes.needs_vet({"risk_level": "low", "urgency_hours": None}) == "response_composer"


class TestSafetyFloor:
    def test_high_risk_urgency_never_relaxed_above_24h(self):
        result = invoke("high")
        assert result["urgency_hours"] is not None
        assert result["urgency_hours"] <= 24


class TestSpecializationMapping:
    def test_skin_condition_maps_to_dermatology(self):
        spec_key, keywords = nodes._required_specialization({
            "predicted_diseases": [{"disease": "Skin Irritations", "probability": 0.8}],
            "urgency_hours": 48,
        })
        assert spec_key == "spec_dermatology"
        assert "dermatolog" in keywords

    def test_emergency_urgency_overrides_specialization(self):
        spec_key, _ = nodes._required_specialization({
            "predicted_diseases": [{"disease": "Skin Irritations", "probability": 0.8}],
            "urgency_hours": 8,
        })
        assert spec_key == "spec_emergency"

    def test_unknown_disease_no_specialization(self):
        spec_key, keywords = nodes._required_specialization({
            "predicted_diseases": [{"disease": "Ear Infections", "probability": 0.8}],
            "urgency_hours": None,
        })
        assert spec_key is None
        assert keywords == []

    def test_clinic_scoring_prefers_specialist(self):
        derm_clinic = {
            "specializations": ["Dermatology"],
            "surgeons": [{"specialization": "Dermatology", "availableSlots": [{"isBooked": False}]}],
        }
        general_clinic = {
            "specializations": ["General Practice"],
            "surgeons": [{"specialization": "General", "availableSlots": [{"isBooked": False}]}],
        }
        derm_hits, _ = nodes._clinic_score(derm_clinic, ["dermatolog"])
        general_hits, _ = nodes._clinic_score(general_clinic, ["dermatolog"])
        assert derm_hits > general_hits
