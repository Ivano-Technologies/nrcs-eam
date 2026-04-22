export function applyGrnSuggestion(current: string, suggested: string): string {
  if (current.trim().length === 0) return suggested;
  return current;
}

export function looksLikeGrnNumber(value: string): boolean {
  return /^NRCS-[A-Z0-9]{2,5}-\d{4}-\d{4}$/.test(value.trim());
}

