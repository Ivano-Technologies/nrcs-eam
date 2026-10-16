import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import type { FacilityType } from "@shared/facilities";
import { MAP_TOKENS } from "@/lib/assetMap/tokens";
import { READINESS_LABELS, READINESS_PILLS, type MapScheme, type PinTier } from "@/lib/facilityMapHelpers";
import { glyphPrimitives, GLYPH_SIZE, type GlyphColours } from "@/lib/assetMap/glyphs";
import { glyphColours } from "@/lib/assetMap/pinContent";
import { cn } from "@/lib/utils";

/** Floating surface (panel, drawer, layer bar, controls). */
export const surfaceClass =
  "rounded-xl border border-border bg-white text-foreground-strong shadow-[0_1px_2px_rgba(15,23,42,.06),0_8px_24px_rgba(15,23,42,.10)] dark:border-border dark:bg-surface dark:text-foreground-strong dark:shadow-[0_1px_2px_rgba(0,0,0,.30),0_8px_24px_rgba(0,0,0,.35)]";

/**
 * Clearance for the app's mobile bottom nav: DashboardLayout reserves `pb-20` (80px) for
 * MobileBottomNav (`h-16` plus `env(safe-area-inset-bottom)` padding). There is no shared token,
 * so this mirrors those values. Used only on phones (the facility sheet).
 */
export const MOBILE_BOTTOM_NAV_CLEARANCE = "calc(80px + env(safe-area-inset-bottom, 0px))";

export const mutedText = "text-muted-foreground dark:text-muted-foreground";
/**
 * Asset Map link token (spec `--link`): navy in light, light blue in dark. Links here never use
 * `text-primary`, so they don't pick up Wave A's dark red text (#F87171 is for the one red action).
 */
export const linkText = "text-link dark:text-link";

export const focusRing =
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:focus-visible:outline-white";

export const chipBase = cn(
  "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium tabular-nums transition-colors",
  "border-border bg-white text-foreground-secondary hover:bg-muted dark:border-border dark:bg-surface dark:text-foreground-secondary dark:hover:bg-muted",
  "aria-pressed:border-selected aria-pressed:bg-selected aria-pressed:text-white dark:aria-pressed:border-selected dark:aria-pressed:bg-selected dark:aria-pressed:text-selected-foreground",
  focusRing
);

export function useMapScheme(): MapScheme {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "dark" : "light";
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

type TypeGlyphProps = {
  type: FacilityType;
  scheme: MapScheme;
  /** Readiness tier colour, or a neutral colour for chips and the legend. */
  tier?: PinTier;
  neutral?: "chip" | "chipOn";
  size?: number;
  className?: string;
};

/** The same shapes as the map pins, for chips, legend, list rows and the drawer badge. */
export function TypeGlyph({ type, scheme, tier, neutral, size = 16, className }: TypeGlyphProps) {
  const k = Math.min(1, (size - 1) / GLYPH_SIZE[type]);
  let colours: GlyphColours;
  if (neutral) {
    const t = MAP_TOKENS[scheme];
    const chip = t.chip;
    const on = t.pinStroke;
    const surface = t.surface;
    colours =
      neutral === "chipOn"
        ? { fill: on, stroke: on, inner: t.lineHi, ring: on }
        : { fill: chip, stroke: surface, inner: surface, ring: chip };
  } else {
    colours = glyphColours(tier ?? "none", scheme);
    if (tier !== "offline") colours = { ...colours, stroke: MAP_TOKENS[scheme].surface };
  }
  const prims = glyphPrimitives(type, colours, k);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      aria-hidden="true"
      className={cn("shrink-0 overflow-visible", className)}
    >
      {prims.map((p, i) => {
        const Tag = p.tag;
        const attrs = Object.fromEntries(
          Object.entries(p.attrs).map(([key, value]) => [key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), value])
        );
        return <Tag key={i} {...attrs} />;
      })}
    </svg>
  );
}

export function OfflineGlyph({ scheme, size = 12 }: { scheme: MapScheme; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-6 -6 12 12" aria-hidden="true" className="shrink-0">
      <circle r={4.5} fill={MAP_TOKENS[scheme].surface} stroke={MAP_TOKENS[scheme].offlineStroke} strokeWidth={1.75} />
    </svg>
  );
}

export function ReadinessPill({
  tier,
  scheme,
  children,
  dashed,
}: {
  tier: PinTier;
  scheme: MapScheme;
  children: React.ReactNode;
  dashed?: boolean;
}) {
  const p = READINESS_PILLS[tier];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-semibold tabular-nums",
        dashed && "border border-dashed border-control-border dark:border-control-border"
      )}
      style={
        scheme === "dark"
          ? { color: p.darkFg, background: dashed ? "transparent" : `${p.darkFg}1F` }
          : { color: p.lightFg, background: dashed ? "transparent" : p.lightBg }
      }
    >
      {children}
    </span>
  );
}

export function tierWord(tier: PinTier): string {
  return READINESS_LABELS[tier];
}
