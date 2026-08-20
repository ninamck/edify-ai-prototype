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
 * — the field card, options list, effect editors, `IngredientRefPicker`s
 * — lives here.
 *
 * Effect model note: only `add` and `replace` effects can be created
 * from this UI. `scale` and `set-slot` still exist in the data model
 * (the seeded coffee-size / spirit / wine groups use them) so existing
 * effects of those kinds render read-compatibly with a "legacy" pill,
 * but there's no way to add new ones — they confused more than they
 * helped.
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
        <div style={{ marginTop: 12 }}>
          <Field label="Notes (optional)">
            <input
              value={value.notes ?? ''}
              onChange={(e) => patch('notes', e.target.value || undefined)}
              placeholder="What this group does"
              style={textInput}
            />
          </Field>
        </div>
        <PosIdDetails
          value={value.posSourceId}
          placeholder="e.g. pos-mg-milks"
          onChange={(v) => patch('posSourceId', v)}
        />
      </Card>

      <Card>
        <SectionHeader
          title="Options"
          hint="What the customer can pick — and what each pick changes in the recipe."
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
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 }}>
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
          placeholder="+$"
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

      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '24px 1fr', gap: 10 }}>
        <span />
        <div>
          <EffectsEditor effects={option.effects} onChange={onSetEffects} />
          {/* Per-option POS source id — Square / Toast give each modifier
              option its own id. Tucked away so it doesn't crowd the
              common path; auto-open when a value is already set. */}
          <PosIdDetails
            value={option.posSourceId}
            placeholder="e.g. pos-mg-milks-oat"
            onChange={(v) => onPatch({ posSourceId: v })}
          />
        </div>
      </div>
    </div>
  );
}

/** Short labels for each effect kind. The type is fixed when the effect
 *  is created (via the two buttons below) — no dropdown to re-pick it. */
const EFFECT_LABEL: Record<IngredientEffect['kind'], string> = {
  add: 'Adds',
  replace: 'Swaps',
  scale: 'Scales',
  'set-slot': 'Sets slot',
};

function EffectPill({ kind }: { kind: IngredientEffect['kind'] }) {
  const legacy = kind === 'scale' || kind === 'set-slot';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px', borderRadius: 100,
        background: 'rgba(0,28,53,0.06)', color: 'var(--color-text-secondary)',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
      }}
    >
      {EFFECT_LABEL[kind]}
      {legacy && <span style={{ fontWeight: 600, opacity: 0.6, textTransform: 'none', letterSpacing: 0 }}>legacy</span>}
    </span>
  );
}

function EffectsEditor({ effects, onChange }: { effects: IngredientEffect[]; onChange: (next: IngredientEffect[]) => void }) {
  function update(i: number, e: IngredientEffect) {
    onChange(effects.map((cur, idx) => (idx === i ? e : cur)));
  }
  function remove(i: number) {
    onChange(effects.filter((_, idx) => idx !== i));
  }
  // Only `add` and `replace` can be created here. Existing `scale` /
  // `set-slot` effects (from seeded groups) still render below.
  function addEffect(kind: 'add' | 'replace') {
    if (kind === 'add') {
      onChange([...effects, { kind: 'add', ref: { kind: 'master', masterProductId: '' }, qty: { value: 0, unit: 'ml' } }]);
    } else {
      onChange([...effects, { kind: 'replace', from: { kind: 'master', masterProductId: '' }, to: { kind: 'master', masterProductId: '' }, qtyMode: 'same' }]);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {effects.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          Changes nothing in the recipe.
        </div>
      )}
      {effects.map((e, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EffectPill kind={e.kind} />
            <button onClick={() => remove(i)} style={{ ...miniBtn(false), marginLeft: 'auto' }}><X size={12} /></button>
          </div>
          {e.kind === 'add' && <AddEffectEditor effect={e} onChange={(next) => update(i, next)} />}
          {e.kind === 'replace' && <ReplaceEffectEditor effect={e} onChange={(next) => update(i, next)} />}
          {e.kind === 'scale' && <ScaleEffectEditor effect={e} onChange={(next) => update(i, next)} />}
          {e.kind === 'set-slot' && <SetSlotEffectEditor effect={e} onChange={(next) => update(i, next)} />}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => addEffect('add')} style={addBtnSmall}><Plus size={11} /> Add an ingredient</button>
        <button onClick={() => addEffect('replace')} style={addBtnSmall}><Plus size={11} /> Swap an ingredient</button>
      </div>
    </div>
  );
}

function AddEffectEditor({ effect, onChange }: { effect: Extract<IngredientEffect, { kind: 'add' }>; onChange: (next: typeof effect) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px', gap: 8, alignItems: 'center' }}>
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
      <StyledSelect value={effect.qty.unit} onChange={(ev) => onChange({ ...effect, qty: { ...effect.qty, unit: ev.target.value } })}>
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
              style={{ ...textInput, width: 90 }}
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px', gap: 8 }}>
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

/**
 * Collapsed-by-default POS id field. The id matters for POS mapping but
 * crowds the common path, so it hides behind a small disclosure — open
 * automatically when a value is already set.
 */
function PosIdDetails({
  value,
  placeholder,
  onChange,
}: {
  value: string | undefined;
  placeholder: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <details open={!!value} style={{ marginTop: 8 }}>
      <summary
        style={{
          cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
          color: 'var(--color-text-muted)', userSelect: 'none',
        }}
      >
        POS id{value ? ` · ${value}` : ''}
      </summary>
      <div style={{ marginTop: 6, maxWidth: 320 }}>
        <input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={placeholder}
          style={textInput}
        />
      </div>
    </details>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared primitives (exported so the route page header and the drawer
// can use matching button styling without duplicating the rules).

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--color-border)', background: '#fff' }}>
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

// Matches StyledSelect's wrapper (38px tall, radius 8, --color-border)
// so text inputs, selects, and pickers line up at the same size.
export const textInput: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: '#fff',
  fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-text-primary)',
  boxSizing: 'border-box',
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
    borderRadius: 6, border: '1px solid var(--color-border)',
    background: '#fff', color: 'var(--color-text-secondary)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}
