import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PHOTOS_LOAD_ERROR, PHOTO_UPLOAD_ERROR, PhotoUploadError, PhotosLoadError, isElementInViewport } from "./PhotoErrors";

afterEach(() => cleanup());

function elAt(top: number, height = 40): Element {
  const el = document.createElement("div");
  el.getBoundingClientRect = () => ({ top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top, toJSON: () => ({}) });
  return el;
}

describe("work order photo errors (IVA-176)", () => {
  it("uses Coco's copy", () => {
    expect(PHOTO_UPLOAD_ERROR).toBe("Couldn't upload photo. Try again, or contact your admin if it keeps happening.");
    expect(PHOTOS_LOAD_ERROR).toBe("Couldn't load photos");
  });

  it("upload error shows the friendly message and retries once per click", async () => {
    const onRetry = vi.fn();
    render(<PhotoUploadError onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(PHOTO_UPLOAD_ERROR);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("upload Retry can be disabled (offline)", () => {
    render(<PhotoUploadError onRetry={() => {}} disabled />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  });

  it("list load failure says so instead of showing the empty state", async () => {
    const onRetry = vi.fn();
    render(<PhotosLoadError onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(PHOTOS_LOAD_ERROR);
    expect(screen.queryByText(/No photos attached yet/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("isElementInViewport (toast only when the inline alert is off-screen)", () => {
  it("is true for an element in view, false above, below or missing", () => {
    window.innerHeight = 800;
    expect(isElementInViewport(elAt(300))).toBe(true);
    expect(isElementInViewport(elAt(780))).toBe(true); // partly visible
    expect(isElementInViewport(elAt(900))).toBe(false);
    expect(isElementInViewport(elAt(-100))).toBe(false);
    expect(isElementInViewport(null)).toBe(false);
  });
});
