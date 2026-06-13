#!/usr/bin/env node
/**
 * NRCS EAM — Blue/Green Swap Automation
 *
 * Changes the GitHub repository default branch (main ↔ blue). Vercel automatically
 * treats the GitHub default branch as the production branch, so all production domains
 * (nrcseam.techivano.com, www, eam.redcrossnigeria.org) pick up the new branch without
 * any domain-level API calls.
 *
 * Usage: node scripts/swap.mjs   OR   pnpm swap
 *
 * Required env vars (in .env or shell):
 *   GITHUB_TOKEN  — GitHub personal access token with repo scope
 *
 * Optional env vars:
 *   VERCEL_TOKEN       — Vercel personal access token (state display only)
 *   VERCEL_PROJECT_ID  — defaults to the NRCS EAM project ID
 *   VERCEL_TEAM_ID     — defaults to the Ivano Technologies team ID
 */

import { createInterface } from "readline";
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Load .env from repo root (best-effort; shell env always wins)
try {
  const envPath = resolve(ROOT, ".env");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {
  // .env not present — rely on shell environment
}

const GITHUB_TOKEN    = process.env.GITHUB_TOKEN;
const VERCEL_TOKEN    = process.env.VERCEL_TOKEN;   // optional
const PROJECT_ID      = process.env.VERCEL_PROJECT_ID ?? "prj_r2m3v9oahEjGdTNiztkVEPE2R6Nn";
const TEAM_ID         = process.env.VERCEL_TEAM_ID  ?? "team_ynjdsXvq1g0haS8lVNnyjIZj";
const GITHUB_REPO     = "Ivano-Technologies/nrcs-eam";

if (!GITHUB_TOKEN) {
  console.error("❌  GITHUB_TOKEN is not set. Add it to .env or export it in your shell.");
  console.error("    Create a token at: https://github.com/settings/tokens");
  console.error("    Required scope: repo");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROD_DOMAIN    = "nrcseam.techivano.com";
const STAGING_DOMAIN = "blue.nrcseam.techivano.com";
const GH_API         = "https://api.github.com";
const VERCEL_API     = "https://api.vercel.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ghHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "User-Agent":  "nrcs-eam-swap",
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghGet(path) {
  const res  = await fetch(`${GH_API}${path}`, { headers: ghHeaders() });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}: ${body?.message ?? JSON.stringify(body)}`);
  }
  return body;
}

async function ghPatch(path, payload) {
  const res  = await fetch(`${GH_API}${path}`, {
    method: "PATCH",
    headers: ghHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`PATCH ${path} → ${res.status}: ${body?.message ?? JSON.stringify(body)}`);
  }
  return body;
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => {
    rl.question(question, answer => { rl.close(); res(answer.trim()); });
  });
}

async function httpStatus(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.status;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 1 — Detect current state
// ---------------------------------------------------------------------------

console.log("\n🔍  Reading current GitHub default branch…\n");

let repo;
try {
  repo = await ghGet(`/repos/${GITHUB_REPO}`);
} catch (err) {
  console.error(`❌  Failed to read GitHub repo: ${err.message}`);
  process.exit(1);
}

const prodBranch    = repo.default_branch;           // current production branch
const newProdBranch = prodBranch === "main" ? "blue" : "main";

console.log("Current state detected:");
console.log(`  🟢 Production: ${PROD_DOMAIN} → ${prodBranch}  (GitHub default branch)`);
console.log(`  🔵 Staging:    ${STAGING_DOMAIN} → blue  (permanent)`);
console.log("");
console.log("Swap will result in:");
console.log(`  🟢 Production: ${PROD_DOMAIN} → ${newProdBranch}`);
console.log(`  🔵 Staging:    ${STAGING_DOMAIN} → blue  (unchanged)`);
console.log("");

// ---------------------------------------------------------------------------
// Step 2 — Confirmation
// ---------------------------------------------------------------------------

const answer = await confirm("Proceed with swap? (yes/no): ");
if (answer !== "yes") {
  console.log("\nSwap cancelled.");
  process.exit(0);
}

console.log("");

// ---------------------------------------------------------------------------
// Step 3 — Change GitHub default branch
// ---------------------------------------------------------------------------

console.log(`  Updating GitHub default branch to '${newProdBranch}'…`);
try {
  await ghPatch(`/repos/${GITHUB_REPO}`, { default_branch: newProdBranch });
  console.log(`  ✓ GitHub default branch → ${newProdBranch}`);
  console.log("    Vercel will detect this change and promote the new branch to production.");
} catch (err) {
  console.error(`\n  ❌ Failed to update GitHub default branch: ${err.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 4 — Verify
// ---------------------------------------------------------------------------

console.log("\n⏳  Waiting 5 seconds for Vercel to pick up the change…");
console.log("    (Full redeployment may take up to 60 seconds.)");
await new Promise(r => setTimeout(r, 5000));

console.log("\nVerification (HTTP HEAD checks):");
for (const url of [`https://${PROD_DOMAIN}`, `https://${STAGING_DOMAIN}`]) {
  const status = await httpStatus(url);
  if (status === 200) {
    console.log(`  ${url} → ${status} ✓`);
  } else {
    console.warn(`  ${url} → ${status ?? "unreachable"} ⚠  (Vercel redeployment may still be in progress)`);
  }
}

// ---------------------------------------------------------------------------
// Step 5 — Update DEPLOYMENT.md and commit
// ---------------------------------------------------------------------------

console.log("");

const deploymentPath = resolve(ROOT, "DEPLOYMENT.md");
let deploymentMd;
try {
  deploymentMd = readFileSync(deploymentPath, "utf8");
} catch (err) {
  console.warn(`  ⚠  Could not read DEPLOYMENT.md: ${err.message} — skipping file update`);
  deploymentMd = null;
}

if (deploymentMd !== null) {
  const tableRegex = /\| Branch \| URL \| Role \|[\s\S]*?(?=\n\*\*Update this table|\n---|\n##)/;
  const newTable =
    `| Branch | URL | Role |\n` +
    `|--------|-----|------|\n` +
    `| \`${newProdBranch}\` | \`${PROD_DOMAIN}\` | 🟢 Production |\n` +
    `| \`blue\` | \`${STAGING_DOMAIN}\` | 🔵 Staging |`;

  if (!tableRegex.test(deploymentMd)) {
    console.warn("  ⚠  Could not locate Current state table in DEPLOYMENT.md — skipping file update");
  } else {
    writeFileSync(deploymentPath, deploymentMd.replace(tableRegex, newTable), "utf8");
    try {
      let currentGitBranch = "main";
      try {
        currentGitBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT }).toString().trim();
      } catch { /* fall through */ }

      execSync("git add DEPLOYMENT.md", { cwd: ROOT });
      execSync(`git commit -m "ops: blue/green swap — ${newProdBranch} is now production"`, { cwd: ROOT });
      execSync(`git push origin ${currentGitBranch}`, { cwd: ROOT, stdio: "inherit" });
      console.log("  ✓ DEPLOYMENT.md updated and pushed");
    } catch (gitErr) {
      console.warn(`  ⚠  DEPLOYMENT.md written but git commit/push failed: ${gitErr.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Final output
// ---------------------------------------------------------------------------

console.log(`
✅  Swap complete.
    Production: ${PROD_DOMAIN} → ${newProdBranch}
    Staging:    ${STAGING_DOMAIN} → blue (permanent)

ℹ  blue.nrcseam.techivano.com always serves the 'blue' branch.
   After this swap, begin new feature work on '${prodBranch}' to diverge staging from production.
`);
