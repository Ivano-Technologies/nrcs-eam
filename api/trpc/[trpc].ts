// @ts-nocheck
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import express from "express";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";
import { createDynamicCorsMiddlewareOptions } from "../../server/_core/corsConfig";

const app = express();
app.set("trust proxy", 1);
app.options("*", cors(createDynamicCorsMiddlewareOptions()));
app.use(cors(createDynamicCorsMiddlewareOptions()));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
