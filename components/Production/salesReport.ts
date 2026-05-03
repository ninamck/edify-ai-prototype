/**
 * Sales-vs-forecast retrospective for /production/sales-report.
 *
 * Reuses the live actuals synthesiser (`buildHourlySalesByRecipe`) so the
 * single-source-of-truth for "what did we sell" stays in salesActuals.ts.
 * Calling it with `nowHHMM='23:59'` for a past date returns full-day
 * actuals; we then aggregate across the requested date range.
 *
 * Outputs:
 *  - daySummary(siteId, date)            — totals + per-recipe variance for one day
 *  - siteSalesReport(siteId, dates[])    — multi-day aggregate for the page
 */

import {
  type AmountsLine,
  type ProductionRecipe,
  type SiteId,
  type SkuId,
  DEMO_TODAY,
} from './fixtures';
import { buildHourlySalesByRecipe } from './salesActuals';
import { DEMO_NOW_HHMM } from './PlanStore';

// ─────────────────────────────────────────────────────────────────────────────
// Per-day
// ─────────────────────────────────────────────────────────────────────────────

export type DaySummary = {
  date: string;
  /** Total sold so far (all hours). For past dates this is the full day. */
  sold: number;
  /** Total forecast that's already 'due' (full-day for past dates). */
  forecast: number;
  /** sold - forecast. */
  variance: number;
  /** Variance as a % of forecast (0 if forecast is 0). */
  variancePct: number;
  /** Per-recipe rows (sold + forecast for the day). */
  rows: Array<{
    line: AmountsLine;
    sold: number;
    forecast: number;
    variance: number;
    variancePct: number;
  }>;
};

/**
 * Compute one day's sales totals + per-recipe variance for a site.
 * For DEMO_TODAY we use the current clock; for past/future days we treat
 * the full day as elapsed so we can show a complete picture.
 */
export function daySummary(siteId: SiteId, date: string): DaySummary {
  const nowHHMM = date === DEMO_TODAY ? DEMO_NOW_HHMM : '23:59';
  const data = buildHourlySalesByRecipe(siteId, date, nowHHMM);

  const rows = data.rows.map(r => {
    const variance = r.soldSoFar - r.forecastSoFar;
    const variancePct = r.forecastSoFar > 0 ? (variance / r.forecastSoFar) * 100 : 0;
    return {
      line: r.line,
      sold: r.soldSoFar,
      forecast: r.forecastSoFar,
      variance,
      variancePct,
    };
  });

  const variance = data.totalSoldSoFar - data.totalForecastSoFar;
  return {
    date,
    sold: data.totalSoldSoFar,
    forecast: data.totalForecastSoFar,
    variance,
    variancePct: data.totalForecastSoFar > 0 ? (variance / data.totalForecastSoFar) * 100 : 0,
    rows,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-day report
// ─────────────────────────────────────────────────────────────────────────────

export type RecipeAccuracy = {
  skuId: SkuId;
  recipe: ProductionRecipe;
  category: ProductionRecipe['category'];
  /** Sum of sold across all dates. */
  sold: number;
  /** Sum of forecast (the share due) across all dates. */
  forecast: number;
  variance: number;
  variancePct: number;
  /** Days the recipe appeared in (was on the plan). */
  daysSeen: number;
  /** Tendency direction across days — most over, most under, mixed. */
  tendency: 'overshoot' | 'undershoot' | 'on-target' | 'mixed';
};

export type CategoryRollup = {
  category: ProductionRecipe['category'];
  sold: number;
  forecast: number;
  variance: number;
  variancePct: number;
  recipeCount: number;
};

export type SalesReport = {
  siteId: SiteId;
  dates: string[];
  /** Summed totals across the whole window. */
  totalSold: number;
  totalForecast: number;
  totalVariance: number;
  totalVariancePct: number;
  /** Per-day timeline (in chronological order). */
  days: DaySummary[];
  /** Per-recipe accuracy, sorted by abs(variancePct) desc. */
  recipes: RecipeAccuracy[];
  /** Per-category roll-up, sorted by sold desc. */
  categories: CategoryRollup[];
  /** Forecast-accuracy metric: (1 - mean abs error / forecast) × 100. */
  accuracyScore: number;
};

export function siteSalesReport(siteId: SiteId, dates: string[]): SalesReport {
  const days = [...dates].sort().map(d => daySummary(siteId, d));

  // Recipe accumulator
  const recipeAcc = new Map<
    SkuId,
    {
      line: AmountsLine;
      sold: number;
      forecast: number;
      daysSeen: number;
      pcts: number[];
    }
  >();
  for (const day of days) {
    for (const r of day.rows) {
      const skuId = r.line.item.skuId;
      const e = recipeAcc.get(skuId) ?? {
        line: r.line,
        sold: 0,
        forecast: 0,
        daysSeen: 0,
        pcts: [],
      };
      e.sold += r.sold;
      e.forecast += r.forecast;
      e.daysSeen += 1;
      // Track per-day pct so we can call out tendency
      if (r.forecast > 0) e.pcts.push(r.variancePct);
      recipeAcc.set(skuId, e);
    }
  }

  const recipes: RecipeAccuracy[] = Array.from(recipeAcc.entries()).map(([skuId, e]) => {
    const variance = e.sold - e.forecast;
    const variancePct = e.forecast > 0 ? (variance / e.forecast) * 100 : 0;
    const tendency = computeTendency(e.pcts);
    return {
      skuId,
      recipe: e.line.recipe,
      category: e.line.recipe.category,
      sold: e.sold,
      forecast: e.forecast,
      variance,
      variancePct,
      daysSeen: e.daysSeen,
      tendency,
    };
  });
  recipes.sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct));

  // Category roll-up
  const catAcc = new Map<ProductionRecipe['category'], { sold: number; forecast: number; recipeCount: number }>();
  for (const r of recipes) {
    const e = catAcc.get(r.category) ?? { sold: 0, forecast: 0, recipeCount: 0 };
    e.sold += r.sold;
    e.forecast += r.forecast;
    e.recipeCount += 1;
    catAcc.set(r.category, e);
  }
  const categories: CategoryRollup[] = Array.from(catAcc.entries())
    .map(([category, e]) => ({
      category,
      sold: e.sold,
      forecast: e.forecast,
      variance: e.sold - e.forecast,
      variancePct: e.forecast > 0 ? ((e.sold - e.forecast) / e.forecast) * 100 : 0,
      recipeCount: e.recipeCount,
    }))
    .sort((a, b) => b.sold - a.sold);

  const totalSold = days.reduce((a, d) => a + d.sold, 0);
  const totalForecast = days.reduce((a, d) => a + d.forecast, 0);
  const totalVariance = totalSold - totalForecast;

  // Forecast accuracy: a higher score is better (100 = perfect).
  // Computed at the recipe level so a single offsetting big SKU doesn't
  // mask everything else.
  let mae = 0;
  let denom = 0;
  for (const r of recipes) {
    if (r.forecast <= 0) continue;
    mae += Math.abs(r.variance);
    denom += r.forecast;
  }
  const accuracyScore = denom > 0 ? Math.max(0, Math.round((1 - mae / denom) * 100)) : 0;

  return {
    siteId,
    dates,
    totalSold,
    totalForecast,
    totalVariance,
    totalVariancePct: totalForecast > 0 ? (totalVariance / totalForecast) * 100 : 0,
    days,
    recipes,
    categories,
    accuracyScore,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeTendency(pcts: number[]): RecipeAccuracy['tendency'] {
  if (pcts.length === 0) return 'on-target';
  const over = pcts.filter(p => p >= 8).length;
  const under = pcts.filter(p => p <= -8).length;
  if (over === pcts.length) return 'overshoot';
  if (under === pcts.length) return 'undershoot';
  if (over === 0 && under === 0) return 'on-target';
  return 'mixed';
}

export function formatSignedPct(p: number): string {
  if (Math.abs(p) < 1) return '0%';
  const sign = p >= 0 ? '+' : '';
  return `${sign}${Math.round(p)}%`;
}

export function formatVarianceUnits(v: number): string {
  if (v === 0) return '0';
  return v > 0 ? `+${v}` : String(v);
}
