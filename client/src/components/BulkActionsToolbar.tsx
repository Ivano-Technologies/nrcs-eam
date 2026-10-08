import { Button } from "@/components/ui/button";
import { Trash2, Download, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
}

export function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onDelete,
  onExport,
  disabled = false,
  itemLabel = "items",
  children,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={`Bulk actions for ${selectedCount} selected ${itemLabel}`}
      data-testid="bulk-actions-toolbar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground shadow-lg rounded-lg px-6 py-4 flex flex-wrap items-center justify-center gap-4 z-50 max-w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-5"
    >
      <Badge variant="secondary" className="text-lg px-3 py-1" data-testid="bulk-actions-count">
        {selectedCount} selected
      </Badge>
      
      <div className="flex flex-wrap items-center gap-2">
        {children}
        
        {onExport && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onExport}
            disabled={disabled}
            className="gap-2"
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
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="gap-2"
          data-testid="bulk-actions-clear"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
