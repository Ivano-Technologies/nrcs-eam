import { ENV } from './_core/env';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send email using Manus built-in email service
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
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
