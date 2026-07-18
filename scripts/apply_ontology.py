"""Manually apply the Neo4j ontology schema (ai-service also does this on startup).

Usage (from repo root, with ai-service deps installed):
    python scripts/apply_ontology.py
Reads NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD / NEO4J_DATABASE from env or .env.
"""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend" / "services" / "python" / "ai-service"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(REPO_ROOT / ".env")

from app.services import ontology  # noqa: E402

if __name__ == "__main__":
    ok = ontology.apply_schema()
    if ok:
        summary = ontology.ontology_summary()
        print(
            f"Ontology applied: {len(summary['diseases'])} diseases, "
            f"{len(summary['symptoms'])} symptoms, {len(summary['vaccines'])} vaccines, "
            f"{summary['indicates_count']} INDICATES, {summary['prevents_count']} PREVENTS"
        )
    sys.exit(0 if ok else 1)
