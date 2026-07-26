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
    "pale-gums": "pale gums",
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


def _vital_phrase_specs(p: SymptomPayload) -> list[tuple[str, str, str]]:
    """(rendered phrase, form field, value) for each abnormal vital.

    The field/value provenance lets `explain_sources` map the model's raw
    n-grams back onto the form controls the owner actually filled in, so the
    explanation reads "Water intake: reduced" instead of "less water".
    Keep the phrase strings byte-identical to what the models were trained on.
    """
    specs: list[tuple[str, str, str]] = []
    if p.appetite_level in {"reduced", "mild", "moderate"}:
        specs.append(("has a reduced appetite", "appetite", "reduced"))
    elif p.appetite_level in {"none", "severe"}:
        specs.append(("refuses to eat", "appetite", "none"))
    if p.water_intake in {"increased", "moderate", "severe"}:
        specs.append(("is drinking much more water than usual", "water_intake", "increased"))
    elif p.water_intake in {"reduced", "mild"}:
        specs.append(("is drinking less water", "water_intake", "reduced"))
    if p.activity_level in {"lethargic", "moderate", "severe"}:
        specs.append(("is very lethargic and inactive", "activity", "lethargic"))
    elif p.activity_level == "mild":
        specs.append(("is less active than normal", "activity", "reduced"))
    if p.urine_frequency in {"increased", "mild", "moderate", "severe"}:
        specs.append(("is urinating more frequently", "urination", "increased"))
    elif p.urine_frequency == "reduced":
        specs.append(("is urinating less and straining to pass urine", "urination", "reduced"))
    if p.vomiting_frequency in {"once", "mild"}:
        specs.append(("vomited once", "vomiting", "once"))
    elif p.vomiting_frequency in {"multiple", "moderate"}:
        specs.append(("has vomited multiple times", "vomiting", "multiple"))
    elif p.vomiting_frequency in {"persistent", "severe"}:
        specs.append(("keeps vomiting persistently", "vomiting", "persistent"))
    if p.diarrhea_level in {"mild", "moderate"}:
        specs.append(("has diarrhea", "diarrhea", "mild"))
    elif p.diarrhea_level == "severe":
        specs.append(("has severe watery diarrhea", "diarrhea", "severe"))
    return specs


def _vital_phrases(p: SymptomPayload) -> list[str]:
    return [phrase for phrase, _field, _value in _vital_phrase_specs(p)]


def explain_sources(p: SymptomPayload) -> list[tuple[str, str, str]]:
    """Every meaningful fragment of `payload_to_text`, with its form origin.

    Returned as (fragment, field, value). `predictor` assigns each model
    n-gram to the first fragment that contains it contiguously; n-grams that
    match nothing are template scaffolding ("my 4 year old labrador dog") or
    cross-phrase artifacts ("water is") and are dropped from the explanation.
    """
    sources: list[tuple[str, str, str]] = []
    condition = body_condition(p)
    if condition:
        sources.append((condition, "body_condition", condition))
    breed = (p.breed or "").strip()
    if breed:
        sources.append((breed.lower(), "breed", breed))
    sources.extend(_vital_phrase_specs(p))
    for symptom_id in p.symptoms:
        token = CHECKLIST_TOKENS.get(symptom_id)
        if token:
            sources.append((token, "symptom", symptom_id))
    sources.append((f"symptoms present for {p.symptom_duration_days} days",
                    "duration", str(p.symptom_duration_days)))
    if p.notes and p.notes.strip():
        sources.append((p.notes.strip().lower(), "notes", ""))
    return sources


# Coarse breed size classes -> ideal adult weight range (kg). Used to turn a
# raw weight into a body-condition word the model can learn from. Heuristic,
# documented as such; unknown breeds fall back to a medium dog / cat default.
_BREED_SIZE = {
    "chihuahua": "small", "pomeranian": "small", "shih tzu": "small", "beagle": "small",
    "dachshund": "small", "pug": "small", "yorkshire terrier": "small", "maltese": "small",
    "cocker spaniel": "medium", "bulldog": "medium", "border collie": "medium",
    "labrador": "large", "labrador retriever": "large", "golden retriever": "large",
    "german shepherd": "large", "rottweiler": "large", "doberman": "large", "boxer": "large",
    "great dane": "giant", "saint bernard": "giant", "mastiff": "giant",
}
_IDEAL_KG = {
    "cat": (3.0, 6.0), "small": (2.0, 10.0), "medium": (10.0, 25.0),
    "large": (25.0, 40.0), "giant": (40.0, 70.0),
}


def _size_class(p: SymptomPayload) -> str:
    if (p.species or "").lower() == "cat":
        return "cat"
    return _BREED_SIZE.get((p.breed or "").strip().lower(), "medium")


def ideal_weight_range(species: str, breed: str) -> tuple[float, float]:
    """Ideal adult weight (kg) for a species/breed — shared by the synthetic
    training generator so generated weights match serve-time thresholds."""
    if (species or "").lower() == "cat":
        return _IDEAL_KG["cat"]
    return _IDEAL_KG[_BREED_SIZE.get((breed or "").strip().lower(), "medium")]


def body_condition(p: SymptomPayload) -> str | None:
    """Underweight / overweight / None(ideal), from weight relative to breed size."""
    if not p.weight_kg or p.weight_kg <= 0:
        return None
    lo, hi = _IDEAL_KG[_size_class(p)]
    if p.weight_kg < lo * 0.85:
        return "underweight"
    if p.weight_kg > hi * 1.15:
        return "overweight"
    return None


def payload_to_text(p: SymptomPayload) -> str:
    """Render the structured payload into an owner-style sentence for Model A."""
    animal = p.species.lower() if p.species else "pet"
    breed = (p.breed or "").strip()
    if breed:
        animal = f"{breed} {animal}"
    if p.age_years is not None and p.age_years > 0:
        animal = f"{int(p.age_years)} year old {animal}"
    condition = body_condition(p)
    if condition:
        animal = f"{condition} {animal}"
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
