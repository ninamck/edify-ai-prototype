'use client';

import { Sun, Cloud, CloudRain, CloudSun } from 'lucide-react';
import type { WeatherRow, WeatherCondition } from '@/components/Dashboard/data/managerMockData';

const OK = '#166534';
const WARN = '#B45309';

function WeatherIcon({ condition, size = 14 }: { condition: WeatherCondition; size?: number }) {
  const color = condition === 'sun' ? '#D97706' : condition === 'rain' ? '#2563EB' : 'var(--color-text-muted)';
  switch (condition) {
    case 'sun': return <Sun size={size} color={color} strokeWidth={2} />;
    case 'rain': return <CloudRain size={size} color={color} strokeWidth={2} />;
    case 'part-cloud': return <CloudSun size={size} color={color} strokeWidth={2} />;
    default: return <Cloud size={size} color={color} strokeWidth={2} />;
  }
}

export default function WeatherStrip({ data }: { data: WeatherRow[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
        gap: 4,
        overflowX: 'auto',
      }}
    >
      {data.map((row) => {
        const isFuture = row.actual === null;
        const shown = row.actual ?? row.forecast;
        const delta = row.actual ? row.actual.tempC - row.forecast.tempC : 0;
        const deltaLabel = delta > 0 ? `+${delta}°` : `${delta}°`;

        return (
          <div
            key={row.hour}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '10px 4px',
              borderRadius: 8,
              background: isFuture ? 'var(--color-bg-hover)' : '#fff',
              border: '1px solid var(--color-border-subtle)',
              opacity: isFuture ? 0.7 : 1,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)' }}>
              {row.hour}
            </span>
            <WeatherIcon condition={shown.condition} size={16} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {shown.tempC}°
            </span>
            {!isFuture && delta !== 0 ? (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: delta > 0 ? WARN : OK,
                lineHeight: 1,
              }}>
                {deltaLabel}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: 'transparent', lineHeight: 1 }}>·</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
