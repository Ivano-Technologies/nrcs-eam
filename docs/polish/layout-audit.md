# NRCS EAM: Facilities, default views, layout transition, spacing and dead UI audit

Repo `Ivano-Technologies/nrcs-eam`, branch `dev`, commit `4b51d75` (origin/dev unchanged at audit time, 9 Oct 2026 09:20 WAT). Read only: nothing pushed, no PRs. Paths are relative to `client/src/` unless they start with `tests/`. Heading, casing and label wording are in `../heading-audit/REPORT.md` and are not repeated here.

Method: read every Facilities file and the layout chain (`ProtectedAppSection` › `DashboardLayout` › `ui/sidebar` › `PageShell`); TypeScript AST scans of 136 app `.tsx` files (scripts and raw JSON in `tool/`: `scan.js` for dead controls and route targets, `layout.js` for spacing tokens); `tsc --noEmit` on the whole repo (passes with 0 errors, so every `trpc.*` call used by the UI exists on the server; Convex is not used by this app).

---

## A. Facilities module

**Routes.** `/app/facilities/{all,national-hq,branches,divisions,clinics,warehouses}` render `FacilitiesTabRoute` (`pages/facilities/FacilitiesTabRoutes.tsx:5`) = `FacilitiesShell` (header and Add button) + `FacilitiesPage` (`pages/Facilities.tsx:127`). `/app/facilities/new` (`pages/FacilitiesNew.tsx`) renders the same page with `autoOpenCreate`. `/app/facilities/:id` is `pages/FacilityDetail.tsx`. Legacy `/app/sites*` redirect. Views: Table, Card, Map (`components/facilities/FacilitiesToolbar.tsx`, `components/facilities/FacilitiesMap.tsx`).

**How Map view switches layout.** `Facilities.tsx:138` calls `useFullBleed(viewMode === "map")`. The hook (`lib/fullBleed.tsx:66`) registers in a `useEffect`; `DashboardLayout.tsx:62,75` turns the registry into `useAutoRail`, which sets `--sidebar-width` to 64 (`lib/sidebarWidth.ts`) without touching the saved 256/64 preference. Only the sidebar folds: the map stays inside `PageShell` padding (`px-4 sm:px-6 py-6`), below the page header and toolbar, inside a rounded border frame (`FacilitiesMap.tsx:356-360`). So "full bleed" on Facilities means "rail only"; Asset Map instead escapes the padding with negative margins (`AssetMap.tsx:573`). Two map pages, two frame treatments.

### Findings (16)

| # | Where | Issue | Fix |
|---|---|---|---|
| A1 | `FacilitiesToolbar.tsx:222-231` | Desktop toolbar needs about 1,156px on one row (search 288 + selects 112/116/132 + count ~190 + 3 segment toggle ~234 + More 36 + gaps). Content width is 976px at 1280 and 1,136px at 1440 with the full sidebar, so it wraps to two rows there, but fits at 1,168px once the rail is showing (Map view at 1280). Switching Table ↔ Map therefore also flips the toolbar between one and two rows mid animation. | Search `w-64`, count moved under the toolbar or into the toggle row on `<xl`, toggle icon only below `xl` (labels in `aria-label`). Target one row at 1280 with full sidebar. |
| A2 | `Facilities.tsx:452-483` | Card shows code, address and contact person with no labels; empty values render empty `div`s (467-469) so card heights vary in one row. Contact has no label, "Parent:" does. | Label/value rows, skip empty fields, clamp address to 2 lines, fixed card min height. |
| A3 | `Facilities.tsx:454,455` | Card padding is the shadcn default (`py-6 gap-6`) plus `CardHeader pb-2`: 24px top and 24px title to badges, while cards are `gap-3` apart. Loose inside, tight outside. | Compact list card: `p-4 gap-3`, grid `gap-4` (see D). |
| A4 | `Facilities.tsx:454` | Card is a clickable `div` (no `role`, `tabIndex`, Enter handling). Table rows same (`:519-523`). | Wrap title in a `Link` with a stretched hit area. |
| A5 | `Facilities.tsx:471-478` | Every card renders a live 64px QR SVG (50 per page) as its only action. Visually dominant; trigger has no `aria-label` (`components/CardQrCode.tsx:79`). | Small QR icon button with label, or move to detail page. Kezie decides (Q6). |
| A6 | `Facilities.tsx:476`, `Assets.tsx:1512` | QR payload hardcodes `https://nrcseam.techivano.com`; wrong on preview and staging hosts. | Use `window.location.origin`. |
| A7 | `Facilities.tsx:547-619`, `629-636` | Edit is table only (Card view has no edit or delete). Edit puts Save/X icons in the row but the form opens as a Card at the bottom of the page, below up to 100 rows. | One Edit dialog (reuse the create dialog), reachable from row menu, card menu and the detail page. |
| A8 | `Facilities.tsx:606` | Delete uses `window.confirm`; detail page uses `AlertDialog`. | `AlertDialog` everywhere. |
| A9 | `FacilitiesShell.tsx:43-58`, `FacilitiesNew.tsx` | Add facility navigates to a different route component, so the page remounts: Map or Card choice is lost and the rail unfolds. Closing the dialog leaves the URL on `/facilities/new` (refresh reopens it). | Open the dialog in place (`?new=1&type=` on the current segment), clear the param on close; keep `/facilities/new` as a redirect. |
| A10 | `Facilities.tsx:640` vs `FacilitiesToolbar.tsx:140-145` | Count shown twice (toolbar "N facilities · M on the map" and footer "N facilities"). | Keep toolbar count only. |
| A11 | `Facilities.tsx:379` | `isLoading` replaces toolbar and list with a spinner; toolbar pops in later. | Render toolbar always, skeleton the list. |
| A12 | `FacilitiesMap.tsx:300-308` | First fit runs as soon as the map is ready, during the 200ms rail animation, so pins are framed for the narrower width. Asset Map waits for `frameStable` (`AssetMap.tsx:409`). | Gate the first fit on a stable size (reuse `useElementSize`). |
| A13 | `FacilitiesMap.tsx:359`, `AssetMap.tsx:573,590` | Frame radius 14px vs `rounded-2xl` (16px); gutter 24px vs 16px/0; height by JS (`useFillHeight`) vs CSS `calc(100dvh-88px)`. | One `MapFrame` component used by both. |
| A14 | `FacilityDetail.tsx:147,378-380` | Two back controls (header link and bottom button). | Drop the bottom button. Back link should return to the segment and view the user came from. |
| A15 | `FacilityDetail.tsx:336-338,387` | Statistic tiles are raw `<a href>` (full page reload). Inventory and Work orders ignore `?siteId` (only `Assets.tsx:207-212` reads it), so 2 of 3 tiles land on unfiltered lists. | `Link`; add `siteId` support to `WorkOrders.tsx` and `Inventory.tsx` (or point at existing filters). |
| A16 | `FacilityDetail.tsx:145-380` | Six full width cards stacked; Statistics sits below Photos; no Edit action; no coordinates or mini map although the record has lat/long ("View on Google Maps" searches by address text, `:196-205`); child facilities and recent work orders are plain text, not links; photo delete button is hover only with no `aria-label` (`:263-270`); lightbox has no Esc or dialog role (`:310-331`). | Two column layout at `lg` (details + stats + map left, activity right), Edit in header actions, links, coordinates link when present, use `Dialog` for the lightbox. |

Naming (non casing): router and test ids still say `sites` (`trpc.sites.*`, `data-testid="sites-list"`); More menu item "Template" should say "Download import template" (`FacilitiesToolbar.tsx:165-168`); table column "State or region" vs filter and form "State" (`Facilities.tsx:504,705`); header action "Sync asset coordinates from facility" is long for a header button (`FacilityDetail.tsx:175`).

---

## B. Default views

Rule requested: folded rail only on Asset Map and the Facilities Map view; every other page opens with the full sidebar; list pages default to Card where a toggle exists.

### B1. Pages with a Card/Table toggle (11 toggles on 10 routes)

All but Facilities use `hooks/useMobileDefaultViewMode.ts`: phones always open in Card; desktop and tablet open in the saved value or `table`.

| Route | Toggle at | localStorage key | Current default (desktop) | Change |
|---|---|---|---|---|
| `/app/facilities/*` | `Facilities.tsx:132-142` (own copy of the hook), toolbar `FacilitiesToolbar.tsx:200,228` | `viewMode_facilities` (Map never saved) | Table | Card; move to the shared hook |
| `/app/assets` | `Assets.tsx:203,1409` | `viewMode_assets` | Table | Card |
| `/app/inventory/stock-overview` (Overview tab) | `Inventory.tsx:122,465` | `viewMode_inventory` | Table | Card |
| same route, Item catalogue tab | `Inventory.tsx:123,711` | `viewMode_inventory_catalogue` | Table | Card |
| `/app/inventory/requisitions` | `inventory/Requisitions.tsx:35,154` | `viewMode_inventory_requisitions` | Table | Card |
| `/app/inventory/distributions` | `inventory/Distributions.tsx:21,65` | `viewMode_inventory_distributions` | Table | Card |
| `/app/inventory/tracking/stock-cards` | `inventory/StockCards.tsx:17,81` | `viewMode_stock_cards` | Table | Card |
| `/app/inventory/tracking/bin-cards` | `inventory/BinCards.tsx:15,34` | `viewMode_bin_cards` | Table | Card |
| `/app/fleet-health` (Replacement pipeline card) | `FleetHealth.tsx:34,144` | `viewMode_fleet_health` | Table | Card |
| `/app/administration/verification-campaigns` | `Administration/VerificationCampaigns.tsx:40,121` | `viewMode_verification_campaigns` | Table | Card. Note: one toggle in the Campaigns card header also switches the Location discrepancies list in the other card (`:236`). |
| `/app/reports/branch-scorecards` | `reports/BranchScorecards.tsx:28,55` | `viewMode_branch_scorecards` | Table (also turns on full bleed) | Card; see B2 |

**Important trap:** the hook writes the value to localStorage on every mount (`useMobileDefaultViewMode.ts:19-22`, same in `Facilities.tsx:291-295`), so every desktop user who has ever opened these pages already has `"table"` stored even if they never touched the toggle. Changing the fallback to `"card"` alone changes nothing for existing users. Needed change: persist only on an explicit toggle, and either rename keys (`viewMode_v2_*`) to reset everyone once, or keep old keys to respect real choices (cannot tell real choices from auto writes; see Q3). Tests to update: `tests/auth/sites-module.spec.ts:24-48` and `tests/helpers/liveTestData.ts:47-71` expect `facility-row-*` (table) by default; `tests/features/inventory-v2.spec.ts:11-44`; `components/ViewToggle.test.tsx`.

Toggle placement is inconsistent: left of a filter card toolbar (Assets, Inventory, StockCards, BinCards), right of a card header (FleetHealth, VerificationCampaigns), inline mid row (Requisitions, Distributions, BranchScorecards), right cluster (Facilities). Pick one spot (right cluster of the toolbar, before More).

### B2. Full bleed users today (`lib/fullBleed.tsx:22-37`, 13 calls)

| View | Call | Conflicts with new rule? |
|---|---|---|
| Asset Map | `AssetMap.tsx:145` | No (keep) |
| Facilities Map view | `Facilities.tsx:138` | No (keep) |
| Monthly warehouse report (11 columns) | `reports/MonthlyWarehouseReport.tsx:18` | **Yes** |
| WMS stock movements (10 columns) | `reports/WmsStockMovementsReport.tsx:5` | **Yes** |
| WMS loss and damage (9 columns) | `reports/WmsLossDamageReport.tsx:5` | **Yes** |
| Branch scorecards, Table view (11 columns) | `reports/BranchScorecards.tsx:29` | **Yes** (and a Card default would mostly hide it) |
| 5 print previews | `inventory/ReceiptPrint.tsx:8`, `WaybillPrint.tsx:7`, `StockCardPrint.tsx:7`, `BinCardPrint.tsx:7`, `reports/MonthlyWarehouseReportPrint.tsx:7` | No visible effect: these routes render outside `DashboardLayout` (`ProtectedAppSection.tsx:177-221`), so the flag is a no op. Safe to delete for clarity. |

Flagged, not decided (Q1): 4 report views conflict. Losing the rail costs those tables 192px of width at 1280 (976 vs 1,168px), so they will scroll sideways more.

Related: "every other page opens with the full sidebar" is only true for users whose saved preference is 256. The saved width lives in localStorage `sidebar-width` and is overwritten by the server preference `userPreferences.sidebarWidth` (`DashboardLayout.tsx:58-91`). A user who folded the sidebar once sees the rail on every page. Q2.

---

## C. Transition between regular and folded layouts

**Current mechanism.** State driven, not route driven: a page calls `useFullBleed(true)` → registry state in `DashboardLayout` → `useAutoRail` returns 64 → inline CSS variable `--sidebar-width` on `SidebarProvider` (`DashboardLayout.tsx:99-104`). shadcn sidebar animates two elements: the fixed `sidebar-container` (`transition-[left,right,width] duration-200`) and the in flow `sidebar-gap` (`transition-[width] duration-200`, `ui/sidebar.tsx:203-222`); the content (`SidebarInset`) follows the gap, so content width is already animated in principle.

**Why it feels abrupt (6 causes, in order of impact):**

1. **Whole app swaps to a full screen spinner on first visit to a page.** The only `Suspense` boundary is outside the layout (`ProtectedAppSection.tsx:373-378`); all pages are `lazy` and there is no boundary inside `DashboardLayout`. Wouter navigation is a sync update, so the first navigation to an unloaded chunk unmounts sidebar and header, shows `ProtectedSectionSuspenseFallback` (`:161-170`, `min-h-screen`), then remounts everything (sidebar menu search text and other layout state reset). This is the "layout flash on route change".
2. **Rail is requested one frame late.** `useFullBleed` registers in `useEffect` (`lib/fullBleed.tsx:69-73`), after the new page has painted at the old width; then the width animates. Users see the page at 256, then watch it fold. Same on leaving a map.
3. **Sidebar contents swap instantly while the width animates.** `DashboardLayout.tsx:253-334` renders two different header trees by `sidebarWidth <= 64` (header becomes about 96px tall in the rail vs 80px expanded), the menu search box is unmounted in the rail (`:339-353`, about 53px), nav labels and user name are removed (`SidebarGroupedNav.tsx:95`, `DashboardLayout.tsx:388`). Net effect: every nav item jumps vertically by about 37px at t=0, and on expand the labels appear inside a 64px column and wrap or clip for 200ms.
4. **Reduced motion is not respected.** The motion-reduce classes are `motion-reduce:[&_[data-slot=sidebar-gap]]:transition-none ...` on `<Sidebar className>` (`DashboardLayout.tsx:248`), but that className lands on `sidebar-container` itself, and the gap is its sibling, so neither selector matches anything. There is no global `prefers-reduced-motion` rule in `index.css`. The comment in `lib/fullBleed.tsx:13` claiming otherwise is wrong.
5. **Content reflows every frame.** Animating the gap width relayouts the whole page 12 times in 200ms: 1,600px Facilities table, Recharts `ResponsiveContainer`s, toolbars that cross their wrap point (A1). This is where the jank comes from on slower laptops.
6. **Map framing.** Google Maps follows its container, but Facilities fits bounds during the animation (A12) and its height recalculates if the toolbar wraps or unwraps mid animation (`FacilitiesMap.tsx:68-87`).

Minor: `transition-[margin,padding]` on `SidebarInset` (`DashboardLayout.tsx:434`) animates nothing (margins never change in the default variant); remove. `Sidebar` already supports `disableTransition` (`ui/sidebar.tsx:140`) but it is unused.

**Proposed smooth approach (files and changes):**

1. `components/DashboardLayout.tsx:476`: wrap `{children}` in `<Suspense fallback={<PageLoader />}>` inside `PageShell` so the layout never unmounts. Optional: `startTransition` around sidebar `setLocation` calls in `SidebarGroupedNav.tsx` to keep the old page visible while the chunk loads.
2. Decide the rail in the same render as the route. Add `RAIL_ROUTES = ["/app/asset-map"]` matched from `useLocation()` in `DashboardLayout`, and make the Facilities map view URL driven (`?view=map`, also fixes A9 and lets the view be shared). `fullBleed = routeMatch || registryActive`. Minimum version: switch `useEffect` to `useLayoutEffect` in `lib/fullBleed.tsx:69` so registration happens before paint.
3. Keep the sidebar markup stable across widths (`DashboardLayout.tsx:250-353`, `SidebarGroupedNav.tsx`): one header of fixed `h-14` in both states (matches the top bar, as the heading audit already proposed); keep labels, search and user text mounted with `overflow-hidden whitespace-nowrap` and fade them with `opacity` keyed on a `data-rail` attribute: collapse = labels fade out over 100ms then width shrinks; expand = width grows, labels fade in with a 100ms delay.
4. Animate with transforms instead of per frame reflow (in `DashboardLayout.tsx`, small hook `useRailTransition`): on width change set the gap to the final width at once and FLIP the content (`SidebarInset` starts at `translateX(oldWidth - newWidth)` and transitions to 0 over 200ms, `ease-[cubic-bezier(0.2,0,0,1)]`, wrapper already `overflow-x-clip`). The fixed sidebar container keeps its width transition (cheap: it is fixed and its contents are clipped). Result: one layout per toggle, GPU composited motion, map resized once. If FLIP is judged too much, the fallback is today's gap width transition plus `contain: layout paint` on `<main>`.
5. Map: keep ResizeObserver sizing (`useFillHeight` and `useElementSize`); gate Facilities' first fit on stable size (`FacilitiesMap.tsx:302`); after a rail change re-fit only if the user has not panned or zoomed.
6. Reduced motion: add to `index.css`: `@media (prefers-reduced-motion: reduce) { [data-slot=sidebar-gap], [data-slot=sidebar-container], [data-slot=sidebar-inset] { transition: none !important; } }` and skip the FLIP when `matchMedia("(prefers-reduced-motion: reduce)")` matches. Delete the dead classes at `DashboardLayout.tsx:248`.
7. Tests: extend `lib/fullBleed.test.tsx` for route driven rail; a Playwright check that `app-sidebar` never detaches during navigation to `/app/asset-map` and that `data-sidebar-width` is 64 on first paint there.

---

## D. General layout pass

### D1. Measured drift (AST counts over 136 app files)

- Page root rhythm: `space-y-6` on 20 pages, `space-y-4` on 21, `space-y-5` on 1 (list below).
- Page header: `PageHeader` has an `actions` prop, used by 6 pages; 14 header rows rebuild it with `className="mb-0"` plus a custom flex row, with 4 different class combinations; 6 of them never stack on phones.
- Gaps: `gap-2` 216, `gap-4` 97, `gap-3` 91, `gap-1.5` 27, `gap-6` 7. Card list grids split `gap-3` (9 pages) vs `gap-4` (4 pages).
- Radius: `rounded-md` 67, `rounded-lg` 48, `rounded` 24, `rounded-xl` 20, `rounded-[10px]` 14, plus `rounded-[14px]`, `rounded-2xl`, `rounded-3xl`, `rounded-[20px]`, and `.dashboard-card` uses `var(--radius-card)`.
- 279 hardcoded hex colours inside classNames; 29 `text-[13px]`, 21 `[10px]` values.
- Three toolbar systems: `ModuleFiltersCard` (titled "Filters" card, 8 uses), `FacilitiesToolbar` (single row, no card), ad hoc rows (Requisitions, Distributions, BranchScorecards, WorkOrders, Reports, WmsReportSuite).

### D2. Proposed spacing system (existing Tailwind tokens only)

| Token | Value | Use |
|---|---|---|
| Page padding | `px-4 sm:px-6 py-6` (keep `PageShell`) | All pages. Data pages full width; detail pages `max-w-7xl`; form pages `max-w-3xl` (`PageFormWidth`). Map pages use one `MapFrame` that bleeds to the shell edge (`-mx-4 sm:-mx-6`). |
| Page header | `PageHeader` with `actions`, always `mb-6` | No custom header rows. Actions wrap under the title below `sm`. |
| Section gap | `space-y-6` (24px) | Page root and between major sections. |
| Toolbar to content | `space-y-4` (16px) | Toolbar, then list. |
| Toolbar | controls `h-9`, `gap-2`, one row at `xl`; search `w-64`; selects `w-36`; right cluster `ml-auto gap-2` = count, view toggle, More; max one primary button (in the header) | Replaces `ModuleFiltersCard`'s title and card chrome. |
| Card grid | `gap-4`; `md:grid-cols-2 xl:grid-cols-3` lists; KPI tiles `sm:grid-cols-2 lg:grid-cols-4` (or `-5` only at `2xl`) | All card lists and stat tiles. |
| Card padding | Section card: shadcn default (`py-6 px-6 gap-6`). List card: `p-4 gap-3` via a `size="sm"` Card variant | Ends `CardHeader pb-2` overrides (29). |
| Radius | surfaces `rounded-xl`; controls and inner tiles `rounded-md`; pills `rounded-full` | Drop `rounded-[10px]`, `[14px]`, `2xl`, `3xl`, bare `rounded`. |

### D3. Offenders (file:line)

Header rows rebuilt instead of `PageHeader actions` (14): `Maintenance.tsx:85`*, `WorkOrders.tsx:109`*, `WorkOrderTemplates.tsx:165`*, `ReportScheduling.tsx:177`*, `EmailNotifications.tsx:56`*, `WarrantyAlerts.tsx:43`*, `Home.tsx:241`, `Home.tsx:458`, `assets/DonorAssets.tsx:87`, `reports/DepreciationSchedule.tsx:77`, `Users.tsx:213`, `compliance/InsuranceRegister.tsx:126`, `Administration/Observability.tsx:106`, `Assets.tsx:898` (* no stacking on phones: title and button crowd at 390px). `Assets.tsx:898-1347` is a header row whose right column only holds a dialog, so it renders empty.

Page root `space-y-4`/`space-y-5` instead of `space-y-6` (22): `Facilities.tsx:382`, `FacilityDetail.tsx:145`, `Inventory.tsx:338` (5), `inventory/BinCardDetail.tsx:40`, `BinCards.tsx:30`, `Distributions.tsx:54`, `Expiry.tsx:68`, `ImportDraftsPage.tsx:39`, `ImportPage.tsx:66`, `Issues.tsx:60`, `Kits.tsx:47`, `Movements.tsx:57`, `ReceiptDetail.tsx:288`, `Receipts.tsx:83`, `Requisitions.tsx:119`, `StockCardDetail.tsx:60`, `StockCards.tsx:38`, `StockCounts.tsx:69`, `Transfers.tsx:163`, `WaybillDetail.tsx:311`, `reports/MonthlyWarehouseReport.tsx:43`, `reports/WmsExpiryReport.tsx:38`. Plus `components/inventory/InventoryShell.tsx:64` adds `mb-5` tabs between header `mb-6` and content (20px odd step).

Card list grid `gap-3` vs `gap-4`: `gap-3` in `Facilities.tsx:452`, `Inventory.tsx:469,745`, `inventory/BinCards.tsx:37`, `StockCards.tsx:88`, `Distributions.tsx:70`, `Requisitions.tsx:160`, `reports/BranchScorecards.tsx:72`, `FleetHealth.tsx:150`; `gap-4` in `Assets.tsx:1487`, `WorkOrders.tsx:290`, `WorkOrderTemplates.tsx:186`, `ReportScheduling.tsx:202`.

Dashboard (`pages/Home.tsx`): KPI grid `gap-3 md:gap-4` beside `gap-6` sections (`:502`); 5 KPIs in 2 columns from `sm` to `xl` leaves one orphan tile (`:502`); error banner adds `mb-4` inside `space-y-6` (`:484`); "Facility status" is a bare `h2` + list while every other section is a card (`:572-575`); Fleet health card is a whole card for one link plus developer text (`:586-603`, see E); Branch performance tiles `gap-2` (`:632`) and no link to Branch scorecards; period selector sits in a hand built row instead of `actions` (`:458-478`).

Toolbars that wrap or crowd: `Assets.tsx:1410-1483` (up to 6 buttons on the right: Export, Template, Import, Add asset, Sync coordinates from facilities, Recalculate all depreciation; admin maintenance actions belong in More); `FacilitiesToolbar.tsx:222-231` (A1); `inventory/Receipts.tsx:122-134` (4 buttons, 2 dead); `inventory/Distributions.tsx:61-67` and `Requisitions.tsx:150-155` (filters, toggle and primary button in one card row, toggle mid row); `WorkOrders.tsx:267-287` (titled Filters card holding a single select in a half empty 2 column grid); `Reports.tsx:258-326` (Filters card with Export menu inside the filter row); `reports/WmsReportSuite.tsx:272` (third filter panel style `rounded-md border p-4`).

Fixed column grids that do not collapse on phones (dialogs): `inventory/Receipts.tsx:282` (`grid-cols-5` line items, placeholder only labels), `inventory/Requisitions.tsx:373` (`grid-cols-4`), `inventory/Distributions.tsx:163` (`grid-cols-4`, 7 inputs), `Maintenance.tsx:103`, and 30 `grid-cols-2 gap-4` form rows in `Assets.tsx` (930 to 2169) and `AssetDetail.tsx` (955 to 1343).

Stat tiles: `FacilityDetail.tsx:335` (`gap-3`), `ActivityLog.tsx:78` (`md:grid-cols-3 lg:grid-cols-4`), `assets/DonorAssets.tsx:154` (`md:grid-cols-5`), `Administration/ComplianceRegister.tsx:251`, `compliance/InsuranceRegister.tsx:179`, `reports/DepreciationSchedule.tsx:116` (`md:grid-cols-4`, jumps 1 to 4); `WarrantyAlerts.tsx:73` adds `mb-4` inside a card.

Other: `components/Footer.tsx:9` uses `container mx-auto` so footer text does not line up with full width page content at wide screens; inventory has 3 stacked nav levels on one screen (sidebar children, `InventoryShell` pill tabs, `Inventory.tsx:355-368` Tabs, then category chips at `:371`); `SidebarInset` is a `<main>` and holds another `<main data-testid="app-page-main">` (`DashboardLayout.tsx:434,472`, nested landmarks).

---

## E. Dead or unneeded UI

Static scan (`tool/scan.js`): buttons with no handler, empty handlers, `href="#"`, links and `setLocation` to unknown routes, menu items without handlers, switches without handlers, tabs without content, info toasts. Raw hits: 6 handlerless buttons (2 false positives: Collapsible trigger, button inside `Link`), 2 forever disabled, 0 empty handlers, 0 bad `href`, 0 unknown route targets, 4 info toasts (1 placeholder). `href="#"` appears only in the dev only `ComponentShowcase.tsx`. `tsc` clean, so no UI call to an undefined tRPC procedure. Each hit below was confirmed by reading the code. Total actionable: 27.

| # | file:line | What | Recommend |
|---|---|---|---|
| E1 | `inventory/Receipts.tsx:124` | "Export to Excel" button, no `onClick` | Wire (export exists for other modules) or remove |
| E2 | `inventory/Receipts.tsx:125` | "Template" button, no `onClick` | Remove (Import already routes to `/inventory/import`, which owns templates) |
| E3 | `Inventory.tsx:733` | "Export to Excel" (catalogue toolbar), `disabled` forever | Wire or remove |
| E4 | `Inventory.tsx:872` | "Export catalogue to Excel" (Settings tab), `disabled` forever; duplicates E3 | Remove (keep one export, in the toolbar) |
| E5 | `Inventory.tsx:875-880` | "Reset stock levels" toast "will be enabled in a later phase" | Remove until built |
| E6 | `inventory/InventoryTrackingPage.tsx:46-50` | "Adjustments" card: "A combined view is coming soon", links to `/inventory/adjustments`, which redirects back to this same page (`ProtectedAppSection.tsx:304-306`) | Remove the card (or point at Movements filtered by adjustment) |
| E7 | `Reports.tsx:313-317` | "Export to Excel" writes CSV named `*.xlsx.csv`; duplicate of "Export CSV" | Remove, or real XLSX |
| E8 | `Reports.tsx:319-322` | "Export PDF" = `window.print()` of the whole page incl. sidebar | Rename "Print" or real PDF |
| E9 | `Reports.tsx:343-353` | Each report is a Card with a title and an "Open" button only | Make the card itself the button; drop "Open" |
| E10 | `Reports.tsx:363-364` | Selected report title shows the raw id (`vedAnalysis`); description "Chart + table view for selected report" is filler | Map id to label; drop the description |
| E11 | `Home.tsx:586-603` | Fleet health card: title, a developer note ("It is not loaded on this page so the asset register stays responsive"), one link | Remove (Fleet health is in the sidebar) or make it a KPI tile |
| E12 | `Home.tsx:605-657` vs `/app/reports/branch-scorecards` | Branch performance block duplicates the scorecards report without linking to it | Keep, add "View scorecards" link; or remove |
| E13 | `Facilities.tsx:640` | Second facilities count (A10) | Remove |
| E14 | `FacilityDetail.tsx:378-380` | Second back control (A14) | Remove |
| E15 | `FacilityDetail.tsx:337-338` | Statistic tiles whose `?siteId` is ignored by target pages (A15) | Wire |
| E16 | `pages/EmailNotifications.tsx` (route `ProtectedAppSection.tsx:359`) | Page not linked from anywhere (sidebar, settings, menus) | Link from Settings (admin) or remove route |
| E17 | `pages/MobileWorkOrders.tsx` (route `:251`) | Only reachable from its own detail page back button (`MobileWorkOrderDetail.tsx:214`) | Link from mobile bottom nav or Work orders on phones, or remove |
| E18 | `ProtectedAppSection.tsx:343-345` | `/app/users/pending`, `/app/settings/pending-users`, `/app/pending-users` all render `PendingUsers`; first is never linked | Keep one route, redirect the others |
| E19 | `ProtectedAppSection.tsx:346-347`, `DashboardLayout.tsx:407-413`, `DashboardSettings.tsx:463-540` | Notification settings in two places: user menu "Notification Settings" → `/notification-preferences` (also `/settings/notifications`, never linked) and a Notifications card on Settings | One home for notifications; redirect the extra route |
| E20 | `config/appNav.ts:189-197` vs `reports/WmsReportSuite.tsx` | Sidebar lists the WMS hub and 6 of its 7 reports (Expiry `/reports/wms/expiry` missing, inconsistent) | Hub only in sidebar, or all 7 (Q5) |
| E21 | `config/appNav.ts:76-112` vs `FacilitiesToolbar.tsx:72-84` | Facilities has 6 sidebar children and a type select that navigates to the same 6 routes | Keep one (Q5) |
| E22 | `DashboardLayout.tsx:425-431` | Drag to resize handle; widths snap to 256/64 so it is a hidden duplicate of the chevron button and Ctrl+B | Remove (Q7) |
| E23 | `Facilities.tsx:471-478`, `Assets.tsx:1508-1514` | Full QR image on every card | Shrink to icon or move (Q6) |
| E24 | `pages/WorkOrders.tsx:267-287` | Titled "Filters" card for one select | Replace with toolbar select |
| E25 | `components/Footer.tsx:13` | "Enterprise Asset Management System" repeats the sidebar brand subtitle on every page | Remove line |
| E26 | `lib/fullBleed.tsx:22-37` and 5 print pages | Full bleed entries and calls that cannot take effect (B2) | Remove |
| E27 | Unused modules (0 imports): `components/BulkActionsToolbar.tsx`, `ManusDialog.tsx`, `icons/NairaIcon.tsx`, `hooks/usePWA.ts`, `lib/publicEnv.ts`, `lib/document-export/toExcel.ts`, `toPDF.ts`, `lib/assetMap/escape.ts`, `components/ui/{empty,input-group,chart,navigation-menu,button-group,kbd}.tsx`; `AIChatBox.tsx` used only by the dev showcase | Delete (ui primitives optional) |

Keep (checked, fine): `DashboardSettings.tsx:215` "No changes to save" (real feedback); `ReceiptDetail.tsx:231,238` offline draft toasts (real); `RequisitionsTable.tsx:30` button inside a `Link` (works, though a `Button asChild` would be cleaner); sidebar group header button (handled by `CollapsibleTrigger`, `SidebarGroupedNav.tsx:258`); Settings "Install App" card plus global install prompt (different moments).

---

## Proposed PRs (ordered by visible impact)

| # | PR | Scope | Effort |
|---|---|---|---|
| 1 | No layout flash | Suspense inside layout (`DashboardLayout.tsx:476`); `useLayoutEffect` in `fullBleed.tsx:69`; reduced motion CSS in `index.css` and delete dead classes `DashboardLayout.tsx:248,434` | S (half day) |
| 2 | Default views | Remove 4 report and 5 print `useFullBleed` calls (after Q1); Card default with persist on toggle only and key migration (`useMobileDefaultViewMode.ts`, Facilities onto the hook); update `FULL_BLEED_VIEWS`, `fullBleed.test.tsx`, 3 e2e files | S to M (1 day) |
| 3 | Smooth rail | Stable sidebar markup (fixed `h-14` header, labels kept mounted and faded), FLIP content transition, route driven rail, Facilities map `?view=map`, fit after stable size | M (2 days) |
| 4 | Facilities polish | A1 to A16: toolbar fits at 1280, card layout and padding, edit dialog shared by table/card/detail, Add in place, AlertDialog delete, QR origin, detail page two column with Edit and links, `siteId` on Work orders and Inventory | M (2 to 3 days) |
| 5 | Dead UI cleanup | E1 to E27 that do not need a decision | S (1 day) |
| 6 | Spacing system | `PageHeader actions` on 14 pages, `space-y-6` on 22 roots, `gap-4` card grids, Card `size="sm"`, one `Toolbar` replacing `ModuleFiltersCard` title row, Dashboard grid fixes, Footer alignment | M to L (3 days, can split by module) |
| 7 | Phone forms | Responsive line item and form grids (Receipts, Requisitions, Distributions, Maintenance, Assets, AssetDetail) | S (1 day) |

## Questions for Kezie

1. The 4 wide report views (Monthly warehouse report, WMS stock movements, WMS loss and damage, Branch scorecards table) auto fold today. Remove that (strict rule), or keep them as an exception?
2. If someone folded the sidebar on purpose, should non map pages still force the full sidebar, or respect their saved choice?
3. Card default: reset everyone once (existing saved "table" values are mostly automatic, not real choices), or only apply to new users? Also confirm Card for dense registers (Assets, Stock overview) on desktop.
4. Facilities Map view: remember it like Table/Card, or always open in Card and enter Map on demand?
5. Duplicate navigation: Facilities type select vs 6 sidebar children; WMS hub vs 6 sidebar report links. Which one stays?
6. QR codes on every card: keep visible (label printing in the field), shrink to an icon, or move to the detail page?
7. Remove the drag to resize sidebar handle (two snap widths make it redundant)?
8. `EmailNotifications` and `MobileWorkOrders` pages are orphaned: link them or remove them?
