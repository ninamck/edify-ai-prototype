'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
  Line,
} from 'recharts';
import DunkinChartCard, {
  DUNKIN_TICK_STYLE,
  DUNKIN_TOOLTIP_STYLE,
} from '@/components/Dashboard/Dunkin/parts/DunkinChartCard';

export interface WeeklySalesPoint {
  weekLabel: string;
  total: number;
  customers: number;
}

const ACCENT = 'var(--color-accent-active)';
const ACCENT_DEEP = 'var(--color-accent-deep)';

function fmtKMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${Math.round(v)}`;
}

export default function WeeklySalesTrend({ data }: { data: WeeklySalesPoint[] }) {
  return (
    <DunkinChartCard
      title="Chain sales · last 12 weeks"
      subtitle="Total sales across all stores (area), with customer count overlay (line)."
      height={260}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
          <XAxis dataKey="weekLabel" tick={DUNKIN_TICK_STYLE} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="sales"
            tickFormatter={(v: number) => fmtKMoney(v)}
            tick={DUNKIN_TICK_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="cust"
            orientation="right"
            tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
            tick={DUNKIN_TICK_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v, name) => {
              if (name === 'Total sales') return [`$${Number(v).toLocaleString('en-US')}`, name];
              return [Number(v).toLocaleString('en-US'), String(name)];
            }}
            contentStyle={DUNKIN_TOOLTIP_STYLE}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }} />
          <Area
            yAxisId="sales"
            type="monotone"
            dataKey="total"
            name="Total sales"
            stroke={ACCENT_DEEP}
            fill={ACCENT_DEEP}
            fillOpacity={0.7}
          />
          <Line
            yAxisId="cust"
            type="monotone"
            dataKey="customers"
            name="Customers"
            stroke={ACCENT}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </DunkinChartCard>
  );
}
