from app.schemas.prediction import SymptomPayload
from app.services import feature_bridge


def make_payload(**overrides) -> SymptomPayload:
    base = {
        "pet_id": "p1",
        "species": "dog",
        "appetite_level": "normal",
        "water_intake": "normal",
        "activity_level": "normal",
        "urine_frequency": "normal",
        "vomiting_frequency": "none",
        "diarrhea_level": "none",
        "symptoms": [],
        "notes": "",
        "symptom_duration_days": 1,
    }
    base.update(overrides)
    return SymptomPayload(**base)


class TestPayloadToText:
    def test_healthy_payload_mentions_species_and_duration(self):
        text = feature_bridge.payload_to_text(make_payload(species="cat", symptom_duration_days=3))
        assert "cat" in text
        assert "3 days" in text

    def test_symptoms_and_notes_are_rendered(self):
        text = feature_bridge.payload_to_text(
            make_payload(symptoms=["skin-irritation"], notes="red patches on belly")
        )
        assert "skin lesions" in text
        assert "red patches on belly" in text

    def test_vomiting_severity_phrasing(self):
        assert "persistently" in feature_bridge.payload_to_text(make_payload(vomiting_frequency="persistent"))
        assert "vomited once" in feature_bridge.payload_to_text(make_payload(vomiting_frequency="once"))


class TestPayloadToTokens:
    def test_checklist_ids_map_to_vocab_tokens(self):
        tokens = feature_bridge.payload_to_tokens(
            make_payload(symptoms=["stiff-gait", "loss-of-appetite", "breathing-difficulty"])
        )
        assert "lameness" in tokens
        assert "loss of appetite" in tokens
        assert "difficulty breathing" in tokens

    def test_abnormal_vitals_add_tokens(self):
        tokens = feature_bridge.payload_to_tokens(
            make_payload(vomiting_frequency="multiple", diarrhea_level="moderate", appetite_level="reduced")
        )
        assert "vomiting" in tokens
        assert "diarrhoea" in tokens
        assert "loss of appetite" in tokens

    def test_healthy_payload_has_no_tokens(self):
        assert feature_bridge.payload_to_tokens(make_payload()) == []

    def test_unknown_symptom_ids_are_ignored(self):
        tokens = feature_bridge.payload_to_tokens(make_payload(symptoms=["not-a-real-id"]))
        assert tokens == []


class TestSeverityIndex:
    def test_healthy_is_low(self):
        assert feature_bridge.severity_index(make_payload()) < 0.1

    def test_severe_case_is_high(self):
        severity = feature_bridge.severity_index(
            make_payload(
                appetite_level="none",
                activity_level="lethargic",
                vomiting_frequency="persistent",
                diarrhea_level="severe",
                symptom_duration_days=7,
            )
        )
        assert severity > 0.6

    def test_duration_is_capped_at_seven_days(self):
        week = feature_bridge.severity_index(make_payload(symptom_duration_days=7))
        month = feature_bridge.severity_index(make_payload(symptom_duration_days=30))
        assert week == month


class TestDeriveRisk:
    def test_thresholds(self):
        assert feature_bridge.derive_risk(1.0, 1.0)[0] == "high"
        assert feature_bridge.derive_risk(0.5, 0.5)[0] == "medium"
        assert feature_bridge.derive_risk(0.1, 0.1)[0] == "low"

    def test_boundary_values(self):
        # score = 0.6*p + 0.4*s ; exactly at thresholds
        level_high, score_high = feature_bridge.derive_risk(0.66, 0.66)
        assert score_high >= feature_bridge.RISK_HIGH_THRESHOLD
        assert level_high == "high"
        level_medium, _ = feature_bridge.derive_risk(0.40, 0.40)
        assert level_medium == "medium"

    def test_score_blend_weights(self):
        _, score = feature_bridge.derive_risk(1.0, 0.0)
        assert score == 0.6
        _, score = feature_bridge.derive_risk(0.0, 1.0)
        assert score == 0.4
