# Phase 6: Legacy `inventory_documents` Retirement

**Status:** Discovery complete (post–Phase 4d)  
**Prerequisite:** Phase 4d (`distributions.waybill_id` → `waybills.id`) deployed and verified  
**Architecture:** [inventory-ledger-architecture.md](../inventory-ledger-architecture.md) — drop only when no FKs remain and all writers migrated

---

## A. Current State

### Remaining FKs

| Source | Finding |
|--------|---------|
| **Drizzle schema** | No table references `inventoryDocuments` after 4d. `distributions.waybillId` → `waybills.id`. |
| **Historical** | `0009` added `distributions_waybill_id_inventory_documents_id_fk` — dropped by `0054`. |
| **Outbound FKs on `inventory_documents`** | `from_warehouse_id`, `to_warehouse_id`, `created_by`, `approved_by` → `sites` / `users` (drop with table). |
| **`document_print_log`** | No FK to `inventory_documents`; uses `(document_type, document_id)` only. |

**Pre-drop verification SQL (run on staging/prod):**

```sql
SELECT conname, conrelid::regclass AS table_name, a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND c.confrelid = 'inventory_documents'::regclass;
```

**Expected after 4d:** zero rows.

### Legacy documents by type

Run on target DB (local analysis failed — auth; use staging `DATABASE_URL`):

```sql
SELECT document_type, COUNT(*) AS count
FROM inventory_documents
GROUP BY document_type
ORDER BY count DESC;

SELECT DISTINCT document_type FROM inventory_documents;
```

**Schema / code document types:**

| `document_type` | Relational equivalent | Notes |
|-----------------|----------------------|--------|
| `grn` | `goods_received_notes` (`grn_number`) | Dual-read list/get/approve legacy path |
| `waybill` | `waybills` (`wb_number`) | Distributions FK repointed (4d); 2 legacy **writers** remain |
| `transfer_note` | `transfer_notes` (`tn_number`) | Dual-read + legacy approve/dispatch/receive |
| `adjustment_note` | None | Enum only — no writers found in codebase |
| `loss_report` | None | Enum only — no writers found in codebase |

### Orphan analysis

**Corrected join keys** (user discovery SQL used `transfer_number`; actual column is `tn_number`; type is `transfer_note` not `transfer`):

```sql
-- Legacy waybills with no relational waybill
SELECT COUNT(*) FROM inventory_documents id
WHERE document_type = 'waybill'
  AND NOT EXISTS (
    SELECT 1 FROM waybills w WHERE w.wb_number = id.document_number
  );

-- Legacy GRNs with no relational GRN
SELECT COUNT(*) FROM inventory_documents id
WHERE document_type = 'grn'
  AND NOT EXISTS (
    SELECT 1 FROM goods_received_notes grn WHERE grn.grn_number = id.document_number
  );

-- Legacy transfers with no relational transfer
SELECT COUNT(*) FROM inventory_documents id
WHERE document_type = 'transfer_note'
  AND NOT EXISTS (
    SELECT 1 FROM transfer_notes tn WHERE tn.tn_number = id.document_number
  );

SELECT COUNT(*) AS total FROM inventory_documents;
```

**Expectation:** Orphans likely **0** for waybill/GRN if 4a/4b backfills ran; transfers may have orphans if bulk backfill was deferred (4c dual-read only).

### Active code references

| File | Count / role | Active? |
|------|----------------|---------|
| `server/routers/inventoryRouter.ts` | ~48 refs | **Yes** — dual-read GRN/transfer; legacy approve/dispatch/receive; `nextDocumentNumber`; `issueAsKit`; `disposeExpired` |
| `server/wms/grnRelational.ts` | ~9 refs | **Yes** — legacy GRN mapping + `resolveGrnById` |
| `server/wms/transferRelational.ts` | ~6 refs | **Yes** — legacy transfer mapping + `resolveLegacyTransfer` |
| `server/routes/documents.ts` | ~6 refs | **Yes** — GRN PDF/export by legacy `inventory_documents.id` |
| `client/src/pages/inventory/Receipts.tsx` | — | **Yes** — `source=legacy` links |
| `client/src/pages/inventory/ReceiptDetail.tsx` | — | **Yes** — legacy approve UI |
| `client/src/pages/inventory/ReceiptPrint.tsx` | — | **Yes** — legacy source param |
| `client/src/pages/inventory/Transfers.tsx` | — | **Yes** — legacy dispatch (no FEFO dialog) |
| `drizzle/schema.ts` | table def | Schema export |
| `drizzle/0054_*.sql` | backfill only | Historical migration |
| `docs/**` | planning refs | Documentation |

**Tests:** No direct `inventory_documents` references in `tests/` (E2E may exercise legacy via UI).

### Blocking active paths (cannot drop yet)

1. **`nextDocumentNumber`** — scans **only** `inventory_documents` for GRN/WB/TN sequences; new relational creates can collide after drop.
2. **`kits.issueAsKit`** — inserts legacy waybill into `inventory_documents` (~L3485).
3. **`batches.disposeExpired`** — inserts legacy waybill into `inventory_documents` (~L5125).
4. **GRN dual-read** — list, get, approve legacy (`source=legacy`).
5. **Transfer dual-read** — list, get, approve, dispatch, receive legacy.
6. **`documents.ts` GRN export** — loads by `inventory_documents.id`.

---

## B. Retirement Strategy (Recommended)

### **Option B — Archive first, then drop** (recommended)

**Not Option A (immediate drop).** Active dual-read paths and two legacy writers remain; dropping now would break GRN/transfer history, kit issue, expiry disposal, and document numbering.

**Phased approach:**

| Step | Action | Window |
|------|--------|--------|
| **6a** | Run orphan SQL + optional bulk backfill (GRN/transfer if orphans > 0) | Pre-cutover |
| **6b** | Migrate remaining writers (`issueAsKit`, `disposeExpired`) to relational waybills + `stock_movements` | Dev + staging |
| **6c** | Repoint `nextDocumentNumber` to union relational tables (`goods_received_notes`, `waybills`, `transfer_notes`) | Dev |
| **6d** | Remove dual-read; GRN/transfer PDF routes use relational IDs only | Dev |
| **6e** | `CREATE TABLE inventory_documents_archive AS SELECT * FROM inventory_documents`; drop original | Migration `0055` |
| **6f** | 48h validation on staging/prod | Monitor |
| **6g** | Drop archive after 90 days (compliance) | Scheduled |

**Rationale for archive vs immediate drop:**

| | Option A (drop) | Option B (archive) |
|--|-----------------|-------------------|
| Effort | ~1h schema only | ~2h + cleanup tickets |
| Audit trail | Lost unless DB backup | 90-day queryable archive |
| Rollback | Restore full DB backup | `INSERT INTO inventory_documents SELECT * FROM archive` + revert code |
| Risk | **High** — active code breaks | **Low** — staged code removal first |

**Rollback procedure:**

1. Revert application commit (restore dual-read if needed).
2. `CREATE TABLE inventory_documents (LIKE inventory_documents_archive INCLUDING ALL);`
3. `INSERT INTO inventory_documents SELECT * FROM inventory_documents_archive;`
4. Re-apply indexes/RLS from `0025`, `0042`, `0046`.
5. Only re-add `distributions` legacy FK if reversing 4d (not expected).

---

## C. Schema Changes Required

### Tables to remove

- `inventory_documents` (after archive copy)

### Drizzle deletions (`drizzle/schema.ts`)

- Remove `export const inventoryDocuments = pgTable("inventory_documents", { ... })`
- Remove `InventoryDocument` type export if present
- Remove `inventoryDocuments` from imports in:
  - `server/routers/inventoryRouter.ts`
  - `server/wms/grnRelational.ts`
  - `server/wms/transferRelational.ts`
  - `server/routes/documents.ts`

### Migration SQL (`0055_inventory_documents_archive.sql`)

```sql
-- 1) Archive
CREATE TABLE IF NOT EXISTS inventory_documents_archive AS
SELECT * FROM inventory_documents;

COMMENT ON TABLE inventory_documents_archive IS
  'Phase 6 archive of legacy polymorphic docs; drop after 90d retention';

-- 2) Drop dependent indexes (from 0042, 0046)
DROP INDEX IF EXISTS idx_inventory_documents_grn_list;
DROP INDEX IF EXISTS idx_inventory_documents_approved_by;
DROP INDEX IF EXISTS idx_inventory_documents_created_by;
DROP INDEX IF EXISTS idx_inventory_documents_from_warehouse_id;
DROP INDEX IF EXISTS idx_inventory_documents_to_warehouse_id;

-- 3) Drop RLS policies
DROP POLICY IF EXISTS "service_role_full_access" ON inventory_documents;

-- 4) Drop table (CASCADE drops outbound FKs from inventory_documents)
DROP TABLE IF EXISTS inventory_documents CASCADE;

-- 5) Post-verify: no FKs reference archive (none expected)
```

### Analysis script (recommended)

Add `scripts/analyze-6-inventory-documents.mjs` mirroring `analyze-4d-backfill.mjs`: FK scan, counts by type, orphan counts, `--json` for CI.

---

## D. E2E Validation Cases

Post-retirement (no `inventory_documents` table):

| # | Flow | Assert |
|---|------|--------|
| 1 | Requisition fulfill → waybill | Creates row in `waybills` only; no legacy insert |
| 2 | GRN approve | Updates `goods_received_notes`; ledger via `stock_movements` |
| 3 | Transfer dispatch | Updates `transfer_notes` + CTN sources; no legacy path |
| 4 | Distribution create | `distributions.waybill_id` FK valid → `waybills.id` |
| 5 | Distributions list | Shows relational waybills; no join to legacy |
| 6 | Dashboard metrics | No queries to `inventory_documents` |
| 7 | Kit issue (`issueAsKit`) | Relational waybill + movements (after 6b) |
| 8 | Expiry dispose (`disposeExpired`) | Relational waybill or dedicated disposal doc (after 6b) |

**Additional:**

- GRN/transfer list shows only relational rows (or archive API if historical UI required).
- Document export `/documents/grn/:id` works with relational `goods_received_notes.id`.
- `nextDocumentNumber` does not error; numbers unique across relational tables.

---

## E. Implementation Tickets

| # | Ticket | Depends on |
|---|--------|------------|
| 1 | **Dependency audit** — `analyze-6-inventory-documents.mjs` + staging SQL run | — |
| 2 | **Writer migration** — `issueAsKit`, `disposeExpired` → relational waybills | 1 |
| 3 | **Numbering fix** — `nextDocumentNumber` scans relational tables | 1 |
| 4 | **Dual-read removal** — GRN + transfer routers, `grnRelational`, `transferRelational` | 1 (orphans = 0 or backfill done) |
| 5 | **Documents route** — GRN export by relational id | 4 |
| 6 | **Client cleanup** — remove `source=legacy` UI paths | 4 |
| 7 | **Archive migration `0055`** + Drizzle schema removal | 2–6 |
| 8 | **E2E** — extend `tests/features/inventory-workflow.spec.ts` | 7 |
| 9 | **Deploy + 48h monitor** | 7 |
| 10 | **Drop archive** (90d) | 9 |

---

## F. Risk Summary

| Risk | Level | Mitigation |
|------|-------|------------|
| Data loss | Low | Archive table + 4a/4b/4c backfill audit; orphan SQL before cutover |
| Code breakage | **High if drop before cleanup** | Complete tickets 2–6 first |
| Number collision | Medium | Fix `nextDocumentNumber` before stopping legacy writes |
| Legacy GRN approve | Medium | Backfill or one-time approve script for remaining legacy GRNs |
| Transfer orphans | Medium | 4c deferred bulk backfill — run before dual-read removal |
| Rollback | Low | Archive restore + git revert |
| `adjustment_note` / `loss_report` rows | Low | Investigate counts in SQL; may be historical only |

---

## G. Effort Estimate

| Workstream | Hours |
|------------|-------|
| Schema analysis + FK/orphan script | 1h |
| Writer + numbering cleanup | 1.5h |
| Dual-read + client + documents route removal | 1.5h |
| Archive migration + Drizzle | 0.5h |
| E2E + staging validation | 1h |
| Deploy + 48h monitor | 0.5h |
| **Total** | **~5–6h (~1 dev day)** |

**Note:** Bulk backfill for transfers (if orphans > 0) adds **2–4h** not included above.

---

## Related

- [4d-distributions-waybill-fk-migration.md](./4d-distributions-waybill-fk-migration.md) — blocker cleared
- [4b-grn-relational-sprint.md](./4b-grn-relational-sprint.md) — dual-read deferred backfill
- [4c-ctn-transfers-sprint.md](./4c-ctn-transfers-sprint.md) — dual-read deferred backfill
