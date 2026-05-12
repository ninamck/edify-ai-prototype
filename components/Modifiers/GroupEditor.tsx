'use client';

/**
 * Reusable body for editing a single ModifierGroup.
 *
 * This component owns NO storage and NO routing — callers pass in the
 * draft `value` and a controlled `onChange`. That way it can be hosted
 * by both:
 *   - the standalone route page `/modifier-groups/[id]/edit`
 *   - the inline slide-out drawer opened from the recipe editor's
 *     "POS & modifiers" card (`GroupEditorDrawer`).
 *
 * The two hosts differ only in chrome (sticky header / drawer header,
 * Used-by side panel vs. none, navigation behaviour). Everything inside
 * — the field card, options list, four effect editors, dropdowns,
 * `IngredientRefPicker`s — lives here.
 */

import React from 'react';
import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import { genOptionId } from '@/components/Modifiers/store';
import type {
  ModifierGroup,
  ModifierOption,
  IngredientEffect,
  Quantity,
} from '@/components/Modifiers/types';
import { IngredientRefPicker } from '@/components/Recipe/IngredientRefPicker';
import StyledSelect from '@/components/ui/StyledSelect';

const UNITS = ['g', 'kg', 'ml', 'L', 'each', 'unit'];

export function GroupEditor({
  value,
  onChange,
}: {
  value: ModifierGroup;
  onChange: (next: ModifierGroup) => void;
}) {
  function patch<K extends keyof ModifierGroup>(key: K, v: ModifierGroup[K]) {
    onChange({ ...value, [key]: v });
  }
  function patchOption(optId: string, p: Partial<ModifierOption>) {
    onChange({
      ...value,
      options: value.options.map((o) => (o.id === optId ? { ...o, ...p } : o)),
    });
  }
  function addOption() {
    const opt: ModifierOption = {
      id: genOptionId(value.id),
      name: 'New option',
      effects: [],
    };
    onChange({ ...value, options: [...value.options, opt] });
  }
  function removeOption(optId: string) {
    onChange({ ...value, options: value.options.filter((o) => o.id !== optId) });
  }
  function moveOption(optId: string, dir: -1 | 1) {
    const i = value.options.findIndex((o) => o.id === optId);
    const t = i + dir;
    if (i < 0 || t < 0 || t >= value.options.length) return;
    const next = [...value.options];
    [next[i], next[t]] = [next[t], next[i]];
    onChange({ ...value, options: next });
  }
  function setOptionEffects(optId: string, effects: IngredientEffect[]) {
    patchOption(optId, { effects });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: 14 }}>
          <Field label="Name">
            <input
              value={value.name}
              onChange={(e) => patch('name', e.target.value)}
              style={textInput}
            />
          </Field>
          <Field label="Selection">
            <StyledSelect
              value={value.selection}
              onChange={(e) => patch('selection', e.target.value as 'one' | 'many')}
            >
              <option value="one">Pick one</option>
              <option value="many">Pick many</option>
            </StyledSelect>
          </Field>
          <Field label="Required">
            <StyledSelect
              value={value.required ? 'yes' : 'no'}
              onChange={(e) => patch('required', e.target.value === 'yes')}
            >
              <option value="no">Optional</option>
              <option value="yes">Required</option>
            </StyledSelect>
          </Field>
        </div>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="POS source id (optional)">
            <input
              value={value.posSourceId ?? ''}
              onChange={(e) => patch('posSourceId', e.target.value || undefined)}
              placeholder="e.g. pos-mg-milks"
              style={textInput}
            />
          </Field>
          <Field label="Notes (optional)">
            <input
              value={value.notes ?? ''}
              onChange={(e) => patch('notes', e.target.value || undefined)}
              placeholder="What this group does"
              style={textInput}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Options"
          hint="Each option is a customer-facing pick. Effects describe what changes in the recipe at order time."
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {value.options.map((opt, i) => (
            <OptionEditor
              key={opt.id}
              index={i}
              total={value.options.length}
              option={opt}
              onPatch={(p) => patchOption(opt.id, p)}
              onSetEffects={(eff) => setOptionEffects(opt.id, eff)}
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
          No effects — this option is a no-op (used for &ldquo;default&rdquo; rows like &ldquo;Whole milk&rdquo; inside an Alt milk group).
        </div>
      )}
      {effects.map((e, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StyledSelect
              width={170}
              value={e.kind}
              onChange={(ev) => {
                const k = ev.target.value as IngredientEffect['kind'];
                if (k === e.kind) return;
                if (k === 'add') update(i, { kind: 'add', ref: { kind: 'master', masterProductId: '' }, qty: { value: 0, unit: 'ml' } });
                else if (k === 'replace') update(i, { kind: 'replace', from: { kind: 'master', masterProductId: '' }, to: { kind: 'master', masterProductId: '' }, qtyMode: 'same' });
                else if (k === 'scale') update(i, { kind: 'scale', factor: 1, targetMasterProductIds: [] });
                else if (k === 'set-slot') update(i, { kind: 'set-slot', slotKey: '', qty: { value: 0, unit: 'ml' } });
              }}
            >
              <option value="add">Add ingredient or packaging</option>
              <option value="replace">Replace ingredient or packaging</option>
              <option value="scale">Scale recipe</option>
              <option value="set-slot">Set slot (for shared groups)</option>
            </StyledSelect>
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
      <StyledSelect width={90} value={effect.qty.unit} onChange={(ev) => onChange({ ...effect, qty: { ...effect.qty, unit: ev.target.value } })}>
        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
      </StyledSelect>
    </div>
  );
}

function ReplaceEffectEditor({ effect, onChange }: { effect: Extract<IngredientEffect, { kind: 'replace' }>; onChange: (next: typeof effect) => void }) {
  const isSame = effect.qtyMode === 'same';
  const customQty: Quantity = effect.qtyMode === 'same' ? { value: 0, unit: 'ml' } : effect.qtyMode.qty;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
        Works on anything the recipe consumes — ingredients <em>and</em> packaging.
        e.g. whole milk → oat milk, or 8oz cup → 12oz cup for a Large coffee.
      </div>
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
            <StyledSelect
              width={90}
              value={customQty.unit}
              onChange={(ev) => onChange({ ...effect, qtyMode: { qty: { ...customQty, unit: ev.target.value } } })}
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </StyledSelect>
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
        <StyledSelect
          value={effect.qty?.unit ?? 'ml'}
          onChange={(ev) => onChange({ ...effect, qty: { value: effect.qty?.value ?? 0, unit: ev.target.value } })}
        >
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </StyledSelect>
      </Field>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared primitives (exported so the route page header and the drawer
// can use matching button styling without duplicating the rules).

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--color-border-subtle)', background: '#fff' }}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 2 }}>{title}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{hint}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles

export const textInput: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid var(--color-border-subtle)', background: '#fff',
  fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-text-primary)',
};
export const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 9, border: 'none',
  background: 'var(--color-accent-active)', color: '#fff',
  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
};
export const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 9,
  border: '1px solid var(--color-border)', background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
};
export const dangerBtn: React.CSSProperties = {
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
