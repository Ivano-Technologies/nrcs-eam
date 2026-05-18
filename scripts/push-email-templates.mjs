/**
 * Push Supabase Auth email templates from server/email-templates/*.html
 * to the project via the Supabase Management API.
 *
 * Usage: node scripts/push-email-templates.mjs
 *
 * Requires:
 *   SUPABASE_PROJECT_REF
 *   SUPABASE_MANAGEMENT_API_KEY  (personal access token from dashboard/account/tokens)
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

config({ path: resolve(root, ".env.local") });
config({ path: resolve(root, ".env") });

const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
const apiKey = process.env.SUPABASE_MANAGEMENT_API_KEY?.trim();

if (!projectRef || !apiKey) {
  console.error(
    "[push-email-templates] Missing SUPABASE_PROJECT_REF or SUPABASE_MANAGEMENT_API_KEY.\n" +
      "Add them to .env.local (see .env.example)."
  );
  process.exit(1);
}

/** Maps repo template ids → Management API auth config keys. */
const TEMPLATES = [
  {
    id: "reset_password",
    file: "reset-password.html",
    subjectKey: "mailer_subjects_recovery",
    contentKey: "mailer_templates_recovery_content",
    subject: "Reset your NRCS EAM password",
  },
  {
    id: "confirmation",
    file: "confirmation.html",
    subjectKey: "mailer_subjects_confirmation",
    contentKey: "mailer_templates_confirmation_content",
    subject: "Confirm your NRCS EAM account",
  },
  {
    id: "invite",
    file: "invite.html",
    subjectKey: "mailer_subjects_invite",
    contentKey: "mailer_templates_invite_content",
    subject: "You have been invited to NRCS EAM",
  },
];

const templatesDir = resolve(root, "server/email-templates");

async function loadTemplateHtml(filename) {
  const path = resolve(templatesDir, filename);
  const html = await readFile(path, "utf8");
  return html.trim();
}

async function main() {
  const payload = {};

  for (const t of TEMPLATES) {
    const content = await loadTemplateHtml(t.file);
    payload[t.subjectKey] = t.subject;
    payload[t.contentKey] = content;
    console.log(`[push-email-templates] Loaded ${t.id} ← ${t.file} (${content.length} chars)`);
  }

  const url = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
  console.log(`[push-email-templates] PATCH ${url}`);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    console.error(
      `[push-email-templates] Failed (${response.status} ${response.statusText}):`,
      typeof body === "string" ? body : JSON.stringify(body, null, 2)
    );
    process.exit(1);
  }

  console.log("[push-email-templates] Success — updated templates:");
  for (const t of TEMPLATES) {
    console.log(`  • ${t.id} (${t.contentKey})`);
  }
}

main().catch((err) => {
  console.error("[push-email-templates] Unexpected error:", err);
  process.exit(1);
});
