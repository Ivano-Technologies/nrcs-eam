# MVP audit checklist (NRCS EAM)

Legend: `[ ]` not tested · `[x]` passing · `[!]` failing/blocked

Stack: Vite + React + wouter (client), Express + tRPC + Drizzle + MySQL (server).

---

## Authentication & public routes

| Status | Item |
|--------|------|
| [ ] | `/` Landing |
| [ ] | `/login` magic-link request |
| [ ] | `/signup` access request |
| [ ] | `/auth/verify` magic-link consumption → session cookie |
| [ ] | `/legal/terms` |
| [ ] | `/legal/privacy` |
| [ ] | `/404` NotFound |
| [ ] | **2a** Magic-link login (seeded 64-char token) → `/app` |
| [ ] | **2a** Session persists after `reload` |
| [ ] | **2a** Logout → `/login` |
| [ ] | **2a** Protected route when logged out → redirect `/login` |

---

## App shell (`/app/*`) — from `ProtectedAppSection.tsx`

| Status | Route |
|--------|--------|
| [ ] | `/app` Dashboard (`Home`) |
| [ ] | `/app/welcome` onboarding |
| [ ] | `/app/assets` |
| [ ] | `/app/assets/:id` |
| [ ] | `/app/scanner` |
| [ ] | `/app/asset-map` |
| [ ] | `/app/warranty-alerts` |
| [ ] | `/app/cost-analytics` |
| [ ] | `/app/audit-trail` |
| [ ] | `/app/activity-log` |
| [ ] | `/app/work-orders` |
| [ ] | `/app/work-orders/:id` |
| [ ] | `/app/mobile-work-orders` |
| [ ] | `/app/mobile-work-order/:id` |
| [ ] | `/app/work-order-templates` |
| [ ] | `/app/maintenance` |
| [ ] | `/app/inventory` |
| [ ] | `/app/vendors` |
| [ ] | `/app/financial` |
| [ ] | `/app/compliance` |
| [ ] | `/app/sites` |
| [ ] | `/app/users` |
| [ ] | `/app/pending-users` |
| [ ] | `/app/notification-preferences` |
| [ ] | `/app/reports` |
| [ ] | `/app/report-scheduling` |
| [ ] | `/app/quickbooks` |
| [ ] | `/app/email-notifications` |
| [ ] | `/app/dashboard-settings` |

---

## tRPC — `system`

| Status | Procedure |
|--------|-----------|
| [ ] | `system.health` |
| [ ] | `system.notifyOwner` (admin) |

## tRPC — `auth`

| Status | Procedure |
|--------|-----------|
| [ ] | `auth.me` |
| [ ] | `auth.logout` |
| [ ] | `auth.signup` |
| [ ] | `auth.requestMagicLink` |

## tRPC — domains (representative; full API in `server/routers.ts`)

| Status | Router | Notes |
|--------|--------|--------|
| [ ] | `sites.*` | list, getById, create, update, bulkDelete |
| [ ] | `assetCategories.*` | list, create |
| [ ] | `assets.*` | CRUD, search, QR/barcode, PDF labels, warranties |
| [ ] | `workOrders.*` | CRUD |
| [ ] | `maintenance.*` | schedules, upcoming, predictions, auto WO |
| [ ] | `inventory.*` | list, lowStock, transactions |
| [ ] | `vendors.*` | CRUD |
| [ ] | `financial.*` | transactions, cost analytics |
| [ ] | `compliance.*` | CRUD |
| [ ] | `dashboard.stats` | |
| [ ] | `users.*` | admin user CRUD, roles, onboarding |
| [ ] | `notifications.*` | |
| [ ] | `reports.*` | assetInventory, maintenanceSchedule, workOrders, financial, compliance (PDF/Excel) |
| [ ] | `photos.*` | |
| [ ] | `scheduledReports.*` | |
| [ ] | `bulkOperations.*` | import/export, templates |
| [ ] | `transfers.*` | approve, start, complete, pending |
| [ ] | `quickbooks.*` | config, OAuth, sync |
| [ ] | `userPreferences.*` | sidebar, dashboard widgets |
| [ ] | `emailNotifications.*` | send (bulk), history |
| [ ] | `depreciation.*` | calculate, summary |
| [ ] | `pendingUsers.*` | list, approve, reject |
| [ ] | `workOrderTemplates.*` | CRUD |
| [ ] | `auditLogs.*` | list |

---

## PDF / exports

| Status | Source |
|--------|--------|
| [ ] | `reports.*` PDF mutations (asset, maintenance, WO, financial, compliance) |
| [ ] | `assets.generateBulkQRCodeLabels` (PDF) |
| [ ] | Bulk export XLSX (assets, WO, inventory, sites) |
| [ ] | Site import template download |

---

## Email (outbound)

| Status | Trigger |
|--------|---------|
| [ ] | Magic link / signup emails (`magicLinkAuth` + `emailService`) |
| [ ] | `emailNotifications.send` (admin bulk) |
| [ ] | Warranty / notification helpers (see `notificationHelper`, `server/emailService.ts`) |

Local: Mailpit SMTP (`SMTP_HOST` / `MAILPIT_SMTP_HOST`).

---

## Settings / role boundaries

| Status | Item |
|--------|------|
| [ ] | Admin-only: Users, Pending Users, Email Notifications, Audit Trail, bulk deletes |
| [ ] | Manager/Admin: sites/assets CRUD, etc. |
| [ ] | `DashboardSettings`, `NotificationPreferences`, `QuickBooksSettings` |

---

## Error / edge (planned)

| Status | Item |
|--------|------|
| [ ] | Form validation (empty submits) |
| [ ] | Unknown route → 404 |
| [ ] | Non-admin on admin route → forbidden UI or error |

---

## Smoke (automated)

| Status | Item |
|--------|------|
| [x] | `GET /health` → `{ ok: true }` (`smoke.spec.ts`) |
