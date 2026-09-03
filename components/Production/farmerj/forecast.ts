import { batchesToNumber } from './cascade';
import { addDays, FJ_DEMO_TODAY, isShopOpen, type ReferenceDay } from './calendar';
import { computeDayPlan, type DayRecord } from './FjPlanStore';
import { ALL_CHANNELS } from './lines';
import { PRODUCTS, type FinishedProduct, type ProductGroup } from './recipes';
import { daySales, type DayPart } from './sales';
import type { SalesChannel } from './salesDay';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS } from './shops';

/**
 * The Farmer J forecast, as one object the Forecast page can read.
 *
 * There is one forecast in the product and it is the one the Day plan
 * cooks from: the average of the included reference days (the last four
 * same weekdays, anomalies left out), times the day's whole-day flex.
 * This module reads that from `computeDayPlan` and never recomputes it,
 * so the Forecast page, the Day plan, the Shops board and the dashboard
 * all show the same number for the same shop-day. Editing the forecast
 * here writes the flex back to the same day record the Day plan uses.
 *
 * Actuals come from `daySales`, the same till export the reference days
 * are built from. "Result" is forecast against actual for a past day.
 */

export type GetRecord = (shopId: string, date: string) => DayRecord;

export const DAY_PARTS: DayPart[] = ['breakfast', 'lunch', 'dinner'];
export const DAY_PART_LABELS: Record<DayPart, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
export const DAY_PART_HOURS: Record<DayPart, string> = { breakfast: 'to 11:00', lunch: '11:00 to 17:00', dinner: 'from 17:00' };

export type Totals = {
  net: number;
  trays: number;
  portions: number;
  byDayPart: Record<DayPart, number>;
  byChannel: Record<SalesChannel, number>;
  byHour: Record<number, number>;
};

function emptyTotals(): Totals {
  return {
    net: 0,
    trays: 0,
    portions: 0,
    byDayPart: { breakfast: 0, lunch: 0, dinner: 0 },
    byChannel: Object.fromEntries(ALL_CHANNELS.map(c => [c, 0])) as Record<SalesChannel, number>,
    byHour: {},
  };
}

function add(into: Totals, from: Totals, scale = 1): Totals {
  into.net += from.net * scale;
  into.trays += from.trays * scale;
  into.portions += from.portions * scale;
  for (const p of DAY_PARTS) into.byDayPart[p] += from.byDayPart[p] * scale;
  for (const c of ALL_CHANNELS) into.byChannel[c] += from.byChannel[c] * scale;
  for (const [h, v] of Object.entries(from.byHour)) into.byHour[Number(h)] = (into.byHour[Number(h)] ?? 0) + v * scale;
  return into;
}

export function shopsIn(scope: string): string[] {
  return scope === FJ_ALL_SHOPS_ID ? FJ_SHOPS.map(s => s.id) : [scope];
}

export type ShopForecast = {
  shopId: string;
  date: string;
  open: boolean;
  /** The reference-day average before flex, as the Day plan holds it. */
  baseline: Totals;
  /** Baseline × (1 + flex). What the shop is planning to sell. */
  forecast: Totals;
  flexPct: number;
  referenceDays: ReferenceDay[];
  batches: number;
  approved: boolean;
  overridden: number;
};

/** One shop-day's forecast, straight from the plan the Day plan renders. */
export function shopForecast(shopId: string, date: string, getRecord: GetRecord): ShopForecast {
  const open = isShopOpen(shopId, date);
  const plan = computeDayPlan(shopId, date, getRecord(shopId, date), getRecord(shopId, addDays(date, -1)).close);
  const d = plan.demand;
  const baseline: Totals = {
    net: d.net,
    trays: d.trays,
    portions: Object.values(d.products).reduce((n, p) => n + p.portions, 0),
    byDayPart: { ...d.netByDayPart },
    byChannel: { ...d.netByChannel },
    byHour: { ...d.netByHour },
  };
  const flex = 1 + plan.record.flexPct / 100;
  return {
    shopId,
    date,
    open,
    baseline,
    forecast: add(emptyTotals(), baseline, flex),
    flexPct: plan.record.flexPct,
    referenceDays: plan.referenceDays,
    batches: plan.totals.batches,
    approved: plan.approved,
    overridden: plan.overriddenCount,
  };
}

export type ScopeForecast = {
  scope: string;
  date: string;
  shops: ShopForecast[];
  openShops: number;
  baseline: Totals;
  forecast: Totals;
  /** Flex when every open shop shares one value, else null (mixed). */
  flexPct: number | null;
  batches: number;
  approved: number;
};

/** Forecast for a shop or the whole estate. */
export function scopeForecast(scope: string, date: string, getRecord: GetRecord): ScopeForecast {
  const shops = shopsIn(scope).map(id => shopForecast(id, date, getRecord)).filter(s => s.open);
  const baseline = emptyTotals();
  const forecast = emptyTotals();
  for (const s of shops) {
    add(baseline, s.baseline);
    add(forecast, s.forecast);
  }
  const flexes = new Set(shops.map(s => s.flexPct));
  return {
    scope,
    date,
    shops,
    openShops: shops.length,
    baseline,
    forecast,
    flexPct: flexes.size === 1 ? shops[0].flexPct : shops.length === 0 ? 0 : null,
    batches: shops.reduce((n, s) => n + s.batches, 0),
    approved: shops.filter(s => s.approved).length,
  };
}

/** What the tills took. */
export function scopeActual(scope: string, date: string): Totals {
  const out = emptyTotals();
  for (const shopId of shopsIn(scope)) {
    if (!isShopOpen(shopId, date)) continue;
    const d = daySales(shopId, date);
    add(out, {
      net: d.net,
      trays: d.trays,
      portions: Object.values(d.products).reduce((n, p) => n + p.portions, 0),
      byDayPart: { ...d.netByDayPart },
      byChannel: { ...d.netByChannel },
      byHour: { ...d.netByHour },
    });
  }
  return out;
}

/** Net taken up to and including `hour` (0 to 23), from an hourly profile. */
export function netToHour(t: Totals, hour: number): number {
  return Object.entries(t.byHour).reduce((n, [h, v]) => (Number(h) <= hour ? n + v : n), 0);
}

export type DayPartStatus = 'complete' | 'current' | 'pending';

export function dayPartStatus(part: DayPart, nowMins: number, isToday: boolean): DayPartStatus {
  if (!isToday) return 'complete';
  const h = nowMins / 60;
  const end = part === 'breakfast' ? 11 : part === 'lunch' ? 17 : 24;
  const start = part === 'breakfast' ? 0 : part === 'lunch' ? 11 : 17;
  if (h >= end) return 'complete';
  if (h >= start) return 'current';
  return 'pending';
}

export type TrendPoint = {
  date: string;
  forecast: number;
  /** Undefined for days not yet traded. */
  actual?: number;
  future: boolean;
  today: boolean;
};

/** Forecast against actual for the days behind, forecast alone for the days ahead. */
export function forecastTrend(scope: string, getRecord: GetRecord, pastDays: number, futureDays: number, today = FJ_DEMO_TODAY): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let n = -pastDays; n <= futureDays; n++) {
    const date = addDays(today, n);
    const f = scopeForecast(scope, date, getRecord);
    if (f.openShops === 0) continue;
    const future = n > 0;
    out.push({
      date,
      forecast: f.forecast.net,
      actual: future ? undefined : scopeActual(scope, date).net,
      future,
      today: n === 0,
    });
  }
  return out;
}

export type ProductForecastRow = {
  productId: string;
  product: FinishedProduct;
  group: ProductGroup;
  /** Portions on each reference day, in the plan's reference order (first shop's dates). */
  perReferenceDay: Array<{ date: string; portions: number; included: boolean }>;
  /** Average across included reference days, summed across shops. */
  baselinePortions: number;
  /** After flex. */
  forecastPortions: number;
  batches: number;
  overridden: boolean;
  /** Portions sold on the day, when it has traded. */
  soldPortions?: number;
};

/** Per-product forecast for the drill, in Day plan group order. */
export function productForecastRows(scope: string, date: string, getRecord: GetRecord, withActual: boolean): ProductForecastRow[] {
  const rows = new Map<string, ProductForecastRow>();
  const shops = shopsIn(scope).filter(id => isShopOpen(id, date));
  for (const shopId of shops) {
    const plan = computeDayPlan(shopId, date, getRecord(shopId, date), getRecord(shopId, addDays(date, -1)).close);
    const sold = withActual ? daySales(shopId, date) : null;
    const refSales = plan.referenceDays.map(r => ({ ref: r, sales: daySales(shopId, r.date) }));
    for (const p of plan.plans) {
      const row = rows.get(p.productId) ?? {
        productId: p.productId,
        product: p.product,
        group: p.product.group,
        perReferenceDay: plan.referenceDays.map(r => ({ date: r.date, portions: 0, included: r.included })),
        baselinePortions: 0,
        forecastPortions: 0,
        batches: 0,
        overridden: false,
        soldPortions: withActual ? 0 : undefined,
      };
      refSales.forEach((r, i) => {
        if (row.perReferenceDay[i]) row.perReferenceDay[i].portions += r.sales.products[p.productId]?.portions ?? 0;
      });
      row.baselinePortions += p.referencePortions;
      row.forecastPortions += p.referencePortions * (1 + p.flexPct / 100);
      row.batches += batchesToNumber(p.batches);
      row.overridden = row.overridden || p.overridden;
      if (sold && row.soldPortions !== undefined) row.soldPortions += sold.products[p.productId]?.portions ?? 0;
      rows.set(p.productId, row);
    }
  }
  const order = new Map(PRODUCTS.map((p, i) => [p.id, i]));
  return Array.from(rows.values()).sort((a, b) => (order.get(a.productId) ?? 0) - (order.get(b.productId) ?? 0));
}

/** Plain words for the hero: where the number came from. */
export function narrateForecast(f: ScopeForecast, dayName: string): string {
  if (f.openShops === 0) return 'Closed. Nothing to forecast.';
  const first = f.shops[0];
  const included = first.referenceDays.filter(r => r.included);
  const excluded = first.referenceDays.filter(r => !r.included);
  const parts: string[] = [];
  parts.push(`Average of the last ${included.length} ${dayName}s${excluded.length ? `, ${excluded.length} left out` : ''}`);
  if (f.flexPct === null) parts.push('flex set shop by shop');
  else if (f.flexPct !== 0) parts.push(`flex ${f.flexPct > 0 ? '+' : ''}${f.flexPct}%`);
  const where = f.openShops === 1 ? 'The Day plan' : `${f.openShops} day plans`;
  return `${parts.join(', ')}. ${where} cook${f.openShops === 1 ? 's' : ''} ${Math.round(f.batches * 2) / 2} batches from this number.`;
}

/** Plain words for the result: how the day landed against the forecast. */
export function narrateResult(forecast: Totals, actual: Totals, live: boolean, hour?: number): string {
  const f = live && hour !== undefined ? netToHour(forecast, hour) : forecast.net;
  const a = live && hour !== undefined ? netToHour(actual, hour) : actual.net;
  if (f === 0) return 'No forecast for this day.';
  const pct = ((a - f) / f) * 100;
  const dir = pct > 1 ? 'ahead of' : pct < -1 ? 'behind' : 'level with';
  const lead = live ? `So far ${dir} forecast` : `Landed ${dir} forecast`;
  const parts = DAY_PARTS.filter(p => forecast.byDayPart[p] > 0 && (!live || hour === undefined || (p === 'breakfast' ? hour >= 11 : p === 'lunch' ? hour >= 17 : false)))
    .map(p => {
      const d = actual.byDayPart[p] - forecast.byDayPart[p];
      const share = (d / forecast.byDayPart[p]) * 100;
      return `${DAY_PART_LABELS[p].toLowerCase()} ${share >= 0 ? '+' : '−'}${Math.abs(Math.round(share))}%`;
    });
  return `${lead}${Math.abs(pct) > 1 ? ` by ${Math.abs(Math.round(pct))}%` : ''}${parts.length ? `. ${parts.join(', ')}` : ''}.`;
}
