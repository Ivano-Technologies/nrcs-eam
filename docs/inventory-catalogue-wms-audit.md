# `inventory_catalogue` — WMS vs Assets vs Finance-only audit

**Status:** Borderline decisions **signed off** (see table Notes). **IFRC seed execution** has a runnable script and a captured dev report — see [planning/ifrc-catalogue-audit-execution-report.md](planning/ifrc-catalogue-audit-execution-report.md). **Phase 2 gate:** do **not** start Phase 2 implementation until you **approve** those counts.

**Authority:** [inventory-ledger-architecture.md](inventory-ledger-architecture.md) Decision 2 + office supplies policy on this page.

---

## Office supplies policy (final)

**General rule:** Office supplies are **not** tracked in the EAM at all. They do **not** appear in `inventory_catalogue` or WMS. Staff record purchases under **Finance** (expense / petty cash).

**Exception — operational consumables:** An item that might historically have been tagged “office supply” belongs in WMS as **CONSUMABLE** if its **primary use** is to support **humanitarian operations** (GRNs, waybills, beneficiary ID stock, shipment labels, field registration forms, lanyards/wristbands, etc.).

**Administrative (Finance-only):** Pens, general stationery, undifferentiated printer paper, multipurpose toner/ink, flipchart paper for internal meetings — **do not catalogue** unless you later add **split SKUs** (e.g. dedicated “GRN paper” / “Waybill toner”) as **WMS CONSUMABLE** with explicit `item_code`s.

### Operational printing (final sign-off)

**No dedicated operational-printing SKUs** are introduced in this pass. Undifferentiated **printer paper**, **multipurpose toner/ink**, and **flipchart paper** default to **Finance only** until volume justifies dedicated catalogue lines.

---

## Legend

| Classification | Meaning |
|----------------|---------|
| **RELIEF_ITEM** | Relief commodity (food, shelter, kits, etc.); WMS with CTNs when received as consignment. |
| **CONSUMABLE** | Disposable / operational or medical / hygiene / PPE / WASH consumables; WMS with CTNs when stocked as consignment. |
| **ASSET** | Capital or register-grade equipment; **Assets** module — removed from `inventory_catalogue` after migration. |
| **NOT_IN_EAM (Finance)** | No catalogue row. |

| EAM scope | Meaning |
|-----------|---------|
| **WMS** | Stays in `inventory_catalogue`; `item_category` set per map in `shared/ifrcCatalogueWmsClassification.ts`. |
| **Assets** | Migrated to `assets` (`assetTag` = `INV-MIG-{item_code}`), row removed from catalogue. |
| **NOT_IN_EAM** | Not in EAM; Finance only. |

---

## Final classification — IFRC seed (`IFRC_CATALOGUE_SEED`)

**Count:** **48** rows in `shared/inventoryCatalogueSeed.ts` (not 40). DB column for “WMS class” is **`item_category`** plus EAM actions above.

| item_code | name (short) | IFRC category | Final WMS class | EAM scope | Notes |
|-----------|----------------|---------------|-----------------|------------|-------|
| HEBFOOD01 | High Energy Biscuits | Food | RELIEF_ITEM | WMS | Relief food. |
| RICFOOD02 | Rice 50kg | Food | RELIEF_ITEM | WMS | Relief food. |
| OILFOOD03 | Vegetable Oil 1L | Food | RELIEF_ITEM | WMS | Relief food. |
| SUGFOOD04 | Sugar 1kg | Food | RELIEF_ITEM | WMS | Relief food. |
| SALFOOD05 | Iodised Salt 1kg | Food | RELIEF_ITEM | WMS | Relief food. |
| MILFOOD06 | Powdered Milk 500g | Food | RELIEF_ITEM | WMS | Relief food. |
| TARPSHEL01 | Tarpaulin 4×6m | Shelter | RELIEF_ITEM | WMS | Shelter response. |
| TENTSHEL02 | Family Tent 16 sqm | Shelter | RELIEF_ITEM | WMS | Shelter response. |
| BLKTSHEL03 | Blanket synthetic | Shelter | RELIEF_ITEM | WMS | Shelter response. |
| MATTSHEL04 | Sleeping Mat | Shelter | RELIEF_ITEM | WMS | Shelter response. |
| PLASSHEL05 | Plastic Sheeting roll | Shelter | RELIEF_ITEM | WMS | Shelter response. |
| ROPSHEL06 | Rope 10mm 100m | Shelter | RELIEF_ITEM | WMS | Shelter response. |
| PEGSHEL07 | Tent Peg | Shelter | RELIEF_ITEM | WMS | Shelter response. |
| JERWASH01 | Jerry Can 20L | WASH | RELIEF_ITEM | WMS | WASH response. |
| BUCKWASH02 | Bucket 14L | WASH | RELIEF_ITEM | WMS | WASH response. |
| SOAPWASH03 | Soap bar | WASH | CONSUMABLE | WMS | Hygiene consumable. |
| WATERWASH04 | Aquatabs | WASH | CONSUMABLE | WMS | WASH consumable. |
| FILTEWASH05 | Household Water Filter ceramic | WASH | RELIEF_ITEM | WMS | Durable WASH relief item. |
| TOILETWASH06 | Emergency Toilet Kit | WASH | RELIEF_ITEM | WMS | WASH response. |
| FAIDHLTH01 | First Aid Kit family | Health | RELIEF_ITEM | WMS | Kit CTN flow (Phase 3). |
| FAIDHLTH02 | First Aid Kit community | Health | RELIEF_ITEM | WMS | Kit CTN flow (Phase 3). |
| ORSHLTH03 | ORS sachets | Health | CONSUMABLE | WMS | Medical consumable. |
| MALHLTH04 | LLIN mosquito net | Health | RELIEF_ITEM | WMS | Health response. |
| PRCTHLTH05 | Paracetamol packs | Health | CONSUMABLE | WMS | Medical consumable. |
| BPRESURE06 | Blood Pressure Monitor manual | Health | ASSET | **Assets** | **Final:** Asset Register — clinical device. |
| STRHLTH07 | Stretcher foldable | Health | ASSET | **Assets** | **Final:** Asset Register. |
| KCOKNFI01 | Kitchen Set family | NFI | RELIEF_ITEM | WMS | NFI response. |
| LANTNFI02 | Solar Lantern | NFI | RELIEF_ITEM | WMS | **Final:** WMS RELIEF_ITEM — relief NFI (not Asset Register). |
| RADIONFI03 | Radio solar/wind-up | NFI | ASSET | **Assets** | **Final:** Asset Register — comms equipment policy. |
| TORCHNFI04 | Flashlight LED | NFI | RELIEF_ITEM | WMS | NFI response. |
| CLOTHNFI05 | Clothing Kit adult | NFI | RELIEF_ITEM | WMS | NFI response. |
| CLOTHNFI06 | Clothing Kit child | NFI | RELIEF_ITEM | WMS | NFI response. |
| GLOVPPE01 | Nitrile gloves box | PPE | CONSUMABLE | WMS | PPE consumable. |
| MASKPPE02 | Surgical masks box | PPE | CONSUMABLE | WMS | PPE consumable. |
| N95PPE03 | N95 box | PPE | CONSUMABLE | WMS | PPE consumable. |
| GOGPPE04 | Safety Goggles | PPE | CONSUMABLE | WMS | PPE consumable. |
| APRPPE05 | Disposable apron pack | PPE | CONSUMABLE | WMS | PPE consumable. |
| HANDPPE06 | Hand sanitiser 500ml | PPE | CONSUMABLE | WMS | PPE consumable. |
| GENEQP01 | Portable Generator 5kVA | Emergency Response Equipment | ASSET | **Assets** | **Final:** Asset Register — generator. |
| FLDLGHTEQP02 | Flood Light LED rechargeable | Emergency Response Equipment | CONSUMABLE | WMS | **Final:** WMS CONSUMABLE — field lighting consumed in operations. |
| MEGPHEQP03 | Megaphone | Emergency Response Equipment | ASSET | **Assets** | **Final:** Asset Register — megaphone (same migration path as other comms equipment). |
| COMRADEQP04 | VHF handheld radio | Emergency Response Equipment | ASSET | **Assets** | **Final:** Asset Register. |
| GPSEQP05 | GPS handheld | Emergency Response Equipment | ASSET | **Assets** | **Final:** Asset Register. |
| HYGKIT01 | Family Hygiene Kit | Kits | RELIEF_ITEM | WMS | Kit CTN flow. |
| SHLTKIT02 | Emergency Shelter Kit | Kits | RELIEF_ITEM | WMS | Kit CTN flow. |
| FAKIT03 | Family First Aid Kit | Kits | RELIEF_ITEM | WMS | Kit CTN flow. |
| KITCHEN01 | Kitchen Set IFRC | Kits | RELIEF_ITEM | WMS | Kit CTN flow. |
| SCHKIT01 | School Kit | Kits | RELIEF_ITEM | WMS | Education-in-emergency kit; not admin stationery. |

---

## Borderline — **resolved** (final)

| Topic | Final decision |
|-------|------------------|
| FLDLGHTEQP02 (field lights) | **WMS CONSUMABLE** |
| COMRADEQP04 (VHF radios) | **Assets** |
| RADIONFI03 (solar/wind-up radio) | **Assets** |
| MEGPHEQP03 (megaphone) | **Assets** |
| LANTNFI02 (lanterns) | **WMS RELIEF_ITEM** |
| Undifferentiated printer paper | **Finance** — no SKU |
| Multipurpose toner / ink | **Finance** — no SKU |
| Flipchart paper | **Finance** — no SKU |

---

## Reclassification list (office-supply lens)

No IFRC seed line was an administrative “office supply” SKU; **no** office→CONSUMABLE reclassifications were required for the seed list. Pattern guide for **future / live** rows unchanged — apply case-by-case; do **not** blanket-update non-seed rows.

---

## Execution (seed + dev DB)

1. **Migrations:** `pnpm db:migrate:dev` (uses `.env`; applies `0014`, `0015`, …). `0014` clears invalid `sites.code` patterns and avoids duplicate `NHQ`/`LAG`/`KAN` before re-assigning seed facility codes.
2. **Import / upsert IFRC rows:** `pnpm db:import:ifrc` — sets `item_category` from `shared/ifrcCatalogueWmsClassification.ts`.
3. **Apply audit actions:** `pnpm db:apply:ifrc-audit` (runs migrate by default; use `--skip-migrate` if already migrated).
4. **Audit:** `pnpm db:audit:catalogue-wms` — prints all catalogue rows; **non-seed** rows matching office-like names without ops keywords are listed under “Flag for manual review”.

Captured metrics: **[planning/ifrc-catalogue-audit-execution-report.md](planning/ifrc-catalogue-audit-execution-report.md)**.

---

## Live database (non-seed rows)

Do **not** blanket-change rows outside `IFRC_CATALOGUE_SEED`. Use the pattern guide; ambiguous rows are flagged by `pnpm db:audit:catalogue-wms` for your review.

---

## Related

- [inventory-ledger-architecture.md](inventory-ledger-architecture.md)  
- [ifrcCatalogueWmsClassification.ts](../shared/ifrcCatalogueWmsClassification.ts) — machine-readable map used by import + apply scripts.
