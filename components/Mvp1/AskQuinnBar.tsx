'use client';

import EdifyMark from '@/components/EdifyMark/EdifyMark';

/**
 * Compact "Ask Quinn for a chart" pill. Lives inline next to whatever surface
 * houses the dashboard (section header in Design 1, utility bar in Design 2).
 *
 * Suggestion pills + prompt subtitle have moved into the chat panel itself,
 * so this button is the single, quiet entry point.
 */
export default function AskQuinnBar({
  onAsk,
  label = 'Ask Quinn for a chart',
}: {
  /** Called with no seed for the bare button click. */
  onAsk: (seed?: string) => void;
  /** Override the visible label if a different surface needs different copy. */
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onAsk()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 14px',
        borderRadius: '100px',
        border: 'none',
        background: 'var(--color-accent-active)',
        color: '#fff',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        fontSize: '12px',
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(34,68,68,0.25)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <EdifyMark size={12} strokeWidth={2.2} color="currentColor" />
      <span>{label}</span>
    </button>
  );
}
