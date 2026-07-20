"""Section 3.3 — Expert clinical review harness (content validity).

QUESTION
    Would a qualified veterinarian judge the system's outputs clinically
    reasonable? This script produces a BLINDED review sheet a vet can fill in,
    plus a separate answer key for the researcher to analyse afterwards.

METHOD
    1. Generate a stratified sample of cases (a few per condition) using the
       same grounded profiles as training/§3.1.
    2. For each case, run the real prediction + risk blend (Model A + Model B +
       deterministic severity, identical to predictor.predict but without the
       optional Neo4j ontology enrichment, so the harness needs no database).
    3. Derive a safety-oriented urgency band from the risk level.
    4. Write:
         docs/ml/expert_review_sample.csv       <- BLINDED, give this to the vet
         docs/ml/expert_review_answer_key.csv   <- latent labels, keep private
    The vet rates each case on plausibility, recommendation appropriateness,
    and safety. Because false negatives (missing a serious condition) are the
    costliest error, the SAFETY column is the primary outcome.

HONESTY NOTE
    This measures content validity as judged by a human expert; it does not by
    itself establish diagnostic accuracy. Report inter-rater agreement if more
    than one reviewer participates. If no vet is available, state this and rely
    on §3.1 and §3.2, listing expert review as future work.

USAGE (from the ai-service directory, ideally inside python:3.11)
    python training/build_expert_review.py --per-class 3 --seed 5
"""
from __future__ import annotations

import argparse
import csv
import random
import sys
import warnings
from pathlib import Path

# Model B ignores tokens outside its danger-vocab (e.g. chronic-disease signs) —
# a benign, by-design MultiLabelBinarizer warning; silence it for clean output.
warnings.filterwarnings("ignore", message="unknown class")

SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.schemas.prediction import SymptomPayload  # noqa: E402
from app.services import feature_bridge, model_store, predictor  # noqa: E402
from validate_distribution import ALL_CLASSES, sample_payload  # noqa: E402

REPO_ROOT = SERVICE_DIR.parents[3]

SYMPTOM_LABEL = {
    "lethargy": "lethargy", "coughing": "coughing", "fever": "fever",
    "reduced-activity": "reduced activity", "stiff-gait": "stiff / limping gait",
    "loss-of-appetite": "not eating", "skin-irritation": "itchy / irritated skin",
    "breathing-difficulty": "difficulty breathing", "weight-loss": "weight loss",
    "swollen-abdomen": "swollen abdomen", "lump-swelling": "a lump or swelling",
    "yellow-gums": "yellow gums or eyes", "fainting": "fainting / collapse",
    "ear-scratching": "ear scratching", "head-shaking": "head shaking",
}
VOMIT = {"once": "vomited once", "multiple": "vomited several times", "persistent": "persistent vomiting"}
DIARR = {"mild": "mild diarrhoea", "moderate": "moderate diarrhoea", "severe": "severe diarrhoea"}


def describe(p: SymptomPayload) -> str:
    """Blinded, owner-style readable case description for the reviewer."""
    parts = [f"{int(p.age_years)}-year-old {p.species}."]
    if p.appetite_level == "reduced":
        parts.append("Eating less than usual.")
    elif p.appetite_level == "none":
        parts.append("Not eating at all.")
    if p.water_intake == "increased":
        parts.append("Drinking noticeably more.")
    elif p.water_intake == "reduced":
        parts.append("Drinking less.")
    if p.urine_frequency == "increased":
        parts.append("Urinating more often.")
    if p.vomiting_frequency in VOMIT:
        parts.append(VOMIT[p.vomiting_frequency].capitalize() + ".")
    if p.diarrhea_level in DIARR:
        parts.append(DIARR[p.diarrhea_level].capitalize() + ".")
    if p.activity_level == "lethargic":
        parts.append("Very lethargic.")
    elif p.activity_level == "mild":
        parts.append("Slightly less active.")
    signs = [SYMPTOM_LABEL.get(s, s) for s in p.symptoms]
    if signs:
        parts.append("Owner also reports: " + ", ".join(signs) + ".")
    if p.notes:
        parts.append(f'Owner note: "{p.notes}"')
    parts.append(f"Signs present for about {p.symptom_duration_days} days.")
    return " ".join(parts)


def predict_no_ontology(payload: SymptomPayload):
    """predictor.predict() minus the Neo4j ontology enrichment (DB-free)."""
    text = feature_bridge.payload_to_text(payload)
    tokens = feature_bridge.payload_to_tokens(payload)
    severity = feature_bridge.severity_index(payload)
    diseases, _feats, condition_prob = predictor._predict_conditions(text)
    if not tokens and model_store.get_risk_artifact() is not None:
        p_danger = 0.0
    else:
        p_danger = predictor._predict_danger(tokens)
    if p_danger is not None:
        p_danger = feature_bridge.prior_correct(p_danger)  # mirror production calibration
        risk_level, _score = feature_bridge.derive_risk(p_danger, severity)
    else:
        risk_level, _c = predictor._rule_fallback(payload)
    if not diseases:
        diseases = predictor._keyword_disease_guess(tokens)
    top3 = [d.disease for d in diseases[:3]]
    return (top3[0] if top3 else "-"), top3, risk_level


URGENCY = {
    "high": "See a vet within 24 hours (urgent)",
    "medium": "See a vet within 48-72 hours",
    "low": "Home monitoring; see a vet if it worsens",
}


def mild_case(rng: random.Random) -> SymptomPayload:
    """A minor, low-acuity presentation — the system should NOT over-triage it.
    Included so the reviewer can assess false-alarm behaviour, not just serious
    cases."""
    base = dict(appetite_level="normal", water_intake="normal", activity_level="normal",
                urine_frequency="normal", vomiting_frequency="none", diarrhea_level="none",
                symptoms=[], notes="", symptom_duration_days=rng.choice([1, 2]))
    kind = rng.choice(["appetite", "activity", "skin", "ear", "vomit_once"])
    if kind == "appetite":
        base["appetite_level"] = "reduced"
    elif kind == "activity":
        base["activity_level"] = "mild"
    elif kind == "skin":
        base["symptoms"] = ["skin-irritation"]
    elif kind == "ear":
        base["symptoms"] = ["ear-scratching"]
    else:
        base["vomiting_frequency"] = "once"
    return SymptomPayload(pet_id="mild", species=rng.choice(["dog", "cat"]),
                          age_years=float(rng.randint(1, 8)), **base)


def main() -> int:
    ap = argparse.ArgumentParser(description="Expert-review sheet builder (thesis 3.3)")
    ap.add_argument("--per-class", type=int, default=3, help="cases generated per condition")
    ap.add_argument("--mild", type=int, default=5, help="extra low-acuity cases to test over-triage")
    ap.add_argument("--seed", type=int, default=5)
    ap.add_argument("--out", default="docs/ml/expert_review_sample.csv")
    ap.add_argument("--key", default="docs/ml/expert_review_answer_key.csv")
    args = ap.parse_args()

    model_store.load_models()
    if model_store.get_condition_model() is None:
        raise SystemExit("Condition model not loaded — train it first.")

    rng = random.Random(args.seed)
    review_rows = []
    key_rows = []
    case_no = 0
    # Stratified: a few cases per condition so the reviewer sees the full range
    for latent in ALL_CLASSES:
        for _ in range(args.per_class):
            case_no += 1
            cid = f"C{case_no:03d}"
            payload = sample_payload(latent, rng)
            top1, top3, risk = predict_no_ontology(payload)
            review_rows.append({
                "case_id": cid,
                "case_description": describe(payload),
                "model_predicted_condition": top1,
                "model_alternatives_top3": " | ".join(top3),
                "model_risk_level": risk,
                "model_recommendation": URGENCY.get(risk, "-"),
                "plausibility_1to5": "",
                "recommendation_appropriateness_1to5": "",
                "safety_safe_unsafe_unsure": "",
                "reviewer_comments": "",
            })
            key_rows.append({"case_id": cid, "latent_condition": latent,
                             "model_predicted_condition": top1, "model_risk_level": risk})

    # Low-acuity cases — the system should recommend home monitoring, not urgency
    for _ in range(args.mild):
        case_no += 1
        cid = f"C{case_no:03d}"
        payload = mild_case(rng)
        top1, top3, risk = predict_no_ontology(payload)
        review_rows.append({
            "case_id": cid,
            "case_description": describe(payload),
            "model_predicted_condition": top1,
            "model_alternatives_top3": " | ".join(top3),
            "model_risk_level": risk,
            "model_recommendation": URGENCY.get(risk, "-"),
            "plausibility_1to5": "",
            "recommendation_appropriateness_1to5": "",
            "safety_safe_unsafe_unsure": "",
            "reviewer_comments": "",
        })
        key_rows.append({"case_id": cid, "latent_condition": "Non-specific / mild",
                         "model_predicted_condition": top1, "model_risk_level": risk})

    # Shuffle so the reviewer can't infer the class ordering
    rng.shuffle(review_rows)

    out_path = REPO_ROOT / args.out if not Path(args.out).is_absolute() else Path(args.out)
    key_path = REPO_ROOT / args.key if not Path(args.key).is_absolute() else Path(args.key)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(review_rows[0].keys()))
        w.writeheader()
        w.writerows(review_rows)
    with key_path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(key_rows[0].keys()))
        w.writeheader()
        w.writerows(key_rows)

    print(f"Generated {len(review_rows)} blinded review cases "
          f"({args.per_class}/class x {len(ALL_CLASSES)} classes + {args.mild} mild)")
    print(f"Review sheet (give to vet) -> {out_path}")
    print(f"Answer key (keep private)  -> {key_path}")
    print("\nReviewer fills: plausibility (1-5), recommendation appropriateness (1-5),")
    print("safety (safe/unsafe/unsure), comments. Safety is the primary outcome.")
    print("\nSample case:")
    print(f"  {review_rows[0]['case_id']}: {review_rows[0]['case_description']}")
    print(f"  -> predicted: {review_rows[0]['model_predicted_condition']} "
          f"| risk: {review_rows[0]['model_risk_level']} "
          f"| {review_rows[0]['model_recommendation']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
