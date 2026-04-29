'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { BOOKING_ORIGIN } from '@/components/Dashboard/data/playtomicMockData';

const TOOLTIP_STYLE = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 8,
  fontFamily: 'var(--font-primary)',
  fontSize: 12,
};

export default function BookingOriginDonut() {
  return (
    <div
      style={{
        padding: '16px 16px 14px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.06)',
        fontFamily: 'var(--font-primary)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: 10,
        }}
      >
        Booking origin
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, alignItems: 'center', flex: 1 }}>
        <div style={{ width: 120, height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={BOOKING_ORIGIN}
                dataKey="pct"
                nameKey="channel"
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={56}
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive={false}
                labelLine={false}
              >
                {BOOKING_ORIGIN.map((c) => (
                  <Cell key={c.channel} fill={c.colour} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, name) => [`${Number(v)}%`, String(name)]}
                contentStyle={TOOLTIP_STYLE}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {BOOKING_ORIGIN.map((c) => (
            <li
              key={c.channel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: c.colour,
                  flexShrink: 0,
                }}
              />
              <span>{c.channel}</span>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>· {c.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
