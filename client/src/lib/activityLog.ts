import { formatEnumLabel } from "@/lib/format";

/** Keys shown first, as plain values (no label), when an audit entry's details are JSON. */
const PRIMARY_DETAIL_KEYS = ["email", "name", "assetTag", "title", "workOrderNumber", "code", "message", "reason"];

/** "login" → "Signed in", "create_work_order" → "Create work order". */
export function formatActivityAction(action: string | null | undefined): string {
  return formatEnumLabel(action ?? "");
}

/**
 * "auth:2" → the signed in user's name; "work_order:5" → "Work order #5"; "system" → "System".
 * Raw `type:id` strings never reach the UI.
 */
export function formatActivityResource(resource: string | null | undefined, userLabel?: string | null): string {
  if (!resource) return "";
  const [type, id] = resource.split(":");
  if ((type === "auth" || type === "session") && userLabel) return userLabel;
  const label = formatEnumLabel(type);
  return id ? `${label} #${id}` : label;
}

function primitiveText(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return null;
}

/**
 * Audit details are stored as JSON text. Render known keys as plain text
 * ({"email":"a@b.com"} → "a@b.com"), other simple keys as "Label: value", and never raw JSON.
 */
export function formatActivityDetails(details: string | null | undefined): string {
  if (details == null) return "";
  const raw = String(details).trim();
  if (!raw) return "";
  if (!(raw.startsWith("{") || raw.startsWith("["))) return raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (Array.isArray(parsed)) {
    return parsed.map(primitiveText).filter(Boolean).join(", ");
  }
  if (!parsed || typeof parsed !== "object") return primitiveText(parsed) ?? "";
  const obj = parsed as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of PRIMARY_DETAIL_KEYS) {
    const text = primitiveText(obj[key]);
    if (text) parts.push(text);
  }
  for (const [key, value] of Object.entries(obj)) {
    if (PRIMARY_DETAIL_KEYS.includes(key)) continue;
    const text = primitiveText(value);
    if (text) {
      parts.push(`${formatEnumLabel(key)}: ${text}`);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      // Change sets like {"status":{"from":"a","to":"b"}}.
      const v = value as Record<string, unknown>;
      const from = primitiveText(v.from ?? v.old ?? v.before);
      const to = primitiveText(v.to ?? v.new ?? v.after);
      if (from || to) parts.push(`${formatEnumLabel(key)}: ${from ?? "none"} to ${to ?? "none"}`);
    }
  }
  return parts.join(", ");
}
