'use client';

import { MessageSquare, Sparkles } from 'lucide-react';

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
        alignItems: 'center',
        gap: '14px',
        padding: '10px 14px',
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-surface)',
        boxShadow: '0 1px 0 rgba(58,48,40,0.04)',
        fontFamily: 'var(--font-primary)',
        minHeight: '64px',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'var(--color-accent-active)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden="true"
      >
        <MessageSquare size={18} strokeWidth={2.2} color="#fff" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            lineHeight: 1.2,
          }}
        >
          Add your next chart
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Ask me anything about your data &mdash; I&rsquo;ll draw it, then you can pin it here.
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}
        className="ask-quinn-suggestions"
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onAsk(s)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '100px',
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            <Sparkles size={11} strokeWidth={2.2} color="var(--color-text-muted)" />
            <span>{s}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onAsk()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
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
        }}
      >
        <Sparkles size={12} strokeWidth={2.2} />
        <span>Ask Quinn</span>
      </button>

      <style>{`
        @media (max-width: 900px) {
          .ask-quinn-suggestions {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
