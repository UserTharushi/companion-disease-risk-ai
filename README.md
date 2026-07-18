# Companion Disease Risk AI

Monorepo workspace scaffold for an Agentic AI-driven decision support system for companion animal early disease risk awareness.

## Architecture

- Frontend: React + Tailwind + Module Federation micro-frontends + PWA (mobile/web compatible)
- Backend (Node.js): Microservices (`api-gateway`, `auth-service`, `pet-service`, `clinic-service`, `notification-service`, `vaccination-service`)
- Backend (Python FastAPI): `ai-service` (ML inference), `agent-service` (agentic recommendations)
- Agentic stack: LangChain, LangGraph, LangSmith
- Ontology graph: Neo4j (`ontology/neo4j/schema.cypher`)
- Data (OLTP): MongoDB Atlas + Firebase/Firestore
- Cloud: GCP (Cloud Run + Vertex AI + Cloud Build) + Firebase

## Monorepo Layout

```text
apps/
	shell/
	mfe-auth/
	mfe-pet-profile/
	mfe-symptom-checker/
	mfe-risk-results/
	mfe-vet-discovery/
	mfe-vaccination/
	mfe-admin/

backend/
	services/
		nodejs/
			api-gateway/
			auth-service/
			pet-service/
			clinic-service/
			notification-service/
			vaccination-service/
		python/
			ai-service/
			agent-service/

packages/
	shared-types/
	shared-utils/

ontology/
	neo4j/

infra/
	gcp/
	firebase/
```

## Quick Start

1. Copy env file:

```bash
cp .env.example .env
```

2. Install Node dependencies:

```bash
npm install
```

3. Start all local containers (including Neo4j and local Mongo for development):

```bash
docker compose up --build
```

4. Apply Neo4j ontology schema from `ontology/neo4j/schema.cypher`.

## Notes

- The Neo4j ontology schema is applied automatically by ai-service on startup; a manual runner exists at `scripts/apply_ontology.py`.
- Set `GOOGLE_API_KEY` in `.env` (aistudio.google.com) to enable Gemini-powered agent reasoning; without it the agentic layer runs in deterministic rule-based mode.
- ML model artifacts are committed under `backend/services/python/ai-service/app/models/`; regenerate them with the scripts in `backend/services/python/ai-service/training/` (Python 3.11).
- The primary user-facing app is `apps/mfe-auth` (port 3001) — auth, all three role dashboards, symptom→prediction→booking flows. The shell + other MFEs are scaffold.
- Verification guide: `docs/VERIFICATION.md`. ML/dataset documentation: `docs/ml/README.md`.