import { Button } from "@/components/ui/button";
import { Trash2, Download, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  children?: React.ReactNode;
}

export function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onDelete,
  onExport,
  children,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground shadow-lg rounded-lg px-6 py-4 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
      <Badge variant="secondary" className="text-lg px-3 py-1">
        {selectedCount} selected
      </Badge>
      
      <div className="flex items-center gap-2">
        {children}
        
        {onExport && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onExport}
            className="gap-2"
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
            className="gap-2"
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
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
