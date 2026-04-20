'use client';

import { ChevronRight } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { OK, WARN } from '@/components/Dashboard/data/estateMockData';

type Trend = 'positive' | 'negative' | 'neutral';

export default function DashboardTile({
  label,
  value,
  delta,
  deltaLabel,
  trend = 'neutral',
  sparkline,
  onTap,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaLabel?: string;
  trend?: Trend;
  sparkline?: number[];
  onTap?: () => void;
}) {
  const deltaColor =
    trend === 'positive' ? OK : trend === 'negative' ? WARN : 'var(--color-text-secondary)';
  const stroke =
    trend === 'positive' ? OK : trend === 'negative' ? WARN : 'var(--color-accent-deep)';

  const content = (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          {label}
        </span>
        {onTap && <ChevronRight size={16} color="var(--color-text-muted)" strokeWidth={2} />}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: sparkline ? 8 : 2,
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {value}
        </span>
        {delta && (
          <span style={{ fontSize: 13, fontWeight: 600, color: deltaColor }}>
            {delta}
            {deltaLabel && (
              <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
                {' · '}
                {deltaLabel}
              </span>
            )}
          </span>
        )}
        {!delta && deltaLabel && (
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            {deltaLabel}
          </span>
        )}
      </div>

      {sparkline && sparkline.length > 1 && (
        <div style={{ width: '100%', height: 36 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tileSpark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={stroke}
                strokeWidth={1.5}
                fill="url(#tileSpark)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );

  const baseStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid var(--color-border-subtle)',
    background: '#fff',
    boxShadow: '0 2px 8px rgba(58,48,40,0.06)',
    fontFamily: 'var(--font-primary)',
  };

  if (onTap) {
    return (
      <button
        type="button"
        onClick={onTap}
        style={{
          ...baseStyle,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {content}
      </button>
    );
  }

  return <div style={baseStyle}>{content}</div>;
}
