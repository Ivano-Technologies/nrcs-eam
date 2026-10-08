import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, Layers, LocateFixed, Maximize, Minimize, Minus, Plus, Waypoints, SearchX } from "lucide-react";
import type { MapLayer } from "@/lib/assetMap/model";
import type { MapStyle } from "@/lib/assetMap/controller";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { focusRing, mutedText, surfaceClass, linkText } from "./parts";

/* Layer bar --------------------------------------------------------------- */

export function LayerBar({
  layer,
  onLayer,
  lines,
  onLines,
  compact = false,
  className,
}: {
  layer: MapLayer;
  onLayer: (layer: MapLayer) => void;
  lines: boolean;
  onLines: (on: boolean) => void;
  /** Mobile: Network lines becomes a 44px icon toggle. */
  compact?: boolean;
  className?: string;
}) {
  const tabs: { id: MapLayer; label: string; testId: string }[] = [
    { id: "facilities", label: "Facilities", testId: "asset-map-network-tab" },
    { id: "assets", label: "Assets", testId: "asset-map-assets-tab" },
  ];
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: MapLayer = layer === "facilities" ? "assets" : "facilities";
    onLayer(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="toolbar" aria-label="Map layers" className={cn(surfaceClass, "flex items-center gap-1 p-1", className)}>
      <div role="tablist" aria-label="Layer" className="flex flex-1 gap-1" onKeyDown={onKey}>
        {tabs.map((t) => {
          const on = layer === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              data-testid={t.testId}
              onClick={() => onLayer(t.id)}
              className={cn(
                "h-9 flex-1 rounded-[10px] px-3.5 text-[13.5px] font-semibold transition-colors",
                compact && "h-11",
                on
                  ? "bg-[#0B2545] text-white dark:bg-[#E6EAF0] dark:text-[#0F1724]"
                  : "text-[#374151] hover:bg-[#F3F4F6] dark:text-[#C9D3E0] dark:hover:bg-[#1E2B3C]",
                focusRing
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <span className="mx-1 h-6 w-px bg-[#E5E7EB] dark:bg-[#26364A]" aria-hidden="true" />
      <button
        type="button"
        role="switch"
        aria-checked={lines}
        aria-label={compact ? "Network lines" : undefined}
        data-testid="asset-map-lines-toggle"
        onClick={() => onLines(!lines)}
        className={cn(
          "flex items-center gap-2 rounded-[10px] px-2.5 text-[13.5px] font-medium hover:bg-[#F3F4F6] dark:hover:bg-[#1E2B3C]",
          compact ? "h-11 w-11 justify-center px-0" : "h-9",
          compact && lines && "bg-[#0B2545] text-white dark:bg-[#E6EAF0] dark:text-[#0F1724]",
          focusRing
        )}
      >
        {compact ? (
          <Waypoints className="h-4 w-4" />
        ) : (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                lines ? "bg-[#0B2545] dark:bg-[#E6EAF0]" : "bg-[#C9CED6] dark:bg-[#3A4B62]"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform dark:bg-[#0F1724]",
                  lines ? "translate-x-[18px]" : "translate-x-0.5",
                  !lines && "dark:bg-[#E6EAF0]"
                )}
              />
            </span>
            Network lines
          </>
        )}
      </button>
    </div>
  );
}

/* Notice chip ------------------------------------------------------------- */

export function NoLocationChip({
  count,
  active,
  onShow,
  className,
}: {
  count: number;
  active: boolean;
  onShow: () => void;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <div
      data-testid="asset-map-no-location"
      data-count={count}
      className={cn(surfaceClass, "flex h-10 items-center gap-2 rounded-full pl-3 pr-1 text-[13px]", className)}
    >
      <AlertTriangle className="h-4 w-4 text-[#D97706] dark:text-[#F59E0B]" aria-hidden="true" />
      <span>
        <span className="font-semibold tabular-nums">{count}</span>{" "}
        {count === 1 ? "facility has no location" : "facilities have no location"}
      </span>
      <button
        type="button"
        onClick={onShow}
        aria-pressed={active}
        className={cn("h-8 rounded-full px-3 font-semibold hover:bg-[#EEF2FF] dark:hover:bg-[#1E2B3C]", linkText, focusRing)}
      >
        {active ? "Hide" : "Show"}
      </button>
    </div>
  );
}

/* Map controls ------------------------------------------------------------ */

function ControlButton({
  label,
  onClick,
  touch,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  touch: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid place-items-center text-[#374151] hover:bg-[#F3F4F6] dark:text-[#C9D3E0] dark:hover:bg-[#1E2B3C]",
        touch ? "h-11 w-11" : "h-10 w-10",
        focusRing,
        className
      )}
    >
      {children}
    </button>
  );
}

export function MapControls({
  ref,
  touch,
  onZoomIn,
  onZoomOut,
  onFit,
  style,
  onStyle,
  fullscreenTarget,
  className,
  positionStyle,
}: {
  /** The control column; the page measures it to keep the phone empty card clear of it. */
  ref?: React.Ref<HTMLDivElement>;
  touch: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  style: MapStyle;
  onStyle: (style: MapStyle) => void;
  fullscreenTarget: React.RefObject<HTMLElement | null>;
  className?: string;
  positionStyle?: React.CSSProperties;
}) {
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const canFullscreen = typeof document !== "undefined" && Boolean(document.fullscreenEnabled);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void fullscreenTarget.current?.requestFullscreen?.();
  };
  const group = cn(surfaceClass, "flex flex-col overflow-hidden rounded-[12px] divide-y divide-[#E5E7EB] dark:divide-[#26364A]");
  return (
    <div ref={ref} className={cn("flex flex-col items-end gap-2", className)} style={positionStyle} role="group" aria-label="Map controls">
      {!touch ? (
        <div className={group}>
          <ControlButton label="Zoom in" onClick={onZoomIn} touch={touch}>
            <Plus className="h-4 w-4" />
          </ControlButton>
          <ControlButton label="Zoom out" onClick={onZoomOut} touch={touch}>
            <Minus className="h-4 w-4" />
          </ControlButton>
        </div>
      ) : null}
      <div className={group}>
        <ControlButton label="Fit all facilities" onClick={onFit} touch={touch}>
          <LocateFixed className="h-4 w-4" />
        </ControlButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Map style"
              title="Map style"
              data-testid="asset-map-style-menu"
              className={cn(
                "grid place-items-center text-[#374151] hover:bg-[#F3F4F6] dark:text-[#C9D3E0] dark:hover:bg-[#1E2B3C]",
                touch ? "h-11 w-11" : "h-10 w-10",
                focusRing
              )}
            >
              <Layers className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="left" align="end" className="w-48">
            <DropdownMenuLabel>Map style</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={style} onValueChange={(v) => onStyle(v as MapStyle)}>
              <DropdownMenuRadioItem value="default">Default</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="satellite">
                Satellite
                <span className={cn("ml-auto pl-3 text-xs", mutedText)}>Slower</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {canFullscreen ? (
          <ControlButton label={isFull ? "Exit full screen" : "Full screen"} onClick={toggleFull} touch={touch}>
            {isFull ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </ControlButton>
        ) : null}
      </div>
    </div>
  );
}

/* Empty and error cards --------------------------------------------------- */

export function EmptyMapCard({ summary, onClear, className }: { summary: string; onClear: () => void; className?: string }) {
  return (
    <div
      role="status"
      data-testid="asset-map-empty"
      className={cn(surfaceClass, "pointer-events-auto w-[320px] max-w-[calc(100%-32px)] p-5 text-center", className)}
    >
      <SearchX className={cn("mx-auto h-6 w-6", mutedText)} aria-hidden="true" />
      <p className="mt-2 text-[15px] font-semibold">No facilities match these filters</p>
      {summary ? <p className={cn("mt-1 text-[13px]", mutedText)}>{summary}</p> : null}
      <button
        type="button"
        onClick={onClear}
        className={cn(
          "mt-4 h-10 rounded-[10px] bg-[#0B2545] px-4 text-sm font-semibold text-white hover:bg-[#13315C] dark:bg-[#E6EAF0] dark:text-[#0F1724] dark:hover:bg-white",
          focusRing
        )}
      >
        Clear filters
      </button>
    </div>
  );
}

export function MapErrorCard({
  message,
  className,
  listBelow = true,
}: {
  message: string;
  className?: string;
  /** False when the facility data also failed, so the card doesn't promise a list. */
  listBelow?: boolean;
}) {
  return (
    <div role="alert" data-testid="asset-map-error" className={cn(surfaceClass, "flex max-w-[420px] gap-3 p-4 text-[13px]", className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C] dark:text-[#F87171]" aria-hidden="true" />
      <div>
        <p className="font-semibold">
          {listBelow ? "The map couldn't load. Facilities are listed below." : "The map couldn't load."}
        </p>
        {message ? <p className={cn("mt-1", mutedText)}>{message}</p> : null}
      </div>
    </div>
  );
}

/** Tile shimmer: shown between a view change and the next tilesloaded (or 8s). */
export function TileShimmer({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-testid="asset-map-shimmer"
      data-active={active ? "true" : "false"}
      className={cn(
        "nrcs-map-shimmer pointer-events-none absolute inset-0 z-[1] transition-opacity duration-200",
        active ? "opacity-100" : "opacity-0"
      )}
    />
  );
}

