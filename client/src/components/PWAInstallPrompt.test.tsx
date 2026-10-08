import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PWA_SESSION_COUNT_KEY,
  PWAInstallCard,
  recordPwaSession,
  shouldOfferPwaInstall,
} from "./PWAInstallPrompt";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const DAY = 24 * 60 * 60 * 1000;

describe("PWA install prompt gating (Wave A7)", () => {
  it("counts each browser session once", () => {
    expect(recordPwaSession(window.localStorage, window.sessionStorage)).toBe(1);
    expect(recordPwaSession(window.localStorage, window.sessionStorage)).toBe(1);
    // New browser session: sessionStorage is fresh, the device count carries on.
    window.sessionStorage.clear();
    expect(recordPwaSession(window.localStorage, window.sessionStorage)).toBe(2);
    expect(window.localStorage.getItem(PWA_SESSION_COUNT_KEY)).toBe("2");
  });

  it("stays hidden in the first session", () => {
    expect(shouldOfferPwaInstall({ sessionCount: 1, dismissedAt: null })).toBe(false);
  });

  it("shows from the second session", () => {
    expect(shouldOfferPwaInstall({ sessionCount: 2, dismissedAt: null })).toBe(true);
  });

  it("remembers Not now for 30 days", () => {
    const now = Date.UTC(2026, 9, 8);
    const at = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();
    expect(shouldOfferPwaInstall({ sessionCount: 5, dismissedAt: at(1), now })).toBe(false);
    expect(shouldOfferPwaInstall({ sessionCount: 5, dismissedAt: at(29), now })).toBe(false);
    expect(shouldOfferPwaInstall({ sessionCount: 5, dismissedAt: at(31), now })).toBe(true);
  });

  it("renders the approved copy and buttons", async () => {
    const onInstall = vi.fn();
    const onDismiss = vi.fn();
    render(<PWAInstallCard onInstall={onInstall} onDismiss={onDismiss} />);
    expect(screen.getByText("Install NRCS EAM")).toBeInTheDocument();
    expect(screen.getByText("Open it from your home screen and use it offline.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Install" }));
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Later" })).not.toBeInTheDocument();
  });
});

describe("PWA install popup position (Wave B, 390)", () => {
  it("sits above the mobile bottom nav and returns to the corner from md up", async () => {
    const { PWA_POPUP_POSITION_CLASS } = await import("./PWAInstallPrompt");
    expect(PWA_POPUP_POSITION_CLASS).toContain("bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]");
    expect(PWA_POPUP_POSITION_CLASS).toContain("inset-x-3");
    expect(PWA_POPUP_POSITION_CLASS).toContain("md:bottom-4");
    expect(PWA_POPUP_POSITION_CLASS).toContain("md:right-4");
    expect(PWA_POPUP_POSITION_CLASS).not.toMatch(/(^| )bottom-4( |$)/);
  });
});
