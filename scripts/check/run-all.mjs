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

function extractFailedSpecsByProject(suites, failedByProject = new Map()) {
  for (const suite of suites ?? []) {
    const suiteSpecs = suite.specs ?? [];
    for (const spec of suiteSpecs) {
      const failingTest = (spec.tests ?? []).find((test) =>
        (test.results ?? []).some((result) => result.status === "failed" || result.status === "timedOut")
      );
      if (failingTest && spec.file) {
        const project = failingTest.projectName ?? "unknown";
        const files = failedByProject.get(project) ?? new Set();
        files.add(path.basename(spec.file));
        failedByProject.set(project, files);
      }
    }
    extractFailedSpecsByProject(suite.suites ?? [], failedByProject);
  }
  return failedByProject;
}

function knownFilesForProject(projectConfig) {
  if (!projectConfig) return new Set();
  if (Array.isArray(projectConfig)) return new Set(projectConfig);

  const files = new Set();
  const environmental = projectConfig.environmental ?? [];
  for (const file of environmental) {
    files.add(file);
  }

  const flakyPendingCleanup = projectConfig["flaky-pending-cleanup"] ?? [];
  for (const item of flakyPendingCleanup) {
    if (typeof item === "string") {
      files.add(item);
    } else if (item && typeof item.file === "string") {
      files.add(item.file);
    }
  }

  return files;
}

function runPlaywrightWithKnownFailures() {
  const reportPath = path.join(repoRoot, ".check-playwright.json");
  if (fs.existsSync(reportPath)) {
    fs.unlinkSync(reportPath);
  }

  const env = {
    ...process.env,
    CI: "true",
    PLAYWRIGHT_JSON_OUTPUT_NAME: path.basename(reportPath),
    PLAYWRIGHT_JSON_OUTPUT_DIR: repoRoot,
  };

  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "--project=mvp-audit", "--project=live-auth", "--reporter=json"],
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

  const topLevelErrors = Array.isArray(report.errors) ? report.errors : [];
  if (topLevelErrors.length > 0) {
    console.error(`Playwright run reported infrastructure errors: ${topLevelErrors.join(" | ")}`);
    process.exit(result.status ?? 1);
  }

  const knownFailuresByProject =
    JSON.parse(fs.readFileSync(knownFailuresPath, "utf8")).playwrightKnownFailuresByProject ?? {};

  const failedByProject = extractFailedSpecsByProject(report.suites);
  const unexpectedFailures = [];
  let knownFailureCount = 0;
  for (const [project, failedFiles] of failedByProject.entries()) {
    const knownFiles = knownFilesForProject(knownFailuresByProject[project]);
    for (const file of failedFiles) {
      if (knownFiles.has(file)) {
        knownFailureCount += 1;
      } else {
        unexpectedFailures.push(`${project}:${file}`);
      }
    }
  }
  const passed = report.stats?.expected ?? 0;

  if ((result.status ?? 0) !== 0 && failedByProject.size === 0) {
    console.error(
      "Playwright exited non-zero without mapped test failures. Failing check:full to avoid masking infrastructure issues."
    );
    process.exit(result.status ?? 1);
  }

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
