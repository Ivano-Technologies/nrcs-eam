import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import React from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="nrcs-theme-test" enableSystem={false}>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle (Wave A9)", () => {
  it("has an accessible name, pressed state and a 44px hit area", async () => {
    renderToggle();
    const toggle = await screen.findByRole("button", { name: "Switch to dark theme" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle.className).toContain("size-11");
  });

  it("flips label and aria-pressed when toggled", async () => {
    renderToggle();
    const toggle = await screen.findByRole("button", { name: "Switch to dark theme" });
    await userEvent.click(toggle);
    const dark = await screen.findByRole("button", { name: "Switch to light theme" });
    expect(dark).toHaveAttribute("aria-pressed", "true");
  });
});
