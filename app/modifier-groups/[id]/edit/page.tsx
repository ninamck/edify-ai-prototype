'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, X, Trash2, ArrowUp, ArrowDown,
  Check,
} from 'lucide-react';
import {
  useModifierGroups, upsertGroup, deleteGroup, genOptionId,
} from '@/components/Modifiers/store';
import type {
  ModifierGroup, ModifierOption, IngredientEffect, Quantity,
} from '@/components/Modifiers/types';
import { useMenuItems, menuItemsUsingGroup } from '@/components/MenuItems/store';
import {
  useIngredientCatalogue, type IngredientCatalogueRow,
} from '@/components/Ingredients/catalogue';

const UNITS = ['g', 'kg', 'ml', 'L', 'each', 'unit'];

export default function ModifierGroupEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const groups = useModifierGroups();
  const items = useMenuItems(); // subscribe so usedBy panel re-renders

  const original = useMemo(() => groups.find((g) => g.id === id) ?? null, [groups, id]);
  const [draft, setDraft] = useState<ModifierGroup | null>(() => original ? { ...original, options: original.options.map((o) => ({ ...o, effects: o.effects.map((e) => ({ ...e })) })) } : null);

  if (!original || !draft) {
    return (
      <div style={{ padding: 60, fontFamily: 'var(--font-primary)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Modifier group not found</h1>
        <button onClick={() => router.push('/modifier-groups')} style={primaryBtn}>Back to modifier groups</button>
      </div>
    );
  }

  const usedBy = menuItemsUsingGroup(original.id);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(original);
  // Local non-null aliases so handlers below don't have to keep narrowing.
  const draftSafe = draft as ModifierGroup;
  const originalSafe = original as ModifierGroup;

  function patch<K extends keyof ModifierGroup>(key: K, value: ModifierGroup[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  function patchOption(optId: string, p: Partial<ModifierOption>) {
    setDraft((d) => d ? { ...d, options: d.options.map((o) => o.id === optId ? { ...o, ...p } : o) } : d);
  }
  function addOption() {
    setDraft((d) => {
      if (!d) return d;
      const opt: ModifierOption = { id: genOptionId(d.id), name: 'New option', effects: [] };
      return { ...d, options: [...d.options, opt] };
    });
  }
  function removeOption(optId: string) {
    setDraft((d) => d ? { ...d, options: d.options.filter((o) => o.id !== optId) } : d);
  }
  function moveOption(optId: string, dir: -1 | 1) {
    setDraft((d) => {
      if (!d) return d;
      const i = d.options.findIndex((o) => o.id === optId);
      const t = i + dir;
      if (i < 0 || t < 0 || t >= d.options.length) return d;
      const next = [...d.options];
      [next[i], next[t]] = [next[t], next[i]];
      return { ...d, options: next };
    });
  }
  function setEffects(optId: string, effects: IngredientEffect[]) {
    patchOption(optId, { effects });
  }

  function handleSave() {
    if (!draftSafe.name.trim()) return;
    upsertGroup(draftSafe);
    router.push('/modifier-groups');
  }
  function handleDelete() {
    if (usedBy.length > 0) {
      alert(`Can't delete — used by ${usedBy.length} menu item${usedBy.length === 1 ? '' : 's'}. Detach from those first.`);
      return;
    }
    if (!confirm(`Delete modifier group "${originalSafe.name}"?`)) return;
    deleteGroup(originalSafe.id);
    router.push('/modifier-groups');
  }

  return (
    <div style={{ padding: '20px 24px 130px', maxWidth: 1180, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Sticky header */}
      <div style={stickyHeader}>
        <button onClick={() => router.push('/modifier-groups')} style={{ ...secondaryBtn, padding: '7px 12px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: 14 }}>
              <Field label="Name">
                <input
                  value={draft.name}
                  onChange={(e) => patch('name', e.target.value)}
                  style={textInput}
                />
              </Field>
              <Field label="Selection">
                <select value={draft.selection} onChange={(e) => patch('selection', e.target.value as 'one' | 'many')} style={textInput}>
                  <option value="one">Pick one</option>
                  <option value="many">Pick many</option>
                </select>
              </Field>
              <Field label="Required">
                <select value={draft.required ? 'yes' : 'no'} onChange={(e) => patch('required', e.target.value === 'yes')} style={textInput}>
                  <option value="no">Optional</option>
                  <option value="yes">Required</option>
                </select>
              </Field>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="POS source id (optional)">
                <input
                  value={draft.posSourceId ?? ''}
                  onChange={(e) => patch('posSourceId', e.target.value || undefined)}
                  placeholder="e.g. pos-mg-milks"
                  style={textInput}
                />
              </Field>
              <Field label="Notes (optional)">
                <input
                  value={draft.notes ?? ''}
                  onChange={(e) => patch('notes', e.target.value || undefined)}
                  placeholder="What this group does"
                  style={textInput}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Options" hint="Each option is a customer-facing pick. Effects describe what changes in the recipe at order time." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {draft.options.map((opt, i) => (
                <OptionEditor
                  key={opt.id}
                  index={i}
                  total={draft.options.length}
                  option={opt}
                  onPatch={(p) => patchOption(opt.id, p)}
                  onSetEffects={(eff) => setEffects(opt.id, eff)}
                  onRemove={() => removeOption(opt.id)}
                  onMoveUp={() => moveOption(opt.id, -1)}
                  onMoveDown={() => moveOption(opt.id, 1)}
                />
              ))}
              <button onClick={addOption} style={addBtn}>
                <Plus size={13} strokeWidth={2.2} /> Add option
              </button>
            </div>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 100, alignSelf: 'start' }}>
          <Card>
            <SectionHeader title="Used by menu items" />
            {usedBy.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                Not yet attached to any menu item. Open a menu item editor and attach this group there.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {usedBy.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => router.push(`/menu-items/${m.id}/edit`)}
                      style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border-subtle)',
                        background: '#fff', cursor: 'pointer', fontFamily: 'var(--font-primary)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{m.category}</span>
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

// ────────────────────────────────────────────────────────────────────────────
// Option editor

function OptionEditor({
  index, total, option, onPatch, onSetEffects, onRemove, onMoveUp, onMoveDown,
}: {
  index: number;
  total: number;
  option: ModifierOption;
  onPatch: (p: Partial<ModifierOption>) => void;
  onSetEffects: (eff: IngredientEffect[]) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 10, padding: 12, background: 'var(--color-bg-hover)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 110px 110px auto', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center' }}>{index + 1}</span>
        <input
          value={option.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Option name (e.g. Oat milk)"
          style={textInput}
        />
        <input
          type="number"
          step="0.01"
          value={option.priceDelta ?? ''}
          onChange={(e) => onPatch({ priceDelta: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="+£"
          style={textInput}
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <input
            type="checkbox"
            checked={!!option.isDefault}
            onChange={(e) => onPatch({ isDefault: e.target.checked || undefined })}
          />
          Default
        </label>
        <span style={{ display: 'inline-flex', gap: 2, justifyContent: 'flex-end' }}>
          <button onClick={onMoveUp} disabled={index === 0} style={miniBtn(index === 0)}><ArrowUp size={12} /></button>
          <button onClick={onMoveDown} disabled={index === total - 1} style={miniBtn(index === total - 1)}><ArrowDown size={12} /></button>
          <button onClick={onRemove} style={miniBtn(false)}><X size={12} /></button>
        </span>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 }}>
          Effects
        </div>
        <EffectsEditor effects={option.effects} onChange={onSetEffects} />
      </div>
    </div>
  );
}

function EffectsEditor({ effects, onChange }: { effects: IngredientEffect[]; onChange: (next: IngredientEffect[]) => void }) {
  function update(i: number, e: IngredientEffect) {
    onChange(effects.map((cur, idx) => (idx === i ? e : cur)));
  }
  function remove(i: number) {
    onChange(effects.filter((_, idx) => idx !== i));
  }
  function addEffect(kind: IngredientEffect['kind']) {
    if (kind === 'add') {
      onChange([...effects, { kind: 'add', ref: { kind: 'master', masterProductId: '' }, qty: { value: 0, unit: 'ml' } }]);
    } else if (kind === 'replace') {
      onChange([...effects, { kind: 'replace', from: { kind: 'master', masterProductId: '' }, to: { kind: 'master', masterProductId: '' }, qtyMode: 'same' }]);
    } else if (kind === 'scale') {
      onChange([...effects, { kind: 'scale', factor: 1, targetMasterProductIds: [] }]);
    } else if (kind === 'set-slot') {
      onChange([...effects, { kind: 'set-slot', slotKey: '', qty: { value: 0, unit: 'ml' } }]);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {effects.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          No effects — this option is a no-op (used for "default" rows like "Whole milk" inside an Alt milk group).
        </div>
      )}
      {effects.map((e, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={e.kind}
              onChange={(ev) => {
                const k = ev.target.value as IngredientEffect['kind'];
                if (k === e.kind) return;
                if (k === 'add') update(i, { kind: 'add', ref: { kind: 'master', masterProductId: '' }, qty: { value: 0, unit: 'ml' } });
                else if (k === 'replace') update(i, { kind: 'replace', from: { kind: 'master', masterProductId: '' }, to: { kind: 'master', masterProductId: '' }, qtyMode: 'same' });
                else if (k === 'scale') update(i, { kind: 'scale', factor: 1, targetMasterProductIds: [] });
                else if (k === 'set-slot') update(i, { kind: 'set-slot', slotKey: '', qty: { value: 0, unit: 'ml' } });
              }}
              style={{ ...textInput, width: 140 }}
            >
              <option value="add">Add ingredient</option>
              <option value="replace">Replace ingredient</option>
              <option value="scale">Scale recipe</option>
              <option value="set-slot">Set slot (for shared groups)</option>
            </select>
            <button onClick={() => remove(i)} style={{ ...miniBtn(false), marginLeft: 'auto' }}><X size={12} /></button>
          </div>
          {e.kind === 'add' && <AddEffectEditor effect={e} onChange={(next) => update(i, next)} />}
          {e.kind === 'replace' && <ReplaceEffectEditor effect={e} onChange={(next) => update(i, next)} />}
          {e.kind === 'scale' && <ScaleEffectEditor effect={e} onChange={(next) => update(i, next)} />}
          {e.kind === 'set-slot' && <SetSlotEffectEditor effect={e} onChange={(next) => update(i, next)} />}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => addEffect('add')} style={addBtnSmall}><Plus size={11} /> Add</button>
        <button onClick={() => addEffect('replace')} style={addBtnSmall}><Plus size={11} /> Replace</button>
        <button onClick={() => addEffect('scale')} style={addBtnSmall}><Plus size={11} /> Scale</button>
        <button onClick={() => addEffect('set-slot')} style={addBtnSmall}><Plus size={11} /> Set slot</button>
      </div>
    </div>
  );
}

function AddEffectEditor({ effect, onChange }: { effect: Extract<IngredientEffect, { kind: 'add' }>; onChange: (next: typeof effect) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px', gap: 8 }}>
      <IngredientRefPicker
        value={effect.ref}
        onChange={(ref) => onChange({ ...effect, ref })}
      />
      <input
        type="number" step="any"
        value={effect.qty.value}
        onChange={(ev) => onChange({ ...effect, qty: { ...effect.qty, value: Number(ev.target.value) } })}
        style={textInput}
      />
      <select value={effect.qty.unit} onChange={(ev) => onChange({ ...effect, qty: { ...effect.qty, unit: ev.target.value } })} style={textInput}>
        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  );
}

function ReplaceEffectEditor({ effect, onChange }: { effect: Extract<IngredientEffect, { kind: 'replace' }>; onChange: (next: typeof effect) => void }) {
  const isSame = effect.qtyMode === 'same';
  const customQty: Quantity = effect.qtyMode === 'same' ? { value: 0, unit: 'ml' } : effect.qtyMode.qty;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Field label="Replace">
        <IngredientRefPicker value={effect.from} onChange={(from) => onChange({ ...effect, from })} />
      </Field>
      <Field label="With">
        <IngredientRefPicker value={effect.to} onChange={(to) => onChange({ ...effect, to })} />
      </Field>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
        <span>Quantity:</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input
            type="radio"
            checked={isSame}
            onChange={() => onChange({ ...effect, qtyMode: 'same' })}
          />
          Same as original
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input
            type="radio"
            checked={!isSame}
            onChange={() => onChange({ ...effect, qtyMode: { qty: { value: 0, unit: 'ml' } } })}
          />
          Custom:
        </label>
        {!isSame && (
          <>
            <input
              type="number" step="any"
              value={customQty.value}
              onChange={(ev) => onChange({ ...effect, qtyMode: { qty: { ...customQty, value: Number(ev.target.value) } } })}
              style={{ ...textInput, width: 80 }}
            />
            <select
              value={customQty.unit}
              onChange={(ev) => onChange({ ...effect, qtyMode: { qty: { ...customQty, unit: ev.target.value } } })}
              style={{ ...textInput, width: 80 }}
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </>
        )}
      </div>
    </div>
  );
}

function ScaleEffectEditor({ effect, onChange }: { effect: Extract<IngredientEffect, { kind: 'scale' }>; onChange: (next: typeof effect) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>Multiply quantities by</span>
        <input
          type="number"
          step="0.01"
          value={effect.factor}
          onChange={(e) => onChange({ ...effect, factor: Number(e.target.value) })}
          style={{ ...textInput, width: 80 }}
        />
      </div>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 11.5 }}>
        Targets: {effect.targetMasterProductIds && effect.targetMasterProductIds.length > 0
          ? effect.targetMasterProductIds.join(', ')
          : 'whole recipe'}
        <span style={{ marginLeft: 8, fontStyle: 'italic' }}>
          (Master-product targeting editor coming next; today scales the whole recipe unless seeded with ids.)
        </span>
      </div>
    </div>
  );
}

function SetSlotEffectEditor({ effect, onChange }: { effect: Extract<IngredientEffect, { kind: 'set-slot' }>; onChange: (next: typeof effect) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px', gap: 8 }}>
      <Field label="Slot key">
        <input
          value={effect.slotKey}
          onChange={(ev) => onChange({ ...effect, slotKey: ev.target.value })}
          placeholder="e.g. spirit, wine"
          style={textInput}
        />
      </Field>
      <Field label="Qty">
        <input
          type="number" step="any"
          value={effect.qty?.value ?? ''}
          onChange={(ev) => onChange({ ...effect, qty: { value: Number(ev.target.value), unit: effect.qty?.unit ?? 'ml' } })}
          style={textInput}
        />
      </Field>
      <Field label="Unit">
        <select
          value={effect.qty?.unit ?? 'ml'}
          onChange={(ev) => onChange({ ...effect, qty: { value: effect.qty?.value ?? 0, unit: ev.target.value } })}
          style={textInput}
        >
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </Field>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Lightweight ingredient ref picker — used inside effect editors

function IngredientRefPicker({
  value, onChange,
}: {
  value: { kind: 'master'; masterProductId: string } | { kind: 'product'; productId: string };
  onChange: (ref: typeof value) => void;
}) {
  const { search, resolveRef } = useIngredientCatalogue();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const resolved = resolveRef(value);
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
        {resolved?.name ?? <span style={{ color: 'var(--color-text-muted)' }}>Pick ingredient…</span>}
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
const addBtnSmall: React.CSSProperties = {
  ...addBtn, padding: '5px 9px', fontSize: 11.5,
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
