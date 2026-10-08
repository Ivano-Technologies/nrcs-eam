/**
 * Keeps the Asset Map overlays (pins, bubbles, labels, network lines) on one google.maps.Map.
 * Markers live in a Map<id, entry> and are updated in place (content, zIndex, map=null to
 * hide). Nothing here ever calls fitBounds or setZoom; selection only pans (see useMapSelection).
 */
import { pinTier, type MapScheme } from "@/lib/facilityMapHelpers";
import { quadraticCurve } from "./curves";
import { GLYPH_SIZE } from "./glyphs";
import {
  facilityAriaLabel,
  facilityPosition,
  tooltipText,
  type MapFacility,
  type MapLayer,
} from "./model";
import { buildBubbleContent, buildGhostDot, buildLabelContent, buildPinContent } from "./pinContent";
import { MAP_TOKENS } from "./tokens";

export type OverlayState = {
  facilities: MapFacility[];
  visibleIds: Set<number>;
  layer: MapLayer;
  scheme: MapScheme;
  selectedId: number | null;
  hoveredId: number | null;
  lines: boolean;
  /** Filters match nothing: draw every located facility as a faint dot. */
  empty: boolean;
  touch: boolean;
};

export type OverlayCallbacks = {
  onSelect: (id: number, opener: HTMLElement | null) => void;
  onHover: (id: number | null) => void;
  onBackgroundClick: () => void;
};

type Entry = {
  marker: google.maps.marker.AdvancedMarkerElement;
  key: string;
  facilityId: number;
};

type LineEntry = { line: google.maps.Polyline; childId: number; parentId: number; key: string };

const TIER_Z: Record<string, number> = { none: 1, offline: 1, good: 2, partial: 3, low: 4 };

export class AssetMapOverlay {
  private map: google.maps.Map | null = null;
  private entries = new Map<number, Entry>();
  private lines = new Map<number, LineEntry>();
  private hoverLabel: google.maps.marker.AdvancedMarkerElement | null = null;
  private selectedLabel: google.maps.marker.AdvancedMarkerElement | null = null;
  private listeners: google.maps.MapsEventListener[] = [];
  private lastMarkerClick = 0;
  private state: OverlayState | null = null;

  constructor(private readonly callbacks: OverlayCallbacks) {}

  /** Attach to a (possibly new) map instance and move every overlay across. */
  setMap(map: google.maps.Map | null) {
    if (map === this.map) return;
    this.listeners.forEach((l) => l.remove());
    this.listeners = [];
    this.map = map;
    if (map) {
      this.listeners.push(
        map.addListener("click", () => {
          if (Date.now() - this.lastMarkerClick < 250) return;
          this.callbacks.onBackgroundClick();
        })
      );
    }
    this.entries.forEach((e) => {
      if (e.marker.map) e.marker.map = map;
    });
    this.lines.forEach((l) => {
      if (l.line.getMap()) l.line.setMap(map);
    });
    if (this.state) this.update(this.state);
  }

  destroy() {
    this.listeners.forEach((l) => l.remove());
    this.listeners = [];
    this.entries.forEach((e) => {
      e.marker.map = null;
    });
    this.lines.forEach((l) => l.line.setMap(null));
    if (this.hoverLabel) this.hoverLabel.map = null;
    if (this.selectedLabel) this.selectedLabel.map = null;
    this.entries.clear();
    this.lines.clear();
    this.map = null;
  }

  update(state: OverlayState) {
    this.state = state;
    const map = this.map;
    const g = window.google?.maps;
    if (!map || !g?.marker?.AdvancedMarkerElement) return;

    const seen = new Set<number>();
    for (const f of state.facilities) {
      const position = facilityPosition(f);
      if (!position) continue;
      seen.add(f.id);
      const desired = this.desiredMarker(f, state);
      let entry = this.entries.get(f.id);
      if (!desired) {
        if (entry && entry.marker.map) entry.marker.map = null;
        continue;
      }
      if (!entry) {
        const marker = new g.marker.AdvancedMarkerElement({ position });
        marker.addEventListener("gmp-click", () => {
          this.lastMarkerClick = Date.now();
          const opener = (entry?.marker as unknown as HTMLElement) ?? null;
          this.callbacks.onSelect(f.id, opener);
        });
        entry = { marker, key: "", facilityId: f.id };
        this.entries.set(f.id, entry);
      }
      const m = entry.marker;
      m.position = position;
      if (entry.key !== desired.key) {
        const content = desired.build();
        if (desired.clickable) {
          content.addEventListener("pointerenter", () => this.callbacks.onHover(f.id));
          content.addEventListener("pointerleave", () => this.callbacks.onHover(null));
        }
        m.content = content;
        entry.key = desired.key;
      }
      m.gmpClickable = desired.clickable;
      m.title = desired.clickable ? facilityAriaLabel(f) : "";
      m.zIndex = desired.zIndex;
      m.collisionBehavior = desired.collision;
      if (m.map !== map) m.map = map;
    }
    this.entries.forEach((entry, id) => {
      if (!seen.has(id) && entry.marker.map) entry.marker.map = null;
    });

    this.updateLabels(state);
    this.updateLines(state);
  }

  private desiredMarker(f: MapFacility, s: OverlayState) {
    const g = window.google.maps;
    const selected = s.selectedId === f.id;
    const hovered = s.hoveredId === f.id;
    if (s.empty) {
      return {
        key: `ghost:${s.scheme}`,
        build: () => buildGhostDot(s.scheme),
        clickable: false,
        zIndex: 0,
        collision: g.CollisionBehavior.REQUIRED,
      };
    }
    if (!s.visibleIds.has(f.id)) return null;
    if (s.layer === "assets") {
      const count = f.assetCount ?? 0;
      if (!f.statsVisible || count <= 0 || !f.assetsByStatus) return null;
      const byStatus = f.assetsByStatus;
      return {
        key: `bubble:${s.scheme}:${count}:${byStatus.inUse}:${byStatus.maintenance}:${byStatus.retired}:${f.isActive}:${selected}:${hovered}:${s.touch}`,
        build: () =>
          buildBubbleContent({
            count,
            byStatus,
            offline: !f.isActive,
            scheme: s.scheme,
            selected,
            hovered,
            touch: s.touch,
          }),
        clickable: true,
        // Biggest first, so small bubbles sit on top.
        zIndex: selected ? 100000 : hovered ? 90000 : 50000 - count,
        collision: g.CollisionBehavior.REQUIRED,
      };
    }
    const tier = pinTier(f);
    const isHq = f.facilityType === "national_headquarters";
    const lowPriority = (tier === "good" || tier === "none") && !isHq && !selected;
    return {
      key: `pin:${s.scheme}:${f.facilityType}:${tier}:${selected}:${hovered}:${s.touch}`,
      build: () =>
        buildPinContent({ type: f.facilityType, tier, scheme: s.scheme, selected, hovered, touch: s.touch }),
      clickable: true,
      zIndex: selected ? 1000 : hovered ? 900 : isHq ? 10 : TIER_Z[tier] ?? 1,
      collision: lowPriority
        ? g.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY
        : g.CollisionBehavior.REQUIRED,
    };
  }

  private labelLift(f: MapFacility, s: OverlayState): number {
    if (s.layer === "assets") return Math.ceil(8 + 2 * (4.5 + 1.45 * Math.sqrt(f.assetCount ?? 0)));
    return Math.ceil(GLYPH_SIZE[f.facilityType] / 2 + 10);
  }

  private updateLabels(s: OverlayState) {
    const g = window.google.maps;
    const make = () =>
      new g.marker.AdvancedMarkerElement({ gmpClickable: false, zIndex: 2000, collisionBehavior: g.CollisionBehavior.REQUIRED });
    const show = (
      current: google.maps.marker.AdvancedMarkerElement | null,
      id: number | null
    ): google.maps.marker.AdvancedMarkerElement | null => {
      const f = id != null ? s.facilities.find((x) => x.id === id) : undefined;
      const pos = f ? facilityPosition(f) : null;
      const markerShown = f && !s.empty && s.visibleIds.has(f.id) && (s.layer === "facilities" || (f.statsVisible && (f.assetCount ?? 0) > 0));
      if (!f || !pos || !markerShown) {
        if (current) current.map = null;
        return current;
      }
      const label = current ?? make();
      const t = tooltipText(f);
      const detail = s.layer === "assets" ? `${f.assetCount ?? 0} assets` : t.detail;
      label.content = buildLabelContent(t.name, detail, t.tier, s.scheme, this.labelLift(f, s));
      label.position = pos;
      label.map = this.map;
      return label;
    };
    this.selectedLabel = show(this.selectedLabel, s.selectedId);
    this.hoverLabel = show(this.hoverLabel, s.hoveredId !== s.selectedId ? s.hoveredId : null);
  }

  private updateLines(s: OverlayState) {
    const g = window.google.maps;
    const t = MAP_TOKENS[s.scheme];
    const byId = new Map(s.facilities.map((f) => [f.id, f]));
    const focus = s.hoveredId ?? s.selectedId;
    const wanted = new Set<number>();
    if (s.lines && !s.empty) {
      for (const f of s.facilities) {
        if (f.parentFacilityId == null || !s.visibleIds.has(f.id)) continue;
        const parent = byId.get(f.parentFacilityId);
        if (!parent || !s.visibleIds.has(parent.id)) continue;
        const a = facilityPosition(f);
        const b = facilityPosition(parent);
        if (!a || !b) continue;
        wanted.add(f.id);
        const hi = focus != null && (focus === f.id || focus === parent.id);
        const key = `${a.lat},${a.lng}>${b.lat},${b.lng}`;
        let entry = this.lines.get(f.id);
        if (!entry || entry.key !== key) {
          entry?.line.setMap(null);
          entry = {
            line: new g.Polyline({ path: quadraticCurve(a, b), geodesic: false, clickable: false }),
            childId: f.id,
            parentId: parent.id,
            key,
          };
          this.lines.set(f.id, entry);
        }
        entry.line.setOptions({
          strokeColor: hi ? t.lineHi : t.line,
          strokeOpacity: hi ? 0.85 : s.scheme === "dark" ? 0.22 : 0.3,
          strokeWeight: hi ? 1.75 : 1,
          zIndex: hi ? 2 : 1,
        });
        if (entry.line.getMap() !== this.map) entry.line.setMap(this.map);
      }
    }
    this.lines.forEach((entry, id) => {
      if (!wanted.has(id) && entry.line.getMap()) entry.line.setMap(null);
    });
  }
}
