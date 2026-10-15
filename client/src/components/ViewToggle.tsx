import { LayoutGrid, List, MapPin } from "lucide-react";
import type { ComponentType } from "react";

export type ViewMode = "table" | "card";
export type ViewModeWithMap = ViewMode | "map";

interface ViewToggleProps<M extends ViewModeWithMap> {
  value: M;
  onChange: (mode: M) => void;
  /** Adds a third "Map" segment (Facilities). The selected segment always matches `value`. */
  showMap?: boolean;
}

const SEGMENTS: {
  mode: ViewModeWithMap;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { mode: "table", label: "Table", Icon: List },
  { mode: "card", label: "Card", Icon: LayoutGrid },
  { mode: "map", label: "Map", Icon: MapPin },
];

export function ViewToggle<M extends ViewModeWithMap = ViewMode>({
  value,
  onChange,
  showMap = false,
  compactBelowXl = false,
}: ViewToggleProps<M> & { compactBelowXl?: boolean }) {
  const segments = showMap ? SEGMENTS : SEGMENTS.filter(s => s.mode !== "map");
  return (
    <div
      className="inline-flex items-center rounded-md border bg-background"
      role="group"
      aria-label="View"
    >
      {segments.map(({ mode, label, Icon }, i) => {
        const selected = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode as M)}
            aria-pressed={selected}
            data-state={selected ? "on" : "off"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${i === 0 ? "rounded-l-md" : ""} ${
              i === segments.length - 1 ? "rounded-r-md" : ""
            } ${selected ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            data-testid={`view-toggle-${mode}`}
            aria-label={compactBelowXl ? label : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {/* Icon only below xl when asked, so a dense toolbar stays on one row at 1280. */}
            <span className={compactBelowXl ? "sr-only xl:not-sr-only" : undefined}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
