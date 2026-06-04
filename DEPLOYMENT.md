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
