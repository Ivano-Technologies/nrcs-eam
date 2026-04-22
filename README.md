# NRCS Enterprise Asset Management (EAM)

Single-organization web application for the **Nigerian Red Cross Society** to manage assets, maintenance, work orders, inventory, compliance, and related reporting.

## Scope

- **Single-tenant:** one NRCS deployment—not a multi-tenant SaaS. There is no per-customer subdomain or org-isolation layer like the broader Techivano EAM platform.
- **Stack:** Vite + React, Express + tRPC, Drizzle ORM, **PostgreSQL** (Supabase). **Supabase Auth** for sessions. Optional QuickBooks, S3, and email integrations as configured in your environment.

## Repository layout

| Path | Purpose |
|------|---------|
| `client/` | Vite + React SPA (`src/`, `public/`) |
| `server/` | Express + tRPC API |
| `shared/` | Types and constants used by client and server |
| `drizzle/` | Drizzle schema and migrations |
| `docs/` | **Documentation index:** [docs/README.md](docs/README.md) — architecture, ADRs, guides |
| `docs/planning/` | Active planning notes; move obsolete docs to `docs/archive/` |
| `docs/ADR/` | Architecture decision records |
| `scripts/` | Build helpers, **`scripts/db/`** for DB utilities |
| `.github/` | GitHub Actions workflows |

## Requirements

- Node.js 20+
- pnpm 10.x (`package.json` → `packageManager`)
- **PostgreSQL** reachable via `DATABASE_URL` (use **Supabase** in production: host contains `supabase.co`)

## Setup

```bash
pnpm install
cp .env.example .env
# Edit .env — at minimum DATABASE_URL (Supabase pooler URL), SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
pnpm exec drizzle-kit migrate
pnpm dev
```

## Vercel (frontend)

Production SPA is built and deployed from this repo via **Vercel** (Git integration on `main` uses root [`vercel.json`](vercel.json): `pnpm run build:frontend`, output `dist/public`).

**Required in Vercel → Settings → Environment variables (Build + Production):**

| Variable | Notes |
|----------|--------|
| `VITE_API_BASE_URL` | **HTTPS API origin** (no trailing slash) where Express runs, e.g. `https://api.example.com`. Without this, the SPA requests same-origin `/api/trpc`, which only works if the API is served from the same host. |
| `VITE_SUPABASE_URL` | Same value as `SUPABASE_URL` (public). |
| `VITE_SUPABASE_ANON_KEY` | Same value as `SUPABASE_ANON_KEY` (public anon key). |

**Server / API host** (wherever Node runs: VPS, Railway, Fly, Vercel serverless adapter, etc.) needs: `DATABASE_URL`, `SUPABASE_*`, `FRONTEND_ORIGIN`, `CORS_ORIGINS`, etc. See [`.env.example`](.env.example).

**Database:** `DATABASE_URL` must point at **Supabase PostgreSQL** (e.g. `postgresql://...@aws-0-....pooler.supabase.com:6543/postgres` or `...@db....supabase.co:5432/...`). Do **not** use an AWS RDS `amazonaws.com` host.

Open the app at the URL printed by the dev server (typically `http://localhost:3000`).

## Scripts

| Script        | Description                                      |
|---------------|--------------------------------------------------|
| `pnpm dev`    | Dev server (Express + Vite client)               |
| `pnpm build`  | Production client + server bundle                  |
| `pnpm start`  | Run production build                             |
| `pnpm check`  | Typecheck                                        |
| `pnpm test`   | Vitest                                           |
| `pnpm exec drizzle-kit migrate` | Apply Drizzle SQL migrations (`drizzle/`) |
| `pnpm db:reset` | Truncate app tables (see `scripts/db/`)        |
| `pnpm db:seed` | Seed minimal sites and categories               |
| `pnpm db:seed:sample` | Larger sample dataset                    |
| `pnpm db:cleanup` | Legacy cleanup (see `scripts/db/`)   |

## MVP audit E2E auth

`tests/mvp-audit` now authenticates with Supabase session bootstrap instead of a seeded magic-token table.

- Required in `.env.e2e`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Optional: `E2E_SUPABASE_PASSWORD` (defaults to `E2E_Supabase_ChangeMe_9!`)
- `pnpm run seed-e2e:local` ensures the app `users` row plus Supabase Auth user exist and are linked.
- Playwright setup (`tests/mvp-audit/auth.setup.ts`) signs in via Supabase, injects `sb-access-token` and `sb-refresh-token` cookies, and writes `playwright/.auth/mvp-audit-user.json`.
- All mvp-audit specs reuse that `storageState`; the only real `/auth/verify` path coverage is `tests/mvp-audit/specs/auth-magic-link-smoke.spec.ts`.

## Repository

This repo is the **canonical home** for NRCS EAM work. It is intentionally slimmer than the multi-tenant `techivano-eam` codebase and should stay maintainable for one organization.

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for branching, data-handling rules, and scope (single-organization).

## License

MIT — see `LICENSE` if present; otherwise refer to your organization’s policy for deployment artifacts.
