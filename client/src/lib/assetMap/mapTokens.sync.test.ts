import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAP_TOKENS } from "./tokens";

/** The JS map palette (needed by Google Maps and SVG pins) must match the --map-* CSS tokens. */
const css = readFileSync(join(__dirname, "../../index.css"), "utf8");
function block(selector: string) {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf("\n}\n", start));
}
function cssVar(selector: string, name: string) {
  const m = block(selector).match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m?.[1].trim().toUpperCase();
}
const PAIRS: Array<[keyof (typeof MAP_TOKENS)["light"], string]> = [
  ["surface", "map-surface"],
  ["pinStroke", "map-pin-stroke"],
  ["line", "map-line"],
  ["lineHi", "map-line-active"],
  ["halo", "map-halo"],
  ["text", "map-text"],
  ["muted", "map-muted"],
  ["border", "map-border"],
];

describe("map tokens stay in sync with index.css", () => {
  for (const [key, name] of PAIRS) {
    it(`${key} matches --${name}`, () => {
      expect(MAP_TOKENS.light[key].toUpperCase()).toBe(cssVar(":root", name));
      expect(MAP_TOKENS.dark[key].toUpperCase()).toBe(cssVar(".dark", name));
    });
  }
});
