import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { PublicPageChrome } from "@/components/PublicPageChrome";
import { AuthFooterNote, authInputClass, authPrimaryButtonClass } from "./AuthPageShell";
import { AuthPageLayout } from "./AuthPageLayout";

afterEach(() => {
  cleanup();
});

describe("auth surface tokens (Wave A2, A4, A5)", () => {
  it("inputs have a solid fill and a visible border in both themes", () => {
    for (const cls of [
      "bg-white",
      "border-[#8A8F98]",
      "focus-visible:border-[#C8102E]",
      "focus-visible:ring-2",
      "focus-visible:ring-[#C8102E]/30",
      "dark:bg-white/10",
      "dark:border-white/40",
      "dark:placeholder:text-white/60",
      "dark:text-white",
    ]) {
      expect(authInputClass).toContain(cls);
    }
    expect(authInputClass).not.toContain("bg-white/50");
  });

  it("primary CTA uses the brand red", () => {
    expect(authPrimaryButtonClass).toContain("bg-[#C8102E]");
    expect(authPrimaryButtonClass).toContain("hover:bg-[#A50D26]");
    expect(authPrimaryButtonClass).not.toContain("#ef4444");
  });

  it("footer note meets contrast in both themes", () => {
    render(<AuthFooterNote>Authorised personnel only.</AuthFooterNote>);
    const note = screen.getByText("Authorised personnel only.");
    expect(note.className).toContain("text-[#6B7280]");
    expect(note.className).toContain("dark:text-gray-400");
  });
});

describe("theme toggle row (Wave A9)", () => {
  it.each([
    ["AuthPageLayout", AuthPageLayout],
    ["PublicPageChrome", PublicPageChrome],
  ])("%s renders the toggle in an in-flow top row above the content", (_name, Shell) => {
    const { container } = render(
      <Shell>
        <div data-testid="content">card</div>
      </Shell>,
    );
    const row = container.querySelector("div.flex.w-full.justify-end.p-4");
    expect(row).not.toBeNull();
    expect(row!.className).not.toMatch(/\b(absolute|fixed)\b/);
    const content = screen.getByTestId("content");
    // The toggle row comes before the content in document order.
    expect(row!.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
