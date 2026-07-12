# NutriPilot: frontend

Next.js 15 dashboard for NutriPilot. Read-only-by-default analytics plus full
CRUD for food logs, custom foods, body comp, supplements, water, and settings.

## Stack

- **Next.js 16**, App Router, TypeScript in strict mode
- **Tailwind CSS** + **shadcn/ui** components
- **TanStack Query** for all server state (queries in `src/hooks/queries.ts`,
  mutations in `src/hooks/mutations/*`), no manual fetch-and-setState
- **sonner** for toasts
- **Recharts** for charts, **@zxing** for the camera barcode scanner

## Dev commands

```bash
npm ci
npm run dev     # dev server on :3000
npm run lint    # eslint
npm run build   # production build (also run in CI)
npm run start   # run a production build locally
```

## How API calls work

The frontend never calls the backend cross-origin. `next.config.ts` rewrites
`/api/*` (plus `/health`, `/docs`, `/openapi.json`) to the FastAPI service:

```ts
destination: `${process.env.INTERNAL_API_URL || "http://api:8000"}/api/:path*`
```

`INTERNAL_API_URL` is a server-side-only env var (never exposed to the
browser) pointing at the API container: inside Docker Compose it defaults to
`http://api:8000`; in the Cloudflare Tunnel profile it's set explicitly. The
browser only ever fetches same-origin `/api/...` paths, so there's no CORS
configuration needed between the dashboard and the API, and no API base URL
to leak client-side. `src/lib/api.ts` is the single fetch wrapper all
queries/mutations go through (auth header injection, error unwrapping).

## Structure

```
src/
├── app/            # App Router pages: today, weekly, foods, scanner,
│                   # statistics, settings, body, login
├── components/
│   ├── ui/         # shadcn/ui primitives
│   └── <domain>/   # food-log, foods, body, settings, statistics, charts
├── hooks/
│   ├── queries.ts        # TanStack Query read hooks
│   └── mutations/        # one file per domain (food-log, foods,
│                          # integrations, supplement-log, water, weight)
└── lib/
    ├── api.ts            # fetch wrapper (auth, error handling)
    ├── auth.ts            # JWT storage/refresh
    ├── types.ts            # shared API response/request types
    └── *.ts                 # formatting, dates, chart utils, validation
```
