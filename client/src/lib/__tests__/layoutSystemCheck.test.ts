// @vitest-environment node
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script without types
import { checkSource } from "../../../../scripts/check/verify-layout-system.mjs";

type Problem = { rule: string; line: number };
const rules = (src: string) => (checkSource(src) as Problem[]).map((p) => p.rule);

describe("verify-layout-system", () => {
  it("flags a rebuilt header row", () => {
    const src = `<div className="flex items-center justify-between">\n  <PageHeader title="X" className="mb-0" />\n  <Button>Add</Button>\n</div>`;
    expect(rules(src)).toContain("header-row");
  });

  it("accepts PageHeader with actions", () => {
    expect(rules(`<PageHeader title="X" actions={<Button>Add</Button>} />`)).toEqual([]);
  });

  it("flags a gap-3 card grid but not a gap-4 one", () => {
    expect(rules(`<div className="grid gap-3 md:grid-cols-2">\n  {rows.map((r) => (\n    <Card key={r.id} />`)).toContain("card-grid-gap");
    expect(rules(`<div className="grid gap-4 md:grid-cols-2">\n  {rows.map((r) => (\n    <Card key={r.id} />`)).toEqual([]);
  });

  it("allows rounded-xl, rounded-md, rounded-full and their side forms only", () => {
    expect(rules(`<div className="rounded-xl" /><b className="rounded-md" /><i className="rounded-full rounded-t-xl" />`)).toEqual([]);
    for (const bad of ["rounded", "rounded-lg", "rounded-[10px]", "rounded-2xl", "rounded-t-2xl", "sm:rounded-sm"]) {
      expect(rules(`<div className="p-4 ${bad}" />`)).toContain("radius");
    }
  });
});
