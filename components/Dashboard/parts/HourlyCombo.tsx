'use client';

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HourlyTradingRow } from '@/components/Dashboard/data/managerMockData';

const ACCENT = 'var(--color-accent-deep)';
const ACCENT_MID = 'var(--color-accent-mid)';
const OK = '#166534';
const WARN = '#B45309';
const GHOST = 'rgba(58,48,40,0.14)';

const tipStyle = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
};

type BarColour = { hour: string; fill: string };

function colourForRow(row: HourlyTradingRow): string {
  if (row.actual === null) return GHOST;
  return row.actual >= row.forecast ? OK : WARN;
}

export default function HourlyCombo({ data }: { data: HourlyTradingRow[] }) {
  // Find boundary between past (actuals) and future (rostered).
  const lastActualIdx = data.reduce((acc, r, i) => (r.actual !== null ? i : acc), -1);

  // Split staff into two lines so past is solid, future is dashed. Overlap one
  // point at the boundary so the lines visually connect.
  const chartData = data.map((r, i) => ({
    hour: r.hour,
    actualBar: r.actual ?? 0,
    forecast: r.forecast,
    staffActual: i <= lastActualIdx ? r.staff : null,
    staffRostered: i >= lastActualIdx ? r.staff : null,
    isFuture: r.actual === null,
  }));

  const barColours: BarColour[] = data.map((r) => ({ hour: r.hour, fill: colourForRow(r) }));
  const maxStaff = Math.max(...data.map((r) => r.staff));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(58,48,40,0.08)" vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(58,48,40,0.15)' }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `£${v}`}
          width={48}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}`}
          domain={[0, Math.max(6, maxStaff + 1)]}
          allowDecimals={false}
          width={28}
        />
        <Tooltip
          contentStyle={tipStyle}
          formatter={(value, name) => {
            const nameStr = String(name ?? '');
            const valStr = value === undefined || value === null ? '—' : String(value);
            if (nameStr === 'Staff on' || nameStr === 'Staff rostered') {
              return [`${valStr} on`, nameStr];
            }
            if (valStr === '0' && nameStr === 'Actual £') return ['—', nameStr];
            return [`£${valStr}`, nameStr];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="circle" />
        <Bar
          yAxisId="left"
          dataKey="actualBar"
          name="Actual £"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        >
          {barColours.map((b) => (
            <Cell key={b.hour} fill={b.fill} />
          ))}
        </Bar>
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="forecast"
          name="Forecast £"
          stroke={ACCENT}
          strokeWidth={2}
          dot={{ r: 2, fill: ACCENT }}
          activeDot={{ r: 4 }}
        />
        <Line
          yAxisId="right"
          type="stepAfter"
          dataKey="staffActual"
          name="Staff on"
          stroke={ACCENT_MID}
          strokeWidth={2}
          dot={{ r: 3, fill: ACCENT_MID }}
          connectNulls={false}
        />
        <Line
          yAxisId="right"
          type="stepAfter"
          dataKey="staffRostered"
          name="Staff rostered"
          stroke={ACCENT_MID}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={{ r: 3, fill: '#fff', stroke: ACCENT_MID, strokeWidth: 2 }}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
