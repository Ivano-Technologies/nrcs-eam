#!/usr/bin/env node
/**
 * IVA-154 guard: no raw hex colours in client/src. Use the design tokens in client/src/index.css
 * (Tailwind classes such as bg-surface or text-muted-foreground, or var(--token) in inline styles and SVG).
 *
 * Allowlist (literal colours are required there):
 * - client/src/index.css: the token definitions themselves
 * - client/src/components/QRLabel.tsx: printed QR label (print window inline styles)
 * - client/src/lib/assetMap/tokens.ts, client/src/lib/facilityMapHelpers.ts: map palette for Google Maps
 *   polylines, pin canvases and SVG glyphs, which need literal colours and an explicit scheme
 * Tests and comments are ignored.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
const SRC = join(ROOT, "client/src");
const ALLOW = new Set([
  "client/src/index.css",
  "client/src/components/QRLabel.tsx",
  "client/src/lib/assetMap/tokens.ts",
  "client/src/lib/facilityMapHelpers.ts",
]);
const HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?|css)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

/** Blank out comments but keep line numbers. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, (m, pre) => pre + " ".repeat(m.length - pre.length));
}

const problems = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (ALLOW.has(rel)) continue;
  const lines = stripComments(readFileSync(file, "utf8")).split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(HEX)) problems.push(`${rel}:${i + 1}: ${m[0]}`);
  });
}

if (problems.length) {
  console.error(`verify-no-raw-hex: ${problems.length} raw hex colour(s) found. Use a token from client/src/index.css instead:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log("verify-no-raw-hex: OK");
