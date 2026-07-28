import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import router
from app.services import model_store, ontology

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service.startup")

# Neo4j needs roughly 70 seconds to expose Bolt because the graph-data-science
# plugin is slow to load. The compose healthcheck gates `docker compose up`, but
# `docker compose restart` restarts containers in place without re-evaluating
# depends_on, so this service can still win the race and find Neo4j unreachable.
# Applying the schema once at startup then left the graph silently empty, which
# disables every ontology explanation without raising an error anywhere.
_ONTOLOGY_RETRY_DELAYS = [5, 10, 15, 20, 30, 30, 30, 30]


async def _apply_ontology_with_retry() -> None:
    """Keep trying until Neo4j accepts the schema. apply_schema is idempotent."""
    if ontology.apply_schema():
        return
    for delay in _ONTOLOGY_RETRY_DELAYS:
        await asyncio.sleep(delay)
        if ontology.apply_schema():
            logger.info("Ontology applied after waiting for Neo4j")
            return
    logger.warning(
        "Ontology could not be applied after %d attempts; explanations will be "
        "degraded until Neo4j is reachable and this service restarts",
        len(_ONTOLOGY_RETRY_DELAYS) + 1,
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    model_store.load_models()
    # Retry in the background so a slow Neo4j never delays readiness: the
    # service can already serve predictions without the ontology.
    task = asyncio.create_task(_apply_ontology_with_retry())
    yield
    task.cancel()
    ontology.close()


app = FastAPI(title="AI Service", version="1.0.0", lifespan=lifespan)
app.include_router(router)
