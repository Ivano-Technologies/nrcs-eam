import { notificationsLog } from "../../drizzle/schema";
import { getDb } from "../db";
import { sendEmail } from "../emailService";

type EmailSendParams = {
  type?: string;
  to: string;
  subject: string;
  html: string;
};

type SendEmailFn = (args: { to: string; subject: string; html: string }) => Promise<boolean>;

export function createEmailService(deps?: { sendFn?: SendEmailFn }) {
  const sendFn = deps?.sendFn ?? sendEmail;

  return {
    async send(params: EmailSendParams): Promise<boolean> {
      const db = await getDb();
      const attemptSend = async () => {
        try {
          return await sendFn({
            to: params.to,
            subject: params.subject,
            html: params.html,
          });
        } catch {
          return false;
        }
      };

      const firstOk = await attemptSend();
      const sent = firstOk ? true : await attemptSend();

      try {
        if (db) {
          await db.insert(notificationsLog).values({
            type: params.type ?? "generic",
            recipient: params.to,
            subject: params.subject,
            status: sent ? "sent" : "failed",
            error: sent ? null : "Send failed after retry",
            sentAt: new Date(),
          });
        }
      } catch (error) {
        console.error("[notifications_log] failed to write row", error);
      }

      return sent;
    },
  };
}
