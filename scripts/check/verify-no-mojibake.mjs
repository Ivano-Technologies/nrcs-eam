/**
 * Regression guard: fail CI if double-encoded UTF-8 / Windows-1252 mojibake
 * appears in source under server/, client/src/, shared/, or api/.
 *
 * Catches sequences introduced when UTF-8 was misread as Latin-1/CP1252 and
 * re-saved (e.g. "—" → "â€”", "·" → "Â·", multi-pass "Ã¢â‚¬â€").
 *
 * Usage: node scripts/check/verify-no-mojibake.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

const SCAN_ROOTS = ["server", "client/src", "shared", "api"];

/**
 * Signature patterns for double-encoded UTF-8 / CP1252 mojibake.
 * Intentional Unicode (· U+00B7, — U+2014, “ ”) is NOT matched.
 */
const SIGNATURES = [
  { id: "Â·", re: /\u00C2\u00B7/g },
  { id: "Ãƒ", re: /\u00C3\u0083/g },
  { id: "Ã¢â‚¬", re: /\u00C3\u00A2\u00E2\u0082\u00AC/g },
  { id: "â€”/â€œ family", re: /\u00E2\u20AC[\u201D\u201C\u0153\u009D\u2122]/g },
  { id: "â€ (generic)", re: /\u00E2\u20AC/g },
  { id: "Ã‚", re: /\u00C3\u0082/g },
];

function walkTsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".git") continue;
      walkTsFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function matchSequence(line) {
  for (const { id, re } of SIGNATURES) {
    re.lastIndex = 0;
    const m = re.exec(line);
    if (m) {
      return { id, matched: m[0] };
    }
  }
  return null;
}

function main() {
  const hits = [];

  for (const root of SCAN_ROOTS) {
    const absRoot = path.join(repoRoot, root);
    for (const file of walkTsFiles(absRoot)) {
      const text = fs.readFileSync(file, "utf8");
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        const hit = matchSequence(line);
        if (!hit) return;
        hits.push({
          file: path.relative(repoRoot, file).replace(/\\/g, "/"),
          line: i + 1,
          sequence: hit.id,
          matched: hit.matched,
          preview: line.trim().slice(0, 140),
        });
      });
    }
  }

  if (hits.length === 0) {
    console.log("[verify-no-mojibake] OK — no double-encoded UTF-8 signatures found");
    return;
  }

  console.error(`[verify-no-mojibake] Found ${hits.length} mojibake occurrence(s):\n`);
  for (const h of hits) {
    console.error(
      `  ${h.file}:${h.line}\n` +
        `    sequence: ${h.sequence}  matched: ${JSON.stringify(h.matched)}\n` +
        `    ${h.preview}`
    );
  }
  console.error(
    `\n[verify-no-mojibake] FAIL — replace with correct Unicode (e.g. · U+00B7, — U+2014).`
  );
  process.exit(1);
}

main();
