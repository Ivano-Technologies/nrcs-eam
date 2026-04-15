# Documentation index

Operational and deployment docs live here so the **repository root** stays limited to project config, `README.md`, and `CONTRIBUTING.md`.

## Architecture and decisions

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System overview, env loading, auth, routing |
| [ADR/0001-app-routing-and-auth-surfaces.md](ADR/0001-app-routing-and-auth-surfaces.md) | Decision record: `/`, `/app`, OAuth vs magic link |

## Infrastructure and hosting

| Document | Description |
|----------|-------------|
| [CUSTOM_DOMAINS_VERCEL_AWS.md](CUSTOM_DOMAINS_VERCEL_AWS.md) | Vercel SPA + API host, `CORS_ORIGINS`, `FRONTEND_ORIGIN`, `VITE_API_BASE_URL` |
| [AWS_RDS.md](AWS_RDS.md) | Legacy RDS notes (production DB is **Supabase PostgreSQL**) |
| [GITHUB_ACTIONS_FRONTEND.md](GITHUB_ACTIONS_FRONTEND.md) | Optional CI notes for frontend deploys |

## Guides

| Document | Description |
|----------|-------------|
| [BULK_IMPORT_GUIDE.md](BULK_IMPORT_GUIDE.md) | Bulk asset/site import (Excel) |
| [BULK_IMPORT_GUIDE.pdf](BULK_IMPORT_GUIDE.pdf) | PDF copy of the bulk import guide |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | General deployment checklist |
| [PWA_INSTALLATION_GUIDE.md](PWA_INSTALLATION_GUIDE.md) | PWA install and shortcuts |

## Planning and internal notes

Status reports, audits, and backlogs are under **[planning/](planning/)** (not required reading for first-time setup). Obsolete material can move to **[archive/](archive/)**.

| Path | Description |
|------|-------------|
| [planning/ENHANCEMENTS_STATUS.md](planning/ENHANCEMENTS_STATUS.md) | Enhancement tracking |
| [planning/IMPLEMENTATION_PLAN.md](planning/IMPLEMENTATION_PLAN.md) | Technical implementation notes |
| [planning/IMPROVEMENT_SUGGESTIONS.md](planning/IMPROVEMENT_SUGGESTIONS.md) | Suggested improvements |
| [planning/INACTIVE_FEATURES_AUDIT.md](planning/INACTIVE_FEATURES_AUDIT.md) | Feature audit |
| [planning/PROJECT_SUMMARY_REPORT.md](planning/PROJECT_SUMMARY_REPORT.md) | Project summary |
| [planning/todo.md](planning/todo.md) | Feature / task backlog |
| [planning/README.md](planning/README.md) | How to use `planning/` vs `archive/` |

## Other

| Path | Description |
|------|-------------|
| [../certs/README.md](../certs/README.md) | RDS TLS CA bundle (optional) |
| [archive/README.md](archive/README.md) | Where to put superseded docs |
