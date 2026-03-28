from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import agent, auth, dashboard, foods


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run alembic migrations on startup
    import subprocess
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    yield


app = FastAPI(
    title="NutriPilot",
    description="Agent-first nutrition and weight tracking API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(foods.router)
app.include_router(agent.router)
app.include_router(dashboard.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
