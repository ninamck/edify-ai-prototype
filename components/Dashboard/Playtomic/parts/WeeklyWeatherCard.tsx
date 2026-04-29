'use client';

import { Sun, Cloud, CloudRain, CloudSun } from 'lucide-react';
import {
  WEEKLY_WEATHER,
  type WeatherCondition,
} from '@/components/Dashboard/data/playtomicMockData';

const ICON_COLOUR: Record<WeatherCondition, string> = {
  sun: '#d97706',
  'part-cloud': 'var(--color-text-secondary)',
  cloud: 'var(--color-text-muted)',
  rain: '#2563eb',
};

const LABEL: Record<WeatherCondition, string> = {
  sun: 'Sunny',
  'part-cloud': 'Part cloud',
  cloud: 'Cloudy',
  rain: 'Rain',
};

function WeatherIcon({ condition, size = 22 }: { condition: WeatherCondition; size?: number }) {
  const colour = ICON_COLOUR[condition];
  switch (condition) {
    case 'sun': return <Sun size={size} color={colour} strokeWidth={2} />;
    case 'rain': return <CloudRain size={size} color={colour} strokeWidth={2} />;
    case 'part-cloud': return <CloudSun size={size} color={colour} strokeWidth={2} />;
    default: return <Cloud size={size} color={colour} strokeWidth={2} />;
  }
}

export default function WeeklyWeatherCard() {
  const maxBookings = Math.max(...WEEKLY_WEATHER.map((d) => d.expectedBookings));

  return (
    <div
      style={{
        padding: '16px 16px 14px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.06)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          7-day weather and expected bookings
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Forecast across the chain. Wet days drag bookings; sunny weekends amplify cafe spend.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${WEEKLY_WEATHER.length}, minmax(0, 1fr))`,
          gap: 10,
        }}
      >
        {WEEKLY_WEATHER.map((d) => {
          const heightPct = Math.round((d.expectedBookings / maxBookings) * 100);
          return (
            <div
              key={d.day}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '10px 4px',
                borderRadius: 10,
                background: 'var(--color-bg-canvas)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)' }}>
                {d.day}
              </div>
              <WeatherIcon condition={d.condition} />
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {d.tempC}°
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: d.precipPct >= 50 ? '#2563eb' : 'var(--color-text-muted)',
                }}
                aria-label={`${LABEL[d.condition]}, ${d.precipPct}% precipitation`}
              >
                {d.precipPct}%
              </div>
              <div
                aria-hidden
                style={{
                  marginTop: 4,
                  width: '100%',
                  height: 50,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '70%',
                    height: `${heightPct}%`,
                    borderRadius: 4,
                    background: d.condition === 'rain' ? '#9bc2f5' : 'var(--color-accent-active)',
                    opacity: 0.85,
                    transition: 'height 0.2s',
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {d.expectedBookings}
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                bookings
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
