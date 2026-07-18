"""APScheduler wiring for the autonomous monitoring agent."""
from __future__ import annotations

import logging
import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.services.monitoring import run_monitoring_cycle

logger = logging.getLogger("agent-service.scheduler")

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler()
    daily_at = (os.getenv("MONITOR_DAILY_AT") or "").strip()  # e.g. "08:00"
    if daily_at and ":" in daily_at:
        hour, minute = daily_at.split(":", 1)
        _scheduler.add_job(
            run_monitoring_cycle,
            "cron",
            hour=int(hour),
            minute=int(minute),
            id="monitoring-cycle",
            max_instances=1,
            coalesce=True,
        )
        schedule_desc = f"daily at {daily_at}"
    else:
        interval_minutes = max(5, int(os.getenv("MONITOR_INTERVAL_MINUTES", "360")))
        _scheduler.add_job(
            run_monitoring_cycle,
            "interval",
            minutes=interval_minutes,
            id="monitoring-cycle",
            max_instances=1,
            coalesce=True,
        )
        schedule_desc = f"every {interval_minutes} minutes"
    _scheduler.start()
    logger.info("Monitoring scheduler started (%s)", schedule_desc)


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
