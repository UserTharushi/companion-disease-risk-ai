"""Relationship-based access control for veterinarians.

A vet may read a pet's AI assessments only while an active grant links them to
that pet. Grants live in clinic-service and are created either by booking an
appointment with that vet or by the owner explicitly sharing the pet.

Stdlib urllib on purpose: ai-service has no HTTP client dependency and this is
one small internal call, so there is no reason to add one.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger("ai-service.access")

CLINIC_SERVICE_URL = os.getenv("CLINIC_SERVICE_URL", "http://localhost:4003")
SERVICE_KEY = os.getenv("SERVICE_KEY", "internal-dev-key")
_TIMEOUT_SECONDS = 4


def granted_pet_ids(vet_user_id: str) -> list[str]:
    """Pet ids this vet currently holds an active grant for.

    Fails closed: any error returns an empty list, so an unreachable grant
    registry hides records rather than exposing every pet's assessments.
    """
    if not vet_user_id:
        return []
    query = urllib.parse.urlencode({"vetUserId": vet_user_id})
    url = f"{CLINIC_SERVICE_URL}/api/access-grants?{query}"
    request = urllib.request.Request(url, headers={"x-service-key": SERVICE_KEY})
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as ex:
        logger.warning("Access-grant lookup failed; denying vet access: %s", ex)
        return []
    return [
        str(grant.get("petId"))
        for grant in (body.get("data") or [])
        if grant.get("active") and grant.get("petId")
    ]


def vet_may_access(vet_user_id: str, pet_id: str | None) -> bool:
    return bool(pet_id) and str(pet_id) in granted_pet_ids(vet_user_id)
