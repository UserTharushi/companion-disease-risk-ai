"""Knowledge-grounded synthetic training rows for six chronic diseases.

Each profile encodes the documented clinical sign pattern of the disease
(standard veterinary references: polyuria/polydipsia in CKD and diabetes,
cough + exercise intolerance in cardiac disease, icterus in hepatic disease,
acute vomiting + abdominal pain in pancreatitis, mass + cachexia in neoplasia).
Rows are rendered through the SAME runtime bridge (payload_to_text) used at
serve time, so the trained distribution matches production inputs.

Documented limitation (report in the thesis): these rows are synthetic —
held-out accuracy over them measures pattern separability, not clinical
diagnostic accuracy.
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))

from app.schemas.prediction import SymptomPayload  # noqa: E402
from app.services.feature_bridge import payload_to_text, ideal_weight_range  # noqa: E402

DOG_BREEDS = ["Labrador", "German Shepherd", "Beagle", "Bulldog", "Poodle",
              "Rottweiler", "Chihuahua", "Cocker Spaniel", "Golden Retriever", "Pomeranian"]
CAT_BREEDS = ["Domestic Shorthair", "Persian", "Siamese", "Maine Coon", "British Shorthair", "Ragdoll"]

# Documented body-condition tendency per disease (obesity is a risk factor for
# diabetes/pancreatitis; cachexia/weight loss accompanies CKD and cancer).
WEIGHT_BIAS = {
    "Chronic Kidney Disease": "under",
    "Diabetes Mellitus": "over",
    "Liver Disease": "ideal",
    "Heart Disease": "ideal",
    "Pancreatitis": "over",
    "Cancer": "under",
}


def _sample_breed_weight(rng: random.Random, species: str, bias: str) -> tuple[str, float]:
    breed = rng.choice(CAT_BREEDS if species == "cat" else DOG_BREEDS)
    lo, hi = ideal_weight_range(species, breed)
    if bias == "under":
        weight = rng.uniform(lo * 0.6, lo * 0.82)
    elif bias == "over":
        weight = rng.uniform(hi * 1.18, hi * 1.5)
    else:
        weight = rng.uniform(lo, hi)
    return breed, round(weight, 1)

# Each field: value -> probability of appearing. "symptoms" lists (id, prob).
CHRONIC_PROFILES: dict[str, dict] = {
    "Chronic Kidney Disease": {
        "species": [("cat", 0.6), ("dog", 0.4)],
        "age": (7, 16),
        "duration": [7, 14, 21, 30],
        "water_intake": [("increased", 0.9), ("normal", 0.1)],
        "urine_frequency": [("increased", 0.9), ("normal", 0.1)],
        "appetite_level": [("reduced", 0.7), ("normal", 0.2), ("none", 0.1)],
        "activity_level": [("lethargic", 0.5), ("mild", 0.3), ("normal", 0.2)],
        "vomiting_frequency": [("once", 0.3), ("multiple", 0.2), ("none", 0.5)],
        "symptoms": [("weight-loss", 0.75), ("lethargy", 0.5), ("loss-of-appetite", 0.5)],
        "notes": [
            "drinking bowls empty much faster than before",
            "litter box much wetter lately, losing weight over weeks",
            "breath smells bad, coat looks dull and unkempt",
            "",
        ],
    },
    "Diabetes Mellitus": {
        "species": [("dog", 0.5), ("cat", 0.5)],
        "age": (6, 14),
        "duration": [7, 14, 21, 30],
        "water_intake": [("increased", 0.95), ("normal", 0.05)],
        "urine_frequency": [("increased", 0.95), ("normal", 0.05)],
        # hallmark: weight loss DESPITE normal or increased appetite
        "appetite_level": [("normal", 0.75), ("reduced", 0.25)],
        "activity_level": [("mild", 0.4), ("normal", 0.4), ("lethargic", 0.2)],
        "vomiting_frequency": [("none", 0.85), ("once", 0.15)],
        "symptoms": [("weight-loss", 0.85), ("lethargy", 0.3)],
        "notes": [
            "eating well but still losing weight",
            "constantly thirsty and asking to go out to urinate",
            "sudden weight loss despite a good appetite, sometimes cloudy eyes",
            "",
        ],
    },
    "Liver Disease": {
        "species": [("dog", 0.6), ("cat", 0.4)],
        "age": (5, 14),
        "duration": [5, 7, 14, 21],
        "water_intake": [("increased", 0.4), ("normal", 0.6)],
        "urine_frequency": [("increased", 0.3), ("normal", 0.7)],
        "appetite_level": [("reduced", 0.6), ("none", 0.3), ("normal", 0.1)],
        "activity_level": [("lethargic", 0.7), ("mild", 0.3)],
        "vomiting_frequency": [("multiple", 0.4), ("once", 0.3), ("none", 0.3)],
        "diarrhea_level": [("mild", 0.3), ("none", 0.7)],
        "symptoms": [("yellow-gums", 0.8), ("swollen-abdomen", 0.45), ("weight-loss", 0.4), ("lethargy", 0.6)],
        "notes": [
            "gums and eyes look yellowish",
            "belly seems bloated and skin has a yellow tinge",
            "urine looks very dark, whites of the eyes look yellow",
            "",
        ],
    },
    "Heart Disease": {
        "species": [("dog", 0.75), ("cat", 0.25)],
        "age": (6, 15),
        "duration": [7, 14, 21, 30],
        "water_intake": [("normal", 0.9), ("increased", 0.1)],
        "urine_frequency": [("normal", 1.0)],
        "appetite_level": [("normal", 0.5), ("reduced", 0.5)],
        "activity_level": [("lethargic", 0.5), ("mild", 0.5)],
        "vomiting_frequency": [("none", 0.9), ("once", 0.1)],
        "symptoms": [
            ("coughing", 0.85),
            ("breathing-difficulty", 0.65),
            ("reduced-activity", 0.75),
            ("fainting", 0.25),
            ("swollen-abdomen", 0.2),
        ],
        "notes": [
            "coughs mostly at night and after excitement",
            "gets out of breath after very short walks, tires quickly",
            "collapsed briefly after running, breathing looks fast at rest",
            "",
        ],
    },
    "Pancreatitis": {
        "species": [("dog", 0.75), ("cat", 0.25)],
        "age": (4, 12),
        "duration": [1, 2, 3],
        "water_intake": [("normal", 0.7), ("reduced", 0.3)],
        "urine_frequency": [("normal", 1.0)],
        "appetite_level": [("none", 0.6), ("reduced", 0.4)],
        "activity_level": [("lethargic", 0.8), ("mild", 0.2)],
        "vomiting_frequency": [("persistent", 0.55), ("multiple", 0.35), ("once", 0.1)],
        "diarrhea_level": [("mild", 0.4), ("none", 0.6)],
        "symptoms": [("swollen-abdomen", 0.55), ("lethargy", 0.7)],
        "notes": [
            "belly is painful to touch, standing in a hunched prayer position",
            "sudden repeated vomiting after a fatty meal, tummy seems very tender",
            "won't let me touch the abdomen, keeps stretching front legs forward",
            "",
        ],
    },
    "Cancer": {
        "species": [("dog", 0.6), ("cat", 0.4)],
        "age": (8, 16),
        "duration": [14, 21, 30, 45],
        "water_intake": [("normal", 0.9), ("increased", 0.1)],
        "urine_frequency": [("normal", 0.95), ("increased", 0.05)],
        "appetite_level": [("reduced", 0.6), ("normal", 0.3), ("none", 0.1)],
        "activity_level": [("lethargic", 0.6), ("mild", 0.4)],
        "vomiting_frequency": [("none", 0.8), ("once", 0.2)],
        "symptoms": [
            ("lump-swelling", 0.8),
            ("weight-loss", 0.75),
            ("lethargy", 0.6),
            ("pale-gums", 0.0),  # not a form option yet; kept at 0 for future use
        ],
        "notes": [
            "found a firm lump under the skin that keeps growing",
            "slowly losing weight over the past month, a swelling on the leg",
            "an old wound that will not heal and a growing mass on the belly",
            "",
        ],
    },
}


def _pick(rng: random.Random, options: list[tuple[str, float]]) -> str:
    roll = rng.random()
    cumulative = 0.0
    for value, prob in options:
        cumulative += prob
        if roll <= cumulative:
            return value
    return options[-1][0]


def generate_chronic_rows(per_disease: int = 450, seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    rows: list[dict] = []
    for disease, profile in CHRONIC_PROFILES.items():
        for _ in range(per_disease):
            symptoms = [sid for sid, prob in profile["symptoms"] if rng.random() < prob]
            species = _pick(rng, profile["species"])
            breed, weight = _sample_breed_weight(rng, species, WEIGHT_BIAS.get(disease, "ideal"))
            payload = SymptomPayload(
                pet_id="synth",
                species=species,
                breed=breed,
                weight_kg=weight,
                age_years=float(rng.randint(*profile["age"])),
                appetite_level=_pick(rng, profile["appetite_level"]),
                water_intake=_pick(rng, profile["water_intake"]),
                activity_level=_pick(rng, profile["activity_level"]),
                urine_frequency=_pick(rng, profile["urine_frequency"]),
                vomiting_frequency=_pick(rng, profile["vomiting_frequency"]),
                diarrhea_level=_pick(rng, profile.get("diarrhea_level", [("none", 1.0)])),
                symptoms=symptoms,
                notes=rng.choice(profile["notes"]),
                symptom_duration_days=rng.choice(profile["duration"]),
            )
            rows.append({"text": payload_to_text(payload), "condition": disease})
    return rows
