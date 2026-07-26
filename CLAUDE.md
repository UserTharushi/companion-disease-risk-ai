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

See `docs/VERIFICATION.md` for the full end-to-end verification flow, `docs/ml/README.md` for model/dataset details, and `docs/PROGRESS_REPORT.md` for the current feature inventory, measured results, and stated limitations (the most up-to-date narrative of what actually works).

## Architecture

### Frontend — Vite + React

**`apps/mfe-auth` (port 3001) is the entire live front end.** Despite the name and the Module Federation scaffolding, it grew into the application monolith: auth flows, onboarding, all three role dashboards (owner/vet/admin), the symptom flow, results + explainability, clinic map and booking, AI chat, notifications, and the shadcn-style UI kit in `src/components/ui/`. Build features here.

The other MFEs (`mfe-pet-profile` 3002, `mfe-symptom-checker` 3003, `mfe-risk-results` 3004, `mfe-vet-discovery` 3005, `mfe-vaccination` 3006, `mfe-admin` 3007) and `apps/shell` (3000, the Module Federation host, remotes map in `apps/shell/vite.config.ts`) are **empty scaffolds — roughly 6–7 placeholder files each versus ~65 in mfe-auth**. Don't assume a feature lives in the MFE its name suggests; it doesn't.

- Stack: Zustand, react-hook-form + zod, Tailwind CSS, Leaflet/OpenStreetMap for the clinic map, PWA via vite-plugin-pwa. Firebase config exists for the client only — server-side auth is the custom JWT service.
- Trilingual EN/SI/TA throughout (`src/lib/language.ts`, `i18n-dashboard.ts`); backend display names carry `name_si`/`name_ta` (ontology nodes, `names_i18n.py` in both Python services).
- Shared libs `react`, `react-dom`, `react-router-dom`, `zustand` are declared federated shared deps — inert while the shell is unused.

### Backend — Node.js microservices (Express + TypeScript)
All under `backend/services/nodejs/`, each with its own `package.json`, `Dockerfile`, and `tsx watch` dev script:
- `api-gateway` (port 4000) — reverse proxy with rate limiting, helmet, CORS. Verifies JWTs (`src/middleware/auth.ts`) and stamps `x-user-id`/`x-user-role` headers onto proxied requests; enforcement gated by `AUTH_ENFORCE` env flag (default false in dev). Also rewrites `/api/predictions→/predictions`, `/api/ontology`, `/api/model`, `/api/agent` for the Python services.
- `auth-service` (port 4001) — custom JWT + bcrypt auth (NOT Firebase server-side; Firebase config exists only for the client). JWT payload: `{uid, role}` with roles owner/vet/admin. Veterinarian accounts are **admin-provisioned only** (register with role veterinarian requires an admin Bearer token; self-registration returns 403). Admin-created vets get `mustChangePassword: true` — login returns the flag, the frontend forces `/auth/change-password` (POST `/api/auth/change-password`), and credentials are delivered via notification-service `/send` (email simulation).
- `pet-service` (port 4002) — pet profiles (Mongoose). Ownership enforced from identity headers: owners only see/modify their own pets. **Vets see only pets they hold an active access grant for** (see Relationship-based access below) — both on the list and on `GET /pets/:id`.
- `clinic-service` (port 4003) — clinics/surgeons/slots/appointments with booking conflict checks and `GET /api/clinics/nearby?lat=&lng=` (haversine, merged with live OpenStreetMap POIs). Clinic/surgeon/slot writes require vet/admin role. Also owns `PetAccessGrant` and `/api/access-grants`. Demo clinic seeding is **opt-in** via `SEED_DEMO_DATA=true` (off by default — the seeded rows are invented). A `Surgeon` may carry `userId` linking the clinic listing to a veterinarian's auth account.
- `notification-service` (port 4004) — Mongo-persisted in-app notifications with `dedupeKey` idempotency, list/mark-read endpoints; legacy `/send` alias kept for auth-service password resets. No FCM.
- `vaccination-service` (port 4005) — Mongoose-persisted vaccination records; `GET /due?withinDays=` (service-key guarded, used by the monitoring agent) and `/overdue/:petId`.
- `admin-service` (port 4006) — platform administration: registration approvals, support tickets, and an **append-only** audit trail (`/api/approvals`, `/api/tickets`, `/api/audit`). Reads/decisions are admin-only; ticket and approval *creation* is open to any authenticated user so owners/clinics can submit. There is deliberately no update or delete route for audit entries.

### Relationship-based access control

A veterinarian may read a pet's health information **only while an active `PetAccessGrant` links them to that pet**. Grants come from two sources:

- `appointment` — created automatically in `grantAccessForAppointment()` when an owner books a slot with a surgeon whose `userId` is linked to a vet account. Survives the visit, giving continuity of care for returning patients.
- `owner_consent` — created and revoked by the owner from the pet profile ("Who can see these records").

Revoking sets `revokedAt` rather than deleting, so access history stays auditable. Enforcement is in the **services, not the UI**: `pet-service` and `ai-service` both call `/api/access-grants` (service-key guarded) before releasing data, and both **fail closed** — an unreachable grant registry denies access rather than exposing every record. `POST /predictions/{id}/diagnosis` requires a grant and attributes the diagnosis to the gateway-verified `x-user-id`, never a query parameter.

Deleting a vet account or revoking access never destroys research data: vet diagnoses are stored as text on the prediction document and `feedback_summary()` joins on that text, not on `vet_id`.

### Backend — Python services (FastAPI, Python 3.11)
- `ai-service` (port 8001) — real scikit-learn inference: **Model A** (TF-IDF 1–2gram + balanced LogReg, text→**11 conditions**; measured accuracy 0.903 / macro-F1 0.908, see `app/models/condition_metrics.json`) + **Model B** (calibrated P(dangerous)), blended with a deterministic severity index in `app/services/feature_bridge.py` (the load-bearing form→model bridge; its checklist tokens must stay in sync with the frontend symptom ids and Neo4j symptom names). Persists predictions to Mongo (`/predictions/history`), auto-applies the Neo4j ontology schema at startup (no manual browser step), exposes `/model/info` and `/ontology/summary`. Committed artifacts in `app/models/`; training scripts in `training/`.
  - Model A's 6 knowledge-grounded chronic classes (Cancer, CKD, Diabetes, Heart, Liver, Pancreatitis) score ~1.0 because their rows are synthetic; the 5 real-dataset classes (Skin Irritations, Digestive Issues, Parasites, Ear Infections, Mobility Problems) sit at 0.77–0.87 F1 and confuse with each other. Quote the per-class numbers, not just the headline accuracy.
  - Model B's training set is ~97% "dangerous", so it is used **only as a prior-corrected calibrated probability, never a hard label**. This is a deliberate, documented limitation — don't "fix" it by thresholding into a label.
  - **Feedback / continuous-learning loop** lives here: `POST /predictions/{id}/feedback` (owner helpful + matched-vet flags), `POST /predictions/{id}/diagnosis` (vet-confirmed ground truth), `GET /predictions/feedback/summary` (admin panel: owner-helpful rate, diagnoses confirmed, AI-vs-vet agreement rate). Both records land on the prediction document, giving a clean prediction-vs-actual join.
- `agent-service` (port 8002) — LangGraph three-agent pipeline (`app/agents/graph.py`), orchestrated by the graph itself (deterministic edges + `needs_vet` conditional routing): **Disease Risk Prediction Agent** (calls ai-service `/predict` as its tool; local heuristic fallback) → context_loader → **Explainable Care Recommendation Agent** (Gemini via `GOOGLE_API_KEY` with rule fallback; vaccination preventive-care analysis; explainability = confidence interpretation + top influential symptoms) → conditional **Veterinary Discovery & Booking Agent** (specialization-aware clinic ranking via `SPECIALIZATION_MAP`, marks one clinic `recommended`) → response_composer. `POST /analyze` runs the full pipeline from raw symptoms (frontend's primary path); `POST /recommend` is the legacy precomputed-prediction path; `POST /chat` is the trilingual multi-turn health assistant (Gemini, rule fallback) which *routes* users to the structured assessment rather than predicting from free text — keep it that way so the evaluable pipeline stays clean. Every response carries `agent_trace`, per-agent `agents` breakdown, and `degraded`. Also hosts the autonomous monitoring agent (4th, background agent — APScheduler, `MONITOR_INTERVAL_MINUTES`) with manual trigger `POST /monitor/run` — scans pets, creates risk/vaccination notifications idempotently (dedupeKey per day). NOTE: LangGraph initializes unset state channels to `None` — always use `state.get(key) or default` for list/dict state keys.

### Shared packages
- `packages/shared-types` — canonical TypeScript interfaces (User, Pet, SymptomInput, RiskPrediction, VaccinationRecord, VetClinic, Appointment, etc.). All services should import from `@companion-ai/shared-types`.
- `packages/shared-utils` — shared utility functions

### Ontology — Neo4j
- Schema: `ontology/neo4j/schema.cypher` — **20 diseases** (incl. the 5 dataset condition classes), **24 symptoms**, **8 vaccines/preventives**, **48 `INDICATES`** and **12 `PREVENTS`** edges. Key relationships: `(Symptom)-[:INDICATES {weight}]->(Disease)`, `(Vaccine)-[:PREVENTS]->(Disease)`. Every node carries trilingual `name_si`/`name_ta`. Drives the "why" explanation and the vaccine-prevents-a-predicted-disease escalation.
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
- The decision-support disclaimer (NFR1) must appear on every prediction result (`apps/mfe-auth/src/components/Disclaimer.tsx`). This is a diagnosis-adjacent system — never present output as a diagnosis anywhere in UI copy, agent phrasing, or docs.
- Any user-facing string needs all three of EN/SI/TA; any new disease/symptom node needs `name_si`/`name_ta`
- **One symptom vocabulary, three places** — frontend symptom ids, `ai-service feature_bridge.payload_to_tokens`, `agent-service app/agents/tools.py CHECKLIST_TOKENS`, and the lowercase Neo4j `Symptom` names must all agree. Changing one alone silently degrades predictions rather than erroring.
- Key env flags: `GOOGLE_API_KEY` (empty ⇒ agents degrade to rules), `AUTH_ENFORCE` (false ⇒ gateway decodes but doesn't reject), `SERVICE_KEY` (service-to-service header), `MONITOR_INTERVAL_MINUTES`
