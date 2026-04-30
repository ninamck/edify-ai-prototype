'use client';

export interface DmLeaderboardRow {
  dm: string;
  storeCount: number;
  totalSales: number;
  avgMarginPct: number | null;
  avgFoodCostPct: number | null;
  avgLaborPct: number | null;
}

function fmtMoney(v: number): string {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

function fmtPct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

export default function DmLeaderboard({ rows }: { rows: DmLeaderboardRow[] }) {
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
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          District manager leaderboard
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Latest week, sorted by total sales. Margin / food / labour are simple averages across stores.
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: 12,
            fontFamily: 'var(--font-primary)',
          }}
        >
          <thead>
            <tr style={{ color: 'var(--color-text-muted)' }}>
              <th style={thStyle('left')}>DM</th>
              <th style={thStyle('right')}>Stores</th>
              <th style={thStyle('right')}>Total sales</th>
              <th style={thStyle('right')}>Margin %</th>
              <th style={thStyle('right')}>Food %</th>
              <th style={thStyle('right')}>Labour %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.dm}
                style={{
                  background: i % 2 === 0 ? 'transparent' : 'var(--color-bg-surface)',
                }}
              >
                <td style={tdStyle('left', true)}>{r.dm || '—'}</td>
                <td style={tdStyle('right')}>{r.storeCount}</td>
                <td style={tdStyle('right', true)}>{fmtMoney(r.totalSales)}</td>
                <td style={tdStyle('right')}>{fmtPct(r.avgMarginPct)}</td>
                <td style={tdStyle('right')}>{fmtPct(r.avgFoodCostPct)}</td>
                <td style={tdStyle('right')}>{fmtPct(r.avgLaborPct)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle('left'), color: 'var(--color-text-muted)' }}>
                  No data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function thStyle(align: 'left' | 'right'): React.CSSProperties {
  return {
    textAlign: align,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '8px 10px',
    borderBottom: '1px solid var(--color-border-subtle)',
  };
}

function tdStyle(align: 'left' | 'right', bold = false): React.CSSProperties {
  return {
    textAlign: align,
    padding: '8px 10px',
    color: 'var(--color-text-primary)',
    fontWeight: bold ? 600 : 500,
    whiteSpace: 'nowrap',
  };
}
