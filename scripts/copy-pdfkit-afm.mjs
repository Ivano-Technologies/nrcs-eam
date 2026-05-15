/**
 * Copy pdfkit standard-font AFM metrics next to the Vercel tRPC bundle.
 * Bundled pdfkit resolves fonts via __dirname + '/data/*.afm' → api/trpc/data/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "pdfkit", "js", "data");
const dest = path.join(root, "api", "trpc", "data");

if (!fs.existsSync(src)) {
  console.error(`[copy-pdfkit-afm] Missing source: ${src}`);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`[copy-pdfkit-afm] Copied ${fs.readdirSync(dest).length} files to ${dest}`);
