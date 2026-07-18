"""Small in-memory TTL cache to avoid duplicate LLM calls on page refreshes."""
from __future__ import annotations

import time
from typing import Any, Optional

_store: dict[str, tuple[float, Any]] = {}

DEFAULT_TTL_SECONDS = 15 * 60
_MAX_ENTRIES = 500


def get(key: str) -> Optional[Any]:
    entry = _store.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if time.monotonic() > expires_at:
        _store.pop(key, None)
        return None
    return value


def put(key: str, value: Any, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> None:
    if len(_store) >= _MAX_ENTRIES:
        _store.clear()
    _store[key] = (time.monotonic() + ttl_seconds, value)
