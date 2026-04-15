# Custom domains: hybrid Vercel SPA + API

The apex site (e.g. **techivano.com**) can stay on **Vercel**. This product uses **subdomains**; DNS often stays in Vercel.

## Primary architecture (recommended)

| Host | Service |
|------|---------|
| `nrcseam.techivano.com` | **Vercel** — Vite SPA (CDN + HTTPS) |
| `api.nrcseam.techivano.com` (or your API host) | **Node** — Express + tRPC (same repo `pnpm build` + `pnpm start`, or any host you choose) |
| Database | **Supabase PostgreSQL** (pooler URL in `DATABASE_URL`) |

Browser loads the SPA from Vercel; API calls use `VITE_API_BASE_URL` ([`client/src/lib/apiBase.ts`](../client/src/lib/apiBase.ts)). Backend CORS uses `CORS_ORIGINS` ([`server/_core/corsConfig.ts`](../server/_core/corsConfig.ts)).

## Vercel project settings (important)

[`vite.config.ts`](../vite.config.ts) lives at the **repository root** (not inside `client/`). It sets `root` to `client/` and **`build.outDir` to `dist/public`** at the repo root.

Use one of these approaches:

### Recommended: root directory = repository root

| Setting | Value |
|---------|--------|
| Root Directory | `.` (repo root) |
| Install Command | `pnpm install` (requires committed `pnpm-lock.yaml`; see troubleshooting) |
| Build Command | `pnpm run build:frontend` |
| Output Directory | `dist/public` |

Do **not** set Output to `dist` only — the build writes to **`dist/public`**. [`vercel.json`](../vercel.json) in the repo pins these for convenience.

**SPA client routes:** [`vercel.json`](../vercel.json) includes **`rewrites`** so deep links (e.g. `/app/assets`) serve `index.html` instead of 404, similar to CloudFront custom error responses. Vite emits built JS/CSS under `/assets/...` (static filenames); those are served as files before the SPA rewrite applies.

### Alternative: Root Directory = `client`

Not supported out of the box: there is no `vite.config.ts` under `client/` in this repo. You would need a separate config and path fixes. Prefer **repo root** as above.

### Environment variables (Vercel → Project → Settings)

| Variable | Production example |
|----------|---------------------|
| `VITE_API_BASE_URL` | `https://api.nrcseam.techivano.com` (no trailing slash) |

| Context | `VITE_API_BASE_URL` |
|---------|---------------------|
| Local dev | `http://localhost:3000` (or your API port) |
| Vercel Production | `https://api.nrcseam.techivano.com` |

After changing **`VITE_*`** variables in Vercel, trigger a **new deployment** so the bundle picks them up.

### Domain

1. Vercel → **Domains** → add `nrcseam.techivano.com`.
2. If DNS is already on Vercel, follow the wizard (often a **CNAME** `nrcseam` → `cname.vercel-dns.com`).

## API host + DNS

1. Point **`api.*`** (or your API hostname) at wherever Node runs (A/CNAME/ALIAS per your provider).
2. If the API is on a **different host** than the Vercel SPA, set **`VITE_API_BASE_URL`** at Vite build time to that API origin (`https://api...`).

### API (runtime) env

| Variable | Example |
|----------|---------|
| `CORS_ORIGINS` | `https://nrcseam.techivano.com` |
| `FRONTEND_ORIGIN` | `https://nrcseam.techivano.com` (magic-link `emailRedirectTo` base URL) |
| `SESSION_COOKIE_DOMAIN` | `.techivano.com` (optional; cookie across subdomains) |

`VITE_*` is only for **Vite build** (Vercel / CI), not for the Node API process.

### OAuth and magic links (do not confuse the URLs)

- **OAuth redirect URI:** If you still use a legacy IdP callback, **`GET /api/oauth/callback`** on the **API** host may redirect to `/login`; see [`server/_core/index.ts`](../server/_core/index.ts).
- **Magic links:** Supabase sends links to **`FRONTEND_ORIGIN` + `/auth/verify`** (or hash tokens). Configure Supabase redirect URLs and **`FRONTEND_ORIGIN`** on the API so links match your SPA.

## Verification

- `https://nrcseam.techivano.com` — SPA loads.
- `https://api.nrcseam.techivano.com/health` — `{ "ok": true }` ([`server/_core/index.ts`](../server/_core/index.ts)); use for manual checks and uptime monitors.
- DevTools → Network: tRPC to `https://api.nrcseam.techivano.com/api/trpc`, CORS preflight **200**; no mixed content (HTTPS only).
- Refresh a deep route (e.g. `/app/assets`) — should not 404 (depends on [`vercel.json`](../vercel.json) rewrites).

## Go-live checklist

**Frontend (Vercel)**

- [ ] Production build succeeds.
- [ ] Domain `nrcseam.techivano.com` attached; page loads over HTTPS.
- [ ] `VITE_API_BASE_URL` set for Production; redeployed after any change.
- [ ] Deep routes work (e.g. `/app`, `/app/assets`) after hard refresh.

**Backend (Node API)**

- [ ] `GET https://api.nrcseam.techivano.com/health` returns 200.
- [ ] `CORS_ORIGINS=https://nrcseam.techivano.com` (exact origin; no wildcard).
- [ ] `FRONTEND_ORIGIN` / `SESSION_COOKIE_DOMAIN` set if using cookies across subdomains.

**Integration**

- [ ] No CORS errors in the browser console for tRPC.
- [ ] API calls use HTTPS end-to-end.

## Troubleshooting: `ERR_PNPM_OUTDATED_LOCKFILE` on Vercel

Vercel builds a **specific Git commit**. If that commit’s **`package.json`** and **`pnpm-lock.yaml`** do not match, install fails. Compare **`git log -1`** with the commit hash shown in the Vercel deployment — if they differ, your latest fix is not deployed yet.

**Fix (always commit the lockfile with dependency changes):**

1. `pnpm install` (or `pnpm add …`) locally.
2. `git add package.json pnpm-lock.yaml` whenever either file changed.
3. `git commit` / `git push` so Vercel builds the commit that includes both files.
4. Redeploy if needed.

**Ongoing rule:** treat **`pnpm-lock.yaml`** as mandatory alongside **`package.json`** for any dependency change.

**Emergency only:** if you must unblock a deploy before the lockfile is synced, you can temporarily set `installCommand` to `pnpm install --no-frozen-lockfile` in [`vercel.json`](../vercel.json), deploy, then **revert to `pnpm install`** and commit once installs match locally again (deterministic builds).

## Optional: S3 + CloudFront (legacy / alternate)

You can host the same static output from **`dist/public`** on S3 behind CloudFront instead of Vercel. That path requires:

- ACM in **us-east-1** for CloudFront, DNS validation, alternate domain on the distribution.
- See older runbooks and [`scripts/deploy-frontend.ps1`](../scripts/deploy-frontend.ps1).

The GitHub Action [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) is **manual-only** (`workflow_dispatch`) so it does not duplicate Vercel deploys on every push.

## Main domain unchanged

Do **not** repoint **techivano.com** unless you intend to; only **nrcseam** / **api.nrcseam** apply to this app.
