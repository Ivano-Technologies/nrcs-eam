/** Limits concurrent dashboard DB work to match Supabase pool max (3). */

export const MAX_CONCURRENT_DASHBOARD_QUERIES = 3;

type QueuedTask<T> = {
  priority: number;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  enqueuedAt: number;
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
      });
      this.queue.sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt);
      this.drain(label);
    });
  }

  private drain(label?: string) {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running++;
      const waitMs = Date.now() - task.enqueuedAt;
      if (waitMs > 10) {
        console.log(
          JSON.stringify({
            event: "dashboard_queue_wait",
            waitMs,
            priority: task.priority,
            label: label ?? null,
            running: this.running,
            queued: this.queue.length,
          })
        );
      }
      void (async () => {
        try {
          const result = await task.fn();
          task.resolve(result);
        } catch (err) {
          task.reject(err);
        } finally {
          this.running--;
          this.drain(label);
        }
      })();
    }
  }

  getStats() {
    return { running: this.running, queued: this.queue.length, maxConcurrent: this.maxConcurrent };
  }
}

export const dashboardQueryQueue = new DashboardQueryQueue();
