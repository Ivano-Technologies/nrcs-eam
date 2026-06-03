import "dotenv/config";
import { initOtel } from "./otel";

initOtel();
import { sql } from "drizzle-orm";
import {
  logStartupSummary,
  validateAwsProductionTls,
  validateProductionSecrets,
} from "../../shared/startupValidation";
import { runProdMigrations } from "./runProdMigrations";
import { getDb, resetDbConnection } from "../db";
import { createServer } from "http";
import net from "net";
import { createApiApp } from "./apiApp";
import { serveStatic, setupVite } from "./vite";
import { getPostHogClient, shutdownPostHog } from "../posthog";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function dbErrorChainText(err: unknown): string {
  const parts: string[] = [];
  let e: unknown = err;
  for (let depth = 0; depth < 12 && e != null; depth++) {
    if (e instanceof Error) {
      parts.push(e.message, e.stack ?? "");
      e = (e as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(e));
      break;
    }
  }
  return parts.join("\n");
}

async function verifyDbConnection(): Promise<void> {
  const maxAttempts = Number(process.env.DB_VERIFY_MAX_ATTEMPTS ?? "30");
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const db = await getDb();
      if (!db) {
        throw new Error(
          "[startup] Database connection failed (pool not initialized)"
        );
      }
      await db.execute(sql`SELECT 1`);
      console.log("[startup] DB connectivity check passed");
      return;
    } catch (e) {
      lastError = e;
      await resetDbConnection();
      const text = dbErrorChainText(e);
      const transient =
        /ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|socket disconnected|wrong version number|TLS|SSL|timeout|refused|ERR_SSL|ECONNREFUSED/i.test(
          text
        );
      if (!transient || attempt === maxAttempts) {
        throw e;
      }
      const delayMs = Math.min(2500 * attempt, 45_000);
      console.warn(
        `[startup] DB check attempt ${attempt}/${maxAttempts} failed, retry in ${delayMs}ms:`,
        text.slice(0, 500)
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "DB verify failed"));
}

async function startServer() {
  const app = createApiApp();
  const server = createServer(app);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const isProd = process.env.NODE_ENV === "production";
  // Same as: Number(process.env.PORT || 3000) — Vercel/Node hosts set PORT; default 3000 locally.
  const basePort = Number(process.env.PORT) || 3000;
  const port = isProd ? basePort : await findAvailablePort(basePort);

  if (!isProd && port !== basePort) {
    console.log(`Port ${basePort} is busy, using port ${port} instead`);
  }

  const onListen = () => {
    if (isProd) {
      console.log(`[startup] Listening on port ${port} (bound to 0.0.0.0)`);
    } else {
      console.log(`Server running on http://localhost:${port}/`);
    }
  };

  server.listen(port, "0.0.0.0", onListen);
}

async function main() {
  validateProductionSecrets();
  validateAwsProductionTls();
  if (process.env.NODE_ENV === "production") {
    if (process.env.SKIP_PROD_MIGRATIONS === "1") {
      console.warn(
        "[startup] SKIP_PROD_MIGRATIONS=1 — skipping drizzle migrate (run migrations from CI or a one-off task when needed)"
      );
    } else {
      await runProdMigrations();
    }
    if (process.env.SKIP_PROD_DB_VERIFY === "1") {
      console.warn(
        "[startup] SKIP_PROD_DB_VERIFY=1 — skipping SELECT 1 check (RDS cold connect only; remove when stable)"
      );
    } else {
      await verifyDbConnection();
    }
  }
  logStartupSummary();
  getPostHogClient();
  await startServer();

  process.on("unhandledRejection", (reason) => {
    console.error("[server] Unhandled rejection:", reason);
    try {
      const client = getPostHogClient();
      if (!client) return;
      const captureException = (client as { captureException?: (err: unknown) => void })
        .captureException;
      if (typeof captureException === "function") {
        captureException.call(client, reason);
      } else {
        client.capture({
          distinctId: "server",
          event: "server_error",
          properties: { error: String(reason) },
        });
      }
    } catch (_) {
      // silent if posthog not available
    }
  });

  process.on("SIGTERM", async () => {
    await shutdownPostHog();
    process.exit(0);
  });
  process.on("SIGINT", async () => {
    await shutdownPostHog();
    process.exit(0);
  });
}

main().catch(console.error);
