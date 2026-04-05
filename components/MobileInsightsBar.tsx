'use client';

import { Clock, ChevronRight } from 'lucide-react';

export default function MobileInsightsBar({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        flexShrink: 0,
        width: '100%',
        padding: '12px 14px',
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 8px rgba(58,48,40,0.1)',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        textAlign: 'left',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        width: '100%',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
          minWidth: 0,
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}>
          <Clock size={16} color="var(--color-text-secondary)" strokeWidth={2} style={{ flexShrink: 0 }} />
          Today’s timeline
        </div>
        <ChevronRight size={18} color="var(--color-text-muted)" strokeWidth={2.2} style={{ flexShrink: 0 }} />
      </div>
      <div style={{
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: 'var(--color-text-muted)',
        marginTop: '4px',
      }}>
        Open full timeline
      </div>
    </button>
  );
}
