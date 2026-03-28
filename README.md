# NutriPilot

Agent-first nutrition and weight tracking API + dashboard.

An AI agent (Claude, GPT, etc.) parses natural language like *"ate 200g chicken and rice"* and calls the API with structured data. The dashboard is read-only analytics — no manual data entry forms.

## Stack

- **Backend:** FastAPI + PostgreSQL + Alembic
- **Frontend:** Next.js 15 + Tailwind CSS + shadcn/ui + Recharts
- **Auth:** JWT (dashboard) + API key (agent)
- **Barcode:** OpenFoodFacts + USDA FoodData Central fallback
- **PWA:** Installable on iOS/Android/desktop

## Quick Start (Development)

```bash
git clone https://github.com/Pineacles/NutriPilot.git
cd NutriPilot
docker compose up --build -d
docker compose exec api python -m seed
```

- Dashboard: http://localhost:3001
- API docs: http://localhost:8001/docs
- Login: `admin@nutripilot.dev` / `nutripilot`

## Production with Cloudflare Tunnel

### 1. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
DB_PASSWORD=your-strong-db-password
JWT_SECRET=$(openssl rand -hex 32)
API_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=https://nutripilot.yourdomain.com
SEED_EMAIL=you@example.com
SEED_PASSWORD=your-password
```

### 2. Build and run

```bash
docker compose -f docker-compose.tunnel.yml up -d --build
docker compose -f docker-compose.tunnel.yml exec api python -m seed
```

### 3. Point Cloudflare Tunnel

In your Cloudflare Zero Trust dashboard, create a tunnel pointing to:

```
http://localhost:3000
```

That's it. Next.js proxies `/api/*` requests to the backend internally — only port 3000 is exposed.

### Alternative: Caddy (self-hosted HTTPS)

```bash
DOMAIN=nutripilot.yourdomain.com docker compose -f docker-compose.prod.yml up -d --build
```

Caddy auto-provisions Let's Encrypt certificates.

## API Endpoints

### Agent (API key via `X-API-Key` header)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agent/log/food` | Log food by food_id + quantity |
| `POST` | `/api/agent/log/food-by-barcode` | Barcode lookup + log in one call |
| `POST` | `/api/agent/log/supplement` | Log supplement intake |
| `POST` | `/api/agent/log/weight` | Log weight + body fat + muscle mass |
| `GET` | `/api/agent/summary/today` | Today's macros vs targets |
| `GET` | `/api/agent/summary/week` | Weekly averages + body composition |
| `GET` | `/api/agent/settings` | Read all user settings |
| `PUT` | `/api/agent/settings/nutrition-targets` | Update macro targets |
| `GET` | `/api/agent/supplements` | List supplement definitions |
| `POST` | `/api/agent/supplements` | Create supplement definition |
| `GET` | `/api/foods/search?q=` | Fuzzy food search |
| `GET` | `/api/foods/barcode/{code}` | Barcode lookup (local + OFF + USDA) |
| `POST` | `/api/foods` | Add food manually |

### Agent Integration Example

```python
import httpx

API = "https://nutripilot.yourdomain.com"
HEADERS = {"X-API-Key": "your-api-key"}

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
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `API_KEY` | Yes | Agent API key |
| `CORS_ORIGINS` | Yes | Allowed origins (comma-separated) |
| `SEED_EMAIL` | No | Initial user email |
| `SEED_PASSWORD` | No | Initial user password |
| `USDA_API_KEY` | No | USDA FoodData Central API key |
| `DB_USER` | No | PostgreSQL user (default: nutripilot) |
| `DB_NAME` | No | PostgreSQL database (default: nutripilot) |

## License

MIT
