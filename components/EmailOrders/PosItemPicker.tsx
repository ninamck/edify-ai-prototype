'use client';

/**
 * PosItemPicker — small anchored search list over the till's items
 * (`FITZROY_POS_INTAKE.menuItems`). Opens under the "Match to…" trigger
 * on an unmatched order line. Same anchoring convention as
 * `components/ItemMatching/MatchPicker`: the caller wraps its trigger in
 * a relatively positioned container.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { FITZROY_POS_INTAKE } from '@/components/Recipe/intakeFixtures';

export type PosPick = { posItemId: string; posItemName: string };

export default function PosItemPicker({
  suggestion,
  onPick,
  onClose,
}: {
  /** Edify's best guess, shown pinned at the top when present. */
  suggestion?: PosPick;
  onPick: (pick: PosPick) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = FITZROY_POS_INTAKE.menuItems;
    const list = needle ? all.filter((m) => m.name.toLowerCase().includes(needle)) : all;
    return list.filter((m) => m.id !== suggestion?.posItemId);
  }, [q, suggestion]);

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label="Match to a till item"
      style={{
        position: 'absolute', top: '100%', left: 0, marginTop: 4,
        width: 300, maxHeight: 320, overflow: 'hidden',
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        boxShadow: '0 12px 24px -8px rgba(0, 28, 53, 0.25)',
        zIndex: 60,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Search size={13} color="var(--color-text-muted)" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your till…"
          aria-label="Search your till"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)',
          }}
        />
      </div>
      <div style={{ overflowY: 'auto' }}>
        {suggestion && !q && (
          <button
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => onPick(suggestion)}
            style={{ ...rowStyle, background: 'rgba(0, 28, 53, 0.04)' }}
          >
            <EdifyMark size={12} color="var(--color-accent-active)" />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {suggestion.posItemName}
            </span>
            <span style={suggestedTag}>Suggested</span>
          </button>
        )}
        {items.map((m) => (
          <button
            type="button"
            role="option"
            aria-selected={false}
            key={m.id}
            onClick={() => onPick({ posItemId: m.id, posItemName: m.name })}
            style={rowStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{m.category}</span>
          </button>
        ))}
        {items.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
            Nothing on your till matches &ldquo;{q}&rdquo;.
          </div>
        )}
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', textAlign: 'left',
  padding: '9px 12px', minHeight: 40,
  border: 'none', background: '#fff',
  fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)', cursor: 'pointer',
};

const suggestedTag: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
  color: 'var(--color-accent-active)',
  padding: '1px 6px', borderRadius: 100,
  border: '1px solid var(--color-accent-active)',
  whiteSpace: 'nowrap',
};
