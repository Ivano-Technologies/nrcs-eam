import "dotenv/config";
import { sql } from "drizzle-orm";
import { loadSecrets } from "../../shared/loadSecrets";
import {
  logStartupSummary,
  validateAwsProductionTls,
  validateProductionSecrets,
} from "../../shared/startupValidation";
import { getDb } from "../db";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import cors from "cors";
import { createCorsMiddlewareOptions, getAllowedOriginsList, logCorsStartup } from "./corsConfig";
import { serveStatic, setupVite } from "./vite";
import setupRouter from "../routes/setup";

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

async function verifyDbConnection(): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error(
      "[startup] Database connection failed (pool not initialized)"
    );
  }
  await db.execute(sql`SELECT 1`);
  console.log("[startup] DB connectivity check passed");
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  const allowedOrigins = getAllowedOriginsList();
  logCorsStartup(allowedOrigins);
  app.use(cors(createCorsMiddlewareOptions(allowedOrigins)));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  // Only parse JSON/urlencoded for API routes — global parsers can interfere with Vite dev middleware.
  app.use("/api", express.json({ limit: "50mb" }));
  app.use("/api", express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/api", setupRouter);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Magic link verification endpoint
  app.post("/api/auth/verify-magic-link", async (req, res) => {
    const { handleMagicLinkVerification } = await import("./magicLinkVerification");
    return handleMagicLinkVerification(req, res);
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const isProd = process.env.NODE_ENV === "production";
  // Same as: Number(process.env.PORT || 3000) — App Runner sets PORT; default 3000 locally.
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
  await loadSecrets();
  validateProductionSecrets();
  validateAwsProductionTls();
  if (process.env.NODE_ENV === "production") {
    await verifyDbConnection();
  }
  logStartupSummary();
  await startServer();
}

main().catch(console.error);
