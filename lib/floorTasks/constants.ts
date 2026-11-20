/** Main's seven built-in waste reasons, by name. */
export const WASTE_REASON_NAMES = [
  'Beyond expiry date',
  'Damaged',
  'No longer fresh',
  'R&D',
  'Third Party food waste app',
  'Used by Staff',
  'No Reason',
] as const;

/** Typical waste per line over the last 90 days, in stock units, and how
 *  many lines that's based on. Feeds Main's unusually-large check. */
export const WASTE_HISTORY: Record<string, { median: number; lines: number }> = {
  'ing-croissants': { median: 2 / 12, lines: 14 },
  'ing-chicken': { median: 0.4, lines: 6 },
  'ing-oatmilk': { median: 1, lines: 9 },
  'rc-chicken-avo': { median: 2, lines: 11 },
  'fe-caesar-wrap': { median: 2, lines: 8 },
  'fe-muffins': { median: 3, lines: 12 },
  'fe-whole-milk': { median: 2, lines: 5 },
  'ing-spinach': { median: 0.2, lines: 4 },
};

/** Main's rule: at least £5, at least 3 lines in 90 days, and more than
 *  5 times their median. */
export function isUnusuallyLarge(itemId: string, qtyInStockUnit: number, value: number): boolean {
  const h = WASTE_HISTORY[itemId];
  if (!h) return false;
  return value >= 5 && h.lines >= 3 && qtyInStockUnit > 5 * h.median;
}

export const REJECTION_REASONS = [
  'Damaged',
  'Temperature out of range',
  'Quality issue',
  'Incorrect item',
  'Missing',
  'Other',
] as const;

/** Written off at the sending site, versus going back to it. */
export const WRITTEN_OFF = new Set(['Damaged', 'Temperature out of range', 'Quality issue']);
