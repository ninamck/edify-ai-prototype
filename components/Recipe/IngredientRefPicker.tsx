'use client';

/**
 * Compact ingredient picker — searches the unified catalogue (master
 * products + supplier SKUs + made products) and writes back a typed
 * `IngredientRef`. Used by:
 *   - the modifier-group editor (effect targets / replacements)
 *   - the recipe editor (slot default refs)
 *   - the variants matrix (add a row to all variants at once)
 *
 * The full ingredient editor (with qty + site overrides + add new master
 * product) lives in `IngredientsV2Section.tsx`; this picker is the
 * lightweight version intended for inline use inside other forms.
 *
 * Dropdown positioning: rendered into a portal at `document.body` with
 * `fixed` coords measured from the anchor button. This is important
 * because the picker frequently lives inside containers with
 * `overflow: hidden` (e.g. the variants matrix card uses it to clip
 * its rounded corners). An in-flow absolute dropdown would be clipped
 * by those ancestors; portalling escapes the issue entirely. The
 * dropdown auto-flips above the anchor when there isn't room below,
 * and re-positions on window scroll/resize so it tracks the anchor.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Sparkles } from 'lucide-react';
import {
  useIngredientCatalogue,
  type IngredientCatalogueRow,
  type IngredientRef,
} from '@/components/Ingredients/catalogue';
import { IngredientCreateDrawer } from './IngredientCreateDrawer';

const DROPDOWN_MAX_HEIGHT = 280;
const DROPDOWN_GAP = 6;
const VIEWPORT_PADDING = 8;

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
  // Drawer for the "+ Create new ingredient" flow. Held in picker
  // state (not lifted) so any caller using IngredientRefPicker gets
  // the create flow for free without wiring it up themselves.
  const [createOpen, setCreateOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{
    left: number; top: number; width: number; placement: 'below' | 'above';
  } | null>(null);

  const resolved = value ? resolveRef(value) : undefined;
  const results: IngredientCatalogueRow[] = search(q || resolved?.name || '', { limit: 20 });
  const trimmedQ = q.trim();
  const showCreate = trimmedQ.length > 0;
  const noMatches = showCreate && results.length === 0;

  const computePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current?.offsetHeight ?? DROPDOWN_MAX_HEIGHT;

    let top = r.bottom + DROPDOWN_GAP;
    let placement: 'below' | 'above' = 'below';
    if (top + dropdownHeight > window.innerHeight - VIEWPORT_PADDING) {
      const aboveTop = r.top - DROPDOWN_GAP - dropdownHeight;
      if (aboveTop >= VIEWPORT_PADDING) {
        top = aboveTop;
        placement = 'above';
      }
    }

    setPos({ left: r.left, top, width: r.width, placement });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
  }, [open, computePosition]);

  // Re-measure once the dropdown has rendered (so the actual height,
  // not the initial estimate, drives the flip decision).
  useEffect(() => {
    if (!open || !dropdownRef.current) return;
    computePosition();
  }, [open, results.length, computePosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (buttonRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onScrollOrResize() {
      // Keep the dropdown anchored to the button as the page scrolls
      // rather than closing — closing would force the user to re-click
      // every time they nudge the page.
      computePosition();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, computePosition]);

  const dropdown = open && typeof document !== 'undefined' ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        width: pos?.width ?? 240,
        zIndex: 1000,
        background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8,
        boxShadow: '0 12px 32px rgba(3,15,58,0.12)',
        maxHeight: DROPDOWN_MAX_HEIGHT, overflow: 'auto',
        fontFamily: 'var(--font-primary)',
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
          boxSizing: 'border-box',
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
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
        >
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{row.label}</span>
          <span style={pickerKindChip(row.kind)}>{row.sourceLabel}</span>
        </button>
      ))}
      {noMatches && (
        <div style={{ padding: '12px 12px 4px', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
          No matches for &ldquo;{trimmedQ}&rdquo;.
        </div>
      )}
      {!showCreate && results.length === 0 && (
        <div style={{ padding: 12, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
          Type to search the ingredient catalogue.
        </div>
      )}
      {showCreate && (
        <button
          type="button"
          onClick={() => { setCreateOpen(true); setOpen(false); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '11px 12px', border: 'none',
            borderTop: results.length > 0 ? '1px solid var(--color-border-subtle)' : 'none',
            background: noMatches ? 'rgba(0, 28, 53,0.05)' : '#fff',
            cursor: 'pointer', textAlign: 'left',
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-accent-active)', fontWeight: 700, fontSize: 12.5,
            position: 'sticky', bottom: 0, zIndex: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 28, 53,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = noMatches ? 'rgba(0, 28, 53,0.05)' : '#fff'; }}
        >
          {noMatches ? <Sparkles size={13} /> : <Plus size={13} strokeWidth={2.4} />}
          <span>
            Create new ingredient: <span style={{ fontWeight: 700 }}>&ldquo;{trimmedQ}&rdquo;</span>
          </span>
        </button>
      )}
    </div>,
    document.body,
  ) : null;

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
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
      {dropdown}
      <IngredientCreateDrawer
        open={createOpen}
        initialName={trimmedQ}
        onClose={() => setCreateOpen(false)}
        onCreated={(ref) => {
          // Auto-pick the freshly created ingredient so the user lands
          // straight in the next step (qty / variants), not back at the
          // picker with a stale query.
          onChange(ref);
          setQ('');
        }}
      />
    </div>
  );
}

function pickerKindChip(kind: 'master' | 'supplier' | 'made' | 'subrecipe'): React.CSSProperties {
  const tones: Record<typeof kind, { bg: string; color: string }> = {
    master:    { bg: 'rgba(0, 28, 53,0.08)',   color: 'var(--color-accent-active)' },
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
