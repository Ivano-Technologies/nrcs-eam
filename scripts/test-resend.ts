/**
 * Send a one-off test email via Resend API (same path as server/emailService).
 * Requires RESEND_API_KEY in .env or process env.
 * Optional: TEST_RESEND_TO (defaults to PLAYWRIGHT_ADMIN_EMAIL or ivanonigeria@gmail.com).
 *
 * Run: pnpm test:resend
 */
import "dotenv/config";

const RESEND_URL = "https://api.resend.com/emails";

async function main() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.error("RESEND_API_KEY is not set");
    process.exit(1);
  }

  const to =
    process.env.TEST_RESEND_TO?.trim() ||
    process.env.PLAYWRIGHT_ADMIN_EMAIL?.trim() ||
    "ivanonigeria@gmail.com";
  const from = process.env.SMTP_FROM?.trim() ?? "onboarding@resend.dev";

  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `[nrcs-eam] Resend test ${new Date().toISOString()}`,
      html: "<p>Resend diagnostic from <code>scripts/test-resend.ts</code>.</p>",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error("Resend API failed:", response.status, response.statusText, text);
    process.exit(1);
  }

  let id: string | undefined;
  try {
    const json = JSON.parse(text) as { id?: string };
    id = json.id;
  } catch {
    // ignore
  }
  console.log("Resend OK", id ? `id=${id}` : text);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
