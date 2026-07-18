"""Train Model B — risk/urgency model (symptom tokens -> calibrated P(dangerous)).

Data: Kaggle willianoliveiragibin/animal-condition (~871 rows, AnimalName,
symptoms1..5, Dangerous yes/no). ~97% of rows are "dangerous", so the hard
label is useless — we train a calibrated LogisticRegression and only ever use
the probability downstream, blended with a deterministic severity index
(see app/services/feature_bridge.derive_risk).

Usage (from ai-service dir):
    python training/train_risk_model.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    balanced_accuracy_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MultiLabelBinarizer

SERVICE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SERVICE_DIR.parents[3]
RAW_CSV = REPO_ROOT / "data" / "raw" / "animal_condition.csv"
MODEL_DIR = SERVICE_DIR / "app" / "models"

RANDOM_SEED = 42
VOCAB_SIZE = 40

# Map bridge tokens (app/services/feature_bridge.py) onto dataset spellings
TOKEN_ALIASES = {
    "diarrhea": "diarrhoea",
    "increased thirst": "excessive thirst",
    "difficulty breathing": "breathing difficulty",
}


def normalize_symptom(value: str) -> str:
    token = str(value).strip().lower()
    return TOKEN_ALIASES.get(token, token)


def main() -> int:
    if not RAW_CSV.exists():
        print(f"Dataset missing: {RAW_CSV}\nRun: python training/download_datasets.py")
        return 1

    df = pd.read_csv(RAW_CSV)
    df.columns = [c.strip() for c in df.columns]
    symptom_cols = [c for c in df.columns if c.lower().startswith("symptom")]
    label_col = next(c for c in df.columns if c.lower().startswith("danger"))
    animal_col = next(c for c in df.columns if "animal" in c.lower())
    print(f"Columns: animal={animal_col}, symptoms={symptom_cols}, label={label_col}; rows={len(df)}")

    df = df.dropna(subset=[label_col])
    df["y"] = df[label_col].astype(str).str.strip().str.lower().map({"yes": 1, "no": 0})
    df = df.dropna(subset=["y"])
    df["y"] = df["y"].astype(int)

    # Keep companion-animal rows if they leave a workable sample; else keep all (documented)
    companion = df[df[animal_col].astype(str).str.strip().str.lower().isin(
        ["dog", "dogs", "cat", "cats", "puppy", "kitten"]
    )]
    scope = "dog/cat only"
    if len(companion) < 100 or companion["y"].nunique() < 2:
        companion = df
        scope = "all animals (too few dog/cat rows with both classes)"
    print(f"Scope: {scope} ({len(companion)} rows, positives={int(companion['y'].sum())})")

    token_lists = [
        [normalize_symptom(v) for v in row if pd.notna(v) and str(v).strip()]
        for row in companion[symptom_cols].itertuples(index=False)
    ]
    counts = Counter(t for tokens in token_lists for t in tokens)
    vocab = [t for t, _ in counts.most_common(VOCAB_SIZE)]
    print(f"Vocabulary ({len(vocab)}): {vocab[:15]}...")

    binarizer = MultiLabelBinarizer(classes=vocab)
    X = binarizer.fit_transform([[t for t in tokens if t in vocab] for tokens in token_lists])
    y = companion["y"].to_numpy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=RANDOM_SEED, stratify=y
    )

    base = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=RANDOM_SEED)
    model = CalibratedClassifierCV(base, method="sigmoid", cv=3)
    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, list(model.classes_).index(1)]
    pred = (proba >= 0.5).astype(int)
    metrics = {
        "model": "MultiLabelBinarizer + CalibratedClassifierCV(LogisticRegression balanced, sigmoid)",
        "dataset": "willianoliveiragibin/animal-condition",
        "scope": scope,
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "positive_rate": round(float(y.mean()), 4),
        "pr_auc": round(float(average_precision_score(y_test, proba)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, proba)), 4) if len(set(y_test)) > 1 else None,
        "balanced_accuracy": round(float(balanced_accuracy_score(y_test, pred)), 4),
        "recall_dangerous": round(float(recall_score(y_test, pred, pos_label=1)), 4),
        "recall_not_dangerous": round(float(recall_score(y_test, pred, pos_label=0, zero_division=0)), 4),
        "vocabulary": vocab,
        "caveat": (
            "Severe class imbalance (~97% dangerous). The calibrated probability is used "
            "as one signal only, blended with a deterministic severity index in "
            "feature_bridge.derive_risk; the hard label is never used."
        ),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"binarizer": binarizer, "model": model}, MODEL_DIR / "risk_model.joblib")
    with open(MODEL_DIR / "risk_metrics.json", "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)

    print(json.dumps({k: v for k, v in metrics.items() if k not in {"vocabulary", "caveat"}}, indent=2))
    print(f"Saved model -> {MODEL_DIR / 'risk_model.joblib'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
