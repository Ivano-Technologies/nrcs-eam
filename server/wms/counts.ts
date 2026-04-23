export function computeCountVariance(expectedQty: number, actualQty: number) {
  const variance = actualQty - expectedQty;
  return {
    variance,
    quantityIn: variance > 0 ? variance : 0,
    quantityOut: variance < 0 ? Math.abs(variance) : 0,
  };
}

export function validateRetroactiveCountEntry(params: {
  entryDateIso: string;
  todayIso: string;
  supervisorId?: number;
}) {
  const retroactive = params.entryDateIso !== params.todayIso;
  if (retroactive && !params.supervisorId) {
    throw new Error("Retroactive stock checks require supervisor_id.");
  }
  return { retroactive };
}

