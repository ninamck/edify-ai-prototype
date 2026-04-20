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
  ACCENT,
  ACCENT_MID,
  SITE_GP,
  tipStyle,
} from '@/components/Dashboard/data/estateMockData';

export default function SiteGpChart() {
  return (
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
  );
}
