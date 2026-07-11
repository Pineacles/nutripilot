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

DESCRIPTION = """\
NutriPilot is an agent-first nutrition, body-composition, and wellness tracking API.
You (the AI agent) parse natural language from the user, then call these endpoints with structured JSON.
The dashboard (`/api/dashboard/*`) is read-only analytics consumed by the frontend.

---

## What you can do

| Domain | Actions |
|---|---|
| **Food** | Search the database (local + OpenFoodFacts fallback), look up by barcode, create new foods with full macro+micro nutrient profiles, update, delete |
| **Food logging** | Log food by ID, barcode, or fuzzy name match. Specify quantity in grams or servings. Assign to a meal (breakfast / lunch / dinner / snack) and date. Update or delete entries. View a full daily log with per-item consumed nutrients and per-100g reference values |
| **Weight & body comp** | Log weight (kg), body fat (% or kg), muscle mass (% or kg). Filter by source or date range. Update or delete entries |
| **Supplements** | Define supplement profiles with dose and micronutrient content. Log daily supplement intake with dose, unit, and time of day. Update or delete entries |
| **Water** | Log water intake (ml). Update or delete entries |
| **Caffeine** | Tracked automatically via food nutrients (`caffeine_mg` per 100g). Log a caffeinated food/drink and caffeine is counted. No separate caffeine logging needed |
| **Summaries** | Get today's full nutrition snapshot (macros, micros, meals, supplements, water, caffeine vs targets). Get weekly averages and body comp trends. Get 1-365 day stats with streaks, records, and adherence |
| **Nutrient sources** | Find which foods and supplements contributed to any nutrient (e.g. "where did my zinc come from today?"), ranked by amount |
| **Settings** | Read and update macro targets (kcal, protein, carbs, fat, fiber, sugar, sodium, alcohol, water, caffeine). Set micronutrient targets. Manage supplement definitions. Regenerate API key |
| **Integrations** | Connect smart scales (Withings, Fitbit Aria, Google Fit, Garmin Index) or any JSON API. Auto-sync on a cron schedule. Trigger manual sync |

---

## Auth

| Endpoint prefix | Method | Header |
|---|---|---|
| `/api/agent/*`, `/api/foods/*` | JWT Bearer OR X-API-Key | `Authorization: Bearer <token>` or `X-API-Key: <key>` |
| `/api/dashboard/*`, `/api/v1/*` | JWT Bearer | `Authorization: Bearer <token>` |

Get a JWT via `POST /api/auth/login` (email + password). Refresh via `POST /api/auth/refresh`.

---

## Key conventions

- **Dates** default to today when omitted. Format: `YYYY-MM-DD`.
- **Quantity resolution** for food logging: `quantity_g` takes priority → then `servings * serving_size_g` → then `servings * 100` → fallback `100g`.
- **Nutrients per 100g** are stored in the database. Consumed nutrients are calculated as `value * (quantity_g / 100)`.
- **Sodium** is derived from salt: `salt_g * 400 = sodium_mg`.
- **Meal types**: `breakfast`, `lunch`, `dinner`, `snack`.
- **Dose units**: `mg`, `g`, `IU`, `mcg`, `µg`, `ml`.
- **Supplement times**: `morning`, `afternoon`, `evening`.
- **Error responses** include a `code` field (e.g. `FOOD_NOT_FOUND`, `LOG_NOT_FOUND`, `BARCODE_NOT_FOUND`) for programmatic handling.
- **IDs** are UUIDs.
- All `DELETE` endpoints return `204 No Content`.

---

## Nutrient fields

**Macros (per food):** kcal, protein, carbs, sugar, fiber, fat, sat_fat, salt, alcohol, caffeine_mg — all per 100g.

**Micros (per food):** calcium, potassium, omega3, zinc, vit_d, vit_k2, vit_c, magnesium, b12, iron — all per 100g.

**Body comp targets (for integrations):** weight_kg, body_fat_pct, muscle_mass_pct, body_fat_kg, muscle_mass_kg.

---

## CRITICAL: Do NOT call external APIs directly

**NEVER call third-party APIs (Withings, Fitbit, Google Fit, Garmin, etc.) directly.**
All integrations are managed by NutriPilot's sync worker. If you call an external OAuth endpoint
yourself (e.g. Withings `requesttoken`), you will **consume the refresh token** and permanently
break the integration — Withings and Fitbit rotate refresh tokens on every use, so the one stored
in NutriPilot becomes dead and all future syncs fail with a permanent auth error.

**Instead, use NutriPilot's integration endpoints:**
- `GET /api/agent/integrations` — check integration status
- `POST /api/agent/integrations/{id}/sync` — trigger a manual data sync (fetches latest data from the scale)
- `POST /api/agent/integrations` — set up a new integration
- `PATCH /api/agent/integrations/{id}` — update integration config
- `DELETE /api/agent/integrations/{id}` — remove an integration

**If the user asks to "sync my scale" or "get my latest weight from Withings":**
→ Call `POST /api/agent/integrations/{id}/sync` — this handles token refresh, API calls, and data storage safely.

**If sync fails with `needs_reauth`:**
→ The user must re-authorize through the OAuth flow to get fresh tokens. You cannot fix this by calling the provider API.

---

## Typical agent workflows

1. **"I had 200g of chicken breast for lunch"** → `POST /api/agent/log/food-by-name` with `{food_name: "chicken breast", quantity_g: 200, meal_type: "lunch"}`
2. **"Scan this barcode: 5000112611304"** → `POST /api/agent/log/food-by-barcode` with `{barcode: "5000112611304", servings: 1, meal_type: "snack"}`
3. **"How am I doing today?"** → `GET /api/agent/summary/today`
4. **"Where is my protein coming from?"** → `GET /api/agent/nutrient-sources?nutrient=protein`
5. **"I weigh 82.5kg this morning"** → `POST /api/agent/log/weight` with `{weight_kg: 82.5}`
6. **"Log 500ml water"** → `POST /api/agent/log/water` with `{amount_ml: 500}`
7. **"I had a coffee"** → `POST /api/agent/log/food-by-name` with `{food_name: "coffee", quantity_g: 250, meal_type: "snack"}` (caffeine is tracked automatically from the food's nutrient profile)
8. **"Set my protein target to 160g"** → `GET /api/agent/settings` first to get current values, then `PUT /api/agent/settings/nutrition-targets` with all fields
9. **"Connect my Withings scale"** → `POST /api/agent/integrations` with the withings_measure field_mapping
10. **"Sync my scale now"** → `GET /api/agent/integrations` to find the ID, then `POST /api/agent/integrations/{id}/sync`
11. **"What food has the most iron?"** → `GET /api/agent/nutrient-sources?nutrient=iron`
"""


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
    import subprocess
    subprocess.run(["alembic", "upgrade", "head"], check=True, timeout=60)
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
