// ────────────────────────────────────────────────────────────────────────────
// Dunkin chart insights
// ────────────────────────────────────────────────────────────────────────────
//
// Each builder loads the relevant Dunkin CSV at call time and returns a short
// narrative describing what the chart actually shows. The narratives use
// markdown bold so the resulting Quinn message reads like a quick analyst
// note ("Top store this week: Boston #103 at $54k, up 6% vs prior week…").
//
// Builders are async so they can lazy-load the same shared CSV cache that
// powers the Dunkin chart components — no extra fetches if the chart already
// rendered. If a builder throws or finds no rows, callers fall back to the
// static `reasoning` string from `DUNKIN_ANALYTICS_CONFIG`.

import { loadFlashReport, type FlashReportRow } from '@/components/Mvp1/Tables/dataSources/flashReport';
import {
  loadWeeklySalesBySite,
  type WeeklySalesBySiteRow,
} from '@/components/Mvp1/Tables/dataSources/weeklySalesBySite';
import {
  loadWeeklyFlashTotals,
  type WeeklyFlashTotalsRow,
} from '@/components/Mvp1/Tables/dataSources/weeklyFlashTotals';
import {
  loadDailySalesBySite,
  type DailySalesBySiteRow,
} from '@/components/Mvp1/Tables/dataSources/dailySalesBySite';
import {
  loadDailySalesByProductFamily,
  type DailySalesByProductFamilyRow,
} from '@/components/Mvp1/Tables/dataSources/dailySalesByProductFamily';
import {
  loadWeeklyLaborCosts,
  type WeeklyLaborCostsRow,
} from '@/components/Mvp1/Tables/dataSources/weeklyLaborCosts';
import type { DunkinAnalyticsChartId } from './DunkinAnalyticsCharts';

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtCurrency(value: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (opts.compact) {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

function fmtNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function shortName(name: string | undefined, fallback = 'store'): string {
  const head = (name ?? '').split(',')[0]?.trim();
  return head && head.length > 0 ? head : fallback;
}

// ── Generic helpers ─────────────────────────────────────────────────────────

type WeeklyKey = { year: number; week: number };

function latestWeekFromRows<T extends { year: number | null; week_number: number | null }>(
  rows: T[],
): WeeklyKey {
  return rows.reduce<WeeklyKey>(
    (acc, r) => {
      const y = (r.year ?? 0) as number;
      const w = (r.week_number ?? 0) as number;
      if (y > acc.year || (y === acc.year && w > acc.week)) return { year: y, week: w };
      return acc;
    },
    { year: 0, week: 0 },
  );
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pctChange(current: number, prior: number): number {
  if (prior === 0) return 0;
  return ((current - prior) / prior) * 100;
}

// ── Per-chart builders ──────────────────────────────────────────────────────

async function totalSalesLastWeek(): Promise<string> {
  const rows = await loadWeeklyFlashTotals();
  if (rows.length === 0) return '';
  const sorted = [...rows].sort((a, b) =>
    String(a.week_start_date).localeCompare(String(b.week_start_date)),
  );
  const latest = sorted[sorted.length - 1]!;
  const prior = sorted[sorted.length - 2];
  const window4 = sorted.slice(-4);
  const avg4 = mean(window4.map((r) => (r.overall_total ?? 0) as number));
  const wow = prior
    ? pctChange((latest.overall_total ?? 0) as number, (prior.overall_total ?? 0) as number)
    : 0;
  const ec = (latest.ec_total ?? 0) as number;
  const total = (latest.overall_total ?? 0) as number;
  const ecShare = total > 0 ? (ec / total) * 100 : 0;
  return [
    `Most recent week (W${latest.week_number ?? '?'}, starting ${latest.week_start_date}) totalled **${fmtCurrency(total, { compact: true })}**${prior ? `, **${fmtPct(wow)}** vs the prior week` : ''}.`,
    `EC stores account for **${ecShare.toFixed(1)}%** of the total (${fmtCurrency(ec, { compact: true })}); the remaining ${fmtCurrency(total - ec, { compact: true })} comes from non-EC.`,
    `4-week trailing average sits at **${fmtCurrency(avg4, { compact: true })}**, so this week is ${total >= avg4 ? 'ahead' : 'behind'} the recent run-rate.`,
  ].join(' ');
}

async function topStores30d(): Promise<string> {
  const rows = await loadDailySalesBySite();
  if (rows.length === 0) return '';
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const key = r.name || r.location || 'Unknown';
    buckets.set(key, (buckets.get(key) ?? 0) + ((r.total_sales ?? 0) as number));
  }
  const ranked = Array.from(buckets.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  if (ranked.length === 0) return '';
  const top = ranked.slice(0, 3);
  const bottom = ranked.slice(-3).reverse();
  const total = ranked.reduce((s, p) => s + p.value, 0);
  const top3Share = total > 0 ? (top.reduce((s, p) => s + p.value, 0) / total) * 100 : 0;
  return [
    `Across **${ranked.length} stores**, the top performer is **${shortName(top[0]!.name)}** at **${fmtCurrency(top[0]!.value, { compact: true })}**, followed by ${shortName(top[1]?.name)} (${fmtCurrency(top[1]?.value ?? 0, { compact: true })}) and ${shortName(top[2]?.name)} (${fmtCurrency(top[2]?.value ?? 0, { compact: true })}).`,
    `The top 3 alone drive **${top3Share.toFixed(1)}%** of total recorded sales.`,
    `The bottom 3 — ${shortName(bottom[0]!.name)} (${fmtCurrency(bottom[0]!.value, { compact: true })}), ${shortName(bottom[1]?.name)} (${fmtCurrency(bottom[1]?.value ?? 0, { compact: true })}), ${shortName(bottom[2]?.name)} (${fmtCurrency(bottom[2]?.value ?? 0, { compact: true })}) — sit well below the leaders, worth a manager conversation about traffic and trading hours.`,
  ].join(' ');
}

async function lflVsLy(): Promise<string> {
  const rows = await loadWeeklySalesBySite();
  if (rows.length === 0) return '';
  const latest = latestWeekFromRows(rows);
  const week = rows.filter((r) => r.year === latest.year && r.week_number === latest.week);
  if (week.length === 0) return '';
  const totalCur = week.reduce((s, r) => s + ((r.total_sales ?? 0) as number), 0);
  const totalLy = week.reduce((s, r) => s + ((r.total_sales_ly ?? 0) as number), 0);
  const networkPct = pctChange(totalCur, totalLy);
  const above = week.filter((r) => (r.total_sales_ly_pct ?? 0) > 0).length;
  const below = week.filter((r) => (r.total_sales_ly_pct ?? 0) < 0).length;
  const sortedByPct = [...week].sort(
    (a, b) => ((b.total_sales_ly_pct ?? 0) as number) - ((a.total_sales_ly_pct ?? 0) as number),
  );
  const best = sortedByPct[0]!;
  const worst = sortedByPct[sortedByPct.length - 1]!;
  return [
    `Network total this week is **${fmtCurrency(totalCur, { compact: true })}** vs **${fmtCurrency(totalLy, { compact: true })}** the same week last year — a **${fmtPct(networkPct)}** comp.`,
    `**${above}** stores are above last year and **${below}** are below.`,
    `Best mover: **${shortName(best.name)}** at **${fmtPct((best.total_sales_ly_pct ?? 0) as number)}**. Biggest drag: **${shortName(worst.name)}** at **${fmtPct((worst.total_sales_ly_pct ?? 0) as number)}**.`,
  ].join(' ');
}

async function avgTicketBySite(): Promise<string> {
  const rows = await loadWeeklySalesBySite();
  if (rows.length === 0) return '';
  const sorted = [...rows].sort((a, b) => {
    const ay = (a.year ?? 0) as number;
    const by = (b.year ?? 0) as number;
    if (ay !== by) return by - ay;
    return ((b.week_number ?? 0) as number) - ((a.week_number ?? 0) as number);
  });
  const recentKeys = new Set<number>();
  for (const r of sorted) {
    recentKeys.add(((r.year ?? 0) as number) * 100 + ((r.week_number ?? 0) as number));
    if (recentKeys.size >= 4) break;
  }
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const r of sorted) {
    const key = ((r.year ?? 0) as number) * 100 + ((r.week_number ?? 0) as number);
    if (!recentKeys.has(key)) continue;
    const v = r.average_ticket;
    if (v === null || v === undefined) continue;
    const slot = buckets.get(r.name || r.location || 'Unknown') ?? { sum: 0, count: 0 };
    slot.sum += v as number;
    slot.count += 1;
    buckets.set(r.name || r.location || 'Unknown', slot);
  }
  const points = Array.from(buckets.entries())
    .map(([name, b]) => ({ name, value: b.count > 0 ? b.sum / b.count : 0 }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  if (points.length === 0) return '';
  const networkAvg = mean(points.map((p) => p.value));
  const top = points[0]!;
  const bottom = points[points.length - 1]!;
  const spread = top.value - bottom.value;
  return [
    `Across **${points.length} stores** the average ticket sits at **$${networkAvg.toFixed(2)}** over the last four weeks.`,
    `**${shortName(top.name)}** leads at **$${top.value.toFixed(2)}** while **${shortName(bottom.name)}** trails at **$${bottom.value.toFixed(2)}** — a $${spread.toFixed(2)} spread.`,
    `Stores below the network average are most likely candidates for upsell coaching or menu attachment plays.`,
  ].join(' ');
}

async function revenueTrend12wk(): Promise<string> {
  const rows = await loadWeeklyFlashTotals();
  if (rows.length === 0) return '';
  const sorted = [...rows].sort((a, b) =>
    String(a.week_start_date).localeCompare(String(b.week_start_date)),
  );
  const window12 = sorted.slice(-12);
  if (window12.length < 2) return '';
  const first = window12[0]!;
  const last = window12[window12.length - 1]!;
  const change = pctChange(
    (last.overall_total ?? 0) as number,
    (first.overall_total ?? 0) as number,
  );
  const peak = window12.reduce((acc, r) =>
    ((r.overall_total ?? 0) as number) > ((acc.overall_total ?? 0) as number) ? r : acc,
  );
  const trough = window12.reduce((acc, r) =>
    ((r.overall_total ?? 0) as number) < ((acc.overall_total ?? 0) as number) ? r : acc,
  );
  const avg = mean(window12.map((r) => (r.overall_total ?? 0) as number));
  return [
    `Over the last ${window12.length} weeks the network has moved from **${fmtCurrency((first.overall_total ?? 0) as number, { compact: true })}** to **${fmtCurrency((last.overall_total ?? 0) as number, { compact: true })}** — a **${fmtPct(change)}** swing.`,
    `Peak week: W${peak.week_number} at **${fmtCurrency((peak.overall_total ?? 0) as number, { compact: true })}**. Lowest: W${trough.week_number} at ${fmtCurrency((trough.overall_total ?? 0) as number, { compact: true })}.`,
    `Window average is ${fmtCurrency(avg, { compact: true })}, so this week ${((last.overall_total ?? 0) as number) >= avg ? 'is running at or above the trend' : 'is below the recent trend'}.`,
  ].join(' ');
}

async function productCategorySales(): Promise<string> {
  const rows = await loadDailySalesByProductFamily();
  if (rows.length === 0) return '';
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const k = (r.major_group_name ?? '').trim() || 'Other';
    buckets.set(k, (buckets.get(k) ?? 0) + ((r.gross_sales ?? 0) as number));
  }
  const ranked = Array.from(buckets.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  if (ranked.length === 0) return '';
  const total = ranked.reduce((s, p) => s + p.value, 0);
  const top = ranked[0]!;
  const second = ranked[1];
  return [
    `**${top.name}** is the largest category at **${fmtCurrency(top.value, { compact: true })}** — **${((top.value / total) * 100).toFixed(1)}%** of recorded gross sales.`,
    second
      ? `**${second.name}** is second at ${fmtCurrency(second.value, { compact: true })} (${((second.value / total) * 100).toFixed(1)}%).`
      : '',
    `**${ranked.length} categories** in total; the top 2 deliver ${(((top.value + (second?.value ?? 0)) / total) * 100).toFixed(1)}% of revenue, so menu mix is concentrated.`,
  ]
    .filter(Boolean)
    .join(' ');
}

async function momGrowthBySite(): Promise<string> {
  const rows = await loadWeeklySalesBySite();
  if (rows.length === 0) return '';
  const latest = latestWeekFromRows(rows);
  const week = rows.filter((r) => r.year === latest.year && r.week_number === latest.week);
  const points = week
    .map((r) => ({
      name: r.name || r.location || 'Unknown',
      value: (r.total_sales_ly_pct ?? 0) as number,
    }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => b.value - a.value);
  if (points.length === 0) return '';
  const top3 = points.slice(0, 3);
  const networkAvg = mean(points.map((p) => p.value));
  return [
    `In W${latest.week} the strongest growth is **${shortName(top3[0]!.name)}** at **${fmtPct(top3[0]!.value)}**${top3[1] ? `, with ${shortName(top3[1].name)} (${fmtPct(top3[1].value)}) and ${shortName(top3[2]?.name)} (${fmtPct(top3[2]?.value ?? 0)}) close behind` : ''}.`,
    `Network-average comp this week is **${fmtPct(networkAvg)}**, so the top 3 are running materially ahead of the chain.`,
    `Worth understanding what they're doing differently — promo mix, staffing, or trading hours — and whether it can be replicated across the rest of the estate.`,
  ].join(' ');
}

async function revenuePerLabourHour(): Promise<string> {
  const rows = await loadFlashReport();
  if (rows.length === 0) return '';
  const latest = latestWeekFromRows(rows);
  const week = rows.filter((r) => r.year === latest.year && r.week_number === latest.week);
  const points = week
    .map((r) => {
      const sales = (r.total_sales ?? 0) as number;
      const hours = (r.labor_hours ?? 0) as number;
      return {
        name: r.name || r.location || 'Unknown',
        value: hours > 0 ? sales / hours : 0,
      };
    })
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  if (points.length === 0) return '';
  const networkAvg = mean(points.map((p) => p.value));
  const top = points[0]!;
  const bottom = points[points.length - 1]!;
  return [
    `Network revenue per labour hour averages **$${networkAvg.toFixed(0)}/hr** this week.`,
    `**${shortName(top.name)}** is the most productive at **$${top.value.toFixed(0)}/hr**; **${shortName(bottom.name)}** is the lowest at **$${bottom.value.toFixed(0)}/hr** — a ${(((top.value - bottom.value) / bottom.value) * 100).toFixed(0)}% gap.`,
    `Bringing the bottom quartile up to the network average would meaningfully shift labour efficiency without cutting service speed.`,
  ].join(' ');
}

async function basketSizeBySite(): Promise<string> {
  const rows = await loadFlashReport();
  if (rows.length === 0) return '';
  const buckets = new Map<string, { sum: number; count: number; name: string }>();
  for (const r of rows) {
    const v = (r.average_ticket ?? 0) as number;
    if (!Number.isFinite(v) || v === 0) continue;
    const key = r.name || r.location || 'Unknown';
    const slot = buckets.get(key) ?? { sum: 0, count: 0, name: key };
    slot.sum += v;
    slot.count += 1;
    buckets.set(key, slot);
  }
  const points = Array.from(buckets.values())
    .map((b) => ({ name: b.name, value: b.count > 0 ? b.sum / b.count : 0 }))
    .sort((a, b) => b.value - a.value);
  if (points.length === 0) return '';
  const top = points[0]!;
  const bottom = points[points.length - 1]!;
  const networkAvg = mean(points.map((p) => p.value));
  return [
    `Average basket across the network sits at **$${networkAvg.toFixed(2)}** per visit.`,
    `**${shortName(top.name)}** has the largest basket at **$${top.value.toFixed(2)}** while **${shortName(bottom.name)}** is lowest at **$${bottom.value.toFixed(2)}** — a $${(top.value - bottom.value).toFixed(2)} delta.`,
    `Pair this with traffic to understand whether sales gaps are basket-driven or footfall-driven.`,
  ].join(' ');
}

async function siteRankVsNetwork(): Promise<string> {
  const rows = await loadWeeklySalesBySite();
  if (rows.length === 0) return '';
  const latest = latestWeekFromRows(rows);
  const week = rows.filter((r) => r.year === latest.year && r.week_number === latest.week);
  const buckets = new Map<string, number>();
  for (const r of week) {
    const key = r.name || r.location || 'Unknown';
    buckets.set(key, (buckets.get(key) ?? 0) + ((r.total_sales ?? 0) as number));
  }
  const totals = Array.from(buckets.entries()).map(([name, value]) => ({ name, value }));
  if (totals.length === 0) return '';
  const networkAvg = mean(totals.map((p) => p.value));
  const above = totals.filter((p) => p.value >= networkAvg).length;
  const below = totals.length - above;
  const sorted = [...totals].sort((a, b) => b.value - a.value);
  const leader = sorted[0]!;
  const laggard = sorted[sorted.length - 1]!;
  return [
    `Network mean this week is **${fmtCurrency(networkAvg, { compact: true })}** per store.`,
    `**${above} stores** are at or above the average and **${below}** are below.`,
    `Top ranking: **${shortName(leader.name)}** at **${fmtPct(((leader.value - networkAvg) / networkAvg) * 100)}** above the mean. Bottom: **${shortName(laggard.name)}** at ${fmtPct(((laggard.value - networkAvg) / networkAvg) * 100)}.`,
  ].join(' ');
}

async function underperformers(): Promise<string> {
  const rows = await loadWeeklySalesBySite();
  if (rows.length === 0) return '';
  const latest = latestWeekFromRows(rows);
  const week = rows.filter((r) => r.year === latest.year && r.week_number === latest.week);
  const negatives = week
    .map((r) => ({
      name: r.name || r.location || 'Unknown',
      value: (r.total_sales_ly_pct ?? 0) as number,
      sales: (r.total_sales ?? 0) as number,
    }))
    .filter((p) => p.value < 0)
    .sort((a, b) => a.value - b.value);
  if (negatives.length === 0) {
    return `Every store in W${latest.week} is at or above last year — no negative-comp underperformers this week.`;
  }
  const worst = negatives[0]!;
  const lostSales = negatives.reduce((s, p) => {
    const ly = p.value === 0 ? 0 : p.sales / (1 + p.value / 100);
    return s + (p.sales - ly);
  }, 0);
  return [
    `**${negatives.length} stores** are running below LY in W${latest.week}.`,
    `Worst offender: **${shortName(worst.name)}** at **${fmtPct(worst.value)}**.`,
    `Combined LY gap across these stores is roughly **${fmtCurrency(Math.abs(lostSales), { compact: true })}** of comp drag this week.`,
  ].join(' ');
}

async function avgTicketTrend(): Promise<string> {
  const rows = await loadFlashReport();
  if (rows.length === 0) return '';
  const buckets = new Map<string, { sum: number; count: number; year: number; week: number }>();
  for (const r of rows) {
    const y = (r.year ?? 0) as number;
    const w = (r.week_number ?? 0) as number;
    if (!w) continue;
    const v = (r.average_ticket ?? 0) as number;
    if (!Number.isFinite(v) || v === 0) continue;
    const key = `${y}-${String(w).padStart(2, '0')}`;
    const slot = buckets.get(key) ?? { sum: 0, count: 0, year: y, week: w };
    slot.sum += v;
    slot.count += 1;
    buckets.set(key, slot);
  }
  const series = Array.from(buckets.values())
    .sort((a, b) => a.year - b.year || a.week - b.week)
    .slice(-13)
    .map((b) => ({ week: b.week, value: b.sum / b.count }));
  if (series.length < 2) return '';
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const change = pctChange(last.value, first.value);
  return [
    `Network average ticket has moved from **$${first.value.toFixed(2)}** in W${first.week} to **$${last.value.toFixed(2)}** in W${last.week} — a **${fmtPct(change)}** shift across the trailing ${series.length} weeks.`,
    `${change >= 0 ? 'Upward' : 'Downward'} drift typically reflects ${change >= 0 ? 'price take or favourable mix' : 'discounting or value-bias mix shift'}.`,
    `Pair this with the basket-size view to see whether the change is universal or driven by a handful of stores.`,
  ].join(' ');
}

async function flashReportSiteAvg(
  metric: keyof FlashReportRow,
): Promise<{ name: string; value: number }[]> {
  const rows = await loadFlashReport();
  const latest = latestWeekFromRows(rows);
  const week = rows.filter((r) => r.year === latest.year && r.week_number === latest.week);
  const buckets = new Map<string, { sum: number; count: number; name: string }>();
  for (const r of week) {
    const v = r[metric] as number | null;
    if (v === null || v === undefined || !Number.isFinite(v as number)) continue;
    const key = (r.name as string) || (r.location as string) || 'Unknown';
    const slot = buckets.get(key) ?? { sum: 0, count: 0, name: key };
    slot.sum += v as number;
    slot.count += 1;
    buckets.set(key, slot);
  }
  return Array.from(buckets.values())
    .map((b) => ({ name: b.name, value: b.count > 0 ? b.sum / b.count : 0 }));
}

async function foodCostPctBySite(): Promise<string> {
  const points = await flashReportSiteAvg('food_supply_cost_sales_pct');
  if (points.length === 0) return '';
  const networkAvg = mean(points.map((p) => p.value));
  const sorted = [...points].sort((a, b) => b.value - a.value);
  const worst = sorted[0]!;
  const best = sorted[sorted.length - 1]!;
  const above30 = points.filter((p) => p.value > 30).length;
  return [
    `Network food cost runs at **${networkAvg.toFixed(1)}%** of sales this week.`,
    `**${shortName(worst.name)}** is the highest at **${worst.value.toFixed(1)}%**, **${shortName(best.name)}** the leanest at **${best.value.toFixed(1)}%**.`,
    `**${above30}** stores are above the 30% threshold — those are the priorities for waste, par-level, and prep-discipline coaching.`,
  ].join(' ');
}

async function foodCostPctTrend(): Promise<string> {
  const rows = await loadFlashReport();
  const buckets = new Map<string, { sum: number; count: number; year: number; week: number }>();
  for (const r of rows) {
    const y = (r.year ?? 0) as number;
    const w = (r.week_number ?? 0) as number;
    if (!w) continue;
    const v = (r.food_supply_cost_sales_pct ?? null) as number | null;
    if (v === null || !Number.isFinite(v)) continue;
    const key = `${y}-${String(w).padStart(2, '0')}`;
    const slot = buckets.get(key) ?? { sum: 0, count: 0, year: y, week: w };
    slot.sum += v;
    slot.count += 1;
    buckets.set(key, slot);
  }
  const series = Array.from(buckets.values())
    .sort((a, b) => a.year - b.year || a.week - b.week)
    .slice(-12)
    .map((b) => ({ week: b.week, value: b.sum / b.count }));
  if (series.length < 2) return '';
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const delta = last.value - first.value;
  return [
    `Network food cost has moved from **${first.value.toFixed(1)}%** in W${first.week} to **${last.value.toFixed(1)}%** in W${last.week} — a **${(delta >= 0 ? '+' : '') + delta.toFixed(1)}pt** shift.`,
    `${delta >= 0 ? 'Drift upward usually points to ingredient inflation or yield slippage.' : 'Downward drift suggests recipe discipline and waste controls are landing.'}`,
    `Worth pairing with the per-store view to confirm whether the trend is system-wide or driven by a handful of stores.`,
  ].join(' ');
}

async function foodCostOver30(): Promise<string> {
  const points = await flashReportSiteAvg('food_supply_cost_sales_pct');
  const flagged = points.filter((p) => p.value > 30).sort((a, b) => b.value - a.value);
  if (flagged.length === 0) {
    return `No stores are currently running food cost above the 30% threshold this week — every store is within target.`;
  }
  const top = flagged[0]!;
  return [
    `**${flagged.length}** stores breach the 30% food-cost threshold this week.`,
    `Worst offender: **${shortName(top.name)}** at **${top.value.toFixed(1)}%**.`,
    flagged.length > 1
      ? `The next two — ${shortName(flagged[1]?.name)} (${flagged[1]?.value.toFixed(1)}%) and ${shortName(flagged[2]?.name)} (${flagged[2]?.value.toFixed(1)}%) — round out the priority list.`
      : `That makes it the clear priority for waste and prep coaching this week.`,
  ].join(' ');
}

async function labourPctBySite(): Promise<string> {
  const points = await flashReportSiteAvg('labor_sales_pct');
  if (points.length === 0) return '';
  const networkAvg = mean(points.map((p) => p.value));
  const sorted = [...points].sort((a, b) => b.value - a.value);
  const worst = sorted[0]!;
  const best = sorted[sorted.length - 1]!;
  return [
    `Network labour runs at **${networkAvg.toFixed(1)}%** of sales this week.`,
    `**${shortName(worst.name)}** is the most stretched at **${worst.value.toFixed(1)}%**, while **${shortName(best.name)}** is leanest at **${best.value.toFixed(1)}%**.`,
    `Stores well above the network mean usually have a scheduling or staffing-mix issue rather than a wage-rate issue.`,
  ].join(' ');
}

async function labourCostPerTxn(): Promise<string> {
  const rows = await loadFlashReport();
  const latest = latestWeekFromRows(rows);
  const week = rows.filter((r) => r.year === latest.year && r.week_number === latest.week);
  const points = week
    .map((r) => {
      const cost = (r.labor_earnings ?? 0) as number;
      const txns = (r.customer_count ?? 0) as number;
      return {
        name: r.name || r.location || 'Unknown',
        value: txns > 0 ? cost / txns : 0,
      };
    })
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  if (points.length === 0) return '';
  const networkAvg = mean(points.map((p) => p.value));
  const worst = points[0]!;
  const best = points[points.length - 1]!;
  return [
    `Network labour cost per transaction averages **$${networkAvg.toFixed(2)}** this week.`,
    `**${shortName(worst.name)}** has the highest cost per transaction at **$${worst.value.toFixed(2)}**, **${shortName(best.name)}** the lowest at **$${best.value.toFixed(2)}**.`,
    `High labour-per-txn typically signals thin transaction volume relative to staffing rather than overpaid labour.`,
  ].join(' ');
}

async function avgHourlyLabourCost(): Promise<string> {
  const rows = await loadWeeklyLaborCosts();
  if (rows.length === 0) return '';
  const buckets = new Map<string, { gross: number; hours: number }>();
  for (const r of rows) {
    const key = r.location || 'Unknown';
    const slot = buckets.get(key) ?? { gross: 0, hours: 0 };
    slot.gross += (r.gross_pay ?? 0) as number;
    slot.hours += (r.total_hours ?? 0) as number;
    buckets.set(key, slot);
  }
  const points = Array.from(buckets.entries())
    .map(([name, b]) => ({ name, value: b.hours > 0 ? b.gross / b.hours : 0 }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  if (points.length === 0) return '';
  const networkAvg = mean(points.map((p) => p.value));
  const worst = points[0]!;
  const best = points[points.length - 1]!;
  return [
    `Average hourly labour cost across **${points.length} stores** sits at **$${networkAvg.toFixed(2)}/hr**.`,
    `Highest: **${worst.name}** at **$${worst.value.toFixed(2)}/hr**. Lowest: **${best.name}** at **$${best.value.toFixed(2)}/hr**.`,
    `Big spreads here usually reflect role mix (more shift leads or managers) rather than wage rates per role.`,
  ].join(' ');
}

async function overtimeByWeek(): Promise<string> {
  const rows = await loadWeeklyLaborCosts();
  if (rows.length === 0) return '';
  const buckets = new Map<string, { ot: number; total: number; year: number; week: number }>();
  for (const r of rows) {
    const y = (r.year ?? 0) as number;
    const w = (r.week_number ?? 0) as number;
    if (!w) continue;
    const key = `${y}-${String(w).padStart(2, '0')}`;
    const slot = buckets.get(key) ?? { ot: 0, total: 0, year: y, week: w };
    slot.ot += (r.overtime_hours_total ?? 0) as number;
    slot.total += (r.total_hours ?? 0) as number;
    buckets.set(key, slot);
  }
  const series = Array.from(buckets.values())
    .sort((a, b) => a.year - b.year || a.week - b.week)
    .slice(-12);
  if (series.length === 0) return '';
  const totalOt = series.reduce((s, b) => s + b.ot, 0);
  const totalHours = series.reduce((s, b) => s + b.total, 0);
  const lastWeek = series[series.length - 1]!;
  const otShare = totalHours > 0 ? (totalOt / totalHours) * 100 : 0;
  return [
    `Across the last ${series.length} payroll weeks the network logged **${fmtNumber(totalOt)} overtime hours** — about **${otShare.toFixed(1)}%** of total scheduled hours.`,
    `Most recent week (W${lastWeek.week}) recorded **${fmtNumber(lastWeek.ot)} OT hours** alone.`,
    `Sustained OT spikes usually correlate with under-staffing or unexpected demand — worth cross-referencing against transaction count by daypart.`,
  ].join(' ');
}

async function revenueToLabour(): Promise<string> {
  const rows = await loadFlashReport();
  if (rows.length === 0) return '';
  const latest = latestWeekFromRows(rows);
  const week = rows.filter((r) => r.year === latest.year && r.week_number === latest.week);
  const points = week
    .map((r) => {
      const sales = (r.total_sales ?? 0) as number;
      const labor = (r.labor_earnings ?? 0) as number;
      return {
        name: r.name || r.location || 'Unknown',
        value: labor > 0 ? sales / labor : 0,
      };
    })
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  if (points.length === 0) return '';
  const networkAvg = mean(points.map((p) => p.value));
  const top = points[0]!;
  const bottom = points[points.length - 1]!;
  return [
    `Network revenue-to-labour ratio averages **${networkAvg.toFixed(2)}×** this week — i.e. every $1 of labour generates $${networkAvg.toFixed(2)} in sales.`,
    `**${shortName(top.name)}** is the most efficient at **${top.value.toFixed(2)}×**; **${shortName(bottom.name)}** the least at **${bottom.value.toFixed(2)}×**.`,
    `For QSR a 4× ratio is a healthy benchmark — anything below ~3× suggests labour over-allocation relative to volume.`,
  ].join(' ');
}

async function weeklyLabourBySite(): Promise<string> {
  const rows = await loadWeeklyLaborCosts();
  if (rows.length === 0) return '';
  const latest = latestWeekFromRows(rows);
  const week = rows.filter((r) => r.year === latest.year && r.week_number === latest.week);
  const buckets = new Map<string, number>();
  for (const r of week) {
    const key = r.location || 'Unknown';
    buckets.set(key, (buckets.get(key) ?? 0) + ((r.gross_pay ?? 0) as number));
  }
  const points = Array.from(buckets.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  if (points.length === 0) return '';
  const total = points.reduce((s, p) => s + p.value, 0);
  const top = points[0]!;
  const bottom = points[points.length - 1]!;
  return [
    `Total weekly labour cost in W${latest.week} is **${fmtCurrency(total, { compact: true })}** across **${points.length} stores**.`,
    `**${top.name}** carries the largest wage bill at **${fmtCurrency(top.value, { compact: true })}** (**${((top.value / total) * 100).toFixed(1)}%** of total).`,
    `**${bottom.name}** is at the other end with ${fmtCurrency(bottom.value, { compact: true })} — useful baseline for what a low-volume store should be running.`,
  ].join(' ');
}

async function labourPctTrend(): Promise<string> {
  const rows = await loadFlashReport();
  const buckets = new Map<string, { sum: number; count: number; year: number; week: number }>();
  for (const r of rows) {
    const y = (r.year ?? 0) as number;
    const w = (r.week_number ?? 0) as number;
    if (!w) continue;
    const v = (r.labor_sales_pct ?? null) as number | null;
    if (v === null || !Number.isFinite(v)) continue;
    const key = `${y}-${String(w).padStart(2, '0')}`;
    const slot = buckets.get(key) ?? { sum: 0, count: 0, year: y, week: w };
    slot.sum += v;
    slot.count += 1;
    buckets.set(key, slot);
  }
  const series = Array.from(buckets.values())
    .sort((a, b) => a.year - b.year || a.week - b.week)
    .slice(-12)
    .map((b) => ({ week: b.week, value: b.sum / b.count }));
  if (series.length < 2) return '';
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const delta = last.value - first.value;
  return [
    `Network labour % has moved from **${first.value.toFixed(1)}%** in W${first.week} to **${last.value.toFixed(1)}%** in W${last.week} — a **${(delta >= 0 ? '+' : '') + delta.toFixed(1)}pt** swing.`,
    `${delta >= 0 ? 'A drift upward signals wage growth outpacing sales — common after minimum-wage moves.' : 'Downward drift means the network is leveraging sales growth against a flatter wage base.'}`,
    `Compare with the per-store labour % view to see whether the change is broad-based or concentrated.`,
  ].join(' ');
}

// ── Registry ────────────────────────────────────────────────────────────────

const BUILDERS: Partial<Record<DunkinAnalyticsChartId, () => Promise<string>>> = {
  'dunkin-total-sales-last-week': totalSalesLastWeek,
  'dunkin-top-stores-30d': topStores30d,
  'dunkin-lfl-vs-ly': lflVsLy,
  'dunkin-avg-ticket-by-site': avgTicketBySite,
  'dunkin-revenue-trend-12wk': revenueTrend12wk,
  'dunkin-product-category-sales': productCategorySales,
  'dunkin-mom-growth-by-site': momGrowthBySite,
  'dunkin-revenue-per-labour-hour': revenuePerLabourHour,
  'dunkin-basket-size-by-site': basketSizeBySite,
  'dunkin-site-rank-vs-network': siteRankVsNetwork,
  'dunkin-underperformers': underperformers,
  'dunkin-avg-ticket-trend': avgTicketTrend,
  'dunkin-food-cost-pct-by-site': foodCostPctBySite,
  'dunkin-food-cost-pct-trend': foodCostPctTrend,
  'dunkin-food-cost-over-30': foodCostOver30,
  'dunkin-labour-pct-by-site': labourPctBySite,
  'dunkin-labour-cost-per-txn': labourCostPerTxn,
  'dunkin-avg-hourly-labour-cost': avgHourlyLabourCost,
  'dunkin-overtime-by-week': overtimeByWeek,
  'dunkin-revenue-to-labour': revenueToLabour,
  'dunkin-weekly-labour-by-site': weeklyLabourBySite,
  'dunkin-labour-pct-trend': labourPctTrend,
};

/**
 * Return a Promise resolving to a data-driven narrative for the given Dunkin
 * chart id, or `null` if no live insight exists for that id (callers should
 * fall back to the static `reasoning` string in `ANALYTICS_CONFIG`).
 */
export function getDunkinInsight(chartId: string): Promise<string> | null {
  const builder = BUILDERS[chartId as DunkinAnalyticsChartId];
  if (!builder) return null;
  return builder().catch(() => '');
}
