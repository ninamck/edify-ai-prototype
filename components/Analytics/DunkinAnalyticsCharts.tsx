'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DUNKIN_TICK_STYLE, DUNKIN_TOOLTIP_STYLE } from '@/components/Dashboard/Dunkin/parts/DunkinChartCard';
import {
  loadFlashReport,
  type FlashReportRow,
} from '@/components/Mvp1/Tables/dataSources/flashReport';
import { loadWeeklySalesBySite, type WeeklySalesBySiteRow } from '@/components/Mvp1/Tables/dataSources/weeklySalesBySite';
import { loadWeeklyFlashTotals, type WeeklyFlashTotalsRow } from '@/components/Mvp1/Tables/dataSources/weeklyFlashTotals';
import { loadDailySalesBySite, type DailySalesBySiteRow } from '@/components/Mvp1/Tables/dataSources/dailySalesBySite';
import {
  loadDailySalesByProductFamily,
  type DailySalesByProductFamilyRow,
} from '@/components/Mvp1/Tables/dataSources/dailySalesByProductFamily';
import { loadWeeklyLaborCosts, type WeeklyLaborCostsRow } from '@/components/Mvp1/Tables/dataSources/weeklyLaborCosts';

// ────────────────────────────────────────────────────────────────────────────
// Chart id union
// ────────────────────────────────────────────────────────────────────────────

export type DunkinAnalyticsChartId =
  // Sales
  | 'dunkin-total-sales-last-week'
  | 'dunkin-top-stores-30d'
  | 'dunkin-lfl-vs-ly'
  | 'dunkin-avg-ticket-by-site'
  | 'dunkin-revenue-trend-12wk'
  | 'dunkin-product-category-sales'
  | 'dunkin-mom-growth-by-site'
  | 'dunkin-revenue-per-labour-hour'
  | 'dunkin-basket-size-by-site'
  | 'dunkin-site-rank-vs-network'
  | 'dunkin-underperformers'
  | 'dunkin-avg-ticket-trend'
  // COGS
  | 'dunkin-food-cost-pct-by-site'
  | 'dunkin-food-cost-pct-trend'
  | 'dunkin-food-cost-over-30'
  // Labour
  | 'dunkin-labour-pct-by-site'
  | 'dunkin-labour-cost-per-txn'
  | 'dunkin-avg-hourly-labour-cost'
  | 'dunkin-overtime-by-week'
  | 'dunkin-revenue-to-labour'
  | 'dunkin-weekly-labour-by-site'
  | 'dunkin-labour-pct-trend';

// ────────────────────────────────────────────────────────────────────────────
// Shared visual tokens
// ────────────────────────────────────────────────────────────────────────────

const ACCENT = 'var(--color-accent-deep)';
const ACCENT_MID = 'var(--color-accent-mid)';
const POSITIVE = '#166534';
const NEGATIVE = '#B45309';

function formatCurrency(value: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '—';
  if (opts.compact) {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  }
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function shortenStoreLabel(name: string, fallback: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return fallback;
  // Strip trailing city tokens after the last comma to keep bars readable.
  const head = trimmed.split(',')[0]?.trim() ?? trimmed;
  return head.length > 22 ? head.slice(0, 22) + '…' : head;
}

// ────────────────────────────────────────────────────────────────────────────
// Status wrapper (loading / error / empty)
// ────────────────────────────────────────────────────────────────────────────

function ChartStatus({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  children: React.ReactNode;
}) {
  if (loading) return <Centered>Loading data…</Centered>;
  if (error) return <Centered>{error}</Centered>;
  if (empty) return <Centered>No matching rows.</Centered>;
  return <>{children}</>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Generic data hooks
// ────────────────────────────────────────────────────────────────────────────

function useSource<T>(load: () => Promise<T[]>): {
  rows: T[] | null;
  error: string | null;
} {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    load()
      .then((data) => {
        if (cancelled) return;
        setRows(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load data');
      });
    return () => {
      cancelled = true;
    };
  }, [load]);
  return { rows, error };
}

// ────────────────────────────────────────────────────────────────────────────
// flashReport-backed charts
// ────────────────────────────────────────────────────────────────────────────

type SiteRankPoint = { site: string; value: number; secondary?: number };

/**
 * Aggregate flashReport rows for the latest week per store, then sum a numeric
 * metric across (DD/BR/Total) etc. Falls back to all weeks if there's no
 * year/week column populated.
 */
function aggregateFlashReportBySite(
  rows: FlashReportRow[],
  metric: keyof FlashReportRow,
  agg: 'sum' | 'avg' = 'sum',
): SiteRankPoint[] {
  if (!rows || rows.length === 0) return [];
  // Find the latest available (year, week_number) and filter to that.
  const latest = rows.reduce<{ year: number; week: number }>((acc, r) => {
    const y = (r.year ?? 0) as number;
    const w = (r.week_number ?? 0) as number;
    if (y > acc.year || (y === acc.year && w > acc.week)) return { year: y, week: w };
    return acc;
  }, { year: 0, week: 0 });
  const filtered = rows.filter(
    (r) => r.year === latest.year && r.week_number === latest.week,
  );
  const baseRows = filtered.length > 0 ? filtered : rows;
  const buckets = new Map<string, { name: string; total: number; count: number }>();
  for (const r of baseRows) {
    const key = (r.name ?? r.location ?? 'Unknown') as string;
    const v = r[metric] as number | null;
    if (v === null || v === undefined || !Number.isFinite(v as number)) continue;
    const slot = buckets.get(key) ?? { name: key, total: 0, count: 0 };
    slot.total += v as number;
    slot.count += 1;
    buckets.set(key, slot);
  }
  return Array.from(buckets.values())
    .map((b) => ({
      site: shortenStoreLabel(b.name, 'Store'),
      value: agg === 'avg' ? (b.count > 0 ? b.total / b.count : 0) : b.total,
    }))
    .sort((a, b) => b.value - a.value);
}

// ────────────────────────────────────────────────────────────────────────────
// Reusable chart shapes
// ────────────────────────────────────────────────────────────────────────────

function HBarChart({
  data,
  valueFormatter,
  barColor = ACCENT,
  limit = 12,
  signedColors = false,
  height = 280,
}: {
  data: SiteRankPoint[];
  valueFormatter: (v: number) => string;
  barColor?: string;
  limit?: number;
  signedColors?: boolean;
  height?: number;
}) {
  const trimmed = data.slice(0, limit);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={trimmed} layout="vertical" margin={{ top: 6, right: 18, bottom: 6, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-faint, rgba(58,48,40,0.06))" horizontal={false} />
        <XAxis type="number" tick={DUNKIN_TICK_STYLE} tickFormatter={valueFormatter} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="site" tick={DUNKIN_TICK_STYLE} width={140} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={DUNKIN_TOOLTIP_STYLE}
          formatter={(value) => valueFormatter(Number(value))}
          labelStyle={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={barColor}>
          {signedColors &&
            trimmed.map((p, i) => (
              <Cell key={i} fill={p.value >= 0 ? POSITIVE : NEGATIVE} />
            ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PairedBarChart({
  data,
  valueFormatter,
  height = 280,
}: {
  data: { site: string; current: number; comparison: number }[];
  valueFormatter: (v: number) => string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data.slice(0, 12)} margin={{ top: 6, right: 12, bottom: 6, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-faint, rgba(58,48,40,0.06))" />
        <XAxis dataKey="site" tick={DUNKIN_TICK_STYLE} angle={-25} textAnchor="end" interval={0} height={70} />
        <YAxis tick={DUNKIN_TICK_STYLE} tickFormatter={valueFormatter} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={DUNKIN_TOOLTIP_STYLE} formatter={(value) => valueFormatter(Number(value))} />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-primary)' }} />
        <Bar dataKey="current" name="This week" fill={ACCENT} radius={[3, 3, 0, 0]} />
        <Bar dataKey="comparison" name="Last year" fill={ACCENT_MID} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LinePoints({
  data,
  yLabel,
  valueFormatter,
  color = ACCENT,
  height = 240,
}: {
  data: { week: string; value: number }[];
  yLabel?: string;
  valueFormatter: (v: number) => string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 18, bottom: 6, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-faint, rgba(58,48,40,0.06))" />
        <XAxis dataKey="week" tick={DUNKIN_TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={DUNKIN_TICK_STYLE} tickFormatter={valueFormatter} axisLine={false} tickLine={false} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'var(--color-text-muted)' } } : undefined} />
        <Tooltip contentStyle={DUNKIN_TOOLTIP_STYLE} formatter={(value) => valueFormatter(Number(value))} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaPoints({
  data,
  valueFormatter,
  height = 240,
}: {
  data: { week: string; value: number }[];
  valueFormatter: (v: number) => string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 18, bottom: 6, left: 4 }}>
        <defs>
          <linearGradient id="dunkin-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.36} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-faint, rgba(58,48,40,0.06))" />
        <XAxis dataKey="week" tick={DUNKIN_TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={DUNKIN_TICK_STYLE} tickFormatter={valueFormatter} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={DUNKIN_TOOLTIP_STYLE} formatter={(value) => valueFormatter(Number(value))} />
        <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2} fill="url(#dunkin-area-fill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sales charts
// ────────────────────────────────────────────────────────────────────────────

function TotalSalesLastWeekChart() {
  const { rows, error } = useSource<WeeklyFlashTotalsRow>(loadWeeklyFlashTotals);
  const data = useMemo(() => {
    if (!rows) return [];
    const sorted = [...rows].sort((a, b) =>
      String(a.week_start_date).localeCompare(String(b.week_start_date)),
    );
    const last12 = sorted.slice(-12);
    return last12.map((r) => ({
      week: `W${r.week_number ?? '?'}`,
      value: (r.overall_total ?? 0) as number,
    }));
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <AreaPoints data={data} valueFormatter={(v) => formatCurrency(v, { compact: true })} />
    </ChartStatus>
  );
}

function TopStores30dChart() {
  const { rows, error } = useSource<DailySalesBySiteRow>(loadDailySalesBySite);
  const data = useMemo<SiteRankPoint[]>(() => {
    if (!rows) return [];
    const buckets = new Map<string, number>();
    const labels = new Map<string, string>();
    for (const r of rows) {
      const k = r.name || r.location || 'Unknown';
      labels.set(k, k);
      buckets.set(k, (buckets.get(k) ?? 0) + ((r.total_sales ?? 0) as number));
    }
    return Array.from(buckets.entries())
      .map(([k, v]) => ({ site: shortenStoreLabel(labels.get(k) ?? k, 'Store'), value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={(v) => formatCurrency(v, { compact: true })} />
    </ChartStatus>
  );
}

function LflVsLyChart() {
  const { rows, error } = useSource<WeeklySalesBySiteRow>(loadWeeklySalesBySite);
  const data = useMemo(() => {
    if (!rows) return [];
    const latest = rows.reduce<{ y: number; w: number }>((acc, r) => {
      const y = (r.year ?? 0) as number;
      const w = (r.week_number ?? 0) as number;
      if (y > acc.y || (y === acc.y && w > acc.w)) return { y, w };
      return acc;
    }, { y: 0, w: 0 });
    const filtered = rows.filter((r) => r.year === latest.y && r.week_number === latest.w);
    const buckets = new Map<string, { current: number; ly: number }>();
    for (const r of filtered) {
      const key = r.name || r.location || 'Unknown';
      const slot = buckets.get(key) ?? { current: 0, ly: 0 };
      slot.current += (r.total_sales ?? 0) as number;
      slot.ly += (r.total_sales_ly ?? 0) as number;
      buckets.set(key, slot);
    }
    return Array.from(buckets.entries())
      .map(([name, v]) => ({
        site: shortenStoreLabel(name, 'Store'),
        current: v.current,
        comparison: v.ly,
      }))
      .sort((a, b) => b.current - a.current);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <PairedBarChart data={data} valueFormatter={(v) => formatCurrency(v, { compact: true })} />
    </ChartStatus>
  );
}

function AvgTicketBySiteChart() {
  const { rows, error } = useSource<WeeklySalesBySiteRow>(loadWeeklySalesBySite);
  const data = useMemo<SiteRankPoint[]>(() => {
    if (!rows) return [];
    // Average across the most recent 4 weeks per site.
    const sorted = [...rows].sort((a, b) => {
      const ay = (a.year ?? 0) as number;
      const by = (b.year ?? 0) as number;
      if (ay !== by) return by - ay;
      return ((b.week_number ?? 0) as number) - ((a.week_number ?? 0) as number);
    });
    const latestWeeks = new Set<number>();
    for (const r of sorted) {
      latestWeeks.add(((r.year ?? 0) as number) * 100 + ((r.week_number ?? 0) as number));
      if (latestWeeks.size >= 4) break;
    }
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const r of sorted) {
      const key = ((r.year ?? 0) as number) * 100 + ((r.week_number ?? 0) as number);
      if (!latestWeeks.has(key)) continue;
      const name = r.name || r.location || 'Unknown';
      const v = r.average_ticket;
      if (v === null || v === undefined || !Number.isFinite(v as number)) continue;
      const slot = buckets.get(name) ?? { sum: 0, count: 0 };
      slot.sum += v as number;
      slot.count += 1;
      buckets.set(name, slot);
    }
    return Array.from(buckets.entries())
      .map(([name, b]) => ({
        site: shortenStoreLabel(name, 'Store'),
        value: b.count > 0 ? b.sum / b.count : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={(v) => `$${v.toFixed(2)}`} barColor={ACCENT_MID} />
    </ChartStatus>
  );
}

function RevenueTrend12wkChart() {
  const { rows, error } = useSource<WeeklyFlashTotalsRow>(loadWeeklyFlashTotals);
  const data = useMemo(() => {
    if (!rows) return [];
    const sorted = [...rows].sort((a, b) =>
      String(a.week_start_date).localeCompare(String(b.week_start_date)),
    );
    const last12 = sorted.slice(-12);
    return last12.map((r) => ({
      week: `W${r.week_number ?? '?'}`,
      value: (r.overall_total ?? 0) as number,
    }));
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <LinePoints data={data} valueFormatter={(v) => formatCurrency(v, { compact: true })} />
    </ChartStatus>
  );
}

function ProductCategorySalesChart() {
  const { rows, error } = useSource<DailySalesByProductFamilyRow>(loadDailySalesByProductFamily);
  const data = useMemo<SiteRankPoint[]>(() => {
    if (!rows) return [];
    const buckets = new Map<string, number>();
    for (const r of rows) {
      const k = (r.major_group_name ?? 'Other').trim() || 'Other';
      buckets.set(k, (buckets.get(k) ?? 0) + ((r.gross_sales ?? 0) as number));
    }
    return Array.from(buckets.entries())
      .map(([name, v]) => ({ site: name, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={(v) => formatCurrency(v, { compact: true })} barColor={ACCENT_MID} />
    </ChartStatus>
  );
}

function MoMGrowthBySiteChart() {
  const { rows, error } = useSource<WeeklySalesBySiteRow>(loadWeeklySalesBySite);
  const data = useMemo<SiteRankPoint[]>(() => {
    if (!rows) return [];
    const latest = rows.reduce<{ y: number; w: number }>((acc, r) => {
      const y = (r.year ?? 0) as number;
      const w = (r.week_number ?? 0) as number;
      if (y > acc.y || (y === acc.y && w > acc.w)) return { y, w };
      return acc;
    }, { y: 0, w: 0 });
    const filtered = rows.filter((r) => r.year === latest.y && r.week_number === latest.w);
    const buckets = new Map<string, { sum: number; count: number; name: string }>();
    for (const r of filtered) {
      const name = r.name || r.location || 'Unknown';
      const v = r.total_sales_ly_pct;
      if (v === null || v === undefined || !Number.isFinite(v as number)) continue;
      const slot = buckets.get(name) ?? { sum: 0, count: 0, name };
      slot.sum += v as number;
      slot.count += 1;
      buckets.set(name, slot);
    }
    return Array.from(buckets.values())
      .map((b) => ({
        site: shortenStoreLabel(b.name, 'Store'),
        value: b.count > 0 ? b.sum / b.count : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={formatPercent} signedColors />
    </ChartStatus>
  );
}

function RevenuePerLabourHourChart() {
  const { rows, error } = useSource<FlashReportRow>(loadFlashReport);
  const data = useMemo<SiteRankPoint[]>(() => {
    if (!rows) return [];
    const latest = rows.reduce<{ y: number; w: number }>((acc, r) => {
      const y = (r.year ?? 0) as number;
      const w = (r.week_number ?? 0) as number;
      if (y > acc.y || (y === acc.y && w > acc.w)) return { y, w };
      return acc;
    }, { y: 0, w: 0 });
    const filtered = rows.filter((r) => r.year === latest.y && r.week_number === latest.w);
    return filtered
      .map((r) => {
        const sales = (r.total_sales ?? 0) as number;
        const hours = (r.labor_hours ?? 0) as number;
        return {
          site: shortenStoreLabel((r.name as string) || (r.location as string) || 'Unknown', 'Store'),
          value: hours > 0 ? sales / hours : 0,
        };
      })
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={(v) => `$${v.toFixed(0)}/hr`} />
    </ChartStatus>
  );
}

function BasketSizeBySiteChart() {
  const { rows, error } = useSource<FlashReportRow>(loadFlashReport);
  const data = useMemo<SiteRankPoint[]>(
    () => aggregateFlashReportBySite(rows ?? [], 'average_ticket', 'avg'),
    [rows],
  );
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={(v) => `$${v.toFixed(2)}`} barColor={ACCENT_MID} />
    </ChartStatus>
  );
}

function SiteRankVsNetworkChart() {
  const { rows, error } = useSource<WeeklySalesBySiteRow>(loadWeeklySalesBySite);
  const data = useMemo<SiteRankPoint[]>(() => {
    if (!rows) return [];
    const latest = rows.reduce<{ y: number; w: number }>((acc, r) => {
      const y = (r.year ?? 0) as number;
      const w = (r.week_number ?? 0) as number;
      if (y > acc.y || (y === acc.y && w > acc.w)) return { y, w };
      return acc;
    }, { y: 0, w: 0 });
    const filtered = rows.filter((r) => r.year === latest.y && r.week_number === latest.w);
    const buckets = new Map<string, number>();
    for (const r of filtered) {
      const name = r.name || r.location || 'Unknown';
      buckets.set(name, (buckets.get(name) ?? 0) + ((r.total_sales ?? 0) as number));
    }
    const totals = Array.from(buckets.entries()).map(([name, v]) => ({ name, value: v }));
    if (totals.length === 0) return [];
    const networkAvg = totals.reduce((s, p) => s + p.value, 0) / totals.length;
    return totals
      .map((p) => ({
        site: shortenStoreLabel(p.name, 'Store'),
        value: networkAvg > 0 ? ((p.value - networkAvg) / networkAvg) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={formatPercent} signedColors />
    </ChartStatus>
  );
}

function UnderperformersChart() {
  const { rows, error } = useSource<WeeklySalesBySiteRow>(loadWeeklySalesBySite);
  const data = useMemo<SiteRankPoint[]>(() => {
    if (!rows) return [];
    const latest = rows.reduce<{ y: number; w: number }>((acc, r) => {
      const y = (r.year ?? 0) as number;
      const w = (r.week_number ?? 0) as number;
      if (y > acc.y || (y === acc.y && w > acc.w)) return { y, w };
      return acc;
    }, { y: 0, w: 0 });
    const filtered = rows.filter((r) => r.year === latest.y && r.week_number === latest.w);
    return filtered
      .map((r) => ({
        site: shortenStoreLabel((r.name as string) || (r.location as string) || 'Unknown', 'Store'),
        value: (r.total_sales_ly_pct ?? 0) as number,
      }))
      .filter((p) => p.value < 0)
      .sort((a, b) => a.value - b.value);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={formatPercent} barColor={NEGATIVE} />
    </ChartStatus>
  );
}

/**
 * Group flashReport rows by (year, week_number), averaging the given metric
 * across stores so the demo can plot a trend line for any flashReport column.
 */
function flashReportTrend(
  rows: FlashReportRow[],
  metric: keyof FlashReportRow,
  windowSize = 12,
): { week: string; value: number }[] {
  const buckets = new Map<string, { sum: number; count: number; year: number; week: number }>();
  for (const r of rows) {
    const y = (r.year ?? 0) as number;
    const w = (r.week_number ?? 0) as number;
    if (!w) continue;
    const v = r[metric] as number | null;
    if (v === null || v === undefined || !Number.isFinite(v as number)) continue;
    const key = `${y}-${String(w).padStart(2, '0')}`;
    const slot = buckets.get(key) ?? { sum: 0, count: 0, year: y, week: w };
    slot.sum += v as number;
    slot.count += 1;
    buckets.set(key, slot);
  }
  return Array.from(buckets.values())
    .sort((a, b) => (a.year - b.year) || (a.week - b.week))
    .slice(-windowSize)
    .map((b) => ({
      week: `W${b.week}`,
      value: b.count > 0 ? b.sum / b.count : 0,
    }));
}

function AvgTicketTrendChart() {
  const { rows, error } = useSource<FlashReportRow>(loadFlashReport);
  const data = useMemo(() => flashReportTrend(rows ?? [], 'average_ticket', 13), [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <LinePoints data={data} valueFormatter={(v) => `$${v.toFixed(2)}`} color={ACCENT_MID} />
    </ChartStatus>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// COGS charts
// ────────────────────────────────────────────────────────────────────────────

function FoodCostPctBySiteChart() {
  const { rows, error } = useSource<FlashReportRow>(loadFlashReport);
  const data = useMemo<SiteRankPoint[]>(
    () => aggregateFlashReportBySite(rows ?? [], 'food_supply_cost_sales_pct', 'avg'),
    [rows],
  );
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={formatPercent} barColor={NEGATIVE} />
    </ChartStatus>
  );
}

function FoodCostPctTrendChart() {
  const { rows, error } = useSource<FlashReportRow>(loadFlashReport);
  const data = useMemo(
    () => flashReportTrend(rows ?? [], 'food_supply_cost_sales_pct', 12),
    [rows],
  );
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <LinePoints data={data} valueFormatter={formatPercent} color={NEGATIVE} />
    </ChartStatus>
  );
}

function FoodCostOver30Chart() {
  const { rows, error } = useSource<FlashReportRow>(loadFlashReport);
  const data = useMemo<SiteRankPoint[]>(() => {
    const all = aggregateFlashReportBySite(rows ?? [], 'food_supply_cost_sales_pct', 'avg');
    return all.filter((p) => p.value > 30);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={formatPercent} barColor={NEGATIVE} />
    </ChartStatus>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Labour charts
// ────────────────────────────────────────────────────────────────────────────

function LabourPctBySiteChart() {
  const { rows, error } = useSource<FlashReportRow>(loadFlashReport);
  const data = useMemo<SiteRankPoint[]>(
    () => aggregateFlashReportBySite(rows ?? [], 'labor_sales_pct', 'avg'),
    [rows],
  );
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={formatPercent} barColor={ACCENT} />
    </ChartStatus>
  );
}

function LabourCostPerTxnChart() {
  const { rows, error } = useSource<FlashReportRow>(loadFlashReport);
  const data = useMemo<SiteRankPoint[]>(() => {
    if (!rows) return [];
    const latest = rows.reduce<{ y: number; w: number }>((acc, r) => {
      const y = (r.year ?? 0) as number;
      const w = (r.week_number ?? 0) as number;
      if (y > acc.y || (y === acc.y && w > acc.w)) return { y, w };
      return acc;
    }, { y: 0, w: 0 });
    const filtered = rows.filter((r) => r.year === latest.y && r.week_number === latest.w);
    return filtered
      .map((r) => {
        const cost = (r.labor_earnings ?? 0) as number;
        const txns = (r.customer_count ?? 0) as number;
        return {
          site: shortenStoreLabel((r.name as string) || (r.location as string) || 'Unknown', 'Store'),
          value: txns > 0 ? cost / txns : 0,
        };
      })
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={(v) => `$${v.toFixed(2)}`} barColor={ACCENT_MID} />
    </ChartStatus>
  );
}

function AvgHourlyLabourCostChart() {
  const { rows, error } = useSource<WeeklyLaborCostsRow>(loadWeeklyLaborCosts);
  const data = useMemo<SiteRankPoint[]>(() => {
    if (!rows) return [];
    const buckets = new Map<string, { gross: number; hours: number }>();
    for (const r of rows) {
      const key = r.location || 'Unknown';
      const slot = buckets.get(key) ?? { gross: 0, hours: 0 };
      slot.gross += (r.gross_pay ?? 0) as number;
      slot.hours += (r.total_hours ?? 0) as number;
      buckets.set(key, slot);
    }
    return Array.from(buckets.entries())
      .map(([key, b]) => ({
        site: key,
        value: b.hours > 0 ? b.gross / b.hours : 0,
      }))
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={(v) => `$${v.toFixed(2)}/hr`} barColor={ACCENT_MID} />
    </ChartStatus>
  );
}

function OvertimeByWeekChart() {
  const { rows, error } = useSource<WeeklyLaborCostsRow>(loadWeeklyLaborCosts);
  const data = useMemo(() => {
    if (!rows) return [];
    const buckets = new Map<string, number>();
    for (const r of rows) {
      const key = `${r.year ?? '?'}-W${r.week_number ?? '?'}`;
      buckets.set(key, (buckets.get(key) ?? 0) + ((r.overtime_hours_total ?? 0) as number));
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([week, value]) => ({ week, value }));
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <LinePoints data={data} valueFormatter={(v) => `${formatNumber(v)}h`} color={NEGATIVE} />
    </ChartStatus>
  );
}

function RevenueToLabourChart() {
  const { rows, error } = useSource<FlashReportRow>(loadFlashReport);
  const data = useMemo<SiteRankPoint[]>(() => {
    if (!rows) return [];
    const latest = rows.reduce<{ y: number; w: number }>((acc, r) => {
      const y = (r.year ?? 0) as number;
      const w = (r.week_number ?? 0) as number;
      if (y > acc.y || (y === acc.y && w > acc.w)) return { y, w };
      return acc;
    }, { y: 0, w: 0 });
    const filtered = rows.filter((r) => r.year === latest.y && r.week_number === latest.w);
    return filtered
      .map((r) => {
        const sales = (r.total_sales ?? 0) as number;
        const labor = (r.labor_earnings ?? 0) as number;
        return {
          site: shortenStoreLabel((r.name as string) || (r.location as string) || 'Unknown', 'Store'),
          value: labor > 0 ? sales / labor : 0,
        };
      })
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={(v) => `${v.toFixed(2)}×`} barColor={POSITIVE} />
    </ChartStatus>
  );
}

function WeeklyLabourBySiteChart() {
  const { rows, error } = useSource<WeeklyLaborCostsRow>(loadWeeklyLaborCosts);
  const data = useMemo<SiteRankPoint[]>(() => {
    if (!rows) return [];
    // Latest week only.
    const latest = rows.reduce<{ y: number; w: number }>((acc, r) => {
      const y = (r.year ?? 0) as number;
      const w = (r.week_number ?? 0) as number;
      if (y > acc.y || (y === acc.y && w > acc.w)) return { y, w };
      return acc;
    }, { y: 0, w: 0 });
    const filtered = rows.filter((r) => r.year === latest.y && r.week_number === latest.w);
    const buckets = new Map<string, number>();
    for (const r of filtered) {
      const key = r.location || 'Unknown';
      buckets.set(key, (buckets.get(key) ?? 0) + ((r.gross_pay ?? 0) as number));
    }
    return Array.from(buckets.entries())
      .map(([key, v]) => ({ site: key, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <HBarChart data={data} valueFormatter={(v) => formatCurrency(v, { compact: true })} />
    </ChartStatus>
  );
}

function LabourPctTrendChart() {
  const { rows, error } = useSource<FlashReportRow>(loadFlashReport);
  const data = useMemo(() => flashReportTrend(rows ?? [], 'labor_sales_pct', 12), [rows]);
  return (
    <ChartStatus loading={!rows && !error} error={error} empty={data.length === 0}>
      <LinePoints data={data} valueFormatter={formatPercent} />
    </ChartStatus>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Render dispatcher + config
// ────────────────────────────────────────────────────────────────────────────

export function renderDunkinAnalyticsChart(id: DunkinAnalyticsChartId) {
  switch (id) {
    case 'dunkin-total-sales-last-week':     return <TotalSalesLastWeekChart />;
    case 'dunkin-top-stores-30d':            return <TopStores30dChart />;
    case 'dunkin-lfl-vs-ly':                 return <LflVsLyChart />;
    case 'dunkin-avg-ticket-by-site':        return <AvgTicketBySiteChart />;
    case 'dunkin-revenue-trend-12wk':        return <RevenueTrend12wkChart />;
    case 'dunkin-product-category-sales':    return <ProductCategorySalesChart />;
    case 'dunkin-mom-growth-by-site':        return <MoMGrowthBySiteChart />;
    case 'dunkin-revenue-per-labour-hour':   return <RevenuePerLabourHourChart />;
    case 'dunkin-basket-size-by-site':       return <BasketSizeBySiteChart />;
    case 'dunkin-site-rank-vs-network':      return <SiteRankVsNetworkChart />;
    case 'dunkin-underperformers':           return <UnderperformersChart />;
    case 'dunkin-avg-ticket-trend':          return <AvgTicketTrendChart />;
    case 'dunkin-food-cost-pct-by-site':     return <FoodCostPctBySiteChart />;
    case 'dunkin-food-cost-pct-trend':       return <FoodCostPctTrendChart />;
    case 'dunkin-food-cost-over-30':         return <FoodCostOver30Chart />;
    case 'dunkin-labour-pct-by-site':        return <LabourPctBySiteChart />;
    case 'dunkin-labour-cost-per-txn':       return <LabourCostPerTxnChart />;
    case 'dunkin-avg-hourly-labour-cost':    return <AvgHourlyLabourCostChart />;
    case 'dunkin-overtime-by-week':          return <OvertimeByWeekChart />;
    case 'dunkin-revenue-to-labour':         return <RevenueToLabourChart />;
    case 'dunkin-weekly-labour-by-site':     return <WeeklyLabourBySiteChart />;
    case 'dunkin-labour-pct-trend':          return <LabourPctTrendChart />;
  }
}

export const DUNKIN_ANALYTICS_CONFIG: Record<
  DunkinAnalyticsChartId,
  { label: string; chartLabel: string; reasoning: string }
> = {
  'dunkin-total-sales-last-week': {
    label: 'Total sales — last 12 weeks',
    chartLabel: "Here's network total sales for the last 12 weeks, with the most recent week on the right:",
    reasoning:
      'Total sales are visualised as an area trend so you can see the most recent week in the context of the run-rate. Use the table for the exact figure, the chart for the trajectory.',
  },
  'dunkin-top-stores-30d': {
    label: 'Top stores by total sales',
    chartLabel: "Here are the stores ranked by total sales over the available daily window:",
    reasoning:
      'Stores are ranked by summed total sales across the daily-by-site CSV. Hover any bar for the exact total. The table view exposes DD vs BR splits and check counts.',
  },
  'dunkin-lfl-vs-ly': {
    label: 'This week vs last year — by store',
    chartLabel: "Here's this week's total sales versus the same week last year, by store:",
    reasoning:
      'Pairs current-week total sales with last-year total sales per store from `weeklySalesBySite`. The table view exposes the LY % column for a sortable comparison.',
  },
  'dunkin-avg-ticket-by-site': {
    label: 'Average ticket — by store (last 4 weeks)',
    chartLabel: "Here's the average ticket per store across the most recent four weeks:",
    reasoning:
      'Ranks stores by the average of `average_ticket` over the last four weeks. Useful for spotting check-size variance independent of footfall.',
  },
  'dunkin-revenue-trend-12wk': {
    label: 'Revenue trend — last 12 weeks',
    chartLabel: "Here's network revenue across the last 12 weeks:",
    reasoning:
      'Line chart from `weeklyFlashTotals.total_sales`. Use the table to see exact week-by-week numbers.',
  },
  'dunkin-product-category-sales': {
    label: 'Sales by product category',
    chartLabel: "Here's gross sales split by major product group across the network:",
    reasoning:
      'Aggregates `dailySalesByProductFamily.gross_sales` by `major_group_name` over the entire window the daily file covers.',
  },
  'dunkin-mom-growth-by-site': {
    label: 'Year-over-year growth — by store',
    chartLabel: "Here's this week's total-sales LY % per store:",
    reasoning:
      'Plots `weeklySalesBySite.total_sales_ly_pct` for the most recent week. Green is above prior year, amber/red is below.',
  },
  'dunkin-revenue-per-labour-hour': {
    label: 'Revenue per labour hour — by store',
    chartLabel: "Here's revenue per labour hour by store this week:",
    reasoning:
      'Calculated from `flashReport.total_sales` ÷ `flashReport.labor_hours` for the most recent week. Higher is better.',
  },
  'dunkin-basket-size-by-site': {
    label: 'Basket size — by store',
    chartLabel: "Here's the average basket size (avg ticket) by store:",
    reasoning:
      'Plots `flashReport.average_ticket` averaged per store across available weeks. Pair with traffic to understand what is driving sales delta.',
  },
  'dunkin-site-rank-vs-network': {
    label: 'Site performance vs network average',
    chartLabel: "Here's how each store ranks against the network mean (in % terms):",
    reasoning:
      'Computes the network-mean total_sales for the most recent week, then expresses each store as a % delta. Green is above-average, red below.',
  },
  'dunkin-underperformers': {
    label: 'Stores below last year',
    chartLabel: "Here are the stores running below last year's same-week total sales:",
    reasoning:
      'Filters `weeklySalesBySite.total_sales_ly_pct` to negative values for the most recent week — a proxy for underperformance when no explicit target exists.',
  },
  'dunkin-avg-ticket-trend': {
    label: 'Average ticket trend — last 13 weeks',
    chartLabel: "Here's how average ticket has moved across the last 13 weeks:",
    reasoning:
      'Trend line from `weeklyFlashTotals.average_ticket`. Useful for catching a step-change after a price update.',
  },
  'dunkin-food-cost-pct-by-site': {
    label: 'Food cost % — by store',
    chartLabel: "Here's food and supply cost as % of sales by store this week:",
    reasoning:
      'Plots `flashReport.food_supply_cost_sales_pct` averaged per store for the most recent week.',
  },
  'dunkin-food-cost-pct-trend': {
    label: 'Food cost % trend — last 12 weeks',
    chartLabel: "Here's the network food cost % over the last 12 weeks:",
    reasoning:
      'Line chart from `weeklyFlashTotals.food_supply_cost_sales_pct`. Watch for upward drift suggesting price or yield pressure.',
  },
  'dunkin-food-cost-over-30': {
    label: 'Stores over the 30% food-cost threshold',
    chartLabel: "Here are the stores running food cost above 30% of sales:",
    reasoning:
      'Filters `flashReport.food_supply_cost_sales_pct > 30` across the most recent week to surface the worst offenders quickly.',
  },
  'dunkin-labour-pct-by-site': {
    label: 'Labour % of sales — by store',
    chartLabel: "Here's labour as a % of sales by store this week:",
    reasoning:
      'Plots `flashReport.labor_sales_pct` averaged per store for the most recent week.',
  },
  'dunkin-labour-cost-per-txn': {
    label: 'Labour cost per transaction — by store',
    chartLabel: "Here's labour cost per customer transaction by store:",
    reasoning:
      'Calculated as `flashReport.labor_earnings` ÷ `customer_count` for the most recent week. High values flag stores with thin transaction volume relative to their wage bill.',
  },
  'dunkin-avg-hourly-labour-cost': {
    label: 'Average hourly labour cost — by store',
    chartLabel: "Here's the network-wide average hourly labour cost by store:",
    reasoning:
      'Sums `weeklyLaborCosts.gross_pay` ÷ `total_hours` per location across the entire payroll window.',
  },
  'dunkin-overtime-by-week': {
    label: 'Overtime hours — by week',
    chartLabel: "Here are overtime hours network-wide for the last 12 payroll weeks:",
    reasoning:
      'Sums `weeklyLaborCosts.overtime_hours_total` per (year, week). Watch for sustained spikes, which often correlate with under-staffing.',
  },
  'dunkin-revenue-to-labour': {
    label: 'Revenue-to-labour ratio — by store',
    chartLabel: "Here's revenue per dollar of labour cost by store this week:",
    reasoning:
      'Calculated as `flashReport.total_sales` ÷ `labor_earnings` for the most recent week. Higher is better; a 4× ratio is healthy for QSR.',
  },
  'dunkin-weekly-labour-by-site': {
    label: 'Weekly labour cost — by store',
    chartLabel: "Here's total weekly labour cost (gross pay) per store:",
    reasoning:
      'Sums `weeklyLaborCosts.gross_pay` per location for the most recent payroll week.',
  },
  'dunkin-labour-pct-trend': {
    label: 'Labour % trend — last 12 weeks',
    chartLabel: "Here's the network labour % across the last 12 weeks:",
    reasoning:
      'Line chart from `weeklyFlashTotals.labor_sales_pct`. Useful for spotting wage-rate or trading-mix changes.',
  },
};
