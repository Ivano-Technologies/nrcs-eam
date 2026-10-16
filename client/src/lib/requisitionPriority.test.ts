import { describe, expect, it } from "vitest";
import { requisitionPriorityBadgeClass } from "./requisitionPriority";

describe("requisitionPriorityBadgeClass", () => {
  it("uses danger for emergency and warning for urgent", () => {
    expect(requisitionPriorityBadgeClass("emergency")).toContain("text-danger-foreground");
    expect(requisitionPriorityBadgeClass("emergency")).toContain("bg-danger-subtle");
    expect(requisitionPriorityBadgeClass("urgent")).toContain("text-warning-foreground");
    expect(requisitionPriorityBadgeClass("urgent")).toContain("bg-warning-subtle");
  });

  it("keeps routine and unknown values neutral", () => {
    for (const p of ["routine", null, undefined, "other"]) {
      expect(requisitionPriorityBadgeClass(p)).toContain("bg-secondary");
    }
  });

  it("never uses brand red or destructive for priority", () => {
    for (const p of ["emergency", "urgent", "routine"]) {
      expect(requisitionPriorityBadgeClass(p)).not.toMatch(/primary|destructive/);
    }
  });
});
