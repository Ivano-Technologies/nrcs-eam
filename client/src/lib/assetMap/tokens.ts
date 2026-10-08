import type { MapScheme } from "@/lib/facilityMapHelpers";

/** Map surface tokens (POLISH-BOARD + Asset Map spec §4). */
export const MAP_TOKENS: Record<
  MapScheme,
  { surface: string; pinStroke: string; line: string; lineHi: string; halo: string; text: string; muted: string; border: string }
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
  },
};
