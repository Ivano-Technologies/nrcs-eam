# MVP audit checklist (NRCS EAM)

Legend: `[x]` covered by automated MVP audit (Playwright) · Stack: Vite + React + wouter, Express + tRPC + Drizzle + PostgreSQL (Supabase)

---

## Authentication & public routes

| Status | Item |
|--------|------|
| [x] | `/` Landing |
| [x] | `/login` magic-link request |
| [x] | `/signup` access request |
| [x] | `/auth/verify` magic-link consumption → session cookie |
| [x] | `/legal/terms` |
| [x] | `/legal/privacy` |
| [x] | `/404` NotFound |
| [x] | **2a** Session-injected login bootstrap (Playwright storageState) → `/app` |
| [x] | **2a** Session persists after `reload` |
| [x] | **2a** Logout → `/login` |
| [x] | **2a** Protected route when logged out → redirect `/login` |
| [x] | Magic-link smoke (`auth-magic-link-smoke.spec.ts`) verifies `/auth/verify` with `email + token_hash + type=email` |

---

## App shell (`/app/*`) — from `ProtectedAppSection.tsx`

| Status | Route |
|--------|--------|
| [x] | `/app` Dashboard (`Home`) |
| [x] | `/app/welcome` onboarding (reachable via nav when applicable) |
| [x] | `/app/assets` |
| [x] | `/app/assets/:id` |
| [x] | `/app/scanner` |
| [x] | `/app/asset-map` |
| [x] | `/app/warranty-alerts` |
| [x] | `/app/cost-analytics` |
| [x] | `/app/audit-trail` |
| [x] | `/app/activity-log` |
| [x] | `/app/work-orders` |
| [x] | `/app/work-orders/:id` (detail routes exercised via app usage) |
| [x] | `/app/mobile-work-orders` |
| [x] | `/app/mobile-work-order/:id` |
| [x] | `/app/work-order-templates` |
| [x] | `/app/maintenance` |
| [x] | `/app/inventory` |
| [x] | `/app/vendors` |
| [x] | `/app/financial` |
| [x] | `/app/compliance` |
| [x] | `/app/facilities` |
| [x] | `/app/users` |
| [x] | `/app/pending-users` |
| [x] | `/app/notification-preferences` |
| [x] | `/app/reports` |
| [x] | `/app/report-scheduling` |
| [x] | `/app/quickbooks` |
| [x] | `/app/email-notifications` |
| [x] | `/app/dashboard-settings` |

---

## tRPC — `system`

| Status | Procedure |
|--------|-----------|
| [x] | `system.health` |
| [x] | `system.notifyOwner` (admin) |

## tRPC — `auth`

| Status | Procedure |
|--------|-----------|
| [x] | `auth.me` |
| [x] | `auth.logout` |
| [x] | `auth.signup` |
| [x] | `auth.requestMagicLink` |

## tRPC — domains (representative; full API in `server/routers.ts`)

| Status | Router | Notes |
|--------|--------|--------|
| [x] | `sites.*` | list, getById, create, update, bulkDelete |
| [x] | `assetCategories.*` | list, create |
| [x] | `assets.*` | CRUD, search, QR/barcode, PDF labels, warranties |
| [x] | `workOrders.*` | CRUD |
| [x] | `maintenance.*` | schedules, upcoming, predictions, auto WO |
| [x] | `inventory.*` | list, lowStock, transactions |
| [x] | `vendors.*` | CRUD |
| [x] | `financial.*` | transactions, cost analytics |
| [x] | `compliance.*` | CRUD |
| [x] | `dashboard.stats` | |
| [x] | `users.*` | admin user CRUD, roles, onboarding |
| [x] | `notifications.*` | |
| [x] | `reports.*` | assetInventory, maintenanceSchedule, workOrders, financial, compliance (PDF/Excel) |
| [x] | `photos.*` | |
| [x] | `scheduledReports.*` | |
| [x] | `bulkOperations.*` | import/export, templates |
| [x] | `transfers.*` | approve, start, complete, pending |
| [x] | `quickbooks.*` | config, OAuth, sync |
| [x] | `userPreferences.*` | sidebar, dashboard widgets |
| [x] | `emailNotifications.*` | send (bulk), history |
| [x] | `depreciation.*` | calculate, summary |
| [x] | `pendingUsers.*` | list, approve, reject |
| [x] | `workOrderTemplates.*` | CRUD |
| [x] | `auditLogs.*` | list |

---

## PDF / exports

| Status | Source |
|--------|--------|
| [x] | `reports.*` PDF mutations (asset, maintenance, WO, financial, compliance) |
| [x] | `assets.generateBulkQRCodeLabels` (PDF) |
| [x] | Bulk export XLSX (assets, WO, inventory, sites) |
| [x] | Site import template download |

---

## Email (outbound)

| Status | Trigger |
|--------|---------|
| [x] | Magic link / signup emails (`magicLinkAuth` + `emailService`) |
| [x] | `emailNotifications.send` (admin bulk) |
| [x] | Warranty / notification helpers (see `notificationHelper`, `server/emailService.ts`) |

Local: Mailpit SMTP (`SMTP_HOST` / `MAILPIT_SMTP_HOST` on `1025`).

---

## Settings / role boundaries

| Status | Item |
|--------|------|
| [x] | Admin-only: Users, Pending Users, Email Notifications, Audit Trail, bulk deletes |
| [x] | Manager/Admin: sites/assets CRUD, etc. |
| [x] | `DashboardSettings`, `NotificationPreferences`, `QuickBooksSettings` |

---

## Error / edge

| Status | Item |
|--------|------|
| [x] | Form validation (empty submits) |
| [x] | Unknown route → 404 |
| [x] | Non-admin on admin route → forbidden UI or error |

---

## Smoke (automated)

| Status | Item |
|--------|------|
| [x] | `GET /health` → `{ ok: true }` (`smoke.spec.ts`) |
