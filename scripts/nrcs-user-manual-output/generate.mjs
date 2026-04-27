/**
 * Generates NRCS EAM User Manual (DOCX) and Quick Reference (PPTX).
 * Run from repo: node scripts/nrcs-user-manual-output/generate.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import PptxGenJS from "pptxgenjs";
import { buildManualChildren, MANUAL_NUMBERING_CONFIG } from "./doc-manual-body.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const logoPath = path.join(repoRoot, "client", "public", "nrcs-logo-source.png");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getOutputDirs() {
  const inRepo = path.join(repoRoot, "docs", "manual", "outputs");
  ensureDir(inRepo);
  const dirs = [inRepo];
  const repoMirror = path.join(repoRoot, "mnt", "user-data", "outputs");
  ensureDir(repoMirror);
  dirs.push(repoMirror);
  const envDir = process.env.NRCS_MANUAL_OUTPUT_DIR;
  if (envDir) {
    try {
      ensureDir(envDir);
      dirs.push(envDir);
    } catch {
      /* ignore invalid env path */
    }
  }
  if (process.platform === "win32") {
    try {
      const winMnt = path.join(`${process.env.SystemDrive || "C:"}`, "mnt", "user-data", "outputs");
      ensureDir(winMnt);
      dirs.push(winMnt);
    } catch {
      /* ignore */
    }
  }
  if (process.platform !== "win32") {
    const posixMount = "/mnt/user-data/outputs";
    try {
      ensureDir(posixMount);
      dirs.push(posixMount);
    } catch {
      /* ignore if not writable */
    }
  }
  return dirs;
}

function writeAllOutputs(name, writeFn) {
  const dirs = getOutputDirs();
  const paths = [];
  for (const d of dirs) {
    const p = path.join(d, name);
    writeFn(p);
    paths.push(p);
  }
  return paths;
}

async function buildDocx() {
  const logoBuf = fs.readFileSync(logoPath);
  const children = buildManualChildren(logoBuf);

  const doc = new Document({
    creator: "NRCS EAM",
    title: "NRCS Enterprise Asset Management System — User Manual",
    description: "Version 1.0 — April 2026",
    features: {
      updateFields: true,
    },
    numbering: MANUAL_NUMBERING_CONFIG,
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const paths = writeAllOutputs("NRCS_EAM_User_Manual.docx", (p) => fs.writeFileSync(p, buffer));
  return paths;
}

async function buildPptx() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "NRCS EAM";
  pptx.title = "NRCS EAM Quick Reference Guide";
  pptx.subject = "Training quick reference — April 2026";

  const BRAND_RED = "C00000";
  const logoOpts = { path: logoPath, x: 0.25, y: 0.12, w: 1.35, h: 0.45 };

  function addLogo(slide) {
    slide.addImage(logoOpts);
  }

  function addTitleSlide(title, bullets, opts = {}) {
    const slide = pptx.addSlide({ ...opts });
    addLogo(slide);
    slide.addText(title, {
      x: 0.4,
      y: 0.65,
      w: 12.5,
      h: 0.75,
      fontSize: opts.titleSize ?? 28,
      bold: true,
      color: BRAND_RED,
      fontFace: "Calibri",
    });
    if (bullets?.length) {
      const bulletText = bullets.map((t) => ({
        text: t,
        options: { bullet: true, fontSize: 20, color: "363636", fontFace: "Calibri" },
      }));
      slide.addText(bulletText, {
        x: 0.45,
        y: 1.55,
        w: 12.4,
        h: 5.5,
        valign: "top",
        fontFace: "Calibri",
      });
    }
  }

  // 1 Title
  addTitleSlide("NRCS EAM Quick Reference Guide", [
    "Nigerian Red Cross Society — Enterprise Asset Management",
    "Version 1.0 — April 2026",
    "Confidential — for internal use only",
  ]);

  // 2 Log in
  addTitleSlide("How to log in", [
    "Open a supported browser (current Chrome, Edge, or Firefox).",
    "Go to https://nrcseam.techivano.com",
    "Enter your email and password.",
    "Select Sign in (or the equivalent button on your screen).",
    "If you cannot sign in, see the Troubleshooting slide.",
  ]);

  // 3 Dashboard KPIs
  addTitleSlide("Dashboard — what the KPIs mean", [
    "Low stock items: catalogue lines below minimum at your facilities.",
    "Active facilities: sites you can work with, based on your access.",
    "Stock readiness index: a summary score of stock health (higher is better).",
    "Units distributed: quantities sent out in the selected period.",
    "Average response time: how quickly requests move through approval.",
  ]);

  // 4 GRN 5 steps
  addTitleSlide("How to create a GRN (5 steps)", [
    "Open Inventory → Incoming → Goods Received (GRN) and choose New.",
    "Pick the receiving facility and receipt date; add donor and transport details.",
    "Create or pick a Commodity Tracking Number (CTN) for this shipment.",
    "Add each line: item, quantity, unit, batch or dates where required.",
    "Save as draft while checking; finalise when correct, then print if needed.",
  ]);

  // 5 Waybill 5 steps
  addTitleSlide("How to create a Waybill (5 steps)", [
    "Open Inventory → Outgoing → Waybill and choose New.",
    "Set source warehouse and destination; link a requisition if one exists.",
    "Add lines and choose which CTN each quantity comes from.",
    "If stock is past expiry, a manager may approve an override where allowed.",
    "Save, review, dispatch when the load leaves, then print copies.",
  ]);

  // 6 Print GRN/Waybill
  addTitleSlide("How to print a GRN or Waybill", [
    "Open the finished document from its history list.",
    "Use Print from the on-screen toolbar or your browser print menu.",
    "Print four copies on the correct paper colours if your process requires it.",
    "Check each copy shows signatures and line totals before filing.",
    "File copies as: white, green, blue, yellow — per warehouse SOP.",
  ]);

  // 7 Stock count
  addTitleSlide("How to do a stock count", [
    "Plan the count date and freeze movement if your SOP says so.",
    "Open Stock counts, start or open the scheduled count for the facility.",
    "Count each location and enter counted quantities line by line.",
    "Submit for review; managers approve variances where needed.",
    "Print or export the record for the warehouse file.",
  ]);

  // 8 Requisition
  addTitleSlide("How to raise a requisition", [
    "Open Requisitions and choose New requisition.",
    "Pick the requesting facility and the items you need.",
    "Add quantities, reasons, and any notes your branch requires.",
    "Submit for approval; track status on the same screen.",
    "Logistics links an approved requisition to a Waybill when stock is sent.",
  ]);

  // 9 Monthly report
  addTitleSlide("How to generate the Monthly Warehouse Report", [
    "Open Reports → Monthly Warehouse Report (or the reports menu).",
    "Choose facility and month, then Generate.",
    "Preview figures, then export to PDF or Excel as needed.",
    "Use Email only if your role shows that option and mail is configured.",
    "Keep a saved copy with the monthly warehouse file set.",
  ]);

  // 10 New facility
  addTitleSlide("How to add a new facility", [
    "Open Facilities and choose Add facility.",
    "Enter name, type (branch, warehouse, clinic, and so on), and address.",
    "Set a short facility code — it is used on printed document numbers.",
    "Save; confirm the new site appears in filters and pick lists.",
    "For bulk load, use Facilities → Import from Excel with the template.",
  ]);

  // 11 New user (Admin)
  addTitleSlide("How to add a new user (Admin only)", [
    "Open User management (or Settings → Users) as an Admin.",
    "Choose Create user and enter name, email, and initial role.",
    "Assign which facilities this person may see or operate.",
    "Save; send the welcome message so they can set a password.",
    "Ask them to confirm they can log in at https://nrcseam.techivano.com",
  ]);

  // 12 Reset password
  addTitleSlide("How to reset a password", [
    "On the sign-in page, choose Forgot password.",
    "Enter your email and follow the link in the message you receive.",
    "Choose a new password that meets the rules shown on screen.",
    "If no email arrives, check spam or ask an Admin to reset your account.",
    "Never share passwords; use your own account only.",
  ]);

  // 13 Facility codes table
  const slide13 = pptx.addSlide();
  addLogo(slide13);
  slide13.addText("Facility codes reference table", {
    x: 0.4,
    y: 0.65,
    w: 12.5,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: BRAND_RED,
    fontFace: "Calibri",
  });
  slide13.addTable(
    [
      [
        { text: "Example code", options: { bold: true, fill: { color: BRAND_RED }, color: "FFFFFF" } },
        { text: "Example name", options: { bold: true, fill: { color: BRAND_RED }, color: "FFFFFF" } },
      ],
      [
        { text: "NHQ", options: { fontSize: 16 } },
        { text: "National Headquarters (example seed)", options: { fontSize: 16 } },
      ],
      [
        { text: "LAG", options: { fontSize: 16 } },
        { text: "Lagos Branch (example seed)", options: { fontSize: 16 } },
      ],
      [
        { text: "KAN", options: { fontSize: 16 } },
        { text: "Kano Branch (example seed)", options: { fontSize: 16 } },
      ],
      [
        { text: "—", options: { fontSize: 16 } },
        { text: "Export your live list from Facilities for the full table.", options: { fontSize: 16 } },
      ],
    ],
    { x: 0.45, y: 1.45, w: 12.4, colW: [2.2, 10.2], border: { pt: "1", color: "CCCCCC" } },
  );

  // 14 Common problems
  addTitleSlide("Common problems and solutions", [
    "Cannot log in: check caps lock, reset password, confirm your account is active.",
    "Import rejected: download a fresh template; do not delete header rows.",
    "Print looks wrong: use Print preview; set margins to default; try another browser.",
    "Missing facility: ask Admin to add you to that facility’s access list.",
    "Still stuck: contact your system administrator with a screen description.",
  ]);

  // 15 Contact
  addTitleSlide("Contact and support", [
    "System URL: https://nrcseam.techivano.com",
    "First line: your branch or national IT / logistics focal point.",
    "For access changes: Admin user or national administrator.",
    "For data corrections after final documents: manager + audit trail rules.",
    "Keep this deck with the branch training pack (Version 1.0, April 2026).",
  ]);

  const out = await pptx.write({ outputType: "nodebuffer" });
  const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);
  const paths = writeAllOutputs("NRCS_EAM_Quick_Reference.pptx", (p) => fs.writeFileSync(p, buffer));
  return paths;
}

async function main() {
  if (!fs.existsSync(logoPath)) {
    console.error("Logo not found:", logoPath);
    process.exit(1);
  }
  const docxPaths = await buildDocx();
  const pptxPaths = await buildPptx();
  console.log("DOCX written to:\n  " + docxPaths.join("\n  "));
  console.log("PPTX written to:\n  " + pptxPaths.join("\n  "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
