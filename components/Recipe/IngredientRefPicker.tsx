'use client';

/**
 * Compact ingredient picker — searches the unified catalogue (master
 * products + supplier SKUs + made products) and writes back a typed
 * `IngredientRef`. Used by:
 *   - the modifier-group editor (effect targets / replacements)
 *   - the recipe editor (slot default refs)
 *
 * The full ingredient editor (with qty + site overrides + add new master
 * product) lives in `IngredientsV2Section.tsx`; this picker is the
 * lightweight version intended for inline use inside other forms.
 */

import { useState } from 'react';
import {
  useIngredientCatalogue,
  type IngredientCatalogueRow,
  type IngredientRef,
} from '@/components/Ingredients/catalogue';

export function IngredientRefPicker({
  value, onChange, placeholder = 'Pick ingredient…',
}: {
  value?: IngredientRef;
  onChange: (ref: IngredientRef) => void;
  placeholder?: string;
}) {
  const { search, resolveRef } = useIngredientCatalogue();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const resolved = value ? resolveRef(value) : undefined;
  const results: IngredientCatalogueRow[] = search(q || resolved?.name || '', { limit: 20 });

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border-subtle)',
          background: '#fff', cursor: 'pointer', textAlign: 'left',
          fontFamily: 'var(--font-primary)', fontSize: 12.5,
        }}
      >
        {resolved?.name ?? <span style={{ color: 'var(--color-text-muted)' }}>{placeholder}</span>}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60,
            background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8,
            boxShadow: '0 12px 32px rgba(3,15,58,0.12)',
            maxHeight: 280, overflow: 'auto',
          }}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ingredients…"
            style={{
              width: '100%', padding: '8px 10px',
              border: 'none', borderBottom: '1px solid var(--color-border-subtle)',
              outline: 'none', fontFamily: 'var(--font-primary)', fontSize: 12.5,
            }}
          />
          {results.map((row, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onChange(row.ref); setOpen(false); setQ(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 10px', border: 'none',
                background: '#fff', cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{row.label}</span>
              <span style={pickerKindChip(row.kind)}>{row.sourceLabel}</span>
            </button>
          ))}
          {results.length === 0 && (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              No matches
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function pickerKindChip(kind: 'master' | 'supplier' | 'made' | 'subrecipe'): React.CSSProperties {
  const tones: Record<typeof kind, { bg: string; color: string }> = {
    master:    { bg: 'rgba(3,28,89,0.08)',   color: 'var(--color-accent-active)' },
    supplier:  { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' },
    made:      { bg: 'rgba(241,180,52,0.16)', color: 'var(--color-warning)' },
    subrecipe: { bg: 'rgba(82,170,150,0.18)', color: 'var(--color-success, #347262)' },
  };
  const t = tones[kind];
  return {
    padding: '2px 7px', borderRadius: 100,
    background: t.bg, color: t.color,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
  };
}
