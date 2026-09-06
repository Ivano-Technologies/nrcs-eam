/** Limits concurrent dashboard DB work to match the serverless postgres.js pool. */

import { POSTGRES_JS_SERVERLESS_POOL_MAX } from "../../shared/mysqlSsl";
import { withTimeout } from "./withTimeout";

export const MAX_CONCURRENT_DASHBOARD_QUERIES = POSTGRES_JS_SERVERLESS_POOL_MAX;

type QueuedTask<T> = {
  priority: number;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  enqueuedAt: number;
  label?: string;
};

export class DashboardQueryQueue {
  private running = 0;
  private queue: QueuedTask<unknown>[] = [];

  constructor(private readonly maxConcurrent: number = MAX_CONCURRENT_DASHBOARD_QUERIES) {}

  /** Lower priority number runs first when capacity is available. */
  enqueue<T>(priority: number, fn: () => Promise<T>, label?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        priority,
        fn,
        resolve: resolve as (value: unknown) => void,
        reject,
        enqueuedAt: Date.now(),
        label,
      });
      this.queue.sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt);
      this.drain();
    });
  }

  /**
   * Enqueue work and start `withTimeout` only after a slot is taken.
   * Queue wait must not count toward the deadline — a section can sit behind
   * higher-priority work for longer than `timeoutMs` and still succeed.
   */
  enqueueWithTimeout<T>(
    priority: number,
    fn: () => Promise<T>,
    timeoutMs: number,
    label: string
  ): Promise<T> {
    return this.enqueue(priority, () => withTimeout(fn, timeoutMs, label), label);
  }

  private drain() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running++;
      const queueWaitMs = Date.now() - task.enqueuedAt;
      if (queueWaitMs > 10) {
        console.log(
          JSON.stringify({
            event: "dashboard_section_dequeued",
            section: task.label ?? null,
            waitMs: queueWaitMs,
            priority: task.priority,
            queue: this.getStats(),
          })
        );
      }
      void (async () => {
        const startedAt = Date.now();
        try {
          const result = await task.fn();
          task.resolve(result);
        } catch (err) {
          task.reject(err);
        } finally {
          const executionMs = Date.now() - startedAt;
          if (queueWaitMs > 50 || executionMs > 50) {
            console.log(
              JSON.stringify({
                event: "dashboard_section_completed",
                section: task.label ?? null,
                queueWaitMs,
                executionMs,
                priority: task.priority,
                queue: this.getStats(),
              })
            );
          }
          this.running--;
          this.drain();
        }
      })();
    }
  }

  getStats() {
    return { running: this.running, queued: this.queue.length, maxConcurrent: this.maxConcurrent };
  }
}

export const dashboardQueryQueue = new DashboardQueryQueue();
