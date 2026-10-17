import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseComplianceRegisterQuery } from "./complianceRegisterQuery";

describe("Compliance register deep links", () => {
  it("reads tab and status from the search string", () => {
    expect(parseComplianceRegisterQuery("?tab=vehicles&status=no-date")).toEqual({ tab: "vehicles", status: "no-date" });
    expect(parseComplianceRegisterQuery("tab=generators&status=overdue")).toEqual({ tab: "generators", status: "overdue" });
    expect(parseComplianceRegisterQuery("")).toEqual({ tab: "vehicles", status: null });
  });

  it("uses wouter's search value, not the location path (which has no query string)", () => {
    const src = readFileSync(resolve(process.cwd(), "client/src/pages/Administration/ComplianceRegister.tsx"), "utf8");
    expect(src).toContain("const search = useSearch();");
    expect(src).toContain("parseQuery(search)");
    expect(src).toContain('urlStatus === "no-date"');
  });
});
