'use client';

import { OK, type Kpi } from '@/components/Dashboard/data/estateMockData';

export default function KpiCard({ label, value, delta, deltaLabel, positive }: Kpi) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 8px rgba(58,48,40,0.08), 0 0 0 1px rgba(58,48,40,0.03)',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: '6px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: '4px',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: positive ? OK : 'var(--color-text-secondary)',
        }}
      >
        {delta}
        <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}> · {deltaLabel}</span>
      </div>
    </div>
  );
}
