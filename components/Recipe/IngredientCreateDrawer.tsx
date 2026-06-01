'use client';

/**
 * Slide-out drawer for creating a brand-new master product from inside
 * the recipe editor — used when the inline `IngredientRefPicker`
 * search comes up empty and the user wants to add the ingredient
 * without leaving their recipe.
 *
 * Why a drawer (not a one-tap "+ Create from name" like the existing
 * IngredientsV2 picker)?
 *   The one-tap path stamps a record with defaults (Other / each) the
 *   user has no chance to correct. In practice that leaves the
 *   catalogue littered with mis-categorised entries. The drawer keeps
 *   the in-flow feel (no full page nav) while letting the user set
 *   the three fields that actually matter at create time — Name,
 *   Category, Unit. Supplier SKUs / pack info / cost / nutrition still
 *   live in the heavier `/suppliers/products/[id]` editor; we link to
 *   it from the footer for users who want the full thing.
 *
 * Rendered via `createPortal` so it always overlays regardless of the
 * picker's ancestor layout (matrix card, sticky sidebar, etc.).
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import {
  ALL_CATEGORIES,
  type ProductCategory,
} from '@/components/Suppliers/fixtures';
import {
  createMasterProductFromName,
  type IngredientRef,
} from '@/components/Ingredients/catalogue';

const UNIT_SUGGESTIONS = ['each', 'g', 'kg', 'ml', 'L', 'pack', 'bottle', 'slice', 'piece', 'serving'];

export function IngredientCreateDrawer({
  open,
  initialName = '',
  onClose,
  onCreated,
}: {
  open: boolean;
  /** Pre-fills the Name field — typically the unmatched search query
   *  the user just typed in the picker. */
  initialName?: string;
  onClose: () => void;
  /** Fired after the master product is upserted into the catalogue.
   *  The new IngredientRef is passed back so the caller can auto-pick
   *  it in whatever picker triggered the drawer. */
  onCreated: (ref: IngredientRef) => void;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<ProductCategory>('Other');
  const [unit, setUnit] = useState('each');

  // Re-seed every time the drawer reopens — the picker may have typed
  // a different query since the last create.
  useEffect(() => {
    if (open) {
      setName(initialName);
      setCategory('Other');
      setUnit('each');
    }
  }, [open, initialName]);

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const canSave = name.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    const mp = createMasterProductFromName({
      name: name.trim(),
      category,
      unit: unit.trim() || 'each',
    });
    onCreated({ kind: 'master', masterProductId: mp.id });
    onClose();
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create new ingredient"
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        display: 'flex', justifyContent: 'flex-end',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.4)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          width: 'min(480px, 96vw)',
          height: '100%',
          background: 'var(--color-bg-page, #f7f7f8)',
          boxShadow: '-12px 0 32px rgba(3,15,58,0.18)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Sticky header */}
        <div
          style={{
            position: 'sticky', top: 0, zIndex: 2,
            padding: '14px 20px',
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--color-text-muted)',
              }}
            >
              New ingredient
            </div>
            <div
              style={{
                fontSize: 15, fontWeight: 700, marginTop: 2,
                color: 'var(--color-text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {name.trim() || 'Untitled product'}
            </div>
          </div>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{ ...primaryBtn, opacity: canSave ? 1 : 0.5 }}
          >
            <Check size={14} /> Create
          </button>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            style={iconBtn}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 80px' }}>
          <div
            style={{
              marginBottom: 14, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(0, 28, 53,0.05)',
              color: 'var(--color-accent-active)',
              fontSize: 12.5, lineHeight: 1.45,
            }}
          >
            Creates a master product in the shared catalogue. Once saved
            it's auto-attached to this recipe and available to every
            other recipe. Supplier SKUs (pack size, cost, allergens)
            can be linked to it later from the Suppliers area.
          </div>

          <Field
            label="Name"
            help="What this ingredient is called in your catalogue."
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Premium Almond Milk"
              style={inputStyle}
            />
          </Field>

          <Field
            label="Category"
            help="Used to group ingredients in reports and the picker."
          >
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              style={selectStyle}
            >
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Unit"
            help='How the master is described — e.g. "1L", "500g", "each".'
          >
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="each"
              list="ingredient-create-unit-suggestions"
              style={inputStyle}
            />
            <datalist id="ingredient-create-unit-suggestions">
              {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
            </datalist>
          </Field>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label, help, children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: 'flex', flexDirection: 'column', gap: 5,
        marginBottom: 14,
      }}
    >
      <span
        style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </span>
      {children}
      {help && (
        <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          {help}
        </span>
      )}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px', borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  fontSize: 13, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'><path fill=\'%23667085\' d=\'M0 0l5 6 5-6z\'/></svg>")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 11px center',
  paddingRight: 28,
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--color-accent-active)',
  background: 'var(--color-accent-active)',
  color: '#fff', fontSize: 12.5, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
};

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-secondary)', fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
};

const iconBtn: React.CSSProperties = {
  marginLeft: 4, width: 32, height: 32, borderRadius: 8,
  border: '1px solid var(--color-border-subtle)', background: '#fff',
  color: 'var(--color-text-secondary)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};
