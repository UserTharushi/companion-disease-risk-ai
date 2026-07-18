import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import router
from app.agents.graph import get_graph
from app.core.llm import llm_available
from app.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agent-service")


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_graph()  # compile once at startup
    logger.info("Agent graph compiled; LLM %s", "available" if llm_available() else "unavailable (rule fallback)")
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Agent Service", version="1.0.0", lifespan=lifespan)
app.include_router(router)
