/**
 * Smoke test: verifies pdfkit resolves and writes a PDF (Node only).
 * Run: pnpm run test:pdfkit
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "test-output.pdf");

const doc = new PDFDocument();
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);
doc.fontSize(25).text("PDFKit is working!", 100, 100);
doc.end();

stream.on("finish", () => {
  console.log("OK: wrote", outPath);
});
