/**
 * The one list toolbar (layout audit D2): filters on the left (controls h-9, search w-64, selects w-36),
 * then a right cluster with the count, the view toggle and a More menu. No card, no title.
 * The page's single primary button lives in the PageHeader actions, never here.
 */
import { MoreHorizontal, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ToolbarProps = {
  /** Search, selects and other filter controls. */
  filters?: ReactNode;
  /** Result count, e.g. "42 items". */
  count?: ReactNode;
  /** Right cluster after the count: view toggle, then More. */
  end?: ReactNode;
  /** "end" bottom-aligns controls when the filters carry visible labels (dates, report filters). */
  align?: "center" | "end";
  className?: string;
  "data-testid"?: string;
};

export function Toolbar({ filters, count, end, align = "center", className, "data-testid": testId = "toolbar" }: ToolbarProps) {
  const hasEnd = count != null || end != null;
  const items = align === "end" ? "items-end" : "items-center";
  return (
    <div data-testid={testId} className={cn("flex flex-wrap gap-2", items, className)}>
      {filters != null ? (
        <div data-testid="toolbar-filters" className={cn("flex min-w-0 flex-wrap gap-2", items)}>
          {filters}
        </div>
      ) : null}
      {hasEnd ? (
        <div data-testid="toolbar-end" className={cn("ml-auto flex flex-wrap gap-2", items)}>
          {count != null ? (
            <span className="whitespace-nowrap text-sm text-muted-foreground" data-testid="toolbar-count">
              {count}
            </span>
          ) : null}
          {end}
        </div>
      ) : null}
    </div>
  );
}

type ToolbarSearchProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  containerClassName?: string;
};

/** Search input with a leading icon: full width on phones, w-64 from sm. */
export function ToolbarSearch({ className, containerClassName, ...props }: ToolbarSearchProps) {
  return (
    <div className={cn("relative w-full sm:w-64", containerClassName)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input type="search" className={cn("h-9 pl-9", className)} {...props} />
    </div>
  );
}

/** The toolbar's More menu: secondary actions (export, template, import, admin tasks). */
export function ToolbarMore({
  children,
  label = "More actions",
  "data-testid": testId = "toolbar-more",
}: {
  children: ReactNode;
  label?: string;
  "data-testid"?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label={label} data-testid={testId}>
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
