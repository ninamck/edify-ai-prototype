'use client';

import { Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'Labour % by hour',
  'Waste trend last 4 weeks',
  'Site comparison',
];

export default function AskQuinnBar({
  onAsk,
}: {
  /** Called when Ask Quinn or any suggestion pill is clicked. seed is the suggestion text, undefined for the main button. */
  onAsk: (seed?: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '12px 16px',
        borderRadius: '12px',
        background: '#fff',
        border: '2px solid rgba(217, 215, 212, 1)',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
        fontFamily: 'var(--font-primary)',
        boxSizing: 'border-box',
      }}
    >
      {/* Header — mirrors the "On the floor" treatment on the sibling card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--color-text-muted)',
          }}
        >
          Ask Quinn
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '6px',
            background: 'var(--color-accent-active)',
          }}
          aria-hidden="true"
        >
          <Sparkles size={11} strokeWidth={2.4} color="#fff" />
        </span>
      </div>

      {/* Prompt + subtitle on a single tight block */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          lineHeight: 1.25,
        }}
      >
        Add your next chart
      </div>
      <div
        style={{
          fontSize: '11.5px',
          color: 'var(--color-text-muted)',
          lineHeight: 1.35,
          marginBottom: '10px',
        }}
      >
        Ask anything about your data &mdash; I&rsquo;ll draw it, then you can pin it here.
      </div>

      {/* Suggestion pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '5px',
          marginBottom: '10px',
        }}
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onAsk(s)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 9px',
              borderRadius: '100px',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: '10.5px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            <Sparkles size={10} strokeWidth={2.2} color="var(--color-text-muted)" />
            <span>{s}</span>
          </button>
        ))}
      </div>

      {/* Spacer pushes the CTA to the bottom so the card reads as a proper panel */}
      <div style={{ flex: 1 }} />

      <button
        type="button"
        onClick={() => onAsk()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
          gap: '6px',
          padding: '7px 14px',
          borderRadius: '100px',
          border: 'none',
          background: 'var(--color-accent-active)',
          color: '#fff',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          fontSize: '11.5px',
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(34,68,68,0.25)',
          whiteSpace: 'nowrap',
        }}
      >
        <Sparkles size={11} strokeWidth={2.2} />
        <span>Ask Quinn anything</span>
      </button>
    </div>
  );
}
