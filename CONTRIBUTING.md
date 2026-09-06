# Contributing to NRCS EAM

## Product scope

This application is **single-organization** (Nigerian Red Cross Society). Features should assume **one deployment, one database**, not multi-tenant SaaS. Avoid introducing per-tenant subdomains, per-customer org tables, or parallel isolation layers unless there is an explicit decision to change scope.

## Branches

- **`main`** and **`blue`** — keep them in sync; keep both buildable (`pnpm check`, `pnpm test` when you touch logic).
- **Feature branches** — `feature/<short-name>` or `fix/<short-name>` from `blue` (or `main`); open PRs into `blue` unless the work is explicitly for `main`.

## Secrets and operational data

- Do **not** commit real asset inventories, production exports, or credentials. Use `.env` (already gitignored) and share sample data via documented seed scripts if needed.
- **`.gitignore`** excludes common operational dumps: `*.xlsx`, `*.xls`, `*.csv`, `/data/`, `/uploads/`, `/import-exports/`. To add a vetted template under `docs/templates/`, adjust `.gitignore` with negated patterns. Keep authoritative registers in secure storage, not in Git.
- The **`.manus/db/`** directory (Manus IDE SQL query caches) must stay ignored — those files are not auth source code and can embed **database host and usernames** in saved commands. See `.manus/README.md`.

## Local development

```bash
pnpm install
cp .env.example .env
pnpm db:push
pnpm dev
```

Run `pnpm run check` before pushing TypeScript changes.

## Test database (required)

Automated tests and `scripts/db/seed-db.mjs` **must not** use production. They read **`TEST_DATABASE_URL` only** and refuse to start if it is unset, if `NODE_ENV=production`, or if the host matches the live Supabase project (`gdseyeyedpzyhczvnzug`). They never fall back to `DATABASE_URL`.

`.env` may still hold a production `DATABASE_URL` for `pnpm dev`. Test setup overwrites `process.env.DATABASE_URL` with `TEST_DATABASE_URL` for that process only.

### Local Postgres

```bash
# Option A — local Postgres (or `npx supabase start` and use its DB URL)
createdb nrcs_eam_test
export TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/nrcs_eam_test
pnpm db:bootstrap
pnpm exec drizzle-kit migrate
pnpm test
```

### Dedicated Supabase project or branch

Create a separate project or a persistent branch database. Put that connection string in `TEST_DATABASE_URL`. Do not use the production project ref.

Add the same key to `.env` (gitignored):

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/nrcs_eam_test
```

`pnpm db:seed` and `pnpm db:setup` also require `TEST_DATABASE_URL`. They insert HQ / Lagos / Kano fixtures and must never run against production.

**Documentation:** operational and deployment guides are listed in **[docs/README.md](docs/README.md)** (AWS, Vercel, bulk import, PWA). Planning notes and backlogs live under **`docs/planning/`**.

## Relationship to Techivano EAM

The broader **techivano-eam** codebase may include multi-tenant and platform features. When porting ideas from there, **adapt** them to this single-org model rather than copying tenant machinery wholesale.
