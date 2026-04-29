'use client';

import { ChevronRight } from 'lucide-react';
import { LAPSED_PLAYERS } from '@/components/Dashboard/data/playtomicMockData';

const COLOUR = '#d44d4d';

export default function LapsedPlayersCard() {
  return (
    <button
      type="button"
      style={{
        textAlign: 'left',
        padding: '14px 16px',
        borderRadius: 12,
        border: `1px solid rgba(212, 77, 77, 0.4)`,
        background: 'rgba(212, 77, 77, 0.05)',
        boxShadow: '0 2px 12px rgba(58,48,40,0.06)',
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        <span>Lapsed players</span>
        <ChevronRight size={14} color="var(--color-text-muted)" strokeWidth={2} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: COLOUR, lineHeight: 1.1 }}>
        {LAPSED_PLAYERS.count}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
        {LAPSED_PLAYERS.deltaLabel}
      </div>
    </button>
  );
}
