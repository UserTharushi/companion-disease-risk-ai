"""LangGraph nodes — the three-agent pipeline:

1. disease_risk_prediction_agent   — calls the ML service (ai-service /predict) as its tool
2. explainable_care_recommendation_agent — LLM/rule reasoning + preventive care + explainability
3. vet_discovery_booking_agent     — specialization-aware clinic discovery & recommendation

plus context_agent (shared context gathering) and response_composer (final assembly).
Each node appends to agent_trace. LLM steps degrade to deterministic logic when
Gemini is unavailable (state.degraded flips to True)."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from app.agents import fallback, tools
from app.agents.state import AgentState
from app.core import llm
from app.core.i18n import LANGUAGE_NAMES, msg, normalize
from app.core.i18n import risk_word as i18n_risk_word
from app.core.names_i18n import localize_disease, localize_symptom, localize_vaccine

logger = logging.getLogger("agent-service.nodes")

VACCINE_DUE_SOON_DAYS = 14

AGENT1 = "disease_risk_prediction_agent"
AGENT2 = "explainable_care_recommendation_agent"
AGENT3 = "vet_discovery_booking_agent"

# Predicted disease -> (specialization key for i18n, match keywords in clinic/surgeon data)
SPECIALIZATION_MAP: dict[str, tuple[str, list[str]]] = {
    "skin irritations": ("spec_dermatology", ["dermatolog", "skin"]),
    "skin infection": ("spec_dermatology", ["dermatolog", "skin"]),
    "mobility problems": ("spec_orthopedics", ["orthopedic", "ortho"]),
    "digestive issues": ("spec_internal", ["internal", "gastro"]),
    "gastrointestinal disorder": ("spec_internal", ["internal", "gastro"]),
    "kidney disease": ("spec_internal", ["internal", "nephro"]),
    "chronic kidney disease": ("spec_internal", ["internal", "nephro"]),
    "liver disease": ("spec_internal", ["internal", "hepato", "gastro"]),
    "pancreatitis": ("spec_internal", ["internal", "gastro", "emergency"]),
    "heart disease": ("spec_cardiology", ["cardio", "internal"]),
    "cancer": ("spec_oncology", ["oncolog", "internal"]),
    "diabetes mellitus": ("spec_internal", ["internal", "endocrin"]),
    "respiratory infection": ("spec_internal", ["internal", "respirat"]),
    "kennel cough": ("spec_internal", ["internal", "respirat"]),
    "feline upper respiratory infection": ("spec_internal", ["internal", "respirat"]),
    "feline leukemia": ("spec_internal", ["internal", "oncolog"]),
    "parvovirus": ("spec_emergency", ["emergency", "critical"]),
    "distemper": ("spec_emergency", ["emergency", "critical"]),
}


def _trace(state: AgentState, message: str) -> list[str]:
    return [*state.get("agent_trace", []), message]


# ── Agent 1: Disease Risk Prediction Agent ────────────────────────

def _local_fallback_prediction(payload: dict) -> dict:
    """Minimal heuristic when the ML service is unreachable — mirrors the
    legacy ai-service rules so the pipeline never dies."""
    risk_level, confidence = "low", 0.62
    if payload.get("vomiting_frequency") in {"persistent", "multiple"} or payload.get("activity_level") == "lethargic":
        risk_level, confidence = "medium", 0.74
    if payload.get("symptom_duration_days", 1) >= 3 and payload.get("appetite_level") in {"reduced", "none"}:
        risk_level, confidence = "high", 0.86
    return {
        "risk_level": risk_level,
        "confidence_score": confidence,
        "risk_score": {"low": 0.25, "medium": 0.5, "high": 0.75}[risk_level],
        "predicted_diseases": [],
        "ontology_links": [],
        "top_features": [],
        "model_version": "agent-local-fallback",
        "id": None,
    }


def disease_risk_prediction_agent(state: AgentState) -> AgentState:
    """Receives structured symptom data and produces the disease/risk prediction.
    /analyze path: calls the FastAPI ML service as a tool.
    /recommend path: normalizes the precomputed prediction supplied by the caller."""
    payload = state.get("symptom_payload")

    if payload:
        prediction = tools.predict_via_ml(payload)
        if prediction is None:
            prediction = _local_fallback_prediction(payload)
            source = "ML service unreachable — local heuristic fallback"
            degraded = True
        else:
            source = f"ML model {prediction.get('model_version', 'v1')}"
            degraded = False
        update: AgentState = {
            "prediction": prediction,
            "risk_level": prediction.get("risk_level", "low"),
            "confidence_score": float(prediction.get("confidence_score", 0.5)),
            "predicted_diseases": prediction.get("predicted_diseases", []),
            "degraded": state.get("degraded", False) or degraded,
        }
        risk_for_trace = update["risk_level"]
    else:
        # Legacy /recommend: prediction fields already in state
        update = {
            "prediction": {
                "risk_level": state.get("risk_level"),
                "confidence_score": state.get("confidence_score"),
                "predicted_diseases": state.get("predicted_diseases", []),
                "model_version": "precomputed",
            },
        }
        source = "precomputed prediction from caller"
        risk_for_trace = state.get("risk_level", "low")

    top = update["prediction"].get("predicted_diseases") or []
    top_name = top[0].get("disease") if top else "n/a"
    update["agent_trace"] = _trace(
        state,
        f"{AGENT1}: risk={risk_for_trace} "
        f"({update['prediction'].get('confidence_score') or 0:.0%}), top={top_name} [{source}]",
    )
    return update


# ── context_agent (shared context for agents 2 & 3) ──────────────

def context_agent(state: AgentState) -> AgentState:
    pet = tools.get_pet(state["pet_id"])
    vaccinations = tools.get_vaccinations(state["pet_id"])
    tokens = tools.symptoms_to_tokens(state.get("symptoms", []))
    diseases = [d.get("disease", "") for d in state.get("predicted_diseases", [])]
    ontology = tools.ontology_context(tokens, diseases)

    parts = [
        f"pet profile {'loaded' if pet else 'unavailable'}",
        f"{len(vaccinations)} vaccination record(s)",
        f"{len(ontology['indicating'])} ontology link(s)",
    ]
    return {
        "pet_profile": pet,
        "vaccinations": vaccinations,
        "ontology": ontology,
        "agent_trace": _trace(state, f"context_agent: {', '.join(parts)}"),
    }


# ── Agent 2: Explainable Care Recommendation Agent ────────────────

def _rule_urgency(state: AgentState) -> dict:
    base = fallback.rule_based_recommendation(
        state.get("risk_level", "low"),
        state.get("confidence_score", 0.5),
        state.get("predicted_diseases", []),
        language=state.get("language", "en"),
    )
    return {
        "urgency_hours": base["urgency_hours"],
        "rationale": base["explanation"],
        "personalized_summary": "",
        "_degraded": True,
    }


def _confidence_interpretation(language: str, confidence: float) -> str:
    key = (
        "confidence_interp_high"
        if confidence >= 0.85
        else "confidence_interp_medium" if confidence >= 0.70 else "confidence_interp_low"
    )
    return msg(language, key, confidence=f"{confidence:.0%}")


def _top_feature_sentence(state: AgentState) -> str:
    """Explainability: surface the ML model's strongest signals."""
    lang = state.get("language", "en")
    features = (state.get("prediction") or {}).get("top_features") or []
    names = [f.get("feature", "") for f in features[:3] if f.get("feature")]
    if not names:
        # fall back to ontology links (symptom names, localized)
        links = (state.get("ontology") or {}).get("indicating", [])[:3]
        names = [localize_symptom(link["symptom"], lang) for link in links]
    if not names:
        return ""
    return msg(lang, "top_symptoms_prefix", features=", ".join(names))


def explainable_care_recommendation_agent(state: AgentState) -> AgentState:
    lang = state.get("language", "en")
    pet = state.get("pet_profile") or {}
    diseases = state.get("predicted_diseases", [])
    ontology = state.get("ontology", {})
    prediction = state.get("prediction") or {}

    # ── LLM reasoning (urgency + personalized explanation), rule fallback ──
    prompt = f"""You are a veterinary triage assistant inside a decision support app for pet owners.
This is guidance, NOT a diagnosis. Analyse the case and reply with ONLY a JSON object.

Case:
- Species: {pet.get('species', 'unknown')}, breed: {pet.get('breed', 'unknown')}, age: {pet.get('ageYears', 'unknown')} years
- ML risk level: {state.get('risk_level')} (confidence {state.get('confidence_score', 0):.0%})
- Predicted conditions: {json.dumps(diseases)}
- Symptoms most influencing the model: {json.dumps(prediction.get('top_features', [])[:5])}
- Owner-reported symptoms: {', '.join(state.get('symptoms', [])) or 'none listed'}
- Owner notes: {state.get('notes') or 'none'}
- Ontology symptom-disease links: {json.dumps(ontology.get('indicating', [])[:5])}
- Vaccination records on file: {len(state.get('vaccinations', []))}

IMPORTANT: write "rationale", "personalized_summary" and "image_findings" in {LANGUAGE_NAMES.get(normalize(state.get("language")), "English")} — the owner's preferred language. Keys and structure stay in English.

Reply JSON schema:
{{"urgency_hours": <int hours within which a vet should be seen, or null if home monitoring suffices>,
 "rationale": "<one sentence explaining WHY this urgency was assigned, referencing the influential symptoms>",
 "personalized_summary": "<2-3 friendly sentences for the owner about what the signs suggest and what to do, mentioning the pet's species>",
 "image_findings": <"one or two sentences describing clinically relevant findings visible in the attached photo (coat, skin, eyes, posture, discharge), or null if no photo/nothing notable">}}"""

    image_data_url = state.get("image_data_url")
    if image_data_url:
        prompt += (
            "\n\nA photo of the affected area/pet is attached. Describe what is visible "
            "and factor it into the urgency judgement. Do NOT diagnose from the image alone."
        )
        result = llm.invoke_json_multimodal(prompt, image_data_url, fallback=lambda: _rule_urgency(state))
    else:
        result = llm.invoke_json(prompt, fallback=lambda: _rule_urgency(state))
    degraded = bool(result.pop("_degraded", False)) if result else True
    if not result:
        result = _rule_urgency(state)
        degraded = True

    urgency = result.get("urgency_hours")
    if urgency is not None:
        try:
            urgency = max(1, min(int(urgency), 24 * 14))
        except (TypeError, ValueError):
            urgency = None
    # Safety floor: never let the LLM relax a high-risk case below rule urgency
    if state.get("risk_level") == "high" and (urgency is None or urgency > 24):
        urgency = 24

    # ── Preventive care: vaccination timeline analysis (deterministic) ──
    now = datetime.now(timezone.utc)
    soon = now + timedelta(days=VACCINE_DUE_SOON_DAYS)
    predicted_names = {d.get("disease", "").lower() for d in diseases}
    prevents_map: dict[str, list[str]] = {}
    for link in ontology.get("preventing_vaccines", []):
        prevents_map.setdefault(link["vaccine"].lower(), []).append(link["disease"])

    findings: list[dict] = []
    for record in state.get("vaccinations", []):
        due_raw = record.get("nextDueAt") or record.get("nextDueDate")
        if not due_raw:
            continue
        try:
            due = datetime.fromisoformat(str(due_raw).replace("Z", "+00:00"))
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        status = "overdue" if due < now else ("due_soon" if due <= soon else None)
        if status is None:
            continue
        vaccine_name = record.get("vaccineName", "Vaccine")
        linked = [
            disease
            for disease in prevents_map.get(vaccine_name.lower(), [])
            if disease.lower() in predicted_names
        ]
        findings.append({
            "vaccineName": vaccine_name,
            "status": status,
            "dueAt": due.isoformat(),
            "linked_diseases": linked,
        })

    # ── Explainability: confidence interpretation + most influential signals ──
    rationale = str(result.get("rationale", ""))
    explanation_extras = _confidence_interpretation(lang, state.get("confidence_score", 0.5))
    explanation_extras += _top_feature_sentence(state)

    trace = (
        f"{AGENT2}: urgency={urgency}h ({'rules' if degraded else 'LLM'}), "
        f"{len(findings)} vaccination finding(s)"
    )
    if any(f["linked_diseases"] for f in findings):
        trace += " — escalated (vaccine prevents a predicted condition)"

    image_findings = result.get("image_findings")
    if isinstance(image_findings, str):
        image_findings = image_findings.strip() or None
    else:
        image_findings = None
    if state.get("image_data_url"):
        trace += ", photo analysed" if image_findings else ", photo received"

    return {
        "urgency_hours": urgency,
        "urgency_rationale": (rationale + " " + explanation_extras).strip(),
        "personalized_summary": str(result.get("personalized_summary", "")),
        "image_findings": image_findings,
        "vaccination_findings": findings,
        "degraded": state.get("degraded", False) or degraded,
        "agent_trace": _trace(state, trace),
    }


# ── Agent 3: Veterinary Discovery & Booking Agent ─────────────────

def needs_vet(state: AgentState) -> str:
    urgency = state.get("urgency_hours")
    if state.get("risk_level") in {"medium", "high"} or (urgency is not None and urgency <= 48):
        return "vet_discovery"
    return "response_composer"


def _required_specialization(state: AgentState) -> tuple[str | None, list[str]]:
    """(i18n key, match keywords) for the top predicted disease; emergency overrides."""
    urgency = state.get("urgency_hours")
    if urgency is not None and urgency <= 12:
        return "spec_emergency", ["emergency", "critical"]
    diseases = state.get("predicted_diseases", [])
    if diseases:
        top = diseases[0].get("disease", "").lower()
        if top in SPECIALIZATION_MAP:
            return SPECIALIZATION_MAP[top]
    return None, []


def _clinic_score(clinic: dict, keywords: list[str]) -> tuple[int, bool]:
    """(specialization keyword hits, has a free slot)."""
    searchable = " ".join([
        *(clinic.get("specializations") or []),
        *(s.get("specialization", "") for s in clinic.get("surgeons") or []),
    ]).lower()
    spec_hits = sum(1 for kw in keywords if kw in searchable)
    has_slot = any(
        not (isinstance(slot, dict) and slot.get("isBooked"))
        for surgeon in clinic.get("surgeons") or []
        for slot in (surgeon.get("availableSlots") or [])
    )
    return spec_hits, has_slot


def _pick_surgeon(clinic: dict, keywords: list[str]) -> tuple[str | None, str | None]:
    """Prefer a surgeon matching the specialization, else the first with a free slot."""
    best: tuple[str | None, str | None] = (None, None)
    for surgeon in clinic.get("surgeons") or []:
        slots = [
            slot for slot in (surgeon.get("availableSlots") or [])
            if not (isinstance(slot, dict) and slot.get("isBooked"))
        ]
        if not slots:
            continue
        first = slots[0]
        slot_value = first.get("datetime") if isinstance(first, dict) else str(first)
        if keywords and any(kw in surgeon.get("specialization", "").lower() for kw in keywords):
            return surgeon.get("name"), slot_value
        if best == (None, None):
            best = (surgeon.get("name"), slot_value)
    return best


def vet_discovery_booking_agent(state: AgentState) -> AgentState:
    lang = state.get("language", "en")
    location = state.get("owner_location") or {}
    clinics = tools.find_clinics(location.get("lat"), location.get("lng"))

    spec_key, keywords = _required_specialization(state)
    scored = []
    for clinic in clinics:
        spec_hits, has_slot = _clinic_score(clinic, keywords)
        distance = clinic.get("distanceKm")
        is_external = bool(clinic.get("external"))
        scored.append((
            -(spec_hits * 2 + (1 if has_slot else 0)),
            1 if is_external else 0,  # bookable registry clinics outrank external listings
            distance if isinstance(distance, (int, float)) else float("inf"),
            spec_hits,
            clinic,
        ))
    scored.sort(key=lambda item: (item[0], item[1], item[2]))

    suggestions: list[dict] = []
    for rank, (_, _, _, spec_hits, clinic) in enumerate(scored[:3]):
        surgeon_name, next_slot = _pick_surgeon(clinic, keywords)
        recommended = rank == 0
        if recommended and spec_hits > 0 and spec_key:
            match_reason = msg(lang, "match_reason_spec", spec=msg(lang, spec_key))
        elif recommended:
            match_reason = msg(lang, "match_reason_general")
        else:
            match_reason = None
        suggestions.append({
            "id": clinic.get("id") or clinic.get("_id", ""),
            "name": clinic.get("name", "Clinic"),
            "address": clinic.get("address", ""),
            "distance_km": clinic.get("distanceKm"),
            "surgeon": surgeon_name,
            "next_slot": next_slot,
            "recommended": recommended,
            "match_reason": match_reason,
            "external": bool(clinic.get("external")),
        })

    spec_note = f", specialization={msg('en', spec_key)}" if spec_key else ""
    return {
        "clinic_suggestions": suggestions,
        "required_specialization": msg(lang, spec_key) if spec_key else None,
        "agent_trace": _trace(
            state,
            f"{AGENT3}: {len(suggestions)} clinic suggestion(s){spec_note}"
            + (" using owner location" if location else " (no location shared)"),
        ),
    }


# ── response_composer (final assembly) ────────────────────────────

def response_composer(state: AgentState) -> AgentState:
    recommendations: list[dict] = []
    urgency = state.get("urgency_hours")
    risk = state.get("risk_level", "low")
    lang = state.get("language", "en")
    risk_localized = i18n_risk_word(lang, risk)

    if risk in {"medium", "high"}:
        default_message = msg(lang, "composer_vet_message", risk=risk_localized)
        default_message += msg(lang, "composer_within_hours", hours=urgency) if urgency else "."
        recommendations.append({
            "type": "emergency" if (urgency is not None and urgency <= 12) else "vet_visit",
            "title": msg(lang, "composer_consult_title"),
            "message": state.get("personalized_summary") or default_message,
            "urgency_hours": urgency,
        })
    else:
        recommendations.append({
            "type": "home_monitoring",
            "title": msg(lang, "home_monitoring_title"),
            "message": state.get("personalized_summary") or msg(lang, "home_monitoring_message"),
        })

    for finding in state.get("vaccination_findings") or []:
        linked = finding.get("linked_diseases") or []
        status_localized = msg(lang, "vaccine_overdue" if finding["status"] == "overdue" else "vaccine_due_soon")
        vaccine_localized = localize_vaccine(finding["vaccineName"], lang)
        if linked:
            linked_localized = ", ".join(localize_disease(d, lang) for d in linked)
            message = msg(
                lang, "vaccine_linked_message",
                vaccine=vaccine_localized, status=status_localized, diseases=linked_localized,
            )
            rec_urgency = 48
        else:
            message = msg(
                lang, "vaccine_plain_message",
                vaccine=vaccine_localized, status=status_localized, date=finding["dueAt"][:10],
            )
            rec_urgency = None
        recommendations.append({
            "type": "vaccination",
            "title": f"{vaccine_localized} — {status_localized}",
            "message": message,
            "urgency_hours": rec_urgency,
        })

    explanation = state.get("urgency_rationale", "")
    if not explanation:
        explanation = msg(
            lang, "composer_explanation",
            risk=risk_localized, confidence=f"{state.get('confidence_score', 0):.0%}",
        )

    # Per-agent breakdown for the UI / viva demo
    prediction = state.get("prediction") or {}
    top = prediction.get("predicted_diseases") or []
    top_name = (top[0].get("disease_localized") or top[0].get("disease")) if top else "—"
    vet_ran = any(step.startswith(AGENT3) for step in state.get("agent_trace") or [])
    suggestions = state.get("clinic_suggestions") or []  # LangGraph inits unset channels to None
    recommended = next((s for s in suggestions if s.get("recommended")), None)
    agents_summary = [
        {
            "agent": msg(lang, "agent1_name"),
            "status": str(prediction.get("model_version") or "precomputed"),
            "summary": f"{risk_localized} · {state.get('confidence_score', 0):.0%} · {top_name}",
        },
        {
            "agent": msg(lang, "agent2_name"),
            "status": "rules" if state.get("degraded") else "llm",
            "summary": explanation[:160],
        },
        {
            "agent": msg(lang, "agent3_name"),
            "status": "completed" if vet_ran else "skipped",
            "summary": (recommended.get("name") if recommended else "—") if vet_ran else "—",
        },
    ]

    return {
        "recommendations": recommendations,
        "explanation": explanation,
        "degraded": state.get("degraded", False),
        "agents": agents_summary,
        "agent_trace": _trace(state, f"response_composer: {len(recommendations)} recommendation(s)"),
    }
