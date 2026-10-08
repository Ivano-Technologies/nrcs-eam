import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import PrivacyPolicy from "./PrivacyPolicy";
import TermsOfService from "./TermsOfService";

afterEach(() => {
  cleanup();
});

describe.each([
  ["Terms of Service", TermsOfService],
  ["Privacy Policy", PrivacyPolicy],
])("%s (Wave A8)", (_name, Page) => {
  it("has no template note or placeholders and a fixed date", () => {
    const { container } = render(<Page />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/template document/i);
    expect(text).not.toContain("[Contact Number]");
    expect(text).not.toMatch(/Phone:/);
    expect(text).toContain("Last updated 8 October 2026");
    expect(text).toContain("Contact your NRCS system administrator");
    expect(text).not.toContain("third-party");
    expect(text).not.toContain("record-keeping");
    expect(text).not.toContain("Data Protection Officer / IT Department");
  });
});

describe("Privacy Policy copy (Wave A8)", () => {
  it("uses the approved wording", () => {
    const { container } = render(<PrivacyPolicy />);
    const text = container.textContent ?? "";
    expect(text).toContain("external service providers");
    expect(text).toContain("record retention policies");
    expect(text).toContain("Data Protection Officer, IT Department");
  });
});
