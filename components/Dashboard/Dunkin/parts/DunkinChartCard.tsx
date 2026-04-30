'use client';

import type { ReactNode } from 'react';

export const DUNKIN_TICK_STYLE = {
  fontSize: 11,
  fontFamily: 'var(--font-primary)',
  fill: 'var(--color-text-muted)',
} as const;

export const DUNKIN_TOOLTIP_STYLE = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 8,
  fontFamily: 'var(--font-primary)',
  fontSize: 12,
};

export default function DunkinChartCard({
  title,
  subtitle,
  children,
  height = 240,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number | string;
}) {
  return (
    <div
      style={{
        padding: '16px 16px 12px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.06)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}
