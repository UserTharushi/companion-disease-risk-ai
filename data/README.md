# Training Datasets

Datasets used to train the disease-risk models in `backend/services/python/ai-service`.
Raw files live in `data/raw/` (git-ignored). Download via:

```bash
cd backend/services/python/ai-service
pip install -r training/requirements-train.txt
python training/download_datasets.py
```

## Sources

1. **Pet Health Symptoms Dataset** — `karenwky/pet-health-symptoms-dataset` (HuggingFace) /
   `yyzz1010/pet-health-symptoms-dataset` (Kaggle).
   2,000 rows: `text` (symptom description, owner or clinical phrasing) → `condition`
   ∈ {Skin Irritations, Digestive Issues, Parasites, Ear Infections, Mobility Problems}.
   Used for **Model A** (condition classifier). Downloads without auth from HuggingFace.

2. **Animal Condition Classification Dataset** — `willianoliveiragibin/animal-condition` (Kaggle).
   ~871 rows: `AnimalName`, `symptoms1..symptoms5` → `Dangerous` (yes/no, ~97% "yes" — heavily
   imbalanced; only calibrated probabilities are used, never the hard label).
   Used for **Model B** (risk/urgency model).

### Manual download fallback (no Kaggle credentials)

If `kagglehub` fails (needs `%USERPROFILE%\.kaggle\kaggle.json`), download manually:

1. Visit https://www.kaggle.com/datasets/willianoliveiragibin/animal-condition
2. Download and extract the CSV
3. Save it as `data/raw/animal_condition.csv`

Expected files after download:

```
data/raw/pet_health_symptoms.csv   # columns: text, condition, record_type
data/raw/animal_condition.csv      # columns: AnimalName, symptoms1..symptoms5, Dangerous
```
