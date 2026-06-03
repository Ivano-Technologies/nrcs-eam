/**
 * Bundle Vercel serverless handlers so server/ imports resolve at build time.
 * Invoked from vercel.json buildCommand (and pnpm run build:vercel-handlers).
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const shared = {
  platform: "node",
  bundle: true,
  format: "cjs",
  target: "node20",
  minify: true,
  treeShaking: true,
  external: [
    "canvas",
    "exceljs",
    "pdfkit",
    "pdf-lib",
    "bcrypt",
    "posthog-node",
    "node-quickbooks",
    "sharp",
  ],
  logLevel: "info",
};

/** @type {import('esbuild').BuildOptions[]} */
const bundles = [
  {
    entryPoints: [path.join(repoRoot, "server/_core/vercelTrpcHandler.ts")],
    outfile: path.join(repoRoot, "api/trpc/_handler.cjs"),
  },
];

for (const options of bundles) {
  await esbuild.build({
    ...shared,
    ...options,
    plugins: [
      {
        name: "external-native-node",
        setup(build) {
          build.onResolve({ filter: /\.node$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
        },
      },
    ],
  });
  console.log(`[build-vercel-handlers] ${path.relative(repoRoot, options.outfile)}`);
}

console.log("[build-vercel-handlers] done");
