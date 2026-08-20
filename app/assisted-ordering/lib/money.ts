/**
 * Money helpers for the assisted-ordering flow.
 *
 * Line/unit costs are held in the supplier's transaction currency (e.g.
 * Second Cup Central Supply bills in CAD). Per-supplier amounts render in
 * that currency with the base (GBP) equivalent alongside; cross-supplier
 * totals are always converted to base before summing.
 */

import { SUPPLIERS } from '../data/mockOrders';
import {
  BASE_CURRENCY, convert, formatMoney,
  type CurrencyCode,
} from '@/lib/currency';

export function supplierCurrency(supplierId: string): CurrencyCode {
  return SUPPLIERS.find((s) => s.id === supplierId)?.currency ?? BASE_CURRENCY;
}

/** Convert a supplier-currency amount to the base currency. */
export function toBase(amount: number, supplierId: string): number {
  return convert(amount, supplierCurrency(supplierId), BASE_CURRENCY);
}

/**
 * Compact supplier-currency amount with base equivalent for foreign
 * suppliers: "CA$392 ($227)". Base-currency suppliers render as before:
 * "$392". Whole units, matching the flow's existing style.
 */
export function fmtSupplierAmount(amount: number, supplierId: string): string {
  const currency = supplierCurrency(supplierId);
  if (currency === BASE_CURRENCY) return formatMoney(amount, BASE_CURRENCY, { decimals: 0 });
  const base = convert(amount, currency, BASE_CURRENCY);
  return `${formatMoney(amount, currency, { decimals: 0 })} (${formatMoney(base, BASE_CURRENCY, { decimals: 0 })})`;
}

/**
 * Split variant of `fmtSupplierAmount` for line rows that need a fixed-width
 * amount column: the supplier-currency amount on one line with the base
 * equivalent stacked underneath ("CA$392" / "$227"), so the wide dual
 * display doesn't push the qty steppers out of alignment. `base` is
 * undefined for base-currency suppliers.
 */
export function fmtSupplierAmountParts(
  amount: number,
  supplierId: string,
): { main: string; base?: string } {
  const currency = supplierCurrency(supplierId);
  if (currency === BASE_CURRENCY) {
    return { main: formatMoney(amount, BASE_CURRENCY, { decimals: 0 }) };
  }
  return {
    main: formatMoney(amount, currency, { decimals: 0 }),
    base: formatMoney(convert(amount, currency, BASE_CURRENCY), BASE_CURRENCY, { decimals: 0 }),
  };
}

/** Unit-cost variant at 2dp: "CA$28.00 ($16.24)" or "$9.50". */
export function fmtSupplierUnitCost(amount: number, supplierId: string): string {
  const currency = supplierCurrency(supplierId);
  if (currency === BASE_CURRENCY) return formatMoney(amount, BASE_CURRENCY);
  const base = convert(amount, currency, BASE_CURRENCY);
  return `${formatMoney(amount, currency)} (${formatMoney(base, BASE_CURRENCY)})`;
}
