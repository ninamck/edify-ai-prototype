'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, X, Trash2, Check, ChevronDown,
  Sparkles, ArrowRight,
} from 'lucide-react';
import {
  useMenuItems, upsertMenuItem, deleteMenuItem,
} from '@/components/MenuItems/store';
import type { MenuItem, MenuItemSlot, MenuItemCategory } from '@/components/MenuItems/types';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { useModifierGroups } from '@/components/Modifiers/store';
import { applyModifiers, defaultSelectionFor } from '@/components/MenuItems/resolver';
import {
  useIngredientCatalogue, type IngredientCatalogueRow, type IngredientRef,
} from '@/components/Ingredients/catalogue';

const CATEGORIES: MenuItemCategory[] = [
  'Coffee', 'Tea', 'Pastry', 'Food', 'Wine', 'Spirits', 'Kids',
  'Bakery', 'Sandwich', 'Salad', 'Snack', 'Beverage',
];
const UNITS = ['g', 'kg', 'ml', 'L', 'each', 'unit'];
const SITES = ['Fitzroy Espresso', 'Brixton Outpost', 'Shoreditch Roast', 'Soho Annex'];

export default function MenuItemEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const items = useMenuItems();
  const recipes = useRecipes();
  const groups = useModifierGroups();

  const original = useMemo(() => items.find((m) => m.id === id) ?? null, [items, id]);
  const [draft, setDraft] = useState<MenuItem | null>(() =>
    original
      ? { ...original, slots: original.slots.map((s) => ({ ...s })), modifierGroupIds: [...original.modifierGroupIds] }
      : null,
  );
  const [previewSiteId, setPreviewSiteId] = useState<string>(SITES[0]);
  const [previewSelection, setPreviewSelection] = useState<Record<string, string>>({});

  if (!original || !draft) {
    return (
      <div style={{ padding: 60, fontFamily: 'var(--font-primary)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Menu item not found</h1>
        <button onClick={() => router.push('/menu-items')} style={primaryBtn}>Back to menu items</button>
      </div>
    );
  }

  const recipe = draft.defaultRecipeId
    ? recipes.find((r) => r.id === draft.defaultRecipeId)
    : undefined;

  // Default the preview's selection to the per-group default options.
  const effectiveSelection = useMemo(() => {
    const out: string[] = [];
    for (const gid of draft.modifierGroupIds) {
      const userPick = previewSelection[gid];
      if (userPick) {
        out.push(userPick);
        continue;
      }
      // fall back to the group's default option(s)
      const g = groups.find((gg) => gg.id === gid);
      if (!g) continue;
      const def = g.options.find((o) => o.isDefault);
      if (def) out.push(def.id);
    }
    return out;
  }, [draft.modifierGroupIds, previewSelection, groups]);

  const resolved = useMemo(() => applyModifiers({
    menuItem: draft as MenuItem,
    recipe,
    selectedOptionIds: effectiveSelection,
    siteId: previewSiteId,
  }), [draft, recipe, effectiveSelection, previewSiteId]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(original);
  // Local non-null aliases so handlers below don't have to keep narrowing.
  const draftSafe = draft as MenuItem;
  const originalSafe = original as MenuItem;

  function patch<K extends keyof MenuItem>(key: K, value: MenuItem[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  function patchSlot(idx: number, p: Partial<MenuItemSlot>) {
    setDraft((d) => {
      if (!d) return d;
      const next = d.slots.map((s, i) => (i === idx ? { ...s, ...p } : s));
      return { ...d, slots: next };
    });
  }
  function addSlot() {
    setDraft((d) => d ? { ...d, slots: [...d.slots, { key: `slot-${d.slots.length + 1}`, label: 'New slot' }] } : d);
  }
  function removeSlot(idx: number) {
    setDraft((d) => d ? { ...d, slots: d.slots.filter((_, i) => i !== idx) } : d);
  }
  function toggleGroup(gid: string) {
    setDraft((d) => {
      if (!d) return d;
      const has = d.modifierGroupIds.includes(gid);
      const next = has
        ? d.modifierGroupIds.filter((x) => x !== gid)
        : [...d.modifierGroupIds, gid];
      return { ...d, modifierGroupIds: next };
    });
  }

  function handleSave() {
    if (!draftSafe.name.trim()) return;
    upsertMenuItem(draftSafe);
    router.push('/menu-items');
  }
  function handleDelete() {
    if (!confirm(`Delete menu item "${originalSafe.name}"?`)) return;
    deleteMenuItem(originalSafe.id);
    router.push('/menu-items');
  }

  return (
    <div style={{ padding: '20px 24px 130px', maxWidth: 1260, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Sticky header */}
      <div style={stickyHeader}>
        <button onClick={() => router.push('/menu-items')} style={{ ...secondaryBtn, padding: '7px 12px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={overlineStyle}>Editing menu item</span>
            <span style={{
              padding: '2px 8px', borderRadius: 100,
              background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
            }}>{draft.category}</span>
            {draft.posLinked && (
              <span style={{
                padding: '2px 8px', borderRadius: 100,
                background: 'rgba(3,28,89,0.08)', color: 'var(--color-accent-active)',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
              }}>POS-linked</span>
            )}
            {!draft.defaultRecipeId && (
              <span style={{
                padding: '2px 8px', borderRadius: 100,
                background: 'rgba(241,180,52,0.18)', color: 'var(--color-warning)',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
              }}>Modifier-driven</span>
            )}
            {isDirty && <span style={dirtyPill}>Unsaved changes</span>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
            {draft.name || <span style={{ color: 'var(--color-text-muted)' }}>Untitled menu item</span>}
          </div>
        </div>
        <button onClick={handleDelete} style={dangerBtn}>
          <Trash2 size={14} /> Delete
        </button>
        <button onClick={handleSave} disabled={!draft.name.trim()} style={{ ...primaryBtn, opacity: draft.name.trim() ? 1 : 0.5 }}>
          <Check size={14} /> Save
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Basics */}
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.6fr', gap: 14 }}>
              <Field label="Name">
                <input value={draft.name} onChange={(e) => patch('name', e.target.value)} style={textInput} />
              </Field>
              <Field label="Category">
                <select value={draft.category} onChange={(e) => patch('category', e.target.value as MenuItemCategory)} style={textInput}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={draft.status} onChange={(e) => patch('status', e.target.value as MenuItem['status'])} style={textInput}>
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Archived">Archived</option>
                </select>
              </Field>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 0.6fr 0.6fr', gap: 14 }}>
              <Field label="Notes (optional)">
                <input
                  value={draft.notes ?? ''}
                  onChange={(e) => patch('notes', e.target.value || undefined)}
                  placeholder="What this item is — surfaces in the recipe drawer"
                  style={textInput}
                />
              </Field>
              <Field label="Base price (£, ex VAT)">
                <input
                  type="number" step="0.01"
                  value={draft.basePrice ?? ''}
                  onChange={(e) => patch('basePrice', e.target.value === '' ? undefined : Number(e.target.value))}
                  style={textInput}
                />
              </Field>
              <Field label="POS source id">
                <input
                  value={draft.posSourceId ?? ''}
                  onChange={(e) => patch('posSourceId', e.target.value || undefined)}
                  placeholder="e.g. pos-mi-latte"
                  style={textInput}
                />
              </Field>
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                <input type="checkbox" checked={draft.posLinked} onChange={(e) => patch('posLinked', e.target.checked)} />
                POS-linked
              </label>
            </div>
          </Card>

          {/* Default recipe */}
          <Card>
            <SectionHeader title="Default recipe" hint="The base composition. Leave empty for modifier-driven items where the customer always picks (e.g. wine pour size)." />
            <RecipePicker
              value={draft.defaultRecipeId}
              onChange={(rid) => patch('defaultRecipeId', rid)}
              recipes={recipes}
            />
          </Card>

          {/* Slots */}
          <Card>
            <SectionHeader
              title="Slots"
              hint='Named ingredient placeholders that "set-slot" modifier effects can target. Lets one shared modifier (e.g. "Spirit measure 25/50ml") apply to every spirit menu item without naming each spirit.'
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {draft.slots.map((slot, i) => (
                <SlotEditor
                  key={i}
                  slot={slot}
                  onPatch={(p) => patchSlot(i, p)}
                  onRemove={() => removeSlot(i)}
                />
              ))}
              <button onClick={addSlot} style={addBtn}>
                <Plus size={13} strokeWidth={2.2} /> Add slot
              </button>
            </div>
          </Card>

          {/* Modifier groups */}
          <Card>
            <SectionHeader title="Attached modifier groups" hint="Catalogue-level groups attached to this menu item. Click a group on the right column to attach or detach." />
            <ModifierGroupPicker
              attached={draft.modifierGroupIds}
              onToggle={toggleGroup}
            />
          </Card>
        </div>

        {/* Right rail: live preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 100, alignSelf: 'start' }}>
          <Card>
            <SectionHeader title="What gets sold" hint="Live preview of the resolved composition based on the selected modifier options + site." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10, marginBottom: 10 }}>
              <Field label="Site">
                <select value={previewSiteId} onChange={(e) => setPreviewSiteId(e.target.value)} style={textInput}>
                  {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Reset">
                <button onClick={() => setPreviewSelection({})} style={{ ...secondaryBtn, padding: '7px 8px', fontSize: 12 }}>
                  Defaults
                </button>
              </Field>
            </div>

            {draft.modifierGroupIds.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {draft.modifierGroupIds.map((gid) => {
                  const g = groups.find((gg) => gg.id === gid);
                  if (!g) return null;
                  const selected = previewSelection[gid] ?? g.options.find((o) => o.isDefault)?.id;
                  return (
                    <div key={gid}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        {g.name}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {g.options.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setPreviewSelection((p) => ({ ...p, [gid]: opt.id }))}
                            style={{
                              padding: '5px 10px', borderRadius: 100,
                              border: '1px solid ' + (selected === opt.id ? 'transparent' : 'var(--color-border-subtle)'),
                              background: selected === opt.id ? 'var(--color-accent-active)' : '#fff',
                              color: selected === opt.id ? '#fff' : 'var(--color-text-secondary)',
                              fontFamily: 'var(--font-primary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            {opt.name}
                            {opt.priceDelta != null && opt.priceDelta !== 0 && (
                              <span style={{ marginLeft: 4, opacity: 0.85 }}>
                                {opt.priceDelta > 0 ? '+' : ''}£{opt.priceDelta.toFixed(2)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resolved lines */}
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={11} /> Resolved order ({resolved.lines.length})
              </div>
              {resolved.lines.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  No ingredients resolved. Pick a default recipe or add slots/modifiers.
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {resolved.lines.map((ln) => (
                    <li key={ln.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, fontSize: 12, color: 'var(--color-text-primary)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ln.name}</span>
                      <span style={{ fontWeight: 700 }}>{ln.qty.value}{ln.qty.unit}</span>
                      <SourceBadge source={ln.source} />
                    </li>
                  ))}
                </ul>
              )}
              {resolved.warnings.length > 0 && (
                <div style={{ marginTop: 8, padding: 8, background: 'rgba(241,180,52,0.10)', borderRadius: 6, fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
                  {resolved.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
                </div>
              )}
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                <span>Price (with deltas)</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  £{((draft.basePrice ?? 0) + resolved.priceDelta).toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Recipe picker (for default recipe)

function RecipePicker({
  value, onChange, recipes,
}: {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  recipes: ReturnType<typeof useRecipes>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = value ? recipes.find((r) => r.id === value) : undefined;
  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return recipes
      .filter((r) => !needle || r.name.toLowerCase().includes(needle))
      .slice(0, 30);
  }, [recipes, q]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            flex: 1, textAlign: 'left',
            padding: '8px 10px', borderRadius: 7,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff', cursor: 'pointer',
            fontFamily: 'var(--font-primary)', fontSize: 13,
            color: current ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span>{current?.name ?? 'Pick a default recipe (optional)'}</span>
          <ChevronDown size={14} color="var(--color-text-muted)" />
        </button>
        {value && (
          <button
            onClick={() => onChange(undefined)}
            style={{ ...secondaryBtn, padding: '7px 12px', fontSize: 12.5 }}
            title="Make this menu item modifier-driven"
          >
            Clear
          </button>
        )}
      </div>
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60,
            background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8,
            boxShadow: '0 12px 32px rgba(3,15,58,0.12)',
            maxHeight: 320, overflow: 'auto',
          }}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipes…"
            style={{
              width: '100%', padding: '8px 10px',
              border: 'none', borderBottom: '1px solid var(--color-border-subtle)',
              outline: 'none', fontFamily: 'var(--font-primary)', fontSize: 12.5,
            }}
          />
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { onChange(r.id); setOpen(false); setQ(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 10px', border: 'none',
                background: '#fff', cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{r.name}</span>
              <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', fontWeight: 600 }}>{r.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Slot editor

function SlotEditor({
  slot, onPatch, onRemove,
}: {
  slot: MenuItemSlot;
  onPatch: (p: Partial<MenuItemSlot>) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 8, padding: 10, background: 'var(--color-bg-hover)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1fr 1.5fr 0.6fr 0.6fr auto', gap: 8, alignItems: 'end' }}>
        <Field label="Slot key">
          <input value={slot.key} onChange={(e) => onPatch({ key: e.target.value })} style={textInput} />
        </Field>
        <Field label="Label">
          <input value={slot.label} onChange={(e) => onPatch({ label: e.target.value })} style={textInput} />
        </Field>
        <Field label="Default ingredient (optional)">
          <SlotIngredientPicker value={slot.defaultRef} onChange={(ref) => onPatch({ defaultRef: ref })} />
        </Field>
        <Field label="Default qty">
          <input
            type="number" step="any"
            value={slot.defaultQty?.value ?? ''}
            onChange={(e) => onPatch({ defaultQty: e.target.value === '' ? undefined : { value: Number(e.target.value), unit: slot.defaultQty?.unit ?? 'ml' } })}
            style={textInput}
          />
        </Field>
        <Field label="Unit">
          <select
            value={slot.defaultQty?.unit ?? 'ml'}
            onChange={(e) => onPatch({ defaultQty: { value: slot.defaultQty?.value ?? 0, unit: e.target.value } })}
            style={textInput}
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <button onClick={onRemove} style={miniBtn(false)} title="Remove slot"><X size={12} /></button>
      </div>
    </div>
  );
}

function SlotIngredientPicker({
  value, onChange,
}: {
  value: IngredientRef | undefined;
  onChange: (ref: IngredientRef | undefined) => void;
}) {
  const { search, resolveRef } = useIngredientCatalogue();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const resolved = value ? resolveRef(value) : undefined;
  const results: IngredientCatalogueRow[] = search(q || resolved?.name || '', { limit: 20 });

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            flex: 1,
            padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border-subtle)',
            background: '#fff', cursor: 'pointer', textAlign: 'left',
            fontFamily: 'var(--font-primary)', fontSize: 12.5,
          }}
        >
          {resolved?.name ?? <span style={{ color: 'var(--color-text-muted)' }}>Pick…</span>}
        </button>
        {value && (
          <button onClick={() => onChange(undefined)} style={miniBtn(false)} title="Clear"><X size={12} /></button>
        )}
      </div>
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
            <div style={{ padding: 12, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>No matches</div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Modifier group multi-attach

function ModifierGroupPicker({
  attached, onToggle,
}: {
  attached: string[];
  onToggle: (gid: string) => void;
}) {
  const groups = useModifierGroups();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {groups.map((g) => {
        const on = attached.includes(g.id);
        return (
          <button
            key={g.id}
            onClick={() => onToggle(g.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid ' + (on ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'),
              background: on ? 'rgba(3,28,89,0.05)' : '#fff',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              textAlign: 'left',
              color: 'var(--color-text-primary)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{g.name}</span>
                {g.required && (
                  <span style={{
                    padding: '1px 7px', borderRadius: 100,
                    background: 'rgba(3,28,89,0.08)', color: 'var(--color-accent-active)',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
                  }}>Required</span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                {g.options.length} option{g.options.length === 1 ? '' : 's'}
                {g.notes && ` — ${g.notes}`}
              </div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: on ? 'var(--color-accent-active)' : 'var(--color-text-muted)' }}>
              {on ? 'Attached' : 'Attach'}
              {on ? <Check size={13} /> : <Plus size={13} />}
            </div>
          </button>
        );
      })}
      {groups.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12.5 }}>
          No modifier groups yet — create one in Manage modifier groups.
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Source badge (preview)

function SourceBadge({ source }: { source: ReturnType<typeof applyModifiers>['lines'][number]['source'] }) {
  const label =
    source.kind === 'recipe-base' ? 'Recipe' :
    source.kind === 'slot' ? `Slot ${source.slotKey}` :
    source.kind === 'modifier-add' ? '+ Mod' :
    source.kind === 'modifier-replace' ? '↔ Mod' :
    `× ${source.factor}`;
  const tone =
    source.kind === 'recipe-base' ? { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' } :
    source.kind === 'slot' ? { bg: 'rgba(155,172,216,0.20)', color: 'var(--color-accent-active)' } :
    { bg: 'rgba(3,28,89,0.08)', color: 'var(--color-accent-active)' };
  return (
    <span style={{
      padding: '1px 7px', borderRadius: 100,
      background: tone.bg, color: tone.color,
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>{label}</span>
  );
}

function pickerKindChip(kind: 'master' | 'supplier' | 'made'): React.CSSProperties {
  const tones: Record<typeof kind, { bg: string; color: string }> = {
    master:   { bg: 'rgba(3,28,89,0.08)', color: 'var(--color-accent-active)' },
    supplier: { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' },
    made:     { bg: 'rgba(241,180,52,0.16)', color: 'var(--color-warning)' },
  };
  const t = tones[kind];
  return {
    padding: '2px 7px', borderRadius: 100,
    background: t.bg, color: t.color,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Shared UI primitives

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--color-border-subtle)', background: '#fff' }}>
      {children}
    </div>
  );
}
function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 2 }}>{title}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{hint}</div>}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

const stickyHeader: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 50,
  margin: '-20px -24px 14px', padding: '12px 24px',
  background: 'rgba(255,255,255,0.96)',
  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  borderBottom: '1px solid var(--color-border-subtle)',
  display: 'flex', alignItems: 'center', gap: 14,
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
const textInput: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid var(--color-border-subtle)', background: '#fff',
  fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-text-primary)',
};
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 9, border: 'none',
  background: 'var(--color-accent-active)', color: '#fff',
  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 9,
  border: '1px solid var(--color-border)', background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
};
const dangerBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: '#fff',
  color: 'var(--color-error)',
  fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
};
const addBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px', borderRadius: 8,
  border: '1px dashed var(--color-border)', background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
  alignSelf: 'flex-start',
};
function miniBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 24, height: 24, padding: 0,
    borderRadius: 6, border: '1px solid var(--color-border-subtle)',
    background: '#fff', color: 'var(--color-text-secondary)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}
