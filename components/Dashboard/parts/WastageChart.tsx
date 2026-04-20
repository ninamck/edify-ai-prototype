'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { WARN, WASTAGE, tipStyle } from '@/components/Dashboard/data/estateMockData';

export default function WastageChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={WASTAGE} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis
          dataKey="cat"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-12}
          textAnchor="end"
          height={52}
        />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          contentStyle={tipStyle}
          formatter={(v) => [`£${(Number(v) * 1000).toFixed(0)}`, 'Wastage']}
        />
        <Bar dataKey="k" fill={WARN} radius={[6, 6, 0, 0]} name="£k" />
      </BarChart>
    </ResponsiveContainer>
  );
}
