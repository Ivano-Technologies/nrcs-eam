import type { MapScheme } from "@/lib/facilityMapHelpers";

/**
 * Map surface tokens (POLISH-BOARD + Asset Map spec §4).
 * Google Maps polylines, pin canvases and the SVG glyphs need literal colours and an explicit scheme
 * (not the app's .dark class), so this file and READINESS_* in facilityMapHelpers are the one JS source
 * for map colours. Values shared with CSS are mirrored as --map-* in index.css and kept in sync by
 * mapTokens.sync.test.ts. Both files are on the hex allowlist (scripts/verify-no-raw-hex.mjs).
 */
export const MAP_TOKENS: Record<
  MapScheme,
  {
    surface: string;
    pinStroke: string;
    pinInner: string;
    line: string;
    lineHi: string;
    halo: string;
    text: string;
    muted: string;
    border: string;
    chip: string;
    offlineStroke: string;
    mockBg: string;
    mockGrid: string;
    mockLabelBg: string;
  }
> = {
  light: {
    surface: "#FFFFFF",
    pinStroke: "#FFFFFF",
    line: "#64748B",
    lineHi: "#0B2545",
    halo: "#0B2545",
    text: "#111827",
    muted: "#62626C",
    border: "#E5E7EB",
    chip: "#475569",
    offlineStroke: "#6B7280",
    pinInner: "#FFFFFF",
    mockBg: "#FAFAF7",
    mockGrid: "#ECEEF1",
    mockLabelBg: "#FFFFFFCC",
  },
  dark: {
    surface: "#162130",
    pinStroke: "#0F1724",
    line: "#8A9AB0",
    lineHi: "#E6EAF0",
    halo: "#FFFFFF",
    text: "#E6EAF0",
    muted: "#A3AEBD",
    border: "#26364A",
    chip: "#A3AEBD",
    offlineStroke: "#8A9AB0",
    pinInner: "#FFFFFF",
    mockBg: "#182333",
    mockGrid: "#22324A",
    mockLabelBg: "#0F1724CC",
  },
};
