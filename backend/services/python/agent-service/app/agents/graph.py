"""LangGraph assembly — the three-agent pipeline:

START -> disease_risk_prediction_agent          (Agent 1: ML prediction via tool call)
      -> context_agent                          (shared context: pet, vaccinations, ontology)
      -> explainable_care_recommendation_agent   (Agent 2: reasoning + preventive care + explainability)
      -> [needs_vet?] -> vet_discovery_booking_agent (Agent 3: specialization-aware discovery)
                      \\-> response_composer -> END
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents import nodes
from app.agents.state import AgentState

_compiled = None


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("disease_risk_prediction_agent", nodes.disease_risk_prediction_agent)
    graph.add_node("context_agent", nodes.context_agent)
    graph.add_node("explainable_care_recommendation_agent", nodes.explainable_care_recommendation_agent)
    graph.add_node("vet_discovery_booking_agent", nodes.vet_discovery_booking_agent)
    graph.add_node("response_composer", nodes.response_composer)

    graph.set_entry_point("disease_risk_prediction_agent")
    graph.add_edge("disease_risk_prediction_agent", "context_agent")
    graph.add_edge("context_agent", "explainable_care_recommendation_agent")
    graph.add_conditional_edges(
        "explainable_care_recommendation_agent",
        nodes.needs_vet,
        {"vet_discovery": "vet_discovery_booking_agent", "response_composer": "response_composer"},
    )
    graph.add_edge("vet_discovery_booking_agent", "response_composer")
    graph.add_edge("response_composer", END)
    return graph.compile()


def get_graph():
    global _compiled
    if _compiled is None:
        _compiled = build_graph()
    return _compiled
