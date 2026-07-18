# Requirements — Companion Disease Risk AI

Derived from the approved FYP proposal: **"An Agentic AI-Driven Decision Support System for Early Disease Risk Detection in Companion Animals"** (MTE Ranasinghe, D/BIT/23/0025, KDU Faculty of Computing, IT42999).

## 1. Project Overview

Companion animals (dogs and cats) develop chronic and life-threatening diseases gradually, with subtle or non-specific early symptoms. Owners often miss early warning signs (changes in appetite, water intake, activity, urination), so veterinary care is sought late. This system is a **mobile decision support tool — explicitly NOT a diagnostic system** — that:

1. Collects owner-observed symptoms and behavioral patterns through a mobile app.
2. Predicts early disease risk using machine learning classification models.
3. Uses an **Agentic AI layer** to autonomously interpret predictions, assess urgency, and trigger actions (risk alerts, vaccination reminders, vet recommendations) without user prompts.
4. Guides owners to nearby veterinary clinics/hospitals with available surgeons and real-time time slots.

### Aim

Develop an Agentic AI-driven decision support system for early disease risk detection in companion animals.

### Specific Objectives

- Identify early disease risk using owner-observed symptoms and behavioral patterns.
- Develop and evaluate ML-based models for disease risk prediction.
- Implement an Agentic AI framework that autonomously reasons over risk levels and provides action guidance.
- Integrate location-based veterinary clinic and surgeon availability with real-time time-slot information.
- Design a vaccination management and reminder mechanism supporting timely preventive care.

## 2. Functional Requirements

### FR1 — User & Pet Profile Management
- FR1.1 Secure user registration and login (authentication + role-based access).
- FR1.2 User roles: pet **owner**, **vet** (clinic/surgeon side), **admin**.
- FR1.3 Pet profile CRUD: species (dog/cat), breed, age, sex, weight, and basic demographics.
- FR1.4 Multiple pets per owner; pet health history is retained per pet.

### FR2 — Symptom & Behavior Data Collection
- FR2.1 Structured symptom input: appetite, water intake, urination frequency, activity level, vomiting, and similar observable indicators.
- FR2.2 Behavioral pattern capture over time (multi-factor, not single-visit only).
- FR2.3 Inputs combine hybrid data sources: symptoms, behaviors, pet demographics, and preventive health (vaccination) data.
- FR2.4 Simple, accessible input UI that prevents confusion and incorrect data entry.

### FR3 — ML Disease Risk Prediction
- FR3.1 ML classification model(s) predicting early risk of selected high-impact diseases for dogs and cats.
- FR3.2 Risk output as level (`low` / `medium` / `high`) with a confidence score (0–1).
- FR3.3 Training data: primary survey data from dog/cat owners plus secondary public datasets/literature; preprocessed, encoded, and balanced.
- FR3.4 Models evaluated with accuracy and validation metrics (documented for the research report).
- FR3.5 Lightweight models to limit device/server resource consumption.

### FR4 — Agentic AI Layer (core innovation)
- FR4.1 Autonomously interprets ML risk output — reasons over risk level, pet profile, and detected patterns.
- FR4.2 Assesses urgency and generates action guidance (e.g., "see a vet within 24h").
- FR4.3 Triggers actions **without user prompts**: disease risk alerts, vaccination reminders, vet clinic/surgeon recommendations.
- FR4.4 Autonomous health-monitoring agent that continuously evaluates pet health data and risk patterns.
- FR4.5 Preventive-care agent that tracks vaccination timelines and generates intelligent, risk-aware alerts without manual input.
- FR4.6 Personalized guidance based on risk level, pet profile, and detected patterns (not generic advice).
- FR4.7 Ontology-supported reasoning: symptom→disease interpretation, disease→vaccine preventive guidance, clinic/surgeon recommendation enrichment (Neo4j graph).

### FR5 — Vaccination Management & Reminders
- FR5.1 Vaccination record tracking per pet (vaccine, date given, next due date).
- FR5.2 Reminder system integrated with disease risk analysis (risk-aware scheduling, e.g., overdue vaccine for a disease the pet shows risk for escalates urgency).
- FR5.3 Automated reminders/notifications without manual user input.

### FR6 — Veterinary Discovery & Booking
- FR6.1 Real-time, location-based discovery of nearby veterinary clinics and hospitals.
- FR6.2 Display of available veterinary surgeons per clinic.
- FR6.3 Real-time consultation time slots per surgeon.
- FR6.4 Appointment booking against available slots.

### FR7 — Alerts & Notifications
- FR7.1 Risk-based alert system recommending timely veterinary consultation.
- FR7.2 Push notifications for high-risk alerts, vaccination reminders, and appointment updates.
- FR7.3 Clear in-app guidance encouraging veterinary consultation when high risk is detected.

### FR8 — Admin & Vet-Side Functions
- FR8.1 Clinic/surgeon/schedule management (vet or admin maintains clinics, surgeons, and slots).
- FR8.2 Admin oversight of users, reference data (diseases, symptoms, vaccines), and system monitoring.

## 3. Non-Functional Requirements

- **NFR1 — Decision support, not diagnosis:** the app must clearly and persistently state it does not replace professional veterinary diagnosis (disclaimer in onboarding and on every risk result).
- **NFR2 — Security & privacy:** secure authentication, encrypted storage/transport of personal and pet data, anonymized handling of research data, no sensitive personal information collected.
- **NFR3 — Usability:** simple, accessible mobile-first UI; usability testing is a formal evaluation step.
- **NFR4 — Performance/efficiency:** lightweight ML models; minimal device resource and energy consumption.
- **NFR5 — Compatibility:** works across a wide range of mobile devices (PWA — mobile/web compatible).
- **NFR6 — Reliability & maintenance:** regular updates and testing for security vulnerabilities and stable performance.
- **NFR7 — Evaluation:** model performance via accuracy/validation metrics; system effectiveness via functional and usability testing.

## 4. Constraints & Methodology Context

- Design Science Research approach; iterative SDLC with continuous refinement.
- Mixed-method: quantitative (ML training/evaluation) + qualitative (usability, trust feedback).
- Mobile application supported by a backend server (implemented here as a PWA micro-frontend + microservices monorepo — see CLAUDE.md for architecture).
- Target species: dogs and cats only.
- Ethics: voluntary participation, anonymized data, no sensitive personal data.

## 5. Expected Deliverables (from proposal §13)

1. Fully functional mobile-based Agentic AI decision support system.
2. Agentic AI-driven symptom and behavior analysis module.
3. ML classification model for early risk of selected high-impact diseases.
4. Autonomous health-monitoring agent (continuous evaluation of pet health data).
5. Preventive-care agent (vaccination timeline tracking, intelligent alerts, no manual input).
6. Vaccination reminder system integrated with disease risk analysis.
7. Real-time location-based veterinary clinic/hospital locator.
8. Display of available veterinary surgeons and consultation time slots.
9. Risk-based alert and guidance system.
10. Secure user and pet profile management.
11. Research report (methodology, experimental results, evaluation).
12. Performance evaluation and usability testing results.
13. System documentation and user guidelines.

## 6. Stakeholders

Pet owners (primary users), veterinary clinics and surgeons, animal welfare organizations, researchers/students, academic institutions.
