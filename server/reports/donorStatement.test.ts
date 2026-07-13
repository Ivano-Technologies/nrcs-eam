import { describe, expect, it } from "vitest";

describe("donor statement math", () => {
  it("opening + received - distributed - losses equals closing", () => {
    const opening = 100;
    const received = 50;
    const distributed = 30;
    const losses = 5;
    const closing = opening + received - distributed - losses;
    expect(closing).toBe(115);
  });
});
