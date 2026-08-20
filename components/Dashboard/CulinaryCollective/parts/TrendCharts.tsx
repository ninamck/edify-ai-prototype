'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { tipStyle } from '@/components/Dashboard/data/estateMockData';
import { FIS_TRENDS_WEEKS } from '@/components/Dashboard/CulinaryCollective/data/fisMockData';
import {
  FIS_TRENDS_GP_DETAIL,
  FIS_TRENDS_REVENUE_BY_CATEGORY,
  FIS_TRENDS_REVENUE_TO_PNL,
  FIS_TRENDS_WAGE_COST,
  FIS_YOY_SALES_BY_OUTLET,
  type FisTrendRow,
} from '@/components/Dashboard/CulinaryCollective/data/fisExtendedMockData';
import {
  CC_OUTLET_COLORS,
  poundsKShort,
} from '@/components/Dashboard/CulinaryCollective/parts/format';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pivot a list of trend rows (one per series) into per-week records that
 *  recharts can chew through directly. The returned shape is intentionally
 *  loose (a string-keyed record) because we feed it straight into recharts'
 *  data prop, which only cares about the keys you reference in `dataKey`. */
function pivotTrends(
  rows: FisTrendRow[],
  keys: readonly string[],
): Array<Record<string, number | null | string>> {
  return FIS_TRENDS_WEEKS.map((week, i) => {
    const entry: Record<string, number | null | string> = { week };
    for (const key of keys) {
      const row = rows.find((r) => r.label === key);
      entry[key] = row?.values[i] ?? null;
    }
    return entry;
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  Beer: '#b45309',
  Spirits: '#0ea5e9',
  Cocktails: '#a855f7',
  Wine: '#7f1d1d',
  'Non Alcoholic': '#10b981',
};

const KK_FORMATTER = (v: number) => `$${(v / 1000).toFixed(0)}k`;

// ---------------------------------------------------------------------------
// 1. Revenue by category -- 13-week line chart (5 drink categories)
// ---------------------------------------------------------------------------

const CATEGORY_KEYS = ['Beer', 'Spirits', 'Cocktails', 'Wine', 'Non Alcoholic'] as const;
const CATEGORY_DATA = pivotTrends(FIS_TRENDS_REVENUE_BY_CATEGORY, CATEGORY_KEYS);

export function CategoryTrendChart() {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={CATEGORY_DATA} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => KK_FORMATTER(Number(v))}
          />
          <Tooltip contentStyle={tipStyle} formatter={(v) => poundsKShort(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {CATEGORY_KEYS.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={CATEGORY_COLORS[key]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Revenue vs Budget -- 13-week combo (bars = Total Revenue, line = Budget)
// ---------------------------------------------------------------------------

const REV_VS_BUDGET_DATA = (() => {
  const rev = FIS_TRENDS_REVENUE_TO_PNL.find((r) => r.label === 'Total Revenue')?.values ?? [];
  const budget = FIS_TRENDS_REVENUE_TO_PNL.find((r) => r.label === 'Budget')?.values ?? [];
  return FIS_TRENDS_WEEKS.map((week, i) => ({
    week,
    revenue: rev[i] ?? 0,
    budget: budget[i] ?? 0,
  }));
})();

export function RevenueVsBudgetChart() {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={REV_VS_BUDGET_DATA} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => KK_FORMATTER(Number(v))}
          />
          <Tooltip contentStyle={tipStyle} formatter={(v) => poundsKShort(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="revenue"
            name="Total revenue"
            fill="var(--color-accent-deep)"
            radius={[3, 3, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="budget"
            name="Budget"
            stroke="#1f2937"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. GP % trend -- 13-week line chart (Bar GP %, Food GP %, Budget refs)
// ---------------------------------------------------------------------------

const GP_DATA = (() => {
  // Pull rows by (group, label) since the same `Actual GP %` label appears in
  // both the Bar and Food sub-blocks of FIS_TRENDS_GP_DETAIL.
  const byGroupLabel = (group: string, label: string) =>
    FIS_TRENDS_GP_DETAIL.find((r) => r.group === group && r.label === label)?.values ?? [];
  const barActual = byGroupLabel('Bar', 'Actual GP %');
  const foodActual = byGroupLabel('Food', 'Actual GP %');
  const barBudget = byGroupLabel('Bar', 'Budget GP %');
  const foodBudget = byGroupLabel('Food', 'Budget GP %');
  return FIS_TRENDS_WEEKS.map((week, i) => ({
    week,
    barActual: (barActual[i] ?? 0) * 100,
    foodActual: (foodActual[i] ?? 0) * 100,
    barBudget: (barBudget[i] ?? 0) * 100,
    foodBudget: (foodBudget[i] ?? 0) * 100,
  }));
})();

export function GpPercentChart() {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={GP_DATA} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={[60, 90]}
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(v) => `${Number(v).toFixed(1)}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="barActual"
            name="Bar GP %"
            stroke={CC_OUTLET_COLORS.Bar}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="foodActual"
            name="Food GP %"
            stroke="#4A6CB5"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="barBudget"
            name="Bar GP % (budget)"
            stroke={CC_OUTLET_COLORS.Bar}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="foodBudget"
            name="Food GP % (budget)"
            stroke="#4A6CB5"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Wage cost -- 13-week stacked bar by outlet
// ---------------------------------------------------------------------------

const WAGE_OUTLETS = ['Bar', 'Flock', 'Opa', 'Dough'] as const;
const WAGE_DATA = pivotTrends(
  FIS_TRENDS_WAGE_COST.filter((r) => r.group === 'Outlet wages'),
  WAGE_OUTLETS,
);

export function WageCostStackedChart() {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={WAGE_DATA} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => KK_FORMATTER(Number(v))}
          />
          <Tooltip contentStyle={tipStyle} formatter={(v) => poundsKShort(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {WAGE_OUTLETS.map((outlet) => (
            <Bar
              key={outlet}
              dataKey={outlet}
              name={outlet}
              stackId="wages"
              fill={CC_OUTLET_COLORS[outlet] ?? '#94a3b8'}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. YoY growth -- 13-week grouped bar chart of Growth $ per outlet
// ---------------------------------------------------------------------------

const YOY_OUTLETS = ['Bar', 'Flock', 'Opa', 'Dough', 'Other'] as const;
const YOY_DATA = (() => {
  return FIS_TRENDS_WEEKS.map((week, i) => {
    const entry = { week } as Record<string, string | number | null>;
    for (const outlet of YOY_OUTLETS) {
      const row = FIS_YOY_SALES_BY_OUTLET.find(
        (r) => r.group === outlet && r.label === 'Growth $',
      );
      entry[outlet] = row?.values[i] ?? null;
    }
    return entry;
  });
})();

export function YoyGrowthChart() {
  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={YOY_DATA} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => KK_FORMATTER(Number(v))}
          />
          <Tooltip contentStyle={tipStyle} formatter={(v) => poundsKShort(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {YOY_OUTLETS.map((outlet) => (
            <Bar
              key={outlet}
              dataKey={outlet}
              name={outlet}
              fill={CC_OUTLET_COLORS[outlet] ?? '#94a3b8'}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
