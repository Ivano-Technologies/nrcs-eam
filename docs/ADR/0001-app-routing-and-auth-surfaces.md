# ADR 0001: Public landing, `/app` shell, and auth surfaces

- **Status:** Accepted  
- **Date:** 2026-04  

## Context

The SPA originally wrapped all routes in a layout that showed a sign-in card whenever the user was missing, which blocked a real marketing **`/`** and mixed concerns. Production also needed a clear split between **OAuth callback** (API host), **magic link verification** (SPA path), and the **authenticated app**.

## Decision

1. **Public routes** (`/`, `/login`, `/signup`, `/auth/verify`, `/legal/*`) render **without** the dashboard shell.
2. **Authenticated product UI** lives under **`/app` and `/app/...`**, wrapped by **`ProtectedRoute`** (redirect to `/login` if unauthenticated) and **`DashboardLayout`**.
3. **OAuth** completes on **`/api/oauth/callback`**; after setting the session cookie, redirect to **`FRONTEND_ORIGIN + /app`** (not `/`).
4. **Magic links** point at **`/auth/verify`** on the SPA origin; after success, navigate to **`/app`**. Email base URL uses **`FRONTEND_ORIGIN`** on the server so App Runner does not depend on `VITE_*` for links.
5. Use a single helper ([`appPath`](../../client/src/lib/routes.ts)) so menu paths and redirects stay consistent.

## Consequences

- Bookmarks to old paths like `/assets` (without `/app`) will 404 unless separate redirects are added later.
- Contributors must distinguish **portal `/app-auth`** (OAuth portal host) from **SPA `/app`** (this app).

## Alternatives considered

- **Keep dashboard wrapper everywhere:** rejected; blocked landing and blurred public vs authenticated UX.
- **React Router:** not used; the project standard is **Wouter**.
