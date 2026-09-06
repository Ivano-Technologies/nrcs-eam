import { describe, expect, it } from "vitest";
import {
  DashboardQueryQueue,
  MAX_CONCURRENT_DASHBOARD_QUERIES,
} from "../_core/dashboardQueryQueue";
import { POSTGRES_JS_SERVERLESS_POOL_MAX } from "../../shared/mysqlSsl";
import { withTimeout } from "../_core/withTimeout";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("DashboardQueryQueue", () => {
  it("limits concurrent executions to maxConcurrent", async () => {
    const queue = new DashboardQueryQueue(2);
    let inFlight = 0;
    let maxInFlight = 0;

    const task = () =>
      queue.enqueue(1, async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(30);
        inFlight--;
        return true;
      });

    await Promise.all([task(), task(), task(), task()]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("runs higher-priority tasks before lower-priority when queued", async () => {
    const queue = new DashboardQueryQueue(1);
    const order: number[] = [];

    // Saturate the single concurrency slot so later enqueues stay queued
    // and priority ordering is actually exercised (drain starts immediately
    // when capacity is free, so enqueueing without a blocker runs FIFO-on-arrival).
    let releaseBlocker!: () => void;
    const blockerReady = new Promise<void>((resolve) => {
      releaseBlocker = resolve;
    });
    const blocker = queue.enqueue(0, async () => {
      await blockerReady;
      return "blocker";
    });

    // Let the blocker claim the slot before enqueueing ordered tasks
    await delay(5);

    const low = queue.enqueue(3, async () => {
      order.push(3);
      return "low";
    });
    const high = queue.enqueue(1, async () => {
      order.push(1);
      return "high";
    });
    const mid = queue.enqueue(2, async () => {
      order.push(2);
      return "mid";
    });

    releaseBlocker();
    await Promise.all([blocker, low, high, mid]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("matches the serverless pool max so the queue is not the leftover cap of 3", () => {
    expect(MAX_CONCURRENT_DASHBOARD_QUERIES).toBe(POSTGRES_JS_SERVERLESS_POOL_MAX);
    expect(MAX_CONCURRENT_DASHBOARD_QUERIES).toBe(8);
    expect(new DashboardQueryQueue().getStats().maxConcurrent).toBe(8);
  });

  it("starts withTimeout only after dequeue so queue wait does not consume the budget", async () => {
    const queue = new DashboardQueryQueue(1);
    let workStarted = 0;

    let releaseBlocker!: () => void;
    const blockerReady = new Promise<void>((resolve) => {
      releaseBlocker = resolve;
    });
    const blocker = queue.enqueue(1, async () => {
      await blockerReady;
      return "blocker";
    });

    await delay(5);

    const queued = queue.enqueueWithTimeout(
      2,
      async () => {
        workStarted += 1;
        await delay(20);
        return "done";
      },
      50,
      "branchPerformance"
    );

    // Sit behind the blocker longer than the 50ms execution budget.
    await delay(80);
    expect(workStarted).toBe(0);

    releaseBlocker();
    await expect(queued).resolves.toBe("done");
    expect(workStarted).toBe(1);
    await blocker;
  });

  it("still times out when execution itself exceeds the budget", async () => {
    const queue = new DashboardQueryQueue(1);
    await expect(
      queue.enqueueWithTimeout(1, () => delay(80).then(() => "late"), 20, "slow-section")
    ).rejects.toThrow("timeout:slow-section");
  });
});

describe("withTimeout factory", () => {
  it("starts factory work only when withTimeout runs", async () => {
    let started = 0;
    const work = async () => {
      started += 1;
      return "ok";
    };
    expect(started).toBe(0);
    const pending = withTimeout(work, 50, "factory");
    expect(started).toBe(1);
    await expect(pending).resolves.toBe("ok");
  });
});
