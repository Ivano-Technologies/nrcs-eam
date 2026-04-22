# Shared UI components

## ModuleFiltersCard

All list and management screens use `ModuleFiltersCard` for the top filter and action strip (`client/src/components/ModuleFiltersCard.tsx`).

- **filterRow:** search input first, then dropdowns left-to-right.
- **toolbarStart (optional):** view toggles, map toggles.
- **toolbarEnd (optional):** export, import, template, then primary action last.
- **Row 2** is omitted automatically when both `toolbarStart` and `toolbarEnd` are absent (no empty bordered strip).

Period selectors (time windows) are allowed in `filterRow` but are conceptually not filters. Consider a dedicated period selector if a screen needs both rich filters and a time window.
