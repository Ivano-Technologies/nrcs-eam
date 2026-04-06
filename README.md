# NRCS Enterprise Asset Management (EAM)

Single-organization web application for the **Nigerian Red Cross Society** to manage assets, maintenance, work orders, inventory, compliance, and related reporting.

## Scope

- **Single-tenant:** one NRCS deployment—not a multi-tenant SaaS. There is no per-customer subdomain or org-isolation layer like the broader Techivano EAM platform.
- **Straightforward stack:** Vite + React, Express + tRPC, Drizzle ORM, MySQL (via `DATABASE_URL`). Optional QuickBooks, S3, and email integrations as configured in your environment.

## Repository layout

| Path | Purpose |
|------|---------|
| `client/` | Vite + React SPA (`src/`, `public/`) |
| `server/` | Express + tRPC API |
| `shared/` | Types and constants used by client and server |
| `drizzle/` | Drizzle schema and migrations |
| `docs/` | **Documentation index:** [docs/README.md](docs/README.md) — AWS, Vercel, bulk import, PWA, deployment |
| `docs/planning/` | Internal status reports, audits, backlog (optional reading) |
| `scripts/` | Build helpers, deploy scripts, **`scripts/db/`** for DB utilities |
| `.github/` | GitHub Actions workflows |

## Requirements

- Node.js 22+
- pnpm 10.x (`package.json` → `packageManager`)
- MySQL-compatible database reachable via `DATABASE_URL`

## Setup

```bash
pnpm install
cp .env.example .env
# Edit .env — at minimum DATABASE_URL and JWT_SECRET
pnpm db:push
pnpm dev
```

**AWS RDS (MySQL):** use a standard `mysql://` URL, set **`DATABASE_SSL=true`** for TLS, then run migrations. See **[docs/AWS_RDS.md](docs/AWS_RDS.md)** for VPC, security groups, and checklist.

**AWS App Runner:** production uses **`pnpm build`** then **`pnpm start`** (`node dist/index.js`). See **[docs/AWS_APP_RUNNER.md](docs/AWS_APP_RUNNER.md)** for build/start commands, VPC connector, and RDS security groups.

Open the app at the URL printed by the dev server (typically `http://localhost:3000`).

## Scripts

| Script        | Description                                      |
|---------------|--------------------------------------------------|
| `pnpm dev`    | Dev server (Express + Vite client)               |
| `pnpm build`  | Production client + server bundle                |
| `pnpm start`  | Run production build                             |
| `pnpm check`  | Typecheck                                        |
| `pnpm test`   | Vitest                                           |
| `pnpm db:push`| Generate + apply Drizzle migrations              |

## Repository

This repo is the **canonical home** for NRCS EAM work. It is intentionally slimmer than the multi-tenant `techivano-eam` codebase and should stay maintainable for one organization.

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for branching, data-handling rules, and scope (single-organization).

## License

MIT — see `LICENSE` if present; otherwise refer to your organization’s policy for deployment artifacts.
