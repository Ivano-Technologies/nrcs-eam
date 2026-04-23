export type HistoricalDirection = "in" | "out";

export function resolveHistoricalDirection(movementType: string): HistoricalDirection {
  return ["issue", "transfer_out", "loss", "distribution"].includes(movementType) ? "out" : "in";
}

export function buildHistoricalStockMovement(params: {
  movementType: string;
  quantity: number;
  previousBalance: number;
  documentRef?: string | null;
  date: string;
  notes?: string | null;
  createdBy: number;
  stockCardId: number;
}) {
  const direction = resolveHistoricalDirection(params.movementType);
  const quantityIn = direction === "in" ? Math.abs(params.quantity) : 0;
  const quantityOut = direction === "out" ? Math.abs(params.quantity) : 0;
  const balanceAfter = params.previousBalance + quantityIn - quantityOut;
  return {
    quantityIn,
    quantityOut,
    balanceAfter,
    row: {
      stockCardId: params.stockCardId,
      date: params.date,
      documentRef: params.documentRef ?? "HISTORICAL-IMPORT",
      fromTo: null as string | null,
      quantityIn,
      quantityOut,
      balanceAfter,
      remarks: params.notes ?? "Historical movement import",
      sourceType: "import" as const,
      createdBy: params.createdBy,
    },
  };
}

