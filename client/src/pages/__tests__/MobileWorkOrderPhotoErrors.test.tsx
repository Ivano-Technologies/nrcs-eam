import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Layout and toast rules for the upload error (Coco, IVA-176), checked on the page source. */
const src = readFileSync(resolve(process.cwd(), "client/src/pages/MobileWorkOrderDetail.tsx"), "utf8");

describe("MobileWorkOrderDetail upload error placement (IVA-176)", () => {
  it("puts the inline error after Choose from gallery and before Mark complete", () => {
    const gallery = src.indexOf("Choose from gallery");
    const slot = src.indexOf('data-testid="photo-upload-error-slot"', gallery);
    const complete = src.indexOf("Mark complete", gallery);
    const take = src.indexOf("Take photo");
    expect(take).toBeGreaterThan(-1);
    expect(src.slice(take, gallery)).not.toContain("PhotoUploadError");
    expect(slot).toBeGreaterThan(gallery);
    expect(slot).toBeLessThan(complete);
  });

  it("never offers an upload action from a toast (no double upload)", () => {
    expect(src).not.toMatch(/label:\s*"Retry"/);
    expect(src).toMatch(/isElementInViewport\(/);
  });
});
