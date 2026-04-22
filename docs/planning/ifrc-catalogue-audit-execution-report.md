# IFRC catalogue audit — execution report

Generated: 2026-04-22T01:42:44.960Z (last `pnpm db:apply:ifrc-audit --skip-migrate` after **MEGPHEQP03 → Assets**).

| Metric | Value |
|--------|-------|
| IFRC seed rows in DB before (`item_code` ∈ seed list) | **42** (41 WMS rows + `MEGPHEQP03` still in catalogue) |
| Remaining in `inventory_catalogue` (same filter, after apply) | **41** |
| Expected IFRC rows remaining | **41** (= 48 seed codes − **7** asset migrations) |
| Asset migrations **this run** | **1** (`MEGPHEQP03`) |
| Asset rows skipped (already had `INV-MIG-*` / catalogue already removed) | **6** |
| **Total** IFRC lines migrated to `assets` (cumulative) | **7** |
| Removed (NOT_IN_EAM) — IFRC seed | **0** |
| Among remaining — **RELIEF_ITEM** | **30** |
| Among remaining — **CONSUMABLE** | **11** (unchanged) |
| Hard failures | **0** |

**All `item_code`s migrated to Assets:** `BPRESURE06`, `STRHLTH07`, `GENEQP01`, `GPSEQP05`, `COMRADEQP04`, `RADIONFI03`, `MEGPHEQP03`.

`MEGPHEQP03` was **RELIEF_ITEM** in WMS before removal, so RELIEF count dropped by **1** (31 → **30**); CONSUMABLE stayed **11**.

## Commands

```bash
pnpm db:migrate:dev          # optional; drizzle.config now prefers .env when URL unset
pnpm db:import:ifrc
pnpm db:apply:ifrc-audit --skip-migrate
pnpm db:audit:catalogue-wms
```

## Gate

Phase 2 may proceed after product confirms these counts.
