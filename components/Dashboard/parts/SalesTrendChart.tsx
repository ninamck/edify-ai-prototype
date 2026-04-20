'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ACCENT, tipStyle, type SalesTrendPoint } from '@/components/Dashboard/data/estateMockData';

export default function SalesTrendChart({
  data,
  compact = false,
}: {
  data: SalesTrendPoint[];
  compact?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a3636" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#1a3636" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis
          dataKey="d"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          interval={compact ? 4 : 2}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={36}
          domain={['dataMin - 2', 'dataMax + 2']}
        />
        <Tooltip
          contentStyle={tipStyle}
          formatter={(v) => [`£${Number(v).toFixed(1)}k`, 'Net sales']}
        />
        <Area type="monotone" dataKey="sales" stroke={ACCENT} strokeWidth={2} fill="url(#salesFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
