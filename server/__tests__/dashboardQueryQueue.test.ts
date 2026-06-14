import { describe, expect, it } from "vitest";
import { DashboardQueryQueue } from "../_core/dashboardQueryQueue";

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

    await Promise.all([low, high, mid]);
    expect(order).toEqual([1, 2, 3]);
  });
});
