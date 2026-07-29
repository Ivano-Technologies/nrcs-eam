import { useState } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * On mobile, hide secondary columns until the user opts into "View all columns".
 * Desktop always shows every column. Sticky first column is handled via CSS
 * (`.frozen-table-wrap.sticky-first-col`).
 */
export function useMobileTableColumns() {
  const isMobile = useIsMobile();
  const [showAll, setShowAll] = useState(false);
  return {
    isMobile,
    /** True when every column should render (desktop, or mobile after toggle). */
    showAllColumns: !isMobile || showAll,
    showAll,
    setShowAll,
  };
}

/** Class for columns that are secondary on mobile when collapsed. */
export function mobileSecondaryCol(showAllColumns: boolean): string {
  return showAllColumns ? "" : "hidden";
}

type MobileColumnsToggleProps = {
  isMobile: boolean;
  showAll: boolean;
  onToggle: (next: boolean) => void;
  className?: string;
};

export function MobileColumnsToggle({
  isMobile,
  showAll,
  onToggle,
  className,
}: MobileColumnsToggleProps) {
  if (!isMobile) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("touch-manipulation", className)}
      data-testid="mobile-view-all-columns"
      onClick={() => onToggle(!showAll)}
    >
      {showAll ? "Fewer columns" : "View all columns"}
    </Button>
  );
}
