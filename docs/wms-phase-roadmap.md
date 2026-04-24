# WMS phase roadmap (Phases 2–7)

This roadmap implements [inventory-ledger-architecture.md](inventory-ledger-architecture.md). Phase 1 (schema, CTN registry, donors) is complete.

## Preconditions (before Phase 2)

1. Migration **`0014_wms_pre_phase2`** applied (`wms_stock_movement_source` enum + `sites.code` CHECK + seed facility codes).
2. Catalogue audit reviewed: [inventory-catalogue-wms-audit.md](inventory-catalogue-wms-audit.md) — **no data changes** until approved.
3. **Office supplies:** final policy in [inventory-catalogue-wms-audit.md](inventory-catalogue-wms-audit.md) (Finance-only, except operational consumables in WMS).
4. **Facility codes** for all live sites (e.g. ONDO, MAI, PH, ENU) added via seed/migration when those sites exist.

## Phases

| Phase | Theme | Ledger / scope highlights |
|-------|--------|----------------------------|
| **2** | GRN + transfers | GRN approve: lines with **`ctnId`** → `stock_movements` (`grn`); legacy lines still use `inventory_movements` until UI supplies CTNs. Transfers CTN-aware next. |
| **3** | Waybill + kits | Waybill finalize → `stock_movements` only. Kits CTN-aware: `kit_assembly` / `kit_disassembly`. Kit donor rules: **Decision 4** — BLENDED + `kit_ctn_contributors`; single-donor assemblies skip BLENDED. |
| **4** | Stock / bin cards / counts / expiry | Read from `stock_movements`. Count approve → `stock_check`. Expiry batch + manual → `expiry`. Remove count path to `inventory_movements`. |
| **5** | Monthly report | Reporting reads **only** `stock_movements` (plus related WMS tables). `inventory_stock` dual-write removed from all WMS finalize paths; only transfer-path writes remain for Phase 6 migration. |
| **6** | Import + cutover | Historical import → `import` on `stock_movements`. After verification: **drop** `inventory_movements`; drop `inventory_documents` when **no FKs** remain (fix `distributions.waybill_id` first). Dead code cleanup. |
| **7** | Print / export infra | Shared document output. Phase 7f inventory_stock drop is **DEFERRED** — see [planning/tech-debt.md](planning/tech-debt.md). |

## Phase 7 status

- `7a` Shared print/export infrastructure: complete
- `7b` Pixel-match print documents: complete
- `7c` Copy tracking + print audit: complete
- `7d` Notifications integration: complete
- `7e` AWS Secrets cleanup: complete
- `7f` inventory_stock drop: **DEFERRED — see [planning/tech-debt.md](planning/tech-debt.md)**
- `7g` Phase 2.5 docs update: pending
- `7h` Final documentation pass: pending

## Definition of done (Phase 7 closeout)

- All five forms render/print/export correctly for operational use.
- stock_movements remains the sole ledger source of truth for WMS quantity flows.
- inventory_movements removed.
- AWS Secrets Manager dead code removed.
- Notification pipeline documented and wired.

## Document numbering (Phase 2+)

| Document | Pattern |
|----------|---------|
| GRN | `NRCS-{FACILITY_CODE}-{YYYY}-{SEQ}` |
| Waybill | `NRCS-{FACILITY_CODE}-{YYYY}-WB-{SEQ}` |

Facility `code`: 2–5 uppercase alphanumeric, unique on `sites.code` (see migration **0014**).
