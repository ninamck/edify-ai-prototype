/**
 * Pure derivations for the Forecast page.
 *
 * Two jobs:
 *   1. Build the per-SKU horizon rows (today + N days). Each row collects
 *      the forecast for every date in the horizon, so the grid is a pure
 *      table read with no side-effects.
 *   2. Backtest the forecast against the synthesised actuals from
 *      `salesActuals.ts`. We reuse `siteSalesReport` so the variance /
 *      accuracy maths stays in one place — this file is the
 *      Forecast-page-specific shape over the same numbers.
 *
 * Nothing in here mutates fixtures or hooks into React state. Page-level
 * overrides ride on top of these results in `page.tsx`.
 */

import {
  forecastFor,
  getRecipe,
  productionItemsAt,
  getSite,
  type DemandForecastEntry,
  type ProductionRecipe,
  type SiteId,
  type SkuId,
} from '@/components/Production/fixtures';
import { siteSalesReport, type SalesReport } from '@/components/Production/salesReport';

/** One SKU's worth of forecast across the horizon. The grid renders an array of these. */
export type ForecastRow = {
  skuId: SkuId;
  recipe: ProductionRecipe;
  category: ProductionRecipe['category'];
  /** Forecast entries by date — same length as the `dates` arg passed in. */
  byDate: Array<{
    date: string;
    forecast: DemandForecastEntry | undefined;
  }>;
  /** Forecast total across the whole horizon — used to default-sort biggest first. */
  horizonTotal: number;
  /** Whether *any* day in the horizon is still in draft (a quiet "Quinn is firming up" signal). */
  hasDraft: boolean;
};

/**
 * Build the per-SKU horizon rows for a site.
 *
 * The set of SKUs is the union of:
 *   • Every SKU the site directly produces (`productionItemsAt`)
 *   • Every SKU that has a forecast entry for this site on any date in
 *     the window — covers spoke-derived forecasts where the spoke
 *     doesn't directly carry production items but `forecastFor` still
 *     returns a scaled hub forecast.
 *
 * Rows with zero total demand across the horizon are dropped — the grid
 * stays focused on the SKUs the operator actually has decisions about.
 */
export function buildForecastRows(siteId: SiteId, dates: string[]): ForecastRow[] {
  const skuToRecipe = new Map<SkuId, ProductionRecipe>();

  // Direct producers — the site's own ProductionItem list.
  for (const item of productionItemsAt(siteId)) {
    const recipe = getRecipe(item.recipeId);
    if (recipe) skuToRecipe.set(item.skuId, recipe);
  }

  // Hub-linked sites (spokes / hybrids / linked-standalones) don't carry
  // their own production items for the full menu — fall back to the
  // parent hub's items so the grid can show every SKU the site sells.
  const site = getSite(siteId);
  if (site?.hubId) {
    for (const item of productionItemsAt(site.hubId)) {
      const recipe = getRecipe(item.recipeId);
      if (recipe && !skuToRecipe.has(item.skuId)) {
        skuToRecipe.set(item.skuId, recipe);
      }
    }
  }

  const rows: ForecastRow[] = [];
  for (const [skuId, recipe] of skuToRecipe.entries()) {
    const byDate = dates.map(date => ({
      date,
      forecast: forecastFor(siteId, skuId, date),
    }));
    const horizonTotal = byDate.reduce(
      (a, b) => a + (b.forecast?.projectedUnits ?? 0),
      0,
    );
    if (horizonTotal <= 0) continue;
    const hasDraft = byDate.some(b => b.forecast?.status === 'draft');
    rows.push({
      skuId,
      recipe,
      category: recipe.category,
      byDate,
      horizonTotal,
      hasDraft,
    });
  }
  rows.sort((a, b) => b.horizonTotal - a.horizonTotal);
  return rows;
}

// ────────────────────────────────────────────────────────────────────────────
// Backtest — the accuracy story for AccuracyStrip + BacktestStrip.
// ────────────────────────────────────────────────────────────────────────────

/** Headline metrics for the AccuracyStrip — derived from `siteSalesReport`. */
export type AccuracyHeadline = {
  /** Totals across the backtest window. */
  totalForecast: number;
  totalActual: number;
  variance: number;
  variancePct: number;
  /** Quinn's accuracy score in 0–100 (100 = perfect). Mirrors salesReport.ts. */
  accuracyScore: number;
  /** Underlying per-recipe + per-day data so downstream tiles don't recompute. */
  report: SalesReport;
  /** Best-tracked SKU — smallest |variancePct|, tie-broken by biggest forecast. */
  best?: SkuAccuracy;
  /** Most-off SKU — biggest |variancePct| with material volume. */
  worst?: SkuAccuracy;
};

/** Compact accuracy summary for one SKU over the backtest window. */
export type SkuAccuracy = {
  skuId: SkuId;
  recipeName: string;
  category: ProductionRecipe['category'];
  forecast: number;
  actual: number;
  variance: number;
  variancePct: number;
};

/**
 * Compute the headline accuracy panel for the given backtest window.
 *
 * "Best-tracked" deliberately excludes very-low-volume rows (forecast
 * below 10 across the window) — a SKU that was forecast as 1 and sold 1
 * is technically 100% accurate but tells the operator nothing about the
 * model. The threshold is per-window, so a 7-day window asks for ~1.5
 * units/day before we surface it as a hero.
 */
export function getAccuracyHeadline(siteId: SiteId, dates: string[]): AccuracyHeadline {
  const report = siteSalesReport(siteId, dates);
  const totalForecast = report.totalForecast;
  const totalActual = report.totalSold;
  const variance = totalActual - totalForecast;

  const eligible = report.recipes.filter(r => r.forecast >= 10);
  let best: SkuAccuracy | undefined;
  let worst: SkuAccuracy | undefined;

  if (eligible.length > 0) {
    const sorted = [...eligible].sort(
      (a, b) => Math.abs(a.variancePct) - Math.abs(b.variancePct),
    );
    const bestRow = sorted[0];
    const worstRow = sorted[sorted.length - 1];
    best = toSkuAccuracy(bestRow);
    worst = toSkuAccuracy(worstRow);
  }

  return {
    totalForecast,
    totalActual,
    variance,
    variancePct: report.totalVariancePct,
    accuracyScore: report.accuracyScore,
    report,
    best,
    worst,
  };
}

function toSkuAccuracy(row: SalesReport['recipes'][number]): SkuAccuracy {
  return {
    skuId: row.skuId,
    recipeName: row.recipe.name,
    category: row.recipe.category,
    forecast: row.forecast,
    actual: row.sold,
    variance: row.variance,
    variancePct: row.variancePct,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Sparkline — actuals for a single SKU across the backtest window.
// ────────────────────────────────────────────────────────────────────────────

export type SparklinePoint = {
  date: string;
  forecast: number;
  actual: number;
};

/**
 * Per-day forecast vs actual for one SKU — used by the WhyPanel sparkline.
 *
 * Implementation note: we re-derive this from `siteSalesReport` rather
 * than walking each day with `buildHourlySalesByRecipe` ourselves so the
 * actuals stay deterministic with the AccuracyStrip / BacktestStrip
 * (which read the same report).
 */
export function buildSparklineForSku(
  siteId: SiteId,
  skuId: SkuId,
  dates: string[],
): SparklinePoint[] {
  const report = siteSalesReport(siteId, dates);
  const points: SparklinePoint[] = [];
  for (const day of report.days) {
    const row = day.rows.find(r => r.line.item.skuId === skuId);
    points.push({
      date: day.date,
      forecast: row?.forecast ?? 0,
      actual: row?.sold ?? 0,
    });
  }
  return points;
}
