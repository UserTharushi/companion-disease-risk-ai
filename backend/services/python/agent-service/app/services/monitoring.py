"""Autonomous health-monitoring agent (FR4.4/FR4.5/FR5.3).

Periodically scans every pet, re-evaluates recent risk and vaccination
timelines, and creates notifications WITHOUT any user prompt. Notifications
are idempotent per day via dedupeKey, so repeated cycles never spam."""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import httpx

from app.agents import tools
from app.core.i18n import msg, risk_word
from app.core.names_i18n import localize_disease, localize_vaccine

logger = logging.getLogger("agent-service.monitoring")

RISK_LOOKBACK_DAYS = 7
VACCINE_DUE_SOON_DAYS = 14

_last_run: Optional[dict] = None

_mongo_client = None


def _predictions_collection():
    global _mongo_client
    if _mongo_client is None:
        from pymongo import MongoClient

        uri = (
            os.getenv("MONGODB_URI")
            or os.getenv("MONGO_URI")
            or "mongodb://root:rootpassword@localhost:27017/companion_ai?authSource=admin"
        )
        _mongo_client = MongoClient(uri, serverSelectionTimeoutMS=3000)
    return _mongo_client[os.getenv("MONGODB_DB_NAME", "companion_ai")]["predictions"]


def _service_headers() -> dict:
    return {"x-service-key": os.getenv("SERVICE_KEY", "internal-dev-key")}


def _list_all_pets() -> list[dict]:
    try:
        response = httpx.get(
            f"{os.getenv('PET_SERVICE_URL', 'http://localhost:4002').rstrip('/')}/api/pets",
            params={"pageSize": 500},
            headers=_service_headers(),
            timeout=5.0,
        )
        if response.status_code != 200:
            return []
        return response.json().get("data", [])
    except Exception as ex:
        logger.warning("Could not list pets: %s", ex)
        return []


def _due_vaccinations(within_days: int) -> list[dict]:
    try:
        response = httpx.get(
            f"{os.getenv('VACCINATION_SERVICE_URL', 'http://localhost:4005').rstrip('/')}/api/vaccinations/due",
            params={"withinDays": within_days},
            headers=_service_headers(),
            timeout=5.0,
        )
        if response.status_code != 200:
            return []
        return response.json().get("data", [])
    except Exception as ex:
        logger.warning("Could not list due vaccinations: %s", ex)
        return []


def _latest_prediction(pet_id: str) -> Optional[dict]:
    try:
        return _predictions_collection().find_one({"pet_id": pet_id}, sort=[("created_at", -1)])
    except Exception as ex:
        logger.warning("Could not read predictions for %s: %s", pet_id, ex)
        return None


_language_cache: dict[str, str] = {}


def _owner_language(owner_id: str) -> str:
    """Owner's preferred language from auth-service; cached per cycle, defaults to en."""
    if owner_id in _language_cache:
        return _language_cache[owner_id]
    language = "en"
    try:
        response = httpx.get(
            f"{os.getenv('AUTH_SERVICE_URL', 'http://localhost:4001').rstrip('/')}/api/auth/users/{owner_id}/language",
            headers=_service_headers(),
            timeout=3.0,
        )
        if response.status_code == 200:
            language = response.json().get("data", {}).get("language", "en")
    except Exception as ex:
        logger.warning("Could not fetch language for %s: %s", owner_id, ex)
    _language_cache[owner_id] = language
    return language


def _notify(owner_id: str, pet_id: str, type_: str, title: str, body: str, urgency: str, ref: str) -> bool:
    dedupe_key = f"{pet_id}:{type_}:{ref}:{date.today().isoformat()}"
    return tools.post_notification({
        "userId": owner_id,
        "petId": pet_id,
        "type": type_,
        "title": title,
        "body": body,
        "urgency": urgency,
        "dedupeKey": dedupe_key,
    })


def run_monitoring_cycle() -> dict:
    """One full scan. Returns a summary dict (also stored for /monitor/status)."""
    global _last_run
    _language_cache.clear()
    now = datetime.now(timezone.utc)
    pets = _list_all_pets()
    due_all = _due_vaccinations(VACCINE_DUE_SOON_DAYS)
    due_by_pet: dict[str, list[dict]] = {}
    for record in due_all:
        due_by_pet.setdefault(record.get("petId", ""), []).append(record)

    notifications_created = 0
    risk_alerts = 0
    vaccination_alerts = 0

    for pet in pets:
        pet_id = pet.get("id", "")
        owner_id = pet.get("ownerId", "")
        pet_name = pet.get("name", "Your pet")
        if not pet_id or not owner_id:
            continue

        # ── Rule 1: recent elevated risk → risk_alert ──
        latest = _latest_prediction(pet_id)
        predicted_diseases: list[str] = []
        if latest:
            created = latest.get("created_at")
            recent = isinstance(created, datetime) and (
                created.replace(tzinfo=created.tzinfo or timezone.utc) >= now - timedelta(days=RISK_LOOKBACK_DAYS)
            )
            risk = latest.get("risk_level")
            predicted_diseases = [d.get("disease", "") for d in latest.get("predicted_diseases", [])]
            if recent and risk in {"medium", "high"}:
                lang = _owner_language(owner_id)
                top = (
                    localize_disease(predicted_diseases[0], lang)
                    if predicted_diseases
                    else msg(lang, "notif_health_concern")
                )
                risk_localized = risk_word(lang, risk)
                if _notify(
                    owner_id,
                    pet_id,
                    "risk_alert",
                    msg(lang, "notif_risk_title", pet=pet_name, risk=risk_localized),
                    msg(lang, "notif_risk_body", risk=risk_localized, disease=top)
                    + msg(lang, "notif_risk_high_action" if risk == "high" else "notif_risk_medium_action"),
                    "high" if risk == "high" else "medium",
                    ref=str(latest.get("_id", "latest")),
                ):
                    notifications_created += 1
                    risk_alerts += 1

        # ── Rule 2: vaccinations due/overdue → vaccination_due (risk-aware, FR5.2) ──
        pet_due = due_by_pet.get(pet_id, [])
        if pet_due:
            lang = _owner_language(owner_id)
            # Which due vaccines prevent a currently predicted disease?
            prevents = tools.ontology_context([], predicted_diseases).get("preventing_vaccines", [])
            preventing_names = {p["vaccine"].lower() for p in prevents}
            for record in pet_due:
                vaccine = record.get("vaccineName", "Vaccine")
                due_at = str(record.get("nextDueAt", ""))[:10]
                overdue = str(record.get("nextDueAt", "")) < now.isoformat()
                linked = vaccine.lower() in preventing_names
                status_localized = msg(lang, "vaccine_overdue" if overdue else "vaccine_due_soon")
                vaccine_localized = localize_vaccine(vaccine, lang)
                title = msg(lang, "notif_vacc_title", pet=pet_name, vaccine=vaccine_localized, status=status_localized)
                body = msg(lang, "notif_vacc_overdue_body" if overdue else "notif_vacc_due_body", vaccine=vaccine_localized, date=due_at)
                if linked:
                    body += msg(lang, "notif_vacc_linked_suffix")
                if _notify(
                    owner_id,
                    pet_id,
                    "vaccination_due",
                    title,
                    body,
                    "high" if (overdue and linked) else "medium",
                    ref=str(record.get("id", vaccine)),
                ):
                    notifications_created += 1
                    vaccination_alerts += 1

    summary = {
        "ran_at": now.isoformat(),
        "pets_scanned": len(pets),
        "due_vaccination_records": len(due_all),
        "notifications_created": notifications_created,
        "risk_alerts": risk_alerts,
        "vaccination_alerts": vaccination_alerts,
    }
    _last_run = summary
    logger.info("Monitoring cycle: %s", summary)
    return summary


def last_run_summary() -> Optional[dict]:
    return _last_run
