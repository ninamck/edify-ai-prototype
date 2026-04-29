'use client';

import type { ChainKpi } from '@/components/Dashboard/data/playtomicMockData';

const POSITIVE = '#21a87a';
const NEGATIVE = '#d44d4d';

function deltaColour(direction: 'up' | 'down', invert?: boolean): string {
  const isGood = invert ? direction === 'down' : direction === 'up';
  return isGood ? POSITIVE : NEGATIVE;
}

export default function KpiCardRow({ kpis }: { kpis: ChainKpi[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))`,
        gap: 12,
      }}
    >
      {kpis.map((k) => (
        <div
          key={k.id + k.label}
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            boxShadow: '0 2px 12px rgba(58,48,40,0.06)',
            fontFamily: 'var(--font-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {k.label}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1.15,
            }}
          >
            {k.value}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: deltaColour(k.direction, k.invert),
            }}
          >
            {k.delta}
          </div>
        </div>
      ))}
    </div>
  );
}
