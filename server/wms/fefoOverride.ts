import type { CtnAllocationCandidate, CtnAllocationResult } from "./ctnAllocation";
import { allocateFefoFromCandidates, loadFefoCandidates, sortFefoCandidates } from "./ctnAllocation";

export type FefoAllocationSource = {
  ctnId: number;
  quantity: number;
};

export type FefoSkipWarning = {
  skippedCtnId: number;
  skippedCtnCode: string;
  skippedExpiryDate: string | null;
  skippedBalance: number;
  message: string;
};

export function detectFefoSkips(params: {
  candidates: CtnAllocationCandidate[];
  manualAllocations: FefoAllocationSource[];
  todayIso: string;
}): FefoSkipWarning[] {
  const { candidates, manualAllocations, todayIso } = params;
  const warnings: FefoSkipWarning[] = [];
  const fefoOrder = sortFefoCandidates(candidates).filter(
    (c) => c.balance > 0 && (!c.expiryDate || c.expiryDate >= todayIso)
  );
  const used = new Set(manualAllocations.map((a) => a.ctnId));

  for (const manual of manualAllocations) {
    const manualIdx = fefoOrder.findIndex((c) => c.ctnId === manual.ctnId);
    if (manualIdx <= 0) continue;
    for (let i = 0; i < manualIdx; i++) {
      const earlier = fefoOrder[i]!;
      if (used.has(earlier.ctnId)) continue;
      if (earlier.balance >= manual.quantity - 0.0001) {
        warnings.push({
          skippedCtnId: earlier.ctnId,
          skippedCtnCode: earlier.ctnCode,
          skippedExpiryDate: earlier.expiryDate,
          skippedBalance: earlier.balance,
          message: `Older stock available (${earlier.ctnCode}${
            earlier.expiryDate ? `, expires ${earlier.expiryDate}` : ""
          })`,
        });
      }
    }
  }
  return warnings;
}

export async function suggestWaybillFefo(
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>,
  params: { itemId: number; warehouseId: number; quantity: number }
) {
  const today = new Date().toISOString().slice(0, 10);
  const candidates = await loadFefoCandidates(db, {
    itemId: params.itemId,
    warehouseId: params.warehouseId,
  });
  const sources: CtnAllocationResult[] = allocateFefoFromCandidates(
    candidates,
    params.quantity,
    today
  );
  return sources.map((source) => {
    const candidate = candidates.find((row) => row.ctnId === source.ctnId);
    return {
      ctnId: source.ctnId,
      ctnCode: candidate?.ctnCode ?? null,
      quantity: source.quantity,
      expiryDate: candidate?.expiryDate ?? null,
      balance: candidate?.balance ?? null,
    };
  });
}
