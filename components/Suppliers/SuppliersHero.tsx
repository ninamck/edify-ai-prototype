'use client';

/**
 * Hero strip pinned above the list views. Sits two roles at once:
 *
 *   1. Quick Quinn entry \u2014 free-text input that opens the QuinnSheet seeded
 *      with the typed sentence.
 *   2. Suggestion pills \u2014 5 dynamically-built tappable shortcuts based on
 *      the current tab and selection. Selecting a pill opens the sheet
 *      already on the right scope, often skipping straight to the preview.
 *
 * Per design principle 3 ("conversational over transactional"), the hero is
 * the primary entry point on the page \u2014 the table sits beneath it.
 */

import { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';

export type Suggestion = { label: string; seed: string };

export default function SuppliersHero({
  title,
  subtitle,
  suggestions,
  onAsk,
}: {
  title: string;
  subtitle?: string;
  suggestions: Suggestion[];
  onAsk: (seed?: string) => void;
}) {
  const [input, setInput] = useState('');

  function send() {
    const trimmed = input.trim();
    if (!trimmed) {
      onAsk();
    } else {
      onAsk(trimmed);
      setInput('');
    }
  }

  return (
    <section style={{
      padding: '16px 18px',
      borderRadius: 14,
      background: 'linear-gradient(180deg, #FEFCF9 0%, #fff 100%)',
      border: '1px solid var(--color-border-subtle)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--color-quinn-bg)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <EdifyMark size={15} color="var(--color-accent-quinn)" strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: 'var(--color-accent-active)',
          }}>
            QUINN
          </div>
          <div style={{
            fontSize: 14.5, fontWeight: 600,
            color: 'var(--color-text-primary)',
            lineHeight: 1.4,
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontSize: 12.5, color: 'var(--color-text-muted)',
              marginTop: 2, lineHeight: 1.45,
            }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px',
        borderRadius: 12,
        background: '#fff',
        border: '1px solid var(--color-border)',
      }}>
        <Sparkles size={14} color="var(--color-accent-active)" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="e.g. Mark every Agility flour product unavailable"
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            flex: 1, fontSize: 13.5, fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
          }}
        />
        <button
          onClick={send}
          style={{
            padding: '7px 14px',
            borderRadius: 100, border: 'none',
            background: 'var(--color-accent-active)',
            color: '#fff',
            fontSize: 12.5, fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            flexShrink: 0,
          }}
        >
          <Send size={12} /> Ask Edify
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onAsk(s.seed)}
            style={{
              padding: '6px 12px',
              borderRadius: 100,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              color: 'var(--color-text-secondary)',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </section>
  );
}
