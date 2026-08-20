'use client';

import {
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
import KpiCard from '@/components/Dashboard/parts/KpiCard';
import { tipStyle } from '@/components/Dashboard/data/estateMockData';
import {
  FIS_13_WEEK_SALES,
  FIS_HEADLINE,
  FIS_TRENDS_REVENUE_BY_OUTLET,
  FIS_TRENDS_WEEKS,
  type Kpi,
} from '@/components/Dashboard/CulinaryCollective/data/fisMockData';
import {
  CC_OUTLET_COLORS,
  ChartCard,
  formatPctSigned,
  poundsKShort,
} from '@/components/Dashboard/CulinaryCollective/parts/format';

// The KPI type lives in estateMockData; we re-shape to it locally.
const FIS_KPIS = (() => {
  const kpis: Kpi[] = [
    {
      label: 'Last week sales',
      value: FIS_HEADLINE.lastWeekSalesShort,
      delta: `${FIS_HEADLINE.lastWeekVsBudShort} vs budget`,
      deltaLabel: formatPctSigned(FIS_HEADLINE.lastWeekVsBudPct),
      positive: FIS_HEADLINE.lastWeekVsBud >= 0,
    },
    {
      label: 'Month to date',
      value: FIS_HEADLINE.monthToDateShort,
      delta: `of ${FIS_HEADLINE.fullMonthBudgetShort}`,
      deltaLabel: `${Math.round((FIS_HEADLINE.monthToDate / FIS_HEADLINE.fullMonthBudget) * 100)}% of budget`,
      positive: false,
    },
    {
      label: 'To go (May)',
      value: FIS_HEADLINE.toGoShort,
      delta: 'to hit budget',
      deltaLabel: `${FIS_HEADLINE.fullMonthBudgetShort} target`,
      positive: false,
    },
    {
      label: 'Gross profit %',
      value: `${(FIS_HEADLINE.weekGpPct * 100).toFixed(1)}%`,
      delta: '+1.7pp vs target',
      deltaLabel: 'last week · target 75.0%',
      positive: true,
    },
    {
      label: 'Wages % of sales',
      value: `${(FIS_HEADLINE.weekWagePct * 100).toFixed(1)}%`,
      delta: '−2.4pp vs budget',
      deltaLabel: 'last week · budget 19.9%',
      positive: true,
    },
    {
      label: 'Contribution',
      value: '55.3%',
      delta: '+4.8pp vs budget',
      deltaLabel: 'last week · $60.0k',
      positive: true,
    },
  ];
  return kpis;
})();

type WeeklyChartPoint = {
  label: string;
  weekEnding: string;
  actual: number | null;
  budget: number;
  lastYear: number;
};

const WEEKLY_DATA: WeeklyChartPoint[] = FIS_13_WEEK_SALES.map((w) => ({
  label: w.weekEnding,
  weekEnding: w.weekEnding,
  actual: w.actual,
  budget: w.budget,
  lastYear: w.lastYear,
}));

type OutletPoint = { week: string; Bar: number; Flock: number; Opa: number; Dough: number; Other: number };

const OUTLET_DATA: OutletPoint[] = FIS_TRENDS_WEEKS.map((week, idx) => {
  const get = (outlet: string) =>
    FIS_TRENDS_REVENUE_BY_OUTLET.find((s) => s.outlet === outlet)?.values[idx] ?? 0;
  return {
    week,
    Bar: get('Bar'),
    Flock: get('Flock'),
    Opa: get('Opa'),
    Dough: get('Dough'),
    Other: get('Other'),
  };
});

// % of week revenue that came from each outlet (last week, 17-May).
const WEEK_MIX = (() => {
  const totalsIdx = FIS_TRENDS_WEEKS.length - 1;
  const total = FIS_TRENDS_REVENUE_BY_OUTLET.find((s) => s.outlet === 'Total')?.values[totalsIdx] ?? 1;
  return ['Bar', 'Flock', 'Opa', 'Dough', 'Other'].map((outlet) => {
    const value = FIS_TRENDS_REVENUE_BY_OUTLET.find((s) => s.outlet === outlet)?.values[totalsIdx] ?? 0;
    return { outlet, value, share: value / total };
  });
})();

// Static GP% / Wage% by outlet (from Flash P&L). Hand-keyed because the
// spreadsheet only carries Bar vs Food/Kiosk percentages, not per-outlet.
const GP_BY_LINE = [
  { line: 'Bar', actual: 78.5, budget: 76.5 },
  { line: 'Food', actual: 70.6, budget: 73.0 },
];

const WAGE_BY_LINE = [
  { line: 'Bar', actual: 11.1, budget: 10.3 },
  { line: 'Kiosk', actual: 27.1, budget: 27.0 },
];

export default function CulinaryOverview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 10,
        }}
      >
        {FIS_KPIS.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* 13-week sales chart */}
      <ChartCard
        title="Weekly net sales — Actual vs Budget vs Last Year"
        subtitle="13-week trailing window · $k per week"
        height={260}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={WEEKLY_DATA} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              contentStyle={tipStyle}
              formatter={(v) => `$${Number(v).toFixed(1)}k`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="actual" name="Actual" fill="var(--color-accent-deep)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="budget" name="Budget" fill="var(--color-accent-mid)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="lastYear" name="Last Year" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        {/* Revenue mix last week */}
        <ChartCard
          title="Revenue mix — last week"
          subtitle={`Week ending ${FIS_HEADLINE.weekEnding} · share of net sales`}
          height={220}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={WEEK_MIX}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                domain={[0, 1]}
              />
              <YAxis
                type="category"
                dataKey="outlet"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                contentStyle={tipStyle}
                formatter={(v, _n, p) => {
                  const num = Number(v);
                  const payload = (p as { payload?: { value?: number } }).payload;
                  const raw = payload?.value ?? 0;
                  return [`${(num * 100).toFixed(1)}% (${poundsKShort(raw)})`, 'Share'];
                }}
              />
              <Bar dataKey="share" radius={[0, 4, 4, 0]}>
                {WEEK_MIX.map((entry) => (
                  <Cell
                    key={entry.outlet}
                    fill={CC_OUTLET_COLORS[entry.outlet] ?? 'var(--color-accent-deep)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* GP% by line */}
        <ChartCard
          title="Gross profit % — by line"
          subtitle="Last week · Actual vs Budget"
          height={220}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={GP_BY_LINE} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="line" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v) => `${v}%`}
                domain={[60, 85]}
              />
              <Tooltip contentStyle={tipStyle} formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="actual" name="Actual" fill="var(--color-accent-deep)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="budget" name="Budget" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        {/* Wage % by line */}
        <ChartCard
          title="Wages % — by line"
          subtitle="Last week · Actual vs Budget (% of revenue)"
          height={220}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WAGE_BY_LINE} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="line" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 30]}
              />
              <Tooltip contentStyle={tipStyle} formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="actual" name="Actual" fill="var(--color-accent-deep)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="budget" name="Budget" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue by outlet trend */}
        <ChartCard
          title="Revenue by outlet — 13 weeks"
          subtitle="$ per week · Bar / Flock / Opa / Dough / Other"
          height={220}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={OUTLET_DATA} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={tipStyle}
                formatter={(v) => poundsKShort(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Bar" stroke={CC_OUTLET_COLORS.Bar} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Flock" stroke={CC_OUTLET_COLORS.Flock} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Opa" stroke={CC_OUTLET_COLORS.Opa} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Dough" stroke={CC_OUTLET_COLORS.Dough} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Other" stroke={CC_OUTLET_COLORS.Other} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
