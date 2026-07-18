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

# Python services (inside their directory) — pinned to Python 3.11 (Docker image version)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001   # ai-service
uvicorn app.main:app --reload --port 8002   # agent-service

# Python tests (per service; use a python:3.11 container if local Python differs)
pip install -r requirements-dev.txt && python -m pytest tests/ -q

# Gateway tests
cd backend/services/nodejs/api-gateway && npx vitest run

# ML training pipeline (regenerates committed model artifacts in app/models/)
cd backend/services/python/ai-service
pip install -r requirements.txt -r training/requirements-train.txt
python training/download_datasets.py && python training/train_condition_model.py && python training/train_risk_model.py
```

See `docs/VERIFICATION.md` for the full end-to-end verification flow and `docs/ml/README.md` for model/dataset details.

## Architecture

### Frontend — Vite + React micro-frontends (Module Federation)
- `apps/shell` (port 3000) — Module Federation host; consumes each MFE's `remoteEntry.js` from ports 3001–3007 (see remotes map in `apps/shell/vite.config.ts`)
- `apps/mfe-auth` (port 3001) — auth flows, onboarding, role-based dashboards (owner/vet/admin). Uses Firebase Auth, Zustand, react-hook-form + zod, PWA-enabled via vite-plugin-pwa.
- `apps/mfe-pet-profile` (3002) — pet CRUD and detail views
- `apps/mfe-symptom-checker` (3003), `mfe-risk-results` (3004) — symptom input and risk prediction display/history
- `apps/mfe-vet-discovery` (3005), `mfe-vaccination` (3006), `mfe-admin` (3007) — domain-specific UIs
- MFEs must be built/served so their `remoteEntry.js` is available before the shell can load them
- Shared libs: `react`, `react-dom`, `react-router-dom`, `zustand` are federated shared dependencies
- Styling: Tailwind CSS (configured in mfe-auth; other MFEs will follow)

### Backend — Node.js microservices (Express + TypeScript)
All under `backend/services/nodejs/`, each with its own `package.json`, `Dockerfile`, and `tsx watch` dev script:
- `api-gateway` (port 4000) — reverse proxy with rate limiting, helmet, CORS. Verifies JWTs (`src/middleware/auth.ts`) and stamps `x-user-id`/`x-user-role` headers onto proxied requests; enforcement gated by `AUTH_ENFORCE` env flag (default false in dev). Also rewrites `/api/predictions→/predictions`, `/api/ontology`, `/api/model`, `/api/agent` for the Python services.
- `auth-service` (port 4001) — custom JWT + bcrypt auth (NOT Firebase server-side; Firebase config exists only for the client). JWT payload: `{uid, role}` with roles owner/vet/admin. Veterinarian accounts are **admin-provisioned only** (register with role veterinarian requires an admin Bearer token; self-registration returns 403). Admin-created vets get `mustChangePassword: true` — login returns the flag, the frontend forces `/auth/change-password` (POST `/api/auth/change-password`), and credentials are delivered via notification-service `/send` (email simulation).
- `pet-service` (port 4002) — pet profiles (Mongoose). Ownership enforced from identity headers: owners only see/modify their own pets.
- `clinic-service` (port 4003) — clinics/surgeons/slots/appointments with booking conflict checks, auto-seeded demo data, and `GET /api/clinics/nearby?lat=&lng=` (haversine distance sort). Clinic/surgeon/slot writes require vet/admin role.
- `notification-service` (port 4004) — Mongo-persisted in-app notifications with `dedupeKey` idempotency, list/mark-read endpoints; legacy `/send` alias kept for auth-service password resets. No FCM.
- `vaccination-service` (port 4005) — Mongoose-persisted vaccination records; `GET /due?withinDays=` (service-key guarded, used by the monitoring agent) and `/overdue/:petId`.

### Backend — Python services (FastAPI, Python 3.11)
- `ai-service` (port 8001) — real scikit-learn inference: Model A (TF-IDF+LogReg text→5 conditions) + Model B (calibrated danger probability), blended with a deterministic severity index in `app/services/feature_bridge.py` (the load-bearing form→model bridge; its checklist tokens must stay in sync with the frontend symptom ids and Neo4j symptom names). Persists predictions to Mongo (`/predictions/history`), auto-applies the Neo4j ontology schema at startup (no manual browser step), exposes `/model/info` and `/ontology/summary`. Committed artifacts in `app/models/`; training scripts in `training/`.
- `agent-service` (port 8002) — LangGraph three-agent pipeline (`app/agents/graph.py`), orchestrated by the graph itself (deterministic edges + `needs_vet` conditional routing): **Disease Risk Prediction Agent** (calls ai-service `/predict` as its tool; local heuristic fallback) → context_loader → **Explainable Care Recommendation Agent** (Gemini via `GOOGLE_API_KEY` with rule fallback; vaccination preventive-care analysis; explainability = confidence interpretation + top influential symptoms) → conditional **Veterinary Discovery & Booking Agent** (specialization-aware clinic ranking via `SPECIALIZATION_MAP`, marks one clinic `recommended`) → response_composer. `POST /analyze` runs the full pipeline from raw symptoms (frontend's primary path); `POST /recommend` is the legacy precomputed-prediction path. Every response carries `agent_trace`, per-agent `agents` breakdown, and `degraded`. Also hosts the autonomous monitoring agent (4th, background agent — APScheduler, `MONITOR_INTERVAL_MINUTES`) with manual trigger `POST /monitor/run` — scans pets, creates risk/vaccination notifications idempotently (dedupeKey per day). NOTE: LangGraph initializes unset state channels to `None` — always use `state.get(key) or default` for list/dict state keys.

### Shared packages
- `packages/shared-types` — canonical TypeScript interfaces (User, Pet, SymptomInput, RiskPrediction, VaccinationRecord, VetClinic, Appointment, etc.). All services should import from `@companion-ai/shared-types`.
- `packages/shared-utils` — shared utility functions

### Ontology — Neo4j
- Schema: `ontology/neo4j/schema.cypher` — 16 diseases (incl. the 5 dataset condition classes), 20 symptoms, 8 vaccines/preventives. Key relationships: `(Symptom)-[:INDICATES {weight}]->(Disease)`, `(Vaccine)-[:PREVENTS]->(Disease)`
- Applied AUTOMATICALLY by ai-service at startup (`app/services/ontology.py`, idempotent); manual runner: `python scripts/apply_ontology.py`. Community edition — use the default `neo4j` database only.
- Symptom node names are lowercase and MUST match the tokens produced by `feature_bridge.payload_to_tokens` and `agent-service app/agents/tools.py CHECKLIST_TOKENS`.

### Infrastructure
- GCP Cloud Run deployment, Cloud Build CI (`infra/gcp/cloudbuild.yaml`)
- Docker images pushed to `asia-southeast1-docker.pkg.dev`
- Firebase for auth + Firestore

## Key Conventions

- Workspace packages use `@companion-ai/` npm scope
- Node.js services use `tsx watch` for dev, `tsc` for build. Service tsconfigs override the base's `noEmit: true` — don't remove those overrides or Docker builds ship empty images.
- TypeScript strict mode enabled (`tsconfig.base.json` at root)
- Three user roles: `owner`, `vet`, `admin` (UI uses `pet-owner`/`veterinarian`/`admin`; auth-service normalizes)
- Risk levels: `low`, `medium`, `high` with confidence scores 0–1; UI maps medium→"moderate"
- Frontend env vars prefixed with `VITE_`; frontends call everything through the gateway (:4000) with `Authorization: Bearer <jwt>`
- The decision-support disclaimer (NFR1) must appear on every prediction result (`components/Disclaimer.tsx`)
- Key env flags: `GOOGLE_API_KEY` (empty ⇒ agents degrade to rules), `AUTH_ENFORCE` (false ⇒ gateway decodes but doesn't reject), `SERVICE_KEY` (service-to-service header), `MONITOR_INTERVAL_MINUTES`
