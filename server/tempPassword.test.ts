import { describe, expect, it } from "vitest";
import { generateSupabaseCompliantTempPassword } from "./tempPassword";

describe("generateSupabaseCompliantTempPassword", () => {
  it("returns 12 chars with upper, lower, digit, and symbol", () => {
    const p = generateSupabaseCompliantTempPassword(12);
    expect(p).toHaveLength(12);
    expect(/[A-Z]/.test(p)).toBe(true);
    expect(/[a-z]/.test(p)).toBe(true);
    expect(/[0-9]/.test(p)).toBe(true);
    expect(/[!@#$%^&*]/.test(p)).toBe(true);
  });

  it("generates distinct values across calls", () => {
    const a = generateSupabaseCompliantTempPassword(12);
    const b = generateSupabaseCompliantTempPassword(12);
    expect(a).not.toBe(b);
  });
});
