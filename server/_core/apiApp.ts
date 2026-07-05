import { sql } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { getDb } from "../db";
import { appRouter } from "../routers";
import setupRouter from "../routes/setup";
import documentsRouter from "../routes/documents";
import { createContext } from "./context";
import {
  createDynamicCorsMiddlewareOptions,
  getAllowedOriginsList,
  logCorsStartup,
} from "./corsConfig";
import { authTrpcRateLimitMiddleware } from "./authRateLimit";
import { scopedApiBodyParser } from "./scopedBodyParser";

/**
 * Shared API app for:
 * - local/standalone Node server (`server/_core/index.ts`)
 * - Vercel serverless function (`api/[...all].ts`)
 */
export function createApiApp(): Express {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  logCorsStartup(getAllowedOriginsList());
  app.options("/*splat", cors(createDynamicCorsMiddlewareOptions()));
  app.use(cors(createDynamicCorsMiddlewareOptions()));

  // Expose both to support standalone (`/health`) and /api function mounting (`/api/health`).
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const keepAlive = async (_req: express.Request, res: express.Response) => {
    try {
      const db = await getDb();
      if (db) await db.execute(sql`SELECT 1`);
      res.json({ ok: true, ts: Date.now() });
    } catch {
      res.json({ ok: false, ts: Date.now() });
    }
  };
  app.get("/keep-alive", keepAlive);
  app.get("/api/keep-alive", keepAlive);

  app.use("/api", scopedApiBodyParser);
  app.use("/api", setupRouter);
  app.use("/api", documentsRouter);

  // Legacy Manus OAuth URL — keep redirect stable.
  app.get("/api/oauth/callback", (_req, res) => {
    const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim();
    const target =
      frontendOrigin && frontendOrigin.length > 0
        ? `${frontendOrigin.replace(/\/+$/, "")}/login`
        : "/login";
    res.redirect(302, target);
  });

  app.use(
    "/api/trpc",
    authTrpcRateLimitMiddleware,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}
