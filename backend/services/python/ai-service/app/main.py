import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import router
from app.services import model_store, ontology

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    model_store.load_models()
    ontology.apply_schema()
    yield
    ontology.close()


app = FastAPI(title="AI Service", version="1.0.0", lifespan=lifespan)
app.include_router(router)
