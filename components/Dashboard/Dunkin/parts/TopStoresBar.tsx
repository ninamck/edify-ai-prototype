'use client';

import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell,
} from 'recharts';
import DunkinChartCard, {
  DUNKIN_TICK_STYLE,
  DUNKIN_TOOLTIP_STYLE,
} from '@/components/Dashboard/Dunkin/parts/DunkinChartCard';

export interface TopStoreRow {
  store: string;
  sales: number;
  marginPct: number | null;
}

const ACCENT_DEEP = 'var(--color-accent-deep)';
const ACCENT = 'var(--color-accent-active)';

function fmtKMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${Math.round(v)}`;
}

export default function TopStoresBar({ rows }: { rows: TopStoreRow[] }) {
  const data = rows.slice(0, 10);
  const height = Math.max(220, data.length * 28 + 40);

  return (
    <DunkinChartCard
      title="Top 10 stores · latest week"
      subtitle="Ranked by total sales. Bars shaded by margin (deeper = healthier margin)."
      height={height}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
          <XAxis
            type="number"
            tickFormatter={(v: number) => fmtKMoney(v)}
            tick={DUNKIN_TICK_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="store"
            tick={DUNKIN_TICK_STYLE}
            axisLine={false}
            tickLine={false}
            width={170}
          />
          <Tooltip
            contentStyle={DUNKIN_TOOLTIP_STYLE}
            formatter={(v, name) => {
              if (name === 'sales') return [`$${Number(v).toLocaleString('en-US')}`, 'Sales'];
              return [v, String(name)];
            }}
          />
          <Bar dataKey="sales" radius={[0, 4, 4, 0]}>
            {data.map((row, i) => (
              <Cell
                key={i}
                fill={row.marginPct !== null && row.marginPct >= 50 ? ACCENT_DEEP : ACCENT}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </DunkinChartCard>
  );
}
