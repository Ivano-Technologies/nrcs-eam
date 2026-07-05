import express, { type RequestHandler } from "express";

const DEFAULT_BODY_LIMIT = "1mb";
const LARGE_BODY_LIMIT = "50mb";

/** tRPC procedures that accept large base64 upload payloads. */
export const LARGE_TRPC_BODY_PROCEDURES = [
  "bulkOperations.importAssets",
  "bulkOperations.importSites",
  "bulkOperations.previewAssetRegisterImport",
  "auth.uploadAvatar",
  "inventoryV2.documents.parseExcelImport",
  "inventoryV2.documents.parseTypedPdfImport",
  "inventoryV2.parseExcelSheet",
] as const;

function getTrpcProcedurePath(originalUrl: string): string | null {
  const path = originalUrl.split("?")[0] ?? "";
  const marker = "/api/trpc/";
  const idx = path.indexOf(marker);
  if (idx === -1) return null;
  return path.slice(idx + marker.length);
}

function isLargeTrpcBodyRequest(originalUrl: string): boolean {
  const procedure = getTrpcProcedurePath(originalUrl);
  if (!procedure) return false;
  return (LARGE_TRPC_BODY_PROCEDURES as readonly string[]).includes(procedure);
}

const defaultJsonParser = express.json({ limit: DEFAULT_BODY_LIMIT });
const largeJsonParser = express.json({ limit: LARGE_BODY_LIMIT });
const defaultUrlencodedParser = express.urlencoded({
  limit: DEFAULT_BODY_LIMIT,
  extended: true,
});
const largeUrlencodedParser = express.urlencoded({
  limit: LARGE_BODY_LIMIT,
  extended: true,
});

/**
 * Apply 50mb parsers only for bulk-import / avatar upload tRPC calls; 1mb elsewhere under /api.
 */
export const scopedApiBodyParser: RequestHandler = (req, res, next) => {
  const useLargeLimit = isLargeTrpcBodyRequest(req.originalUrl);
  const jsonParser = useLargeLimit ? largeJsonParser : defaultJsonParser;
  const urlencodedParser = useLargeLimit ? largeUrlencodedParser : defaultUrlencodedParser;

  jsonParser(req, res, (jsonErr) => {
    if (jsonErr) {
      next(jsonErr);
      return;
    }
    urlencodedParser(req, res, next);
  });
};
