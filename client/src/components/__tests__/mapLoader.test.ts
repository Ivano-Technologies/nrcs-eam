import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type W = Window & { google?: unknown; __nrcsGoogleMapsReady?: () => void };

describe("loadMapScript", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    document.head.querySelectorAll("script[data-nrcs-maps]").forEach((s) => s.remove());
    delete (window as W).google;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as W).google;
  });

  it("injects the Google Maps script once across repeated calls and mounts", async () => {
    const mod = await import("../Map");
    mod.resetMapsLoaderForTest();
    const calls = Array.from({ length: 6 }, () => mod.loadMapScript());
    expect(document.head.querySelectorAll("script[data-nrcs-maps]")).toHaveLength(1);
    expect(mod.mapsScriptInjectionCountForTest()).toBe(1);

    (window as W).google = { maps: { Map: function Map() {} } };
    (window as W).__nrcsGoogleMapsReady?.();
    await expect(Promise.all(calls)).resolves.toEqual(Array(6).fill("ok"));

    // Once Google is on the page, later calls (layer switches, remounts) never inject again.
    for (let i = 0; i < 5; i += 1) await expect(mod.loadMapScript()).resolves.toBe("ok");
    expect(mod.mapsScriptInjectionCountForTest()).toBe(1);
    const src = document.head.querySelector<HTMLScriptElement>("script[data-nrcs-maps]")!.src;
    expect(src).toContain("loading=async");
    expect(src).toContain("libraries=marker");
  });

  it("reports no_key without injecting when the key is missing", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const mod = await import("../Map");
    mod.resetMapsLoaderForTest();
    await expect(mod.loadMapScript()).resolves.toBe("no_key");
    expect(document.head.querySelectorAll("script[data-nrcs-maps]")).toHaveLength(0);
  });

  it("uses the configured Map ID, else DEMO_MAP_ID", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_MAP_ID", "abc123");
    let mod = await import("../Map");
    expect(mod.GOOGLE_MAPS_MAP_ID).toBe("abc123");
    expect(mod.HAS_CONFIGURED_MAP_ID).toBe(true);
    vi.resetModules();
    vi.stubEnv("VITE_GOOGLE_MAPS_MAP_ID", "");
    mod = await import("../Map");
    expect(mod.GOOGLE_MAPS_MAP_ID).toBe("DEMO_MAP_ID");
    expect(mod.HAS_CONFIGURED_MAP_ID).toBe(false);
  });

  it("names the current host in the referrer error", async () => {
    const mod = await import("../Map");
    expect(mod.mapLoadErrorMessage("auth")).toContain(window.location.host);
    expect(mod.mapLoadErrorMessage("auth")).not.toMatch(/blue|techivano/);
  });
});
