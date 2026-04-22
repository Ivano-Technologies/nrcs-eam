# Inventory ledger and WMS architecture (authoritative)

This document records **binding architectural decisions** for Phases 2–7. Implementation must follow it unless explicitly superseded by a new ADR or approved change.

A concise phase checklist lives in **[wms-phase-roadmap.md](wms-phase-roadmap.md)**.

---

## Decision 1 — Single ledger: `stock_movements` only (Option A)

**`stock_movements` is the sole inventory ledger** for all quantity-changing flows that fall under WMS scope (see Decision 2).

**`inventory_movements` is removed entirely by the end of Phase 6** (after all writers have been migrated and verified). **`inventory_documents`** is dropped in the same window **only after** no remaining FKs point at it (see **Blocker: `distributions`** below).

The database is treated as **non-preservation** for this migration: test data may be wiped and re-seeded.

### `wms_stock_movement_source` enum (complete set)

All values exist after pre–Phase 2 migration **0014** (see repo `drizzle/`). Application code must not assume a smaller set.

| Value | Intended use |
|-------|----------------|
| `grn` | GRN finalize (Phase 2) |
| `waybill` | Waybill / delivery note finalize (Phase 3) |
| `stock_check` | Physical count variance on approve (Phase 4) |
| `adjustment` | Manual adjustments (existing; use where not stock-check) |
| `import` | Approved import pipeline (Phase 6) |
| `transfer_in` | Inter-facility transfer receive (Phase 2) |
| `transfer_out` | Inter-facility transfer dispatch (Phase 2) |
| `kit_assembly` | Kit build: component CTNs out, kit CTN in (Phase 3) |
| `kit_disassembly` | Kit break-up: reverse (Phase 3) |
| `expiry` | Automated or manual mark-expired CTN quantity out (Phase 4) |

### Phase-by-phase ledger migration (replacing `inventory_movements`)

| Phase | Scope | Ledger behaviour |
|-------|--------|------------------|
| **2 — GRN** | Receipts / relational GRN finalize | Writes **`stock_movements` only** (no new `inventory_movements`). **Transfers:** migrate to CTN-aware transfers; dispatch = `quantity_out` + `transfer_out`, receive = `quantity_in` + `transfer_in`. Legacy aggregate catalogue-only transfer semantics are **retired** in favour of **specific CTNs** moved source → destination. |
| **3 — Waybill** | Issues / waybill finalize | Writes **`stock_movements` only`. **Kits:** assemble = component lines `quantity_out` (and kit product `quantity_in` as designed) with `kit_assembly`; disassemble = `kit_disassembly`. Kits are **CTN-aware** (specific component CTNs; kit output as new or extended kit CTN per product rules). |
| **4 — Stock & bin cards** | Cards UI + counts + expiry | Cards **read** from `stock_movements`. **Counts:** count approval with variance writes **`stock_check`** rows only (replaces count-approve → `inventory_movements`). **Expiry:** daily automation and manual mark-expired write **`expiry`** `quantity_out` rows. Remove old count-approve path to `inventory_movements`. |
| **5 — Monthly report** | NRCS monthly warehouse report | Reads **exclusively** from `stock_movements` (and related WMS tables). **No** reads from `inventory_movements` anywhere in reporting. |
| **6 — Import** | Excel / PDF-text import | Admin historical import writes **`import`** rows to `stock_movements` only. **End of Phase 6:** after all flows verified — **`DROP` `inventory_movements`**; **`DROP` `inventory_documents`** if nothing references them; remove dead code. |
| **7 — Print / export** | Shared document infrastructure | **Unchanged** relative to this ledger decision. |

### Blocker: `distributions.waybill_id`

`distributions` currently references **`inventory_documents`**, not relational `waybills`. Before dropping `inventory_documents`:

1. Add a migration path (e.g. nullable `waybill_id` FK → `waybills.id`, backfill, then drop old FK / column), **or**
2. Repoint `distributions` to the new waybill table per Phase 3 design.

Do **not** drop `inventory_documents` until this is resolved.

---

## Decision 2 — Assets stay in the Assets module (out of WMS)

**Capital and registered assets** (generators, ambulances, vehicles, computers, furniture, **office equipment tracked as assets**) **do not** use `stock_movements`, **do not** use CTNs, and **do not** appear in the **Inventory (WMS)** module for ledger purposes.

**WMS scope is limited to:**

- Relief items (blankets, tents, tarpaulins, jerrycans, kits, food, etc.)
- Consumables (medical supplies, hygiene, WASH consumables)
- Any other item received as a **humanitarian consignment with a CTN**

**`inventory_catalogue` hygiene (pre–Phase 2):**

- Rows that are really **assets** (capital equipment, fleet, IT hardware managed in the Asset Register) must be **classified**, then either **migrated into the Assets module** or **deleted** (test data — no preservation required).
- A **written audit** is required before destructive action: [`inventory-catalogue-wms-audit.md`](inventory-catalogue-wms-audit.md). **Do not execute** migrate/delete recommendations until **product approval**.

### Office supplies (final)

**Policy:** General office supplies are **not** tracked in the EAM at all (no `inventory_catalogue` / WMS); staff use **Finance** expense tracking. **Exception:** items historically tagged as office supplies that are **operational consumables** for humanitarian delivery (GRN/waybill printing, beneficiary ID stock, shipment labels, field registration forms, etc.) stay in WMS as **CONSUMABLE** — see **[inventory-catalogue-wms-audit.md](inventory-catalogue-wms-audit.md)** for criteria, reclassification list, and borderline flags. **Status:** documented; catalogue changes await approval in that audit.

---

## Decision 3 — Document numbering and facility `code`

### GRN number

**Format:** `NRCS-{FACILITY_CODE}-{YYYY}-{SEQ}`  
**Example:** `NRCS-NHQ-2026-0001`

- Editable at creation per previously agreed rules (with validation).
- `SEQ` is facility-scoped and year-scoped (see `document_number_sequences`).

### Waybill number

**Format:** `NRCS-{FACILITY_CODE}-{YYYY}-WB-{SEQ}`  
**Example:** `NRCS-NHQ-2026-WB-0001`

### Facility `code`

- Table `sites` already has a nullable **`code`** column (`varchar`, unique).
- **Constraint (enforced in migration 0014):** when present, `code` must match **`^[A-Z0-9]{2,5}$`** (uppercase alphanumeric, 2–5 characters).
- **Seeding:** migration 0014 sets codes for known seed facility **names** (e.g. NHQ, LAG, KAN). Additional facilities (ONDO, MAI, PH, ENU, …) receive codes when created or via a follow-up seed/migration after approval.

---

## Decision 4 — Kit donor attribution (BLENDED + contributor tracking)

When a kit is assembled from components whose CTNs belong to **more than one distinct donor**, the resulting **kit CTN’s `donor_id`** is the synthetic donor **`BLENDED`** (`donors.code = 'BLENDED'`). The **true** contributor mix is stored in **`kit_ctn_contributors`** so reporting can credit real donors.

If all component CTNs share **one** distinct donor (e.g. all Finnish RC), the new kit CTN uses **that donor directly** — **not** BLENDED.

### System donors (seed + migration `0015`)

| Code | `donor_type` | Purpose |
|------|----------------|---------|
| **BLENDED** | `multilateral` | Kits built from **multiple** contributor donors; CTN shows BLENDED; breakdown in `kit_ctn_contributors`. |
| **LEGACY** | `synthetic` | Grandfathered / pre-WMS stock and imports where historical donor is unknown or batched (`0015` adds enum value `synthetic`). |

Seed source: `shared/wmsDonors.ts` (same rows inserted in `0015` for environments that migrate before re-seeding).

### Table `kit_ctn_contributors`

| Column | Role |
|--------|------|
| `kit_ctn_id` | The **kit** CTN (`commodity_tracking_numbers`). |
| `component_ctn_id` | A **component** CTN consumed at assembly. |
| `component_donor_id` | Denormalized donor of that component at assembly time (fast reporting if the component CTN is later depleted/archived). |
| `quantity_consumed` | Units of the component CTN allocated to this kit assembly. |
| `assembly_event_id` | FK → `stock_movements.id` — the ledger line that recorded **this** consumption (typically the component’s `quantity_out` row with `source_type = kit_assembly`). |
| `created_at` | Row creation time. |

One kit CTN may have **many** contributor rows. Kit CTNs with BLENDED still expose a single direct `donor_id` on the CTN row; **Donor Contribution** and audit views must join through **`kit_ctn_contributors`** (and recurse where needed — see below).

### Assembly flow (Phase 3)

1. User selects kit catalogue item and quantity to assemble.  
2. User selects source CTNs for each required component (FIFO/FEFO suggested; override allowed).  
3. System collects **distinct `donor_id`** values from those component CTNs.  
4. **One** distinct donor → new kit CTN `donor_id` = that donor.  
5. **More than one** → new kit CTN `donor_id` = BLENDED.  
6. For each component CTN consumed, **insert** `kit_ctn_contributors` (with `component_donor_id` from the component CTN at assembly time).  
7. **`stock_movements`:** one `quantity_out` per component CTN (per stock card), one `quantity_in` for the new kit CTN (`kit_assembly`).

### Disassembly flow (Phase 3)

1. User selects kit CTN and quantity to disassemble.  
2. Resolve provenance via **`kit_ctn_contributors`** for that kit CTN.  
3. Prefer returning stock to **original** component CTNs when still valid.  
4. If original contributor CTNs cannot be restored cleanly, create **new** “recovered component” CTNs; attribute with **BLENDED** (or policy-approved donor) and document in remarks.  
5. **`stock_movements`:** `quantity_out` on kit CTN, `quantity_in` on component CTN(s) (`kit_disassembly`).

Disassembly is expected to be **rare**; **correctness of assembly** and contributor rows take priority; disassembly logic can stay **minimal** at first.

### Reporting

- **Monthly Warehouse Report:** BLENDED kits may appear as a **single donor line** in narrative / Comments where a one-line summary is required.  
- **Donor Contribution Report (Phase 5):** **Must** allocate credit using **`kit_ctn_contributors`** (and underlying `component_donor_id`), **not** only `commodity_tracking_numbers.donor_id`, or BLENDED will look like the largest donor and real contributors are **undercounted**.  
- **Kit Assembly Audit Trail:** dedicated report for any kit CTN → full contributor list (quantities, donors, movement dates via `assembly_event_id` → `stock_movements`).

### Edge case: kit-of-kits (component CTN already BLENDED)

If assembly consumes a mix where **at least one** component CTN is already **BLENDED** (a kit built from other kits), the **new** kit CTN is also **BLENDED**, and contributor rows are **flattened** at this assembly. The **Donor Contribution Report** must walk the **`kit_ctn_contributors` graph recursively** (or equivalent flattening query) so nested kits do not mis-attribute totals.

---

## Preconditions before starting Phase 2 code

1. Apply migration **`0014_wms_pre_phase2`** (`drizzle/0014_wms_pre_phase2.sql`: enum values, facility `code` CHECK, seed `UPDATE`s).
2. Review and **approve** [`inventory-catalogue-wms-audit.md`](inventory-catalogue-wms-audit.md) (and optionally re-run `pnpm exec tsx scripts/db/audit-inventory-catalogue-wms.ts` against your DB for rows not in the seed list).
3. **Office supplies** policy is **final** (see [inventory-catalogue-wms-audit.md](inventory-catalogue-wms-audit.md)); any catalogue row edits from the audit still require **your approval** before execution.
4. Only then begin **Phase 2** implementation (relational GRN + transfer migration on `stock_movements`).
5. Before **Phase 3** kit assembly/disassembly work: apply **`0015_kit_ctn_contributors_and_synthetic_donors`** (Decision 4 — `synthetic` donor type, `kit_ctn_contributors`, BLENDED/LEGACY donors).

---

## Related files

| File | Purpose |
|------|---------|
| [`drizzle/0014_wms_pre_phase2.sql`](../drizzle/0014_wms_pre_phase2.sql) | Enum values + `sites.code` CHECK + facility code seed |
| [`drizzle/0015_kit_ctn_contributors_and_synthetic_donors.sql`](../drizzle/0015_kit_ctn_contributors_and_synthetic_donors.sql) | `donor_type` `synthetic`, `kit_ctn_contributors`, BLENDED/LEGACY donors |
| [`inventory-catalogue-wms-audit.md`](inventory-catalogue-wms-audit.md) | Catalogue classification audit (await approval) |
| [`../scripts/db/audit-inventory-catalogue-wms.ts`](../scripts/db/audit-inventory-catalogue-wms.ts) | Regenerate audit rows from live `inventory_catalogue` |
