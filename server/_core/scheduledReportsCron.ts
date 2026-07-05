import { eq } from "drizzle-orm";
import { scheduledReports } from "../../drizzle/schema";
import { getActiveScheduledReports, getDb } from "../db";
import { buildScheduledReportDelivery } from "../reports/scheduledReportDelivery";

function isDueNow(report: {
  schedule: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  time: string;
  lastRun: Date | null;
  nextRun: Date | null;
}): boolean {
  const now = new Date();
  if (report.nextRun && report.nextRun <= now) return true;
  if (!report.lastRun) return true;
  const [hh, mm] = report.time.split(":").map((x) => Number(x));
  if (Number.isNaN(hh)) return false;
  const last = report.lastRun;
  const elapsedHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
  if (report.schedule === "daily") return elapsedHours >= 23;
  if (report.schedule === "weekly") {
    return now.getUTCDay() === (report.dayOfWeek ?? 1) && elapsedHours >= 167;
  }
  if (report.schedule === "monthly") {
    return now.getUTCDate() === (report.dayOfMonth ?? 1) && elapsedHours >= 23 * 28;
  }
  if (report.schedule === "quarterly") {
    const month = now.getUTCMonth();
    const isQuarterStart = month % 3 === 0;
    return isQuarterStart && now.getUTCDate() === (report.dayOfMonth ?? 1) && elapsedHours >= 23 * 28;
  }
  void mm;
  return false;
}

function computeNextRun(report: {
  schedule: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  time: string;
}): Date {
  const next = new Date();
  const [hh, mm] = report.time.split(":").map((x) => Number(x));
  next.setUTCHours(hh || 6, mm || 0, 0, 0);
  if (report.schedule === "daily") {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (report.schedule === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
  } else if (report.schedule === "quarterly") {
    next.setUTCMonth(next.getUTCMonth() + 3);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  void mm;
  return next;
}

export async function runScheduledReports(): Promise<{ sent: number; skipped: number }> {
  const reports = await getActiveScheduledReports();
  const db = await getDb();
  if (!db) return { sent: 0, skipped: reports.length };

  let sent = 0;
  let skipped = 0;
  for (const report of reports) {
    if (!isDueNow(report)) {
      skipped += 1;
      continue;
    }
    const { sendEmail } = await import("../emailService");
    const delivery = await buildScheduledReportDelivery(report);
    const recipients = report.recipients
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    for (const to of recipients) {
      await sendEmail({
        to,
        subject: `Scheduled report: ${report.name}`,
        html: delivery.html,
      });
    }
    await db
      .update(scheduledReports)
      .set({ lastRun: new Date(), nextRun: computeNextRun(report), updatedAt: new Date() })
      .where(eq(scheduledReports.id, report.id));
    sent += 1;
  }
  return { sent, skipped };
}
