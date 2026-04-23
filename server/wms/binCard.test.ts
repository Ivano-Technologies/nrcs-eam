import { describe, expect, it } from "vitest";
import { assertBinCardLifecycleTransition } from "./binCard";

describe("bin card lifecycle transitions", () => {
  it("close: status changes to closed (transition allowed)", () => {
    expect(() => assertBinCardLifecycleTransition("open", "close")).not.toThrow();
  });

  it("reopen: status changes to open (transition allowed)", () => {
    expect(() => assertBinCardLifecycleTransition("closed", "reopen")).not.toThrow();
  });

  it("close an already-closed card: error", () => {
    expect(() => assertBinCardLifecycleTransition("closed", "close")).toThrow(/already closed/i);
  });

  it("reopen an open card: error", () => {
    expect(() => assertBinCardLifecycleTransition("open", "reopen")).toThrow(/already open/i);
  });
});

