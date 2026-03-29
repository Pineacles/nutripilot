import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.demo_daily import seed_today
from app.rate_limit import limiter
from app.routers import agent, auth, dashboard, foods, settings as settings_router


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

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
    subprocess.run(["alembic", "upgrade", "head"], check=True, timeout=60)
    task = asyncio.create_task(_daily_demo_loop())
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
    allow_origins=settings.cors_origins.split(","),
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
