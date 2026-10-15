/**
 * Sidebar brand row and the edge toggle tab.
 *
 * The brand row is a fixed h-14 (matches the top bar). The logo is unchanged (40px). With the
 * chevron moved out of the row, the text column is 256 − 16 (header padding) − 40 (logo) − 8 (gap)
 * = 192px, so "Nigerian Red Cross Society" (13px/600) and "Enterprise Asset Management" (12px/400)
 * each fit on one line in every common UI font, Montserrat included (180 and 183px measured).
 * `truncate` turns an overflow (bare Linux with DejaVu) into an ellipsis instead of a third line.
 */
import { ChevronsLeft } from "lucide-react";
import { Link } from "wouter";
import { appPath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LOGO_SRC = "/nrcs-logo-source.png";
const ORG_NAME = "Nigerian Red Cross Society";

export function SidebarBrand({ rail }: { rail: boolean }) {
  if (rail) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={appPath("/")}
            aria-label="Go to dashboard"
            className="flex w-full justify-center rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img src={LOGO_SRC} alt={ORG_NAME} className="h-10 w-10 shrink-0 object-contain mx-auto" data-testid="sidebar-logo-collapsed" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">Go to dashboard</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Link
      href={appPath("/")}
      aria-label={`${ORG_NAME}, Enterprise Asset Management. Go to dashboard`}
      data-testid="sidebar-brand"
      className="flex min-w-0 w-full items-center gap-2 rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img src={LOGO_SRC} alt="" className="h-10 w-10 shrink-0" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className="truncate text-[13px] font-semibold leading-4 tracking-[-0.01em] text-sidebar-foreground"
          data-testid="sidebar-org-name"
        >
          {ORG_NAME}
        </span>
        <span
          className="truncate text-[12px] leading-4 tracking-[-0.01em] text-sidebar-foreground/75"
          data-testid="sidebar-org-subtitle"
        >
          Enterprise Asset Management
        </span>
      </span>
    </Link>
  );
}

/** Round tab on the sidebar's right edge that folds and unfolds it (also Ctrl+B or Cmd+B). */
export function SidebarEdgeToggle({
  rail,
  onToggle,
  feedback = false,
  className,
}: {
  rail: boolean;
  onToggle: () => void;
  feedback?: boolean;
  className?: string;
}) {
  const label = rail ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!rail}
      title={label}
      data-testid="sidebar-edge-toggle"
      className={cn(
        "absolute -right-3 top-4 z-50 hidden h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex",
        feedback && "border-primary bg-primary/20",
        className
      )}
    >
      <ChevronsLeft
        aria-hidden
        className={cn("h-3.5 w-3.5 transition-transform duration-200 ease-in-out motion-reduce:transition-none", rail ? "rotate-180" : "rotate-0")}
      />
    </button>
  );
}
