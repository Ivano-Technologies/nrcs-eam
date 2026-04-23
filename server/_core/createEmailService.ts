import { sendEmail } from "../emailService";

export function createEmailService() {
  return {
    async send(params: { to: string; subject: string; html: string }) {
      return sendEmail({
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
    },
  };
}

