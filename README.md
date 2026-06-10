# NutriPilot

Agent-first nutrition and weight tracking API + dashboard.

An AI agent (Claude, GPT, etc.) parses natural language like *"ate 200g chicken and rice"* and calls the API with structured data. The dashboard is read-only analytics — no manual data entry forms.

## Stack

- **Backend:** FastAPI + PostgreSQL + Alembic
- **Frontend:** Next.js 15 + Tailwind CSS + shadcn/ui + Recharts
- **Auth:** JWT (dashboard) + API key (agent)
- **Barcode:** OpenFoodFacts + USDA FoodData Central fallback
- **PWA:** Installable on iOS/Android/desktop

## Architecture

```
┌──────────────────────────────────────────────┐
│  AI Agent (NanoClaw/Claude)                  │
│  X-API-Key → /api/agent/*                    │
└──────────────┬───────────────────────────────┘
               │ HTTPS via Cloudflare Tunnel
┌──────────────▼───────────────────────────────┐
│  Next.js (port 3099 / :3000 in tunnel mode)  │
│  /api/* → rewrites → FastAPI :8000           │
├──────────────────────────────────────────────┤
│  FastAPI (port 8099 / internal :8000)        │
│  • /api/agent/*  — API key auth              │
│  • /api/dashboard/* — JWT auth (UI)          │
│  • /api/v1/*     — JWT auth (settings)       │
│  • /api/foods/*  — API key auth              │
├──────────────────────────────────────────────┤
│  PostgreSQL (port 127.0.0.1:5488 / :5432)    │
│  • foods / nutrients (pg_trgm fuzzy search)  │
│  • food_logs / weight_logs / supplement_logs  │
│  • integrations (sync worker, OAuth tokens)  │
└──────────────────────────────────────────────┘
```

### Withings / Smart Scale Connection

The sync worker handles OAuth token lifecycle. The AI agent sets up an integration by calling:

1. `POST /api/agent/integrations` with the Withings `field_mapping` (including OAuth tokens)
2. The sync worker calls `WBSAPI /measure` every 6 hours and writes weight/body-comp to `weight_logs`
3. To force a sync: `POST /api/agent/integrations/{id}/sync`

Supported integrations: `withings_measure`, `fitbit_body`, `google_fit`, `garmin_body`, `generic_json`

## Quick Start (Development)

```bash
git clone https://github.com/Pineacles/NutriPilot.git
cd NutriPilot
cp .env.example .env
# Edit .env — at minimum set POSTGRES_PASSWORD, JWT_SECRET, API_KEY
docker compose up --build -d
docker compose exec api python -m seed
```

- Dashboard: http://localhost:3099
- API docs: http://localhost:8099/docs
- Login with the credentials set in `SEED_EMAIL` / `SEED_PASSWORD` in your `.env`

## Production with Cloudflare Tunnel

### 1. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
POSTGRES_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
API_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=https://nutripilot.yourdomain.com
SEED_EMAIL=you@example.com
SEED_PASSWORD=$(openssl rand -base64 16)
```

### 2. Build and run

```bash
docker compose up -d --build
docker compose exec api python -m seed
```

### 3. Point Cloudflare Tunnel

In your Cloudflare Zero Trust dashboard, create a tunnel pointing to:

```
http://localhost:3099
```

Next.js proxies `/api/*` requests to the backend internally — only port 3099 is exposed to the tunnel.

## Screenshots

> _Add screenshots of dashboard pages here_

## API Endpoints

### Agent (API key via `X-API-Key` header)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agent/log/food` | Log food by food_id + quantity |
| `POST` | `/api/agent/log/food-by-barcode` | Barcode lookup + log in one call |
| `POST` | `/api/agent/log/food-by-name` | Fuzzy name match + log |
| `POST` | `/api/agent/log/supplement` | Log supplement intake |
| `POST` | `/api/agent/log/weight` | Log weight + body fat + muscle mass |
| `GET` | `/api/agent/summary/today` | Today's macros vs targets |
| `GET` | `/api/agent/summary/week` | Weekly averages + body composition |
| `GET` | `/api/agent/summary/stats` | 1–365 day stats with streaks |
| `GET` | `/api/agent/nutrient-sources` | Which foods contributed to a nutrient |
| `GET` | `/api/agent/settings` | Read all user settings |
| `PUT` | `/api/agent/settings/nutrition-targets` | Update macro targets |
| `GET` | `/api/agent/integrations` | List connected scales/APIs |
| `POST` | `/api/agent/integrations` | Connect a smart scale or JSON API |
| `POST` | `/api/agent/integrations/{id}/sync` | Trigger manual sync |
| `GET` | `/api/foods/search?q=` | Fuzzy food search |
| `GET` | `/api/foods/barcode/{code}` | Barcode lookup (local + OFF + USDA) |
| `POST` | `/api/foods` | Add food manually |

### Agent Integration Example

```python
import httpx

API = "https://nutripilot.yourdomain.com"
HEADERS = {"X-API-Key": "your-api-key"}  # from API_KEY in .env

# Search for a food
foods = httpx.get(f"{API}/api/foods/search?q=chicken", headers=HEADERS).json()

# Log it
httpx.post(f"{API}/api/agent/log/food", headers=HEADERS, json={
    "food_id": foods[0]["id"],
    "quantity_g": 200,
    "meal_type": "lunch",
})

# Log by barcode (one call)
httpx.post(f"{API}/api/agent/log/food-by-barcode", headers=HEADERS, json={
    "barcode": "3017620422003",
    "quantity_g": 30,
    "meal_type": "snack",
})

# Check today's summary
summary = httpx.get(f"{API}/api/agent/summary/today", headers=HEADERS).json()
print(f"Calories: {summary['totals']['kcal']} / {summary['targets']['kcal']}")
```

## Dashboard Pages

- **Daily** — Calorie ring, macro breakdown (protein/carbs/fat/fiber/sugar/sodium), meals, supplements
- **Weekly** — Calorie chart, weight trend, body fat %, muscle mass %, macro averages, micronutrients
- **Foods** — Searchable food database with full nutrient breakdown
- **Scanner** — Camera barcode scanner + manual entry
- **Statistics** — Weight/body comp history, calorie trends, macro distribution, records, streaks
- **Settings** — Nutrition targets, supplement management, micronutrient targets, API key

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `JWT_SECRET` | Yes | Secret for JWT signing (min 32 chars) |
| `API_KEY` | Yes | Agent API key |
| `CORS_ORIGINS` | Yes | Allowed origins (comma-separated) |
| `DATABASE_URL` | No | Full DSN (auto-derived if not set) |
| `POSTGRES_USER` | No | PostgreSQL user (default: nutripilot) |
| `POSTGRES_DB` | No | PostgreSQL database (default: nutripilot) |
| `SEED_EMAIL` | No | Initial user email (for seed.py) |
| `SEED_PASSWORD` | No | Initial user password (for seed.py) |
| `USDA_API_KEY` | No | USDA FoodData Central API key |

## License

MIT — see [LICENSE](LICENSE)
