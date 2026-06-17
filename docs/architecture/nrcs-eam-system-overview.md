# NRCS EAM System Architecture Overview

**Generated:** 2026-06-17  
**Graph source:** graphify `707170a` (3,876 nodes · 8,574 edges · 230 communities)  
**Production state:** Phase 4 WMS complete (migrations 0051–0054); Phase 6 `inventory_documents` retirement pending

---

## Executive Summary

NRCS EAM is a **Progressive Web App** for Nigerian Red Cross Society operations: **facility/asset registry**, **warehouse management (WMS)**, **requisition-to-distribution humanitarian logistics**, and a **real-time executive dashboard**. The stack is **React + tRPC** on the client, **Express/tRPC + Drizzle ORM** on the server, **PostgreSQL (Supabase)** as the system of record, and **Upstash Redis** for dashboard caching.

The **single ledger of truth** for inventory quantity is `stock_movements` (see [inventory-ledger-architecture.md](../inventory-ledger-architecture.md)). Legacy `inventory_documents` is read-only compat; Phase 6 will archive and drop it.

---

## Repo Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENT (client/)                                                           │
│  React · Vite · tRPC client · Supabase auth cookies                         │
│  App.tsx → ProtectedAppSection → DashboardLayout → feature pages            │
│  inventory/*  assets/*  Facilities  Home (dashboard)  Admin/Observability   │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ HTTPS  /api/trpc/*
┌───────────────────────────────▼─────────────────────────────────────────────┐
│  API LAYER                                                                  │
│  Vercel: api/trpc/[trpc].js  ·  api/cron/*  ·  api/health  ·  api/keep-alive│
│  Local:  server/_core/index.ts → createApiApp() → tRPC + Express routes       │
│  REST:   server/routes/documents.ts (PDF/XLSX export)  ·  setup.ts          │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────────┐
│  tRPC AppRouter (server/routers.ts)                                         │
│  auth · sites · assets · workOrders · inventory (legacy) · inventoryV2 (WMS)│
│  wms · dashboard · users · compliance · finance · observability · auditLogs │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ server/wms/*  │     │ server/_core/*  │     │ drizzle/schema.ts │
│ Ledger logic  │     │ cache, auth,    │     │ PostgreSQL tables │
│ GRN/WB/TN     │     │ cron, PDF, audit│     │ + migrations      │
└───────┬───────┘     └────────┬────────┘     └─────────┬─────────┘
        │                      │                        │
        └──────────────────────┴────────────────────────┘
                               ▼
                    PostgreSQL (Supabase) + Redis (Upstash)
```

### Top-level directories

| Path | Responsibility |
|------|----------------|
| `client/` | React UI, routing, hooks (`useAuth`, `usePermissions`), tRPC client |
| `server/` | tRPC routers, WMS business logic, auth, cache, cron helpers |
| `server/routers/inventoryRouter.ts` | **Phase 4 WMS API** (`inventoryV2` namespace) |
| `server/wms/` | Stock ledger, GRN/waybill/transfer relational modules, distribution velocity |
| `drizzle/` | Schema + SQL migrations (0051–0054 = Phase 4) |
| `api/cron/` | Vercel serverless cron handlers (daily, weekly, monthly, jobs, reports) |
| `tests/` | Playwright E2E + unit tests |
| `docs/` | Architecture, WMS phase plans, runbooks |

---

## Entry Points & Routers

### Graphify: `query "router"`

Key nodes surfaced: `routers.ts` (AppRouter hub), `inventoryRouter.ts`, `authRouter.ts`, `wmsRouter.ts`, `observabilityRouter.ts`, `documents.ts`, `apiApp.ts`, `vercelTrpcHandler.ts`, `schema.ts`, `db.ts`.

### tRPC `appRouter` namespaces

| Namespace | Module | Domain |
|-----------|--------|--------|
| `auth` | `authRouter.ts` | Login, session, password reset |
| `sites` | `routers.ts` | Facilities / locations (`sites` table) |
| `assets` | `routers.ts` | Capital assets (separate from WMS consumables) |
| `inventory` | `routers.ts` | Legacy inventory API (being superseded) |
| **`inventoryV2`** | **`inventoryRouter.ts`** | **Phase 4 WMS: GRN, waybills, transfers, requisitions, distributions** |
| `wms` | `wmsRouter.ts` | CTN registry, stock/bin cards, donors |
| `dashboard` | `routers.ts` | KPIs, metrics, cached aggregates |
| `observability` | `observabilityRouter.ts` | Pool, cache hit rate, dashboard latency (admin) |
| `auditLogs` | `routers.ts` | Audit trail |
| `users`, `notifications`, `compliance`, `finance`, … | various | Supporting EAM modules |

### `inventoryV2` sub-routers

```
catalogue · stock · movements · receipts (GRN) · waybills · transfers
documents · requisitions · distributions · kits · reports
stockCards · binCards · counts · expiry · adminData
```

### Middleware & auth flow

**Graphify: `query "middleware"`** → `trpc.ts`, `context.ts`, `corsConfig.ts`, `roleProcedures.ts`, `timingMiddleware`.

```
HTTP Request
  → createContext() [context.ts]
      → authenticateRequest() [supabaseSession.ts]  // JWT from Supabase cookies
  → timingMiddleware [trpc.ts]  // logs procedures ≥2000ms
  → publicProcedure | protectedProcedure | adminProcedure
  → requireRole(ctx, [...]) on mutations [inventoryRouter, etc.]
  → enforceFacilityScope / assertFacilityAccess [facilityAccess.ts]
```

| Procedure | Auth |
|-----------|------|
| `publicProcedure` | Optional user |
| `protectedProcedure` | Requires `ctx.user` |
| `adminProcedure` | `role === "admin"` |

---

## Data Model (Entity Relationships)

```
sites (facilities / warehouses)
  │
  ├── stock_cards (ctn_id + location_id)
  │     └── stock_movements  ←── SINGLE LEDGER (source_type: grn|waybill|transfer_in|…)
  │
  ├── goods_received_notes (GRN) ── goods_received_note_lines
  ├── waybills ── waybill_lines ── waybill_line_ctn_sources
  ├── transfer_notes ── transfer_note_lines ── transfer_note_line_ctn_sources
  │
  ├── requisitions (requesting_facility → sites)
  │     └── fulfill → waybills.requisition_id
  │
  └── distributions.waybill_id → waybills.id  (FK repointed Phase 4d)

commodity_tracking_numbers (CTN)
  └── item_id → inventory_catalogue
  └── donor_id → donors

inventory_documents (LEGACY — Phase 6 retirement)
  └── dual-read only; no new writes except issueAsKit/disposeExpired (to be migrated)
```

### Core domain entities

| Entity | Table(s) | EAM problem solved | Key data | Primary users |
|--------|----------|-------------------|----------|---------------|
| **Facility** | `sites` | Where operations happen; map network, stock readiness | name, code, facility_type, geo, is_active | Managers, field staff |
| **CTN** | `commodity_tracking_numbers` | Trace humanitarian consignments to donor + item | ctn_code, donor, item, expiry | WMS staff |
| **Catalogue** | `inventory_catalogue` | What can be stocked/issued | name, category, UoM | All inventory roles |
| **GRN** | `goods_received_notes` + lines | Record inbound receipt at warehouse | grn_number, lines with ctn_id, status | Staff, managers |
| **Waybill** | `waybills` + lines + ctn_sources | Issue/dispatch stock (outbound document) | wb_number, warehouse, destination, FEFO CTNs | Staff, managers |
| **Transfer** | `transfer_notes` + lines | Inter-facility CTN moves | tn_number, from/to warehouse, dispatch/receive | Staff, managers |
| **Requisition** | `requisitions` | Branch requests stock from HQ warehouse | items JSON, approval workflow, requesting_facility | Field, branch, HQ |
| **Distribution** | `distributions` | Field distribution event (beneficiaries) | location, demographics, optional waybill link | Field teams |

---

## Core Workflows: GRN → Distribution (End-to-End)

### 1. Goods Receipt (GRN) — Phase 4b

```
Staff creates GRN (relational only)
  → goods_received_notes status: pending_approval
Manager approves
  → finalizeGrnLedger() [grnStockLedger.ts]
  → stock_movements (source_type: grn, quantity_in per CTN line)
  → stock_cards at delegation_location_id
```

Legacy `inventory_documents` GRNs still readable via dual-read (`source=legacy`); new creates write only to relational tables.

### 2. Inter-facility Transfer — Phase 4c

```
Create transfer_note + lines (relational)
  → approve
  → dispatch (FEFO CTN allocation) [transferStockLedger.ts]
      → stock_movements: transfer_out
  → receive at destination
      → stock_movements: transfer_in
```

### 3. Requisition → Waybill → Distribution — Phase 4a + 4d

**Graphify paths:**
- `path "requisition" "distributions"` → schema → routers → client Distributions page (import graph; business link is `waybillId`)
- Fulfill flow (code truth): `inventoryV2.requisitions.fulfill`

```
Requisition: draft → branch_approved → hq_approved
  │
  ▼ fulfill [inventoryRouter ~L2849]
  ├── Stock check (itemWarehouseNet per line)
  ├── Insert waybills + waybill_lines + waybill_line_ctn_sources (FEFO)
  ├── dispatchWaybillLedger() [waybillStockLedger.ts]
  │     → stock_movements (source_type: waybill, quantity_out)
  │     → refreshDistributionOutboundDaily() (non-blocking MV refresh)
  └── requisitions.status = fulfilled, linked_waybills = [wb_number]

Field team records distribution event
  → inventoryV2.distributions.create({ waybillId: <relational waybills.id> })
  → distributions.waybill_id FK → waybills.id (migration 0054)
```

### Workflow diagram

```
  Supplier                Warehouse (HQ)              Branch / Field
     │                         │                          │
     ▼                         │                          │
  [ GRN approve ]               │                          │
  stock_movements +in           │                          │
     │                         │                          │
     │              [ Transfer dispatch/receive ]         │
     │              transfer_out / transfer_in             │
     │                         │                          │
     │              [ Requisition hq_approved ]            │
     │                         ▼                          │
     │              [ Fulfill → Waybill dispatch ]        │
     │              stock_movements waybill out            │
     │                         │                          │
     │                         └──── stock at branch ─────►│
     │                                                    ▼
     │                                         [ Distribution create ]
     │                                         link waybill_id (optional)
```

---

## Component Catalog

### Server — WMS modules

| Module | File | Responsibility |
|--------|------|----------------|
| GRN relational | `server/wms/grnRelational.ts` | Insert/list/get GRN; legacy dual-read mapping |
| GRN ledger | `server/wms/grnStockLedger.ts` | Validate finalize, insert `stock_movements` |
| Waybill ledger | `server/wms/waybillStockLedger.ts` | Dispatch validation, FEFO issue, MV refresh hook |
| Transfer relational | `server/wms/transferRelational.ts` | Transfer CRUD + legacy mapping |
| Transfer ledger | `server/wms/transferStockLedger.ts` | CTN-aware dispatch/receive movements |
| CTN allocation | `server/wms/ctnAllocation.ts` | FEFO pick for fulfill/dispatch |
| Distribution velocity | `server/wms/distributionVelocity.ts` | MV query + join fallback for dashboard KPI |
| Stock/bin cards | `server/wms/stockCard.ts`, `binCard.ts` | Card views from `stock_movements` |
| Monthly report | `server/wms/monthlyWarehouseReport.ts` | NRCS monthly warehouse report |

### Server — Infrastructure

| Module | File | Responsibility |
|--------|------|----------------|
| Cache | `server/_core/cache.ts` | Redis + in-memory fallback; `withDashboardCache` |
| Cache metrics | `server/_core/cacheMetrics.ts` | HIT/MISS counters (observability) |
| Dashboard queue | `server/_core/dashboardQueryQueue.ts` | Priority queue for parallel metric subqueries |
| MV refresh | `server/_core/distributionVelocityMv.ts` | `distribution_outbound_daily` + `stock_card_balances` refresh |
| Facility access | `server/_core/facilityAccess.ts` | Scope lists, assert mutation access |
| Audit | `server/_core/auditHelper.ts` | `logAuditEvent` for fulfill, GRN, transfer, distribution |
| Cron | `api/cron/daily.ts` | Daily alerts + MV refresh (Hobby-compliant) |

### Client — Inventory UI

| Page | Path | API |
|------|------|-----|
| Receipts (GRN) | `client/src/pages/inventory/Receipts.tsx` | `inventoryV2.receipts.*` |
| Waybills | `client/src/pages/inventory/` | `inventoryV2.waybills.*` |
| Transfers | `client/src/pages/inventory/Transfers.tsx` | `inventoryV2.transfers.*` (FEFO dispatch dialog) |
| Requisitions | `client/src/pages/inventory/Requisitions.tsx` | `inventoryV2.requisitions.*` |
| Distributions | `client/src/pages/inventory/Distributions.tsx` | `inventoryV2.distributions.*` |
| Observability | `client/src/pages/Administration/Observability.tsx` | `observability.*` (admin) |

---

## Real-time Pipeline: OLTP → Dashboard

### Graphify: dashboard & materialized views

- `explain "dashboard"` → `DashboardLayout.tsx`, `routers.ts` dashboard procedures
- `query "materialized"` → `distributionVelocityMv.ts`, `daily.ts`, `queryDistributionVelocityTotals()`
- `path "distributions" "refreshDashboardMaterializedViews"` → db → MV helpers (via import graph)

### Data flow

```
OLTP writes (GRN / waybill / transfer approve)
  │
  ▼
stock_movements (source of truth)
  │
  ├──► stock_cards / bin_cards (derived balances for UI)
  │
  ├──► distribution_outbound_daily (materialized view, migration 0052)
  │       Refresh triggers:
  │         1. waybill dispatch (non-blocking) [waybillStockLedger.ts]
  │         2. daily cron @ 02:00 UTC [api/cron/daily.ts]
  │
  └──► Dashboard queries [routers.ts dashboard.metrics]
          ├── withDashboardCache() → Upstash Redis (TTL per section)
          ├── queryDistributionVelocityTotals() → MV scan OR join fallback
          ├── DashboardQueryQueue (6s timeout, priority subqueries)
          └── dashboardRequestBuffer (last 50 requests for observability)
```

### Dashboard cached sections

| Section | Cache helper | Notes |
|---------|--------------|-------|
| `metrics` | `withDashboardCache` | Includes distribution velocity MV path |
| `totalAssetValue` | cached | Property + movable assets |
| `branchPerformance` | cached | Per-site stock scores |
| `stockMovement`, `facilityStatus`, `recentActivity`, … | cached / queued | See `routers.ts` dashboard router |

**Targets:** avg latency <2800ms; cache hit rate >30% (observability page tracks HIT/MISS by prefix).

---

## Security Model

### Authentication

- **Supabase Auth** → session cookies (`sb-access-token`, `sb-refresh-token`)
- `authenticateRequest()` resolves DB `users` row on every tRPC context creation
- Document export REST routes use same auth (`documents.ts`)

### Roles

| Role | Typical access |
|------|----------------|
| `user` | Minimal; denied most inventory mutations |
| `field` / `staff` | Facility-scoped operations |
| `manager` | Cross-facility lists, approvals, admin-lite |
| `admin` | Users, observability, app settings |

Server enforcement: `requireRole(ctx, ["staff", "manager", "admin"])`.  
Client hints: `usePermissions()` — **UI only**; not a security boundary.

### Facility scoping

**Graphify: `query "permission"`** → `usePermissions`, `DashboardLayout`, role-gated pages.

| Helper | Use case |
|--------|----------|
| `enforceFacilityScope(user, clientSiteId?)` | List queries — staff forced to `user.siteId` |
| `assertFacilityAccess(user, siteId)` | Mutations — staff must match site |
| `assertRecordFacilityAccess(user, recordSiteId)` | After load — requisition fulfill checks `requestingFacility` |

Managers/admins: optional `siteId` filter (org-wide or single site).  
Staff/field without `siteId`: queries return empty (`-1` sentinel).

---

## Validation & Integrity Rules

### Graphify: `query "validation"`

Surfaces: `startupValidation.ts`, migration verify scripts, Phase 6 retirement orphan SQL, RLS docs.

### Application validation

| Layer | Examples |
|-------|----------|
| Zod inputs | All tRPC procedure inputs |
| GRN finalize | CTN required per line; `assertCtnMatchesCatalogue` |
| Waybill dispatch | `validateWaybillDispatch`; FEFO must cover quantity |
| Transfer dispatch | CTN sources per line; approval gates |
| Requisition fulfill | `hq_approved` only; stock on hand check |

### FK integrity (Phase 4d)

- `distributions.waybill_id` → `waybills.id` (`ON DELETE SET NULL`)
- Verify: `scripts/verify-0054.mjs`, `scripts/analyze-4d-backfill.mjs`
- Orphan detection SQL in [6-legacy-inventory-documents-retirement.md](../planning/6-legacy-inventory-documents-retirement.md)

### Ledger integrity

- All WMS quantity changes → `stock_movements` with `source_type` enum
- No dual-write to deprecated `inventory_movements` on new paths
- CTN-level traceability via `stock_cards.ctn_id`

### Audit trail

Actions logged via `logAuditEvent`: `requisition.fulfill`, GRN finalize, transfer dispatch/receive, `inventory.distribution`, etc.  
UI: Admin → Audit Trail (`AuditTrail.tsx`).

---

## Performance Characteristics & Bottlenecks

### Graphify: `query "cache"`

Hub: `cache.ts`, `cacheMetrics.ts`, `withDashboardCache`, `dashboardQueryQueue`, `upstashRedis.ts`, `observabilityRouter.ts`.

| Bottleneck | Mitigation |
|------------|------------|
| Dashboard cold load (many SQL subqueries) | Redis cache per section; 6s metrics timeout with graceful degradation |
| Distribution velocity (3 heavy joins) | `distribution_outbound_daily` MV (Phase 4e) |
| Stock readiness across sites | `countAdequatelyStockedActiveSites` + optional `stock_card_balances` MV |
| DB connection pool | Observability shows pool concurrency; Supabase limits |
| Large inventory router file | Single `inventoryRouter.ts` (~5k lines) — maintenance cost, not runtime |

### Cache strategy

1. **Read-through:** `withDashboardCache(key, ttl, compute)`
2. **Metrics:** `recordCacheHit` / `recordCacheMiss` → Redis counters → Observability UI
3. **Invalidation:** TTL-based (Phase 1 expansion increased TTLs); no fine-grained invalidation on every movement
4. **Fallback:** In-memory Map if Redis unavailable

### Cron schedule (Vercel Hobby — daily max)

| Path | Schedule (UTC) | Purpose |
|------|----------------|---------|
| `/api/cron/daily` | `0 2 * * *` | Low stock, expiry alerts, **MV refresh** |
| `/api/cron/process-jobs` | `0 3 * * *` | Async job queue |
| `/api/cron/scheduled-reports` | `0 7 * * *` | Scheduled reports |
| `/api/cron/weekly` | `0 6 * * 1` | Weekly checks |
| `/api/cron/monthly` | `0 6 1 * *` | Monthly checks |
| `/api/keep-alive` | `0 9 */5 * *` | Cold-start prevention |

---

## Phase 6 / Legacy Notes

| Item | Status |
|------|--------|
| `inventory_documents` table | Dual-read GRN/transfer; 2 legacy writers (`issueAsKit`, `disposeExpired`) |
| `distributions` FK | ✅ Repointed to `waybills.id` (0054) |
| Retirement plan | [6-legacy-inventory-documents-retirement.md](../planning/6-legacy-inventory-documents-retirement.md) |
| Go-live gate | 48h validation window on Phase 4a–4e before Phase 6 cutover |

---

## Graphify Command Reference (used for this doc)

```bash
graphify query "router"
graphify query "middleware"
graphify explain "facility"    # UI + schema nodes
graphify explain "inventory"
graphify explain "transfer"    # Transfers.tsx hub
graphify explain "waybill"     # drizzle Waybill type
graphify explain "distributions"
graphify explain "requisition"
graphify path "inventoryRouter" "distributions"
graphify path "GRN" "waybillStockLedger"
graphify path "requisition" "distributions"
graphify explain "dashboard"
graphify query "materialized"
graphify path "distributions" "refreshDashboardMaterializedViews"
graphify query "cache"
graphify query "validation"
graphify explain "auth"
graphify query "permission"
```

After code changes: `graphify update .` (AST-only, no API cost).

---

## Related Documentation

- [inventory-ledger-architecture.md](../inventory-ledger-architecture.md) — ledger decisions
- [wms-phase-roadmap.md](../wms-phase-roadmap.md) — Phases 2–7
- [4a–4e sprint plans](../planning/) — implementation detail per phase
- [GRAPH_REPORT.md](../../graphify-out/GRAPH_REPORT.md) — full community map (local, gitignored)
