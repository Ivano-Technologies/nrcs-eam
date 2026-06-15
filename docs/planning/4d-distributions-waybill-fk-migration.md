# Sprint 2 (4d): Repoint `distributions.waybill_id` to relational `waybills`

## Problem

- [`distributions.waybill_id`](../../drizzle/schema.ts) FK references `inventory_documents.id` (migration `0009_inventory_phase4.sql`).
- UI ([`Distributions.tsx`](../../client/src/pages/inventory/Distributions.tsx)) loads `inventoryV2.waybills.list` and passes `waybills.id`.
- Phase 4a fulfill now creates relational `waybills` only (no `inventory_documents` waybill).

Selecting a dispatched waybill in the distribution form can violate the FK or store an ID in the wrong table space.

## Blocker for Phase 6

[`docs/inventory-ledger-architecture.md`](../inventory-ledger-architecture.md) and [`docs/wms-phase-roadmap.md`](../wms-phase-roadmap.md): `inventory_documents` cannot be dropped until this FK is repointed and backfilled.

## Proposed migration

### Step 1 — Schema change

Option A (preferred): repoint existing column.

```sql
ALTER TABLE distributions DROP CONSTRAINT IF EXISTS distributions_waybill_id_inventory_documents_id_fk;
ALTER TABLE distributions
  ADD CONSTRAINT distributions_waybill_id_waybills_id_fk
  FOREIGN KEY (waybill_id) REFERENCES waybills(id) ON DELETE SET NULL;
```

Update Drizzle:

```typescript
waybillId: integer("waybill_id").references(() => waybills.id),
```

### Step 2 — Backfill

For rows where `waybill_id` points at `inventory_documents`:

```sql
UPDATE distributions d
SET waybill_id = w.id
FROM inventory_documents idoc
JOIN waybills w ON w.wb_number = idoc.document_number
WHERE d.waybill_id = idoc.id
  AND idoc.document_type = 'waybill';
```

Unmatched legacy IDs: set `waybill_id` NULL and log for manual review.

### Step 3 — Verify API

- [`inventoryV2.distributions.create`](../../server/routers/inventoryRouter.ts) — no code change if column semantics stay `waybills.id`.
- Smoke: create distribution linked to dispatched waybill from Phase 4a fulfill.

### Step 4 — Cleanup (Phase 6)

After all waybill flows use relational `waybills` and backfill is verified:

- Drop remaining `inventory_documents` where `document_type = 'waybill'`.
- Drop `inventory_documents` table when no FKs remain.

## Dependencies

- **4a (done):** Fulfill writes relational waybills.
- **4b:** GRN still on `inventory_documents` — independent of this FK.
- **Reporting:** Any report joining `distributions.waybill_id` to `inventory_documents` must switch to `waybills`.

## Acceptance

1. Distribution create with relational waybill ID succeeds (no FK error).
2. Existing distributions with legacy waybill doc IDs backfilled or nulled with audit log.
3. Drizzle schema + migration applied in dev/staging before production.
