/**
 * Regression guard: entry module graph must not pull recharts / posthog / supabase,
 * and the entry + static imports must stay under 900 KB raw.
 *
 * Usage: pnpm build:frontend && node scripts/check/verify-entry-graph.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const distPublic = path.join(repoRoot, "dist", "public");
const indexHtmlPath = path.join(distPublic, "index.html");

const FORBIDDEN = ["recharts", "posthog", "supabase"];
const MAX_RAW_BYTES = 900 * 1024;

function fail(message) {
  console.error(`[verify-entry-graph] ${message}`);
  process.exit(1);
}

function collectStaticImports(chunkPath, seen = new Set()) {
  const abs = path.resolve(chunkPath);
  if (seen.has(abs)) return seen;
  seen.add(abs);

  const source = fs.readFileSync(abs, "utf8");
  const importRe = /from\s*["'](\.\/[^"']+)["']/g;
  let match;
  while ((match = importRe.exec(source)) !== null) {
    const rel = match[1];
    const target = path.resolve(path.dirname(abs), rel);
    if (fs.existsSync(target) && target.endsWith(".js")) {
      collectStaticImports(target, seen);
    }
  }
  return seen;
}

function main() {
  if (!fs.existsSync(indexHtmlPath)) {
    fail(`Missing ${indexHtmlPath}. Run pnpm build:frontend first.`);
  }

  const html = fs.readFileSync(indexHtmlPath, "utf8");
  const preloadHrefs = [...html.matchAll(/<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/gi)].map(
    (m) => m[1]
  );
  const scriptSrc =
    html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i)?.[1] ??
    html.match(/<script[^>]+src=["']([^"']+)["'][^>]+type=["']module["']/i)?.[1];

  if (!scriptSrc) {
    fail("Could not find entry <script type=\"module\"> in index.html");
  }

  const entryRel = scriptSrc.replace(/^\//, "");
  const entryAbs = path.join(distPublic, entryRel);
  if (!fs.existsSync(entryAbs)) {
    fail(`Entry chunk missing: ${entryAbs}`);
  }

  const graphUrls = [scriptSrc, ...preloadHrefs];
  for (const url of graphUrls) {
    const base = path.basename(url).toLowerCase();
    for (const needle of FORBIDDEN) {
      if (base.includes(needle)) {
        fail(`Forbidden vendor in entry graph URL: ${url} (matched "${needle}")`);
      }
    }
  }

  const graphFiles = collectStaticImports(entryAbs);
  let rawTotal = 0;
  const rows = [];

  for (const file of graphFiles) {
    const base = path.basename(file).toLowerCase();
    for (const needle of FORBIDDEN) {
      if (base.includes(needle)) {
        fail(`Forbidden vendor statically imported by entry: ${path.relative(distPublic, file)}`);
      }
    }
    const buf = fs.readFileSync(file);
    const gzipLen = zlib.gzipSync(buf, { level: 9 }).length;
    rawTotal += buf.length;
    rows.push({
      file: path.relative(distPublic, file).replace(/\\/g, "/"),
      raw: buf.length,
      gzip: gzipLen,
    });
  }

  // Include main CSS linked from index.html in the gzip budget report (success criteria).
  const cssHrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)].map(
    (m) => m[1]
  );
  let cssGzip = 0;
  let cssRaw = 0;
  for (const href of cssHrefs) {
    const abs = path.join(distPublic, href.replace(/^\//, ""));
    if (!fs.existsSync(abs)) continue;
    const buf = fs.readFileSync(abs);
    cssRaw += buf.length;
    cssGzip += zlib.gzipSync(buf, { level: 9 }).length;
    rows.push({
      file: path.relative(distPublic, abs).replace(/\\/g, "/"),
      raw: buf.length,
      gzip: zlib.gzipSync(buf, { level: 9 }).length,
    });
  }

  if (rawTotal > MAX_RAW_BYTES) {
    fail(
      `Entry + static imports raw size ${(rawTotal / 1024).toFixed(1)} KB exceeds ${(MAX_RAW_BYTES / 1024).toFixed(0)} KB limit`
    );
  }

  const jsGzip = rows
    .filter((r) => r.file.endsWith(".js"))
    .reduce((sum, r) => sum + r.gzip, 0);
  const totalGzip = jsGzip + cssGzip;

  rows.sort((a, b) => b.raw - a.raw);
  console.log("[verify-entry-graph] Entry graph (JS static + CSS):");
  for (const row of rows) {
    console.log(
      `  ${row.file.padEnd(42)} raw=${(row.raw / 1024).toFixed(1).padStart(7)} KB  gzip=${(row.gzip / 1024).toFixed(1).padStart(6)} KB`
    );
  }
  console.log(
    `[verify-entry-graph] Totals: JS raw=${(rawTotal / 1024).toFixed(1)} KB (limit ${(MAX_RAW_BYTES / 1024).toFixed(0)} KB), ` +
      `JS+CSS gzip=${(totalGzip / 1024).toFixed(1)} KB (css raw=${(cssRaw / 1024).toFixed(1)} KB)`
  );
  console.log("[verify-entry-graph] OK");
}

main();
