import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.demo_daily import seed_today
from app.routers import agent, auth, dashboard, foods, settings as settings_router

DESCRIPTION = """
**NutriPilot** is an agent-first nutrition and weight tracking API.

An AI agent parses natural language and calls these endpoints with structured data.
The dashboard is read-only analytics.

## Auth
- **Agent endpoints** (`/api/agent/*`, `/api/foods/*`): API key via `X-API-Key` header
- **Dashboard endpoints** (`/api/dashboard/*`, `/api/v1/*`): JWT Bearer token via `Authorization` header
"""


async def _daily_demo_loop():
    """Run demo seeder once on startup, then every 24h at ~00:05."""
    try:
        await seed_today()
    except Exception as e:
        print(f"[demo_daily] startup seed error: {e}")
    while True:
        # Sleep until next 00:05
        from datetime import datetime, timedelta
        now = datetime.now()
        tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=5, second=0, microsecond=0)
        wait_seconds = (tomorrow - now).total_seconds()
        await asyncio.sleep(wait_seconds)
        try:
            await seed_today()
        except Exception as e:
            print(f"[demo_daily] daily seed error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import subprocess
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    task = asyncio.create_task(_daily_demo_loop())
    yield
    task.cancel()


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
