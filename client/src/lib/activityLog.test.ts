import { describe, expect, it } from "vitest";
import { formatActivityAction, formatActivityDetails, formatActivityResource } from "./activityLog";

describe("activity log formatters (Wave B8)", () => {
  it("humanises actions", () => {
    expect(formatActivityAction("login")).toBe("Signed in");
    expect(formatActivityAction("create_work_order")).toBe("Create work order");
    expect(formatActivityAction(null)).toBe("");
  });

  it("never shows raw type:id resources", () => {
    expect(formatActivityResource("auth:2", "QA Mock Admin")).toBe("QA Mock Admin");
    expect(formatActivityResource("work_order:5")).toBe("Work order #5");
    expect(formatActivityResource("system")).toBe("System");
    expect(formatActivityResource(null)).toBe("");
  });

  it("renders JSON details as plain text", () => {
    expect(formatActivityDetails('{"email":"qa.mock@example.invalid"}')).toBe("qa.mock@example.invalid");
    expect(formatActivityDetails('{"assetTag":"NRCS-001","status":"active"}')).toBe("NRCS-001, Status: active");
    expect(formatActivityDetails('{"status":{"from":"open","to":"closed"}}')).toBe("Status: open to closed");
    expect(formatActivityDetails('{"ok":true}')).toBe("Ok: Yes");
    expect(formatActivityDetails("Plain note")).toBe("Plain note");
    expect(formatActivityDetails("{not json")).toBe("{not json");
    expect(formatActivityDetails(null)).toBe("");
  });

  it("never returns braces or quotes for valid JSON", () => {
    const text = formatActivityDetails('{"name":"Abuja branch","nested":{"a":{"b":1}}}');
    expect(text).toBe("Abuja branch");
    expect(text).not.toMatch(/[{}"]/);
  });
});
