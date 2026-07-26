"""Core prediction logic: Model A (condition classifier) + Model B (risk model)
blended with a deterministic severity index. Rule-based fallback when
artifacts are missing — never raises."""
from __future__ import annotations

import logging
import re

import numpy as np

from app.schemas.prediction import (
    DiseaseRisk,
    OntologyLink,
    PredictionResponse,
    SymptomPayload,
    TopFeature,
)
from app.services import feature_bridge, model_store, names_i18n, ontology

logger = logging.getLogger("ai-service.predictor")

MODEL_VERSION = "v1"
TOP_N_DISEASES = 3


# sklearn's default token_pattern — reproduced so an n-gram can be matched
# against a source fragment using exactly the tokens the vectorizer produced.
_TOKEN_RE = re.compile(r"(?u)\b\w\w+\b")


def _tokens(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def _contains(haystack: list[str], needle: list[str]) -> bool:
    """True if `needle` appears as a contiguous run inside `haystack`."""
    span = len(needle)
    if not span or span > len(haystack):
        return False
    return any(haystack[i:i + span] == needle for i in range(len(haystack) - span + 1))


def _attribute(contributions: list[tuple[str, float]],
               payload: SymptomPayload) -> list[TopFeature]:
    """Fold raw n-grams back onto the form fields that produced them.

    TF-IDF turns one rendered phrase into several overlapping n-grams
    ("less", "drinking less", "less water" all come from "is drinking less
    water"). Listing them separately makes a single answer look like several
    independent findings and fills the chart with template connectives. Since
    the classifier is linear, a phrase's true contribution to the log-odds is
    the sum of its n-grams' contributions, so aggregate by source and keep the
    strongest n-gram as the representative.
    """
    sources = [(field, value, _tokens(fragment))
               for fragment, field, value in feature_bridge.explain_sources(payload)]

    totals: dict[tuple[str, str], float] = {}
    representative: dict[tuple[str, str], tuple[str, float]] = {}
    for name, weight in contributions:
        ngram = _tokens(name)
        for field, value, fragment_tokens in sources:
            if not _contains(fragment_tokens, ngram):
                continue
            key = (field, value)
            totals[key] = totals.get(key, 0.0) + weight
            best = representative.get(key)
            if best is None or abs(weight) > abs(best[1]):
                representative[key] = (name, weight)
            break  # first matching source owns the n-gram

    ranked = sorted(totals.items(), key=lambda kv: abs(kv[1]), reverse=True)[:5]
    return [
        TopFeature(
            feature=representative[key][0],
            weight=round(total, 4),
            field=key[0],
            value=key[1],
        )
        for key, total in ranked
    ]


def reattribute_stored(top_features: list[dict], payload_dict: dict | None) -> list[dict]:
    """Re-derive field/value for predictions saved before attribution existed.

    Older rows stored only the raw n-gram and its weight, so history renders
    them as "less" / "has" / "water is". The originating payload was persisted
    alongside, so the predict-time mapping can simply be replayed over those
    n-grams. Returns an empty list when nothing maps — showing no explanation
    beats showing sentence fragments.
    """
    if not top_features:
        return top_features
    if all(feature.get("field") for feature in top_features):
        return top_features
    if not payload_dict:
        return []
    try:
        payload = SymptomPayload(**payload_dict)
    except Exception as ex:
        logger.debug("Could not replay attribution for stored prediction: %s", ex)
        return []
    contributions = [
        (str(feature.get("feature", "")), float(feature.get("weight", 0.0)))
        for feature in top_features
    ]
    return [feature.model_dump() for feature in _attribute(contributions, payload)]


def _predict_conditions(text: str,
                        payload: SymptomPayload | None = None,
                        ) -> tuple[list[DiseaseRisk], list[TopFeature], float]:
    """Model A: returns (top-N diseases, top contributing features, top prob).

    `payload` is optional so the offline expert-review tooling can still call
    this with text alone; without it the raw n-grams are returned unaggregated.
    """
    model = model_store.get_condition_model()
    if model is None:
        return [], [], 0.0
    probs = model.predict_proba([text])[0]
    classes = model.classes_
    order = np.argsort(probs)[::-1][:TOP_N_DISEASES]
    diseases = [DiseaseRisk(disease=str(classes[i]), probability=round(float(probs[i]), 4)) for i in order]

    top_features: list[TopFeature] = []
    try:
        vectorizer = model.named_steps["tfidf"]
        clf = model.named_steps["clf"]
        vec = vectorizer.transform([text])
        class_idx = int(order[0])
        coefs = clf.coef_[class_idx] if clf.coef_.shape[0] > 1 else clf.coef_[0]
        nz = vec.nonzero()[1]
        contributions = [(vectorizer.get_feature_names_out()[j], float(coefs[j] * vec[0, j])) for j in nz]
        contributions.sort(key=lambda t: abs(t[1]), reverse=True)
        if payload is not None:
            top_features = _attribute(contributions, payload)
        else:
            top_features = [TopFeature(feature=name, weight=round(w, 4)) for name, w in contributions[:5]]
    except Exception as ex:
        logger.debug("Feature attribution skipped: %s", ex)

    top_prob = float(probs[order[0]]) if len(order) else 0.0
    return diseases, top_features, top_prob


def _predict_danger(tokens: list[str]) -> float | None:
    """Model B: calibrated P(dangerous) from symptom tokens, or None if unavailable."""
    artifact = model_store.get_risk_artifact()
    if artifact is None:
        return None
    try:
        binarizer = artifact["binarizer"]
        model = artifact["model"]
        X = binarizer.transform([tokens])
        proba = model.predict_proba(X)[0]
        classes = list(model.classes_)
        return float(proba[classes.index(1)]) if 1 in classes else float(proba[-1])
    except Exception as ex:
        logger.warning("Risk model inference failed: %s", ex)
        return None


def _rule_fallback(payload: SymptomPayload) -> tuple[str, float]:
    """Legacy heuristics (previous router behavior) when models are missing."""
    risk_level, confidence = "low", 0.62
    if payload.vomiting_frequency in {"persistent", "multiple"} or payload.activity_level == "lethargic":
        risk_level, confidence = "medium", 0.74
    if payload.symptom_duration_days >= 3 and payload.appetite_level in {"reduced", "none"}:
        risk_level, confidence = "high", 0.86
    return risk_level, confidence


def _keyword_disease_guess(tokens: list[str]) -> list[DiseaseRisk]:
    """Crude disease guess for fallback mode, aligned with the 5 dataset conditions."""
    rules = [
        ("skin lesions", "Skin Irritations", 0.6),
        ("ear scratching", "Ear Infections", 0.6),
        ("head shaking", "Ear Infections", 0.55),
        ("vomiting", "Digestive Issues", 0.6),
        ("diarrhoea", "Digestive Issues", 0.65),
        ("loss of appetite", "Digestive Issues", 0.45),
        ("lameness", "Mobility Problems", 0.6),
        ("reduced activity", "Mobility Problems", 0.4),
        ("lethargy", "Parasites", 0.35),
    ]
    scores: dict[str, float] = {}
    for token, disease, weight in rules:
        if token in tokens:
            scores[disease] = max(scores.get(disease, 0.0), weight)
    if not scores:
        scores = {"Digestive Issues": 0.34, "Parasites": 0.33, "Skin Irritations": 0.33}
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:TOP_N_DISEASES]
    return [DiseaseRisk(disease=d, probability=round(p, 4)) for d, p in ranked]


def predict(payload: SymptomPayload) -> PredictionResponse:
    text = feature_bridge.payload_to_text(payload)
    tokens = feature_bridge.payload_to_tokens(payload)
    severity = feature_bridge.severity_index(payload)

    diseases, top_features, condition_prob = _predict_conditions(text, payload)
    # With zero abnormal signals the model has no evidence — its intercept alone
    # would still lean "dangerous" (the dataset is ~97% dangerous), so short it to 0.
    if not tokens and model_store.get_risk_artifact() is not None:
        p_danger: float | None = 0.0
    else:
        p_danger = _predict_danger(tokens)

    if p_danger is not None:
        # Correct Model B's imbalance-inflated probability before blending
        # (fixes systematic over-triage; see feature_bridge.prior_correct).
        p_danger = feature_bridge.prior_correct(p_danger)
        risk_level, risk_score = feature_bridge.derive_risk(p_danger, severity)
        confidence = round(max(condition_prob, p_danger), 4) if condition_prob else round(p_danger, 4)
        model_version = MODEL_VERSION
    else:
        risk_level, confidence = _rule_fallback(payload)
        _, risk_score = feature_bridge.derive_risk(
            {"low": 0.2, "medium": 0.5, "high": 0.8}[risk_level], severity
        )
        model_version = "rule-fallback"

    if not diseases:
        diseases = _keyword_disease_guess(tokens)

    # Localized display names (canonical English stays in `disease`/`symptom`)
    for item in diseases:
        item.disease_localized = names_i18n.localize_disease(item.disease, payload.language)

    links = ontology.diseases_for_symptoms(tokens)
    ontology_links = [
        OntologyLink(
            **link,
            symptom_localized=names_i18n.localize_symptom(link["symptom"], payload.language),
            disease_localized=names_i18n.localize_disease(link["disease"], payload.language),
        )
        for link in links[:8]
    ]

    return PredictionResponse(
        risk_level=risk_level,
        confidence_score=round(confidence, 4),
        risk_score=risk_score,
        predicted_diseases=diseases,
        ontology_links=ontology_links,
        top_features=top_features,
        model_version=model_version,
    )
