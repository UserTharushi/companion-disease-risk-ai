"""Risk-calibration sensitivity analysis (addresses the §3.3 over-triage finding).

MOTIVATION
    The expert-review harness (§3.3) showed the system almost never returns
    "low" risk: even minimal single-sign presentations are triaged >= medium.
    risk_metrics.json confirms the cause -- the danger model's training set is
    97.7% "dangerous" (positive_rate=0.977) and its recall on the NOT-dangerous
    class is 0.0, so its calibrated probability is inflated for weak evidence.

WHAT THIS DOES (and does NOT do)
    This is a READ-ONLY sensitivity analysis. It does NOT modify the deployed
    model or the production risk logic. It quantifies, across candidate
    calibrations, the trade-off between:
        * SPECIFICITY on benign cases  -> we want mild cases to reach "low",
        * SAFETY on serious cases      -> chronic-disease cases MUST stay
                                          >= medium (never silently dropped).
    The output lets you (and your supervisor) choose and justify a calibration,
    then apply and RE-VALIDATE it deliberately -- rather than hand-tuning to any
    single test (which would compromise the validation).

CANDIDATE CALIBRATIONS
    * baseline               : production settings, unchanged.
    * prior-corrected(pi)    : Bayesian prior-shift of the danger probability
                               from the 0.977 training base rate to a plausible
                               deployment prevalence `pi` (preserves ranking,
                               decompresses inflated probabilities).
    * severity-weighted      : trust the deterministic severity index more.
    * threshold-shift        : raise the low/medium/high cut points.

USAGE (ai-service dir, inside python:3.11)
    python training/risk_calibration_experiment.py --n 400 --seed 9
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import warnings
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))

warnings.filterwarnings("ignore", message="unknown class")

from app.services import feature_bridge, model_store, predictor  # noqa: E402
from chronic_synth import CHRONIC_PROFILES  # noqa: E402
from validate_distribution import sample_payload  # noqa: E402
from build_expert_review import mild_case  # noqa: E402

REPO_ROOT = SERVICE_DIR.parents[3]
TRAIN_POSITIVE_RATE = 0.977  # danger-model base rate (from app/models/risk_metrics.json)

BASE_W_DANGER, BASE_W_SEV = 0.6, 0.4
BASE_T_HIGH, BASE_T_MED = feature_bridge.RISK_HIGH_THRESHOLD, feature_bridge.RISK_MEDIUM_THRESHOLD


def prior_shift(p: float, pi_deploy: float, pi_train: float = TRAIN_POSITIVE_RATE) -> float:
    """Correct a probability trained under pi_train to a deployment prior pi_deploy."""
    a = pi_deploy / pi_train
    b = (1 - pi_deploy) / (1 - pi_train)
    num = p * a
    den = num + (1 - p) * b
    return num / den if den else p


def score_to_level(score: float, t_high: float, t_med: float) -> str:
    if score >= t_high:
        return "high"
    if score >= t_med:
        return "medium"
    return "low"


# Each calibration: (label, pi_deploy_or_None, w_danger, w_sev, t_high, t_med)
CALIBRATIONS = [
    ("baseline", None, BASE_W_DANGER, BASE_W_SEV, BASE_T_HIGH, BASE_T_MED),
    ("prior-corrected(0.5)", 0.5, BASE_W_DANGER, BASE_W_SEV, BASE_T_HIGH, BASE_T_MED),
    ("prior-corrected(0.3)", 0.3, BASE_W_DANGER, BASE_W_SEV, BASE_T_HIGH, BASE_T_MED),
    ("severity-weighted(0.4/0.6)", None, 0.4, 0.6, BASE_T_HIGH, BASE_T_MED),
    ("threshold-shift(0.72/0.50)", None, BASE_W_DANGER, BASE_W_SEV, 0.72, 0.50),
    ("prior(0.3)+sev(0.4/0.6)", 0.3, 0.4, 0.6, BASE_T_HIGH, BASE_T_MED),
]


def case_signal(payload):
    """Return (p_danger, severity) for a case, matching predictor.predict logic."""
    tokens = feature_bridge.payload_to_tokens(payload)
    severity = feature_bridge.severity_index(payload)
    if not tokens and model_store.get_risk_artifact() is not None:
        p_danger = 0.0
    else:
        p_danger = predictor._predict_danger(tokens)
        if p_danger is None:
            p_danger = 0.5  # fallback shouldn't occur when artifact present
    return p_danger, severity


def level_for(signal, calib) -> str:
    _label, pi, wd, ws, th, tm = calib
    p_danger, severity = signal
    p = prior_shift(p_danger, pi) if pi is not None else p_danger
    score = wd * p + ws * severity
    return score_to_level(score, th, tm)


def dist(levels: list[str]) -> dict:
    n = len(levels) or 1
    return {lv: round(levels.count(lv) / n, 3) for lv in ("low", "medium", "high")}


def main() -> int:
    ap = argparse.ArgumentParser(description="Risk-calibration sensitivity analysis")
    ap.add_argument("--n", type=int, default=400, help="cases per population")
    ap.add_argument("--seed", type=int, default=9)
    ap.add_argument("--out", default="docs/ml/risk_calibration_experiment.json")
    args = ap.parse_args()

    model_store.load_models()
    if model_store.get_risk_artifact() is None:
        raise SystemExit("Risk model not loaded — train it first.")

    rng = random.Random(args.seed)

    # Populations: SERIOUS (chronic diseases -> must stay >= medium) and MILD (benign -> want low)
    chronic = list(CHRONIC_PROFILES.keys())
    serious_signals = [case_signal(sample_payload(rng.choice(chronic), rng)) for _ in range(args.n)]
    mild_signals = [case_signal(mild_case(rng)) for _ in range(args.n)]

    results = []
    for calib in CALIBRATIONS:
        label = calib[0]
        serious_levels = [level_for(s, calib) for s in serious_signals]
        mild_levels = [level_for(s, calib) for s in mild_signals]
        serious_d = dist(serious_levels)
        mild_d = dist(mild_levels)
        # SAFETY metric: fraction of serious cases kept at >= medium
        serious_safe = round(1 - serious_d["low"], 3)
        results.append({
            "calibration": label,
            "serious_distribution": serious_d,
            "serious_pct_ge_medium (SAFETY)": serious_safe,
            "mild_distribution": mild_d,
            "mild_pct_low (SPECIFICITY)": mild_d["low"],
        })

    report = {
        "note": "READ-ONLY sensitivity analysis; production model unchanged.",
        "train_positive_rate": TRAIN_POSITIVE_RATE,
        "n_per_population": args.n,
        "seed": args.seed,
        "populations": {"serious": "chronic-disease cases (must stay >= medium)",
                        "mild": "benign single-sign cases (should reach low)"},
        "results": results,
    }
    out_path = REPO_ROOT / args.out if not Path(args.out).is_absolute() else Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"\nRisk-calibration sensitivity analysis  (n={args.n}/population, seed={args.seed})")
    print("SAFETY = % of SERIOUS (chronic) cases kept >= medium (want ~1.00)")
    print("SPEC   = % of MILD cases correctly reaching low (want higher)\n")
    print(f"{'calibration':30} {'SAFETY':>7} {'SPEC':>6}   serious(l/m/h)        mild(l/m/h)")
    for r in results:
        s, m = r["serious_distribution"], r["mild_distribution"]
        print(f"{r['calibration']:30} {r['serious_pct_ge_medium (SAFETY)']:7.2f} "
              f"{r['mild_pct_low (SPECIFICITY)']:6.2f}   "
              f"{s['low']:.2f}/{s['medium']:.2f}/{s['high']:.2f}     "
              f"{m['low']:.2f}/{m['medium']:.2f}/{m['high']:.2f}")
    print(f"\nReport -> {out_path}")
    print("\nInterpretation: pick the calibration that maximises SPEC while keeping")
    print("SAFETY at/near 1.00. Then apply it in feature_bridge.derive_risk and RE-RUN")
    print("§3.1/§3.2/§3.3 to confirm no regression before reporting it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
