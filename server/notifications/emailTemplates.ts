import { generateEmailTemplate } from "../emailService";

const APP_BASE = "/app";

/** Match client `appPath`: paths under `/app`. */
function appPath(subPath: string): string {
  if (!subPath || subPath === "/") return APP_BASE;
  const s = subPath.startsWith("/") ? subPath : `/${subPath}`;
  return `${APP_BASE}${s}`;
}

function absoluteAppUrl(subPath: string): string {
  const origin = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173").replace(/\/$/, "");
  return `${origin}${appPath(subPath)}`;
}

export function lowStockEmail(params: {
  itemName: string;
  currentStock: number;
  reorderPoint: number;
  facilityName: string;
  link: string;
}): { subject: string; html: string } {
  const subject = `Low stock: ${params.itemName}`;
  const body = `
    <p><strong>${params.itemName}</strong> at <strong>${params.facilityName}</strong> is below the minimum.</p>
    <ul>
      <li>Current stock: <strong>${params.currentStock}</strong></li>
      <li>Reorder point: <strong>${params.reorderPoint}</strong></li>
    </ul>
    <p><a href="${params.link}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#1E3A8A;color:#fff;text-decoration:none;border-radius:6px;">Review inventory</a></p>
  `;
  return { subject, html: generateEmailTemplate(body, "Low stock alert") };
}

export function requisitionStatusEmail(params: {
  refNumber: string;
  status: string;
  items: string[];
  approverName: string;
  link: string;
}): { subject: string; html: string } {
  const subject = `Requisition ${params.refNumber}: ${params.status}`;
  const itemsHtml =
    params.items.length > 0
      ? `<ul>${params.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
      : "<p><em>No line items listed.</em></p>";
  const body = `
    <p>Your requisition <strong>${escapeHtml(params.refNumber)}</strong> is now <strong>${escapeHtml(params.status)}</strong>.</p>
    <p>Updated by: <strong>${escapeHtml(params.approverName)}</strong></p>
    <p>Line items:</p>
    ${itemsHtml}
    <p><a href="${params.link}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#1E3A8A;color:#fff;text-decoration:none;border-radius:6px;">Open requisition</a></p>
  `;
  return { subject, html: generateEmailTemplate(body, "Requisition update") };
}

export function assetCheckReminderEmail(params: {
  facilityName: string;
  assets: Array<{ tag: string; name: string; lastCheck: string }>;
  link: string;
}): { subject: string; html: string } {
  const subject = `Physical check reminder — ${params.facilityName}`;
  const rows = params.assets
    .map(
      (a) =>
        `<tr><td style="padding:6px;border:1px solid #e5e7eb;">${escapeHtml(a.tag)}</td><td style="padding:6px;border:1px solid #e5e7eb;">${escapeHtml(a.name)}</td><td style="padding:6px;border:1px solid #e5e7eb;">${escapeHtml(a.lastCheck)}</td></tr>`
    )
    .join("");
  const body = `
    <p>The following assets at <strong>${escapeHtml(params.facilityName)}</strong> need a physical check (none in the last 6 months, or never checked).</p>
    <table style="border-collapse:collapse;width:100%;max-width:560px;">
      <thead><tr><th align="left" style="padding:6px;border:1px solid #e5e7eb;">Tag</th><th align="left" style="padding:6px;border:1px solid #e5e7eb;">Name</th><th align="left" style="padding:6px;border:1px solid #e5e7eb;">Last check</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><a href="${params.link}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#1E3A8A;color:#fff;text-decoration:none;border-radius:6px;">View assets</a></p>
  `;
  return { subject, html: generateEmailTemplate(body, "Asset physical check") };
}

export function formatRequisitionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    submitted: "Submitted",
    branch_approved: "Branch approved",
    hq_approved: "HQ approved",
    rejected: "Rejected",
    fulfilled: "Fulfilled",
    cancelled: "Cancelled",
    draft: "Draft",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

export function inventoryLowStockLink(): string {
  return absoluteAppUrl("/inventory");
}

export function requisitionDetailLink(requisitionId: number): string {
  return absoluteAppUrl(`/inventory/requisitions?id=${requisitionId}`);
}

export function assetsListLink(): string {
  return absoluteAppUrl("/assets");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
