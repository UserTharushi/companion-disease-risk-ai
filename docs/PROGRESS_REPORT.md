# Interim Progress Report — Companion Disease Risk AI

**Project:** An Agentic AI-Driven Decision Support System for Early Disease Risk Detection in Companion Animals
**Milestone:** Second Progress Review (Interim)
**Status date:** July 2026

> This document is factual technical material for the interim report. Adapt the wording into your own voice; all figures below are measured from the running system, not estimates.

---

## 1. Overview & Objectives

The system helps pet owners (dogs/cats) get an **early, explainable risk assessment** from everyday symptoms, and routes them toward appropriate veterinary care. It is positioned as a **decision-support tool, not a diagnosis** (a disclaimer is shown on every result).

Objectives addressed so far:
1. Predict disease-risk level and likely conditions from structured symptom input (ML).
2. Explain *why* a prediction was made (ontology links + model feature attributions).
3. Layer **agentic AI** on top of the raw prediction to produce care recommendations, urgency, and clinic routing.
4. Close a **feedback / continuous-learning loop** (owner usefulness + vet-confirmed diagnosis + AI-vs-actual agreement).
5. Serve a trilingual (English / Sinhala / Tamil), mobile-first, installable interface.

---

## 2. System Architecture

Turborepo monorepo. The live application is a React (Vite + Tailwind) front-end monolith (`mfe-auth`) backed by Node.js and Python microservices behind an API gateway.

| Layer | Service (port) | Responsibility |
|---|---|---|
| Front-end | `mfe-auth` (3001) | Auth + owner/vet/admin dashboards + symptom/booking flows (PWA) |
| Gateway | `api-gateway` (4000) | JWT verification, rate limiting, identity-header stamping, proxying |
| Node | `auth-service` (4001) | Custom JWT + bcrypt; admin-provisioned vet accounts |
| Node | `pet-service` (4002) | Pet profiles (ownership-scoped) |
| Node | `clinic-service` (4003) | Clinics, surgeons, slots, appointments, nearby (haversine) |
| Node | `notification-service` (4004) | In-app notifications with dedupe idempotency |
| Node | `vaccination-service` (4005) | Vaccination records; due/overdue queries |
| Python | `ai-service` (8001) | scikit-learn inference, prediction persistence, Neo4j ontology |
| Python | `agent-service` (8002) | LangGraph agent pipeline + Gemini + autonomous monitoring |
| Data | Neo4j 5.18, MongoDB 7 | Ontology graph; predictions/feedback + domain data |

Security: gateway verifies the Bearer JWT, strips and re-stamps `x-user-id`/`x-user-role` from the verified token (prevents header spoofing), and enforcement is active (`AUTH_ENFORCE=true`).

---

## 3. Implemented Features (working end-to-end)

**Pet owner**
- Pet CRUD with photo; structured symptom report with clear per-field options (activity, appetite, water intake, urination, vomiting, diarrhoea, duration) + symptom checklist + optional photo.
- Real ML risk assessment with risk level, risk score, confidence, top predicted conditions.
- Explainability: ontology "why" links (symptom→disease) + model top-feature attributions.
- Agentic care recommendations, urgency window, and clinic suggestions.
- Gemini-backed AI health chat assistant (trilingual, multi-turn, graceful rule fallback).
- Prediction history + reopen a saved report ("view report").
- Nearby-clinic map (OpenStreetMap/Leaflet) + real clinic detail (specializations, hours, vets, bookable slots) + appointment booking.
- **Feedback:** rate an assessment helpful/not-helpful and whether it matched the vet's diagnosis.

**Veterinarian**
- Server-backed profile; appointments; owner⇄vet inquiries.
- Patient list with vaccination status and latest AI assessment.
- **Record confirmed diagnosis** against a patient's AI prediction (ground truth for the learning loop).

**Admin**
- Managed veterinarian provisioning; clinic management; appointments.
- AI model & ontology reference panel (live model metrics + ontology counts).
- **Prediction Feedback & Learning panel:** owner-helpful rate, diagnoses confirmed, and AI-vs-vet agreement rate.

**Cross-cutting:** trilingual EN/SI/TA throughout, installable PWA (mobile-first), autonomous monitoring agent (risk/vaccination alerts).

---

## 4. Machine Learning Methodology & Results

Two complementary models are blended with a deterministic severity index in a shared `feature_bridge` (the same form→text bridge is used at training-augmentation time and at serve time, closing the train/serve gap).

### Model A — Condition classifier
- **Pipeline:** TF-IDF (1–2 grams) + Logistic Regression (`class_weight="balanced"`).
- **Data:** HF `karenwky/pet-health-symptoms-dataset` (5 everyday conditions) + 500 template-augmented rows rendered through the runtime bridge + ~2,700 knowledge-grounded synthetic rows for 6 chronic diseases. Train/test = 4,160 / 1,040.
- **Classes (11):** Cancer, Chronic Kidney Disease, Diabetes Mellitus, Digestive Issues, Ear Infections, Heart Disease, Liver Disease, Mobility Problems, Pancreatitis, Parasites, Skin Irritations.
- **Results:** accuracy **0.903**, macro-F1 **0.908**.

### Model B — Danger probability
- **Pipeline:** MultiLabelBinarizer → `CalibratedClassifierCV(LogisticRegression balanced, sigmoid)` → P(dangerous).
- **Data:** Kaggle `willianoliveiragibin/animal-condition`. Train/test = 651 / 218.
- **Results:** ROC-AUC **0.964**, PR-AUC **0.999**.
- **Honest caveat:** the dataset is ~97% "dangerous", so balanced accuracy is ~0.50 and PR-AUC is inflated by prevalence. Model B is therefore used **only as a calibrated probability** (never a hard label), and is **prior-corrected** and blended with the severity index — this is a deliberate design choice discussed as a limitation, not a reported strength.

### Breed & weight
Breed and body weight are wired into the models (body-condition reasoning): e.g. an overweight senior dog with stiff gait biases toward Mobility Problems / metabolic risk. Verified behaviourally (overweight→Diabetes vs underweight→CKD).

### Blending
`risk_score = f(P(danger), severity_index)`; thresholds map to low / medium / high. Result carries model version + disclaimer.

---

## 5. Agentic AI Design (core novelty)

`agent-service` runs a **LangGraph** pipeline orchestrated by the graph itself (deterministic edges + conditional routing), not an if/else ladder:

1. **Disease Risk Prediction Agent** — calls `ai-service` as its tool (local heuristic fallback).
2. **context_loader** — pulls pet, vaccination, and ontology context.
3. **Explainable Care Recommendation Agent** — Gemini (`gemini-flash-latest`) for phrasing; deterministic preventive-care date math; escalates when a due vaccine *prevents* a predicted disease.
4. **Veterinary Discovery & Booking Agent** (conditional — only for medium/high or short urgency) — specialization-aware clinic ranking; marks one clinic recommended.
5. **response_composer** — assembles recommendations, urgency, clinic suggestions.

Every response carries an `agent_trace`, a per-agent breakdown, and a `degraded` flag. If Gemini is missing/rate-limited, the whole layer degrades to deterministic rules and the UI shows a "Rule-based mode" badge — so it never hard-fails.

**Autonomous monitoring agent (4th agent):** APScheduler background job scans pets, latest predictions, and due/overdue vaccinations, then creates idempotent risk/vaccination notifications (manual trigger `POST /monitor/run` for demos).

---

## 6. Feedback / Continuous-Learning Loop (core novelty)

Closes the gap between "a model that scored well offline" and "a system checked against reality":

- **Owner** rates each assessment (helpful / not-helpful) and whether it matched their vet's diagnosis.
- **Vet** records the **confirmed actual diagnosis** for the case.
- Both are stored on the prediction document, giving a clean **AI-prediction vs actual-diagnosis** join.
- **Admin/researcher** panel aggregates: owner-helpful rate, number of diagnoses confirmed, and **AI-vs-vet agreement rate** — a real-world accuracy signal distinct from offline test accuracy.

Verified end-to-end: owner prediction → vet diagnosis → admin agreement updates live.

---

## 7. Knowledge Ontology (Neo4j)

Applied automatically at `ai-service` startup (idempotent). Current graph: **20 diseases, 24 symptoms, 8 vaccines/preventives, 48 `INDICATES` edges, 12 `PREVENTS` edges**. Symptom node names are kept in exact sync with the model's checklist tokens and the front-end symptom ids. Drives the "why" explanation and the vaccine-prevents-disease escalation.

---

## 8. Verification & Testing

- Auth enforcement regression (spoofing prevented; role-scoped access).
- Full research loop verified via the gateway with real role tokens: owner prediction (medium risk, correct condition) → vet diagnosis → admin agreement 1/1.
- AI chat verified: real Gemini replies, trilingual output, multi-turn context, medically-appropriate urgency, graceful degradation.
- Front-end type-checks and production build pass; Python modules import-check clean.
- Validation artefacts for the thesis in `docs/ml/`: confusion matrix, distributional validation, knowledge-consistency check, calibration experiment, expert-review sample.

---

## 9. Novelty & Contribution

1. **Agentic** decision support (multi-agent LangGraph + autonomous monitoring) rather than a single prediction call.
2. **Explainability by construction** — ontology graph links *and* model feature attributions, not a black box.
3. A working **continuous-learning feedback loop** with an AI-vs-vet agreement metric.
4. **Trilingual, offline-tolerant** (rule fallback + PWA) design suited to the Sri Lankan context.
5. Knowledge-grounded handling of chronic diseases beyond the base datasets.

---

## 10. Limitations & Future Work (deliberately deferred)

- **Model B imbalance** (~97% positive) — mitigated via calibrated probability + severity blend; a better-balanced danger dataset is future work.
- Deferred to final submission: Google / MFA / biometric auth, a disease/vaccine database editor UI, ML-model upload/retrain UI, LangSmith observability, and full analytics/performance dashboards.
- Chat is a general assistant that *routes* to the structured assessment; it does not itself drive predictions from free text (deliberate, to keep the evaluable pipeline clean).
- FCM push is out of scope (in-app notifications only).

---

## 11. Live Demo Script (for the review)

1. **Login** as `demo.owner@petcare.ai` (password `Demo1234!`) — three seeded pets (Rex, Milo, Bella).
2. **Report Symptoms** for Rex (senior Labrador): lethargy, stiff gait, struggles with stairs → submit.
3. **Result:** medium risk, top condition *Mobility Problems*, with ontology "why" links, top-feature bar chart, and the disclaimer.
4. **AI Agent Guidance:** urgency window + care recommendations + a recommended clinic (specialization-aware).
5. **AI Chat tab:** ask a free-text question (e.g. "what vaccines does a kitten need?") — switch language to Sinhala/Tamil to show trilingual replies. Use the header button to hand off to the structured assessment.
6. **Give feedback** on the result (helpful + "matched vet's diagnosis").
7. **Login** as `demo.vet@petcare.ai` — open the patient, **record the confirmed diagnosis** (Mobility Problems).
8. **Login** as `demo.admin@petcare.ai` → **Governance** → AI model panel (live 0.90 accuracy) and the **Prediction Feedback & Learning** panel showing the AI-vs-vet agreement update.
9. (Optional) Trigger the monitoring agent (`POST /monitor/run`) to show autonomous risk/vaccination notifications.

*All demo credentials use password `Demo1234!`.*
