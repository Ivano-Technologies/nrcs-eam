import { and, eq, lte, sql } from "drizzle-orm";
import { asyncJobs } from "../../drizzle/schema";
import { getDb } from "../db";

export type AsyncJobType = "pdf_generate" | "email_send" | "import_finalize";

export async function enqueueAsyncJob(params: {
  jobType: AsyncJobType;
  payload: Record<string, unknown>;
  runAfter?: Date;
}): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .insert(asyncJobs)
    .values({
      jobType: params.jobType,
      payload: params.payload,
      status: "pending",
      runAfter: params.runAfter ?? new Date(),
    })
    .returning({ id: asyncJobs.id });
  return row?.id ?? null;
}

export async function processPendingAsyncJobs(limit = 10): Promise<{ processed: number; failed: number }> {
  const db = await getDb();
  if (!db) return { processed: 0, failed: 0 };
  const now = new Date();
  const pending = await db
    .select()
    .from(asyncJobs)
    .where(and(eq(asyncJobs.status, "pending"), lte(asyncJobs.runAfter, now)))
    .orderBy(asyncJobs.runAfter)
    .limit(limit);

  let processed = 0;
  let failed = 0;
  for (const job of pending) {
    try {
      await db.update(asyncJobs).set({ status: "running", startedAt: new Date() }).where(eq(asyncJobs.id, job.id));
      await db
        .update(asyncJobs)
        .set({ status: "completed", finishedAt: new Date(), result: { ok: true, jobType: job.jobType } })
        .where(eq(asyncJobs.id, job.id));
      processed += 1;
    } catch (err) {
      failed += 1;
      await db
        .update(asyncJobs)
        .set({
          status: "failed",
          finishedAt: new Date(),
          lastError: err instanceof Error ? err.message : String(err),
          attempts: sql`${asyncJobs.attempts} + 1`,
        })
        .where(eq(asyncJobs.id, job.id));
    }
  }
  return { processed, failed };
}
