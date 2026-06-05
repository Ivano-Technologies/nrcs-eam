# NRCS EAM — Deployment Guide

## 1. Overview

The system uses a blue/green deployment strategy. Two branches are always live simultaneously:

- `main` — currently serving production traffic at `nrcseam.techivano.com`
- `blue` — currently serving staging traffic at `blue.nrcseam.techivano.com`

All new features, dependency updates, and experimental changes are developed and tested on whichever branch is currently staging. The live branch is treated as read-only until the next swap.

---

## 2. Current state

| Branch | URL | Role |
|--------|-----|------|
| `main` | `nrcseam.techivano.com` | 🟢 Production |
| `blue` | `blue.nrcseam.techivano.com` | 🔵 Staging |

**Update this table every time a swap is performed.**

---

## 3. Development workflow

```bash
# Always work on whichever branch is currently staging.
# Assuming blue is currently staging:

git checkout blue
git pull origin blue

# Make changes, commit, push
git add .
git commit -m "feat: description of change"
git push origin blue

# blue.nrcseam.techivano.com auto-deploys via Vercel.
# Test thoroughly before initiating a swap.
```

Never commit directly to the live branch. It must remain stable at all times.

---

## 4. Pre-swap checklist

Before swapping staging to production, verify all of the following on the staging URL:

- [ ] Login and authentication works
- [ ] Dashboard KPIs load correctly (Active Facilities, Total Asset Value)
- [ ] Asset register loads and displays data
- [ ] No errors in Vercel function logs for the staging deployment
- [ ] No 504 timeouts on dashboard routes
- [ ] `pnpm check` passes locally

---

## 5. Swap procedure

The swap reassigns the production domain from one branch to the other. This takes approximately 60 seconds and causes zero downtime.

### Via Vercel dashboard

1. Go to `vercel.com/techivano/nrcs-eam/settings/domains`
2. Click **Edit** on `nrcseam.techivano.com`
3. Change the branch assignment from `main` to `blue` (or vice versa) — **Save**
4. Click **Edit** on `blue.nrcseam.techivano.com`
5. Change the branch assignment to the former production branch — **Save**
6. Update the **Current state** table in this document to reflect the new roles
7. Commit the updated `DEPLOYMENT.md` to both branches

### Verification after swap

```bash
# Confirm production is serving the new branch
curl -I https://nrcseam.techivano.com

# Confirm staging is serving the former production branch
curl -I https://blue.nrcseam.techivano.com
```

Both should return `HTTP/2 200`.

---

## 6. Rollback procedure

If a critical issue is discovered after a swap, reverse it immediately using the same swap procedure above. The former production branch is always intact and deployable — rollback takes the same 60 seconds as a forward swap.

---

## 7. Environment variables

Both branches share the same environment variables configured in Vercel. If a new feature requires a new environment variable, add it in **Vercel → Settings → Environment Variables** and set it for both `Production` and `Preview` environments before deploying to either branch.

---

## 8. Security vulnerability backlog

As of June 2026, GitHub Dependabot has flagged 50 vulnerabilities (2 critical, 26 high, 22 moderate) on the default branch. Review and address these at [github.com/Ivano-Technologies/nrcs-eam/security/dependabot](https://github.com/Ivano-Technologies/nrcs-eam/security/dependabot) before the next major feature cycle. Do not merge Dependabot PRs without testing on the staging branch first.

---

## Section 9 — Official Domain Migration Plan

### Overview

The system is currently hosted at `nrcseam.techivano.com` (Ivano Technologies infrastructure). The intended final production domain is `eam.redcrossnigeria.org` (Nigerian Red Cross Society official domain). This section documents the full migration plan when NRCS is ready to cut over.

The approach is **domain aliasing, not migration** — both domains will run simultaneously pointing at the same Vercel deployment, eliminating downtime and preserving a rollback path.

---

### Prerequisites before starting

- [ ] DNS management access for `redcrossnigeria.org` confirmed (NRCS IT department)
- [ ] `redcrossnigeria.org` domain is registered and resolves (`nslookup redcrossnigeria.org`)
- [ ] NRCS leadership sign-off on official domain usage
- [ ] At least 2 weeks user communication period planned

---

### Phase 1 — Add domain alias in Vercel

No code changes required. Both domains will serve the identical app from the same deployment.

**In Vercel → nrcs-eam → Settings → Domains:**
1. Click **Add Existing**
2. Enter `eam.redcrossnigeria.org`
3. Assign to `main` (Production)
4. Vercel will provision an SSL certificate automatically

**In the `redcrossnigeria.org` DNS provider (Cloudflare or equivalent):**

| Type | Name | Target | Proxy status |
|------|------|--------|--------------|
| CNAME | `eam` | `cc052f39af8cf355.vercel-dns-016.com` | DNS only (grey cloud) |

Verify both URLs serve the app correctly before proceeding:
```bash
curl -I https://nrcseam.techivano.com
curl -I https://eam.redcrossnigeria.org
```

Both should return `HTTP/2 200`.

---

### Phase 2 — Code updates required

The following must be updated before or immediately after the domain alias goes live:

**Cookie domain (`server/_core/cookies.ts`)**
The `deriveParentDomain()` function already derives the parent domain dynamically from `req.hostname`. Verify it returns `.redcrossnigeria.org` correctly when requests arrive from the new domain. No code change should be needed but confirm with a login test on `eam.redcrossnigeria.org`.

**CORS origin allowlist**
Search `server/` for any hardcoded `nrcseam.techivano.com` in CORS configuration. Add `eam.redcrossnigeria.org` alongside it. Do not remove the existing origin until the cutover is complete.

**Base URL environment variable**
Any system emails containing links back to the app (password reset, notifications, waybill links) must use a `BASE_URL` or `APP_URL` environment variable rather than a hardcoded domain. Search the codebase for `nrcseam.techivano.com` in email templates and replace with the environment variable. Add `BASE_URL=https://eam.redcrossnigeria.org` to Vercel environment variables for Production when ready.

**PWA manifest**
Check `vite.config.ts` or `public/manifest.webmanifest` for any hardcoded domain references in `start_url` or `scope`. These should use relative paths (`/`) rather than absolute URLs to work correctly on both domains.

---

### Phase 3 — User communication and cutover

1. Send notification to all NRCS EAM users at least **2 weeks before cutover** — new URL, date of change, what action (if any) is needed
2. On cutover day, add a **301 permanent redirect** from `nrcseam.techivano.com` to `eam.redcrossnigeria.org` via Vercel domain redirect settings
3. Keep `nrcseam.techivano.com` as a redirect (not removed) for a minimum of **6 months** to preserve existing bookmarks and links
4. Update all NRCS documentation, training materials, and onboarding guides to reference the new URL

---

### Phase 4 — Blue/green on the official domain

Once the cutover is complete, add a staging subdomain for the official domain alongside the existing `blue.nrcseam.techivano.com`:

**Target domain map:**

| URL | Branch | Role |
|-----|--------|------|
| `eam.redcrossnigeria.org` | `main` | 🟢 Production |
| `staging.eam.redcrossnigeria.org` | `blue` | 🔵 Staging |
| `nrcseam.techivano.com` | redirects to production | 🔀 Legacy redirect |
| `blue.nrcseam.techivano.com` | `blue` | 🔵 Staging (legacy) |

Add `staging.eam.redcrossnigeria.org` using the same process as Phase 1 above, assigning it to the `blue` branch.

---

### Phase 5 — Update this document

After the cutover is complete:
1. Update the **Current state** table in Section 2 to reflect the new primary domain
2. Update the **Swap procedure** in Section 5 to reference `eam.redcrossnigeria.org`
3. Commit the updated `DEPLOYMENT.md` to both `main` and `blue`

---

### Rollback

If issues arise after cutover:
1. Remove the 301 redirect from `nrcseam.techivano.com`
2. Both domains continue serving the app — users on the old URL are immediately unaffected
3. Investigate and resolve before re-attempting the cutover
