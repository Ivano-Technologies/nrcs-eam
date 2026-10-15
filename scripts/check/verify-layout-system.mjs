#!/usr/bin/env node
/**
 * Layout system guard (IVA-148, layout audit D2). Fails CI on:
 *   1. rebuilt header rows: a PageHeader with className="mb-0", or a PageHeader placed inside a custom
 *      flex row (use PageHeader `actions` instead);
 *   2. card grids with gap-3 (card and stat tile grids use gap-4);
 *   3. radius values outside the allowed set: rounded-xl (surfaces), rounded-md (controls, inner tiles),
 *      rounded-full (pills), plus rounded-none. Side and corner forms (rounded-t-xl) follow the same set.
 * Scope: client/src app code. shadcn primitives in components/ui and tests are skipped.
 * Usage: node scripts/check/verify-layout-system.mjs [files...]   (no args = scan client/src)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "client", "src");
const ALLOWED_RADIUS = new Set(["xl", "md", "full", "none"]);
const SIDES = "(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee)";
// rounded, rounded-lg, rounded-t, rounded-t-lg, rounded-[10px] ... inside class strings
const RADIUS_RE = new RegExp(`(?<![\\w:-])(?:[\\w-]+:)*rounded(?:-${SIDES})?(?:-([\\w\\[\\]./]+))?(?![\\w\\[-])`, "g");
const CARD_CHILD_RE = /<(Card|StatLink|StatTile|KpiCard|[A-Z]\w*Card)\b/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

function skip(file) {
  const rel = relative(SRC, file).split(sep).join("/");
  return rel.startsWith("components/ui/") || /\.test\.tsx$/.test(rel) || rel.includes("__tests__/");
}

/** Class strings only: "..." / '...' / `...` literals, so prose and identifiers are not matched. */
function classLiterals(line) {
  return line.match(/"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g) ?? [];
}

export function checkSource(src, file = "<input>") {
  const problems = [];
  const lines = src.split("\n");

  // 1. Header rows
  const headerTagRe = /<PageHeader\b[\s\S]*?\/>/g;
  for (const m of src.matchAll(headerTagRe)) {
    const line = src.slice(0, m.index).split("\n").length;
    if (/className="[^"]*\bmb-0\b/.test(m[0])) {
      problems.push({ file, line, rule: "header-row", msg: 'PageHeader with className="mb-0": use PageHeader actions, not a custom header row' });
    }
    const before = src.slice(Math.max(0, m.index - 400), m.index);
    if (/<div className="[^"]*\bflex\b[^"]*">\s*(?:<div(?: [^>]*)?>\s*)?$/.test(before)) {
      problems.push({ file, line, rule: "header-row", msg: "PageHeader inside a custom flex row: pass the buttons to PageHeader actions" });
    }
  }

  lines.forEach((text, i) => {
    // 2. Card grids with gap-3
    if (/className="[^"]*\bgrid\b[^"]*\bgap-3\b/.test(text)) {
      const next = lines.slice(i + 1, i + 5).join("\n");
      if (CARD_CHILD_RE.test(next)) {
        problems.push({ file, line: i + 1, rule: "card-grid-gap", msg: "card grid uses gap-3: use gap-4" });
      }
    }
    // 3. Radius
    for (const lit of classLiterals(text)) {
      for (const r of lit.matchAll(RADIUS_RE)) {
        const size = r[1];
        if (size === undefined || !ALLOWED_RADIUS.has(size)) {
          problems.push({
            file,
            line: i + 1,
            rule: "radius",
            msg: `${r[0]} is outside the radius set (rounded-xl surfaces, rounded-md controls and tiles, rounded-full pills)`,
          });
        }
      }
    }
  });
  return problems;
}

function main() {
  const args = process.argv.slice(2);
  const files = (args.length ? args.map((a) => join(ROOT, a)) : walk(SRC)).filter((f) => !skip(f));
  const problems = files.flatMap((f) => checkSource(readFileSync(f, "utf8"), relative(ROOT, f)));
  if (problems.length) {
    for (const p of problems) console.error(`${p.file}:${p.line}  [${p.rule}]  ${p.msg}`);
    console.error(`\nverify-layout-system: ${problems.length} problem(s). See the layout audit D2 table.`);
    process.exit(1);
  }
  console.log(`verify-layout-system: OK (${files.length} files)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
