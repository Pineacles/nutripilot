import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

logger = logging.getLogger(__name__)
from app.demo_daily import seed_today
from app.docs import DESCRIPTION
from app.rate_limit import limiter
from app.routers import agent, auth, dashboard, foods, settings as settings_router
from app.services.integration_logger import setup_integration_logging
from app.services.sync_worker import run_all_syncs


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

async def _daily_tasks_loop():
    """Run demo seeder + integration syncs on startup, then daily at ~00:05 and ~06:00."""
    from datetime import datetime, timedelta

    # Startup: seed demo + sync integrations
    try:
        await seed_today()
    except Exception as e:
        logger.warning("[daily] demo seed error: %s", e)
    try:
        await run_all_syncs()
    except Exception as e:
        logger.warning("[daily] integration sync error: %s", e)

    while True:
        now = datetime.now()
        # Next run at 06:00 (integration sync time)
        next_run = (now + timedelta(days=1)).replace(hour=6, minute=0, second=0, microsecond=0)
        if now.hour < 6:
            next_run = now.replace(hour=6, minute=0, second=0, microsecond=0)
        wait_seconds = (next_run - now).total_seconds()
        await asyncio.sleep(max(wait_seconds, 60))

        try:
            await seed_today()
        except Exception as e:
            logger.warning("[daily] demo seed error: %s", e)
        try:
            await run_all_syncs()
        except Exception as e:
            logger.warning("[daily] integration sync error: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Migrations are run once before the server starts (see the api service's
    # `command` in the docker-compose files / Dockerfile CMD), not here — with
    # multiple uvicorn workers, running `alembic upgrade head` per-worker in
    # the lifespan would race.
    setup_integration_logging()
    task = asyncio.create_task(_daily_tasks_loop())
    yield
    task.cancel()


_is_production = settings.environment == "production"

app = FastAPI(
    title="NutriPilot",
    description=DESCRIPTION,
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    max_age=3600,
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
