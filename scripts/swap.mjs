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

/** Change the project-level production branch (affects all Production-environment domains). */
async function setProductionBranch(branch) {
  const url = `${API_BASE}/v9/projects/${PROJECT_ID}?${qs({ teamId: TEAM_ID })}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productionBranch: branch }),
  });
  const body = await res.json();
  if (!res.ok) {
    // Print full body so we can diagnose any future shape mismatches
    console.error("    Vercel response:", JSON.stringify(body, null, 2));
    throw new Error(`PATCH /v9/projects → ${res.status}: ${body?.error?.message ?? JSON.stringify(body)}`);
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

// Vercel's domain model has two tiers:
//   • Production domains (nrcseam.techivano.com, www, nrcs-eam.vercel.app …) are bound to the
//     project-level Production environment — they have no gitBranch field. The production branch
//     is a project setting (link.productionBranch).
//   • Preview/branch domains (blue.nrcseam.techivano.com) have an explicit gitBranch field.
//
// The swap therefore requires:
//   1. PATCH the project to change its production branch.
//   2. PATCH blue.nrcseam.techivano.com to update its gitBranch.

console.log("\n🔍  Fetching project settings from Vercel…\n");

let project;
try {
  project = await vercelGet(`/v9/projects/${PROJECT_ID}`);
} catch (err) {
  console.error(`❌  Failed to fetch project: ${err.message}`);
  process.exit(1);
}

// Read the production branch — Vercel returns it in link.productionBranch
const prodBranch =
  project?.link?.productionBranch ??
  project?.targets?.production?.branch ??
  null;

if (!prodBranch) {
  console.error("❌  Could not read productionBranch from project settings.");
  console.error("    Raw project.link:", JSON.stringify(project?.link ?? {}, null, 2));
  process.exit(1);
}

// Read the staging branch from the blue preview domain's gitBranch field
let domainsData;
try {
  domainsData = await vercelGet(`/v9/projects/${PROJECT_ID}/domains`);
} catch (err) {
  console.error(`❌  Failed to fetch domains: ${err.message}`);
  process.exit(1);
}

const domains = domainsData.domains ?? [];
const stagingDomainEntry = domains.find(d => d.name === STAGING_DOMAIN);
const stagingBranch = stagingDomainEntry?.gitBranch ?? null;

if (!stagingBranch) {
  console.error(`❌  Could not read gitBranch from ${STAGING_DOMAIN}.`);
  console.error("    Domains found on this project:");
  for (const d of domains) {
    console.error(`      ${d.name} → ${d.gitBranch ?? "(Production environment — no gitBranch)"}`);
  }
  process.exit(1);
}

const newProdBranch = stagingBranch;
const newStagingBranch = prodBranch;

console.log("Current state detected:");
console.log(`  🟢 Production: ${PROD_DOMAIN} → ${prodBranch}  (+ all Production-env domains)`);
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
//
// Two separate operations map to Vercel's domain model:
//   Op A — change the project-level production branch (moves ALL Production-env domains at once)
//   Op B — update blue.nrcseam.techivano.com's gitBranch (the Preview branch domain)

let opADone = false;

// Op A — set production branch
try {
  await setProductionBranch(newProdBranch);
  opADone = true;
  console.log(`  ✓ Production branch → ${newProdBranch}  (${PROD_DOMAIN} + all Production-env domains)`);
} catch (err) {
  console.error(`\n  ❌ Failed to update production branch: ${err.message}`);
  process.exit(1);
}

// Op B — update the blue preview domain's gitBranch
try {
  await vercelPatch(
    `/v9/projects/${PROJECT_ID}/domains/${STAGING_DOMAIN}`,
    { gitBranch: newStagingBranch }
  );
  console.log(`  ✓ ${STAGING_DOMAIN} → ${newStagingBranch}`);
} catch (err) {
  console.error(`\n  ❌ Failed to update ${STAGING_DOMAIN}: ${err.message}`);

  if (opADone) {
    console.log("\n  ⏪ Rolling back production branch to original value…");
    try {
      await setProductionBranch(prodBranch);
      console.log(`  ↩ Production branch → ${prodBranch} (restored)`);
    } catch (rollbackErr) {
      console.error(`  ❌ Rollback failed: ${rollbackErr.message}`);
      console.error(`     Manual fix: set production branch back to '${prodBranch}' in Vercel dashboard`);
    }
  }

  process.exit(1);
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
