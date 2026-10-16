import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(() => cleanup());

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
import { CircleOff } from "lucide-react";
import { BulkBarAction } from "./BulkBarAction";
import { BulkActionsToolbar } from "./BulkActionsToolbar";

describe("BulkBarAction", () => {
  it("is labelled for screen readers and hides the visible label below md", () => {
    render(<BulkBarAction icon={CircleOff} label="Mark inactive" onClick={() => {}} />);
    const btn = screen.getByRole("button", { name: "Mark inactive" });
    expect(btn).toHaveAttribute("title", "Mark inactive");
    expect(screen.getByText("Mark inactive")).toHaveClass("max-md:sr-only");
  });

  it("fires on tap but not after a touch long press", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(<BulkBarAction icon={CircleOff} label="Mark inactive" onClick={onClick} />);
    const btn = screen.getByRole("button", { name: "Mark inactive" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(btn, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(btn, { pointerType: "touch" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("BulkActionsToolbar delete label", () => {
  it("keeps Delete labelled and Export icon only below md", () => {
    render(<BulkActionsToolbar selectedCount={2} onClearSelection={() => {}} onExport={() => {}} onDelete={() => {}} />);
    expect(screen.getByTestId("bulk-actions-delete")).toHaveTextContent("Delete");
    expect(screen.getByTestId("bulk-actions-delete").querySelector(".max-md\\:sr-only")).toBeNull();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });
});
