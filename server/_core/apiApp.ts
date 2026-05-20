// @ts-nocheck
import { sql } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
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

  async function healthHandler(req: Request, res: Response) {
    if (req.query?.deep === "1") {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not initialized");
        }
        await db.execute(sql`SELECT 1`);
        return res.status(200).json({ ok: true, db: true });
      } catch (err) {
        console.error("[health] DB check failed:", err);
        return res.status(503).json({ ok: false, db: false });
      }
    }
    return res.status(200).json({ ok: true });
  }

  // Expose both to support standalone (`/health`) and /api function mounting (`/api/health`).
  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  app.use("/api", express.json({ limit: "50mb" }));
  app.use("/api", express.urlencoded({ limit: "50mb", extended: true }));
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
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}
