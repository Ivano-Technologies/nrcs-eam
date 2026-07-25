/**
 * Walk appRouter and print sorted procedure paths (namespace.procedure…).
 * Usage: pnpm exec tsx scripts/check/list-trpc-procedures.mts
 */
import { appRouter } from "../../server/routers";

type AppRouterDef = {
  _def?: {
    procedures?: Record<string, unknown>;
  };
};

const procedures = (appRouter as AppRouterDef)._def?.procedures ?? {};
const paths = Object.keys(procedures).sort((a, b) => a.localeCompare(b));
for (const p of paths) {
  console.log(p);
}
console.error(`# ${paths.length} procedures`);
