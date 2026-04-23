export function shouldExpireCtn(expiryDateIso: string | null | undefined, todayIso: string): boolean {
  if (!expiryDateIso) return false;
  return expiryDateIso <= todayIso;
}

export function computeExpiryQuantityOut(currentBalance: number, batchQuantity: number) {
  const quantityOut = Math.min(Math.max(0, batchQuantity), Math.max(0, currentBalance));
  return {
    quantityOut,
    balanceAfter: Math.max(0, currentBalance - quantityOut),
    sourceType: "expiry" as const,
  };
}

