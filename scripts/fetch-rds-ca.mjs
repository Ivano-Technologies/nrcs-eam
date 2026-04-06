/**
 * Ensures certs/global-bundle.pem exists (RDS TLS trust store).
 * Fetches from AWS if missing — safe to run on every build.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, "..", "certs", "global-bundle.pem");
const url =
  "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem";

if (fs.existsSync(target)) {
  const stat = fs.statSync(target);
  if (stat.size > 1000) {
    console.log("[fetch-rds-ca] Using existing bundle:", target);
    process.exit(0);
  }
}

const res = await fetch(url);
if (!res.ok) {
  throw new Error(`[fetch-rds-ca] Failed to download CA bundle: HTTP ${res.status}`);
}
const buf = Buffer.from(await res.arrayBuffer());
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, buf);
console.log("[fetch-rds-ca] Wrote RDS global CA bundle to", target);
