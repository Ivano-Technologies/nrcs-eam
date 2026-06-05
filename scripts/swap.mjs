#!/usr/bin/env node
/**
 * NRCS EAM — Blue/Green Swap Automation
 *
 * Swaps domain assignments between main (production) and blue (staging) branches
 * using the Vercel REST API. Updates DEPLOYMENT.md and commits the change.
 *
 * Usage: node scripts/swap.mjs   OR   pnpm swap
 *
 * Required env vars (in .env or shell):
 *   VERCEL_TOKEN       — Vercel personal access token
 *   VERCEL_PROJECT_ID  — Vercel project ID
 *   VERCEL_TEAM_ID     — Vercel team ID
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

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? "prj_r2m3v9oahEjGdTNiztkVEPE2R6Nn";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_ynjdsXvq1g0haS8lVNnyjIZj";

if (!VERCEL_TOKEN) {
  console.error("❌  VERCEL_TOKEN is not set. Add it to .env or export it in your shell.");
  console.error("    Create a token at: https://vercel.com/account/tokens");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROD_DOMAIN = "nrcseam.techivano.com";
const WWW_DOMAIN = "www.nrcseam.techivano.com";
const STAGING_DOMAIN = "blue.nrcseam.techivano.com";

const API_BASE = "https://api.vercel.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function qs(params) {
  return new URLSearchParams(params).toString();
}

async function vercelGet(path, params = {}) {
  const url = `${API_BASE}${path}?${qs({ teamId: TEAM_ID, ...params })}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}: ${body?.error?.message ?? JSON.stringify(body)}`);
  }
  return body;
}

async function vercelPatch(path, payload, params = {}) {
  const url = `${API_BASE}${path}?${qs({ teamId: TEAM_ID, ...params })}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`PATCH ${path} → ${res.status}: ${body?.error?.message ?? JSON.stringify(body)}`);
  }
  return body;
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
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

console.log("\n🔍  Fetching current domain assignments from Vercel…\n");

let domainsData;
try {
  domainsData = await vercelGet(`/v9/projects/${PROJECT_ID}/domains`);
} catch (err) {
  console.error(`❌  Failed to fetch domains: ${err.message}`);
  process.exit(1);
}

const domains = domainsData.domains ?? [];

function findBranch(name) {
  const entry = domains.find(d => d.name === name);
  return entry?.gitBranch ?? null;
}

const prodBranch = findBranch(PROD_DOMAIN);
const stagingBranch = findBranch(STAGING_DOMAIN);

if (!prodBranch || !stagingBranch) {
  console.error("❌  Could not determine branch assignments for one or both domains.");
  console.error(`    ${PROD_DOMAIN} → ${prodBranch ?? "(not found)"}`);
  console.error(`    ${STAGING_DOMAIN} → ${stagingBranch ?? "(not found)"}`);
  console.error("\n    Domains found on this project:");
  for (const d of domains) {
    console.error(`      ${d.name} → ${d.gitBranch ?? "(no branch)"}`);
  }
  process.exit(1);
}

const newProdBranch = stagingBranch;
const newStagingBranch = prodBranch;

console.log("Current state detected:");
console.log(`  🟢 Production: ${PROD_DOMAIN} → ${prodBranch}`);
console.log(`  🔵 Staging:    ${STAGING_DOMAIN} → ${stagingBranch}`);
console.log("");
console.log("Swap will result in:");
console.log(`  🟢 Production: ${PROD_DOMAIN} → ${newProdBranch}`);
console.log(`  🔵 Staging:    ${STAGING_DOMAIN} → ${newStagingBranch}`);
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
// Step 3 — Execute the swap
// ---------------------------------------------------------------------------

const swapPlan = [
  { domain: PROD_DOMAIN,    branch: newProdBranch },
  { domain: WWW_DOMAIN,     branch: newProdBranch },
  { domain: STAGING_DOMAIN, branch: newStagingBranch },
];

const completed = [];

for (const { domain, branch } of swapPlan) {
  try {
    await vercelPatch(
      `/v9/projects/${PROJECT_ID}/domains/${domain}`,
      { gitBranch: branch }
    );
    console.log(`  ✓ ${domain} → ${branch}`);
    completed.push({ domain, previousBranch: domain === STAGING_DOMAIN ? stagingBranch : prodBranch });
  } catch (err) {
    console.error(`\n  ❌ Failed to update ${domain}: ${err.message}`);

    if (completed.length > 0) {
      console.log("\n  ⏪ Rolling back completed assignments…");
      for (const { domain: d, previousBranch } of completed) {
        try {
          await vercelPatch(
            `/v9/projects/${PROJECT_ID}/domains/${d}`,
            { gitBranch: previousBranch }
          );
          console.log(`  ↩ ${d} → ${previousBranch} (restored)`);
        } catch (rollbackErr) {
          console.error(`  ❌ Rollback failed for ${d}: ${rollbackErr.message}`);
        }
      }
    }

    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Step 4 — Verify
// ---------------------------------------------------------------------------

console.log("\n⏳  Waiting 3 seconds for propagation…");
await new Promise(r => setTimeout(r, 3000));

console.log("\nVerification:");
const checkUrls = [
  `https://${PROD_DOMAIN}`,
  `https://${STAGING_DOMAIN}`,
];

for (const url of checkUrls) {
  const status = await httpStatus(url);
  if (status === 200) {
    console.log(`  ${url} → ${status} ✓`);
  } else {
    console.warn(`  ${url} → ${status ?? "unreachable"} ⚠  (DNS propagation may still be in progress)`);
  }
}

// ---------------------------------------------------------------------------
// Step 5 — Update DEPLOYMENT.md
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
  // Replace the Current state table (matches the | Branch | URL | Role | header row)
  const tableRegex = /\| Branch \| URL \| Role \|[\s\S]*?(?=\n\*\*Update this table|\n---|\n##)/;
  const newTable =
    `| Branch | URL | Role |\n` +
    `|--------|-----|------|\n` +
    `| \`${newProdBranch}\` | \`${PROD_DOMAIN}\` | 🟢 Production |\n` +
    `| \`${newStagingBranch}\` | \`${STAGING_DOMAIN}\` | 🔵 Staging |`;

  if (!tableRegex.test(deploymentMd)) {
    console.warn("  ⚠  Could not locate the Current state table in DEPLOYMENT.md — skipping file update");
  } else {
    const updated = deploymentMd.replace(tableRegex, newTable);
    writeFileSync(deploymentPath, updated, "utf8");

    try {
      let currentGitBranch = "main";
      try {
        currentGitBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT })
          .toString()
          .trim();
      } catch { /* fall through */ }

      execSync("git add DEPLOYMENT.md", { cwd: ROOT });
      execSync(
        `git commit -m "ops: blue/green swap — ${newProdBranch} is now production"`,
        { cwd: ROOT }
      );
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
    Staging:    ${STAGING_DOMAIN} → ${newStagingBranch}
`);
