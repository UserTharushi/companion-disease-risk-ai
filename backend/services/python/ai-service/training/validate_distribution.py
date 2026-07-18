"""Section 3.1 — Distributional (population face-validity) external validation.

QUESTION
    Given an epidemiologically realistic case mix, does Model A's aggregate
    predicted-condition distribution track real-world disorder prevalence?

METHOD
    1. Each case's *latent* condition is drawn according to real-world
       prevalence weights (PREVALENCE — see the honesty note below).
    2. Its clinical signs are sampled from that condition's grounded
       sign-probability profile (the SAME profiles used for training:
       chronic_synth.CHRONIC_PROFILES for the 6 chronic diseases and
       train_condition_model.AUGMENT_RECIPES for the 5 primary conditions)
       and rendered to owner-style text via the runtime feature_bridge.
    3. Model A predicts each case independently (identical to serve time).
    4. We compare the model's predicted class-frequency ranking against the
       prevalence ranking with Spearman's rank correlation (rho) and report a
       per-class prevalence-vs-predicted breakdown plus a latent->predicted
       confusion table.

INTERPRETATION
    Because the population is itself prevalence-weighted, a perfect classifier
    would reproduce the prevalence distribution exactly (rho = 1). Deviations
    are caused by inter-class confusion, so rho measures how faithfully the
    model preserves the real-world epidemiological ordering at the population
    level. Per-class shares reveal systematic over/under-prediction.

!!! HONESTY / ACADEMIC-INTEGRITY NOTE !!!
    The PREVALENCE weights below are ILLUSTRATIVE PLACEHOLDERS, not real data.
    Before reporting any rho in your thesis you MUST replace them with figures
    you have personally sourced and cited (e.g. VetCompass primary-care
    disorder-prevalence studies). Supply them via --prevalence <file.json>
    (a JSON object mapping the class names below to relative weights). The
    script records which source was used in its output so results are auditable.

USAGE (from the ai-service directory, ideally inside python:3.11)
    python training/validate_distribution.py \
        --n 3000 --seed 7 \
        --prevalence docs/ml/prevalence.json \
        --out docs/ml/distributional_validation.json
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

import joblib

SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))  # allow sibling imports

from app.schemas.prediction import SymptomPayload  # noqa: E402
from app.services.feature_bridge import payload_to_text  # noqa: E402
from chronic_synth import CHRONIC_PROFILES, _pick  # noqa: E402
from train_condition_model import AUGMENT_RECIPES  # noqa: E402

REPO_ROOT = SERVICE_DIR.parents[3]
MODEL_PATH = SERVICE_DIR / "app" / "models" / "condition_model.joblib"

# The 11 canonical classes (must match the trained model's labels).
PRIMARY_CONDITIONS = [
    "Skin Irritations",
    "Digestive Issues",
    "Parasites",
    "Ear Infections",
    "Mobility Problems",
]
ALL_CLASSES = PRIMARY_CONDITIONS + list(CHRONIC_PROFILES.keys())

# ---------------------------------------------------------------------------
# PLACEHOLDER prevalence weights (relative; need not sum to 1). NOT REAL DATA.
# Replace via --prevalence <file.json> with cited real-world figures.
# ---------------------------------------------------------------------------
PREVALENCE_PLACEHOLDER: dict[str, float] = {
    # Primary-care presentations tend to dominate; chronic diseases are rarer.
    "Skin Irritations": 0.20,
    "Digestive Issues": 0.18,
    "Ear Infections": 0.12,
    "Parasites": 0.12,
    "Mobility Problems": 0.10,
    "Chronic Kidney Disease": 0.06,
    "Heart Disease": 0.05,
    "Diabetes Mellitus": 0.04,
    "Liver Disease": 0.05,
    "Pancreatitis": 0.04,
    "Cancer": 0.04,
}


def load_prevalence(path: str | None) -> tuple[dict[str, float], str]:
    if path:
        p = Path(path)
        if not p.is_absolute():
            p = REPO_ROOT / path
        if not p.exists():
            raise SystemExit(f"Prevalence file not found: {p}")
        weights = json.loads(p.read_text(encoding="utf-8"))
        missing = [c for c in ALL_CLASSES if c not in weights]
        if missing:
            raise SystemExit(f"Prevalence file is missing classes: {missing}")
        return {c: float(weights[c]) for c in ALL_CLASSES}, str(p)
    return dict(PREVALENCE_PLACEHOLDER), "PLACEHOLDER (illustrative, NOT real data)"


def sample_payload(disease: str, rng: random.Random) -> SymptomPayload:
    """Generate one realistic case for `disease` from its grounded profile."""
    if disease in CHRONIC_PROFILES:
        p = CHRONIC_PROFILES[disease]
        symptoms = [sid for sid, prob in p["symptoms"] if rng.random() < prob]
        return SymptomPayload(
            pet_id="val",
            species=_pick(rng, p["species"]),
            age_years=float(rng.randint(*p["age"])),
            appetite_level=_pick(rng, p["appetite_level"]),
            water_intake=_pick(rng, p["water_intake"]),
            activity_level=_pick(rng, p["activity_level"]),
            urine_frequency=_pick(rng, p["urine_frequency"]),
            vomiting_frequency=_pick(rng, p["vomiting_frequency"]),
            diarrhea_level=_pick(rng, p.get("diarrhea_level", [("none", 1.0)])),
            symptoms=symptoms,
            notes=rng.choice(p["notes"]),
            symptom_duration_days=rng.choice(p["duration"]),
        )
    # Primary condition: sample one of its template recipes with varied signalment
    recipes = [ov for ov, label in AUGMENT_RECIPES if label == disease]
    if not recipes:
        raise SystemExit(f"No generation profile for class: {disease}")
    ov = rng.choice(recipes)
    return SymptomPayload(
        pet_id="val",
        species=rng.choice(["dog", "cat"]),
        age_years=float(rng.randint(1, 12)),
        appetite_level=ov.get("appetite_level", "normal"),
        water_intake=ov.get("water_intake", "normal"),
        activity_level=ov.get("activity_level", "normal"),
        urine_frequency=ov.get("urine_frequency", "normal"),
        vomiting_frequency=ov.get("vomiting_frequency", "none"),
        diarrhea_level=ov.get("diarrhea_level", "none"),
        symptoms=ov.get("symptoms", []),
        notes=ov.get("notes", ""),
        symptom_duration_days=rng.choice([1, 2, 3, 5, 7]),
    )


def _rankdata(values: list[float]) -> list[float]:
    """Descending ranks with average-rank tie handling (rank 1 = largest)."""
    order = sorted(range(len(values)), key=lambda i: -values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1  # ranks are 1-based
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def _pearson(a: list[float], b: list[float]) -> float:
    n = len(a)
    ma, mb = sum(a) / n, sum(b) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    va = sum((x - ma) ** 2 for x in a) ** 0.5
    vb = sum((y - mb) ** 2 for y in b) ** 0.5
    return cov / (va * vb) if va and vb else 0.0


def spearman(a: list[float], b: list[float]) -> float:
    return _pearson(_rankdata(a), _rankdata(b))


def main() -> int:
    ap = argparse.ArgumentParser(description="Distributional external validation (thesis 3.1)")
    ap.add_argument("--n", type=int, default=3000, help="population size")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--prevalence", default=None, help="path to JSON of real cited prevalence weights")
    ap.add_argument("--out", default="docs/ml/distributional_validation.json")
    ap.add_argument("--plots", default="docs/ml", help="directory for output plots")
    args = ap.parse_args()

    if not MODEL_PATH.exists():
        raise SystemExit(f"Model missing: {MODEL_PATH}\nTrain it first: python training/train_condition_model.py")

    prevalence, prevalence_source = load_prevalence(args.prevalence)
    if "PLACEHOLDER" in prevalence_source:
        print("=" * 70)
        print("WARNING: using PLACEHOLDER prevalence weights — NOT real data.")
        print("Supply cited figures via --prevalence before reporting results.")
        print("=" * 70)

    total_w = sum(prevalence.values())
    prevalence_share = {c: prevalence[c] / total_w for c in ALL_CLASSES}

    model = joblib.load(MODEL_PATH)
    rng = random.Random(args.seed)

    # Prevalence-weighted latent-disease draw for the whole population
    weighted = [(c, prevalence[c]) for c in ALL_CLASSES]
    predicted = Counter()
    latent = Counter()
    confusion: dict[str, Counter] = defaultdict(Counter)
    correct = 0

    for _ in range(args.n):
        disease = _pick(rng, [(c, w / total_w) for c, w in weighted])
        payload = sample_payload(disease, rng)
        pred = str(model.predict([payload_to_text(payload)])[0])
        latent[disease] += 1
        predicted[pred] += 1
        confusion[disease][pred] += 1
        if pred == disease:
            correct += 1

    predicted_share = {c: predicted.get(c, 0) / args.n for c in ALL_CLASSES}
    prev_vec = [prevalence_share[c] for c in ALL_CLASSES]
    pred_vec = [predicted_share[c] for c in ALL_CLASSES]
    rho = round(spearman(prev_vec, pred_vec), 4)

    prev_ranks = dict(zip(ALL_CLASSES, _rankdata(prev_vec)))
    pred_ranks = dict(zip(ALL_CLASSES, _rankdata(pred_vec)))

    per_class = []
    for c in ALL_CLASSES:
        per_class.append({
            "class": c,
            "prevalence_share": round(prevalence_share[c], 4),
            "predicted_share": round(predicted_share[c], 4),
            "prevalence_rank": prev_ranks[c],
            "predicted_rank": pred_ranks[c],
            "rank_delta": round(pred_ranks[c] - prev_ranks[c], 1),
        })

    report = {
        "method": "distributional external validation (prevalence-weighted population face-validity)",
        "n": args.n,
        "seed": args.seed,
        "prevalence_source": prevalence_source,
        "spearman_rho_prevalence_vs_predicted": rho,
        "population_recovery_accuracy": round(correct / args.n, 4),
        "per_class": sorted(per_class, key=lambda r: r["prevalence_rank"]),
        "latent_to_predicted_confusion": {d: dict(confusion[d]) for d in ALL_CLASSES},
    }

    out_path = REPO_ROOT / args.out if not Path(args.out).is_absolute() else Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    # Console summary
    print(f"\nPopulation n={args.n}  seed={args.seed}  prevalence={prevalence_source}")
    print(f"Spearman rho (prevalence rank vs predicted rank) = {rho}")
    print(f"Population recovery accuracy (latent == predicted) = {report['population_recovery_accuracy']}")
    print(f"\n{'class':26} {'prev%':>7} {'pred%':>7} {'prevR':>6} {'predR':>6} {'dR':>5}")
    for r in report["per_class"]:
        print(f"{r['class']:26} {r['prevalence_share']*100:7.1f} {r['predicted_share']*100:7.1f}"
              f" {r['prevalence_rank']:6.1f} {r['predicted_rank']:6.1f} {r['rank_delta']:5.1f}")
    print(f"\nReport -> {out_path}")

    # Plots (optional — matplotlib is a training-only dependency)
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        plots_dir = REPO_ROOT / args.plots if not Path(args.plots).is_absolute() else Path(args.plots)
        plots_dir.mkdir(parents=True, exist_ok=True)

        # 1) Grouped bar: prevalence share vs predicted share
        classes_by_prev = [r["class"] for r in report["per_class"]]
        prev_pct = [prevalence_share[c] * 100 for c in classes_by_prev]
        pred_pct = [predicted_share[c] * 100 for c in classes_by_prev]
        x = range(len(classes_by_prev))
        fig, ax = plt.subplots(figsize=(11, 6))
        ax.bar([i - 0.2 for i in x], prev_pct, width=0.4, label="Real prevalence")
        ax.bar([i + 0.2 for i in x], pred_pct, width=0.4, label="Model predicted")
        ax.set_xticks(list(x))
        ax.set_xticklabels(classes_by_prev, rotation=40, ha="right")
        ax.set_ylabel("Share of population (%)")
        ax.set_title(f"Distributional validation — prevalence vs predicted (rho={rho})")
        ax.legend()
        fig.tight_layout()
        fig.savefig(plots_dir / "distributional_validation_bars.png", dpi=150)

        # 2) Rank-alignment scatter with y=x reference
        fig2, ax2 = plt.subplots(figsize=(6, 6))
        n_cls = len(ALL_CLASSES)
        ax2.plot([1, n_cls], [1, n_cls], linestyle="--", linewidth=1)
        for c in ALL_CLASSES:
            ax2.scatter(prev_ranks[c], pred_ranks[c])
            ax2.annotate(c, (prev_ranks[c], pred_ranks[c]), fontsize=7,
                         xytext=(3, 3), textcoords="offset points")
        ax2.set_xlabel("Real prevalence rank (1 = most common)")
        ax2.set_ylabel("Model predicted-frequency rank")
        ax2.set_title(f"Rank alignment (Spearman rho = {rho})")
        fig2.tight_layout()
        fig2.savefig(plots_dir / "distributional_validation_ranks.png", dpi=150)
        print(f"Plots  -> {plots_dir / 'distributional_validation_bars.png'}")
        print(f"          {plots_dir / 'distributional_validation_ranks.png'}")
    except Exception as ex:  # pragma: no cover - plotting is best-effort
        print(f"(plots skipped: {ex})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
