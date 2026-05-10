/**
 * Live sales synthesiser.
 *
 * The prototype doesn't ship with a real till feed, so we generate hourly
 * actuals from the existing demand forecasts and a deterministic ±15%
 * wobble seeded by `siteId|skuId|date|hour`. That keeps the numbers stable
 * across reloads while feeling like a real, slightly-noisy sales line.
 *
 * Two views over the same data:
 *  - `buildHourlySales(siteId, date, nowHHMM)` — site-wide totals per hour
 *    (for compact strips/KPIs).
 *  - `buildHourlySalesByRecipe(siteId, date, nowHHMM)` — per-SKU rows + per
 *    hour, used by the "Sales (live)" sub-tab.
 */

import {
  amountsForSiteOnDate,
  carryOverFor,
  demandBiasFor,
  forecastFor,
  getRecipe,
  getSite,
  productionItemsAt,
  type AmountsLine,
  type SiteId,
} from './fixtures';
import { hhmmToMinutes } from './time';

/**
 * Effective amount lines for the actuals synthesiser.
 *
 * Hubs / true standalones bake their own menu, so `amountsForSiteOnDate`
 * is the right answer. SPOKE / HYBRID / linked-standalone sites are
 * "receive-only" — they don't carry production items — but they still
 * sell at counter, so for sales surfaces we need a row per recipe their
 * hub sends them, with the spoke's own forecast.
 *
 * `forecastFor(spoke, sku, date)` already recurses into the hub forecast
 * and scales it by the spoke's `salesFactor`, so the per-recipe forecast
 * here is the spoke's projected counter sales for the day.
 */
function amountsForSalesActuals(siteId: SiteId, date: string): AmountsLine[] {
  const site = getSite(siteId);
  const isHubLinked =
    !!site?.hubId &&
    (site.type === 'SPOKE' ||
      site.type === 'HYBRID' ||
      (site.type === 'STANDALONE' && site.linkType === 'linked'));
  if (!site || !isHubLinked) {
    return amountsForSiteOnDate(siteId, date);
  }

  const hubId = site.hubId!;
  const items = productionItemsAt(hubId);
  const seen = new Set<string>();
  const lines: AmountsLine[] = [];
  for (const item of items) {
    if (seen.has(item.skuId)) continue;
    seen.add(item.skuId);
    const recipe = getRecipe(item.recipeId);
    if (!recipe) continue;
    const forecast = forecastFor(siteId, item.skuId, date);
    if (!forecast || forecast.projectedUnits <= 0) continue;
    const carryOver = carryOverFor(siteId, item.skuId);
    const carried = carryOver?.carriedUnits ?? 0;
    const quinnProposed = Math.max(0, forecast.projectedUnits - carried);
    lines.push({
      item,
      recipe,
      forecast,
      carryOver,
      quinnProposed,
      dispatchDemand: 0,
      dispatchBySpoke: undefined,
      stockCap: undefined,
      primaryBench: undefined,
      benches: [],
    });
  }
  return lines;
}

export const KITCHEN_OPEN_HOUR = 6;
export const KITCHEN_CLOSE_HOUR = 19;

type Phase = 'morning' | 'midday' | 'afternoon';

/**
 * Soft per-hour weights inside each phase. Sum doesn't matter — we
 * normalise. Curves were eyeballed to match a typical Pret day:
 * breakfast peak 07–09, lunch peak 12–14, gentle afternoon trail.
 */
const PHASE_HOURS: Record<Phase, Array<{ hour: number; weight: number }>> = {
  morning: [
    { hour: 6,  weight: 0.6 },
    { hour: 7,  weight: 1.4 },
    { hour: 8,  weight: 1.6 },
    { hour: 9,  weight: 1.1 },
    { hour: 10, weight: 0.7 },
  ],
  midday: [
    { hour: 11, weight: 0.7 },
    { hour: 12, weight: 1.6 },
    { hour: 13, weight: 1.5 },
    { hour: 14, weight: 0.9 },
  ],
  afternoon: [
    { hour: 15, weight: 0.7 },
    { hour: 16, weight: 0.7 },
    { hour: 17, weight: 0.9 },
    { hour: 18, weight: 0.6 },
    { hour: 19, weight: 0.4 },
  ],
};

/** Deterministic 0–1 noise from a string seed. FNV-1a, no crypto needed. */
function seededNoise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Day-level macro factor: a deterministic ±~12% swing per (site, date).
 * Models the things SKU bias + per-hour wobble can't capture — footfall,
 * weather, day-of-week traffic, school holidays. Without this the per-SKU
 * over/undershoot biases roughly cancel at the day total level, leaving
 * the daily-trend chart looking suspiciously flat. With it, different
 * days clearly swing up or down.
 *
 * Two seeded components: a base swing keyed on (site, date) and a
 * day-of-week tilt so weekends / Mondays feel distinct from mid-week.
 * Combined range: ~0.85 .. ~1.15.
 */
function dayMacroFactor(siteId: SiteId, date: string): number {
  const baseNoise = seededNoise(`day-macro|${siteId}|${date}`);
  const baseSwing = 0.92 + baseNoise * 0.16; // 0.92 .. 1.08
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sun
  const dowTilt =
    dow === 0 ? 0.94 :  // Sunday quieter
    dow === 6 ? 0.97 :  // Saturday slightly quieter
    dow === 1 ? 1.04 :  // Monday rebound
    dow === 5 ? 1.06 :  // Friday peak
    1.00;
  return baseSwing * dowTilt;
}

/**
 * Distribute a SKU's `byPhase` totals across the open hours and apply the
 * deterministic wobble for past/current hours. Returns an entry per kitchen
 * hour with both forecast and actual (or null if the hour hasn't started).
 */
function distributeAcrossHours(
  line: AmountsLine,
  siteId: SiteId,
  date: string,
  nowMins: number,
): RecipeHourCell[] {
  const cells: RecipeHourCell[] = [];
  const fc = line.forecast;
  const byPhase = fc?.byPhase;

  // Forecast per hour.
  const forecastByHour = new Map<number, number>();
  for (let h = KITCHEN_OPEN_HOUR; h <= KITCHEN_CLOSE_HOUR; h++) forecastByHour.set(h, 0);
  if (byPhase) {
    for (const phaseKey of ['morning', 'midday', 'afternoon'] as const) {
      const phaseTotal = byPhase[phaseKey];
      if (!phaseTotal) continue;
      const buckets = PHASE_HOURS[phaseKey];
      const weightSum = buckets.reduce((a, b) => a + b.weight, 0);
      for (const bucket of buckets) {
        const share = (phaseTotal * bucket.weight) / weightSum;
        forecastByHour.set(bucket.hour, (forecastByHour.get(bucket.hour) ?? 0) + share);
      }
    }
  }

  // Per-SKU bias: some recipes consistently outperform/undershoot. The
  // bias is multiplied on top of the per-hour forecast so the wobble keeps
  // its hour-to-hour variation around a shifted mean.
  const bias = demandBiasFor(line.item.skuId);
  // Day-level macro factor — see `dayMacroFactor`. Applies to actuals only.
  const dayFactor = dayMacroFactor(siteId, date);

  for (let hour = KITCHEN_OPEN_HOUR; hour <= KITCHEN_CLOSE_HOUR; hour++) {
    const fcRaw = forecastByHour.get(hour) ?? 0;
    const forecast = Math.max(0, Math.round(fcRaw));

    const hourStart = hour * 60;
    const hourEnd = hourStart + 60;
    const isPast = hourEnd <= nowMins;
    const isCurrent = hourStart < nowMins && hourEnd > nowMins;

    let actual: number | null = null;
    let forecastSoFar = 0;
    if (isPast) {
      const noise = seededNoise(`${siteId}|${line.item.skuId}|${date}|${hour}`);
      const wobble = 0.85 + noise * 0.3;
      actual = Math.max(0, Math.round(forecast * bias * wobble * dayFactor));
      forecastSoFar = forecast;
    } else if (isCurrent) {
      const minutesIn = nowMins - hourStart;
      const noise = seededNoise(`${siteId}|${line.item.skuId}|${date}|${hour}|partial`);
      const wobble = 0.85 + noise * 0.3;
      const partialForecast = (forecast * minutesIn) / 60;
      actual = Math.max(0, Math.round(partialForecast * bias * wobble * dayFactor));
      forecastSoFar = Math.round(partialForecast);
    }

    cells.push({ hour, forecast, actual, isPast, isCurrent, forecastSoFar });
  }

  return cells;
}

export type RecipeHourCell = {
  hour: number;
  /** Full-hour forecast (units). */
  forecast: number;
  /**
   * Sold in this hour. `null` for hours that haven't started yet. Partial
   * for the current hour (prorated by minutes elapsed).
   */
  actual: number | null;
  isPast: boolean;
  isCurrent: boolean;
  /** Forecast share that's already "due" by now (full hour if past, prorated if current). */
  forecastSoFar: number;
};

export type RecipeSalesRow = {
  line: AmountsLine;
  cells: RecipeHourCell[];
  /** Sum of `actual` across past + current hour (treated as 0 when null). */
  soldSoFar: number;
  /** Sum of `forecast` across the whole day. */
  forecastDay: number;
  /** Sum of `forecastSoFar` so we can compare like-for-like with `soldSoFar`. */
  forecastSoFar: number;
  /** soldSoFar - forecastSoFar. */
  variance: number;
};

export type SalesByRecipeData = {
  rows: RecipeSalesRow[];
  /** Site-wide totals per hour (sum across rows). */
  hourTotals: Array<{ hour: number; forecast: number; actual: number | null; isPast: boolean; isCurrent: boolean }>;
  totalSoldSoFar: number;
  totalForecastSoFar: number;
  totalForecastDay: number;
};

export function buildHourlySalesByRecipe(siteId: SiteId, date: string, nowHHMM: string): SalesByRecipeData {
  const lines = amountsForSalesActuals(siteId, date);
  const nowMins = hhmmToMinutes(nowHHMM);

  const rows: RecipeSalesRow[] = [];
  for (const line of lines) {
    const cells = distributeAcrossHours(line, siteId, date, nowMins);
    let soldSoFar = 0;
    let forecastDay = 0;
    let forecastSoFar = 0;
    for (const cell of cells) {
      forecastDay += cell.forecast;
      forecastSoFar += cell.forecastSoFar;
      if (cell.actual != null) soldSoFar += cell.actual;
    }
    rows.push({
      line,
      cells,
      soldSoFar,
      forecastDay,
      forecastSoFar,
      variance: soldSoFar - forecastSoFar,
    });
  }

  // Hour totals.
  const hourTotals: SalesByRecipeData['hourTotals'] = [];
  for (let h = KITCHEN_OPEN_HOUR; h <= KITCHEN_CLOSE_HOUR; h++) {
    const idx = h - KITCHEN_OPEN_HOUR;
    let forecast = 0;
    let actual = 0;
    let anyActual = false;
    let isPast = true;
    let isCurrent = false;
    for (const row of rows) {
      const cell = row.cells[idx];
      forecast += cell.forecast;
      if (cell.actual != null) {
        actual += cell.actual;
        anyActual = true;
      }
      // All cells share past/current state for a given hour.
      isPast = cell.isPast;
      isCurrent = cell.isCurrent;
    }
    hourTotals.push({ hour: h, forecast, actual: anyActual ? actual : null, isPast, isCurrent });
  }

  return {
    rows,
    hourTotals,
    totalSoldSoFar: rows.reduce((a, r) => a + r.soldSoFar, 0),
    totalForecastSoFar: rows.reduce((a, r) => a + r.forecastSoFar, 0),
    totalForecastDay: rows.reduce((a, r) => a + r.forecastDay, 0),
  };
}

export function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}
