import { execSync } from "node:child_process";

function main() {
  const output = execSync("git status --porcelain", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  if (output.length > 0) {
    console.error("Working tree is not clean. Commit or stash changes before check:full.");
    console.error(output);
    process.exit(1);
  }

  console.log("OK working tree is clean.");
}

main();
