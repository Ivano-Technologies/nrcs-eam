import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, type RGB } from "pdf-lib";

export const NRCS_RED: RGB = rgb(200 / 255, 16 / 255, 46 / 255);
export const PDF_FOOTER =
  "Confidential — Nigerian Red Cross Society — Prepared by Ivano Technologies Ltd";

export type PdfLayout = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  margin: number;
  pageW: number;
  pageH: number;
  contentW: number;
  headerH: number;
  lineH: number;
  headerTitle: string;
  headerSubtitle?: string;
  paintHeader: (p: PDFPage, title: string, subtitle?: string) => void;
  newPage: () => void;
  ensure: (needed: number) => void;
  truncate: (text: string, max: number) => string;
};

export function truncatePdfText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export async function createNrcsPdfLayout(options?: {
  title?: string;
  subtitle?: string;
  headerH?: number;
}): Promise<PdfLayout> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageW = 595;
  const pageH = 842;
  const margin = 44;
  const contentW = pageW - margin * 2;
  const headerH = options?.headerH ?? 72;
  const lineH = 12;

  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin - headerH;
  let headerTitle = options?.title ?? "";
  let headerSubtitle = options?.subtitle;

  const paintHeader = (p: PDFPage, title: string, subtitle?: string) => {
    p.drawRectangle({ x: 0, y: pageH - headerH, width: pageW, height: headerH, color: NRCS_RED });
    p.drawText("Nigerian Red Cross Society", {
      x: margin,
      y: pageH - 28,
      size: 10,
      font,
      color: rgb(1, 1, 1),
    });
    p.drawText(title, {
      x: margin,
      y: pageH - 48,
      size: 14,
      font: bold,
      color: rgb(1, 1, 1),
    });
    if (subtitle) {
      p.drawText(subtitle, {
        x: margin,
        y: pageH - 62,
        size: 9,
        font,
        color: rgb(1, 1, 1),
      });
    }
  };

  const newPage = () => {
    page = doc.addPage([pageW, pageH]);
    paintHeader(page, headerTitle, headerSubtitle);
    y = pageH - margin - headerH;
  };

  const ensure = (needed: number) => {
    if (y - needed < margin + 32) newPage();
  };

  if (headerTitle) paintHeader(page, headerTitle, headerSubtitle);

  const layout: PdfLayout = {
    doc,
    get page() {
      return page;
    },
    set page(p: PDFPage) {
      page = p;
    },
    get y() {
      return y;
    },
    set y(v: number) {
      y = v;
    },
    font,
    bold,
    margin,
    pageW,
    pageH,
    contentW,
    headerH,
    lineH,
    get headerTitle() {
      return headerTitle;
    },
    set headerTitle(t: string) {
      headerTitle = t;
    },
    get headerSubtitle() {
      return headerSubtitle;
    },
    set headerSubtitle(s: string | undefined) {
      headerSubtitle = s;
    },
    paintHeader,
    newPage,
    ensure,
    truncate: truncatePdfText,
  };

  return layout;
}

export async function finalizePdfLayout(layout: PdfLayout): Promise<Buffer> {
  const footerWidth = layout.font.widthOfTextAtSize(PDF_FOOTER, 7);
  const pages = layout.doc.getPages();
  const count = pages.length;
  pages.forEach((p, i) => {
    p.drawText(PDF_FOOTER, {
      x: (layout.pageW - footerWidth) / 2,
      y: 24,
      size: 7,
      font: layout.font,
      color: rgb(0.42, 0.42, 0.42),
    });
    const pageLabel = `Page ${i + 1} of ${count}`;
    const pw = layout.font.widthOfTextAtSize(pageLabel, 7);
    p.drawText(pageLabel, {
      x: layout.pageW - layout.margin - pw,
      y: 24,
      size: 7,
      font: layout.font,
      color: rgb(0.42, 0.42, 0.42),
    });
  });
  return Buffer.from(await layout.doc.save());
}
