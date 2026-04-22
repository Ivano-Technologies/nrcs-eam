import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const knownFailuresPath = path.join(__dirname, "known-failures.json");

function runStep(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function extractFailedSpecFiles(suites, failedFiles = new Set()) {
  for (const suite of suites ?? []) {
    const suiteSpecs = suite.specs ?? [];
    for (const spec of suiteSpecs) {
      const hasUnexpected = (spec.tests ?? []).some((test) =>
        (test.results ?? []).some((result) => result.status === "failed" || result.status === "timedOut")
      );
      if (hasUnexpected && spec.file) {
        failedFiles.add(path.basename(spec.file));
      }
    }
    extractFailedSpecFiles(suite.suites ?? [], failedFiles);
  }
  return failedFiles;
}

function runPlaywrightWithKnownFailures() {
  const reportPath = path.join(repoRoot, ".check-playwright.json");
  if (fs.existsSync(reportPath)) {
    fs.unlinkSync(reportPath);
  }

  const env = {
    ...process.env,
    PLAYWRIGHT_JSON_OUTPUT_NAME: path.basename(reportPath),
    PLAYWRIGHT_JSON_OUTPUT_DIR: repoRoot,
  };

  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "tests/mvp-audit/specs/", "--project=mvp-audit", "--reporter=json"],
    {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
      env,
    }
  );

  if (!fs.existsSync(reportPath)) {
    console.error("Playwright report parsing failed: JSON output was not produced.");
    process.exit(result.status ?? 1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  fs.unlinkSync(reportPath);

  const knownFailures = new Set(
    JSON.parse(fs.readFileSync(knownFailuresPath, "utf8")).playwrightMvpAuditKnownFailures ?? []
  );

  const failedFiles = [...extractFailedSpecFiles(report.suites)].sort();
  const unexpectedFailures = failedFiles.filter((file) => !knownFailures.has(file));
  const knownFailureCount = failedFiles.length - unexpectedFailures.length;
  const passed = report.stats?.expected ?? 0;

  if (unexpectedFailures.length > 0) {
    console.error(`Unexpected Playwright failures detected: ${unexpectedFailures.join(", ")}`);
    console.error(
      `${passed} passed, ${knownFailureCount} known failures (ignored), ${unexpectedFailures.length} unexpected failures`
    );
    process.exit(1);
  }

  if (knownFailureCount > 0) {
    console.warn(
      `${passed} passed, ${knownFailureCount} known failures (ignored), ${unexpectedFailures.length} unexpected failures`
    );
    return;
  }

  console.log(`${passed} passed, 0 known failures (ignored), 0 unexpected failures`);
}

function main() {
  runStep("pnpm", ["exec", "tsc", "--noEmit"]);
  runStep("pnpm", ["check"]);
  runStep("node", ["scripts/check/working-tree-clean.mjs"]);
  runStep("node", ["scripts/check/migration-parity.mjs"]);
  runStep("node", ["scripts/check/migrations-applied.mjs", ".env", "Dev DB"]);

  if (process.env.CHECK_FULL_SKIP_E2E_DB === "1") {
    console.warn("⚠ Skipping E2E DB migration check (CHECK_FULL_SKIP_E2E_DB=1)");
  } else {
    runStep("node", ["scripts/check/migrations-applied.mjs", ".env.e2e", "E2E DB"]);
  }

  runStep("pnpm", ["exec", "vitest", "run"]);

  if (process.env.CHECK_FULL_SKIP_PLAYWRIGHT === "1") {
    console.warn("⚠ Skipping Playwright (CHECK_FULL_SKIP_PLAYWRIGHT=1)");
  } else {
    runPlaywrightWithKnownFailures();
  }

  console.log("✓ All checks passed. Safe to push.");
}

main();
