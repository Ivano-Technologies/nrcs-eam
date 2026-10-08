/**
 * DOM content for map pins, bubbles and tooltips. Built with createElement and textContent
 * only, so facility names can never inject HTML.
 */
import type { FacilityType } from "@shared/facilities";
import {
  ASSET_STATUS_COLOURS,
  READINESS_COLOURS,
  READINESS_PILLS,
  type MapScheme,
  type PinTier,
} from "@/lib/facilityMapHelpers";
import { buildGlyphSvg, GLYPH_SIZE, type GlyphColours } from "./glyphs";
import { MAP_TOKENS } from "./tokens";
import { bubbleRadius, formatCount } from "./model";

export function glyphColours(tier: PinTier, scheme: MapScheme, solidOffline = false): GlyphColours {
  const t = MAP_TOKENS[scheme];
  const colour = READINESS_COLOURS[scheme][tier];
  if (solidOffline && tier === "offline") {
    // Facilities map: inactive pins are solid grey with a white outline.
    return { fill: colour, stroke: "#FFFFFF", inner: "#FFFFFF", ring: colour };
  }
  const offline = tier === "offline";
  return {
    fill: offline ? t.surface : colour,
    stroke: offline ? colour : t.pinStroke,
    inner: offline ? colour : "#FFFFFF",
    ring: colour,
  };
}

export type PinOptions = {
  type: FacilityType;
  tier: PinTier;
  scheme: MapScheme;
  selected: boolean;
  hovered: boolean;
  touch: boolean;
  /** Render offline pins solid (Facilities map status mode) instead of hollow. */
  solidOffline?: boolean;
};

/** Facility pin: shape by type, fill by readiness, ≥24px hit target (44px on touch). */
export function buildPinContent(o: PinOptions): HTMLDivElement {
  const t = MAP_TOKENS[o.scheme];
  const k = o.selected ? 1.15 : 1;
  const wrap = document.createElement("div");
  wrap.className = "nrcs-map-pin";
  const glyph = GLYPH_SIZE[o.type] * k;
  const hit = Math.max(o.touch ? 44 : 24, Math.ceil(glyph + 4));
  Object.assign(wrap.style, {
    width: `${hit}px`,
    height: `${hit}px`,
    display: "grid",
    placeItems: "center",
    transform: "translateY(50%)",
    cursor: "pointer",
    position: "relative",
  } satisfies Partial<CSSStyleDeclaration>);
  if (o.selected || o.hovered) {
    const halo = document.createElement("span");
    const size = Math.ceil(glyph + (o.selected ? 10 : 12));
    Object.assign(halo.style, {
      position: "absolute",
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "999px",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      boxSizing: "border-box",
      ...(o.selected
        ? { border: `2px solid ${t.halo}`, background: "transparent" }
        : { background: READINESS_COLOURS[o.scheme][o.tier], opacity: "0.12" }),
    } satisfies Partial<CSSStyleDeclaration>);
    wrap.appendChild(halo);
  }
  const svg = buildGlyphSvg(o.type, glyphColours(o.tier, o.scheme, o.solidOffline), k);
  svg.style.filter = "drop-shadow(0 1px 1.5px rgba(15,23,42,0.35))";
  svg.style.position = "relative";
  wrap.appendChild(svg);
  return wrap;
}

/** Faint dot for the empty state (shows the network so the map does not look broken). */
export function buildGhostDot(scheme: MapScheme): HTMLDivElement {
  const dot = document.createElement("div");
  Object.assign(dot.style, {
    width: "5.2px",
    height: "5.2px",
    borderRadius: "999px",
    background: READINESS_COLOURS[scheme].none,
    opacity: "0.9",
    transform: "translateY(50%)",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  return dot;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export type BubbleOptions = {
  count: number;
  byStatus: { inUse: number; maintenance: number; retired: number };
  offline: boolean;
  scheme: MapScheme;
  selected: boolean;
  hovered: boolean;
  touch: boolean;
};

/** Assets layer bubble: size by asset count, ring split by status. */
export function buildBubbleContent(o: BubbleOptions): HTMLDivElement {
  const t = MAP_TOKENS[o.scheme];
  const c = ASSET_STATUS_COLOURS[o.scheme];
  const r = bubbleRadius(o.count) * (o.selected ? 1.1 : 1);
  const ringW = 3.2;
  const size = Math.ceil(2 * r + ringW + 10);
  const hit = Math.max(o.touch ? 44 : 24, size);
  const wrap = document.createElement("div");
  wrap.className = "nrcs-map-bubble";
  Object.assign(wrap.style, {
    width: `${hit}px`,
    height: `${hit}px`,
    display: "grid",
    placeItems: "center",
    transform: "translateY(50%)",
    cursor: "pointer",
  } satisfies Partial<CSSStyleDeclaration>);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", `${-size / 2} ${-size / 2} ${size} ${size}`);
  svg.setAttribute("aria-hidden", "true");
  svg.style.overflow = "visible";
  svg.style.filter = "drop-shadow(0 1px 1.5px rgba(15,23,42,0.25))";

  const base = document.createElementNS(SVG_NS, "circle");
  base.setAttribute("r", String(r));
  base.setAttribute("fill", t.surface);
  base.setAttribute("fill-opacity", "0.94");
  svg.appendChild(base);

  const circ = 2 * Math.PI * r;
  if (o.offline) {
    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("r", String(r));
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", READINESS_COLOURS[o.scheme].offline);
    ring.setAttribute("stroke-width", "1.8");
    ring.setAttribute("stroke-dasharray", "3 2.4");
    svg.appendChild(ring);
  } else {
    const total = Math.max(1, o.byStatus.inUse + o.byStatus.maintenance + o.byStatus.retired);
    let offset = 0;
    const parts: [number, string][] = [
      [o.byStatus.inUse, c.inUse],
      [o.byStatus.maintenance, c.maintenance],
      [o.byStatus.retired, c.retired],
    ];
    for (const [value, colour] of parts) {
      if (value <= 0) continue;
      const len = (value / total) * circ;
      const arc = document.createElementNS(SVG_NS, "circle");
      arc.setAttribute("r", String(r));
      arc.setAttribute("fill", "none");
      arc.setAttribute("stroke", colour);
      arc.setAttribute("stroke-width", String(ringW));
      arc.setAttribute("stroke-dasharray", `${len} ${circ - len}`);
      arc.setAttribute("stroke-dashoffset", String(-offset));
      arc.setAttribute("transform", "rotate(-90)");
      svg.appendChild(arc);
      offset += len;
    }
  }
  if (o.selected || o.hovered) {
    const halo = document.createElementNS(SVG_NS, "circle");
    halo.setAttribute("r", String(r + 4));
    halo.setAttribute("fill", "none");
    halo.setAttribute("stroke", o.selected ? t.halo : c.inUse);
    halo.setAttribute("stroke-width", o.selected ? "2" : "1.5");
    halo.setAttribute("stroke-opacity", o.selected ? "1" : "0.4");
    svg.appendChild(halo);
  }
  if (r >= 11) {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("fill", t.text);
    text.setAttribute(
      "style",
      `font: 600 ${r >= 18 ? 12 : 10.5}px Inter, system-ui, sans-serif; font-variant-numeric: tabular-nums;`
    );
    text.textContent = formatCount(o.count);
    svg.appendChild(text);
  }
  wrap.appendChild(svg);
  return wrap;
}

/** Tooltip / persistent label pill: "Kano State Branch  82% Good". Text only, no HTML. */
export function buildLabelContent(
  name: string,
  detail: string,
  tier: PinTier,
  scheme: MapScheme,
  liftPx: number
): HTMLDivElement {
  const t = MAP_TOKENS[scheme];
  const pill = READINESS_PILLS[tier];
  const wrap = document.createElement("div");
  wrap.className = "nrcs-map-label";
  Object.assign(wrap.style, {
    transform: `translateY(-${liftPx}px)`,
    pointerEvents: "none",
    whiteSpace: "nowrap",
    background: t.surface,
    color: t.text,
    border: `1px solid ${t.border}`,
    borderRadius: "8px",
    padding: "4px 8px",
    font: "600 12px Inter, system-ui, sans-serif",
    boxShadow: "0 1px 2px rgba(15,23,42,.06), 0 8px 24px rgba(15,23,42,.10)",
    display: "flex",
    gap: "6px",
    alignItems: "baseline",
  } satisfies Partial<CSSStyleDeclaration>);
  const strong = document.createElement("span");
  strong.textContent = name;
  const small = document.createElement("span");
  small.textContent = detail;
  small.style.color = scheme === "dark" ? pill.darkFg : pill.lightFg;
  small.style.fontVariantNumeric = "tabular-nums";
  wrap.append(strong, small);
  return wrap;
}
