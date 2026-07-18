"""Section 3.2 — Knowledge-consistency external validation.

QUESTION
    Do the associations Model A relies on agree with the curated clinical
    knowledge encoded in the Neo4j ontology's INDICATES (symptom -> disease)
    edges? I.e. when a case is described using the *ontology's own* declared
    signs for disease D, does the statistical model independently predict D?

METHOD
    1. Parse the INDICATES edges straight from ontology/neo4j/schema.cypher
       (the file applied verbatim to Neo4j at startup) -> for each disease,
       its clinically-declared signs and weights. No database required.
    2. Map each ontology sign to its structured-form representation and build
       (a) a CANONICAL presentation with every expressible declared sign, and
       (b) RANDOMISED presentations where each sign is included with
       probability equal to its ontology weight (>= 1 sign).
    3. Render through the runtime feature_bridge and run Model A (identical to
       serve time). Record whether the ontology's disease is the model's top-1
       and top-3 prediction.
    4. Report per-disease agreement, sign coverage, and the most common
       disagreement, plus overall agreement rates.

INTERPRETATION
    High agreement means the model is "right for the right reasons": the signs
    a clinician (via the ontology) considers characteristic of a disease do
    drive the model toward that disease, rather than the model exploiting
    spurious correlations. Disagreements flag either a model weakness or an
    ontology/model representation mismatch worth discussing.

HONESTY NOTE
    The ontology and the model's training profiles were authored by the same
    project from overlapping clinical references, so this is a CROSS-
    REPRESENTATION CONSISTENCY check (symbolic graph vs statistical model),
    not fully independent external validation. It still has real value: it
    detects spurious correlations, mislabelled training data, and encoding
    errors, and it is reported as such in the thesis.

USAGE (from the ai-service directory, ideally inside python:3.11)
    python training/validate_knowledge_consistency.py \
        --n 200 --seed 11 \
        --out docs/ml/knowledge_consistency_validation.json
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import Counter
from pathlib import Path

import joblib

SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))

from app.schemas.prediction import SymptomPayload  # noqa: E402
from app.services.feature_bridge import payload_to_text  # noqa: E402

REPO_ROOT = SERVICE_DIR.parents[3]
MODEL_PATH = SERVICE_DIR / "app" / "models" / "condition_model.joblib"
SCHEMA_PATH = REPO_ROOT / "ontology" / "neo4j" / "schema.cypher"

INDICATES_RE = re.compile(
    r'MATCH\s*\(s:Symptom\s*\{name:\s*"([^"]+)"\}\)\s*,\s*'
    r'\(d:Disease\s*\{name:\s*"([^"]+)"\}\)\s*'
    r'MERGE\s*\(s\)-\[:INDICATES\s*\{weight:\s*([0-9.]+)\}\]->\(d\)'
)

# Ontology symptom name -> structured-form representation (inverse of the
# feature bridge). Each value is a set of payload mutations: "symptom" appends
# a checklist id; any other key sets a vital field. Ontology signs with no form
# field (e.g. "fever", "nasal discharge", "pale gums", "dehydration") have no
# entry and are counted as NOT expressible (reported as coverage).
ONTOLOGY_TO_PAYLOAD: dict[str, dict[str, str]] = {
    "vomiting": {"vomiting_frequency": "multiple"},
    "diarrhoea": {"diarrhea_level": "moderate"},
    "loss of appetite": {"appetite_level": "reduced", "symptom": "loss-of-appetite"},
    "lethargy": {"activity_level": "lethargic", "symptom": "lethargy"},
    "reduced activity": {"activity_level": "lethargic", "symptom": "reduced-activity"},
    "increased urination": {"urine_frequency": "increased"},
    "increased thirst": {"water_intake": "increased"},
    "coughing": {"symptom": "coughing"},
    "difficulty breathing": {"symptom": "breathing-difficulty"},
    "weight loss": {"symptom": "weight-loss"},
    "swollen abdomen": {"symptom": "swollen-abdomen"},
    "lump or swelling": {"symptom": "lump-swelling"},
    "jaundice": {"symptom": "yellow-gums"},
    "fainting": {"symptom": "fainting"},
    "skin lesions": {"symptom": "skin-irritation"},
    "excessive scratching": {"symptom": "skin-irritation"},
    "hair loss": {"symptom": "skin-irritation"},
    "ear scratching": {"symptom": "ear-scratching"},
    "head shaking": {"symptom": "head-shaking"},
    "lameness": {"symptom": "stiff-gait"},
}

# Typical signalment per disease so canonical cases read naturally.
SPECIES_AGE = {
    "Chronic Kidney Disease": ("cat", 12), "Diabetes Mellitus": ("cat", 10),
    "Liver Disease": ("dog", 9), "Heart Disease": ("dog", 10),
    "Pancreatitis": ("dog", 7), "Cancer": ("dog", 11),
}


def parse_indicates(path: Path) -> dict[str, list[tuple[str, float]]]:
    text = path.read_text(encoding="utf-8")
    edges: dict[str, list[tuple[str, float]]] = {}
    for symptom, disease, weight in INDICATES_RE.findall(text):
        edges.setdefault(disease, []).append((symptom, float(weight)))
    return edges


def build_payload(signs: list[str], disease: str) -> SymptomPayload:
    species, age = SPECIES_AGE.get(disease, ("dog", 4))
    fields = {
        "appetite_level": "normal", "water_intake": "normal", "activity_level": "normal",
        "urine_frequency": "normal", "vomiting_frequency": "none", "diarrhea_level": "none",
    }
    symptoms: list[str] = []
    for sign in signs:
        mut = ONTOLOGY_TO_PAYLOAD.get(sign)
        if not mut:
            continue
        for key, val in mut.items():
            if key == "symptom":
                if val not in symptoms:
                    symptoms.append(val)
            else:
                fields[key] = val
    return SymptomPayload(
        pet_id="kc", species=species, age_years=float(age),
        symptoms=symptoms, notes="", symptom_duration_days=7, **fields,
    )


def top_k(model, text: str, k: int = 3) -> list[str]:
    classes = list(model.classes_)
    proba = model.predict_proba([text])[0]
    order = sorted(range(len(classes)), key=lambda i: -proba[i])
    return [classes[i] for i in order[:k]]


def main() -> int:
    ap = argparse.ArgumentParser(description="Knowledge-consistency validation (thesis 3.2)")
    ap.add_argument("--n", type=int, default=200, help="randomised presentations per disease")
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--out", default="docs/ml/knowledge_consistency_validation.json")
    ap.add_argument("--plots", default="docs/ml")
    args = ap.parse_args()

    if not MODEL_PATH.exists():
        raise SystemExit(f"Model missing: {MODEL_PATH}")
    if not SCHEMA_PATH.exists():
        raise SystemExit(f"Ontology schema missing: {SCHEMA_PATH}")

    model = joblib.load(MODEL_PATH)
    model_labels = set(map(str, model.classes_))
    ontology = parse_indicates(SCHEMA_PATH)
    rng = random.Random(args.seed)

    # Only diseases the model can actually predict AND that have >=1 expressible sign
    testable = []
    for disease, signs in ontology.items():
        if disease not in model_labels:
            continue
        if any(s in ONTOLOGY_TO_PAYLOAD for s, _ in signs):
            testable.append(disease)
    testable.sort()

    per_disease = []
    for disease in testable:
        signs = ontology[disease]
        expressible = [(s, w) for s, w in signs if s in ONTOLOGY_TO_PAYLOAD]
        coverage = round(len(expressible) / len(signs), 2)

        # (a) canonical presentation: every expressible declared sign present
        canonical_pred = top_k(model, payload_to_text(build_payload([s for s, _ in expressible], disease)))
        canon_top1 = canonical_pred[0] == disease
        canon_top3 = disease in canonical_pred

        # (b) randomised presentations: include each sign with prob = its weight
        t1 = t3 = 0
        mispreds: Counter = Counter()
        for _ in range(args.n):
            chosen = [s for s, w in expressible if rng.random() < w]
            if not chosen:
                chosen = [max(expressible, key=lambda sw: sw[1])[0]]
            preds = top_k(model, payload_to_text(build_payload(chosen, disease)))
            if preds[0] == disease:
                t1 += 1
            else:
                mispreds[preds[0]] += 1
            if disease in preds:
                t3 += 1

        per_disease.append({
            "disease": disease,
            "declared_signs": [s for s, _ in signs],
            "sign_coverage_in_form": coverage,
            "canonical_prediction_top3": canonical_pred,
            "canonical_top1_agree": canon_top1,
            "canonical_top3_agree": canon_top3,
            "randomised_top1_agreement": round(t1 / args.n, 4),
            "randomised_top3_agreement": round(t3 / args.n, 4),
            "most_common_disagreement": (mispreds.most_common(1)[0][0] if mispreds else None),
        })

    n = len(per_disease)
    summary = {
        "n_diseases_tested": n,
        "canonical_top1_agreement_rate": round(sum(d["canonical_top1_agree"] for d in per_disease) / n, 4) if n else 0,
        "canonical_top3_agreement_rate": round(sum(d["canonical_top3_agree"] for d in per_disease) / n, 4) if n else 0,
        "mean_randomised_top1_agreement": round(sum(d["randomised_top1_agreement"] for d in per_disease) / n, 4) if n else 0,
        "mean_randomised_top3_agreement": round(sum(d["randomised_top3_agreement"] for d in per_disease) / n, 4) if n else 0,
        "mean_sign_coverage_in_form": round(sum(d["sign_coverage_in_form"] for d in per_disease) / n, 4) if n else 0,
    }

    report = {
        "method": "knowledge-consistency (ontology INDICATES vs Model A prediction)",
        "ontology_source": str(SCHEMA_PATH.relative_to(REPO_ROOT)),
        "randomised_n_per_disease": args.n,
        "seed": args.seed,
        "summary": summary,
        "per_disease": per_disease,
    }

    out_path = REPO_ROOT / args.out if not Path(args.out).is_absolute() else Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    # Console summary
    print(f"\nKnowledge-consistency validation — {n} diseases (Model A vs ontology)")
    print(f"Canonical top-1 agreement: {summary['canonical_top1_agreement_rate']}  "
          f"top-3: {summary['canonical_top3_agreement_rate']}")
    print(f"Randomised  top-1 agreement: {summary['mean_randomised_top1_agreement']}  "
          f"top-3: {summary['mean_randomised_top3_agreement']}")
    print(f"Mean sign coverage in form: {summary['mean_sign_coverage_in_form']}")
    print(f"\n{'disease':26} {'cov':>5} {'canon1':>7} {'rand1':>6} {'rand3':>6}  disagree")
    for d in per_disease:
        print(f"{d['disease']:26} {d['sign_coverage_in_form']:5.2f} "
              f"{('Y' if d['canonical_top1_agree'] else 'N'):>7} "
              f"{d['randomised_top1_agreement']:6.2f} {d['randomised_top3_agreement']:6.2f}  "
              f"{d['most_common_disagreement'] or '-'}")
    print(f"\nReport -> {out_path}")

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        plots_dir = REPO_ROOT / args.plots if not Path(args.plots).is_absolute() else Path(args.plots)
        plots_dir.mkdir(parents=True, exist_ok=True)
        labels = [d["disease"] for d in per_disease]
        r1 = [d["randomised_top1_agreement"] for d in per_disease]
        r3 = [d["randomised_top3_agreement"] for d in per_disease]
        x = range(len(labels))
        fig, ax = plt.subplots(figsize=(11, 6))
        ax.bar([i - 0.2 for i in x], r1, width=0.4, label="Top-1 agreement")
        ax.bar([i + 0.2 for i in x], r3, width=0.4, label="Top-3 agreement")
        ax.set_xticks(list(x))
        ax.set_xticklabels(labels, rotation=40, ha="right")
        ax.set_ylim(0, 1)
        ax.set_ylabel("Agreement with ontology")
        ax.set_title("Knowledge-consistency: Model A vs ontology INDICATES signs")
        ax.legend()
        fig.tight_layout()
        fig.savefig(plots_dir / "knowledge_consistency.png", dpi=150)
        print(f"Plot   -> {plots_dir / 'knowledge_consistency.png'}")
    except Exception as ex:  # pragma: no cover
        print(f"(plot skipped: {ex})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
