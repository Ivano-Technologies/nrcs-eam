import { LayoutGrid, List } from "lucide-react";

export type ViewMode = "table" | "card";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-md border bg-background">
      <button
        onClick={() => onChange("table")}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-l-md transition-colors ${
          value === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        }`}
        data-testid="view-toggle-table"
      >
        <List className="h-4 w-4" />
        Table
      </button>
      <button
        onClick={() => onChange("card")}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-r-md transition-colors ${
          value === "card" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        }`}
        data-testid="view-toggle-card"
      >
        <LayoutGrid className="h-4 w-4" />
        Card
      </button>
    </div>
  );
}
