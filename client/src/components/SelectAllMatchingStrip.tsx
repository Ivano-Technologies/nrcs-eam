import { formatCount } from "@/lib/formatCount";

interface SelectAllMatchingStripProps {
  /** Rows on the current page. */
  pageCount: number;
  /** Rows matching the current filters across all pages. */
  matchingCount: number;
  /** Whether every row on the page is ticked. */
  pageFullySelected: boolean;
  /** Whether the selection has been widened to every matching row. */
  allMatchingSelected: boolean;
  onSelectAllMatching: () => void;
  onClearSelection: () => void;
  /** Disable the select-all link, for example while matching ids load. */
  busy?: boolean;
}

/**
 * Slim strip above a table or card grid. Appears once the whole page is ticked and more rows match:
 * "All 50 on this page are selected. Select all 1,234 matching", then "All 1,234 selected. Clear selection".
 */
export function SelectAllMatchingStrip({
  pageCount,
  matchingCount,
  pageFullySelected,
  allMatchingSelected,
  onSelectAllMatching,
  onClearSelection,
  busy = false,
}: SelectAllMatchingStripProps) {
  if (!allMatchingSelected && (!pageFullySelected || matchingCount <= pageCount)) return null;
  const link = "font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none disabled:opacity-50";
  return (
    <div
      role="status"
      data-testid="select-all-matching-strip"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md border bg-muted/50 px-3 py-2 text-center text-sm"
    >
      {allMatchingSelected ? (
        <>
          <span>All {formatCount(matchingCount)} selected.</span>{" "}
          <button type="button" className={link} onClick={onClearSelection} data-testid="select-all-matching-clear">
            Clear selection
          </button>
        </>
      ) : (
        <>
          <span>All {formatCount(pageCount)} on this page are selected.</span>{" "}
          <button type="button" className={link} onClick={onSelectAllMatching} disabled={busy} data-testid="select-all-matching">
            Select all {formatCount(matchingCount)} matching
          </button>
        </>
      )}
    </div>
  );
}
