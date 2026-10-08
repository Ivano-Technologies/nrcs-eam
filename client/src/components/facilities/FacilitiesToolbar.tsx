/**
 * One toolbar shared by the Facilities Table, Card and Map views: search, type, state and status
 * selects, the "N facilities · M on the map" count, the view toggle and a "More actions" menu.
 * Phones get a Filters button that opens the three selects in a bottom sheet.
 */
import { useState } from "react";
import { Download, ListFilter, MoreHorizontal, Search, Upload } from "lucide-react";
import { FACILITY_TYPE_LABELS, FACILITY_TYPE_VALUES, type FacilityType } from "@shared/facilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ViewToggle } from "@/components/ViewToggle";
import { cn } from "@/lib/utils";
import type { FacilityCounts, FacilityStatusFilter } from "@/lib/facilitiesList";

export type FacilitiesView = "table" | "card" | "map";

/** Plural labels for the type select (National HQ matches the sidebar). */
const TYPE_OPTION_LABEL: Record<FacilityType, string> = {
  national_headquarters: "National HQ",
  branch: "Branches",
  division: "Divisions",
  clinic: "Clinics",
  warehouse: "Warehouses",
};
const TYPE_ORDER: FacilityType[] = ["national_headquarters", "branch", "division", "clinic", "warehouse"];

export type FacilitiesToolbarProps = {
  search: string;
  onSearch: (q: string) => void;
  type: FacilityType | "all";
  onType: (type: FacilityType | "all") => void;
  state: string;
  states: string[];
  onState: (state: string) => void;
  status: FacilityStatusFilter;
  onStatus: (status: FacilityStatusFilter) => void;
  counts: Pick<FacilityCounts, "total" | "onMap">;
  view: FacilitiesView;
  onView: (view: FacilitiesView) => void;
  onExport: () => void;
  onTemplate: () => void;
  onImport: () => void;
  importBusy?: boolean;
  /** Phones: selects move into a Filters sheet. */
  compact?: boolean;
  className?: string;
};

function FilterSelects({
  type,
  onType,
  state,
  states,
  onState,
  status,
  onStatus,
  stacked,
}: Pick<FacilitiesToolbarProps, "type" | "onType" | "state" | "states" | "onState" | "status" | "onStatus"> & {
  stacked?: boolean;
}) {
  const trigger = (w: string) => cn("h-9", stacked ? "w-full" : w);
  return (
    <>
      <Select value={type} onValueChange={(v) => onType(v as FacilityType | "all")}>
        <SelectTrigger className={trigger("w-[112px]")} aria-label="Facility type" data-testid="facilities-type-select">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {TYPE_ORDER.filter((t) => FACILITY_TYPE_VALUES.includes(t)).map((t) => (
            <SelectItem key={t} value={t}>
              {TYPE_OPTION_LABEL[t] ?? FACILITY_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={state} onValueChange={onState}>
        <SelectTrigger className={trigger("w-[116px]")} aria-label="State" data-testid="facilities-state-select">
          <SelectValue placeholder="All states" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All states</SelectItem>
          {states.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(v) => onStatus(v as FacilityStatusFilter)}>
        <SelectTrigger className={trigger("w-[132px]")} aria-label="Status" data-testid="facilities-status-select">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

export function FacilitiesToolbar(p: FacilitiesToolbarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeFilters = (p.type !== "all" ? 1 : 0) + (p.state !== "all" ? 1 : 0) + (p.status !== "all" ? 1 : 0);
  const selects = {
    type: p.type,
    onType: p.onType,
    state: p.state,
    states: p.states,
    onState: p.onState,
    status: p.status,
    onStatus: p.onStatus,
  };

  const search = (
    <div className={cn("relative", p.compact ? "min-w-0 flex-1" : "w-[288px] shrink-0")}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={p.search}
        onChange={(e) => p.onSearch(e.target.value)}
        placeholder="Search name, code or address"
        aria-label="Search facilities"
        className={cn("pl-9", p.compact ? "h-11" : "h-9")}
        data-testid="facilities-search"
      />
    </div>
  );

  const count = (
    <p className="whitespace-nowrap text-[13px] text-muted-foreground tabular-nums" data-testid="facilities-count" aria-live="polite">
      <span className="font-semibold text-foreground">{p.counts.total}</span> {p.counts.total === 1 ? "facility" : "facilities"} ·{" "}
      {p.counts.onMap} on the map
    </p>
  );

  const more = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="More actions: Export to Excel, Template, Import"
          data-testid="facilities-more"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={p.onExport} data-testid="facilities-export">
          <Download className="mr-2 h-4 w-4" aria-hidden />
          Export to Excel
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={p.onTemplate} data-testid="facilities-template">
          <Download className="mr-2 h-4 w-4" aria-hidden />
          Template
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={p.onImport} disabled={p.importBusy} data-testid="facilities-import">
          <Upload className="mr-2 h-4 w-4" aria-hidden />
          Import
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (p.compact) {
    return (
      <div className={cn("space-y-2", p.className)} data-testid="facilities-toolbar">
        <div className="flex items-center gap-2">
          {search}
          <Button
            variant="outline"
            className="h-9 shrink-0 gap-1.5 px-3"
            onClick={() => setSheetOpen(true)}
            aria-label={activeFilters ? `Filters, ${activeFilters} on` : "Filters"}
            data-testid="facilities-filters-button"
          >
            <ListFilter className="h-4 w-4" aria-hidden />
            Filters
            {activeFilters ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                {activeFilters}
              </span>
            ) : null}
          </Button>
          {more}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <ViewToggle value={p.view} onChange={p.onView} showMap />
          {count}
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="gap-0 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]" data-testid="facilities-filters-sheet">
            <SheetHeader className="pb-2">
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Narrow the list and the map by type, state and status.</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4">
              <FilterSelects {...selects} stacked />
              {count}
              <Button className="h-10" onClick={() => setSheetOpen(false)}>
                Show results
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", p.className)} data-testid="facilities-toolbar">
      {search}
      <FilterSelects {...selects} />
      <div className="ml-auto flex items-center gap-2">
        {count}
        <ViewToggle value={p.view} onChange={p.onView} showMap />
        {more}
      </div>
    </div>
  );
}
