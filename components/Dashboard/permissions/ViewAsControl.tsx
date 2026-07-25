'use client';

// "View as" preview banner. The picker itself lives in AdminToolsMenu (the
// dropdown on the home tab-strip row); this banner keeps an active preview
// unmistakable and offers the way out.

import { Eye, X } from 'lucide-react';
import { setViewAs, viewAsLabel, type ViewAsState } from './viewAsStore';

export function ViewAsBanner({ viewAs }: { viewAs: NonNullable<ViewAsState> }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 10,
        background: 'var(--color-bg-nav)',
        color: '#fff',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <Eye size={15} strokeWidth={2.2} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>
        Previewing as {viewAsLabel(viewAs)}
        <span style={{ fontWeight: 400, opacity: 0.8 }}>
          {' '}
          — you’re seeing exactly what they see: their dashboards, their sites’ data. View only.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setViewAs(null)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.35)',
          background: 'rgba(255,255,255,0.12)',
          color: '#fff',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        <X size={13} strokeWidth={2.4} />
        Exit preview
      </button>
    </div>
  );
}
