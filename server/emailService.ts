import { ENV } from './_core/env';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * When SMTP_HOST is set (e.g. Mailpit on 1025, Resend smtp.resend.com:465 in prod), send via nodemailer.
 * Otherwise use Manus Forge API if configured.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if ((process.env.SUPABASE_TEST_SCHEMA ?? "").trim() === "test") {
    console.log(`[email stub] skipped send to ${options.to}`);
    return true;
  }
  console.log("[email-debug] sendEmail called, SMTP_HOST:",
    process.env.SMTP_HOST ? "SET" : "NOT SET",
    "RESEND_API_KEY:",
    process.env.RESEND_API_KEY ? "SET" : "NOT SET",
    "forgeApiUrl:",
    ENV.forgeApiUrl ? "SET" : "NOT SET"
  );
  if (process.env.RESEND_API_KEY) {
    try {
      const from = process.env.SMTP_FROM ?? "onboarding@resend.dev";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [options.to],
          subject: options.subject,
          html: options.html,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        return true;
      }
      const errText = await response.text();
      console.error(
        "[email] Resend API failed:",
        response.status,
        response.statusText,
        errText
      );
    } catch (error) {
      console.error("[email] Resend API error:", error);
    }
  }
  const smtpHost = process.env.SMTP_HOST ?? process.env.MAILPIT_SMTP_HOST;
  if (smtpHost) {
    try {
      const nodemailer = await import("nodemailer");
      const port = Number(process.env.SMTP_PORT ?? process.env.MAILPIT_SMTP_PORT ?? 1025);
      const secure = port === 465 || process.env.SMTP_SECURE === "true";
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port,
        secure,
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        auth:
          process.env.SMTP_USER || process.env.RESEND_API_KEY
            ? {
                user: process.env.SMTP_USER ?? "resend",
                pass: process.env.SMTP_PASS ?? process.env.RESEND_API_KEY,
              }
            : undefined,
        ...(!secure ? { ignoreTLS: true } : {}),
      } as import("nodemailer").TransportOptions);
      const from = process.env.SMTP_FROM ?? "noreply@localhost";
      await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      return true;
    } catch (error) {
      console.error("[email] SMTP send failed:", error);
      return false;
    }
  }
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.error(
      "[email] No working Resend API, SMTP, or Forge API; email not sent"
    );
    return false;
  }
  try {
    const response = await fetch(`${ENV.forgeApiUrl}/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      console.error('Email send failed:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

/**
 * Send bulk emails to multiple recipients
 */
export async function sendBulkEmails(
  recipients: string[],
  subject: string,
  html: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Send emails in batches to avoid overwhelming the service
  const batchSize = 10;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const promises = batch.map(email => sendEmail({ to: email, subject, html }));
    const results = await Promise.all(promises);
    
    sent += results.filter(r => r).length;
    failed += results.filter(r => !r).length;
  }

  return { sent, failed };
}

/**
 * Generate HTML email template
 */
export function generateEmailTemplate(body: string, title?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'NRCS Notification'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #1E3A8A;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-radius: 0 0 8px 8px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏥 NRCS EAM</div>
    <div>${title || 'Notification'}</div>
  </div>
  <div class="content">
    ${body}
  </div>
  <div class="footer">
    <p>This email was sent from NRCS Enterprise Asset Management System</p>
    <p>Nigerian Red Cross Society</p>
  </div>
</body>
</html>
  `.trim();
}
