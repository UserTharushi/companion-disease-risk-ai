from fastapi import FastAPI
from app.api.router import router

app = FastAPI(title="AI Service", version="1.0.0")
app.include_router(router)
