/**
 * Facility type shapes, shared by map pins (DOM) and the panel (React) so the legend, type
 * chips, list rows and pins always match. Shape = facility type, fill = stock readiness.
 */
import type { FacilityType } from "@shared/facilities";

export type GlyphColours = {
  /** Shape fill (readiness colour, or the surface colour when offline). */
  fill: string;
  /** Outline (white in light, #0F1724 in dark; offline grey when offline). */
  stroke: string;
  /** Inner mark (star, plus, shelf lines). */
  inner: string;
  /** Outer HQ ring colour. */
  ring: string;
};

export type GlyphPrimitive = {
  tag: "circle" | "rect" | "path" | "polygon";
  attrs: Record<string, string | number>;
};

function starPoints(r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Outer size of each shape in px at scale 1 (used for hit targets and layout). */
export const GLYPH_SIZE: Record<FacilityType, number> = {
  national_headquarters: 30,
  branch: 16,
  division: 13.5,
  clinic: 19,
  warehouse: 18,
};

/** Primitives centred on 0,0. `k` scales the shape (1 = desktop map size). */
export function glyphPrimitives(type: FacilityType, c: GlyphColours, k = 1): GlyphPrimitive[] {
  const s = (v: number) => Number((v * k).toFixed(2));
  switch (type) {
    case "branch":
      return [{ tag: "circle", attrs: { r: s(7), fill: c.fill, stroke: c.stroke, "stroke-width": s(2) } }];
    case "division":
      return [
        {
          tag: "rect",
          attrs: {
            x: s(-5.75),
            y: s(-5.75),
            width: s(11.5),
            height: s(11.5),
            rx: s(2.5),
            fill: c.fill,
            stroke: c.stroke,
            "stroke-width": s(1.75),
          },
        },
      ];
    case "warehouse":
      return [
        {
          tag: "rect",
          attrs: {
            x: s(-8),
            y: s(-8),
            width: s(16),
            height: s(16),
            rx: s(3.5),
            fill: c.fill,
            stroke: c.stroke,
            "stroke-width": s(2),
          },
        },
        {
          tag: "path",
          attrs: {
            d: `M${s(-4)} ${s(-2)}H${s(4)}M${s(-4)} ${s(2)}H${s(4)}`,
            stroke: c.inner,
            "stroke-width": s(1.6),
            "stroke-linecap": "round",
            fill: "none",
          },
        },
      ];
    case "clinic":
      return [
        { tag: "circle", attrs: { r: s(8.5), fill: c.fill, stroke: c.stroke, "stroke-width": s(2) } },
        {
          tag: "path",
          attrs: {
            d: `M0 ${s(-4)}V${s(4)}M${s(-4)} 0H${s(4)}`,
            stroke: c.inner,
            "stroke-width": s(2.2),
            "stroke-linecap": "round",
            fill: "none",
          },
        },
      ];
    case "national_headquarters":
      return [
        {
          tag: "circle",
          attrs: { r: s(14.5), fill: "none", stroke: c.ring, "stroke-width": s(1.5), opacity: 0.5 },
        },
        { tag: "circle", attrs: { r: s(11), fill: c.fill, stroke: c.stroke, "stroke-width": s(2.5) } },
        { tag: "polygon", attrs: { points: starPoints(5.6 * k), fill: c.inner } },
      ];
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Build the glyph as an SVG element (map pins). Never uses innerHTML. */
export function buildGlyphSvg(type: FacilityType, colours: GlyphColours, k = 1, pad = 2): SVGSVGElement {
  const size = Math.ceil(GLYPH_SIZE[type] * k + pad * 2);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", `${-size / 2} ${-size / 2} ${size} ${size}`);
  svg.setAttribute("aria-hidden", "true");
  svg.style.overflow = "visible";
  svg.style.display = "block";
  for (const p of glyphPrimitives(type, colours, k)) {
    const el = document.createElementNS(SVG_NS, p.tag);
    for (const [key, value] of Object.entries(p.attrs)) el.setAttribute(key, String(value));
    svg.appendChild(el);
  }
  return svg;
}
