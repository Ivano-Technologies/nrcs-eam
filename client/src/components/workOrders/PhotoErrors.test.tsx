import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PHOTOS_LOAD_ERROR, PHOTO_UPLOAD_ERROR, PhotoUploadError, PhotosLoadError } from "./PhotoErrors";

afterEach(() => cleanup());

describe("work order photo errors (IVA-176)", () => {
  it("uses Coco's copy", () => {
    expect(PHOTO_UPLOAD_ERROR).toBe("Couldn't upload photo. Try again, or contact your admin if it keeps happening.");
    expect(PHOTOS_LOAD_ERROR).toBe("Couldn't load photos");
  });

  it("upload error shows the friendly message and retries", async () => {
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
