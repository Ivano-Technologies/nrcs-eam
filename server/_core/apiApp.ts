// @ts-nocheck
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import express, { type Express } from "express";
import { appRouter } from "../routers";
import setupRouter from "../routes/setup";
import { createContext } from "./context";
import {
  createDynamicCorsMiddlewareOptions,
  getAllowedOriginsList,
  logCorsStartup,
} from "./corsConfig";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

/**
 * Shared API app for:
 * - local/standalone Node server (`server/_core/index.ts`)
 * - Vercel serverless function (`api/[...all].ts`)
 */
export function createApiApp(): Express {
  const app = express();
  app.set("trust proxy", 1);

  logCorsStartup(getAllowedOriginsList());
  app.options("*", cors(createDynamicCorsMiddlewareOptions()));
  app.use(cors(createDynamicCorsMiddlewareOptions()));

  // Expose both to support standalone (`/health`) and /api function mounting (`/api/health`).
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.get("/api/db-check", async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        res.json({ ok: false, error: "Database pool not initialized" });
        return;
      }
      const result = await db.execute(sql`
        SELECT
          current_database() as db,
          current_schema() as schema,
          to_regclass('public.users') as users_table_exists,
          COUNT(*) as user_count
        FROM users
      `);
      res.json({ ok: true, result });
    } catch (e: any) {
      res.json({ ok: false, error: e?.message, code: e?.code });
    }
  });

  app.use("/api", express.json({ limit: "50mb" }));
  app.use("/api", express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/api", setupRouter);

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
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}
