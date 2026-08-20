/**
 * Single source of truth for /viz-explorations.
 *
 * The same numbers feed all three direction renderings so the only thing
 * varying between A / B / C is visual treatment, not the underlying data.
 * Keep this file dumb — no formatting, no derived values; let each
 * component format for its own typography.
 */

export type DailyPoint = {
  day: string; // 3-letter day label
  netSales: number; // $
  labour: number; // $
};

export const SUMMARY = {
  /** Period-to-date headline (week-to-date in this prototype). */
  salesToDate: 108038,
  /** $ value of operational profit and the % it represents of net sales. */
  opProfit: 1555.74,
  opProfitPct: 20.82,
  /** Whole-number gross margin %. */
  grossMargin: 37,
  /** Direction-of-travel chips (vs prior comparable period). */
  salesDelta: 2.4, // +2.4%
  opProfitDelta: -0.6, // -0.6 pts
  grossMarginDelta: 1.0, // +1.0 pts
} as const;

export const TODAY = {
  netSales: 150001.20,
  labourCosts: 100401.20,
  /** Labour as a % of net sales. */
  labourPct: 37,
} as const;

/** Currently-focused hour window in the scrubber. */
export const HOURLY_SAMPLE = {
  startLabel: '7am',
  endLabel: '8am',
  netSales: 104000,
  labourCosts: 82000,
} as const;

export const WEEK: DailyPoint[] = [
  { day: 'Mon', netSales: 132000, labour: 88000 },
  { day: 'Tue', netSales: 141000, labour: 92000 },
  { day: 'Wed', netSales: 128000, labour: 85000 },
  { day: 'Thu', netSales: 156000, labour: 99000 },
  { day: 'Fri', netSales: 168000, labour: 104000 },
  { day: 'Sat', netSales: 172000, labour: 110000 },
  { day: 'Sun', netSales: 150001, labour: 100401 },
];

/** Locked palette — every direction must source colour from here only. */
export const PALETTE = {
  navy: '#001C35',
  royal: '#1A148A',
  cyan: '#28AFC9',
  cream: '#FCF6EE',
  sand: '#F8E8D6',
  white: '#FFFFFF',
} as const;

// ─────────────────────────────────────────────────────────────────────
// Tiny formatters (kept local so the explorations don't pull in
// project-wide locale helpers and stay easy to fork).
// ─────────────────────────────────────────────────────────────────────

export function fmtUSD(n: number, opts: { decimals?: 0 | 2; compact?: boolean } = {}): string {
  const { decimals = 0, compact = false } = opts;
  if (compact && Math.abs(n) >= 1000) {
    const k = n / 1000;
    return `$${k.toFixed(k >= 100 ? 0 : 1)}k`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function fmtPct(n: number, decimals = 0): string {
  return `${n.toFixed(decimals)}%`;
}

export function fmtSignedPct(n: number, decimals = 1): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(decimals)}%`;
}
