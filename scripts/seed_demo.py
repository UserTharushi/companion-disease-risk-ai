"""Seed demo data for a live walkthrough / viva.

Populates the running stack (through the API gateway, with auth enforced) so
every dashboard has realistic content:
  * an admin, a pet-owner, and an admin-provisioned veterinarian account
  * a few pets for the owner
  * a couple of AI predictions (a concerning case and a mild case) so the
    owner's "Risk Assessments" and the vet's patient list show real data

Safe to re-run: accounts and pets that already exist are reused, not duplicated.
Clinics are auto-seeded by clinic-service, so they are not created here.

USAGE (stack must be up: `docker compose up -d`)
    python scripts/seed_demo.py
    python scripts/seed_demo.py --gateway http://localhost:4000
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

PASSWORD = "Demo1234!"
ACCOUNTS = {
    "admin": ("demo.admin@petcare.ai", "Demo Admin", "admin"),
    "owner": ("demo.owner@petcare.ai", "Demo Owner", "pet-owner"),
    "vet":   ("demo.vet@petcare.ai",   "Dr. Demo Vet", "veterinarian"),
}
PETS = [
    {"name": "Rex", "species": "dog", "breed": "Labrador", "ageYears": 4, "weightKg": 28, "sex": "male"},
    {"name": "Milo", "species": "cat", "breed": "Domestic Shorthair", "ageYears": 11, "weightKg": 4, "sex": "male"},
    {"name": "Bella", "species": "dog", "breed": "Beagle", "ageYears": 2, "weightKg": 12, "sex": "female"},
]
# (pet index, symptom payload) — one concerning, one mild, to show a risk spread
PREDICTIONS = [
    (1, {"appetite_level": "none", "activity_level": "lethargic", "water_intake": "increased",
         "urine_frequency": "increased", "vomiting_frequency": "multiple", "diarrhea_level": "none",
         "symptoms": ["weight-loss", "lethargy"], "symptom_duration_days": 14,
         "notes": "drinking a lot and losing weight over the past two weeks"}),
    (2, {"appetite_level": "reduced", "activity_level": "normal", "water_intake": "normal",
         "urine_frequency": "normal", "vomiting_frequency": "none", "diarrhea_level": "none",
         "symptoms": ["skin-irritation"], "symptom_duration_days": 2,
         "notes": "scratching an ear a bit more than usual"}),
]


def call(gateway: str, method: str, path: str, body=None, token: str | None = None):
    url = f"{gateway}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}
    except urllib.error.URLError as e:
        print(f"ERROR: cannot reach {url} ({e}). Is the stack running (docker compose up -d)?")
        sys.exit(1)


def ensure_account(gateway, email, display_name, role, admin_token=None):
    """Register the account (reuse if it already exists) and return its token."""
    payload = {"email": email, "password": PASSWORD, "displayName": display_name, "role": role}
    if role == "veterinarian":
        payload["mustChangePassword"] = False  # keep the demo vet a direct login
    status, body = call(gateway, "POST", "/api/auth/register", payload, token=admin_token)
    if status in (200, 201):
        print(f"  created {role:12} {email}")
    else:
        # Already exists (or similar) -> just log in
        print(f"  exists  {role:12} {email} ({body.get('message', 'reusing')})")
    status, body = call(gateway, "POST", "/api/auth/login", {"email": email, "password": PASSWORD})
    if status != 200:
        print(f"  ! login failed for {email}: {body.get('message')}")
        return None
    return body["data"]["token"]


def main() -> int:
    ap = argparse.ArgumentParser(description="Seed demo data")
    ap.add_argument("--gateway", default="http://localhost:4000")
    args = ap.parse_args()
    gw = args.gateway.rstrip("/")

    print("Seeding demo data via", gw)
    print("Accounts:")
    admin_token = ensure_account(gw, *ACCOUNTS["admin"])
    owner_token = ensure_account(gw, *ACCOUNTS["owner"])
    # Veterinarian is admin-provisioned (requires the admin's token)
    ensure_account(gw, *ACCOUNTS["vet"], admin_token=admin_token)

    if not owner_token:
        print("Cannot seed pets/predictions without an owner token.")
        return 1

    # Pets (skip if the owner already has some, so re-runs don't duplicate)
    _, existing = call(gw, "GET", "/api/pets", token=owner_token)
    have = {p.get("name") for p in (existing.get("data") or [])}
    pet_ids = [p.get("id") for p in (existing.get("data") or [])]
    print("Pets:")
    for pet in PETS:
        if pet["name"] in have:
            print(f"  exists  {pet['name']}")
            continue
        status, body = call(gw, "POST", "/api/pets", pet, token=owner_token)
        if status in (200, 201):
            pet_ids.append(body["data"]["id"])
            print(f"  created {pet['name']} ({pet['species']})")
        else:
            print(f"  ! failed {pet['name']}: {body.get('message')}")

    # Predictions (so dashboards show real AI results)
    print("Predictions:")
    for idx, symptoms in PREDICTIONS:
        if idx >= len(pet_ids):
            continue
        payload = {"pet_id": pet_ids[idx], "species": "dog", "age_years": 5, "language": "en", **symptoms}
        status, body = call(gw, "POST", "/api/predict", payload, token=owner_token)
        if status == 200:
            top = (body.get("predicted_diseases") or [{}])[0].get("disease", "?")
            print(f"  pet[{idx}] -> {body.get('risk_level')} risk, top: {top}")
        else:
            print(f"  ! prediction failed for pet[{idx}]: {body.get('message', status)}")

    print("\nDone. Demo logins (password for all: %s):" % PASSWORD)
    for role, (email, _n, _r) in ACCOUNTS.items():
        print(f"  {role:12} {email}")
    print("\nLog in as the owner to see pets + risk assessments; the vet to see patients;")
    print("the admin to see clinics, vets, and platform stats.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
