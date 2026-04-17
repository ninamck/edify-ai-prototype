'use client';

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Trash2, AlertTriangle } from 'lucide-react';
import type { WasteRow } from '@/components/Dashboard/data/managerMockData';

const ACCENT = 'var(--color-accent-deep)';
const ACCENT_MID = 'var(--color-accent-mid)';
const OK = '#166534';
const WARN = '#B45309';

const tipStyle = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
};

function severity(row: WasteRow): 'ok' | 'watch' | 'flag' {
  if (row.spendTypical === 0) return row.spendToday > 0 ? 'flag' : 'ok';
  const ratio = row.spendToday / row.spendTypical;
  if (ratio >= 1.5) return 'flag';
  if (ratio > 1.0) return 'watch';
  return 'ok';
}

function colourFor(sev: ReturnType<typeof severity>): string {
  if (sev === 'flag') return WARN;
  if (sev === 'watch') return ACCENT_MID;
  return OK;
}

export default function WasteCard({ rows }: { rows: WasteRow[] }) {
  const totalToday = rows.reduce((s, r) => s + r.spendToday, 0);
  const totalTypical = rows.reduce((s, r) => s + r.spendTypical, 0);
  const delta = totalToday - totalTypical;
  const deltaPct = totalTypical > 0 ? Math.round((delta / totalTypical) * 100) : 0;
  const overall: ReturnType<typeof severity> = delta <= 0 ? 'ok' : deltaPct >= 50 ? 'flag' : 'watch';

  // Sort highest waste £ first for the chart.
  const sorted = [...rows].sort((a, b) => b.spendToday - a.spendToday);
  const chartData = sorted.map((r) => ({
    product: r.product,
    today: r.spendToday,
    typical: r.spendTypical,
    sev: severity(r),
  }));

  const flagged = rows.filter((r) => r.flag && severity(r) === 'flag');

  return (
    <div
      style={{
        padding: '16px 16px 14px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--color-bg-hover)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trash2 size={16} color={ACCENT} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>Waste watch</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            Items wasted so far today vs typical for this time. Flag spikes early.
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          padding: '6px 12px',
          borderRadius: 100,
          background: overall === 'flag' ? 'rgba(180,83,9,0.12)' : overall === 'watch' ? 'rgba(58,48,40,0.06)' : 'rgba(22,101,52,0.12)',
        }}>
          <span style={{
            fontSize: 14, fontWeight: 700,
            color: overall === 'flag' ? WARN : overall === 'ok' ? OK : 'var(--color-text-primary)',
          }}>
            £{totalToday}
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            vs £{totalTypical} typical {delta === 0 ? '' : `(${delta > 0 ? '+' : ''}${deltaPct}%)`}
          </span>
        </div>
      </div>

      {/* Chart — today £ per product, coloured by severity */}
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            barCategoryGap={6}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(58,48,40,0.15)' }}
              tickFormatter={(v) => `£${v}`}
            />
            <YAxis
              type="category"
              dataKey="product"
              tick={{ fontSize: 11, fill: 'var(--color-text-primary)' }}
              tickLine={false}
              axisLine={false}
              width={130}
            />
            <Tooltip
              contentStyle={tipStyle}
              formatter={(value, name) => {
                const nameStr = String(name ?? '');
                const label = nameStr === 'today' ? 'Today' : 'Typical';
                return [`£${value}`, label];
              }}
            />
            <Bar dataKey="typical" name="typical" fill="rgba(58,48,40,0.12)" radius={[3, 3, 3, 3]} maxBarSize={10} />
            <Bar dataKey="today" name="today" radius={[3, 3, 3, 3]} maxBarSize={10}>
              {chartData.map((d) => (
                <Cell key={d.product} fill={colourFor(d.sev)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Flagged list */}
      {flagged.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Flagged now
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {flagged.map((r) => (
              <div
                key={r.product}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(180,83,9,0.06)',
                  border: '1px solid rgba(180,83,9,0.25)',
                }}
              >
                <AlertTriangle size={14} color={WARN} strokeWidth={2.2} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {r.product}
                    <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
                      {' '}· {r.unitsToday} wasted (typical {r.unitsTypical})
                    </span>
                  </div>
                  {r.flag && (
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                      {r.flag}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: WARN, textAlign: 'right', minWidth: 40 }}>
                  £{r.spendToday}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
