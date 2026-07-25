/**
 * Weekly flash → digest sections.
 *
 * This is the "builder" half of the email story: it takes the Weekly flash
 * template's insights (the same fixture data the dashboard tiles render)
 * and maps each one to a registry shape. Headline numbers are computed from
 * the row data, not hand-written, so the top story, KPI strip and totals
 * always agree with the tables below them — same property the real build
 * gets by deriving the email from the resolved insight data.
 */

import {
  PRICE_MOVERS,
  WEEKLY_COMPLIANCE,
  WEEKLY_SITES,
  WEEK_LABEL,
} from '@/components/Dashboard/Templates/templateData';
import type { DigestSection, LeagueCell } from './registry';

const fmtK = (n: number) => `£${(n / 1000).toFixed(1)}k`;

// ── Derived estate numbers ──────────────────────────────────────────────────

const totalSales = WEEKLY_SITES.reduce((s, r) => s + r.sales, 0);
// Back out last week's sales from each site's vs-LW % to get the estate delta.
const totalLastWeek = WEEKLY_SITES.reduce((s, r) => s + r.sales / (1 + r.vsLwPct / 100), 0);
const estateVsLwPct = (totalSales / totalLastWeek - 1) * 100;

// Sales-weighted estate waste % and best/worst movers.
const estateWastePct =
  WEEKLY_SITES.reduce((s, r) => s + r.sales * r.wastePctOfSales, 0) / totalSales;
const bestSite = [...WEEKLY_SITES].sort((a, b) => b.vsLwPct - a.vsLwPct)[0];
const driftingSites = WEEKLY_SITES.filter((r) => r.spendVsTrailing4wkPct > 4).map((r) => r.site);
const missingStocktake = WEEKLY_SITES.filter((r) => !r.stocktakeDone).map((r) => r.site);
const priceCreepPerWeek = PRICE_MOVERS.reduce((s, m) => s + m.weeklyImpact, 0);

export const WEEKLY_DIGEST_META = {
  name: 'Weekly flash',
  scope: 'All sites',
  weekLabel: WEEK_LABEL,
  cadence: 'Weekly (Mon) at 07:00',
};

// ── Sections ────────────────────────────────────────────────────────────────

export function buildWeeklyFlashSections(): DigestSection[] {
  const leagueRows: LeagueCell[][] = WEEKLY_SITES.map((s) => {
    const base: LeagueCell[] = [
      { kind: 'text', value: s.site, strong: true },
      { kind: 'money', value: s.sales },
      { kind: 'delta', delta: { value: s.vsLwPct } },
      { kind: 'delta', delta: { value: s.vsForecastPct } },
      { kind: 'pct', value: s.theoGpPct },
    ];
    if (s.stocktakeDone && s.actualGpPct !== null) {
      base.push(
        { kind: 'pct', value: s.actualGpPct },
        { kind: 'delta', delta: { value: s.actualGpPct - s.theoGpPct, suffix: 'pp' } },
      );
    } else {
      base.push({ kind: 'flag', text: 'No stocktake — not computable', span: 2 });
    }
    return base;
  });

  return [
    {
      shape: 'top-story',
      kicker: `Estate sales · vs last week · ${WEEK_LABEL}`,
      headline: [
        'Estate lands at ',
        { em: fmtK(totalSales) },
        `, ${estateVsLwPct >= 0 ? 'up' : 'down'} ${Math.abs(estateVsLwPct).toFixed(1)}% on last week.`,
      ],
      subline: `${WEEKLY_SITES.length} sites · ${driftingSites.join(' and ')} drifting on spend · ${missingStocktake.join(', ')} stocktake missing`,
    },
    {
      shape: 'kpi-row',
      items: [
        {
          label: 'Estate sales',
          value: fmtK(totalSales),
          sub: `${estateVsLwPct >= 0 ? '+' : '−'}${Math.abs(estateVsLwPct).toFixed(1)}% vs LW`,
          tone: 'plain',
        },
        {
          label: 'Best mover',
          value: bestSite.site,
          sub: `+${bestSite.vsLwPct.toFixed(1)}% vs LW`,
          tone: 'good',
        },
        {
          label: 'Waste',
          value: `${estateWastePct.toFixed(1)}%`,
          sub: 'of sales · target 1.5%',
          tone: estateWastePct <= 1.5 ? 'good' : 'bad',
        },
        {
          label: 'Stocktakes',
          value: `${WEEKLY_COMPLIANCE.stocktakesDone} of ${WEEKLY_COMPLIANCE.stocktakesDue}`,
          sub: `${missingStocktake.join(', ')} outstanding`,
          tone: WEEKLY_COMPLIANCE.stocktakesDone === WEEKLY_COMPLIANCE.stocktakesDue ? 'good' : 'bad',
        },
      ],
    },
    {
      shape: 'league-table',
      title: 'Site league · sales and GP',
      contextNote: `Last week · ${WEEK_LABEL}`,
      ranked: true,
      columns: [
        { label: 'Site', align: 'left' },
        { label: 'Sales' },
        { label: 'vs LW' },
        { label: 'vs forecast' },
        { label: 'Theo GP' },
        { label: 'Actual GP' },
        { label: 'Variance' },
      ],
      rows: leagueRows,
      totals: [
        { kind: 'text', value: 'Estate', strong: true },
        { kind: 'money', value: totalSales },
        { kind: 'delta', delta: { value: estateVsLwPct } },
        { kind: 'text', value: '', muted: true },
        { kind: 'text', value: '', muted: true },
        { kind: 'text', value: '', muted: true },
        { kind: 'text', value: '', muted: true },
      ],
      footnote:
        'Shoreditch didn\u2019t count this week, so no actual-GP claim is made for it — the flag stays until the count is done.',
    },
    {
      shape: 'ranked-bars',
      title: 'Waste as % of sales · by site',
      contextNote: 'Best first · target 1.5%',
      unit: '%',
      rows: [...WEEKLY_SITES]
        .sort((a, b) => a.wastePctOfSales - b.wastePctOfSales)
        .map((s) => ({ label: s.site, value: s.wastePctOfSales, good: s.wastePctOfSales <= 1.5 })),
      targetNote: 'Green = at or under the 1.5% target',
    },
    {
      shape: 'ranked-bars',
      title: 'Spend vs trailing 4-week average',
      contextNote: 'Own baseline · drift signal',
      unit: '%',
      diverging: true,
      rows: WEEKLY_SITES.map((s) => ({
        label: s.site,
        value: s.spendVsTrailing4wkPct,
        good: s.spendVsTrailing4wkPct <= 4,
      })),
      footnote:
        `${driftingSites.join(' and ')} are both >5% above their own baseline. That\u2019s the drift signal, before any budget exists.`,
    },
    {
      shape: 'league-table',
      title: 'Top 5 price movers',
      contextNote: 'Line-level invoice prices',
      badge: 'Measured',
      columns: [
        { label: 'Item', align: 'left' },
        { label: 'Supplier', align: 'left' },
        { label: 'Price' },
        { label: 'Change' },
        { label: '£ / week' },
      ],
      rows: PRICE_MOVERS.map((m) => [
        { kind: 'text', value: m.item, strong: true },
        { kind: 'text', value: m.supplier, muted: true },
        { kind: 'text', value: `${m.oldPrice} → ${m.newPrice}` },
        { kind: 'delta', delta: { value: m.changePct, goodWhenDown: true } },
        { kind: 'delta', delta: { value: m.weeklyImpact, prefix: '£', suffix: '', dp: 0, goodWhenDown: true } },
      ] satisfies LeagueCell[]),
      footnote: `Net £${priceCreepPerWeek}/week of price creep across the five. The oat milk rise alone is ~£1,120 annualised across the estate — worth a supplier conversation.`,
    },
    {
      shape: 'compliance',
      title: 'Compliance strip',
      contextNote: 'Last week · all sites',
      items: [
        {
          label: 'Invoices matched',
          value: `${WEEKLY_COMPLIANCE.invoicesMatchedPct}%`,
          good: WEEKLY_COMPLIANCE.invoicesMatchedPct >= 90,
          detail: 'of last week\u2019s invoices matched to a PO or GRN',
        },
        {
          label: 'Off-catalogue POs',
          value: `${WEEKLY_COMPLIANCE.offCataloguePos}`,
          good: WEEKLY_COMPLIANCE.offCataloguePos <= 3,
          detail: 'orders placed outside the agreed catalogue',
        },
        {
          label: 'Stocktakes completed',
          value: `${WEEKLY_COMPLIANCE.stocktakesDone} of ${WEEKLY_COMPLIANCE.stocktakesDue}`,
          good: WEEKLY_COMPLIANCE.stocktakesDone === WEEKLY_COMPLIANCE.stocktakesDue,
          detail: `${missingStocktake.join(', ')} outstanding — its actual GP is blank above`,
        },
        {
          label: 'Waste-logging days',
          value: `${WEEKLY_COMPLIANCE.wasteLoggingDays} of ${WEEKLY_COMPLIANCE.wasteLoggingDaysDue}`,
          good: WEEKLY_COMPLIANCE.wasteLoggingDays >= WEEKLY_COMPLIANCE.wasteLoggingDaysDue - 2,
          detail: 'site-days with at least one waste log',
        },
      ],
    },
  ];
}
