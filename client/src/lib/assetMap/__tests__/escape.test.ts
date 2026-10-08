import { describe, expect, it } from "vitest";
import { escapeHtml } from "../escape";
import { buildLabelContent } from "../pinContent";

const NASTY = `<img src=x onerror="alert(1)">Kano & "Co"`;

describe("Asset Map text safety", () => {
  it("escapeHtml escapes every HTML significant character", () => {
    expect(escapeHtml(NASTY)).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;Kano &amp; &quot;Co&quot;");
    expect(escapeHtml(null)).toBe("");
  });

  it("map labels render facility names as text, never HTML", () => {
    const el = buildLabelContent(NASTY, "82% Good", "good", "light", 10);
    expect(el.querySelector("img")).toBeNull();
    expect(el.textContent).toContain(NASTY);
  });
});
