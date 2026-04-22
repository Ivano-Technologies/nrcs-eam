import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

type ModuleFiltersCardProps = {
  title?: string;
  /** Top row: search, dropdowns, and other filter controls */
  filterRow: ReactNode;
  /** Bottom row, left: view toggles, map, etc. */
  toolbarStart?: ReactNode;
  /** Bottom row, right: export, template, import, primary add */
  toolbarEnd?: ReactNode;
  className?: string;
};

/**
 * Shared layout for module list pages: titled "Filters" card, filter row, then optional toolbar row
 * (view controls on the left, import/export/add on the right) — used across Assets, Facilities, Finance, Inventory.
 */
export function ModuleFiltersCard({
  title = "Filters",
  filterRow,
  toolbarStart,
  toolbarEnd,
  className,
}: ModuleFiltersCardProps) {
  const hasToolbar = toolbarStart != null || toolbarEnd != null;
  const bothToolbars = toolbarStart != null && toolbarEnd != null;
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div data-testid="module-filters-filter-row" className="flex flex-wrap items-center gap-2">
          {filterRow}
        </div>
        {hasToolbar ? (
          <div
            data-testid="module-filters-toolbar-row"
            className={cn(
              "flex flex-col gap-3 border-t border-border pt-3",
              "md:flex-row md:items-center",
              bothToolbars && "md:justify-between",
              !bothToolbars && toolbarEnd != null && "md:justify-end",
              !bothToolbars && toolbarStart != null && toolbarEnd == null && "md:justify-start",
            )}
          >
            {toolbarStart != null ? (
              <div className="flex flex-wrap items-center gap-2">{toolbarStart}</div>
            ) : null}
            {toolbarEnd != null ? (
              <div className="flex flex-wrap items-center gap-2 md:ml-auto md:justify-end">{toolbarEnd}</div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type ModuleFilterSearchProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  containerClassName?: string;
};

/** Search input with leading icon, aligned with Assets register pattern */
export function ModuleFilterSearch({ className, containerClassName, ...props }: ModuleFilterSearchProps) {
  return (
    <div className={cn("relative min-w-[200px] flex-1 md:max-w-md", containerClassName)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input type="search" className={cn("h-9 pl-9", className)} {...props} />
    </div>
  );
}
