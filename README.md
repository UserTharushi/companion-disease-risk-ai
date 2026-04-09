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

- This is a scaffolded workspace layout intended for iterative Agile sprint development.
- Frontend micro-frontends are route-ready with placeholder pages.
- Service endpoints are scaffolded and ready for feature implementation.