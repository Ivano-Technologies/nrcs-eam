import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import PhotoUploadZone from "../PhotoUploadZone";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

beforeAll(() => {
  if (!URL.createObjectURL) Object.defineProperty(URL, "createObjectURL", { value: () => "blob:x", writable: true });
  if (!URL.revokeObjectURL) Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, writable: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function uploadWith(onUpload: () => Promise<void>) {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { container } = render(<PhotoUploadZone onUpload={onUpload} />);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["x"], "site.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(await screen.findByRole("button", { name: /Upload 1 photo/ }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  const [message, options] = vi.mocked(toast.error).mock.calls[0] as [string, { description?: string }];
  expect(options?.description).toMatch(/^Ref: [A-Z0-9]{8}$/);
  return message;
}

describe("PhotoUploadZone friendly errors (IVA-189)", () => {
  it("shows a plain fallback instead of raw storage text", async () => {
    const msg = await uploadWith(() => Promise.reject(new Error("StorageApiError: Bucket not found (supabase)")));
    expect(msg).toBe("We couldn't upload site.png. Please try again.");
  });

  it("shows the network line when the request never reached the server", async () => {
    const msg = await uploadWith(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(msg).toBe("We couldn't reach the server. Check your connection and try again.");
  });
});
