# NRCS EAM polish brief (Kezie decisions, 9 Oct 2026)

Sources (read-only audits on dev 4b51d75):
- /workspace/nrcs-eam-qa/heading-audit/REPORT.md (headings, casing, naming, sidebar brand fix)
- /workspace/nrcs-eam-qa/layout-audit/REPORT.md (Facilities, default views, transition, spacing, dead UI)

## Decisions locked by Kezie
1. Sidebar brand: roomier option. Chevron moves out of the brand row to a tab on the sidebar edge, so "Nigerian Red Cross Society" and "Enterprise Asset Management" sit on exactly two lines (13px and 12px). Logo stays exactly as is for now; Kezie decides after this round.
2. Folded icon rail (fullBleed) is the default on map views only (Asset Map, Facilities Map). The four wide report tables (Monthly warehouse report, WMS stock movements, WMS loss and damage, Branch scorecards Table view) KEEP folding automatically. All other pages open with the full sidebar. Asset Scanner stays excluded, print previews unchanged.
3. Card view is the default wherever a Card/Table toggle exists, on desktop too. EXCEPT dense lists (Assets, Stock overview): Table view stays default. One time reset of every user's saved view (migrate localStorage keys; save only on an actual user toggle, never on page load).
4. Facilities Map view is remembered like Table and Card (use ?view=map so the fold is decided from the route).
5. Facilities cards: QR becomes a small icon, full QR moves to the detail page.
6. Remove the drag to resize sidebar handle.
7. Link Email notifications and Mobile work orders in the menu.
8. Keep the sidebar entries; drop the duplicate Facilities type filter and the WMS report hub.
9. Smooth transition: Suspense boundary inside DashboardLayout (no full app spinner), fold decided from route (or useLayoutEffect), stable sidebar markup with fading labels, 200ms ease slide, ResizeObserver for map, honour prefers-reduced-motion, Facilities map fits pins after animation ends.
10. Copy: sentence case everywhere, glossary per heading report (Facility, Requisitions, Receipts (GRN), Waybills, Sign in, Notification preferences, British spelling). Sidebar renames (Order fulfillment, Receiving, Shipping and tracking) approved to match pages. No dashes as punctuation, hyphens only in standard compound words.
11. Dead UI: wire, remove or keep per layout-audit section E (27 items). Remove fluff, nothing decorative without a job.
12. Everything well placed and measured: spacing system from layout-audit section D (page padding, section gap, card padding, radius, toolbar height).

## Suggested PR order (small PRs, Preview each, Design Accept before Chief smoke)
1. Sidebar brand fix + edge chevron tab (heading report section 1).
2. No layout flash (Suspense inside layout) + smooth transition + reduced motion.
3. Default views + localStorage migration + Facilities ?view=map.
4. Facilities polish (toolbar fit at 1280/1440, cards, edit dialog, add as dialog, detail page, QR icon).
5. Dead UI cleanup + menu links + removals.
6. Inventory page titles + sentence case + naming renames.
7. Spacing system + section/card/table header sizes + PageHeader adoption.
8. Buttons and empty states, phone form grids, automated check.

Budget mode is on until Monday: Kezie asked for this round himself, so PR 1 to 3 can start; queue the rest in order and keep checks lean.
