from typing import Optional, TypedDict


class AgentState(TypedDict, total=False):
    # ── input ──
    pet_id: str
    risk_level: str
    confidence_score: float
    predicted_diseases: list[dict]  # [{disease, probability}]
    symptoms: list[str]
    notes: str
    owner_location: Optional[dict]  # {lat, lng}
    prediction_id: Optional[str]
    language: str  # en | si | ta
    symptom_payload: Optional[dict]  # raw structured symptoms (/analyze path only)
    image_data_url: Optional[str]  # symptom photo for multimodal analysis

    # ── agent 1 output ──
    prediction: dict  # full ML prediction (risk, diseases, top_features, ontology_links, id)

    # ── gathered context ──
    pet_profile: dict
    vaccinations: list[dict]
    ontology: dict  # {indicating: [{symptom, disease, weight}], preventing_vaccines: [{vaccine, disease}]}

    # ── reasoning products ──
    urgency_hours: Optional[int]
    urgency_rationale: str
    personalized_summary: str
    image_findings: Optional[str]
    vaccination_findings: list[dict]  # [{vaccineName, status, dueAt, linked_disease?}]
    clinic_suggestions: list[dict]
    required_specialization: Optional[str]

    # ── output ──
    recommendations: list[dict]  # [{type, title, message, urgency_hours}]
    explanation: str
    agent_trace: list[str]
    degraded: bool
    agents: list[dict]  # per-agent breakdown for the UI
