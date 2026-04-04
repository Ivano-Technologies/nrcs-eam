# NRCS Enterprise Asset Management (EAM)

Single-organization web application for the **Nigerian Red Cross Society** to manage assets, maintenance, work orders, inventory, compliance, and related reporting.

## Scope

- **Single-tenant:** one NRCS deployment—not a multi-tenant SaaS. There is no per-customer subdomain or org-isolation layer like the broader Techivano EAM platform.
- **Straightforward stack:** Vite + React, Express + tRPC, Drizzle ORM, MySQL (via `DATABASE_URL`). Optional QuickBooks, S3, and email integrations as configured in your environment.

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

## License

MIT — see `LICENSE` if present; otherwise refer to your organization’s policy for deployment artifacts.
