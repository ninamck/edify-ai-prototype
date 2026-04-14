'use client';

import { useMemo, useState, type ReactNode } from 'react';
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
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { renderAnalyticsChart, ANALYTICS_CONFIG } from '@/components/Analytics/AnalyticsCharts';

const ACCENT = 'var(--color-accent-deep)';
const ACCENT_MID = 'var(--color-accent-mid)';
const WARN = '#B45309';
const OK = '#166534';

/** Trading days — estate net sales (£k) */
const SALES_TREND = [
  { d: '17 Mar', date: '2026-03-17', sales: 44.2 },
  { d: '18 Mar', date: '2026-03-18', sales: 46.8 },
  { d: '19 Mar', date: '2026-03-19', sales: 45.1 },
  { d: '20 Mar', date: '2026-03-20', sales: 48.9 },
  { d: '21 Mar', date: '2026-03-21', sales: 52.4 },
  { d: '22 Mar', date: '2026-03-22', sales: 49.6 },
  { d: '23 Mar', date: '2026-03-23', sales: 47.3 },
  { d: '24 Mar', date: '2026-03-24', sales: 45.9 },
  { d: '25 Mar', date: '2026-03-25', sales: 48.2 },
  { d: '26 Mar', date: '2026-03-26', sales: 50.1 },
  { d: '27 Mar', date: '2026-03-27', sales: 53.8 },
  { d: '28 Mar', date: '2026-03-28', sales: 55.2 },
  { d: '29 Mar', date: '2026-03-29', sales: 51.0 },
  { d: '30 Mar', date: '2026-03-30', sales: 49.4 },
  { d: '31 Mar', date: '2026-03-31', sales: 50.6 },
  { d: '1 Apr', date: '2026-04-01', sales: 51.9 },
  { d: '2 Apr', date: '2026-04-02', sales: 53.1 },
  { d: '3 Apr', date: '2026-04-03', sales: 52.2 },
  { d: '4 Apr', date: '2026-04-04', sales: 50.4 },
  { d: '5 Apr', date: '2026-04-05', sales: 48.7 },
  { d: '6 Apr', date: '2026-04-06', sales: 49.9 },
  { d: '7 Apr', date: '2026-04-07', sales: 54.5 },
  { d: '8 Apr', date: '2026-04-08', sales: 55.7 },
  { d: '9 Apr', date: '2026-04-09', sales: 53.2 },
  { d: '10 Apr', date: '2026-04-10', sales: 56.0 },
  { d: '11 Apr', date: '2026-04-11', sales: 54.1 },
  { d: '12 Apr', date: '2026-04-12', sales: 52.8 },
  { d: '13 Apr', date: '2026-04-13', sales: 51.6 },
  { d: '14 Apr', date: '2026-04-14', sales: 53.4 },
];

/** Gross profit % by site (period) */
const SITE_GP = [
  { site: 'Fitzroy', gp: 69.4 },
  { site: 'City Centre', gp: 66.1 },
  { site: 'Riverside', gp: 70.2 },
  { site: 'Canary', gp: 67.8 },
  { site: 'Shoreditch', gp: 65.3 },
  { site: 'Kings X', gp: 68.9 },
];

/** Wastage £ by category (7d, estate) */
const WASTAGE = [
  { cat: 'Dairy & milk', k: 0.42 },
  { cat: 'Bakery', k: 0.31 },
  { cat: 'Produce', k: 0.28 },
  { cat: 'Coffee & dry', k: 0.19 },
  { cat: 'Packaging', k: 0.11 },
];

/** COGS variance vs recipe/theoretical (%) — positive = over */
const COGS_VAR = [
  { line: 'Coffee', var: 0.9 },
  { line: 'Dry goods', var: 2.4 },
  { line: 'Dairy', var: -0.3 },
  { line: 'Bakery', var: 1.8 },
  { line: 'Produce', var: 3.1 },
];

const KPI = [
  {
    label: 'Net sales (7d)',
    value: '£342.8k',
    delta: '+4.1%',
    deltaLabel: 'vs prior week',
    positive: true,
  },
  {
    label: 'Gross profit',
    value: '68.2%',
    delta: '−0.4pp',
    deltaLabel: 'vs target 68.6%',
    positive: false,
  },
  {
    label: 'COGS vs theoretical',
    value: '+1.2%',
    delta: 'unfavourable',
    deltaLabel: 'estate blend',
    positive: false,
  },
  {
    label: 'Wastage',
    value: '2.4%',
    delta: 'of net sales',
    deltaLabel: '−0.2pp vs LW',
    positive: true,
  },
  {
    label: 'Labour % sales',
    value: '28.1%',
    delta: '+0.6pp',
    deltaLabel: 'vs roster plan',
    positive: false,
  },
  {
    label: 'Stock accuracy',
    value: '97.1%',
    delta: 'cycle counts',
    deltaLabel: '3 sites under 95%',
    positive: false,
  },
];

const tipStyle = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '8px',
  fontSize: '12px', fontWeight: 500,
  color: 'var(--color-text-primary)',
};

function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  positive,
}: (typeof KPI)[number]) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 8px rgba(58,48,40,0.08), 0 0 0 1px rgba(58,48,40,0.03)',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: positive ? OK : 'var(--color-text-secondary)' }}>
        {delta}
        <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}> · {deltaLabel}</span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        padding: '16px 16px 12px',
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
        minHeight: 0,
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px' }}>{subtitle}</div>
        )}
      </div>
      <div style={{ width: '100%', height: 220 }}>{children}</div>
    </div>
  );
}

export default function EstateDashboard({ pinnedCharts = [] }: { pinnedCharts?: AnalyticsChartId[] }) {
  const defaultTo = SALES_TREND[SALES_TREND.length - 1].date;
  const defaultFrom = SALES_TREND[Math.max(0, SALES_TREND.length - 14)].date;
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const filteredSalesTrend = useMemo(() => {
    return SALES_TREND.filter((p) => {
      if (fromDate && p.date < fromDate) return false;
      if (toDate && p.date > toDate) return false;
      return true;
    });
  }, [fromDate, toDate]);

  const visibleSalesTrend = filteredSalesTrend.length > 0 ? filteredSalesTrend : SALES_TREND;
  const visibleSalesTotal = visibleSalesTrend.reduce((sum, row) => sum + row.sales, 0);
  const periodDays = visibleSalesTrend.length;

  const periodSubtitle = fromDate && toDate
    ? `${fromDate} to ${toDate}`
    : `${periodDays} trading days`;

  const dynamicKpi = KPI.map((k) => {
    if (k.label !== 'Net sales (7d)') return k;
    return {
      ...k,
      label: `Net sales (${periodDays}d)`,
      value: `£${visibleSalesTotal.toFixed(1)}k`,
      deltaLabel: `selected period (${periodSubtitle})`,
    };
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: 'var(--font-primary)',
        maxWidth: 1400,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <h1
            style={{
              margin: '0 0 4px',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            Estate dashboard
          </h1>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
            Dummy data · Fitzroy Espresso estate · rolling 7-day where noted
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'end',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>From</span>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 8,
                padding: '6px 8px',
                fontSize: 12,
                fontFamily: 'var(--font-primary)',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>To</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 8,
                padding: '6px 8px',
                fontSize: 12,
                fontFamily: 'var(--font-primary)',
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setFromDate(defaultFrom);
              setToDate(defaultTo);
            }}
            style={{
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 8,
              background: 'var(--color-bg-canvas)',
              color: 'var(--color-text-primary)',
              padding: '7px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              height: 32,
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {pinnedCharts.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{
              width: 22, height: 22, borderRadius: '6px',
              background: 'var(--color-quinn-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '13px' }}>📌</span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Pinned from Quinn
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              background: 'var(--color-bg-surface)',
              padding: '2px 7px',
              borderRadius: '100px',
              border: '1px solid var(--color-border-subtle)',
            }}>
              {pinnedCharts.length}
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}>
            {pinnedCharts.map((chartId) => (
              <div
                key={chartId}
                style={{
                  padding: '14px 12px 10px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border-subtle)',
                  background: '#fff',
                  boxShadow: '0 2px 12px rgba(58,48,40,0.07)',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '10px' }}>
                  {ANALYTICS_CONFIG[chartId].label}
                </div>
                {renderAnalyticsChart(chartId)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 10,
        }}
      >
        {dynamicKpi.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 12,
          alignItems: 'stretch',
        }}
      >
        <ChartCard title="Net sales — estate (£k / day)" subtitle={periodSubtitle}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visibleSalesTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1a3636" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#1a3636" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="d" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={36} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip
                contentStyle={tipStyle}
                formatter={(v) => [`£${Number(v).toFixed(1)}k`, 'Net sales']}
              />
              <Area type="monotone" dataKey="sales" stroke={ACCENT} strokeWidth={2} fill="url(#salesFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Gross profit % by site" subtitle="Same period · after transfers">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={SITE_GP} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
              <XAxis type="number" domain={[62, 72]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} unit="%" />
              <YAxis type="category" dataKey="site" width={88} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => [`${Number(v)}%`, 'GP']} />
              <Bar dataKey="gp" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {SITE_GP.map((_, i) => (
                  <Cell key={i} fill={i % 2 === 0 ? ACCENT : ACCENT_MID} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 12,
        }}
      >
        <ChartCard title="Wastage value by category" subtitle="£ thousands · spoilage + comps (7d)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WASTAGE} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="cat" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={52} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip
                contentStyle={tipStyle}
                formatter={(v) => [`£${(Number(v) * 1000).toFixed(0)}`, 'Wastage']}
              />
              <Bar dataKey="k" fill={WARN} radius={[6, 6, 0, 0]} name="£k" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="COGS variance vs theoretical" subtitle="By major line — % over(+) / under(−) recipe cost">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={COGS_VAR} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="line" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={36} unit="%" />
              <Tooltip
                contentStyle={tipStyle}
                formatter={(v) => {
                  const n = Number(v);
                  return [`${n > 0 ? '+' : ''}${n}%`, 'Variance'];
                }}
              />
              <Bar dataKey="var" radius={[6, 6, 0, 0]} name="Variance %">
                {COGS_VAR.map((e) => (
                  <Cell key={e.line} fill={e.var > 1.5 ? WARN : e.var < 0 ? OK : ACCENT_MID} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Labour vs sales — by site" subtitle="% of net sales · yesterday">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={[
              { site: 'Fitzroy', actual: 27.2, plan: 26.8 },
              { site: 'City Ctr', actual: 29.4, plan: 27.5 },
              { site: 'Riverside', actual: 26.1, plan: 26.0 },
              { site: 'Canary', actual: 28.0, plan: 27.2 },
              { site: 'Shoreditch', actual: 30.2, plan: 28.1 },
              { site: 'Kings X', actual: 27.8, plan: 27.4 },
            ]}
            margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis dataKey="site" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={36} domain={[24, 32]} unit="%" />
            <Tooltip contentStyle={tipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="actual" name="Actual %" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="plan" name="Roster plan %" stroke={ACCENT_MID} strokeWidth={2} strokeDasharray="5 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

    </div>
  );
}
