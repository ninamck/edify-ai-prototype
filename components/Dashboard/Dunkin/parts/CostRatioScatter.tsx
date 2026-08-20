'use client';

import {
  ResponsiveContainer,
  ScatterChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Scatter,
} from 'recharts';
import DunkinChartCard, {
  DUNKIN_TICK_STYLE,
  DUNKIN_TOOLTIP_STYLE,
} from '@/components/Dashboard/Dunkin/parts/DunkinChartCard';

export interface CostScatterPoint {
  store: string;
  foodPct: number;
  laborPct: number;
  sales: number;
}

const ACCENT_DEEP = 'var(--color-accent-deep)';
const NEGATIVE = '#d44d4d';

export default function CostRatioScatter({
  points,
  foodTarget = 22,
  labourTarget = 24,
}: {
  points: CostScatterPoint[];
  foodTarget?: number;
  labourTarget?: number;
}) {
  // Stores breaching either threshold get red dots so the demo lands.
  const safe = points.filter((p) => p.foodPct <= foodTarget && p.laborPct <= labourTarget);
  const watch = points.filter((p) => p.foodPct > foodTarget || p.laborPct > labourTarget);

  return (
    <DunkinChartCard
      title="Cost ratios · food % vs labour %"
      subtitle={`Each dot is a store this week. Red = above food (${foodTarget}%) or labour (${labourTarget}%) target.`}
      height={300}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
          <XAxis
            type="number"
            dataKey="foodPct"
            name="Food %"
            unit="%"
            domain={['dataMin - 1', 'dataMax + 1']}
            tick={DUNKIN_TICK_STYLE}
            axisLine={false}
            tickLine={false}
            label={{
              value: 'Food cost %',
              position: 'insideBottom',
              offset: -8,
              fontSize: 11,
              fill: 'var(--color-text-muted)',
              fontFamily: 'var(--font-primary)',
            }}
          />
          <YAxis
            type="number"
            dataKey="laborPct"
            name="Labour %"
            unit="%"
            domain={['dataMin - 1', 'dataMax + 1']}
            tick={DUNKIN_TICK_STYLE}
            axisLine={false}
            tickLine={false}
            label={{
              value: 'Labour %',
              angle: -90,
              position: 'insideLeft',
              fontSize: 11,
              fill: 'var(--color-text-muted)',
              fontFamily: 'var(--font-primary)',
            }}
          />
          <ZAxis type="number" dataKey="sales" range={[40, 220]} name="Sales" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={DUNKIN_TOOLTIP_STYLE}
            formatter={(v, name) => {
              if (name === 'Sales') return [`$${Number(v).toLocaleString('en-US')}`, name];
              if (name === 'Food %' || name === 'Labour %') return [`${Number(v).toFixed(1)}%`, name];
              return [v, String(name)];
            }}
            labelFormatter={() => ''}
            wrapperStyle={{ outline: 'none' }}
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const p = payload[0]?.payload as CostScatterPoint | undefined;
              if (!p) return null;
              return (
                <div style={{ ...DUNKIN_TOOLTIP_STYLE, padding: '8px 10px' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.store}</div>
                  <div>Food: {p.foodPct.toFixed(1)}%</div>
                  <div>Labour: {p.laborPct.toFixed(1)}%</div>
                  <div>Sales: ${Math.round(p.sales).toLocaleString('en-US')}</div>
                </div>
              );
            }}
          />
          <Scatter name="On target" data={safe} fill={ACCENT_DEEP} fillOpacity={0.75} />
          <Scatter name="Watch list" data={watch} fill={NEGATIVE} fillOpacity={0.85} />
        </ScatterChart>
      </ResponsiveContainer>
    </DunkinChartCard>
  );
}
