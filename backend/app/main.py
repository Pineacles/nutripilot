from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import agent, auth, dashboard, foods, settings as settings_router

DESCRIPTION = """
**NutriPilot** is an agent-first nutrition and weight tracking API.

An AI agent parses natural language and calls these endpoints with structured data.
The dashboard is read-only analytics.

## Auth
- **Agent endpoints** (`/api/agent/*`, `/api/foods/*`): API key via `X-API-Key` header
- **Dashboard endpoints** (`/api/dashboard/*`, `/api/v1/*`): JWT Bearer token via `Authorization` header
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    import subprocess
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    yield


app = FastAPI(
    title="NutriPilot",
    description=DESCRIPTION,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
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
app.include_router(settings_router.router)


@app.get("/health", tags=["system"])
async def health():
    """Health check endpoint."""
    return {"status": "ok"}
