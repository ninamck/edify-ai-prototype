'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  loadFlashReport,
  type FlashReportRow,
} from '@/components/Mvp1/Tables/dataSources/flashReport';
import DunkinKpiTiles, {
  type DunkinKpi,
} from '@/components/Dashboard/Dunkin/parts/DunkinKpiTiles';
import WeeklySalesTrend, {
  type WeeklySalesPoint,
} from '@/components/Dashboard/Dunkin/parts/WeeklySalesTrend';
import TopStoresBar, {
  type TopStoreRow,
} from '@/components/Dashboard/Dunkin/parts/TopStoresBar';
import DmLeaderboard, {
  type DmLeaderboardRow,
} from '@/components/Dashboard/Dunkin/parts/DmLeaderboard';
import CostRatioScatter, {
  type CostScatterPoint,
} from '@/components/Dashboard/Dunkin/parts/CostRatioScatter';

interface Aggregations {
  latestWeekStart: string;
  latestWeekRows: FlashReportRow[];
  storeCount: number;
  kpis: DunkinKpi[];
  weeklyTrend: WeeklySalesPoint[];
  topStores: TopStoreRow[];
  dmRows: DmLeaderboardRow[];
  scatter: CostScatterPoint[];
}

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

function fmtMoneyExact(v: number): string {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

function fmtPct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

function mean(values: (number | null | undefined)[]): number | null {
  const filtered = values.filter(
    (v): v is number => typeof v === 'number' && !Number.isNaN(v),
  );
  if (filtered.length === 0) return null;
  const sum = filtered.reduce((a, b) => a + b, 0);
  return sum / filtered.length;
}

function shortStoreLabel(name: string, max = 26): string {
  const trimmed = name.replace(/^"|"$/g, '').trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1) + '…' : trimmed;
}

function formatWeekLabel(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return iso;
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month} ${d.getUTCDate()}`;
}

function aggregate(rows: FlashReportRow[]): Aggregations {
  const validWeeks = Array.from(
    new Set(rows.map((r) => r.week_start_date).filter(Boolean)),
  ).sort();
  const latestWeekStart = validWeeks[validWeeks.length - 1] ?? '';
  const latestWeekRows = rows.filter((r) => r.week_start_date === latestWeekStart);

  const totalChainSales = latestWeekRows.reduce((acc, r) => acc + (r.total_sales ?? 0), 0);
  const avgStoreSales =
    latestWeekRows.length > 0 ? totalChainSales / latestWeekRows.length : 0;
  const avgFoodPct = mean(latestWeekRows.map((r) => r.food_supply_cost_sales_pct));
  const avgLaborPct = mean(latestWeekRows.map((r) => r.labor_sales_pct));
  const avgTicket = mean(latestWeekRows.map((r) => r.average_ticket));
  const avgMarginPct = mean(latestWeekRows.map((r) => r.store_margin_sales_pct));
  const totalCustomers = latestWeekRows.reduce(
    (acc, r) => acc + (r.customer_count ?? 0),
    0,
  );

  const kpis: DunkinKpi[] = [
    {
      id: 'chain-sales',
      label: 'Chain sales · this week',
      value: fmtMoney(totalChainSales),
      hint: `${latestWeekRows.length} stores`,
    },
    {
      id: 'avg-store',
      label: 'Avg store sales',
      value: fmtMoneyExact(avgStoreSales),
    },
    {
      id: 'avg-ticket',
      label: 'Avg ticket',
      value: avgTicket !== null ? `$${avgTicket.toFixed(2)}` : '—',
    },
    {
      id: 'food-cost',
      label: 'Food cost %',
      value: fmtPct(avgFoodPct),
      hint: 'Target ≤ 22%',
    },
    {
      id: 'labour',
      label: 'Labour %',
      value: fmtPct(avgLaborPct),
      hint: 'Target ≤ 24%',
    },
    {
      id: 'margin',
      label: 'Store margin %',
      value: fmtPct(avgMarginPct),
      hint: `${totalCustomers.toLocaleString('en-US')} customers`,
    },
  ];

  const weeklyMap = new Map<string, { total: number; customers: number }>();
  for (const r of rows) {
    if (!r.week_start_date) continue;
    const cur = weeklyMap.get(r.week_start_date) ?? { total: 0, customers: 0 };
    cur.total += r.total_sales ?? 0;
    cur.customers += r.customer_count ?? 0;
    weeklyMap.set(r.week_start_date, cur);
  }
  const weeklyTrend: WeeklySalesPoint[] = Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([weekStart, v]) => ({
      weekLabel: formatWeekLabel(weekStart),
      total: Math.round(v.total),
      customers: v.customers,
    }));

  const topStores: TopStoreRow[] = latestWeekRows
    .filter((r) => r.total_sales !== null)
    .sort((a, b) => (b.total_sales ?? 0) - (a.total_sales ?? 0))
    .slice(0, 10)
    .map((r) => ({
      store: shortStoreLabel(r.name),
      sales: r.total_sales ?? 0,
      marginPct: r.store_margin_sales_pct,
    }));

  const dmGroup = new Map<string, FlashReportRow[]>();
  for (const r of latestWeekRows) {
    const key = r.dm || '—';
    const arr = dmGroup.get(key) ?? [];
    arr.push(r);
    dmGroup.set(key, arr);
  }
  const dmRows: DmLeaderboardRow[] = Array.from(dmGroup.entries())
    .map(([dm, group]) => ({
      dm,
      storeCount: group.length,
      totalSales: group.reduce((acc, r) => acc + (r.total_sales ?? 0), 0),
      avgMarginPct: mean(group.map((r) => r.store_margin_sales_pct)),
      avgFoodCostPct: mean(group.map((r) => r.food_supply_cost_sales_pct)),
      avgLaborPct: mean(group.map((r) => r.labor_sales_pct)),
    }))
    .sort((a, b) => b.totalSales - a.totalSales);

  const scatter: CostScatterPoint[] = latestWeekRows
    .filter(
      (r) =>
        r.food_supply_cost_sales_pct !== null &&
        r.labor_sales_pct !== null &&
        r.total_sales !== null &&
        (r.food_supply_cost_sales_pct ?? 0) > 0 &&
        (r.labor_sales_pct ?? 0) > 0,
    )
    .map((r) => ({
      store: shortStoreLabel(r.name),
      foodPct: r.food_supply_cost_sales_pct as number,
      laborPct: r.labor_sales_pct as number,
      sales: r.total_sales as number,
    }));

  return {
    latestWeekStart,
    latestWeekRows,
    storeCount: latestWeekRows.length,
    kpis,
    weeklyTrend,
    topStores,
    dmRows,
    scatter,
  };
}

export default function DunkinOverview() {
  const [rows, setRows] = useState<FlashReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFlashReport()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load flash report');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const agg = useMemo(() => (rows ? aggregate(rows) : null), [rows]);

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
          fontFamily: 'var(--font-primary)',
          fontSize: 13,
          color: '#d44d4d',
        }}
      >
        Couldn&rsquo;t load Dunkin flash-report data: {error}
      </div>
    );
  }

  if (!agg) {
    return <DunkinSkeleton />;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <header>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: 6,
          }}
        >
          Dunkin&rsquo; · chain overview
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Week of {formatWeekLabel(agg.latestWeekStart)}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-text-muted)',
            marginTop: 4,
          }}
        >
          {agg.storeCount} stores reporting · live from your weekly flash report.
        </div>
      </header>

      <DunkinKpiTiles kpis={agg.kpis} />

      <WeeklySalesTrend data={agg.weeklyTrend} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
          gap: 12,
        }}
      >
        <TopStoresBar rows={agg.topStores} />
        <CostRatioScatter points={agg.scatter} />
      </div>

      <DmLeaderboard rows={agg.dmRows} />
    </div>
  );
}

function DunkinSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div
        style={{
          height: 14,
          width: 220,
          background: 'var(--color-bg-hover)',
          borderRadius: 6,
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: 12,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 88,
              borderRadius: 12,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              boxShadow: '0 2px 12px rgba(58,48,40,0.04)',
            }}
          />
        ))}
      </div>
      <div
        style={{
          height: 260,
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
        }}
      />
    </div>
  );
}
