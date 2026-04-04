# Contributing to NRCS EAM

## Product scope

This application is **single-organization** (Nigerian Red Cross Society). Features should assume **one deployment, one database**, not multi-tenant SaaS. Avoid introducing per-tenant subdomains, per-customer org tables, or parallel isolation layers unless there is an explicit decision to change scope.

## Branches

- **`main`** — integration branch; keep it buildable (`pnpm check`, `pnpm test` when you touch logic).
- **Feature branches** — `feature/<short-name>` or `fix/<short-name>` from `main`; open PRs into `main` when your team uses reviews.

## Secrets and operational data

- Do **not** commit real asset inventories, production exports, or credentials. Use `.env` (already gitignored) and share sample data via documented seed scripts if needed.
- The repo ignores common patterns for operational asset-register spreadsheets; keep authoritative registers in your secure storage, not in Git.

## Local development

```bash
pnpm install
cp .env.example .env
pnpm db:push
pnpm dev
```

Run `pnpm run check` before pushing TypeScript changes.

## Relationship to Techivano EAM

The broader **techivano-eam** codebase may include multi-tenant and platform features. When porting ideas from there, **adapt** them to this single-org model rather than copying tenant machinery wholesale.
