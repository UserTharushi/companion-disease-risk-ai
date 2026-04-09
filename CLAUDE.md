# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Companion Disease Risk AI — an agentic AI-driven decision support system for companion animal (dogs/cats) early disease risk awareness. Monorepo with React micro-frontends, Node.js microservices, Python ML/agent services, and a Neo4j ontology graph.

## Commands

```bash
# Install all dependencies (Node workspaces)
npm install

# Run all services in dev mode (via Turborepo)
npm run dev

# Build all packages/apps
npm run build

# Lint / type-check / test across all workspaces
npm run lint
npm run type-check
npm run test

# Run a single workspace script
npx turbo run dev --filter=@companion-ai/mfe-auth
npx turbo run build --filter=@companion-ai/api-gateway

# Start full stack with Docker (includes Neo4j + MongoDB)
docker compose up --build

# Python services (inside their directory)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001   # ai-service
uvicorn app.main:app --reload --port 8002   # agent-service
```

## Architecture

### Frontend — Vite + React micro-frontends (Module Federation)
- `apps/mfe-auth` (port 3001) — auth flows, onboarding, role-based dashboards (owner/vet/admin). Uses Firebase Auth, Zustand, react-hook-form + zod, PWA-enabled via vite-plugin-pwa.
- `apps/mfe-pet-profile` — pet CRUD and detail views
- `apps/mfe-risk-results` — risk prediction display and history
- `apps/mfe-symptom-checker`, `mfe-vet-discovery`, `mfe-vaccination`, `mfe-admin` — domain-specific UIs
- Shared libs: `react`, `react-dom`, `react-router-dom`, `zustand` are federated shared dependencies
- Styling: Tailwind CSS (configured in mfe-auth; other MFEs will follow)

### Backend — Node.js microservices (Express + TypeScript)
All under `backend/services/nodejs/`, each with its own `package.json`, `Dockerfile`, and `tsx watch` dev script:
- `api-gateway` (port 4000) — reverse proxy with rate limiting, helmet, CORS
- `auth-service` (port 4001) — authentication (Firebase + JWT)
- `pet-service` (port 4002) — pet profiles (MongoDB via Mongoose)
- `clinic-service` (port 4003) — clinic/surgeon lookup, appointment booking
- `notification-service` (port 4004) — push notifications (FCM)
- `vaccination-service` (port 4005) — vaccination records

### Backend — Python services (FastAPI)
- `ai-service` (port 8001) — ML inference via scikit-learn + Vertex AI, reads Neo4j ontology
- `agent-service` (port 8002) — agentic recommendations via LangChain + LangGraph

### Shared packages
- `packages/shared-types` — canonical TypeScript interfaces (User, Pet, SymptomInput, RiskPrediction, VaccinationRecord, VetClinic, Appointment, etc.). All services should import from `@companion-ai/shared-types`.
- `packages/shared-utils` — shared utility functions

### Ontology — Neo4j
- Schema: `ontology/neo4j/schema.cypher` — nodes: Pet, Disease, Symptom, Vaccine, Clinic, Surgeon. Key relationship: `(Symptom)-[:INDICATES {weight}]->(Disease)`, `(Vaccine)-[:PREVENTS]->(Disease)`
- Seed data mounted at `/var/lib/neo4j/import` in Docker

### Infrastructure
- GCP Cloud Run deployment, Cloud Build CI (`infra/gcp/cloudbuild.yaml`)
- Docker images pushed to `asia-southeast1-docker.pkg.dev`
- Firebase for auth + Firestore

## Key Conventions

- Workspace packages use `@companion-ai/` npm scope
- Node.js services use `tsx watch` for dev, `tsc` for build
- TypeScript strict mode enabled (`tsconfig.base.json` at root)
- Three user roles: `owner`, `vet`, `admin` — role-based routing in mfe-auth
- Risk levels: `low`, `medium`, `high` with confidence scores 0–1
- Frontend env vars prefixed with `VITE_`
