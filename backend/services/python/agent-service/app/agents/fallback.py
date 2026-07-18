"""Deterministic rule-based recommendations — the pre-agentic logic, kept as
the degradation path when the LLM is unavailable and as the safety net when
the graph itself fails. All owner-facing text is localized via core.i18n."""
from __future__ import annotations

from app.core.i18n import msg, risk_word
from app.core.names_i18n import localize_disease


def rule_based_recommendation(
    risk_level: str,
    confidence_score: float,
    predicted_diseases: list[dict],
    language: str = "en",
) -> dict:
    confidence_category = "low"
    if confidence_score >= 0.85:
        confidence_category = "high"
    elif confidence_score >= 0.70:
        confidence_category = "medium"

    top = sorted(predicted_diseases, key=lambda d: d.get("probability", 0), reverse=True)[:2]
    disease_str = ", ".join(
        f"{localize_disease(d.get('disease', ''), language)} ({d.get('probability', 0):.0%})" for d in top
    )

    recommendations: list[dict] = []
    urgency_hours = None

    if risk_level == "high":
        urgency_hours = 24 if confidence_category != "high" else 12
        message = msg(language, "vet_visit_within", hours=urgency_hours)
        if disease_str:
            message += msg(language, "high_risk_conditions", diseases=disease_str)
        recommendations.append({
            "type": "vet_visit" if confidence_category != "high" else "emergency",
            "title": msg(language, "vet_visit_title"),
            "message": message,
            "urgency_hours": urgency_hours,
        })
        recommendations.append({
            "type": "home_monitoring",
            "title": msg(language, "until_visit_title"),
            "message": msg(language, "until_visit_message"),
        })
    elif risk_level == "medium":
        urgency_hours = 48
        message = msg(language, "schedule_consult_message")
        if disease_str:
            message += msg(language, "likely_conditions", diseases=disease_str)
        recommendations.append({
            "type": "vet_visit",
            "title": msg(language, "schedule_consult_title"),
            "message": message,
            "urgency_hours": 48,
        })
        recommendations.append({
            "type": "home_monitoring",
            "title": msg(language, "monitor_vitals_title"),
            "message": msg(language, "monitor_vitals_message"),
        })
    else:
        recommendations.append({
            "type": "home_monitoring",
            "title": msg(language, "home_monitoring_title"),
            "message": msg(language, "home_monitoring_message"),
        })

    explanation = msg(
        language,
        "fallback_explanation",
        risk=risk_word(language, risk_level),
        confidence_category=confidence_category,
        confidence=f"{confidence_score:.0%}",
    )
    if disease_str:
        explanation += msg(language, "top_conditions_suffix", diseases=disease_str)

    return {
        "recommendations": recommendations,
        "urgency_hours": urgency_hours,
        "explanation": explanation,
        "degraded": True,
    }
