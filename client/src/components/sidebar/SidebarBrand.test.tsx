import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarBrand, SidebarEdgeToggle } from "./SidebarBrand";

afterEach(() => cleanup());

const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("Sidebar brand", () => {
  it("shows the two brand lines at 13px and 12px, single line each, with no toggle in the row", () => {
    wrap(<SidebarBrand rail={false} />);
    const name = screen.getByTestId("sidebar-org-name");
    const subtitle = screen.getByTestId("sidebar-org-subtitle");
    expect(name).toHaveTextContent("Nigerian Red Cross Society");
    expect(subtitle).toHaveTextContent("Enterprise Asset Management");
    expect(name.className).toContain("text-[13px]");
    expect(name.className).toContain("truncate");
    expect(subtitle.className).toContain("text-[12px]");
    expect(subtitle.className).toContain("truncate");
    // The chevron left the brand row.
    expect(screen.getByTestId("sidebar-brand").querySelector("button")).toBeNull();
  });

  it("keeps the 40px logo in both states", () => {
    const { container, unmount } = wrap(<SidebarBrand rail={false} />);
    expect(container.querySelector("img")?.className).toContain("h-10 w-10");
    unmount();
    wrap(<SidebarBrand rail />);
    expect(screen.getByTestId("sidebar-logo-collapsed").className).toContain("h-10 w-10");
  });
});

describe("Sidebar brand across the fold", () => {
  it("keeps the same nodes mounted and fades the text instead of removing it", () => {
    const { rerender } = wrap(<SidebarBrand rail={false} />);
    const link = screen.getByTestId("sidebar-brand");
    const name = screen.getByTestId("sidebar-org-name");
    rerender(<TooltipProvider><SidebarBrand rail /></TooltipProvider>);
    expect(screen.getByTestId("sidebar-brand")).toBe(link);
    expect(screen.getByTestId("sidebar-org-name")).toBe(name);
    expect(name.parentElement?.className).toContain("opacity-0");
    expect(name.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(link).toHaveAttribute("aria-label", "Go to dashboard");
  });
});

describe("Sidebar edge toggle", () => {
  it("labels the action for each state and calls back", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<SidebarEdgeToggle rail={false} onToggle={onToggle} />);
    const btn = screen.getByTestId("sidebar-edge-toggle");
    expect(btn).toHaveAttribute("aria-label", "Collapse sidebar (Ctrl+B)");
    expect(btn).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<SidebarEdgeToggle rail onToggle={onToggle} />);
    expect(screen.getByTestId("sidebar-edge-toggle")).toHaveAttribute("aria-label", "Expand sidebar (Ctrl+B)");
    expect(screen.getByTestId("sidebar-edge-toggle")).toHaveAttribute("aria-expanded", "false");
  });
});
