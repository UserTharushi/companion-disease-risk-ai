"""Neo4j ontology access. Failure-tolerant: the service runs without Neo4j,
just without ontology enrichment."""
from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger("ai-service.ontology")

_driver = None
_available = False


def _get_driver():
    global _driver
    if _driver is None:
        from neo4j import GraphDatabase

        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USERNAME", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "your-neo4j-password")
        _driver = GraphDatabase.driver(uri, auth=(user, password))
    return _driver


def _database() -> str:
    return os.getenv("NEO4J_DATABASE", "neo4j")


def _schema_path() -> Optional[str]:
    """Locate ontology/neo4j/schema.cypher whether running from repo or Docker."""
    here = os.path.abspath(os.path.dirname(__file__))
    candidates = [
        os.path.join(here, "..", "..", "ontology", "schema.cypher"),  # baked into image
        os.path.join(here, "..", "..", "..", "..", "..", "..", "ontology", "neo4j", "schema.cypher"),  # repo layout
        os.getenv("ONTOLOGY_SCHEMA_PATH", ""),
    ]
    for cand in candidates:
        if cand and os.path.exists(os.path.abspath(cand)):
            return os.path.abspath(cand)
    return None


def apply_schema() -> bool:
    """Idempotently apply schema.cypher (constraints + MERGE seed). Never raises."""
    global _available
    path = _schema_path()
    if path is None:
        logger.warning("schema.cypher not found — skipping ontology apply")
        return False
    try:
        with open(path, "r", encoding="utf-8") as fh:
            # Drop comment lines BEFORE splitting on ';' — comments may contain semicolons
            source = "\n".join(
                line for line in fh.read().splitlines() if not line.strip().startswith("//")
            )
        statements = [s.strip() for s in source.split(";") if s.strip()]
        driver = _get_driver()
        with driver.session(database=_database()) as session:
            for stmt in statements:
                session.run(stmt)
        _available = True
        logger.info("Applied ontology schema (%d statements) from %s", len(statements), path)
        return True
    except Exception as ex:
        logger.warning("Neo4j unavailable, ontology enrichment disabled: %s", ex)
        _available = False
        return False


def is_available() -> bool:
    return _available


def diseases_for_symptoms(tokens: list[str]) -> list[dict]:
    """[{symptom, disease, weight}] for the given symptom tokens."""
    if not _available or not tokens:
        return []
    try:
        driver = _get_driver()
        with driver.session(database=_database()) as session:
            result = session.run(
                """
                MATCH (s:Symptom)-[r:INDICATES]->(d:Disease)
                WHERE toLower(s.name) IN $tokens
                RETURN s.name AS symptom, d.name AS disease, r.weight AS weight
                ORDER BY r.weight DESC
                """,
                tokens=[t.lower() for t in tokens],
            )
            return [
                {"symptom": rec["symptom"], "disease": rec["disease"], "weight": float(rec["weight"] or 0.5)}
                for rec in result
            ]
    except Exception as ex:
        logger.warning("Ontology query failed: %s", ex)
        return []


def vaccines_for_diseases(diseases: list[str]) -> list[dict]:
    """[{vaccine, disease}] preventive vaccines for the given diseases."""
    if not _available or not diseases:
        return []
    try:
        driver = _get_driver()
        with driver.session(database=_database()) as session:
            result = session.run(
                """
                MATCH (v:Vaccine)-[:PREVENTS]->(d:Disease)
                WHERE toLower(d.name) IN $names
                RETURN v.name AS vaccine, d.name AS disease
                """,
                names=[d.lower() for d in diseases],
            )
            return [{"vaccine": rec["vaccine"], "disease": rec["disease"]} for rec in result]
    except Exception as ex:
        logger.warning("Ontology query failed: %s", ex)
        return []


def ontology_summary() -> dict:
    if not _available:
        return {"available": False, "diseases": [], "symptoms": [], "vaccines": [], "indicates_count": 0, "prevents_count": 0}
    try:
        driver = _get_driver()
        with driver.session(database=_database()) as session:
            diseases = [r["n"] for r in session.run("MATCH (d:Disease) RETURN d.name AS n ORDER BY n")]
            symptoms = [r["n"] for r in session.run("MATCH (s:Symptom) RETURN s.name AS n ORDER BY n")]
            vaccines = [r["n"] for r in session.run("MATCH (v:Vaccine) RETURN v.name AS n ORDER BY n")]
            indicates = session.run("MATCH (:Symptom)-[r:INDICATES]->(:Disease) RETURN count(r) AS c").single()["c"]
            prevents = session.run("MATCH (:Vaccine)-[r:PREVENTS]->(:Disease) RETURN count(r) AS c").single()["c"]
        return {
            "available": True,
            "diseases": diseases,
            "symptoms": symptoms,
            "vaccines": vaccines,
            "indicates_count": indicates,
            "prevents_count": prevents,
        }
    except Exception as ex:
        logger.warning("Ontology summary failed: %s", ex)
        return {"available": False, "diseases": [], "symptoms": [], "vaccines": [], "indicates_count": 0, "prevents_count": 0}


def close() -> None:
    global _driver
    if _driver is not None:
        try:
            _driver.close()
        except Exception:
            pass
        _driver = None
