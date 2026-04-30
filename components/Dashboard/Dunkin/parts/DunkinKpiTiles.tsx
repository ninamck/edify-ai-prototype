'use client';

export interface DunkinKpi {
  id: string;
  label: string;
  value: string;
  hint?: string;
}

export default function DunkinKpiTiles({ kpis }: { kpis: DunkinKpi[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(kpis.length, 6)}, minmax(0, 1fr))`,
        gap: 12,
      }}
    >
      {kpis.map((k) => (
        <div
          key={k.id}
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
          {k.hint && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--color-text-muted)',
              }}
            >
              {k.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
