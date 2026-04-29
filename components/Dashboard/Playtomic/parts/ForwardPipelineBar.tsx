'use client';

import { FORWARD_PIPELINE } from '@/components/Dashboard/data/playtomicMockData';

const NEGATIVE = '#d44d4d';
const TYPICAL_LINE = 'var(--color-accent-deep)';
const BAR_COLOUR = '#f4b8a8';

export default function ForwardPipelineBar() {
  const { bookedPct, typicalPct, vsTypicalLabel } = FORWARD_PIPELINE;
  return (
    <div
      style={{
        padding: '16px 16px 14px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.06)',
        fontFamily: 'var(--font-primary)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        Forward 14d pipeline
      </div>

      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: NEGATIVE,
          lineHeight: 1.1,
        }}
      >
        {vsTypicalLabel}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-text-muted)',
          marginTop: -4,
        }}
      >
        vs typical fill at this lead time
      </div>

      <div
        style={{
          position: 'relative',
          marginTop: 'auto',
          height: 14,
          borderRadius: 999,
          background: 'var(--color-bg-canvas)',
          border: '1px solid var(--color-border-subtle)',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            width: `${bookedPct}%`,
            height: '100%',
            borderRadius: 999,
            background: BAR_COLOUR,
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -4,
            bottom: -4,
            left: `${typicalPct}%`,
            width: 2,
            borderRadius: 1,
            background: TYPICAL_LINE,
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
        }}
      >
        <span>{bookedPct}% booked</span>
        <span>{typicalPct}% typical</span>
      </div>
    </div>
  );
}
