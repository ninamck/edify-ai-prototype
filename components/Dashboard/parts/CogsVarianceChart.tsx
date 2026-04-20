'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ACCENT_MID,
  COGS_VAR,
  OK,
  WARN,
  tipStyle,
} from '@/components/Dashboard/data/estateMockData';

export default function CogsVarianceChart() {
  return (
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
  );
}
