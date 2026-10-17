import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SIDEBAR_GROUPS, groupIdForPath } from "./appNav";
import { appPath } from "@/lib/routes";

// IVA-162: Fleet health is now Asset health; /fleet-health redirects; internal names stay.
describe("Asset health rename (IVA-162)", () => {
  it("labels the nav item Asset health at /asset-health", () => {
    const items = SIDEBAR_GROUPS.flatMap((g) => g.items);
    const item = items.find((i) => i.path === appPath("/asset-health"));
    expect(item?.label).toBe("Asset health");
    expect(items.some((i) => /fleet health/i.test(i.label))).toBe(false);
    expect(groupIdForPath(appPath("/asset-health"))).toBe("maintenance");
  });

  it("routes /app/asset-health and redirects /app/fleet-health", () => {
    const src = readFileSync(resolve(process.cwd(), "client/src/components/ProtectedAppSection.tsx"), "utf8");
    expect(src).toContain('<Route path="/app/asset-health" component={FleetHealth} />');
    expect(src).toMatch(/<Route path="\/app\/fleet-health">\s*<Redirect to="\/app\/asset-health" replace \/>/);
  });

  it("renames the page title, PDF title and scheduled report label", () => {
    const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
    expect(read("client/src/pages/FleetHealth.tsx")).toContain('title="Asset health"');
    expect(read("server/reports/fleetHealthPdf.ts")).toContain("NRCS Asset Health Summary");
    const sched = read("client/src/pages/ReportScheduling.tsx");
    expect(sched).toContain('<SelectItem value="fleetHealth">Asset health</SelectItem>');
    expect(sched).not.toMatch(/Fleet Health|Fleet health/);
  });
});
