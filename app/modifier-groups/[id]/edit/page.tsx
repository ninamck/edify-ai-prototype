'use client';

/**
 * Standalone route page for editing a single modifier group.
 *
 * The actual editor body lives in `components/Modifiers/GroupEditor`,
 * which is also hosted inside the slide-out `GroupEditorDrawer`
 * opened from the recipe editor. This route only owns:
 *   - the sticky page header (Back / Delete / Save)
 *   - the "Used by recipes" side panel
 *   - navigation behaviour after Save / Delete
 *
 * Both surfaces save through the same `upsertGroup`/`deleteGroup` calls
 * so behaviour is identical regardless of where the user is editing.
 */

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import {
  useModifierGroups,
  upsertGroup,
  deleteGroup,
} from '@/components/Modifiers/store';
import type { ModifierGroup } from '@/components/Modifiers/types';
import { useRecipes, recipesUsingGroup } from '@/components/Recipe/recipeStore';
import {
  GroupEditor,
  Card,
  SectionHeader,
  primaryBtn,
  secondaryBtn,
  dangerBtn,
} from '@/components/Modifiers/GroupEditor';

export default function ModifierGroupEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const groups = useModifierGroups();
  const recipes = useRecipes(); // subscribe so usedBy panel re-renders

  const original = useMemo(() => groups.find((g) => g.id === id) ?? null, [groups, id]);
  const [draft, setDraft] = useState<ModifierGroup | null>(() =>
    original
      ? {
          ...original,
          options: original.options.map((o) => ({
            ...o,
            effects: o.effects.map((e) => ({ ...e })),
          })),
        }
      : null,
  );

  if (!original || !draft) {
    return (
      <div style={{ padding: 60, fontFamily: 'var(--font-primary)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Modifier group not found</h1>
        <button onClick={() => router.push('/modifier-groups')} style={primaryBtn}>
          Back to modifier groups
        </button>
      </div>
    );
  }

  const usedBy = recipesUsingGroup(original.id);
  // Subscribed for re-render only; not read directly.
  void recipes;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(original);

  function handleSave() {
    if (!draft || !draft.name.trim()) return;
    upsertGroup({ ...draft, name: draft.name.trim() });
    router.push('/modifier-groups');
  }
  function handleDelete() {
    if (!original) return;
    if (usedBy.length > 0) {
      alert(`Can't delete — used by ${usedBy.length} recipe${usedBy.length === 1 ? '' : 's'}. Detach from those first.`);
      return;
    }
    if (!confirm(`Delete modifier group "${original.name}"?`)) return;
    deleteGroup(original.id);
    router.push('/modifier-groups');
  }

  return (
    <div style={{ padding: '20px 24px 130px', maxWidth: 1180, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Sticky header */}
      <div style={stickyHeader}>
        <button
          onClick={() => router.push('/modifier-groups')}
          style={{ ...secondaryBtn, padding: '7px 12px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={overlineStyle}>Editing modifier group</span>
            {isDirty && <span style={dirtyPill}>Unsaved changes</span>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
            {draft.name || <span style={{ color: 'var(--color-text-muted)' }}>Untitled group</span>}
          </div>
        </div>
        <button onClick={handleDelete} style={dangerBtn}>
          <Trash2 size={14} /> Delete
        </button>
        <button onClick={handleSave} disabled={!draft.name.trim()} style={{ ...primaryBtn, opacity: draft.name.trim() ? 1 : 0.5 }}>
          <Check size={14} /> Save
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18 }}>
        <GroupEditor value={draft} onChange={setDraft} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 100, alignSelf: 'start' }}>
          <Card>
            <SectionHeader title="Used by recipes" />
            {usedBy.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                Not yet attached to any recipe. Open a recipe editor and attach this group from the &ldquo;POS &amp; modifiers&rdquo; section.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {usedBy.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => router.push(`/recipes/${r.id}/edit`)}
                      style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border-subtle)',
                        background: '#fff', cursor: 'pointer', fontFamily: 'var(--font-primary)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{r.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{r.category}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

const stickyHeader: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  margin: '-20px -24px 14px',
  padding: '12px 24px',
  background: 'rgba(255,255,255,0.96)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  borderBottom: '1px solid var(--color-border-subtle)',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
};
const overlineStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--color-text-muted)',
};
const dirtyPill: React.CSSProperties = {
  padding: '2px 8px', borderRadius: 100,
  background: 'rgba(241,180,52,0.18)', color: 'var(--color-warning)',
  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
};
