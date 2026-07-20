"""Bridge between the structured symptom form and the two ML models.

Shared by runtime prediction (predictor.py) and training augmentation
(training/train_condition_model.py) so the text distribution seen at
serve time matches what Model A was trained on.
"""
from __future__ import annotations

from app.schemas.prediction import SymptomPayload

# Frontend checklist ids -> human phrase (Model A text) / Model B vocab token
CHECKLIST_TOKENS: dict[str, str] = {
    "lethargy": "lethargy",
    "coughing": "coughing",
    "fever": "fever",
    "reduced-activity": "reduced activity",
    "stiff-gait": "lameness",
    "loss-of-appetite": "loss of appetite",
    "skin-irritation": "skin lesions",
    "breathing-difficulty": "difficulty breathing",
    "weight-loss": "weight loss",
    "swollen-abdomen": "swollen abdomen",
    "lump-swelling": "lump or swelling",
    "yellow-gums": "jaundice",
    "fainting": "fainting",
    # extra ids tolerated from older clients
    "ear-scratching": "ear scratching",
    "head-shaking": "head shaking",
}

SEVERITY_INDEX: dict[str, float] = {
    "none": 0.0,
    "normal": 0.0,
    "mild": 0.33,
    "once": 0.33,
    "reduced": 0.5,
    "increased": 0.5,
    "moderate": 0.66,
    "multiple": 0.66,
    "lethargic": 0.66,
    "severe": 1.0,
    "persistent": 1.0,
}

RISK_HIGH_THRESHOLD = 0.66
RISK_MEDIUM_THRESHOLD = 0.40

# Model B (danger model) was trained on data that is 97.7% "dangerous"
# (risk_metrics.json positive_rate=0.977, recall_not_dangerous=0.0), so its
# calibrated probability is inflated for weak evidence and the system almost
# never returned "low" risk (over-triage — see docs/ml/risk_calibration_experiment.json).
# A Bayesian prior-shift to a neutral deployment prior decompresses the
# probability while preserving its ranking. The 0.5 value was chosen from the
# calibration sensitivity analysis: it recovered ~59% "low" on benign cases
# while keeping ~99% of serious (chronic) cases at >= medium.
DANGER_TRAIN_PRIOR = 0.977
DANGER_DEPLOY_PRIOR = 0.5


def prior_correct(p_danger: float,
                  pi_deploy: float = DANGER_DEPLOY_PRIOR,
                  pi_train: float = DANGER_TRAIN_PRIOR) -> float:
    """Shift a probability from its training prior to a deployment prior.

    Standard base-rate correction for a classifier trained on an imbalanced
    set whose deployment prevalence differs. Ranking is preserved; only the
    absolute calibration changes. p in {0,1} is returned unchanged.
    """
    if p_danger <= 0.0 or p_danger >= 1.0:
        return p_danger
    a = pi_deploy / pi_train
    b = (1.0 - pi_deploy) / (1.0 - pi_train)
    num = p_danger * a
    return num / (num + (1.0 - p_danger) * b)


def _vital_phrases(p: SymptomPayload) -> list[str]:
    phrases: list[str] = []
    if p.appetite_level in {"reduced", "mild", "moderate"}:
        phrases.append("has a reduced appetite")
    elif p.appetite_level in {"none", "severe"}:
        phrases.append("refuses to eat")
    if p.water_intake in {"increased", "moderate", "severe"}:
        phrases.append("is drinking much more water than usual")
    elif p.water_intake in {"reduced", "mild"}:
        phrases.append("is drinking less water")
    if p.activity_level in {"lethargic", "moderate", "severe"}:
        phrases.append("is very lethargic and inactive")
    elif p.activity_level == "mild":
        phrases.append("is less active than normal")
    if p.urine_frequency in {"increased", "mild", "moderate", "severe"}:
        phrases.append("is urinating more frequently")
    if p.vomiting_frequency in {"once", "mild"}:
        phrases.append("vomited once")
    elif p.vomiting_frequency in {"multiple", "moderate"}:
        phrases.append("has vomited multiple times")
    elif p.vomiting_frequency in {"persistent", "severe"}:
        phrases.append("keeps vomiting persistently")
    if p.diarrhea_level in {"mild", "moderate"}:
        phrases.append("has diarrhea")
    elif p.diarrhea_level == "severe":
        phrases.append("has severe watery diarrhea")
    return phrases


def payload_to_text(p: SymptomPayload) -> str:
    """Render the structured payload into an owner-style sentence for Model A."""
    animal = p.species.lower() if p.species else "pet"
    if p.age_years is not None and p.age_years > 0:
        animal = f"{int(p.age_years)} year old {animal}"
    parts = _vital_phrases(p)
    checklist = [CHECKLIST_TOKENS[s] for s in p.symptoms if s in CHECKLIST_TOKENS]
    if checklist:
        parts.append("shows " + ", ".join(checklist))
    body = "; ".join(parts) if parts else "shows subtle behavior changes"
    text = f"My {animal} {body}. Symptoms present for {p.symptom_duration_days} days."
    if p.notes:
        text += f" {p.notes.strip()}"
    return text


def payload_to_tokens(p: SymptomPayload) -> list[str]:
    """Map checklist ids + abnormal vitals to Model B vocabulary tokens."""
    tokens = {CHECKLIST_TOKENS[s] for s in p.symptoms if s in CHECKLIST_TOKENS}
    # NOTE: "none" means opposite things per vital — no appetite (abnormal) vs no vomiting (normal)
    if p.appetite_level in {"reduced", "none", "mild", "moderate", "severe"}:
        tokens.add("loss of appetite")
    if p.vomiting_frequency not in {"none", "normal", ""}:
        tokens.add("vomiting")
    if p.diarrhea_level not in {"none", "normal", ""}:
        tokens.add("diarrhoea")
    if p.activity_level in {"lethargic", "mild", "moderate", "severe"}:
        tokens.add("lethargy")
    if p.urine_frequency in {"increased", "mild", "moderate", "severe"}:
        tokens.add("increased urination")
    if p.water_intake in {"increased", "moderate", "severe"}:
        tokens.add("increased thirst")
    return sorted(tokens)


def severity_index(p: SymptomPayload) -> float:
    """Deterministic 0..1 severity from the 5 vitals plus duration."""
    vitals = [
        p.appetite_level,
        p.water_intake,
        p.activity_level,
        p.urine_frequency,
        p.vomiting_frequency,
        p.diarrhea_level,
    ]
    scores = [SEVERITY_INDEX.get(v, 0.0) for v in vitals]
    vitals_score = sum(scores) / len(scores)
    duration_score = min(p.symptom_duration_days / 7.0, 1.0)
    return round(vitals_score * 0.7 + duration_score * 0.3, 4)


def derive_risk(p_danger: float, severity: float) -> tuple[str, float]:
    """Blend calibrated danger probability with deterministic severity."""
    score = 0.6 * p_danger + 0.4 * severity
    if score >= RISK_HIGH_THRESHOLD:
        level = "high"
    elif score >= RISK_MEDIUM_THRESHOLD:
        level = "medium"
    else:
        level = "low"
    return level, round(score, 4)
