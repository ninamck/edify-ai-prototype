'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ACCENT,
  ACCENT_MID,
  LABOUR_VS_SALES,
  tipStyle,
} from '@/components/Dashboard/data/estateMockData';

export default function LabourVsSalesChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={LABOUR_VS_SALES} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis dataKey="site" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={36} domain={[24, 32]} unit="%" />
        <Tooltip contentStyle={tipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="actual" name="Actual %"      stroke={ACCENT}     strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="plan"   name="Roster plan %" stroke={ACCENT_MID} strokeWidth={2} strokeDasharray="5 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
