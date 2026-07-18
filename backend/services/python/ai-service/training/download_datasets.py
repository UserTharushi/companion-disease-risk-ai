"""Download the two training datasets into <repo-root>/data/raw/.

Usage (from ai-service dir):
    pip install -r requirements.txt -r training/requirements-train.txt
    python training/download_datasets.py
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

# .../backend/services/python/ai-service/training/ -> repo root is 5 levels up
REPO_ROOT = Path(__file__).resolve().parents[5]
RAW_DIR = REPO_ROOT / "data" / "raw"

PET_HEALTH_CSV = RAW_DIR / "pet_health_symptoms.csv"
ANIMAL_CONDITION_CSV = RAW_DIR / "animal_condition.csv"


def download_pet_health_symptoms(out_path: Path) -> bool:
    """HuggingFace karenwky/pet-health-symptoms-dataset — no auth needed."""
    try:
        from datasets import load_dataset

        ds = load_dataset("karenwky/pet-health-symptoms-dataset", split="train")
        ds.to_pandas().to_csv(out_path, index=False)
        print(f"[ok] pet-health-symptoms: {len(ds)} rows -> {out_path}")
        return True
    except Exception as ex:
        print(f"[fail] pet-health-symptoms download failed: {ex}")
        print("       Manual fallback: download from")
        print("       https://huggingface.co/datasets/karenwky/pet-health-symptoms-dataset")
        print(f"       and save as {out_path}")
        return False


def download_animal_condition(out_path: Path) -> bool:
    """Kaggle willianoliveiragibin/animal-condition — needs ~/.kaggle/kaggle.json."""
    try:
        import kagglehub

        path = Path(kagglehub.dataset_download("willianoliveiragibin/animal-condition"))
        csvs = list(path.rglob("*.csv"))
        if not csvs:
            raise FileNotFoundError(f"no CSV found in {path}")
        shutil.copy(csvs[0], out_path)
        print(f"[ok] animal-condition: {csvs[0].name} -> {out_path}")
        return True
    except Exception as ex:
        print(f"[fail] animal-condition download failed: {ex}")
        print("       Manual fallback: download from")
        print("       https://www.kaggle.com/datasets/willianoliveiragibin/animal-condition")
        print(f"       extract the CSV and save as {out_path}")
        return False


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    ok1 = PET_HEALTH_CSV.exists() or download_pet_health_symptoms(PET_HEALTH_CSV)
    if PET_HEALTH_CSV.exists() and ok1:
        print(f"[present] {PET_HEALTH_CSV}")
    ok2 = ANIMAL_CONDITION_CSV.exists() or download_animal_condition(ANIMAL_CONDITION_CSV)
    if ANIMAL_CONDITION_CSV.exists() and ok2:
        print(f"[present] {ANIMAL_CONDITION_CSV}")
    return 0 if (ok1 and ok2) else 1


if __name__ == "__main__":
    sys.exit(main())
