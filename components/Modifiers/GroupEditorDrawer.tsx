'use client';

/**
 * Slide-out drawer that hosts the full `GroupEditor` body. Used by the
 * recipe editor's "POS & modifiers" section so a user can create a new
 * modifier group (or tweak an existing attached one) without
 * navigating away from the recipe they're editing.
 *
 * Persistence model:
 *   - On Save, the group is upserted into the catalogue immediately
 *     via `upsertGroup`. The drawer then fires `onSaved(group)` so
 *     the recipe editor can auto-attach the new id to its draft.
 *   - On Delete (edit mode, only when the group is unused by any
 *     recipe), the catalogue entry is removed and `onDeleted(id)`
 *     fires so the recipe editor can detach if needed.
 *
 * Rendered via `createPortal` so the drawer always overlays the rest
 * of the app regardless of where the host card sits in the layout.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Trash2, X } from 'lucide-react';
import {
  upsertGroup,
  deleteGroup,
  genGroupId,
  genOptionId,
} from '@/components/Modifiers/store';
import { recipesUsingGroup } from '@/components/Recipe/recipeStore';
import type { ModifierGroup } from '@/components/Modifiers/types';
import {
  GroupEditor,
  primaryBtn,
  secondaryBtn,
  dangerBtn,
} from './GroupEditor';

/** Default shape for a freshly-created group. Save stays disabled
 *  until the user types a name. */
export function emptyGroup(): ModifierGroup {
  const id = genGroupId();
  return {
    id,
    name: '',
    selection: 'one',
    required: false,
    options: [{ id: genOptionId(id), name: 'Option 1', effects: [] }],
  };
}

function cloneGroup(g: ModifierGroup): ModifierGroup {
  return {
    ...g,
    options: g.options.map((o) => ({ ...o, effects: o.effects.map((e) => ({ ...e })) })),
  };
}

export function GroupEditorDrawer({
  open,
  mode,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  /** The group to edit (edit mode) or seed the create form (create mode = null). */
  initial: ModifierGroup | null;
  onClose: () => void;
  onSaved: (group: ModifierGroup) => void;
  onDeleted?: (id: string) => void;
}) {
  // Re-seed the draft whenever the drawer reopens or the target group changes.
  const seed = useMemo<ModifierGroup>(
    () => (initial ? cloneGroup(initial) : emptyGroup()),
    // We deliberately key off `initial` identity + `open` so reopening
    // the drawer on a fresh target re-initialises the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial, open],
  );
  const [draft, setDraft] = useState<ModifierGroup>(seed);
  useEffect(() => {
    setDraft(seed);
  }, [seed]);

  // Lock background scroll while drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to close (with dirty guard).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') attemptClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft, initial]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(seed);
  const canSave = draft.name.trim().length > 0;

  function attemptClose() {
    if (isDirty && !window.confirm('Discard changes to this modifier group?')) return;
    onClose();
  }

  function handleSave() {
    if (!canSave) return;
    const normalised: ModifierGroup = { ...draft, name: draft.name.trim() };
    upsertGroup(normalised);
    onSaved(normalised);
    onClose();
  }

  function handleDelete() {
    if (mode !== 'edit') return;
    const used = recipesUsingGroup(draft.id);
    if (used.length > 0) {
      window.alert(
        `Can't delete — used by ${used.length} recipe${used.length === 1 ? '' : 's'}. Detach from those first.`,
      );
      return;
    }
    if (!window.confirm(`Delete modifier group "${draft.name || 'Untitled group'}"?`)) return;
    deleteGroup(draft.id);
    onDeleted?.(draft.id);
    onClose();
  }

  const titleText = mode === 'create'
    ? (draft.name.trim() || 'New modifier group')
    : (draft.name.trim() || 'Untitled group');

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', justifyContent: 'flex-end',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={attemptClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.4)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          width: 'min(820px, 96vw)',
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
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--color-text-muted)',
                }}
              >
                {mode === 'create' ? 'Create modifier group' : 'Editing modifier group'}
              </span>
              {isDirty && (
                <span
                  style={{
                    padding: '2px 8px', borderRadius: 100,
                    background: 'rgba(241,180,52,0.18)', color: 'var(--color-warning)',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  }}
                >
                  Unsaved changes
                </span>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: 'var(--color-text-primary)' }}>
              {titleText}
            </div>
          </div>
          {mode === 'edit' && (
            <button onClick={handleDelete} style={dangerBtn}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button onClick={attemptClose} style={secondaryBtn}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{ ...primaryBtn, opacity: canSave ? 1 : 0.5 }}
          >
            <Check size={14} /> Save
          </button>
          <button
            onClick={attemptClose}
            aria-label="Close drawer"
            style={{
              marginLeft: 4, width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--color-border-subtle)', background: '#fff',
              color: 'var(--color-text-secondary)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 80px' }}>
          {mode === 'create' && (
            <div
              style={{
                marginBottom: 14, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(0, 28, 53,0.05)',
                color: 'var(--color-accent-active)',
                fontSize: 12.5,
              }}
            >
              This group will be saved to the modifier-groups catalogue and
              attached to this recipe on Save. You can then attach it to
              other recipes from their POS &amp; modifiers section.
            </div>
          )}
          <GroupEditor value={draft} onChange={setDraft} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default GroupEditorDrawer;
