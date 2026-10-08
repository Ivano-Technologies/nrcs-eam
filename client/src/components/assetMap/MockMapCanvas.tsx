/**
 * `?mapMock=1`: a lightweight DOM stand in for Google Maps so E2E tests (which cannot load
 * Google under navigator.webdriver) can click markers. Uses the same pin and bubble builders as
 * the real map. Markers carry `data-testid="asset-map-marker-<code>"`.
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { pinTier, type MapScheme } from "@/lib/facilityMapHelpers";
import type { MapController } from "@/lib/assetMap/controller";
import { quadraticCurve } from "@/lib/assetMap/curves";
import { facilityAriaLabel, facilityPosition, tooltipText, type MapFacility, type MapLayer } from "@/lib/assetMap/model";
import { buildBubbleContent, buildGhostDot, buildLabelContent, buildPinContent } from "@/lib/assetMap/pinContent";
import { MAP_TOKENS } from "@/lib/assetMap/tokens";
import type { Insets } from "@/lib/assetMap/useMapSelection";
import { GLYPH_SIZE } from "@/lib/assetMap/glyphs";

const BOUNDS = { north: 14.2, south: 4.0, west: 2.5, east: 14.9 };

type Props = {
  facilities: MapFacility[];
  visibleIds: Set<number>;
  layer: MapLayer;
  scheme: MapScheme;
  selectedId: number | null;
  hoveredId: number | null;
  lines: boolean;
  empty: boolean;
  insets: Insets;
  onSelect: (id: number, opener: HTMLElement | null) => void;
  onHover: (id: number | null) => void;
  onBackgroundClick: () => void;
};

function Content({ build }: { build: () => HTMLElement }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = build();
    el.style.transform = "none";
    ref.current?.replaceChildren(el);
  });
  return <span ref={ref} className="pointer-events-none block" />;
}

export const MockMapCanvas = forwardRef<MapController, Props>(function MockMapCanvas(p, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(6);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 1000, height: 700 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth || 1000, height: el.clientHeight || 700 });
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const project = useMemo(() => {
    const scale = 2 ** (zoom - 6);
    const free = {
      left: p.insets.left + 24,
      top: p.insets.top + 24,
      width: Math.max(200, size.width - p.insets.left - 48 - 16),
      height: Math.max(200, size.height - p.insets.top - p.insets.bottom - 48),
    };
    const k = Math.min(free.width / (BOUNDS.east - BOUNDS.west), free.height / (BOUNDS.north - BOUNDS.south)) * scale;
    const cx = free.left + free.width / 2;
    const cy = free.top + free.height / 2;
    const mx = (BOUNDS.east + BOUNDS.west) / 2;
    const my = (BOUNDS.north + BOUNDS.south) / 2;
    return (lat: number, lng: number) => ({ x: cx + (lng - mx) * k - offset.x, y: cy - (lat - my) * k - offset.y });
    // Insets are read at fit time only, so opening the drawer never moves the stub.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, offset, size.width, size.height]);

  useImperativeHandle(
    ref,
    (): MapController => ({
      zoomBy: (d) => setZoom((z) => z + d),
      fitTo: () => {
        setZoom(6);
        setOffset({ x: 0, y: 0 });
      },
      ensureVisible: (point, insets) => {
        const px = project(point.lat, point.lng);
        const margin = 32;
        const minX = insets.left + margin;
        const maxX = size.width - insets.right - margin;
        const minY = insets.top + margin;
        const maxY = size.height - insets.bottom - margin;
        const dx = px.x - Math.min(Math.max(px.x, minX), maxX);
        const dy = px.y - Math.min(Math.max(px.y, minY), maxY);
        if (dx || dy) setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
      },
      setStyle: () => {},
      getZoom: () => zoom,
    }),
    [project, size, zoom]
  );

  const t = MAP_TOKENS[p.scheme];
  const byId = useMemo(() => new Map(p.facilities.map((f) => [f.id, f])), [p.facilities]);
  const located = p.facilities.filter((f) => facilityPosition(f));
  const shown = located.filter((f) => {
    if (p.empty || !p.visibleIds.has(f.id)) return false;
    if (p.layer === "assets") return f.statsVisible && (f.assetCount ?? 0) > 0;
    return true;
  });
  const focus = p.hoveredId ?? p.selectedId;
  const zOf = (f: MapFacility) => {
    if (f.id === p.selectedId) return 1000;
    if (f.id === p.hoveredId) return 900;
    if (p.layer === "assets") return 500 - Math.min(499, f.assetCount ?? 0);
    if (f.facilityType === "national_headquarters") return 10;
    return { none: 1, offline: 1, good: 2, partial: 3, low: 4 }[pinTier(f)];
  };

  return (
    <div
      ref={box}
      data-testid="asset-map-mock"
      data-zoom={zoom}
      className="absolute inset-0 overflow-hidden"
      style={{
        background: p.scheme === "dark" ? "#182333" : "#FAFAF7",
        backgroundImage: `linear-gradient(${p.scheme === "dark" ? "#22324a" : "#ECEEF1"} 1px, transparent 1px), linear-gradient(90deg, ${p.scheme === "dark" ? "#22324a" : "#ECEEF1"} 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.mockBg) p.onBackgroundClick();
      }}
    >
      <svg className="absolute inset-0 h-full w-full" data-mock-bg="1" aria-hidden="true">
        {p.lines && !p.empty
          ? shown.map((f) => {
              const parent = f.parentFacilityId != null ? byId.get(f.parentFacilityId) : undefined;
              const a = facilityPosition(f);
              const b = parent ? facilityPosition(parent) : null;
              if (!parent || !a || !b || !p.visibleIds.has(parent.id)) return null;
              const hi = focus != null && (focus === f.id || focus === parent.id);
              const d = quadraticCurve(a, b)
                .map((q, i) => {
                  const xy = project(q.lat, q.lng);
                  return `${i ? "L" : "M"}${xy.x.toFixed(1)} ${xy.y.toFixed(1)}`;
                })
                .join("");
              return (
                <path
                  key={f.id}
                  d={d}
                  fill="none"
                  stroke={hi ? t.lineHi : t.line}
                  strokeOpacity={hi ? 0.85 : p.scheme === "dark" ? 0.22 : 0.3}
                  strokeWidth={hi ? 1.75 : 1}
                />
              );
            })
          : null}
      </svg>
      {p.empty
        ? located.map((f) => {
            const pos = project(f.lat as number, f.lng as number);
            return (
              <span key={f.id} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pos.x, top: pos.y }}>
                <Content build={() => buildGhostDot(p.scheme)} />
              </span>
            );
          })
        : null}
      {shown.map((f) => {
        const pos = project(f.lat as number, f.lng as number);
        const selected = f.id === p.selectedId;
        const hovered = f.id === p.hoveredId;
        const build =
          p.layer === "assets"
            ? () =>
                buildBubbleContent({
                  count: f.assetCount ?? 0,
                  byStatus: f.assetsByStatus ?? { inUse: 0, maintenance: 0, retired: 0 },
                  offline: !f.isActive,
                  scheme: p.scheme,
                  selected,
                  hovered,
                  touch: false,
                })
            : () =>
                buildPinContent({ type: f.facilityType, tier: pinTier(f), scheme: p.scheme, selected, hovered, touch: false });
        return (
          <button
            key={f.id}
            type="button"
            data-testid={`asset-map-marker-${f.code ?? f.id}`}
            aria-label={facilityAriaLabel(f)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[#C8102E]"
            style={{ left: pos.x, top: pos.y, zIndex: zOf(f) }}
            onClick={(e) => {
              e.stopPropagation();
              p.onSelect(f.id, e.currentTarget);
            }}
            onPointerEnter={() => p.onHover(f.id)}
            onPointerLeave={() => p.onHover(null)}
          >
            <Content build={build} />
          </button>
        );
      })}
      {[p.selectedId, p.hoveredId !== p.selectedId ? p.hoveredId : null].map((id, i) => {
        const f = id != null ? shown.find((x) => x.id === id) : undefined;
        if (!f) return null;
        const pos = project(f.lat as number, f.lng as number);
        const tt = tooltipText(f);
        const lift =
          p.layer === "assets"
            ? Math.ceil(10 + 4.5 + 1.45 * Math.sqrt(f.assetCount ?? 0))
            : Math.ceil(GLYPH_SIZE[f.facilityType] / 2 + 12);
        return (
          <span
            key={i}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
            style={{ left: pos.x, top: pos.y - lift, zIndex: 2000 }}
          >
            <Content
              build={() =>
                buildLabelContent(tt.name, p.layer === "assets" ? `${f.assetCount ?? 0} assets` : tt.detail, tt.tier, p.scheme, 0)
              }
            />
          </span>
        );
      })}
      <p
        className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[11px]"
        style={{ color: t.muted, background: p.scheme === "dark" ? "#0F1724cc" : "#ffffffcc" }}
      >
        Map test mode: no Google tiles
      </p>
    </div>
  );
});
