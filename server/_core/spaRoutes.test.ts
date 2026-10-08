import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_SPA_PREFIX, isKnownSpaPath, PUBLIC_SPA_PATHS } from "../../shared/spaRoutes";

const root = path.resolve(import.meta.dirname, "../..");

type Rewrite = { source: string; destination: string };

function spaRewriteSources(file: string): string[] {
  const config = JSON.parse(fs.readFileSync(path.join(root, file), "utf8")) as {
    rewrites: Rewrite[];
  };
  return config.rewrites.filter((r) => r.destination === "/index.html").map((r) => r.source);
}

describe("isKnownSpaPath", () => {
  it.each([
    "/",
    "/login",
    "/login/",
    "/signup",
    "/reset-password",
    "/legal/terms",
    "/legal/privacy",
    "/app",
    "/app/",
    "/app/assets",
    "/app/assets/42",
    "/app/inventory/receipts/7/print/original",
  ])("serves %s with 200", (p) => {
    expect(isKnownSpaPath(p)).toBe(true);
  });

  it.each(["/this-does-not-exist", "/404", "/application", "/apps", "/dashboard", "/legal"])(
    "serves %s with 404",
    (p) => {
      expect(isKnownSpaPath(p)).toBe(false);
    }
  );
});

describe("SPA route allowlist stays in sync", () => {
  const expectedSources = [
    ...PUBLIC_SPA_PATHS.filter((p) => p !== "/"),
    APP_SPA_PREFIX,
    `${APP_SPA_PREFIX}/:path*`,
  ].sort();

  it.each(["vercel.json", "client/vercel.json"])(
    "%s rewrites only known client routes to index.html (no catch all)",
    (file) => {
      expect(spaRewriteSources(file).sort()).toEqual(expectedSources);
    }
  );

  it("every top level route in App.tsx is in PUBLIC_SPA_PATHS", () => {
    const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
    const paths = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      if (p === "/404") continue; // intentionally a 404
      expect(PUBLIC_SPA_PATHS as readonly string[]).toContain(p);
    }
  });
});
