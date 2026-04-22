import { eq } from "drizzle-orm";
import { commodityTrackingNumbers, kitCtnContributors } from "../../drizzle/schema";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function expandKitDonorContribution(
  db: Db,
  kitCtnId: number,
  quantityFactor = 1,
  visited = new Set<number>()
): Promise<Map<number, number>> {
  const totals = new Map<number, number>();
  if (visited.has(kitCtnId)) return totals;
  visited.add(kitCtnId);

  const contributors = await db
    .select()
    .from(kitCtnContributors)
    .where(eq(kitCtnContributors.kitCtnId, kitCtnId));

  for (const contributor of contributors) {
    const scaledQty = Number(contributor.quantityConsumed) * quantityFactor;
    const nestedRows = await db
      .select({ count: commodityTrackingNumbers.id })
      .from(kitCtnContributors)
      .innerJoin(commodityTrackingNumbers, eq(kitCtnContributors.componentCtnId, commodityTrackingNumbers.id))
      .where(eq(kitCtnContributors.kitCtnId, contributor.componentCtnId))
      .limit(1);
    if (nestedRows.length > 0) {
      const nested = await expandKitDonorContribution(db, contributor.componentCtnId, scaledQty, visited);
      nested.forEach((qty, donorId) => {
        totals.set(donorId, (totals.get(donorId) ?? 0) + qty);
      });
      continue;
    }
    totals.set(contributor.componentDonorId, (totals.get(contributor.componentDonorId) ?? 0) + scaledQty);
  }

  return totals;
}
