# NRCS EAM: heading, label and sidebar brand audit

Repo `Ivano-Technologies/nrcs-eam`, branch `dev`, commit `4b51d75` (8 Oct 2026, 15:38 WAT). Read only: cloned on the box, nothing pushed. Counts: TypeScript AST scan of 212 `.tsx` files in `client/src`, excluding tests, `ComponentShowcase`, print templates and legal pages. Raw data and scripts sit next to this file.

## 1. Sidebar brand block

**Where:** `client/src/components/DashboardLayout.tsx` lines 250 to 335 (expanded branch 289 to 333). Widths: `client/src/lib/sidebarWidth.ts` (`SIDEBAR_FULL_WIDTH = 256`, `SIDEBAR_RAIL_WIDTH = 64`).

**Current markup:** `SidebarHeader` `p-2 h-20` › row `flex gap-2 px-2` › link `flex gap-2 px-1 py-1` › logo `h-10 w-10` (40px) › text column `flex-col gap-0.5`: line 1 `font-bold text-sm leading-tight` (14px/700), line 2 `text-xs leading-tight text-sidebar-foreground/70` (12px/400); chevron button `h-8 w-8` (32px) with `ChevronsLeft h-3.5 w-3.5`.

**Why four lines:** width left for text = 256 − 16 (header padding) − 16 (row px-2) − 8 (row gap) − 32 (chevron) − 8 (link px-1) − 40 (logo) − 8 (gap) = **128px**. The app sets no font family (`index.css`, `index.html`), so Tailwind's `ui-sans-serif, system-ui` stack renders Segoe UI on Windows, SF Pro on Apple, Roboto on Android. Measured in headless Chrome:

| Text at current size | Segoe UI (Selawik clone) | Inter (SF Pro proxy) | Roboto | Column |
|---|---|---|---|---|
| "Nigerian Red Cross Society" 14px bold | 177px | 186px | 171px | 128px |
| "Enterprise Asset Management" 12px | 158px | 171px | 161px | 128px |

Each line is 25 to 45% wider than the column and wraps once: four lines (reproduced in a layout simulation in all 7 fonts tested).

**Fix (yields exactly two lines):**

```tsx
<SidebarHeader className="border-b border-sidebar-border h-14 justify-center">   {/* was h-20; aligns with the h-14 top bar */}
  <div className="flex w-full items-center gap-1.5 px-1">                       {/* was gap-2 px-2 */}
    <Link className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 ..."> {/* drop px-1 */}
      <img className="h-8 w-8 shrink-0" ... />                                  {/* 40 → 32px */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[12px] leading-4 font-semibold tracking-[-0.01em] text-sidebar-foreground">Nigerian Red Cross Society</span>
        <span className="truncate text-[11px] leading-[14px] tracking-[-0.01em] text-sidebar-foreground/75">Enterprise Asset Management</span>
      </div>
    </Link>
    <button className="h-6 w-6 shrink-0 ...">  {/* 32 → 24px, still meets WCAG 2.5.8 (24px); icon stays h-3.5 */}
```

New column: 256 − 16 − 8 − 24 − 6 − 32 − 8 = **162px**. Measured widths at the proposed sizes:

| Line | Segoe UI | Inter | Roboto | Arial (Liberation) | Noto Sans | Ubuntu | DejaVu |
|---|---|---|---|---|---|---|---|
| 1: 12px/600, −0.01em | 145 | 155 | 143 | 154 | 153 | 151 | 180 ✗ |
| 2: 11px/400, −0.01em | 142 | 154 | 145 | 144 | 153 | 148 | 163 ✗ |

Fits with 7 to 19px spare in every common OS font. Only bare Linux with DejaVu as the system UI font overflows; `truncate` turns that into an ellipsis instead of wrapping. Text block is 16 + 2 + 14 = 32px, matching the 32px logo. Subtitle contrast at /75 on the navy sidebar (#042F54) is 8.3:1. Logo and chevron must both shrink: keeping the 40px logo and 32px chevron leaves 146px, too narrow for Inter at 12px. Readability floor is 11px for line 2; do not go below. Roomier alternative: move the chevron out of the row (a floating edge tab), giving 192px and allowing 13px/600 plus 12px/400 (Inter 171 and 171px). Optional hardening: pin `--font-sans` to a self-hosted Inter so widths stop varying by OS. Add an assertion to `tests/features/improvements.spec.ts` (`sidebar-org-name` box height ≤ 18px).

## 2. Findings (patterns and inconsistencies)

Per-route inventory is in Appendix A; every off-standard string with file:line and a proposed rewrite is in Appendix B (96 rows).

**Casing.** Multi-word app UI strings: **294 sentence case, 86 Title Case, 14 mixed** (75% sentence). Page titles are already 28/28 sentence case via `PageHeader`; the drift is below them:
- CardTitle 41 sentence vs 33 Title (Title Case in 19 files; worst: `Welcome.tsx` 6, `FacilityDetail.tsx` 5, `AssetScanner.tsx` 4 of 4, `Inventory.tsx` 4).
- h2/h3: 19 sentence vs 17 Title (`Assets.tsx:929-1270` add form Title, same sections in edit form `Assets.tsx:1885-2144` sentence; `PendingUsers.tsx:78,158`).
- Dialog titles 19 vs 7 Title plus 2 mixed ("Compose email Notification" `EmailNotifications.tsx:73`, "New count Wizard" `StockCounts.tsx:165`).
- Tabs 4 vs 4 (`Inventory.tsx:357-360`, `Kits.tsx:56-57`, `Expiry.tsx:77`).
- Table headers 73 sentence vs 15 Title plus 7 hard UPPERCASE (`Assets.tsx:1540-1545` register group row) and paper form style in `MonthlyWarehouseReport.tsx:161-167` ("IN (b)", "OUT TO: Others (e)").
- Only page title in Title Case: "Asset Map" (`AssetMap.tsx:577`, also `appNav.ts` label).

**Heading elements and sizes.**
- 4 routes bypass `PageHeader` with raw h1: `AssetDetail.tsx:467` (own back button, 3xl bold), `AssetMap.tsx:577` (2xl semibold), `MobileWorkOrders.tsx:96` (2xl bold), `MobileWorkOrderDetail.tsx:219` (xl bold).
- Stock card and bin card detail pages have **no h1**, only `h2 text-2xl font-bold` (`StockCardDetail.tsx:62`, `BinCardDetail.tsx:42`).
- Inside `InventoryShell` every one of 13 routes shows h1 "Inventory"; 4 add an ad hoc `h2 text-2xl font-bold` (Movements, Stock Cards, Bin Cards, CTN Registry) and 8 show nothing, so the visible heading never matches the sidebar label ("Receiving", "Order fulfillment" …).
- 10 inventory pages carry dead `!embedInShell` PageHeaders that are never routed (e.g. `Transfers.tsx:166`, `Expiry.tsx:71` "Expiry tracking", `Inventory.tsx:342` raw h1).
- CardTitle size: 49 per-instance overrides in 22 files (`text-base` 22, which equals the default, `text-sm` 16, `text-lg` 7, `text-2xl` at `FieldDashboard.tsx:53`). Dashboard cards add `.dashboard-section-title` (5 files, navy, border) while other cards do not.
- h2 sizes: `text-xl semibold`, `text-2xl bold`, `text-lg`, `text-[13px]`, `text-[19px]`; h3: `text-sm`, `text-lg`, `text-[13px]`, `font-medium` vs `font-semibold`. `Assets.tsx` form h3s hard-code `text-[#1a2332]` (the `--color-navy` value) instead of `text-foreground`.
- Tables: 125 raw `<th>` in 15 files render at browser bold (700; Tailwind preflight does not reset th) on `bg-muted/50`, versus 252 `TableHead` at 500 on `bg-background`. Same app, two header weights.
- Eyebrow labels: only 3 (`MobileBottomNav.tsx:189,223`, `NotFound.tsx:18`), all `text-xs font-semibold uppercase tracking-wide`. Good pattern, not yet a component.
- Subtitles: 31, of which 16 end with a period and 15 do not (Home uses three styles).

**Naming for the same concept.**
- Requisitions: sidebar and tab "Order fulfillment", but URL, dashboard "Pending requisitions", "New requisition", "No requisitions yet" (22 uses vs 4).
- Receipts: sidebar "Receiving", URL `receipts`, button and detail "New GRN"/"GRN detail", card "Goods Received Note", empty "No receipts yet".
- Issues: sidebar "Shipping and tracking", URL `issues`, everything else "waybill" (22 uses); also collides with "Inventory tracking".
- Facility vs Site: 133 vs 11; "Site" survives in `Welcome.tsx:90,142`, `FleetHealth.tsx:79,175`, `AssetScanner.tsx:329,334`, `Assets.tsx:1784`, `GlobalSearch.tsx:260` although `/app/sites` redirects to facilities.
- Movements: nav "Movements", page "Inventory movements", report "WMS stock movements", dashboard "Stock movement".
- Expiry: "Expiry", "Expiry tracking", "WMS expiry". Count: "Stock counts", "New count", "New count Wizard".
- Settings: user menu "Notification Settings" opens page "Notification preferences" whose card is "Notification Settings".
- Sign in: "Sign in" (9) vs "login"/"log in" (`ResetPassword.tsx:203,206`, `ManusDialog.tsx` legacy).
- Spelling: British "Catalogue" (10) next to American "fulfillment", "Customize", "Centralized", "organizational".
- Maintenance group contains an item also called "Maintenance" (`appNav.ts`); "Donor assets report" sits under Reports with an `/assets` URL.

**Buttons and empty states.**
- Create verbs split: "Add …" 11, "New …" 10, "Create …" 2; trigger and dialog often disagree ("Add asset" → "Add New Asset", "Add schedule" → "Create Maintenance Schedule", "New requisition" → "Create Requisition", "New CTN" → "Create CTN (manual)", "Create work order" → "Create New Work Order"; edit is "Edit asset" but "Update Work Order").
- Export: "Export to Excel" 14, "Export CSV" 3, "Export PDF" 4, bare "Export" 2. Back: "Back to asset register" vs "Back to Facilities" vs `PageHeader` back link.
- Empty states: 49 messages; "No … yet" 39 vs "No … found" 8 (used for empty data, not just filters: `WorkOrders.tsx:336`, `Maintenance.tsx:271`, `StockCards.tsx:86`); 15 end with a period, 34 do not; only 24 use the `EmptyState` components.

## 3. Proposed standard

**Casing:** sentence case everywhere (75% already). Keep acronyms (NRCS, HQ, CTN, GRN, WMS, VED, QR) and proper nouns; write uppercase eyebrows in sentence case and apply `uppercase` via CSS. Printed forms in `lib/document-printing` keep their official caps. Subtitles: one fragment, no final period. Prefer "and" over "&".

**Type scale (existing tokens only):**

| Role | Element / component | Classes |
|---|---|---|
| Page title | `PageHeader` h1 | `text-3xl font-bold tracking-tight text-foreground` (unchanged) |
| Page subtitle | `PageHeader` p | `text-base text-muted-foreground max-w-2xl` (unchanged) |
| Eyebrow / label | `PageHeader eyebrow`, `Eyebrow` | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` |
| Section heading | `SectionHeader` h2 | `text-lg font-semibold tracking-tight text-foreground` (+ optional description `text-sm text-muted-foreground`) |
| Card title | `CardTitle` h3 | `text-base font-semibold leading-tight` (bake size into primitive, remove overrides); `variant="dashboard"` = `.dashboard-section-title` |
| Subsection (in forms/cards) | `SectionHeader level={3}` | `text-sm font-semibold text-foreground` |
| Table header | `TableHead` only | `text-sm font-medium text-foreground` on `bg-background`; raw `th` gets the same via a shared class |
| Helper / description | `CardDescription`, field help | `text-sm text-muted-foreground` |

**Glossary (recommendations; product sign-off needed):** Facility (never site; "location" only for address/coordinates). Requisition (nav "Requisitions"). Receipt for the record, GRN for the document (nav "Receipts"). Waybill (nav "Waybills"). Inventory = the module, stock = quantities ("Stock movements", "Stock counts", "Stock cards"). Expiry. Work order (no "WO" outside dense tables). Sign in / sign out. Notification preferences. Asset map. Maintenance schedules (nav item). British English throughout (fulfilment, catalogue, customise, centralised). Buttons: "Add <noun>" for create, dialog title repeats the button; "Edit <noun>"; "Save changes"; "Export to Excel", "Export to PDF", "Export to CSV". Empty data: "No <plural> yet" (no period) plus optional body; filtered: "No <plural> match these filters".

**Components:** extend `client/src/components/ui/PageHeader.tsx` with `eyebrow` (e.g. "Inventory" above "Receipts") and `compact` (Asset map); add `ui/SectionHeader.tsx` (`title`, `description`, `actions`, `level 2|3`); bake size into `CardTitle` and add `variant`; route all raw `th` through `TableHead`; use `EmptyState` everywhere.

## 4. Rollout (small PRs, by visible impact)

| # | PR | Scope | Effort |
|---|---|---|---|
| 1 | Sidebar brand fix + header h-14 + e2e height assertion | `DashboardLayout.tsx`, 1 spec | 2 h |
| 2 | Inventory titles: `PageHeader eyebrow`, h1 = page name, delete ad hoc h2s and 10 dead `!embedInShell` blocks; h1 for stock/bin card detail | `InventoryShell.tsx` + 14 inventory pages | 1 d |
| 3 | Sentence case sweep (Appendix B, 96 strings, 38 files) | copy only | 0.5 d |
| 4 | Glossary renames in nav, titles, buttons, empty states (after sign-off) | `appNav.ts`, `InventoryShell.tsx`, `InventorySecondaryNav.tsx`, ~15 pages, e2e selectors | 0.5 to 1 d |
| 5 | `SectionHeader` + `CardTitle` sizing; remove 49 CardTitle size overrides (22 files) and hard-coded `#1a2332` | ~30 files | 1 d |
| 6 | Tables: 125 raw `th` → `TableHead`/shared class; Assets group row caps via CSS | 15 files | 0.5 to 1 d |
| 7 | `AssetDetail`, `AssetMap`, mobile work orders onto `PageHeader` | 4 files | 0.5 d |
| 8 | Buttons, export labels, empty states onto `EmptyState`; subtitles without periods | ~25 files | 0.5 d |
| 9 | Guardrail: vitest/lint check for raw h1 outside `PageHeader` and Title Case literals in heading props | 1 test | 0.5 d |

Total about 5.5 to 6.5 dev days; PRs 1 to 3 (about 1.75 days) remove the most visible inconsistencies.

## Appendix A: route inventory

Casing counts for multi-word strings: S sentence, T Title, M mixed, U uppercase, W single word or acronym (neutral). PageHeader = `components/ui/PageHeader.tsx` (h1 text-3xl bold, subtitle text-base muted).

| Route | Sidebar label | Page title (element) | Subtitle | Section and card headings: S/T/M/U (examples of non sentence case) | Table headers: S/T/U (W = single word or acronym) | Dialog titles S/T |
|---|---|---|---|---|---|---|
| `/app` | Dashboard | PageHeader "Dashboard" | 3 variants, mixed period | S7 T4 (My Branch Stock Status; My Pending Requisitions; Branch Performance) | none | none |
| `/app/assets` | Asset register | PageHeader "Asset register" | yes, period | S4 T4 W4 (Item Details; Item Code; Financial Value) | U6 W1 | S2 T1 |
| `/app/assets/:id` | (Asset register) | raw h1 {asset.name} text-3xl bold | raw p {assetTag} | S8 T3 W6 (Depreciation Analysis; Depreciation Schedule; Maintenance History & Timeli) | T2 W7 | S1 T2 |
| `/app/asset-map` | Asset Map | raw h1 "Asset Map" text-2xl semibold | raw p text-sm, period | S5 W2 | none | none |
| `/app/scanner` | Asset scanner | PageHeader "Asset scanner" | yes, period | T4 W1 (Scan Asset; Asset Found; Quick Update) | none | none |
| `/app/facilities/*` | All facilities, National HQ, ... | PageHeader "Facilities" (FacilitiesShell) | yes, period | T1 (Edit Facility) | S3 W7 | S1 W1 |
| `/app/facilities/:id` | (Facilities) | PageHeader {facility.name} | type description | S2 T5 W1 (Child Facilities; Facility Photos ({…}/{…}); Recent Activity) | none | S1 |
| `/app/inventory/stock-overview` | Stock overview | PageHeader "Inventory" (InventoryShell) | InventoryShell per tab, period | S4 T4 (VED Classification; Opening Stock Balances Impor; Historical Movements Import) | S6 W32 | S1 |
| `/app/inventory/tracking` | Inventory tracking | PageHeader "Inventory" | InventoryShell per tab, period | none | none | none |
| `/app/inventory/tracking/stock-cards` | (More: Stock cards) | "Inventory" + h2 "Stock Cards" text-2xl | InventoryShell per tab, period | T1 (Stock Cards) | S6 W3 | none |
| `/app/inventory/tracking/stock-cards/:id` |  | h2 "Stock Card Detail" (no h1) | none | T1 (Stock Card Detail) | T3 W6 | none |
| `/app/inventory/tracking/bin-cards` | (More: Bin cards) | "Inventory" + h2 "Bin Cards" | InventoryShell per tab, period | T1 (Bin Cards) | S6 T1 W2 | none |
| `/app/inventory/tracking/bin-cards/:id` |  | h2 "Bin Card Detail" (no h1) | none | T1 (Bin Card Detail) | T1 W7 | none |
| `/app/inventory/movements` | (More: Movements) | "Inventory" + h2 "Inventory movements" | InventoryShell per tab, period | S1 | T1 W7 | none |
| `/app/inventory/transfers` | (More: Transfers) | "Inventory" only | InventoryShell per tab, period | none | S2 W7 | S2 |
| `/app/inventory/counts` | (More: Stock counts) | "Inventory" only | InventoryShell per tab, period | none | W5 | M1 |
| `/app/inventory/expiry` | (More: Expiry) | "Inventory" only | InventoryShell per tab, period | S1 | S2 W19 | none |
| `/app/inventory/distributions` | (More: Distributions) | "Inventory" only | InventoryShell per tab, period | none | T1 W7 | S1 |
| `/app/inventory/kits` | (More: Kits) | "Inventory" only | InventoryShell per tab, period | none | T1 W3 | S1 |
| `/app/inventory/ctn-registry` | CTN registry | "Inventory" + h2 "CTN Registry" | InventoryShell per tab, period | T1 (CTN Registry) | S3 W5 | S1 |
| `/app/inventory/requisitions` | Order fulfillment | "Inventory" only | InventoryShell per tab, period | none | T1 W6 | T1 |
| `/app/inventory/receipts` | Receiving | "Inventory" only | InventoryShell per tab, period | none | S1 T1 W5 | W1 |
| `/app/inventory/receipts/:id` | (Receiving) | PageHeader "GRN detail"/"New GRN" | none | S1 T1 (Goods Received Note) | none | none |
| `/app/inventory/issues` | Shipping and tracking | "Inventory" only | InventoryShell per tab, period | none | S4 W3 | none |
| `/app/inventory/issues/:id` | (Shipping and tracking) | PageHeader "Waybill detail"/"New waybill" | none | S1 T1 (Waybill / Delivery Note) | none | none |
| `/app/inventory/import` | Import | PageHeader "Import" | yes, period | W1 | W4 | none |
| `/app/inventory/import/drafts` | (More: Import drafts) | PageHeader "Import drafts" | yes, period | S2 | W6 | none |
| `/app/maintenance` | Maintenance | PageHeader "Maintenance" | yes, no period | T2 (Upcoming Maintenance (Next 3; All Schedules) | none | T1 |
| `/app/work-orders` | Work orders | PageHeader "Work orders" | yes, no period | W1 | none | T1 |
| `/app/work-orders/:id` | (Work orders) | PageHeader {workOrder.title} | {workOrderNumber} | T1 (Work Order Details) | none | T1 |
| `/app/mobile-work-orders` | (mobile) | raw h1 "Work orders" text-2xl bold | none | none | none | none |
| `/app/mobile-work-order/:id` | (mobile) | raw h1 "Work order #" text-xl bold | none | T2 W3 (Add Notes; Previous Notes) | none | none |
| `/app/work-order-templates` | Work order templates | PageHeader | yes, no period | none | none | none |
| `/app/warranty-alerts` | Warranty alerts | PageHeader | yes, no period | none | none | none |
| `/app/reports/depreciation-schedule` | Depreciation schedule | PageHeader | yes, period | S4 | S5 W5 | none |
| `/app/fleet-health` | Fleet health | PageHeader | yes, period | S3 | S2 W3 | none |
| `/app/reports` | Reports overview | PageHeader | yes, period | S1 W1 | none | none |
| `/app/reports/wms (+6 sub reports)` | WMS report suite, WMS ... | PageHeader (meta.title) | yes, period | S1 | M1 S12 W38 | none |
| `/app/reports/wms/monthly-warehouse-report` | Monthly warehouse report | PageHeader | yes, period | none | M4 S1 T2 U1 W3 | none |
| `/app/report-scheduling` | Report scheduling | PageHeader | yes, no period | none | none | none |
| `/app/assets/donors` | Donor assets report | PageHeader | yes, period | S4 W1 | S2 W11 | none |
| `/app/reports/branch-scorecards` | Branch scorecards | PageHeader | yes, period | none | S3 T1 W5 | none |
| `/app/settings/users` | Users | PageHeader | yes, no period | none | S1 W10 | S5 |
| `/app/settings/pending-users` | Pending users | PageHeader | yes, no period | T2 (Pending Requests ({…}); Processed Requests ({…})) | none | none |
| `/app/administration/compliance-register` | Compliance register | PageHeader (+ InsuranceRegister) | yes, no period | S7 W1 | S9 W34 | S5 |
| `/app/administration/activity-log` | Activity log | PageHeader | yes, no period | W1 | W6 | none |
| `/app/administration/verification-campaigns` | Verification campaigns | PageHeader | yes, period | S1 W2 | W6 | S1 |
| `/app/administration/observability` | System health | PageHeader "System health" | yes, no period | S1 T2 (Connection Pool & Cache; Database & Security) | W8 | none |
| `/app/settings` | Settings | PageHeader "Settings" | yes, no period | M1 S1 T2 W4 (Dashboard Widgets; Install App; Data & Privacy) | none | none |
| `/app/notification-preferences` | (menu: Notification Settings) | PageHeader "Notification preferences" | yes, no period | T1 (Notification Settings) | none | none |
| `/app/welcome` | (onboarding) | CardTitle/h3 Title Case | none | T6 W2 (Asset Tracking; Financial Tracking; Add Your First Site) | none | none |


## Appendix B: strings to change (file:line, current, proposed)

| File:line | Element | Current | Proposed (sentence case) |
|---|---|---|---|
| `components/AssetDepreciation.tsx:54` | CardTitle | Depreciation Analysis | Depreciation analysis |
| `components/AssetDepreciation.tsx:120` | h4 | Depreciation Schedule | Depreciation schedule |
| `components/AssetDepreciation.tsx:127` | TableHead | Beginning Value | Beginning value |
| `components/AssetDepreciation.tsx:130` | TableHead | Ending Value | Ending value |
| `components/AssetMaintenanceTimeline.tsx:65` | CardTitle | Maintenance History & Timeline | Maintenance history and timeline |
| `components/DashboardWidgetSettings.tsx:59` | CardTitle | Dashboard Widgets | Dashboard widgets |
| `components/dashboard/FieldDashboard.tsx:53` | CardTitle | My Branch Stock Status | My branch stock status |
| `components/dashboard/FieldDashboard.tsx:86` | CardTitle | My Pending Requisitions | My pending requisitions |
| `pages/Administration/Observability.tsx:126` | CardTitle | Connection Pool & Cache | Connection pool and cache |
| `pages/Administration/Observability.tsx:244` | CardTitle | Database & Security | Database and security |
| `pages/AssetDetail.tsx:769` | DialogTitle | Photo Preview | Photo preview |
| `pages/AssetDetail.tsx:865` | DialogTitle | Upload Photos | Upload photos |
| `pages/AssetMap.tsx:577` | h1 | Asset Map | Asset map |
| `pages/AssetScanner.tsx:180` | CardTitle | Scan Asset | Scan asset |
| `pages/AssetScanner.tsx:221` | Button | Switch to Manual entry | Switch to manual entry |
| `pages/AssetScanner.tsx:264` | CardTitle | Asset Found | Asset found |
| `pages/AssetScanner.tsx:381` | CardTitle | Quick Update | Quick update |
| `pages/AssetScanner.tsx:467` | CardTitle | Scanner Tips | Scanner tips |
| `pages/Assets.tsx:918` | DialogTitle | Add New Asset | Add asset |
| `pages/Assets.tsx:929` | h3 | Item Details | Item details |
| `pages/Assets.tsx:1020` | h3 | Item Code | Item code |
| `pages/Assets.tsx:1041` | h3 | Financial Value | Financial value |
| `pages/Assets.tsx:1119` | h3 | Purchase / Acquisition Information | Purchase and acquisition |
| `pages/Assets.tsx:1540` | th | ITEM DETAILS | Item details (keep visual caps via CSS) |
| `pages/Assets.tsx:1541` | th | ITEM CODE | Item code (keep visual caps via CSS) |
| `pages/Assets.tsx:1542` | th | FINANCIAL VALUE | Financial value (keep visual caps via CSS) |
| `pages/Assets.tsx:1543` | th | PURCHASE/ACQUISITION INFORMATION | Purchase and acquisition (keep visual caps via CSS) |
| `pages/Assets.tsx:1544` | th | ASSIGNED TO | Assigned to (keep visual caps via CSS) |
| `pages/Assets.tsx:1545` | th | CONDITION | Condition (keep visual caps via CSS) |
| `pages/DashboardSettings.tsx:442` | CardTitle | Install App | Install app |
| `pages/DashboardSettings.tsx:572` | CardTitle | Data & Privacy | Data and privacy |
| `pages/EmailNotifications.tsx:73` | DialogTitle | Compose email Notification | Compose email notification |
| `pages/EmailNotifications.tsx:158` | CardTitle | Email History | Email history |
| `pages/Facilities.tsx:631` | CardTitle | Edit Facility | Edit facility |
| `pages/FacilityDetail.tsx:211` | CardTitle | Child Facilities | Child facilities |
| `pages/FacilityDetail.tsx:224` | CardTitle | Facility Photos ({…}/{…}) | Facility photos ({…}/{…}) |
| `pages/FacilityDetail.tsx:343` | CardTitle | Recent Activity | Recent activity |
| `pages/FacilityDetail.tsx:346` | h3 | Recent Asset Movements | Recent asset movements |
| `pages/FacilityDetail.tsx:366` | h3 | Recent Inventory Transactions | Recent inventory transactions |
| `pages/FacilityDetail.tsx:378` | Button | Back to Facilities | Back to facilities |
| `pages/Home.tsx:611` | CardTitle | Branch Performance | Branch performance |
| `pages/Home.tsx:624` | CardTitle | Branch Performance | Branch performance |
| `pages/Inventory.tsx:357` | TabsTrigger | Stock Overview | Stock overview |
| `pages/Inventory.tsx:360` | TabsTrigger | Item Catalogue | Item catalogue |
| `pages/Inventory.tsx:856` | CardTitle | VED Classification | VED classification |
| `pages/Inventory.tsx:887` | CardTitle | Opening Stock Balances Import | Opening stock balances import |
| `pages/Inventory.tsx:964` | CardTitle | Historical Movements Import | Historical movements import |
| `pages/Inventory.tsx:1197` | CardTitle | Warehouse Update Tools | Warehouse update tools |
| `pages/LandingPage.tsx:43` | Button | Go to Dashboard | Go to dashboard |
| `pages/Maintenance.tsx:100` | DialogTitle | Create Maintenance Schedule | Add maintenance schedule |
| `pages/Maintenance.tsx:244` | CardTitle | Upcoming Maintenance (Next 30 Days) | Upcoming maintenance (next 30 days) |
| `pages/Maintenance.tsx:260` | CardTitle | All Schedules | All schedules |
| `pages/MobileWorkOrderDetail.tsx:396` | CardTitle | Add Notes | Add notes |
| `pages/MobileWorkOrderDetail.tsx:430` | CardTitle | Previous Notes | Previous notes |
| `pages/NotificationPreferences.tsx:105` | CardTitle | Notification Settings | Notification settings |
| `pages/PendingUsers.tsx:78` | h2 | Pending Requests ({…}) | Pending requests ({…}) |
| `pages/PendingUsers.tsx:158` | h2 | Processed Requests ({…}) | Processed requests ({…}) |
| `pages/Welcome.tsx:34` | CardTitle | Asset Tracking | Asset tracking |
| `pages/Welcome.tsx:67` | CardTitle | Financial Tracking | Financial tracking |
| `pages/Welcome.tsx:90` | h3 | Add Your First Site | Add your first site |
| `pages/Welcome.tsx:103` | h3 | Register Your Assets | Register your assets |
| `pages/Welcome.tsx:116` | h3 | Schedule Maintenance | Schedule maintenance |
| `pages/Welcome.tsx:134` | h3 | You're Ready! | You're ready! |
| `pages/Welcome.tsx:196` | Button | Go to Dashboard | Go to dashboard |
| `pages/WorkOrderDetail.tsx:57` | CardTitle | Work Order Details | Work order details |
| `pages/WorkOrderDetail.tsx:67` | DialogTitle | Update Work Order | Edit work order |
| `pages/WorkOrders.tsx:125` | DialogTitle | Create New Work Order | Create work order |
| `pages/inventory/BinCardDetail.tsx:42` | h2 | Bin Card Detail | Bin card (h1) |
| `pages/inventory/BinCardDetail.tsx:95` | TableHead | WB No. | Waybill no. |
| `pages/inventory/BinCards.tsx:31` | h2 | Bin Cards | Bin cards |
| `pages/inventory/CtnRegistryPage.tsx:107` | h2 | CTN Registry | CTN registry |
| `pages/inventory/Distributions.tsx:86` | th | Dist No | Distribution no. |
| `pages/inventory/Expiry.tsx:77` | TabsTrigger | Expiring Soon (<90d) | Expiring soon (<90d) |
| `pages/inventory/Kits.tsx:56` | TabsTrigger | Kit Catalogue | Kit catalogue |
| `pages/inventory/Kits.tsx:57` | TabsTrigger | Kit Operations | Kit operations |
| `pages/inventory/Kits.tsx:65` | th | Kit Code | Kit code |
| `pages/inventory/Kits.tsx:88` | p | Assemble Kits | Assemble kits |
| `pages/inventory/Kits.tsx:118` | p | Disassemble Kits | Disassemble kits |
| `pages/inventory/Movements.tsx:108` | th | Balance After | Balance after |
| `pages/inventory/ReceiptDetail.tsx:297` | CardTitle | Goods Received Note | Goods received note |
| `pages/inventory/Receipts.tsx:153` | th | Date of Arrival | Date of arrival |
| `pages/inventory/Requisitions.tsx:194` | th | Req No | Requisition no. |
| `pages/inventory/Requisitions.tsx:347` | DialogTitle | Create Requisition | New requisition |
| `pages/inventory/StockCardDetail.tsx:62` | h2 | Stock Card Detail | Stock card (h1) |
| `pages/inventory/StockCardDetail.tsx:102` | TableHead | Document Ref | Document ref |
| `pages/inventory/StockCardDetail.tsx:104` | TableHead | Store No. | Store no. |
| `pages/inventory/StockCardDetail.tsx:109` | TableHead | Bin Card N° | Bin card no. |
| `pages/inventory/StockCards.tsx:39` | h2 | Stock Cards | Stock cards |
| `pages/inventory/StockCounts.tsx:165` | DialogTitle | New count Wizard | New stock count |
| `pages/inventory/WaybillDetail.tsx:319` | CardTitle | Waybill / Delivery Note | Waybill / delivery note |
| `pages/reports/MonthlyWarehouseReport.tsx:161` | TableHead | Opening Balance (a) | Opening balance (a) |
| `pages/reports/MonthlyWarehouseReport.tsx:162` | TableHead | IN (b) | In (b) |
| `pages/reports/MonthlyWarehouseReport.tsx:163` | TableHead | OUT TO: Distributions (c) | Out to distributions (c) |
| `pages/reports/MonthlyWarehouseReport.tsx:164` | TableHead | OUT TO: Branches store (d) | Out to branch stores (d) |
| `pages/reports/MonthlyWarehouseReport.tsx:165` | TableHead | OUT TO: Others (e) | Out to others (e) |
| `pages/reports/MonthlyWarehouseReport.tsx:167` | TableHead | Closing Balance | Closing balance |
