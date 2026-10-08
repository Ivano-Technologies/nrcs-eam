import { describe, expect, it } from "vitest";
import { activeNavPath } from "./appNav";

const PATHS = ["/app", "/app/assets", "/app/assets/scanner", "/app/facilities", "/app/settings"];

describe("activeNavPath (Wave B4)", () => {
  it("prefers an exact match", () => {
    expect(activeNavPath("/app/assets/scanner", PATHS)).toBe("/app/assets/scanner");
    expect(activeNavPath("/app", PATHS)).toBe("/app");
  });

  it("lights the longest parent for detail pages", () => {
    expect(activeNavPath("/app/assets/123", PATHS)).toBe("/app/assets");
    expect(activeNavPath("/app/facilities/42/", PATHS)).toBe("/app/facilities");
  });

  it("never lights the dashboard for nested routes and returns null when nothing matches", () => {
    expect(activeNavPath("/app/unknown", PATHS)).toBeNull();
  });

  it("lets extra matchers claim related routes", () => {
    const extra = [{ path: "/app/settings", matches: (loc: string) => loc.startsWith("/app/dashboard-settings") }];
    expect(activeNavPath("/app/dashboard-settings", PATHS, extra)).toBe("/app/settings");
  });
});
