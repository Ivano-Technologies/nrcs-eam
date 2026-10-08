import { describe, expect, it } from "vitest";
import { hasTechnicalDetails } from "./assetDetail";

describe("hasTechnicalDetails (Wave B, asset detail)", () => {
  it("hides the card when every field is empty", () => {
    expect(hasTechnicalDetails({ manufacturer: null, model: "", serialNumber: "   ", location: undefined })).toBe(false);
    expect(hasTechnicalDetails({})).toBe(false);
    expect(hasTechnicalDetails(null)).toBe(false);
  });

  it("shows the card when any field has a value", () => {
    expect(hasTechnicalDetails({ serialNumber: "SN-1" })).toBe(true);
    expect(hasTechnicalDetails({ location: "Motor pool" })).toBe(true);
  });
});
