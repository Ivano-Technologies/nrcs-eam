import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, ListFilter, RotateCw, Search, SearchX, X } from "lucide-react";
import type { FacilityType } from "@shared/facilities";
import {
  ASSET_STATUS_COLOURS,
  READINESS_COLOURS,
  READINESS_LABELS,
  READINESS_THRESHOLDS,
  READINESS_TIERS,
  pinTier,
  type MapScheme,
  type ReadinessTier,
} from "@/lib/facilityMapHelpers";
import {
  SORT_LABELS,
  TYPE_CHIP_LABELS,
  TYPE_LABELS,
  TYPE_ORDER,
  bubbleRadius,
  emptyContext,
  formatCount,
  hasActiveFilters,
  hasLocation,
  type ListSort,
  type MapFacility,
  type MapFilters,
  type MapLayer,
} from "@/lib/assetMap/model";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { chipBase, focusRing, mutedText, OfflineGlyph, ReadinessPill, TypeGlyph, linkText } from "./parts";

const LEGEND_KEY = "nrcs-asset-map-legend-open";

/**
 * Type chip counts. Solid colours rather than opacity so they hold AA (4.5:1 at 13px) on the
 * resting, hover and pressed chip in both themes.
 */
const chipCountText =
  "text-[#4B5563] group-aria-pressed:text-[#D6DCE5] dark:text-[#A3AEBD] dark:group-aria-pressed:text-[#3D4A5C]";

export type FacilityPanelProps = {
  layer: MapLayer;
  scheme: MapScheme;
  loading: boolean;
  all: MapFacility[];
  filtered: MapFacility[];
  tierCounts: Record<ReadinessTier, number>;
  typeCounts: Record<FacilityType, number>;
  filters: MapFilters;
  searchText: string;
  onSearchText: (q: string) => void;
  onSearchEnter: () => void;
  onToggleTier: (tier: ReadinessTier) => void;
  onToggleType: (type: FacilityType) => void;
  onToggleOffline: () => void;
  onToggleNoLocation: () => void;
  onClearFilters: () => void;
  sort: ListSort;
  onSort: (sort: ListSort) => void;
  selectedId: number | null;
  onSelect: (id: number, opener: HTMLElement | null) => void;
  /** Asset figures are limited to the caller's own facility. */
  statsLimited: boolean;
  /** The facility data request failed (and there is no earlier data to show). */
  loadError?: boolean;
  /** A retry is in flight. */
  retrying?: boolean;
  onRetry?: () => void;
  /** "panel" on desktop, "sheet" inside the mobile bottom sheet. */
  variant?: "panel" | "sheet";
  /** Mobile: type chips live behind a Filters button. */
  showTypeChips?: boolean;
  /**
   * Desktop: the panel is collapsed to the compact card while the drawer is open. It stays mounted
   * (hidden and inert) so filters, legend and list scroll come back exactly as they were.
   */
  concealed?: boolean;
  /** Desktop, narrow map with the drawer open and the panel expanded: collapse it back to the card. */
  onCollapse?: () => void;
  className?: string;
  style?: React.CSSProperties;
};

export function FacilityPanel(props: FacilityPanelProps) {
  const {
    layer,
    scheme,
    loading,
    all,
    filtered,
    tierCounts,
    typeCounts,
    filters,
    searchText,
    onSearchText,
    onSearchEnter,
    onToggleTier,
    onToggleType,
    onToggleOffline,
    onToggleNoLocation,
    onClearFilters,
    sort,
    onSort,
    selectedId,
    onSelect,
    statsLimited,
    loadError = false,
    retrying = false,
    onRetry,
    variant = "panel",
    showTypeChips = true,
    concealed = false,
    onCollapse,
    className,
    style,
  } = props;

  const [legendOpen, setLegendOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LEGEND_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(LEGEND_KEY, legendOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [legendOpen]);

  const offlineCount = all.filter((f) => !f.isActive).length;
  const onMap = filtered.filter(hasLocation).length;
  const active = hasActiveFilters(filters);
  // With no matches the bar is the empty neutral track, not the tier mix of the other filters.
  const totalForBar = filtered.length > 0 ? READINESS_TIERS.reduce((s, t) => s + tierCounts[t], 0) : 0;

  const assetTotals = useMemo(() => {
    let inUse = 0;
    let maintenance = 0;
    let retired = 0;
    let facilities = 0;
    for (const f of filtered) {
      if (!f.assetsByStatus || !f.statsVisible) continue;
      inUse += f.assetsByStatus.inUse;
      maintenance += f.assetsByStatus.maintenance;
      retired += f.assetsByStatus.retired;
      if ((f.assetCount ?? 0) > 0 && hasLocation(f)) facilities += 1;
    }
    return { inUse, maintenance, retired, total: inUse + maintenance + retired, facilities };
  }, [filtered]);

  const statusColours = ASSET_STATUS_COLOURS[scheme];
  const tierColours = READINESS_COLOURS[scheme];

  // Search (top of the panel; below the tiles in the mobile sheet, as in the mockup).
  const searchBlock = (
    <div className="flex gap-2 p-4 pb-3">
      <label className="relative flex-1">
        <span className="sr-only">Search facilities or codes</span>
        <Search className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", mutedText)} />
        <input
          type="search"
          value={searchText}
          onChange={(e) => onSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearchEnter();
            }
          }}
          placeholder="Search facilities or codes"
          data-testid="asset-map-search"
          className={cn(
            "h-10 w-full rounded-[10px] border border-[#8A8F98] bg-white pl-9 pr-3 text-sm text-[#111827] placeholder:text-[#62626C] dark:border-[#64768E] dark:bg-[#0F1724] dark:text-[#E6EAF0] dark:placeholder:text-[#A3AEBD]",
            "focus-visible:border-[#C8102E] focus-visible:ring-2 focus-visible:ring-[#C8102E]/30 focus-visible:outline-none"
          )}
        />
      </label>
      {!showTypeChips ? (
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className={cn(
            "inline-flex h-11 items-center gap-1.5 rounded-[10px] border border-[#8A8F98] px-3 text-sm font-medium dark:border-[#64768E]",
            focusRing
          )}
        >
          <ListFilter className="h-4 w-4" />
          Filters
          {filters.types.length ? <span className="tabular-nums">({filters.types.length})</span> : null}
        </button>
      ) : null}
      {onCollapse ? (
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse to the search card"
          title="Collapse to the search card"
          data-testid="asset-map-panel-collapse"
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] hover:bg-[#F3F4F6] dark:hover:bg-[#1E2B3C]",
            focusRing
          )}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );

  return (
    <section
      aria-label="Facilities"
      className={cn("flex min-h-0 flex-col", concealed && "invisible", className)}
      style={style}
      data-variant={variant}
      data-testid={variant === "panel" ? "asset-map-facility-panel" : undefined}
      data-concealed={concealed || undefined}
      aria-hidden={concealed || undefined}
      inert={concealed}
    >
      {variant === "panel" ? searchBlock : null}

      {filters.noLocationOnly ? (
        <div className="px-4 pb-3">
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-[#0B2545] pl-3 pr-1 text-[13px] font-medium text-white dark:bg-[#E6EAF0] dark:text-[#0F1724]">
            Facilities with no location
            <button
              type="button"
              onClick={onToggleNoLocation}
              aria-label="Stop showing only facilities with no location"
              className={cn("grid h-7 w-7 place-items-center rounded-full hover:bg-white/15 dark:hover:bg-black/10", focusRing)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-panel-scroll="">
        {/* Summary */}
        <div className="border-b border-[#E5E7EB] px-4 pb-3.5 dark:border-[#26364A]">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-2 w-full" />
            </div>
          ) : loadError ? (
            <DataLoadError onRetry={onRetry} retrying={retrying} />
          ) : layer === "facilities" ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">
                  {active ? (
                    <>
                      <span className="text-[22px] font-semibold tabular-nums">{formatCount(filtered.length)}</span>{" "}
                      <span className={mutedText}>
                        of {formatCount(all.length)} facilities match · {formatCount(onMap)} on the map
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[22px] font-semibold tabular-nums">{formatCount(all.length)}</span>{" "}
                      <span className={mutedText}>facilities · {formatCount(onMap)} on the map</span>
                    </>
                  )}
                </p>
                {offlineCount > 0 ? (
                  <button
                    type="button"
                    data-testid="asset-map-status-filter"
                    aria-pressed={filters.offlineOnly}
                    onClick={onToggleOffline}
                    title={filters.offlineOnly ? "Show all facilities" : "Show offline facilities only"}
                    className={cn(
                      "inline-flex h-7 items-center rounded-full border border-dashed border-[#8A8F98] px-2.5 text-xs font-medium tabular-nums dark:border-[#64768E]",
                      "aria-pressed:border-solid aria-pressed:border-[#0B2545] aria-pressed:bg-[#0B2545] aria-pressed:text-white dark:aria-pressed:border-[#E6EAF0] dark:aria-pressed:bg-[#E6EAF0] dark:aria-pressed:text-[#0F1724]",
                      focusRing
                    )}
                  >
                    {offlineCount} offline
                  </button>
                ) : null}
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#E9ECF0] dark:bg-[#24344A]" aria-hidden="true">
                {READINESS_TIERS.map((t) =>
                  tierCounts[t] > 0 && totalForBar > 0 ? (
                    <span
                      key={t}
                      style={{ width: `${(tierCounts[t] / totalForBar) * 100}%`, background: tierColours[t] }}
                      className="h-full border-r-2 border-white last:border-r-0 dark:border-[#162130]"
                    />
                  ) : null
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">
                <span className="text-[22px] font-semibold tabular-nums">{formatCount(assetTotals.total)}</span>{" "}
                <span className={mutedText}>
                  assets across {formatCount(assetTotals.facilities)}{" "}
                  {assetTotals.facilities === 1 ? "facility" : "facilities"}
                </span>
              </p>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#E9ECF0] dark:bg-[#24344A]" aria-hidden="true">
                {(["inUse", "maintenance", "retired"] as const).map((k) =>
                  assetTotals[k] > 0 ? (
                    <span
                      key={k}
                      style={{ width: `${(assetTotals[k] / Math.max(1, assetTotals.total)) * 100}%`, background: statusColours[k] }}
                      className="h-full border-r-2 border-white last:border-r-0 dark:border-[#162130]"
                    />
                  ) : null
                )}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                {(
                  [
                    ["inUse", "In use"],
                    ["maintenance", "In maintenance"],
                    ["retired", "Retired"],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k}>
                    <dt className={cn("flex items-center gap-1.5", mutedText)}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: statusColours[k] }} />
                      {label}
                    </dt>
                    <dd className="text-[15px] font-semibold tabular-nums">{formatCount(assetTotals[k])}</dd>
                  </div>
                ))}
              </dl>
              {statsLimited ? (
                <p className={cn("mt-2 text-xs", mutedText)}>You can see asset figures for your own facility only.</p>
              ) : null}
            </>
          )}
        </div>

        {/* Readiness tiles (legend and filter) */}
        <div className="px-4 pt-3.5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">Stock readiness</h2>
            {active ? (
              <button
                type="button"
                onClick={onClearFilters}
                className={cn("text-[13px] font-medium hover:underline", linkText, focusRing)}
              >
                Clear filters
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Filter by stock readiness" data-testid="asset-map-stock-filter">
            {READINESS_TIERS.map((t) => {
              const pressed = filters.tiers.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => onToggleTier(t)}
                  data-tier={t}
                  className={cn(
                    "min-h-[58px] rounded-[10px] border p-2 text-left transition-colors",
                    "border-[#E5E7EB] hover:bg-[#F3F4F6] dark:border-[#26364A] dark:hover:bg-[#1E2B3C]",
                    "aria-pressed:border-2 aria-pressed:border-[#0B2545] aria-pressed:bg-[#EEF2F8] dark:aria-pressed:border-[#E6EAF0] dark:aria-pressed:bg-[#1E2B3C]",
                    focusRing
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: tierColours[t] }} />
                    <span className="text-[15px] font-semibold tabular-nums">{loading || loadError ? "" : tierCounts[t]}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] font-medium leading-tight">{READINESS_LABELS[t]}</span>
                  <span className={cn("block text-[11px] leading-tight", mutedText)}>{READINESS_THRESHOLDS[t]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {variant === "sheet" ? <div className="pt-1">{searchBlock}</div> : null}

        {/* Type chips (shape legend and filter) */}
        {showTypeChips || filtersOpen ? (
          <div className="border-b border-[#E5E7EB] px-4 pb-3.5 pt-3.5 dark:border-[#26364A]">
            <h2 className="mb-2 text-[13px] font-semibold">Type</h2>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type" data-testid="asset-map-facility-type">
              {TYPE_ORDER.map((t) => {
                const pressed = filters.types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => onToggleType(t)}
                    data-type={t}
                    className={cn(chipBase, "group")}
                  >
                    <TypeGlyph type={t} scheme={scheme} neutral={pressed ? "chipOn" : "chip"} size={14} />
                    {TYPE_CHIP_LABELS[t]}
                    {loading || loadError ? null : <span className={chipCountText}>{typeCounts[t] ?? 0}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="border-b border-[#E5E7EB] pb-3.5 dark:border-[#26364A]" />
        )}

        {/* List */}
        <div className="px-4 pt-3">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">Facilities</h2>
            <label className="relative inline-flex items-center">
              <span className="sr-only">Sort facilities</span>
              <select
                value={sort}
                onChange={(e) => onSort(e.target.value as ListSort)}
                className={cn(
                  "appearance-none bg-transparent pr-5 text-right text-[13px] font-medium text-[#374151] dark:text-[#C9D3E0]",
                  focusRing
                )}
              >
                {(Object.keys(SORT_LABELS) as ListSort[]).map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABELS[s]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 h-3.5 w-3.5" />
            </label>
          </div>
        </div>
        <FacilityList
          rows={filtered}
          layer={layer}
          scheme={scheme}
          loading={loading}
          selectedId={selectedId}
          onSelect={onSelect}
        />
        {!loading && !loadError && filtered.length === 0 ? (
          <div className="px-6 pb-6 pt-4 text-center">
            <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-[10px] bg-[#F3F4F6] dark:bg-[#1E2B3C]">
              <SearchX className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold">No facilities match</p>
            <p className={cn("mt-1 text-[13px]", mutedText)}>{emptyContext(filters)}</p>
          </div>
        ) : null}
      </div>

      {/* Legend (the type chips double as the legend in the mobile sheet) */}
      {variant === "panel" ? (
      <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 dark:border-[#26364A] dark:bg-[#132030]">
        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          className={cn("flex w-full items-center justify-between text-[13px] font-semibold", focusRing)}
        >
          Legend
          <ChevronDown className={cn("h-4 w-4 transition-transform", legendOpen ? "" : "-rotate-90")} />
        </button>
        {legendOpen ? (
          layer === "facilities" ? (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
              {TYPE_ORDER.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <TypeGlyph type={t} scheme={scheme} neutral="chip" size={13} />
                  {TYPE_LABELS[t]}
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <OfflineGlyph scheme={scheme} />
                Offline
              </li>
            </ul>
          ) : (
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="flex items-end gap-1" aria-hidden="true">
                  {[3, 30, 150].map((n) => {
                    const r = bubbleRadius(n) * 0.7;
                    return (
                      <svg key={n} width={2 * r + 4} height={2 * r + 4} viewBox={`${-r - 2} ${-r - 2} ${2 * r + 4} ${2 * r + 4}`}>
                        <circle r={r} fill="none" stroke={statusColours.inUse} strokeWidth={2} />
                      </svg>
                    );
                  })}
                </span>
                Size shows how many assets
              </div>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {(
                  [
                    ["inUse", "In use"],
                    ["maintenance", "In maintenance"],
                    ["retired", "Retired"],
                  ] as const
                ).map(([k, label]) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: statusColours[k] }} />
                    {label}
                  </li>
                ))}
                <li className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">
                    <circle r={4.5} fill="none" stroke={tierColours.offline} strokeWidth={1.5} strokeDasharray="2 1.6" />
                  </svg>
                  Offline
                </li>
              </ul>
            </div>
          )
        ) : null}
      </div>
      ) : null}
    </section>
  );
}

function FacilityList({
  rows,
  layer,
  scheme,
  loading,
  selectedId,
  onSelect,
}: {
  rows: MapFacility[];
  layer: MapLayer;
  scheme: MapScheme;
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number, opener: HTMLElement | null) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [activeIndexRaw, setActiveIndex] = useState(0);
  const selectedIndex = selectedId != null ? rows.findIndex((r) => r.id === selectedId) : -1;
  const [lastSelected, setLastSelected] = useState<number | null>(null);
  if (selectedId !== lastSelected) {
    // Adjust state while rendering (not in an effect) when the selection changes.
    setLastSelected(selectedId);
    if (selectedIndex >= 0) setActiveIndex(selectedIndex);
  }
  const activeIndex = activeIndexRaw < rows.length ? activeIndexRaw : 0;
  const statusColours = ASSET_STATUS_COLOURS[scheme];

  useEffect(() => {
    if (selectedId == null || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-facility-id="${selectedId}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId, rows]);

  if (loading) {
    return (
      <div className="space-y-2 px-4 pb-4 pt-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    let next = activeIndex;
    if (e.key === "ArrowDown") next = Math.min(rows.length - 1, activeIndex + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, activeIndex - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = rows.length - 1;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const row = rows[activeIndex];
      if (row) {
        const el = listRef.current?.querySelector<HTMLElement>(`[data-facility-id="${row.id}"]`) ?? null;
        onSelect(row.id, el);
      }
      return;
    } else return;
    e.preventDefault();
    setActiveIndex(next);
    listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus();
  };

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Facilities"
      data-testid="asset-map-list"
      onKeyDown={onKeyDown}
      className="pb-2"
    >
      {rows.map((f, i) => {
        const tier = pinTier(f);
        const selected = f.id === selectedId;
        const located = hasLocation(f);
        const meta = [TYPE_LABELS[f.facilityType], f.state, f.code].filter(Boolean).join(" · ");
        return (
          <li
            key={f.id}
            role="option"
            aria-selected={selected}
            tabIndex={i === activeIndex ? 0 : -1}
            data-index={i}
            data-facility-id={f.id}
            data-testid={`asset-map-row-${f.code ?? f.id}`}
            onClick={(e) => {
              setActiveIndex(i);
              onSelect(f.id, e.currentTarget);
            }}
            className={cn(
              "relative flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-[#F3F4F6] dark:hover:bg-[#1E2B3C]",
              selected && "bg-[#F3F4F6] shadow-[inset_3px_0_0_#0B2545] dark:bg-[#1E2B3C] dark:shadow-[inset_3px_0_0_#E6EAF0]",
              "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#C8102E] dark:focus-visible:outline-white"
            )}
          >
            <span className="grid w-5 place-items-center">
              <TypeGlyph type={f.facilityType} scheme={scheme} tier={tier} size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{f.name}</span>
              <span className={cn("block truncate text-xs", "text-[#62626C] dark:text-[#A3AEBD]")}>{meta}</span>
            </span>
            {layer === "assets" ? (
              f.statsVisible && f.assetCount != null ? (
                <span className="w-16 shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums">{formatCount(f.assetCount)}</span>
                  {f.assetsByStatus && f.assetCount > 0 ? (
                    <span className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-[#E9ECF0] dark:bg-[#24344A]" aria-hidden="true">
                      {(["inUse", "maintenance", "retired"] as const).map((k) => (
                        <span key={k} style={{ width: `${(f.assetsByStatus![k] / f.assetCount!) * 100}%`, background: statusColours[k] }} />
                      ))}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-[#62626C] dark:text-[#A3AEBD]">Not shown</span>
              )
            ) : !located ? (
              <ReadinessPill tier="offline" scheme={scheme} dashed>
                No location
              </ReadinessPill>
            ) : tier === "offline" ? (
              <ReadinessPill tier="offline" scheme={scheme} dashed>
                Offline
              </ReadinessPill>
            ) : tier === "none" ? (
              <ReadinessPill tier="none" scheme={scheme}>
                No data
              </ReadinessPill>
            ) : (
              <ReadinessPill tier={tier} scheme={scheme}>
                {f.stockScorePercent}%
              </ReadinessPill>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Shown when the facility data request fails. Distinct from the empty state ("No facilities
 * match"): it says the data didn't load and offers Retry, which refetches.
 */
/**
 * Desktop, narrow map with the drawer open: the panel collapses to this card (search, counts and an
 * expand chevron) so the map between it and the drawer stays usable.
 */
export function CompactFacilityCard({
  ref,
  searchText,
  onSearchText,
  onSearchEnter,
  count,
  onMap,
  onExpand,
  className,
  style,
}: {
  ref?: React.Ref<HTMLElement>;
  searchText: string;
  onSearchText: (q: string) => void;
  onSearchEnter: () => void;
  /** Facilities matching the current search and filters. */
  count: number;
  /** Of those, how many have a location on the map. */
  onMap: number;
  onExpand: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      ref={ref}
      aria-label="Facilities"
      data-testid="asset-map-compact-panel"
      className={cn("p-2.5", className)}
      style={style}
    >
      <div className="flex items-center gap-1.5">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search facilities or codes</span>
          <Search className={cn("pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2", mutedText)} />
          <input
            type="search"
            value={searchText}
            onChange={(e) => onSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearchEnter();
              }
            }}
            placeholder="Search facilities"
            data-testid="asset-map-compact-search"
            className={cn(
              "h-10 w-full rounded-[10px] border border-[#8A8F98] bg-white pl-8 pr-2 text-sm text-[#111827] placeholder:text-[#62626C] dark:border-[#64768E] dark:bg-[#0F1724] dark:text-[#E6EAF0] dark:placeholder:text-[#A3AEBD]",
              "focus-visible:border-[#C8102E] focus-visible:ring-2 focus-visible:ring-[#C8102E]/30 focus-visible:outline-none"
            )}
          />
        </label>
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={false}
          aria-label="Show filters and the facility list"
          title="Show filters and the facility list"
          data-testid="asset-map-panel-expand"
          className={cn(
            "grid h-10 w-9 shrink-0 place-items-center rounded-[10px] hover:bg-[#F3F4F6] dark:hover:bg-[#1E2B3C]",
            focusRing
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 px-1 text-[13px]" data-testid="asset-map-compact-counts">
        <span className="font-semibold tabular-nums">{formatCount(count)}</span>{" "}
        <span className={mutedText}>
          {count === 1 ? "facility" : "facilities"} · <span className="tabular-nums">{formatCount(onMap)}</span> on the map
        </span>
      </p>
    </section>
  );
}

export function DataLoadError({
  onRetry,
  retrying = false,
  className,
}: {
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div role="alert" data-testid="asset-map-data-error" className={cn("flex gap-3", className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C] dark:text-[#F87171]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">Facility data didn&apos;t load</p>
        <p className={cn("mt-1 text-[13px]", mutedText)}>Check your connection and try again.</p>
        {onRetry ? (
          <button
            type="button"
            data-testid="asset-map-data-retry"
            onClick={onRetry}
            disabled={retrying}
            aria-busy={retrying || undefined}
            className={cn(
              "mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#0B2545] bg-white px-3 text-[13px] font-semibold text-[#0B2545] transition-colors hover:bg-[#EEF2F8] disabled:cursor-progress",
              "dark:border-[#E6EAF0] dark:bg-[#162130] dark:text-[#E6EAF0] dark:hover:bg-[#1E2B3C]",
              focusRing
            )}
          >
            <RotateCw className={cn("h-3.5 w-3.5", retrying && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
            {retrying ? "Retrying" : "Retry"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
