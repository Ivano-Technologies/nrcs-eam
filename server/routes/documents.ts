import { and, asc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import * as XLSX from "xlsx";
import { documentPrintLog, goodsReceivedNotes, inventoryDocuments, waybills, waybillLines, waybillLineCtnSources } from "../../drizzle/schema";
import { getDb } from "../db";
import { generateGrnPdf } from "../_core/pdfTemplates/grnPdf";
import { generateWaybillPdf } from "../_core/pdfTemplates/waybillPdf";
import { generateExcelReport, generatePDFReport } from "../reportGenerator";
import { getStockCardDetail } from "../wms/stockCard";
import { getBinCardDetail } from "../wms/binCard";
import { buildMonthlyWarehouseReport } from "../wms/monthlyWarehouseReport";

const router = Router();

type ExportType = "grn" | "waybill" | "stock-card" | "bin-card" | "monthly-report";
type ExportFormat = "pdf" | "xlsx";

function mimeFor(format: ExportFormat): string {
  return format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

function toSheetBuffer(rows: Record<string, unknown>[], sheetName: string): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }));
}

router.get("/documents/:type/:id/export", async (req, res) => {
  const type = String(req.params.type) as ExportType;
  const id = Number(req.params.id);
  const format = String(req.query.format ?? "pdf") as ExportFormat;
  const copyType = req.query.copy ? String(req.query.copy) : null;

  if (!["grn", "waybill", "stock-card", "bin-card", "monthly-report"].includes(type)) {
    return res.status(400).json({ error: "Unsupported document type" });
  }
  if (!["pdf", "xlsx"].includes(format)) {
    return res.status(400).json({ error: "Unsupported export format" });
  }
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid document id" });
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Database unavailable" });

  try {
    let buffer: Buffer;
    let filenameBase = `${type}-${id}`;

    if (type === "grn") {
      const [doc] = await db
        .select()
        .from(inventoryDocuments)
        .where(and(eq(inventoryDocuments.id, id), eq(inventoryDocuments.documentType, "grn")))
        .limit(1);
      if (!doc) return res.status(404).json({ error: "Document not found" });
      filenameBase = doc.documentNumber || filenameBase;
      if (format === "pdf") {
        const rows = [
          { label: "Document Number", value: doc.documentNumber ?? "—" },
          { label: "Status", value: doc.status ?? "draft" },
          { label: "Reference", value: doc.referenceDocument ?? "—" },
          { label: "Created At", value: doc.createdAt ? new Date(doc.createdAt).toISOString() : "—" },
          { label: "Notes", value: doc.notes ?? "—" },
        ];
        buffer = await generateGrnPdf({ rows });
      } else {
        buffer = toSheetBuffer([doc], "GRN");
      }
      if (copyType && ["white", "green", "blue", "yellow"].includes(copyType)) {
        const priorInventory = (doc.copiesPrinted ?? {}) as Record<string, string | null>;
        const printedAtIso = new Date().toISOString();
        await db
          .update(inventoryDocuments)
          .set({ copiesPrinted: { ...priorInventory, [copyType]: printedAtIso } })
          .where(eq(inventoryDocuments.id, doc.id));
        const [grn] = await db.select().from(goodsReceivedNotes).where(eq(goodsReceivedNotes.grnNumber, doc.documentNumber)).limit(1);
        const prior = (grn?.copiesPrinted ?? {}) as Record<string, string | null>;
        if (grn) {
          await db
            .update(goodsReceivedNotes)
            .set({ copiesPrinted: { ...prior, [copyType]: printedAtIso }, updatedAt: new Date() })
            .where(eq(goodsReceivedNotes.id, grn.id));
        }
        await db.insert(documentPrintLog).values({
          documentType: "grn",
          documentId: id,
          copyType,
          printedBy: null,
          isReprint: Boolean(priorInventory[copyType] ?? prior[copyType]),
        });
      }
    } else if (type === "waybill") {
      const [wb] = await db.select().from(waybills).where(eq(waybills.id, id)).limit(1);
      if (!wb) return res.status(404).json({ error: "Document not found" });
      const lines = await db.select().from(waybillLines).where(eq(waybillLines.waybillId, id)).orderBy(asc(waybillLines.lineOrder));
      const lineIds = lines.map((line) => line.id);
      const ctnSources = lineIds.length
        ? await db
            .select()
            .from(waybillLineCtnSources)
            .where(inArray(waybillLineCtnSources.waybillLineId, lineIds))
            .orderBy(asc(waybillLineCtnSources.sourceOrder))
        : [];
      filenameBase = wb.wbNumber || filenameBase;
      if (format === "pdf") {
        const rows = [
          { label: "Waybill Number", value: wb.wbNumber ?? "—" },
          { label: "Status", value: wb.status ?? "draft" },
          { label: "Destination", value: wb.destinationBeneficiary ?? "—" },
          { label: "Date", value: wb.date ?? "—" },
          { label: "Lines", value: lines.length },
        ];
        buffer = await generateWaybillPdf({ rows });
      } else {
        const sheetRows = lines.map((line) => ({
          ...line,
          ctnBreakdown: ctnSources
            .filter((source) => source.waybillLineId === line.id)
            .map((source) => `${source.ctnId}:${source.quantity}`)
            .join(", "),
        }));
        buffer = toSheetBuffer(sheetRows, "Waybill");
      }
      if (copyType && ["white", "green", "blue", "yellow"].includes(copyType)) {
        const prior = (wb.copiesPrinted ?? {}) as Record<string, string | null>;
        const printedAtIso = new Date().toISOString();
        await db
          .update(waybills)
          .set({ copiesPrinted: { ...prior, [copyType]: printedAtIso }, updatedAt: new Date() })
          .where(eq(waybills.id, wb.id));
        await db.insert(documentPrintLog).values({
          documentType: "waybill",
          documentId: id,
          copyType,
          printedBy: null,
          isReprint: Boolean(prior[copyType]),
        });
      }
    } else if (type === "stock-card") {
      const detail = await getStockCardDetail(db, id);
      if (!detail) return res.status(404).json({ error: "Document not found" });
      if (format === "pdf") {
        buffer = await generatePDFReport(
          "Stock Card",
          detail.ledger,
          [
            { header: "Date", key: "date" },
            { header: "Doc Ref", key: "documentRef" },
            { header: "IN", key: "quantityIn" },
            { header: "OUT", key: "quantityOut" },
            { header: "Balance", key: "balanceAfter" },
          ],
          { subtitle: `${detail.card.itemName} / ${detail.card.ctnCode}` }
        );
      } else {
        buffer = toSheetBuffer(detail.ledger, "StockCard");
      }
    } else if (type === "bin-card") {
      const detail = await getBinCardDetail(db, id);
      if (!detail) return res.status(404).json({ error: "Document not found" });
      if (format === "pdf") {
        buffer = await generatePDFReport(
          "Bin Card",
          detail.ledger,
          [
            { header: "Date", key: "date" },
            { header: "From/To", key: "fromTo" },
            { header: "IN", key: "quantityIn" },
            { header: "OUT", key: "quantityOut" },
            { header: "Balance", key: "balanceAfter" },
          ],
          { subtitle: `${detail.card.itemDescription ?? "—"} / ${detail.card.binNumber ?? id}` }
        );
      } else {
        buffer = toSheetBuffer(detail.ledger, "BinCard");
      }
    } else {
      const now = new Date();
      const month = Number(req.query.month ?? now.getMonth() + 1);
      const year = Number(req.query.year ?? now.getFullYear());
      const rows = await buildMonthlyWarehouseReport(db, { warehouseId: id, month, year });
      filenameBase = `monthly-warehouse-report-${year}-${String(month).padStart(2, "0")}`;
      if (format === "pdf") {
        buffer = await generatePDFReport(
          "Warehouse Monthly Report",
          rows,
          [
            { header: "SN", key: "sn" },
            { header: "Product", key: "product" },
            { header: "Opening", key: "openingBalance" },
            { header: "IN", key: "inbound" },
            { header: "Closing", key: "closingBalance" },
          ],
          { subtitle: `Month ${month}/${year}` }
        );
      } else {
        buffer = await generateExcelReport("Warehouse Monthly Report", rows, [
          { header: "SN", key: "sn" },
          { header: "Product", key: "product" },
          { header: "Unit/Weight", key: "unitAndWeight" },
          { header: "Opening", key: "openingBalance" },
          { header: "IN", key: "inbound" },
          { header: "OUT Distributions", key: "outDistributions" },
          { header: "OUT Branches", key: "outBranches" },
          { header: "OUT Others", key: "outOthers" },
          { header: "Loss/Damaged", key: "lossAndDamaged" },
          { header: "Closing", key: "closingBalance" },
          { header: "Comments", key: "comments" },
        ]);
      }
    }

    const ext = format === "pdf" ? "pdf" : "xlsx";
    res.setHeader("Content-Type", mimeFor(format));
    res.setHeader("Content-Disposition", `attachment; filename=\"${filenameBase}.${ext}\"`);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("[documents/export]", error);
    return res.status(500).json({ error: "Failed to export document" });
  }
});

export default router;
