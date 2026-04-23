export function computeTransferDispatch(sourceBalance: number, quantity: number) {
  if (quantity <= 0) throw new Error("Quantity must be positive");
  if (sourceBalance < quantity) throw new Error("Insufficient stock");
  return {
    quantityOut: quantity,
    balanceAfter: sourceBalance - quantity,
    sourceType: "transfer_out" as const,
  };
}

export function computeTransferReceive(destinationBalance: number, quantity: number) {
  if (quantity <= 0) throw new Error("Quantity must be positive");
  return {
    quantityIn: quantity,
    balanceAfter: destinationBalance + quantity,
    sourceType: "transfer_in" as const,
  };
}

export function shouldBootstrapStockCard(existingStockCardCount: number): boolean {
  return existingStockCardCount <= 0;
}

