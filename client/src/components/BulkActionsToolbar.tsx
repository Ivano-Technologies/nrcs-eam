import { Button } from "@/components/ui/button";
import { Trash2, Download, X } from "lucide-react";
import { formatCount } from "@/lib/formatCount";

interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  /** Disable the built-in action buttons (e.g. while a bulk mutation is running). */
  disabled?: boolean;
  /** Noun used in the accessible toolbar label, e.g. "assets". */
  itemLabel?: string;
  children?: React.ReactNode;
  /**
   * Keep the actions on one row below md (two-row rule at 390). Only set this when the
   * actions are known to fit at 390 (Assets); other bars still wrap rather than clip.
   */
  nowrapActions?: boolean;
}

/** Light buttons on the navy bar. Delete is the only red action. */
export const BULK_BAR_BUTTON_CLASS = "gap-2 border-0 bg-background text-foreground shadow-none hover:bg-muted";

/**
 * Shared bulk actions bar: sidebar navy, bottom centre, above the phone bottom nav.
 * At 390 it is at most two rows: count and an icon-only Clear on row 1, actions on row 2.
 * A spacer the height of the bar is rendered in flow so pagination and last rows can scroll into view.
 */
export function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onDelete,
  onExport,
  disabled = false,
  itemLabel = "items",
  children,
  nowrapActions = false,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <>
      <div aria-hidden className="h-36 md:h-24" data-testid="bulk-actions-spacer" />
      <div
        role="toolbar"
        aria-label={`Bulk actions for ${formatCount(selectedCount)} selected ${itemLabel}`}
        data-testid="bulk-actions-toolbar"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 z-50 flex w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-3 rounded-xl bg-sidebar px-4 py-3 text-sidebar-foreground shadow-lg animate-in slide-in-from-bottom-5 md:w-max md:max-w-[calc(100vw-2rem)] md:flex-row md:items-center md:gap-4 md:px-5"
      >
        <div className="flex items-center justify-between gap-3 md:contents">
          <span className="text-sm font-medium tabular-nums" data-testid="bulk-actions-count">
            {formatCount(selectedCount)} selected
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            aria-label="Clear selection"
            title="Clear selection"
            className="size-8 text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground md:order-last"
            data-testid="bulk-actions-clear"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div
          className={nowrapActions ? "flex flex-nowrap items-center gap-2 md:flex-wrap" : "flex flex-wrap items-center gap-2"}
          data-testid="bulk-actions-row"
        >
          {children}

          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={disabled}
              className={BULK_BAR_BUTTON_CLASS}
              data-testid="bulk-actions-export"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}

          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={disabled}
              className="gap-2"
              data-testid="bulk-actions-delete"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
