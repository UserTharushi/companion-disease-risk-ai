# Verification Guide

How to verify each part of the system, from unit tests to the full end-to-end demo flow.

## 1. Unit tests

### Python (ai-service, agent-service)

Both suites run against Python 3.11 (matching the Docker images). On a machine with
only Python 3.13, run them in a container:

```bash
# ai-service (19 tests: feature bridge mappings, /predict with models + fallback, history)
docker run --rm -v "%CD%:/repo" python:3.11-slim bash -lc \
  "pip install -q fastapi==0.111.0 pydantic==2.7.4 numpy==1.26.4 pandas==2.2.2 scikit-learn==1.5.0 pymongo==4.8.0 neo4j==5.22.0 pytest httpx && cd /repo/backend/services/python/ai-service && python -m pytest tests/ -q"

# agent-service (15 tests: rule ladder, degraded /recommend, graph routing, safety floor)
docker run --rm -v "%CD%:/repo" python:3.11-slim bash -lc \
  "cd /repo/backend/services/python/agent-service && pip install -q -r requirements.txt -r requirements-dev.txt && python -m pytest tests/ -q"
```

### Node (api-gateway)

```bash
cd backend/services/nodejs/api-gateway
npx vitest run        # 7 tests: JWT verify, public allowlist, enforce on/off, header injection
```

### Builds

```bash
npm run build         # turbo: all MFEs + services compile and emit dist/
npx tsc --noEmit      # (inside apps/mfe-auth) frontend type-check
```

## 2. ML training pipeline (regenerate artifacts)

Model artifacts (`app/models/*.joblib` + metrics JSONs) are committed. To regenerate:

```bash
cd backend/services/python/ai-service
pip install -r requirements.txt -r training/requirements-train.txt
python training/download_datasets.py       # HF + Kaggle -> data/raw/
python training/train_condition_model.py   # Model A -> condition_model.joblib + metrics + confusion matrix PNG
python training/train_risk_model.py        # Model B -> risk_model.joblib + metrics
```

Expected metrics (see `docs/ml/README.md`): Model A accuracy ≈ 0.90 / macro-F1 ≈ 0.91
over 11 classes. Quote the per-class split, not just the headline: the 6 knowledge-grounded
chronic classes score F1 0.97–1.00 because their rows are synthetic, while the 5
real-dataset classes sit at F1 0.77–0.87 and confuse with each other.
Model B ROC-AUC ≈ 0.96 (probability-only use — see imbalance caveat).

## 3. Full-stack smoke test (Docker Compose)

```bash
cp .env.example .env          # set GOOGLE_API_KEY for LLM mode (optional)
docker compose up --build -d
```

Wait for containers, then verify service health:

```bash
curl http://localhost:4000/health          # gateway
curl http://localhost:8001/health          # ai-service (also auto-applies Neo4j ontology on startup)
curl http://localhost:8002/health          # agent-service
curl http://localhost:4000/api/ontology/summary   # should list diseases/symptoms/vaccines once neo4j is up
curl http://localhost:4000/api/model/info         # both models loaded: true
```

### API-level end-to-end

```bash
# 1. Register + login (grab .data.token)
curl -X POST localhost:4000/api/auth/register -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Passw0rd!","displayName":"Demo","role":"pet-owner"}'

# 2. Create a pet (grab .data.id)
curl -X POST localhost:4000/api/pets -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" \
  -d '{"ownerId":"<UID>","name":"Buddy","species":"dog","breed":"Beagle","ageYears":4,"weightKg":12,"sex":"male"}'

# 3. Predict (real ML)
curl -X POST localhost:4000/api/predict -H "Content-Type: application/json" \
  -d '{"pet_id":"<PET_ID>","owner_id":"<UID>","species":"dog","appetite_level":"none","water_intake":"normal","activity_level":"lethargic","urine_frequency":"normal","vomiting_frequency":"persistent","diarrhea_level":"moderate","symptoms":["lethargy","loss-of-appetite"],"notes":"","symptom_duration_days":4}'
# expect: risk_level medium, Pancreatitis top (~0.74), ontology_links populated, id set
# Pancreatitis outranking Digestive Issues here is expected, not a regression: persistent
# vomiting + anorexia is a defensible differential and the urgency recommendation is
# identical. See the acute-overlap note in docs/ml/README.md.

# 4. Three-agent pipeline in one call (frontend's primary path)
curl -X POST localhost:4000/api/agent/analyze -H "Content-Type: application/json" \
  -d '{"pet_id":"<PET_ID>","species":"dog","appetite_level":"none","activity_level":"lethargic","vomiting_frequency":"persistent","diarrhea_level":"moderate","symptoms":["lethargy","loss-of-appetite"],"symptom_duration_days":4,"language":"en","owner_location":{"lat":6.9271,"lng":79.8612}}'
# expect: prediction (Agent 1 calls the ML service), agents[] breakdown of all three agents,
# agent_trace showing disease_risk_prediction_agent -> explainable_care_recommendation_agent
# -> vet_discovery_booking_agent, required_specialization, one clinic marked recommended:true

# 4b. Legacy: agent recommendations from a precomputed prediction
curl -X POST localhost:4000/api/agent/recommend -H "Content-Type: application/json" \
  -d '{"pet_id":"<PET_ID>","risk_level":"high","confidence_score":0.9,"predicted_diseases":[{"disease":"Digestive Issues","probability":0.8}],"symptoms":["vomiting"],"owner_location":{"lat":6.9271,"lng":79.8612}}'

# 5. Vaccination record (persists across restarts now)
curl -X POST localhost:4000/api/vaccinations -H "Content-Type: application/json" \
  -d '{"petId":"<PET_ID>","ownerId":"<UID>","vaccineName":"DHPP Vaccine","administeredAt":"2026-01-01T00:00:00Z","nextDueAt":"2026-07-01T00:00:00Z"}'

# 6. Autonomous monitoring (FR4.3/4.4/5.3 demo)
curl -X POST localhost:8002/monitor/run
# expect: pets_scanned >= 1, notifications_created >= 1 (overdue DHPP + recent high risk)
curl -X POST localhost:8002/monitor/run
# expect: notifications_created: 0 (dedupe — idempotent per day)

# 7. Notifications
curl "localhost:4000/api/notifications?userId=<UID>"

# 8. Location-based clinics
curl "localhost:4000/api/clinics/nearby?lat=6.9271&lng=79.8612"
# expect clinics sorted by distanceKm
```

### Browser flow

1. `http://localhost:3001` → register as pet owner → login.
2. Add a pet → open it → **Report Symptoms** → set vitals + tick symptoms + duration → Analyze.
   - DevTools Network tab: `POST /api/predict` (real model, not localStorage).
3. Prediction Result page: risk badge + score meter, predicted conditions with probabilities,
   ontology "Why" links, **AI Agent Guidance** section (urgency, recommendations, clinic
   suggestions, "How the AI decided" trace), decision-support disclaimer.
4. Pet profile → Vaccination History → **+ Add Record** → save → survives service restart.
5. `curl -X POST localhost:8002/monitor/run` → bell icon in the dashboard header shows
   the auto-generated risk/vaccination alerts (60s poll or reopen).
6. Clinics tab → allow location → clinics sorted with "x.x km away".
7. Book an appointment; confirm slot conflict handling by rebooking the same slot.

## 4. Auth enforcement pass (AUTH_ENFORCE=true)

Set `AUTH_ENFORCE=true` in `.env`, restart the gateway, then:

```bash
curl localhost:4000/api/pets                        # 401
curl -H "Authorization: Bearer <TOKEN>" localhost:4000/api/pets   # 200, only own pets
```

- Owners cannot read/modify other owners' pets, appointments, or vaccinations
  (identity headers are stamped from the verified JWT at the gateway).
- Clinic/surgeon/slot writes need a vet/admin token.
- Note: pets created pre-auth under `owner-local-*` ids will 403 for the real logged-in
  owner — recreate demo data after logging in.

## 5. LLM mode

Set `GOOGLE_API_KEY` (aistudio.google.com) in `.env`, restart agent-service. `/recommend`
now returns `degraded: false` with a personalized summary and rationale from Gemini.
Without the key (or on rate limits/timeouts), everything still works in rule-based mode —
the UI shows a "Rule-based mode" badge.

## 6. Trilingual output (EN / සිංහල / தமிழ்)

The UI follows the language switcher (persisted per browser and synced to the user's
profile on login/change). Backend agent output is localized too:

- `/recommend` accepts `"language": "en"|"si"|"ta"` (the frontend sends it automatically).
  Gemini is instructed to reply in that language; the rule-based fallback uses trilingual
  templates (`agent-service app/core/i18n.py`).
- The monitoring agent looks up each owner's `preferredLanguage` via
  `GET /api/auth/users/:uid/language` (service-key guarded) and writes notifications in it.
- Ontology entity names (diseases, symptoms, vaccines) are trilingual: Neo4j nodes carry
  `name_si`/`name_ta` properties, `/predict` returns `disease_localized` /
  `symptom_localized` display fields alongside canonical English names (which ML classes
  and ontology matching still use), `/predictions/history` and `/ontology/summary` accept
  `?language=`, and agent messages/notifications localize names via
  `names_i18n.py` (mirrored in both Python services — keep in sync).

Verify:

```bash
# Sinhala recommendation through the gateway
curl -s -X POST localhost:4000/api/agent/recommend -H "Content-Type: application/json" \
  -d '{"pet_id":"p1","risk_level":"high","confidence_score":0.9,"predicted_diseases":[{"disease":"Digestive Issues","probability":0.8}],"symptoms":["vomiting"],"language":"si"}'
# expect recommendations[].title/message in Sinhala script

# Monitoring notifications: PATCH /api/auth/profile {"preferredLanguage":"si"} for a user,
# add an overdue vaccination for their pet, POST :8002/monitor/run, then
# GET /api/notifications?userId=<uid> — titles/bodies arrive in Sinhala.
```
