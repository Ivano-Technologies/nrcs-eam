import { cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import React from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import NotFound from "./NotFound";

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
    });
  }
});

afterEach(() => cleanup());

function renderAt(path: string) {
  const { hook } = memoryLocation({ path });
  return render(
    <ThemeProvider attribute="class">
      <Router hook={hook}>
        <NotFound />
      </Router>
    </ThemeProvider>
  );
}

describe("NotFound (Wave B11)", () => {
  it("uses the approved copy on public routes", () => {
    renderAt("/does-not-exist");
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("The page you are looking for does not exist or has moved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to home" })).toBeInTheDocument();
  });

  it("renders only the card inside the app shell", () => {
    renderAt("/app/nope");
    expect(screen.getByTestId("not-found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch to (light|dark) theme/i })).not.toBeInTheDocument();
  });
});
