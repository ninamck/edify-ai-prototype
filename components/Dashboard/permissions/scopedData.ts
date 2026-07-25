// Deterministic per-site figures for the scoped insights. Every value is
// derived from the site's position in the estate list, so the same insight
// always shows the same numbers for the same site — and a viewer's cut is
// just "generate for my sites, sum or chart as needed". No randomness: the
// numbers must survive re-renders, reloads and SSR without drift.

import { ALL_SITES, type Site, type SiteId } from './sites';

/** Small stable wobble in [-1, 1] derived from a seed. */
function wobble(seed: number): number {
  return Math.sin(seed * 12.9898) * 0.99;
}

export type SiteWeekFigures = {
  site: Site;
  /** Net sales this week, £k. */
  sales: number;
  /** Net sales prior week, £k. */
  priorSales: number;
  /** Waste over the last 4 weeks, £. */
  waste4wk: number;
  /** Labour as % of net sales this week. */
  labourPct: number;
  /** Gross profit % this week. */
  gpPct: number;
};

function figuresFor(site: Site, index: number): SiteWeekFigures {
  // Base weekly sales spread the estate between ~£26k and ~£54k.
  const sales = 26 + ((index * 7) % 12) * 2.4 + wobble(index + 1) * 1.8;
  const priorSales = sales * (0.94 + 0.08 * ((index % 5) / 4));
  const waste4wk = sales * 1000 * 4 * (0.016 + 0.012 * ((index * 3) % 7) / 6);
  const labourPct = 24 + ((index * 5) % 9) * 0.9 + wobble(index + 20) * 0.6;
  const gpPct = 64 + ((index * 11) % 8) * 0.9 + wobble(index + 40) * 0.7;
  return {
    site,
    sales: round1(sales),
    priorSales: round1(priorSales),
    waste4wk: Math.round(waste4wk / 10) * 10,
    labourPct: round1(labourPct),
    gpPct: round1(gpPct),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const FIGURES_BY_SITE: Map<SiteId, SiteWeekFigures> = new Map(
  ALL_SITES.map((site, i) => [site.id, figuresFor(site, i)]),
);

/** Figures for a viewer's sites, in estate order. Unknown ids are ignored. */
export function figuresForSites(siteIds: SiteId[]): SiteWeekFigures[] {
  return ALL_SITES.filter((s) => siteIds.includes(s.id)).map(
    (s) => FIGURES_BY_SITE.get(s.id)!,
  );
}

// ── Trend series ───────────────────────────────────────────────────────────

export type TrendPoint = { wk: string; sales: number };

/** 12-week net sales trend summed over the given sites, £k per week. */
export function salesTrendForSites(siteIds: SiteId[]): TrendPoint[] {
  const rows = figuresForSites(siteIds);
  const weeks: TrendPoint[] = [];
  for (let w = 0; w < 12; w++) {
    let total = 0;
    for (const row of rows) {
      const idx = ALL_SITES.findIndex((s) => s.id === row.site.id);
      // Gentle estate-wide growth plus a per-site weekly wobble.
      const growth = 0.9 + (w / 11) * 0.14;
      total += row.sales * growth * (1 + wobble(idx * 13 + w) * 0.05);
    }
    weeks.push({ wk: `Wk ${w + 1}`, sales: round1(total) });
  }
  return weeks;
}

// ── Roll-ups for the KPI row ───────────────────────────────────────────────

export type KpiSummary = {
  siteCount: number;
  salesK: number;
  priorSalesK: number;
  wasteTotal: number;
  labourPct: number;
  gpPct: number;
};

export function kpiSummaryForSites(siteIds: SiteId[]): KpiSummary {
  const rows = figuresForSites(siteIds);
  const salesK = rows.reduce((sum, r) => sum + r.sales, 0);
  const priorSalesK = rows.reduce((sum, r) => sum + r.priorSales, 0);
  const wasteTotal = rows.reduce((sum, r) => sum + r.waste4wk / 4, 0);
  // Sales-weighted averages so big sites move the needle appropriately.
  const labourPct =
    rows.reduce((sum, r) => sum + r.labourPct * r.sales, 0) / Math.max(salesK, 1);
  const gpPct = rows.reduce((sum, r) => sum + r.gpPct * r.sales, 0) / Math.max(salesK, 1);
  return {
    siteCount: rows.length,
    salesK: round1(salesK),
    priorSalesK: round1(priorSalesK),
    wasteTotal: Math.round(wasteTotal / 10) * 10,
    labourPct: round1(labourPct),
    gpPct: round1(gpPct),
  };
}
