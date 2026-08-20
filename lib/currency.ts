/**
 * currency — shared money formatting + mock FX for the multi-currency demo.
 *
 * The prototype's base/reporting currency is USD (the store's home currency
 * — this is the US demo build). Suppliers can transact in their own currency
 * (Second Cup Central Supply bills in CAD); this module converts and renders
 * the dual display used across the purchasing journey: "CA$450.00 ($261.00)".
 *
 * Rates are a dated mock table — no live feed. The demo story locks the rate
 * at goods receipt, so callers on the receiving path pass the rate they were
 * given rather than re-deriving it.
 */

export type CurrencyCode = 'GBP' | 'CAD' | 'USD' | 'EUR' | 'AED';

/** The store's reporting currency. All food-cost figures resolve to this. */
export const BASE_CURRENCY: CurrencyCode = 'USD';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  GBP: '£',
  CAD: 'CA$',
  USD: '$',
  EUR: '€',
  AED: 'DH',
};

export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  GBP: 'British pound',
  CAD: 'Canadian dollar',
  USD: 'US dollar',
  EUR: 'Euro',
  AED: 'UAE dirham',
};

/**
 * Mock daily rates into USD (the base). "Updated today" in demo copy — the
 * date renders from FX_RATE_DATE so the chip always looks current.
 * CAD deliberately keeps the 0.58 mock rate the fixture narratives are
 * written around ("CA$28.00/bag is $16.24").
 */
const RATES_TO_USD: Record<CurrencyCode, number> = {
  USD: 1,
  GBP: 1.27,
  CAD: 0.58,
  EUR: 0.85,
  AED: 0.215,
};

/** Human label for when the mock rates were "fetched". */
export const FX_RATE_DATE = 'today, 06:00';

export function fxRate(from: CurrencyCode, to: CurrencyCode): number {
  return RATES_TO_USD[from] / RATES_TO_USD[to];
}

export function convert(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  return amount * fxRate(from, to);
}

/** "1 CAD = 0.58 USD" — for FX-rate chips beside converted amounts. */
export function fxRateLabel(from: CurrencyCode, to: CurrencyCode = BASE_CURRENCY): string {
  const rate = fxRate(from, to);
  const precision = rate >= 1 ? 2 : rate >= 0.1 ? 2 : 4;
  return `1 ${from} = ${rate.toFixed(precision)} ${to}`;
}

const numberCache = new Map<string, Intl.NumberFormat>();

function formatNumber(value: number, options: Intl.NumberFormatOptions): string {
  const key = JSON.stringify(options);
  let f = numberCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-GB', { style: 'decimal', ...options });
    numberCache.set(key, f);
  }
  return f.format(value);
}

/** "CA$450.00", "$261.00" — symbol leads, 2dp, locale grouping. */
export function formatMoney(
  amount: number,
  currency: CurrencyCode = BASE_CURRENCY,
  options?: { decimals?: number },
): string {
  const decimals = options?.decimals ?? 2;
  const sign = amount < 0 ? '-' : '';
  const formatted = formatNumber(Math.abs(amount), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${CURRENCY_SYMBOLS[currency]}${formatted}`;
}

/** Whole-unit variant for space-constrained surfaces: "CA$450", "$261". */
export function formatMoneyRounded(amount: number, currency: CurrencyCode = BASE_CURRENCY): string {
  return formatMoney(amount, currency, { decimals: 0 });
}

/**
 * Dual display: supplier-currency amount with the base-currency equivalent
 * alongside — "CA$450.00 ($261.00)". When the transaction currency IS the
 * base currency this collapses to a single figure, so call sites don't need
 * to branch.
 *
 * Pass `rate` to render at a locked rate (goods receipt / invoice) instead of
 * the live table.
 */
export function formatDual(
  amount: number,
  currency: CurrencyCode,
  options?: { base?: CurrencyCode; rate?: number },
): string {
  const base = options?.base ?? BASE_CURRENCY;
  if (currency === base) return formatMoney(amount, base);
  const converted = amount * (options?.rate ?? fxRate(currency, base));
  return `${formatMoney(amount, currency)} (${formatMoney(converted, base)})`;
}

/** Just the base-currency equivalent — "$261.00" — for secondary lines. */
export function formatBaseEquivalent(
  amount: number,
  currency: CurrencyCode,
  options?: { base?: CurrencyCode; rate?: number },
): string {
  const base = options?.base ?? BASE_CURRENCY;
  const converted = currency === base ? amount : amount * (options?.rate ?? fxRate(currency, base));
  return formatMoney(converted, base);
}

export function currencySymbol(currency: CurrencyCode): string {
  return CURRENCY_SYMBOLS[currency];
}
