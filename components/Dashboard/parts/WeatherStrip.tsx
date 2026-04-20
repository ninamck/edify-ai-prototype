'use client';

import { useEffect, useState } from 'react';
import { Sun, Cloud, CloudRain, CloudSun, X } from 'lucide-react';
import type { WeatherRow, WeatherCondition } from '@/components/Dashboard/data/managerMockData';

const OK = '#166534';
const WARN = '#B45309';

const CONDITION_LABEL: Record<WeatherCondition, string> = {
  'sun': 'Sunny',
  'part-cloud': 'Part cloudy',
  'cloud': 'Cloudy',
  'rain': 'Rain',
};

function WeatherIcon({ condition, size = 14 }: { condition: WeatherCondition; size?: number }) {
  const color = condition === 'sun' ? '#D97706' : condition === 'rain' ? '#2563EB' : 'var(--color-text-muted)';
  switch (condition) {
    case 'sun': return <Sun size={size} color={color} strokeWidth={2} />;
    case 'rain': return <CloudRain size={size} color={color} strokeWidth={2} />;
    case 'part-cloud': return <CloudSun size={size} color={color} strokeWidth={2} />;
    default: return <Cloud size={size} color={color} strokeWidth={2} />;
  }
}

interface BucketStats {
  primary: WeatherCondition;
  secondary: WeatherCondition | null;
  tempMin: number;
  tempMax: number;
  hasActuals: boolean;
  allActuals: boolean;
  avgDelta: number;
}

// Priority for tie-break: rain (most actionable for footfall) > sun (drives iced drinks) > part-cloud > cloud.
const CONDITION_PRIORITY: Record<WeatherCondition, number> = {
  'rain': 4,
  'sun': 3,
  'part-cloud': 2,
  'cloud': 1,
};

function bucketStats(rows: WeatherRow[]): BucketStats {
  const shown = rows.map((r) => r.actual ?? r.forecast);
  const counts: Partial<Record<WeatherCondition, number>> = {};
  for (const s of shown) counts[s.condition] = (counts[s.condition] ?? 0) + 1;
  const ranked = (Object.entries(counts) as [WeatherCondition, number][])
    .sort((a, b) => b[1] - a[1] || CONDITION_PRIORITY[b[0]] - CONDITION_PRIORITY[a[0]]);
  const primary = ranked[0][0];
  const secondary = ranked[1] && ranked[1][1] / shown.length >= 0.3 ? ranked[1][0] : null;
  const temps = shown.map((s) => s.tempC);
  let deltaSum = 0;
  let deltaCount = 0;
  for (const r of rows) {
    if (r.actual) {
      deltaSum += r.actual.tempC - r.forecast.tempC;
      deltaCount++;
    }
  }
  return {
    primary,
    secondary,
    tempMin: Math.min(...temps),
    tempMax: Math.max(...temps),
    hasActuals: deltaCount > 0,
    allActuals: deltaCount === rows.length,
    avgDelta: deltaCount > 0 ? deltaSum / deltaCount : 0,
  };
}

function BucketCard({
  label,
  rows,
  onClick,
}: {
  label: string;
  rows: WeatherRow[];
  onClick: () => void;
}) {
  const stats = bucketStats(rows);
  const delta = stats.avgDelta;
  const roundedDelta = Math.round(delta * 10) / 10;
  const deltaLabel = roundedDelta > 0 ? `+${roundedDelta}°` : `${roundedDelta}°`;
  const timeStart = rows[0].hour;
  const timeEnd = rows[rows.length - 1].hour;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        borderRadius: 10,
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        width: '100%',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#fff';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <WeatherIcon condition={stats.primary} size={30} />
        {stats.secondary && (
          <div style={{ opacity: 0.7 }}>
            <WeatherIcon condition={stats.secondary} size={20} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: 2,
        }}>
          {label} <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· {timeStart}–{timeEnd}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {CONDITION_LABEL[stats.primary]}
          {stats.secondary && (
            <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}> → {CONDITION_LABEL[stats.secondary]}</span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {stats.tempMin === stats.tempMax ? `${stats.tempMin}°` : `${stats.tempMin}–${stats.tempMax}°`}
          {stats.hasActuals && roundedDelta !== 0 && (
            <span style={{ color: roundedDelta > 0 ? WARN : OK, fontWeight: 700, marginLeft: 6 }}>
              {deltaLabel} {stats.allActuals ? 'vs forecast' : 'so far'}
            </span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
        Hourly →
      </span>
    </button>
  );
}

function HourlyModal({
  title,
  rows,
  onClose,
}: {
  title: string;
  rows: WeatherRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} hourly weather`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(30, 20, 15, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '16px 18px 18px',
          maxWidth: 560,
          width: '100%',
          boxShadow: '0 20px 50px rgba(30,20,15,0.3)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {title} · hour by hour
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
              Chip shows actual vs what forecast said (+ = warmer than forecast).
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              color: 'var(--color-text-muted)',
              display: 'flex',
            }}
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`,
            gap: 4,
          }}
        >
          {rows.map((row) => {
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
      </div>
    </div>
  );
}

function isMorning(hour: string): boolean {
  return hour.endsWith('am');
}

export default function WeatherStrip({ data }: { data: WeatherRow[] }) {
  const [openBucket, setOpenBucket] = useState<'morning' | 'afternoon' | null>(null);
  const morning = data.filter((r) => isMorning(r.hour));
  const afternoon = data.filter((r) => !isMorning(r.hour));

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 10,
        }}
      >
        {morning.length > 0 && (
          <BucketCard label="Morning" rows={morning} onClick={() => setOpenBucket('morning')} />
        )}
        {afternoon.length > 0 && (
          <BucketCard label="Afternoon" rows={afternoon} onClick={() => setOpenBucket('afternoon')} />
        )}
      </div>
      {openBucket && (
        <HourlyModal
          title={openBucket === 'morning' ? 'Morning' : 'Afternoon'}
          rows={openBucket === 'morning' ? morning : afternoon}
          onClose={() => setOpenBucket(null)}
        />
      )}
    </>
  );
}
