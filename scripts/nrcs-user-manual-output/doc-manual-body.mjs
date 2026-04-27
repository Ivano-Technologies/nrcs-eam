/**
 * Builds the main body (after cover) for the NRCS EAM User Manual DOCX.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AlignmentType,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LevelSuffix,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

/** Word numbering definitions for procedural steps (unique reference per list so numbering restarts). */
export const MANUAL_NUMBERING_CONFIG = {
  config: [
    {
      reference: "steps-1-6",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          suffix: LevelSuffix.SPACE,
          style: {
            paragraph: {
              indent: { left: 720, hanging: 360 },
            },
          },
        },
      ],
    },
    {
      reference: "steps-3-3",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          suffix: LevelSuffix.SPACE,
          style: {
            paragraph: {
              indent: { left: 720, hanging: 360 },
            },
          },
        },
      ],
    },
    {
      reference: "steps-3-4",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          suffix: LevelSuffix.SPACE,
          style: {
            paragraph: {
              indent: { left: 720, hanging: 360 },
            },
          },
        },
      ],
    },
    {
      reference: "steps-4-4",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          suffix: LevelSuffix.SPACE,
          style: {
            paragraph: {
              indent: { left: 720, hanging: 360 },
            },
          },
        },
      ],
    },
  ],
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, "manual-catalogue.json"), "utf8"));

const DONORS = [
  ["FRC", "Finnish Red Cross"],
  ["JRCS", "Japanese Red Cross Society"],
  ["NORC", "Norwegian Red Cross"],
  ["SRC", "Swedish Red Cross"],
  ["ICRC", "International Committee of the Red Cross"],
  ["IFRC", "International Federation of Red Cross and Red Crescent Societies"],
  ["USAID", "United States Agency for International Development"],
  ["ECHO", "EU Civil Protection and Humanitarian Aid (ECHO)"],
  ["CUSTOM", "Custom / other donor"],
  ["BLENDED", "Blended Contributors (mixed sources for kits)"],
  ["LEGACY", "Legacy Stock (pre-WMS)"],
];

/** NRCS facility register for Appendix A (Code | Name | Type | State). */
const FACILITY_REFERENCE_ROWS = [
  ["NHQ-001", "Nigerian Red Cross Society National Headquarters", "National HQ", "Abuja"],
  ["ABI-001", "Nigerian Red Cross Society Abia Branch Office", "Branch", "Abia"],
  ["ABI-002", "Nigerian Red Cross Society Aba", "Division", "Abia"],
  ["ANA-001", "Nigerian Red Cross Society Anambra Branch Office", "Branch", "Anambra"],
  ["ANA-002", "Nigerian Red Cross Society Aguata", "Division", "Anambra"],
  ["ANA-003", "Nigerian Red Cross Society Nnewi", "Division", "Anambra"],
  ["ANA-004", "Nigerian Red Cross Society Children's Home Onitsha", "Division", "Anambra"],
  ["BAY-001", "Nigerian Red Cross Society Bayelsa Branch Office", "Branch", "Bayelsa"],
  ["BOR-001", "Nigerian Red Cross Society Borno Branch Office", "Branch", "Borno"],
  ["CRV-001", "Nigerian Red Cross Society Cross River Branch Office", "Branch", "Cross River"],
  ["CRV-002", "Nigerian Red Cross Society Calabar", "Division", "Cross River"],
  ["DEL-001", "Nigerian Red Cross Society Delta Branch Office", "Branch", "Delta"],
  ["EDO-001", "Nigerian Red Cross Society Edo Branch Office", "Branch", "Edo"],
  ["EKT-001", "Nigerian Red Cross Society Ado Ekiti", "Branch", "Ekiti"],
  ["ENU-001", "Nigerian Red Cross Society Enugu Branch Office", "Branch", "Enugu"],
  ["IMO-001", "Nigerian Red Cross Society Imo Branch Office", "Branch", "Imo"],
  ["KAD-001", "Nigerian Red Cross Society Kaduna Branch Office", "Branch", "Kaduna"],
  ["KAD-002", "Nigerian Red Cross Society Kaduna", "Division", "Kaduna"],
  ["KAN-001", "Nigerian Red Cross Society Kano Branch Office", "Branch", "Kano"],
  ["KAN-CL1", "Nigerian Red Cross Society Medical Center Kano", "Clinic", "Kano"],
  ["KAN-WH1", "Nigerian Red Cross Society Kano Branch Warehouse", "Warehouse", "Kano"],
  ["KWA-001", "Nigerian Red Cross Society Kwara Branch Office", "Branch", "Kwara"],
  ["LAG-001", "Nigerian Red Cross Society Lagos Branch Office", "Branch", "Lagos"],
  ["LAG-002", "Nigerian Red Cross Society Epe", "Division", "Lagos"],
  ["LAG-WH1", "Nigerian Red Cross Society Lagos Ibafo Warehouse", "Warehouse", "Lagos"],
  ["NGR-001", "Nigerian Red Cross Society Suleja", "Branch", "Niger"],
  ["OYO-001", "Nigerian Red Cross Society Oyo Branch Office", "Branch", "Oyo"],
  ["OYO-CL1", "Nigerian Red Cross Society Medical Center Ibadan", "Clinic", "Oyo"],
  ["RIV-001", "Nigerian Red Cross Society Rivers Branch Office", "Branch", "Rivers"],
];

function textRunsFromString(text, base = { size: 22 }) {
  const opts = { ...base };
  const children = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      children.push(new TextRun({ text: text.slice(last, m.index), ...opts }));
    }
    children.push(new TextRun({ text: m[1], bold: true, ...opts }));
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    children.push(new TextRun({ text: text.slice(last), ...opts }));
  }
  if (children.length === 0) {
    children.push(new TextRun({ text, ...opts }));
  }
  return children;
}

function p(text, opts = {}) {
  const base = { size: 22, ...opts };
  return new Paragraph({
    spacing: { after: 160 },
    children: textRunsFromString(text, base),
  });
}

function shot(desc) {
  return p(`[SCREENSHOT: ${desc}]`, { italics: true, color: "666666" });
}

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
  });
}

function h3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
  });
}

function steps(lines) {
  return lines.map((line, i) => {
    const prefix = `${i + 1}. `;
    const rest = textRunsFromString(line, { size: 22 });
    return new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: prefix, size: 22 }), ...rest],
    });
  });
}

/** Numbered list using Document `numbering.config` (Word list), not plain "1." text. */
function numberedSteps(reference, lines) {
  return lines.map(
    (line) =>
      new Paragraph({
        numbering: { reference, level: 0 },
        spacing: { after: 120 },
        children: textRunsFromString(line, { size: 22 }),
      }),
  );
}

function tableAppendix(title, headers, rows) {
  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20 })] })],
        }),
    ),
  });
  const dataRows = rows.map(
    (r) =>
      new TableRow({
        children: r.map(
          (cell) =>
            new TableCell({
              width: { size: 100 / r.length, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 18 })] })],
            }),
        ),
      }),
  );
  return [
    h2(title),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    }),
    new Paragraph({ text: "" }),
  ];
}

export function buildManualChildren(logoBuf) {
  const c = [];

  // ----- Cover -----
  c.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new ImageRun({
          type: "png",
          data: logoBuf,
          transformation: { width: 220, height: 99 },
        }),
      ],
    }),
  );
  c.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "NRCS Enterprise Asset Management System", bold: true, size: 36 })],
    }),
  );
  c.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: "User Manual", bold: true, size: 28 })],
    }),
  );
  c.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Version 1.0", size: 24 })],
    }),
  );
  c.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: "April 2026", size: 24 })],
    }),
  );
  c.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [new TextRun({ text: "Confidential — For Internal Use Only", bold: true, size: 22 })],
    }),
  );

  c.push(new Paragraph({ children: [new PageBreak()] }));

  // ----- TOC -----
  c.push(new Paragraph({ text: "Table of contents", heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }));
  c.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Right-click the table below in Word and choose Update field, then Update entire table.",
          italics: true,
          size: 20,
        }),
      ],
      spacing: { after: 120 },
    }),
  );
  c.push(
    new TableOfContents("Summary", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
  );

  c.push(new Paragraph({ children: [new PageBreak()] }));

  // ----- Chapter 1 -----
  c.push(h1("Chapter 1 — Introduction"));
  c.push(h2("1.1 About NRCS EAM"));
  c.push(
    p(
      "The **NRCS Enterprise Asset Management (EAM)** system helps the Nigerian Red Cross Society manage **facilities**, **fixed assets**, and **warehouse stock** in one place. You use it to record receipts, movements, requisitions, counts, and reports so branches and headquarters share the same accurate picture.",
    ),
  );
  c.push(shot("Sign-in page with NRCS branding"));

  c.push(h2("1.2 System overview and modules"));
  c.push(
    p(
      "The system is organised into modules you open from the **sidebar**: **Dashboard** for summaries; **Facilities** for sites and codes; **Assets** for vehicles, equipment, and buildings you track over time; **Inventory** for the warehouse ledger (incoming goods, outgoing deliveries, requisitions, transfers, counts, and adjustments); **Reports** for standard outputs; **Users** and **Settings** for administrators.",
    ),
  );
  c.push(shot("Main application sidebar showing module names"));

  c.push(h2("1.3 How to access the system"));
  c.push(
    p(
      "You reach the live system at **https://nrcseam.techivano.com**. Use a **current** version of **Google Chrome**, **Microsoft Edge**, or **Mozilla Firefox**. Keep your browser updated. Avoid very old devices where the screen may be too small to read tables safely.",
    ),
  );
  c.push(
    steps([
      "Open your browser and type the address exactly as your IT team gave it.",
      "Bookmark the page only if your local security rules allow bookmarks.",
      "If the site does not load, check your internet connection first, then contact support.",
    ]),
  );

  c.push(h2("1.4 Roles and permissions"));
  c.push(
    p(
      "**Admin** has full access, including creating users and changing system settings. **Manager** can approve requisitions, approve sensitive stock actions such as override where policy allows, and open all reports for the facilities they cover. **Staff / logistics officer** creates **Goods Received Notes (GRNs)**, **Waybills**, stock counts, and day-to-day stock records. **Field / branch secretary** views dashboards and raises **requisitions** for the branch. **Director / general manager** typically has **read-only** access to dashboards and reports so they can steer decisions without changing stock data.",
    ),
  );

  c.push(h2("1.5 Logging in"));
  c.push(
    steps([
      "Go to https://nrcseam.techivano.com.",
      "Enter the email address your administrator registered for you.",
      "Enter your password and choose Sign in.",
      "If your organisation uses extra sign-in steps, follow the prompts on screen.",
    ]),
  );
  c.push(shot("Email and password fields on the sign-in screen"));

  c.push(h2("1.6 Forgot password / resetting password"));
  c.push(
    ...numberedSteps("steps-1-6", [
      'On the login page, click **Forgot password?** below the Sign in button.',
      "Enter your email address and click **Send**.",
      'Check your email inbox for a message from **Supabase Auth** with subject **Reset Password**.',
      "Click the **Reset Password** link in the email. The link opens a secure page on the system.",
      "Enter your new password and confirm it. Your password must contain at least one **uppercase** letter, one **lowercase** letter, one **number**, and one **symbol**.",
      "Click **Set new password**.",
      "You will be redirected to the login page. Sign in with your new password.",
    ]),
  );
  c.push(
    p(
      "Note: The **reset link** expires after **one hour**. If it has expired, repeat from step 1. If you do not receive the email within **five minutes**, check your spam folder.",
    ),
  );

  c.push(h2("1.7 Navigating the system (sidebar, search, period selector)"));
  c.push(
    p(
      "The **sidebar** lists modules. Some screens include a **search** box to filter long lists. The **dashboard** and some reports let you pick a **period** (for example today, this week, this month, this quarter, or this year) so charts and totals match the dates you care about.",
    ),
  );
  c.push(
    steps([
      "Click a module name in the sidebar to open it.",
      "Use search or filters at the top of list pages to find a document or item faster.",
      "Change the period control where you see it, then wait for figures to refresh.",
    ]),
  );
  c.push(shot("Dashboard with period selector and sidebar visible"));

  // ----- Chapter 2 -----
  c.push(h1("Chapter 2 — Dashboard"));
  c.push(h2("2.1 Dashboard overview"));
  c.push(
    p(
      "The **dashboard** is the first helpful screen after you sign in. It highlights stock health, workload, and items that need a decision. What you see depends on your **role** and which **facilities** you may access.",
    ),
  );
  c.push(shot("Full dashboard layout"));

  c.push(h2("2.2 KPI cards explained"));
  c.push(h3("Low stock items"));
  c.push(p("Counts catalogue lines where on-hand stock has fallen below the minimum set for your view. Use it to plan reorders or internal transfers."));
  c.push(h3("Active facilities"));
  c.push(p("Shows how many **facilities** you work with under your permissions, not the total number in the whole country unless you have national access."));
  c.push(h3("Stock readiness index"));
  c.push(p("A single **score** summarising how well stocked you are against targets. Higher generally means fewer urgent gaps."));
  c.push(h3("Units distributed"));
  c.push(p("Totals **units** sent out on deliveries (Waybills and related flows) in the selected **period**."));
  c.push(h3("Average response time"));
  c.push(p("Shows how long approvals and hand-offs take on average so managers can spot bottlenecks."));
  c.push(shot("KPI cards row on the dashboard"));

  c.push(h2("2.3 Stock movement chart"));
  c.push(
    p(
      "The **stock movement** chart summarises how much stock moved **in** and **out** over time. Use it with the period selector to compare busy weeks with quiet ones.",
    ),
  );
  c.push(shot("Stock movement chart on dashboard"));

  c.push(h2("2.4 Needs your attention panel"));
  c.push(
    p(
      "This panel lists **exceptions** such as low lines, pending approvals, or data that passed a rule check. Click an item where the screen allows it to jump to the related work.",
    ),
  );

  c.push(h2("2.5 Switching views (Today / Week / Month / Quarter / Year)"));
  c.push(
    steps([
      "Find the period control on the dashboard (wording may say Today, Week, Month, and so on).",
      "Click the range you need.",
      "Wait for numbers and charts to refresh before taking screenshots for reports.",
    ]),
  );

  c.push(h2("2.6 Role-based dashboard differences"));
  c.push(
    p(
      "**Branch** users may see only their branch totals. **National** roles may roll up many facilities. **Read-only** senior roles see trends without edit buttons on sensitive widgets.",
    ),
  );

  // ----- Chapter 3 -----
  c.push(h1("Chapter 3 — Facilities management"));
  c.push(h2("3.1 What is a facility?"));
  c.push(
    p(
      "A **facility** is any place the Society records in EAM: **National Headquarters**, **branches**, **divisions**, **clinics**, **warehouses**, and similar sites. Each facility has a **name**, **type**, **address**, and a short **facility code**.",
    ),
  );

  c.push(h2("3.2 Viewing facilities (All, National HQ, Branches, Divisions, Clinics, Warehouses)"));
  c.push(
    steps([
      "Open **Facilities** from the sidebar.",
      "Use tabs or filters for **All**, **National HQ**, **Branches**, **Divisions**, **Clinics**, and **Warehouses** as your screen shows them.",
      "Click a row to open details when you need to edit or check the code.",
    ]),
  );
  c.push(shot("Facilities list with type filters"));

  c.push(h2("3.3 Adding a new facility"));
  c.push(
    ...numberedSteps("steps-3-3", [
      "Go to **Facilities** in the sidebar.",
      "Click the **Add Facility** button (top right).",
      "Enter the **Facility code** (for example **KAN-001**). Codes must be **2 to 15** characters, **uppercase** letters, numbers, and hyphens only.",
      "Enter the full **Facility name**.",
      "Select the **Facility type** from the dropdown: **National Headquarters**, **Branch**, **Division**, **Clinic**, or **Warehouse**.",
      "For **Clinic** and **Warehouse** types, select the **Parent facility** they belong to.",
      "Enter the **address**, **city**, **state**, and **postal code**.",
      "Optionally enter **latitude** and **longitude** for map view.",
      "Enter a **contact name**, **phone**, and **email**.",
      "Set **Status** to **Active**.",
      "Click **Create Facility**.",
    ]),
  );

  c.push(h2("3.4 Editing facility details"));
  c.push(
    ...numberedSteps("steps-3-4", [
      "Go to **Facilities** and find the facility to edit.",
      "Click on the **facility name** to open its detail page.",
      "Click the **Edit** button.",
      "Update the fields you need to change. Note: changing the **facility code** after documents have been issued will affect **document number** display. Consult your **administrator** first.",
      "Click **Save changes**.",
    ]),
  );

  c.push(h2("3.5 Facility codes and their importance for document numbering"));
  c.push(
    p(
      "The **facility code** is a short tag (for example **NHQ**, **LAG**) embedded in printed numbers such as **Goods Received Notes** and **Waybills**. Once stock documents exist, changing a code is difficult, so choose carefully and align with finance and logistics.",
    ),
  );

  c.push(h2("3.6 Importing facilities from Excel"));
  c.push(h3("Downloading the template"));
  c.push(
    steps([
      "Open **Facilities** and find **Import** (or Download template).",
      "Save the Excel template to a folder you can find.",
      "Do not rename required column headers.",
    ]),
  );
  c.push(h3("Filling in the template"));
  c.push(
    p(
      "Enter one row per facility with the columns the template describes. Use consistent spelling for state and city names. Leave optional columns blank only if the template says they are optional.",
    ),
  );
  c.push(h3("Uploading the file"));
  c.push(
    steps([
      "Choose **Upload** and pick your saved file.",
      "Wait until the system finishes checking each row.",
      "If errors appear, fix the spreadsheet and upload again.",
    ]),
  );
  c.push(h3("Understanding import results"));
  c.push(
    p(
      "The screen lists **rows accepted**, **rows skipped**, and **error messages**. Save a copy of the error list for your administrator if you cannot clear the errors yourself.",
    ),
  );
  c.push(shot("Facilities import results grid"));

  // ----- Chapter 4 -----
  c.push(h1("Chapter 4 — Assets management"));
  c.push(h2("4.1 What is an asset?"));
  c.push(
    p(
      "An **asset** is a long-lived item the Society tracks for accountability and maintenance: vehicles, generators, buildings, major tools, and similar. Assets are separate from **consumable warehouse stock**.",
    ),
  );

  c.push(h2("4.2 Asset categories"));
  c.push(
    p(
      "Categories group similar assets for reporting (for example **vehicles**, **medical equipment**). Pick the category your administrator defined that best matches the item.",
    ),
  );

  c.push(h2("4.3 Viewing the asset register"));
  c.push(
    steps([
      "Open **Assets** from the sidebar.",
      "Use search and filters to narrow by facility or category.",
      "Open a row to see full detail, history, and attachments if your role allows.",
    ]),
  );
  c.push(shot("Asset register table"));

  c.push(h2("4.4 Adding a new asset"));
  c.push(
    ...numberedSteps("steps-4-4", [
      "Go to **Assets** in the sidebar.",
      "Click **Add Asset** (top right).",
      "Enter the **Asset tag** (a unique identifier for this item, for example **VEH-NHQ-001**).",
      "Enter the **Asset name** and **description**.",
      "Select the **Category** that matches this item.",
      "Select the **Facility** where this asset is located.",
      "Enter **Manufacturer**, **Model**, and **Serial number** if available.",
      "Set the **Status** (**Active**, **Under maintenance**, **Decommissioned**).",
      "Click **Create Asset**. The system generates a **QR code** for this asset automatically.",
    ]),
  );

  c.push(h2("4.5 Scanning a QR code to find an asset"));
  c.push(
    steps([
      "Open the **mobile-friendly** asset lookup or scan screen your deployment provides.",
      "Point the device camera at the **QR code** on the asset label.",
      "Confirm the on-screen record matches the physical item before you move or service it.",
    ]),
  );
  c.push(shot("QR scan or asset lookup screen"));

  c.push(h2("4.6 Asset transfers between facilities"));
  c.push(
    steps([
      "Open the asset record at the **sending** facility.",
      "Start a **transfer** and choose the **receiving** facility.",
      "Add hand-over notes, condition, and signatures as your form requires.",
      "Complete the transfer so both facilities see the new location.",
    ]),
  );

  c.push(h2("4.7 Maintenance scheduling"));
  c.push(
    p(
      "Use **maintenance** fields or linked tasks to record next service dates and responsible persons. Managers can filter assets that are **due soon** or **overdue**.",
    ),
  );

  c.push(h2("4.8 Asset reports"));
  c.push(
    steps([
      "Open **Reports** (or **Assets → Reports** if split that way).",
      "Pick the asset report you need (register, movement, maintenance due).",
      "Set facility and date filters, then generate.",
      "Export to **PDF** or **Excel** for filing or meetings.",
    ]),
  );

  // ----- Chapter 5 -----
  c.push(h1("Chapter 5 — Inventory management (WMS)"));
  c.push(h2("5.1 Overview of the WMS ledger"));
  c.push(
    p(
      "The **warehouse management** area keeps a **ledger**: every receipt, issue, transfer, adjustment, and count updates balances by **item**, **facility**, and **Commodity Tracking Number (CTN)**. Think of the ledger as the official story of what arrived, what moved, and what is still on hand.",
    ),
  );

  c.push(h2("5.2 Understanding CTNs (Commodity Tracking Numbers)"));
  c.push(
    p(
      "A **CTN** groups stock that shares the same donor lot, shipment, or accounting treatment. When you receive mixed items under one shipment, you still attach lines to the correct **CTN** so later issues preserve donor reporting.",
    ),
  );

  c.push(h2("5.3 Donors and donor attribution"));
  c.push(
    p(
      "Each line of stock carries a **donor** (for example **IFRC**, **ICRC**, **USAID**). Reports roll up contributions by donor. **BLENDED** appears when a **kit** is built from parts that came from more than one donor; the system keeps the underlying detail for audits.",
    ),
  );

  c.push(h2("5.4 Stock overview — viewing current stock levels"));
  c.push(
    steps([
      "Open **Inventory** and choose **Stock overview** (or similar wording).",
      "Filter by facility, item, donor, or CTN as needed.",
      "Read **on hand**, **reserved**, and **available** columns using the on-screen help text if shown.",
    ]),
  );
  c.push(shot("Stock overview grid with filters"));

  c.push(h2("5.5 The inventory sidebar explained"));
  c.push(
    p(
      "Under **Inventory** you will typically see: **Incoming** (GRNs), **Outgoing** (Waybills), **Requisitions**, **Transfers** between stores, **Stock takes** (counts), and **Adjustments** for approved corrections. Open each section from the sidebar the same way you open other modules.",
    ),
  );

  // ----- Chapter 6 -----
  c.push(h1("Chapter 6 — Goods Received Notes (GRN)"));
  c.push(h2("6.1 When to create a GRN"));
  c.push(
    p(
      "Create a **GRN** whenever goods **arrive** at a warehouse or receiving point and you must record quantities, donor, and condition officially. Do not skip the GRN when the shipment will enter the ledger.",
    ),
  );

  c.push(h2("6.2 Creating a GRN step by step"));
  c.push(h3("Select facility and date"));
  c.push(
    steps([
      "Open **Inventory → Incoming → GRN** (wording may vary slightly).",
      "Choose **New GRN**.",
      "Select the **receiving facility** and the **receipt date** (use the real offload date).",
    ]),
  );
  c.push(h3("Add donor and transport details"));
  c.push(
    steps([
      "Pick the **donor** from the list or enter **CUSTOM** details if policy allows.",
      "Record transport information (carrier, vehicle, waybill reference from supplier) in the fields your form shows.",
    ]),
  );
  c.push(h3("Create or select CTN"));
  c.push(
    steps([
      "Create a **new CTN** for a fresh shipment identity, or link to an existing CTN only when your SOP says the shipment continues the same lot.",
      "Check the CTN description matches what is on the packing list.",
    ]),
  );
  c.push(h3("Add line items"));
  c.push(
    steps([
      "Add each catalogue line with **quantity** and **unit of measure**.",
      "Enter batch, manufacture, or expiry information when the item requires it.",
      "Attach notes for damage or short count before you finalise.",
    ]),
  );
  c.push(h3("Signatures"));
  c.push(
    p(
      "Complete **receiver**, **deliverer**, and **witness** signature fields as your paper process requires. Printed copies should show the same names you typed.",
    ),
  );
  c.push(shot("GRN header and lines editor"));

  c.push(h2("6.3 GRN number format"));
  c.push(
    p(
      "Printed GRNs use the pattern **NRCS-{FACILITY_CODE}-{YEAR}-{SEQ}** where **SEQ** is the next number for that facility and year.",
    ),
  );

  c.push(h2("6.4 Saving as draft vs finalising"));
  c.push(
    p(
      "**Draft** lets you pause while you check weights and donor papers. **Finalise** locks the GRN into the ledger and updates stock. After finalising, corrections usually need an **adjustment** or controlled reversal per policy—do not rely on deleting the GRN.",
    ),
  );

  c.push(h2("6.5 Printing a GRN (four copies)"));
  c.push(
    steps([
      "Open the **final** GRN and choose **Print**.",
      "Print **four** copies on the correct paper if your warehouse colour code is in force.",
      "**White** copy: returned to sender or donor file as your SOP states.",
      "**Green** copy: reporting / programme file.",
      "**Blue** copy: logistics office file.",
      "**Yellow** copy: warehouse file at the receiving bin.",
    ]),
  );

  c.push(h2("6.6 Viewing and searching GRN history"));
  c.push(
    steps([
      "Open **GRN history** (or the GRN list).",
      "Search by number, date, donor, or item text.",
      "Open a row to reprint or audit; use export if you need a spreadsheet.",
    ]),
  );

  // ----- Chapter 7 -----
  c.push(h1("Chapter 7 — Waybills (delivery notes)"));
  c.push(h2("7.1 When to create a Waybill"));
  c.push(
    p(
      "Create a **Waybill** when stock **leaves** a sending warehouse for a branch, project, or another warehouse. It is your controlled delivery note and updates outgoing stock when **dispatched**.",
    ),
  );

  c.push(h2("7.2 Creating a Waybill step by step"));
  c.push(h3("Source warehouse and destination"));
  c.push(
    steps([
      "Open **Inventory → Outgoing → Waybill** and choose **New**.",
      "Select the **source warehouse** and the **destination facility**.",
      "Set the dispatch date you plan to use on paperwork.",
    ]),
  );
  c.push(h3("Linking to a requisition (optional)"));
  c.push(
    p(
      "If an approved **requisition** exists, link it so quantities and approvals stay tied together. If there is no requisition (emergency movement), follow local policy for approvals before dispatch.",
    ),
  );
  c.push(h3("Adding line items with CTN sources"));
  c.push(
    steps([
      "Add each item line with quantity and unit.",
      "For each line, pick which **CTN** the quantity will consume first.",
      "If several CTNs fund one line, split into multiple lines or follow the on-screen split tool if provided.",
    ]),
  );
  c.push(h3("Multi-CTN dispatch"));
  c.push(
    p(
      "**Multi-CTN dispatch** means one Waybill line may draw from more than one donor lot. The system reduces each CTN balance in order you confirm.",
    ),
  );
  c.push(h3("Manager override for expired stock"));
  c.push(
    p(
      "If an item is **past expiry**, the system normally blocks dispatch. A **manager** with the right permission may record an **override** with a reason when policy and law allow it. Never bypass this outside approved rules.",
    ),
  );
  c.push(shot("Waybill lines with CTN pickers"));

  c.push(h2("7.3 Dispatching a Waybill"));
  c.push(
    steps([
      "Verify quantities, vehicle details, and signatures.",
      "Choose **Dispatch** when the load physically leaves.",
      "Confirm status moves from **Draft** to **Dispatched** and stock falls at the source.",
    ]),
  );

  c.push(h2("7.4 Printing a Waybill (four copies)"));
  c.push(
    steps([
      "Open the **dispatched** Waybill.",
      "Print four copies following the same **white / green / blue / yellow** filing rule your branch uses for GRNs unless SOP differs.",
      "Have driver and receiver sign where the form indicates.",
    ]),
  );

  c.push(h2("7.5 Waybill status (Draft → Dispatched)"));
  c.push(
    p(
      "**Draft** means you are still editing. **Dispatched** means stock has left and balances updated. You cannot treat a draft as a legal movement.",
    ),
  );

  // ----- Chapter 8 -----
  c.push(h1("Chapter 8 — Stock cards and bin cards"));
  c.push(h2("8.1 What is a stock card?"));
  c.push(
    p(
      "A **stock card** is the formal running record for an item (or item and CTN) at a location. It lists receipts, issues, and balances in chronological order for audit.",
    ),
  );

  c.push(h2("8.2 What is a bin card?"));
  c.push(
    p(
      "A **bin card** tracks physical movement for a **bin location** inside a store. It supports wall charts at the shelf while the stock card stays the master ledger view.",
    ),
  );

  c.push(h2("8.3 Viewing stock card ledger"));
  c.push(
    steps([
      "Open **Stock cards** from the inventory menu.",
      "Filter by facility, item, and date range.",
      "Export or print when auditors request a period slice.",
    ]),
  );

  c.push(h2("8.4 Adding a stock check entry"));
  c.push(
    steps([
      "Open the relevant stock card.",
      "Choose **Add check** (or equivalent).",
      "Enter counted quantity, variance reason, and initials required by SOP.",
      "Save so the variance appears in the approval queue if needed.",
    ]),
  );

  c.push(h2("8.5 Retroactive entry mode"));
  c.push(
    p(
      "**Retroactive entry** lets authorised users post a dated movement into an earlier period when paperwork was late. Use only with manager approval; the system keeps the true entry timestamp for audit.",
    ),
  );

  c.push(h2("8.6 Bin card lifecycle (open → close)"));
  c.push(
    p(
      "Open a **bin card** when a location starts holding the item. **Close** it when the bin is emptied or the item moves to another bin, so old cards are not confused with live stock.",
    ),
  );

  c.push(h2("8.7 Printing stock cards and bin cards"));
  c.push(
    steps([
      "Open the card view.",
      "Choose **Print** and select the date range to include.",
      "Sign printed cards where your warehouse procedure requires.",
    ]),
  );

  // ----- Chapter 9 -----
  c.push(h1("Chapter 9 — Requisitions"));
  c.push(h2("9.1 Raising a requisition"));
  c.push(
    steps([
      "Open **Requisitions** and choose **New**.",
      "Select your **requesting facility** and the **needed-by date** if shown.",
      "Add lines with item, quantity, and justification notes.",
      "Submit for approval; note the reference number you receive.",
    ]),
  );

  c.push(h2("9.2 Requisition approval workflow"));
  c.push(
    p(
      "A **manager** reviews submitted lines, may change quantities, and **approves** or **rejects** with comments. You see status change on the same list without refreshing email.",
    ),
  );

  c.push(h2("9.3 Linking a requisition to a Waybill"));
  c.push(
    p(
      "When logistics prepares a delivery, they create or open a **Waybill** and **link** the approved requisition so issued quantities match what was approved.",
    ),
  );

  c.push(h2("9.4 Tracking requisition status"));
  c.push(
    steps([
      "Open **Requisitions** and search by reference or item.",
      "Read the **status** column (submitted, approved, rejected, fulfilled).",
      "Open the detail page to see linked Waybills when they exist.",
    ]),
  );

  // ----- Chapter 10 -----
  c.push(h1("Chapter 10 — Stock counts and adjustments"));
  c.push(h2("10.1 Scheduling a stock count"));
  c.push(
    steps([
      "Agree the count date with the warehouse manager.",
      "Open **Stock counts** and create a **scheduled count** for the facility and zone.",
      "Notify staff to pause unrelated movements if your SOP requires a freeze.",
    ]),
  );

  c.push(h2("10.2 Recording count results"));
  c.push(
    steps([
      "Open the active count session.",
      "Enter counted quantities line by line or by scan if enabled.",
      "Save sections as you go; do not leave the session idle past timeout without saving.",
    ]),
  );

  c.push(h2("10.3 Approving count variances"));
  c.push(
    p(
      "Managers review **variances** between system and counted quantities. Large or sensitive variances may need a second signature under finance rules.",
    ),
  );

  c.push(h2("10.4 Stock adjustments"));
  c.push(
    steps([
      "Open **Adjustments** after approval to post the net change.",
      "Choose reason codes (damage, found stock, data correction) exactly as finance lists them.",
      "Attach photos or police reports when the adjustment follows an incident.",
      "Finalise so the ledger matches the warehouse floor.",
    ]),
  );

  // ----- Chapter 11 -----
  c.push(h1("Chapter 11 — Kit assembly and disassembly"));
  c.push(h2("11.1 What is a kit?"));
  c.push(
    p(
      "A **kit** is a bundle item (for example **family hygiene kit**) built from several **component** lines. The system tracks both the finished kit and the parts you consumed.",
    ),
  );

  c.push(h2("11.2 Assembling a kit from components"));
  c.push(
    steps([
      "Open **Kit assembly** (or Kits under Inventory).",
      "Choose the **kit catalogue** item to build.",
      "Pick component CTNs and quantities per the standard bill of materials.",
      "Run **Assemble**; confirm new kit stock appears under the output CTN you chose.",
    ]),
  );

  c.push(h2("11.3 BLENDED donor attribution"));
  c.push(
    p(
      "When components came from different donors, the finished kit may show **BLENDED** as the donor tag for reporting, while the system keeps each source line in the audit trail.",
    ),
  );

  c.push(h2("11.4 Disassembling a kit"));
  c.push(
    steps([
      "Open an existing kit build record if disassembly is allowed for your role.",
      "Choose **Disassemble** and confirm which components return to stock.",
      "Verify donor tags return to the correct CTNs per policy.",
    ]),
  );

  // ----- Chapter 12 -----
  c.push(h1("Chapter 12 — Transfers"));
  c.push(h2("12.1 Initiating a stock transfer"));
  c.push(
    steps([
      "Open **Transfers** and choose **New**.",
      "Select **from facility** and **to facility**.",
      "Add lines with item, quantity, CTN, and transport notes.",
      "Submit so the receiving site can see the incoming record.",
    ]),
  );

  c.push(h2("12.2 Receiving a transfer"));
  c.push(
    steps([
      "Open the incoming transfer at the **receiving** facility.",
      "Check quantities against the physical load.",
      "Accept or report shortage with photos and comments.",
    ]),
  );

  c.push(h2("12.3 Transfer records in the ledger"));
  c.push(
    p(
      "After completion, both facilities see the movement in **history** views and stock balances update. Use **reports** to prove chain of custody if auditors ask.",
    ),
  );

  // ----- Chapter 13 -----
  c.push(h1("Chapter 13 — Import (Excel and PDF)"));
  c.push(h2("13.1 Importing from Excel"));
  c.push(h3("Available templates"));
  c.push(
    p(
      "Download the latest **Excel templates** from the import screen (GRNs, facilities, catalogue updates—only what your administrator enabled). Always use the version bundled with your release.",
    ),
  );
  c.push(h3("Filling in templates"));
  c.push(
    steps([
      "Read the **instructions** sheet first.",
      "Enter data row by row without merging cells.",
      "Keep dates in the format the template example shows.",
    ]),
  );
  c.push(h3("Validation grid"));
  c.push(
    p(
      "After upload, the **validation grid** colours errors and shows messages per row. Fix the spreadsheet and re-upload until the grid is clean or only warnings you are allowed to ignore.",
    ),
  );
  c.push(h3("Finalising drafts"));
  c.push(
    p(
      "Imported rows may land as **draft** documents. Open each draft, verify totals, then **finalise** so stock updates.",
    ),
  );
  c.push(shot("Excel import validation grid"));

  c.push(h2("13.2 Importing from typed PDF"));
  c.push(
    steps([
      "Upload the donor PDF through the **PDF import** tool if enabled.",
      "Review the **side-by-side** view: original page next to extracted lines.",
      "Read the **confidence** score; edit low-confidence cells before saving.",
      "Approve and **finalise** into a draft GRN or attachment stack per your workflow.",
    ]),
  );

  // ----- Chapter 14 -----
  c.push(h1("Chapter 14 — Reports"));
  c.push(h2("14.1 Monthly warehouse report"));
  c.push(h3("Generating the report"));
  c.push(
    steps([
      "Open **Reports → Monthly warehouse report**.",
      "Select **facility** and **month**.",
      "Choose **Generate** and wait for totals.",
    ]),
  );
  c.push(h3("Exporting to PDF"));
  c.push(
    steps([
      "From the preview, choose **Export PDF**.",
      "Pick a file name that includes facility code and month.",
      "Store the PDF in the branch document drive.",
    ]),
  );
  c.push(h3("Exporting to Excel"));
  c.push(
    steps([
      "Choose **Export Excel** when you need to sort columns further.",
      "Do not edit the official copy after export; make working copies instead.",
    ]),
  );
  c.push(h3("Emailing the report"));
  c.push(
    p(
      "If **Email** appears for your role, confirm recipients and subject line, then send. Keep a sent copy for audit.",
    ),
  );

  c.push(h2("14.2 WMS report suite"));
  c.push(
    p(
      "Open each report from the **WMS reports** menu: **Stock movements** shows ins and outs over a period; **CTN aging** highlights lots held too long; **Donor contribution** summarises value or quantity by donor; **Loss and damage** lists approved write-offs; **Kit assembly audit** lists builds and BLENDED kits.",
    ),
  );

  c.push(h2("14.3 Asset reports"));
  c.push(
    p(
      "Use **asset** reports for register extracts, maintenance due lists, and transfer history. Filters match the asset module fields.",
    ),
  );

  c.push(h2("14.4 Understanding report data"));
  c.push(
    p(
      "Figures always respect your **facility access** and the **as-at** date on the filter. If two reports disagree, check whether one includes **draft** documents and the other only **final** records.",
    ),
  );

  // ----- Chapter 15 -----
  c.push(h1("Chapter 15 — User management (Admin only)"));
  c.push(h2("15.1 Creating a new user account"));
  c.push(
    steps([
      "Sign in as **Admin**.",
      "Open **Users** (or **Settings → Users**).",
      "Choose **Create user**.",
      "Enter full name, work email, and phone if required.",
      "Save and continue to role assignment.",
    ]),
  );

  c.push(h2("15.2 Assigning roles and facilities"));
  c.push(
    steps([
      "Tick the **roles** that match the job description.",
      "Assign **facilities** the person may view or operate.",
      "Save; ask the user to sign in immediately to confirm access fits the job.",
    ]),
  );

  c.push(h2("15.3 Deactivating a user"));
  c.push(
    steps([
      "Open the user record.",
      "Set **Active** to off (or choose Deactivate).",
      "Save and record the date in your HR exit checklist.",
    ]),
  );

  c.push(h2("15.4 Resetting a user password"));
  c.push(
    steps([
      "Open the user record.",
      "Choose **Send reset** or **Set temporary password** per your policy.",
      "Tell the user to change the password on first sign-in.",
    ]),
  );

  c.push(h2("15.5 Welcome email"));
  c.push(
    p(
      "If your deployment sends **welcome** messages, confirm the template includes the correct URL **https://nrcseam.techivano.com** and a short guide link. Test with a dummy account after any template change.",
    ),
  );

  // ----- Chapter 16 -----
  c.push(h1("Chapter 16 — Settings"));
  c.push(h2("16.1 Notification preferences"));
  c.push(
    steps([
      "Open **Settings → Notifications** (wording may vary).",
      "Choose which email alerts you want for approvals, low stock, or mentions.",
      "Save and send yourself a test if the button exists.",
    ]),
  );

  c.push(h2("16.2 Facility notification settings"));
  c.push(
    p(
      "**Admins** can set which events notify each facility’s inbox (for example low stock at a national hub). Keep lists short so staff read them.",
    ),
  );

  c.push(h2("16.3 System settings"));
  c.push(
    p(
      "**System settings** cover organisation-wide defaults: measurement units, numbering prefixes, and integration switches. Change only with change-control minutes.",
    ),
  );

  // ----- Chapter 17 -----
  c.push(h1("Chapter 17 — Troubleshooting"));
  c.push(h2("17.1 Cannot log in"));
  c.push(
    steps([
      "Check caps lock and keyboard layout.",
      "Try **Forgot password** once.",
      "Try another browser.",
      "Ask an **Admin** to confirm the account is active and uses the correct email.",
    ]),
  );

  c.push(h2("17.2 Forgot password"));
  c.push(
    p(
      "Follow section **1.6**. If mail never arrives, your mail server may block automated messages—ask IT to allow-list the sender domain your administrator provides.",
    ),
  );

  c.push(h2("17.3 Import file rejected"));
  c.push(
    steps([
      "Download a **fresh** template; do not reuse an old file with hidden columns.",
      "Remove merged cells and fancy formatting.",
      "Upload again and read each error line literally—often a wrong date format.",
    ]),
  );

  c.push(h2("17.4 Print view not showing correctly"));
  c.push(
    steps([
      "Use **Print preview** before sending to the printer.",
      "Set margins to **Default**.",
      "Try **Landscape** if a wide table clips.",
      "Update the browser if preview is blank.",
    ]),
  );

  c.push(h2("17.5 Contact system administrator"));
  c.push(
    p(
      "Collect your **facility name**, **user email**, **approximate time** of the issue, and a **screenshot** (if allowed). Send them to your national or branch IT focal point. For data corrections after final documents, also copy the logistics manager.",
    ),
  );

  // ----- Appendices -----
  c.push(h1("Appendix A — Facility codes reference"));
  c.push(
    p(
      "This table lists **NRCS facilities** referenced for this manual (April 2026). Use **Facilities** in the live system if a site has been added or renamed since publication.",
    ),
  );
  c.push(
    ...tableAppendix("Facility codes", ["Code", "Name", "Type", "State"], FACILITY_REFERENCE_ROWS),
  );

  c.push(h1("Appendix B — IFRC catalogue items"));
  c.push(
    p(
      "This appendix lists **68** live **IFRC reference catalogue items** used in **NRCS EAM** inventory (consumable warehouse stock). Some items formerly listed here were **reclassified** to **Assets**. Always confirm lines on screen when issuing stock.",
    ),
  );
  const catRows = catalogue.map((row) => [row.itemCode, row.name, row.category]);
  c.push(
    ...tableAppendix("Catalogue reference", ["Item code", "Description", "Category"], catRows),
  );

  c.push(h1("Appendix C — Donor codes reference"));
  c.push(
    p(
      "Use this table when you see a short **donor code** on CTNs, GRNs, or reports. Full legal names appear on printed documents where space allows.",
    ),
  );
  c.push(...tableAppendix("Donor codes", ["Code", "Organisation"], DONORS));

  c.push(h1("Appendix D — Document number formats"));
  c.push(
    p(
      "**GRN:** NRCS-{FACILITY_CODE}-{YYYY}-{SEQ}. **Waybill:** NRCS-{FACILITY_CODE}-{YYYY}-WB-{SEQ}. Replace placeholders with the real facility code, calendar year, and sequence issued by the system.",
    ),
  );

  return c;
}
