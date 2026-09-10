'use client';

/**
 * Reusable body for editing a single ModifierGroup.
 *
 * This component owns NO storage and NO routing — callers pass in the
 * draft `value` and a controlled `onChange`. That way it can be hosted
 * by both:
 *   - the standalone route page `/modifier-groups/[id]/edit`
 *   - the inline slide-out drawer opened from the recipe editor
 *     (`GroupEditorDrawer`).
 *
 * Shape of the screen, top to bottom:
 *   1. Definition: name, then two pill choices (customer picks one /
 *      several; optional / required). That is the whole group.
 *   2. Options as one table: Option · Price · Recipe change · Default.
 *      The Recipe change cell is a plain sentence ("Whole Milk 1L → Oat
 *      Milk 1L"). Clicking it expands an editing row for that option
 *      only, so effect detail is on screen for one option at a time.
 *   3. Notes and POS ids in a collapsed section. POS ids also live in the
 *      POS matching area; they are kept here too so a group can be wired
 *      up without leaving the recipe.
 *
 * Effect model note: only `add` and `replace` effects can be created
 * from this UI. `scale` and `set-slot` still exist in the data model
 * (the seeded coffee-size / spirit / wine groups use them) so existing
 * effects of those kinds render read-compatibly with a "legacy" tag,
 * but there's no way to add new ones.
 *
 * Business rule enforced here: when the group is "pick one", only one
 * option can be the default. Switching a group from "several" to "one"
 * keeps the first default and clears the rest.
 */

import React, { useState } from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { genOptionId } from '@/components/Modifiers/store';
import type {
  ModifierGroup,
  ModifierOption,
  IngredientEffect,
  Quantity,
} from '@/components/Modifiers/types';
import { IngredientRefPicker } from '@/components/Recipe/IngredientRefPicker';
import { resolveIngredientRef, type IngredientRef } from '@/components/Ingredients/catalogue';
import StyledSelect from '@/components/ui/StyledSelect';

const UNITS = ['g', 'kg', 'ml', 'L', 'each', 'unit'];

// # · Option · Price · Recipe change · Default · actions
const OPTIONS_GRID = '28px minmax(160px, 1fr) 104px minmax(200px, 1.3fr) 72px 44px';

export function GroupEditor({
  value,
  onChange,
}: {
  value: ModifierGroup;
  onChange: (next: ModifierGroup) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function patch<K extends keyof ModifierGroup>(key: K, v: ModifierGroup[K]) {
    onChange({ ...value, [key]: v });
  }
  function setSelection(sel: 'one' | 'many') {
    if (sel === 'one') {
      // Only one default allowed in a pick-one group: keep the first.
      let seen = false;
      const options = value.options.map((o) => {
        if (!o.isDefault) return o;
        if (seen) return { ...o, isDefault: undefined };
        seen = true;
        return o;
      });
      onChange({ ...value, selection: sel, options });
      return;
    }
    onChange({ ...value, selection: sel });
  }
  function patchOption(optId: string, p: Partial<ModifierOption>) {
    onChange({
      ...value,
      options: value.options.map((o) => (o.id === optId ? { ...o, ...p } : o)),
    });
  }
  function setDefault(optId: string, on: boolean) {
    if (value.selection === 'one') {
      onChange({
        ...value,
        options: value.options.map((o) => ({ ...o, isDefault: o.id === optId && on ? true : undefined })),
      });
      return;
    }
    patchOption(optId, { isDefault: on || undefined });
  }
  function addOption() {
    const opt: ModifierOption = {
      id: genOptionId(value.id),
      name: '',
      effects: [],
    };
    onChange({ ...value, options: [...value.options, opt] });
  }
  function removeOption(optId: string) {
    if (expandedId === optId) setExpandedId(null);
    onChange({ ...value, options: value.options.filter((o) => o.id !== optId) });
  }
  function setOptionEffects(optId: string, effects: IngredientEffect[]) {
    patchOption(optId, { effects });
  }

  const posIdsSet = (value.posSourceId ? 1 : 0) + value.options.filter((o) => o.posSourceId).length;
  const posIdsTotal = 1 + value.options.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── 1. Definition ── */}
      <Card>
        <Field label="Name">
          <input
            value={value.name}
            onChange={(e) => patch('name', e.target.value)}
            placeholder="e.g. Alt milks"
            autoFocus={!value.name}
            style={{ ...textInput, fontSize: 15, fontWeight: 600, height: 42 }}
          />
        </Field>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 14 }}>
          <Field label="Customer picks">
            <Segmented
              ariaLabel="How many options the customer picks"
              value={value.selection}
              onChange={setSelection}
              options={[
                { value: 'one', label: 'One' },
                { value: 'many', label: 'Several' },
              ]}
            />
          </Field>
          <Field label="Choice is">
            <Segmented
              ariaLabel="Whether a choice is required"
              value={value.required ? 'yes' : 'no'}
              onChange={(v) => patch('required', v === 'yes')}
              options={[
                { value: 'no', label: 'Optional' },
                { value: 'yes', label: 'Required' },
              ]}
            />
          </Field>
        </div>
      </Card>

      {/* ── 2. Options ── */}
      <Card padded={false}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 10px' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', flex: 1 }}>
            Options
          </span>
          <button type="button" onClick={addOption} style={addBtn}>
            <Plus size={13} strokeWidth={2.4} /> Add option
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: OPTIONS_GRID }}>
          {/* Column headers */}
          <div style={colHead} />
          <div style={colHead}>Option</div>
          <div style={colHead}>Price</div>
          <div style={colHead}>Recipe change</div>
          <div style={{ ...colHead, textAlign: 'center' }}>Default</div>
          <div style={colHead} />

          {value.options.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '14px 16px', fontSize: 13, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-subtle)' }}>
              No options yet. Add the choices the customer will see at the till.
            </div>
          )}

          {value.options.map((opt, i) => {
            const expanded = expandedId === opt.id;
            return (
              <React.Fragment key={opt.id}>
                <OptionRow
                  index={i}
                  option={opt}
                  selection={value.selection}
                  expanded={expanded}
                  onPatch={(p) => patchOption(opt.id, p)}
                  onSetDefault={(on) => setDefault(opt.id, on)}
                  onToggleExpand={() => setExpandedId(expanded ? null : opt.id)}
                  onRemove={() => removeOption(opt.id)}
                />
                {expanded && (
                  <div style={expandedRowStyle}>
                    <EffectsEditor
                      optionName={opt.name || `Option ${i + 1}`}
                      effects={opt.effects}
                      onChange={(eff) => setOptionEffects(opt.id, eff)}
                      onDone={() => setExpandedId(null)}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      {/* ── 3. Notes and POS ids ── */}
      <Card padded={false}>
        <details>
          <summary style={detailsSummary}>
            <span style={{ flex: 1 }}>Notes and POS ids</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              {posIdsSet} of {posIdsTotal} POS ids set
            </span>
            <ChevronDown size={15} style={{ color: 'var(--color-text-muted)' }} />
          </summary>
          <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Notes">
              <input
                value={value.notes ?? ''}
                onChange={(e) => patch('notes', e.target.value || undefined)}
                placeholder="What this group is for, in a sentence"
                style={textInput}
              />
            </Field>
            <div>
              <div style={{ ...fieldLabel, marginBottom: 8 }}>POS ids</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', gap: '8px 12px', alignItems: 'center' }}>
                <span style={posRowLabel}>
                  {value.name.trim() || 'This group'} <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>(group)</span>
                </span>
                <input
                  value={value.posSourceId ?? ''}
                  onChange={(e) => patch('posSourceId', e.target.value || undefined)}
                  placeholder="e.g. pos-mg-milks"
                  aria-label="Group POS id"
                  style={{ ...textInput, height: 34, fontSize: 12.5 }}
                />
                {value.options.map((o, i) => (
                  <React.Fragment key={o.id}>
                    <span style={posRowLabel}>{o.name.trim() || `Option ${i + 1}`}</span>
                    <input
                      value={o.posSourceId ?? ''}
                      onChange={(e) => patchOption(o.id, { posSourceId: e.target.value || undefined })}
                      placeholder="e.g. pos-mg-milks-oat"
                      aria-label={`${o.name || `Option ${i + 1}`} POS id`}
                      style={{ ...textInput, height: 34, fontSize: 12.5 }}
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </details>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Option row

function OptionRow({
  index, option, selection, expanded,
  onPatch, onSetDefault, onToggleExpand, onRemove,
}: {
  index: number;
  option: ModifierOption;
  selection: 'one' | 'many';
  expanded: boolean;
  onPatch: (p: Partial<ModifierOption>) => void;
  onSetDefault: (on: boolean) => void;
  onToggleExpand: () => void;
  onRemove: () => void;
}) {
  const summary = describeEffects(option.effects);
  const hasChange = option.effects.length > 0;
  const rowBorder = expanded ? 'none' : undefined;
  const cell: React.CSSProperties = { ...rowCell, borderBottom: rowBorder };

  return (
    <>
      <div style={{ ...cell, justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 600 }}>
        {index + 1}
      </div>
      <div style={cell}>
        <input
          value={option.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="e.g. Oat milk"
          aria-label={`Option ${index + 1} name`}
          style={{ ...textInput, height: 36 }}
        />
      </div>
      <div style={cell}>
        <PriceInput
          value={option.priceDelta}
          onChange={(v) => onPatch({ priceDelta: v })}
          ariaLabel={`${option.name || `Option ${index + 1}`} price uplift`}
        />
      </div>
      <div style={cell}>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          title={expanded ? 'Hide recipe change' : 'Edit what this option changes in the recipe'}
          style={{
            flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center', gap: 8,
            height: 36, padding: '0 10px', borderRadius: 8,
            border: `1px solid ${expanded ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
            background: expanded ? 'var(--color-bg-hover)' : '#fff',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-primary)',
          }}
        >
          <span
            style={{
              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontSize: 13,
              fontWeight: hasChange ? 600 : 500,
              color: hasChange ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            }}
          >
            {summary}
          </span>
          {expanded ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
        </button>
      </div>
      <div style={{ ...cell, justifyContent: 'center' }}>
        <input
          type={selection === 'one' ? 'radio' : 'checkbox'}
          name={selection === 'one' ? 'modifier-default' : undefined}
          checked={!!option.isDefault}
          onChange={(e) => onSetDefault(e.target.checked)}
          onClick={(e) => {
            // Radios can't be un-ticked natively; allow clearing the default.
            if (selection === 'one' && option.isDefault) { e.preventDefault(); onSetDefault(false); }
          }}
          aria-label={`${option.name || `Option ${index + 1}`} is the default`}
          style={{ width: 18, height: 18, accentColor: 'var(--color-accent-active)', cursor: 'pointer', margin: 0 }}
        />
      </div>
      <div style={{ ...cell, justifyContent: 'flex-end', gap: 0, paddingRight: 8 }}>
        <button type="button" onClick={onRemove} aria-label={`Remove ${option.name || `option ${index + 1}`}`} style={ghostBtn(false)}><X size={13} /></button>
      </div>
    </>
  );
}

function PriceInput({
  value, onChange, ariaLabel,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  ariaLabel: string;
}) {
  const [focused, setFocused] = useState(false);
  // While typing, show the raw text; once blurred, show money format.
  const [text, setText] = useState('');
  const shown = focused ? text : (value === undefined ? '' : value.toFixed(2));
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', width: '100%', height: 36,
        border: `1px solid ${focused ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
        borderRadius: 8, background: '#fff', overflow: 'hidden',
      }}
    >
      <span style={{ padding: '0 0 0 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-muted)' }}>+£</span>
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        placeholder="0.00"
        aria-label={ariaLabel}
        onFocus={() => { setText(value === undefined ? '' : String(value)); setFocused(true); }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.]/g, '');
          setText(raw);
          const n = Number(raw);
          onChange(raw === '' || Number.isNaN(n) ? undefined : n);
        }}
        style={{
          flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none',
          padding: '0 8px 0 4px', background: 'transparent',
          fontFamily: 'var(--font-primary)', fontSize: 13,
          fontWeight: value ? 600 : 400,
          color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums',
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Effect summaries (the "Recipe change" cell)

function refLabel(ref: IngredientRef | undefined): string | null {
  if (!ref) return null;
  const isBlank =
    (ref.kind === 'master' && !ref.masterProductId) ||
    (ref.kind === 'product' && !ref.productId) ||
    (ref.kind === 'subrecipe' && !ref.recipeId);
  if (isBlank) return null;
  return resolveIngredientRef(ref)?.name ?? 'Unknown ingredient';
}

function fmtQty(q: Quantity | undefined): string {
  if (!q) return '';
  return `${q.value} ${q.unit}`;
}

export function describeEffect(e: IngredientEffect): string {
  switch (e.kind) {
    case 'add': {
      const name = refLabel(e.ref);
      return name ? `+ ${fmtQty(e.qty)} ${name}` : 'Adds: pick an ingredient';
    }
    case 'replace': {
      const from = refLabel(e.from);
      const to = refLabel(e.to);
      if (!from || !to) return 'Swaps: pick both ingredients';
      const qty = e.qtyMode === 'same' ? '' : ` (${fmtQty(e.qtyMode.qty)})`;
      return `${from} → ${to}${qty}`;
    }
    case 'scale':
      return `× ${e.factor} quantities`;
    case 'set-slot': {
      const parts = [e.slotKey || 'slot', '→', fmtQty(e.qty), refLabel(e.ref) ?? ''].filter(Boolean);
      return parts.join(' ');
    }
  }
}

function describeEffects(effects: IngredientEffect[]): string {
  if (effects.length === 0) return 'No change';
  if (effects.length === 1) return describeEffect(effects[0]);
  return `${describeEffect(effects[0])} +${effects.length - 1} more`;
}

// ────────────────────────────────────────────────────────────────────────────
// Effects editor (the expanded row)

const EFFECT_LABEL: Record<IngredientEffect['kind'], string> = {
  add: 'Adds',
  replace: 'Swaps',
  scale: 'Scales',
  'set-slot': 'Sets slot',
};

function EffectsEditor({
  optionName, effects, onChange, onDone,
}: {
  optionName: string;
  effects: IngredientEffect[];
  onChange: (next: IngredientEffect[]) => void;
  onDone: () => void;
}) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
        When the customer picks <strong style={{ color: 'var(--color-text-primary)' }}>{optionName}</strong>, the recipe:
      </div>

      {effects.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Stays the same. Add a change below if this option alters the build.
        </div>
      )}

      {effects.map((e, i) => {
        const legacy = e.kind === 'scale' || e.kind === 'set-slot';
        return (
          <div key={i} style={effectRow}>
            <span style={effectKind}>
              {EFFECT_LABEL[e.kind]}
              {legacy && <span style={{ marginLeft: 6, fontWeight: 500, opacity: 0.7, textTransform: 'none', letterSpacing: 0 }}>legacy</span>}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {e.kind === 'add' && <AddEffectEditor effect={e} onChange={(next) => update(i, next)} />}
              {e.kind === 'replace' && <ReplaceEffectEditor effect={e} onChange={(next) => update(i, next)} />}
              {e.kind === 'scale' && <ScaleEffectEditor effect={e} onChange={(next) => update(i, next)} />}
              {e.kind === 'set-slot' && <SetSlotEffectEditor effect={e} onChange={(next) => update(i, next)} />}
            </div>
            <button type="button" onClick={() => remove(i)} aria-label="Remove this change" style={ghostBtn(false)}><X size={13} /></button>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => addEffect('add')} style={addBtn}><Plus size={12} strokeWidth={2.4} /> Add an ingredient</button>
        <button type="button" onClick={() => addEffect('replace')} style={addBtn}><Plus size={12} strokeWidth={2.4} /> Swap an ingredient</button>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onDone} style={secondaryBtn}>Done</button>
      </div>
    </div>
  );
}

function AddEffectEditor({ effect, onChange }: { effect: Extract<IngredientEffect, { kind: 'add' }>; onChange: (next: typeof effect) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px 90px', gap: 8, alignItems: 'center' }}>
      <IngredientRefPicker
        value={effect.ref}
        onChange={(ref) => onChange({ ...effect, ref })}
        placeholder="Pick ingredient…"
      />
      <input
        type="number" step="any"
        value={effect.qty.value}
        aria-label="Quantity"
        onChange={(ev) => onChange({ ...effect, qty: { ...effect.qty, value: Number(ev.target.value) } })}
        style={textInput}
      />
      <StyledSelect aria-label="Unit" value={effect.qty.unit} onChange={(ev) => onChange({ ...effect, qty: { ...effect.qty, unit: ev.target.value } })}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: 8, alignItems: 'center' }}>
        <IngredientRefPicker value={effect.from} onChange={(from) => onChange({ ...effect, from })} placeholder="Ingredient in the recipe…" />
        <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>for</span>
        <IngredientRefPicker value={effect.to} onChange={(to) => onChange({ ...effect, to })} placeholder="Ingredient to use instead…" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
        <span>Quantity</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <input type="radio" checked={isSame} onChange={() => onChange({ ...effect, qtyMode: 'same' })} style={{ accentColor: 'var(--color-accent-active)' }} />
          Same as original
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <input type="radio" checked={!isSame} onChange={() => onChange({ ...effect, qtyMode: { qty: { value: 0, unit: 'ml' } } })} style={{ accentColor: 'var(--color-accent-active)' }} />
          Set to
        </label>
        {!isSame && (
          <>
            <input
              type="number" step="any"
              value={customQty.value}
              aria-label="Quantity"
              onChange={(ev) => onChange({ ...effect, qtyMode: { qty: { ...customQty, value: Number(ev.target.value) } } })}
              style={{ ...textInput, width: 90, height: 34 }}
            />
            <StyledSelect
              width={90}
              aria-label="Unit"
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>Multiply quantities by</span>
      <input
        type="number"
        step="0.01"
        value={effect.factor}
        aria-label="Scale factor"
        onChange={(e) => onChange({ ...effect, factor: Number(e.target.value) })}
        style={{ ...textInput, width: 80, height: 34 }}
      />
      <span style={{ color: 'var(--color-text-muted)' }}>
        {effect.targetMasterProductIds && effect.targetMasterProductIds.length > 0
          ? `for ${effect.targetMasterProductIds.join(', ')}`
          : 'across the whole recipe'}
      </span>
    </div>
  );
}

function SetSlotEffectEditor({ effect, onChange }: { effect: Extract<IngredientEffect, { kind: 'set-slot' }>; onChange: (next: typeof effect) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px 90px', gap: 8, alignItems: 'center' }}>
      <input
        value={effect.slotKey}
        aria-label="Slot key"
        onChange={(ev) => onChange({ ...effect, slotKey: ev.target.value })}
        placeholder="Slot, e.g. spirit"
        style={textInput}
      />
      <input
        type="number" step="any"
        value={effect.qty?.value ?? ''}
        aria-label="Quantity"
        onChange={(ev) => onChange({ ...effect, qty: { value: Number(ev.target.value), unit: effect.qty?.unit ?? 'ml' } })}
        style={textInput}
      />
      <StyledSelect
        aria-label="Unit"
        value={effect.qty?.unit ?? 'ml'}
        onChange={(ev) => onChange({ ...effect, qty: { value: effect.qty?.value ?? 0, unit: ev.target.value } })}
      >
        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
      </StyledSelect>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared primitives (exported so the route page header and the drawer
// can use matching button styling without duplicating the rules).

function Segmented<T extends string>({
  value, options, onChange, ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: 'flex', gap: 6 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            style={{
              padding: '8px 14px', borderRadius: 100,
              border: `1px solid ${on ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
              background: on ? 'var(--color-accent-active)' : '#fff',
              color: on ? '#fff' : 'var(--color-text-secondary)',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Card({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <div style={{ padding: padded ? 16 : 0, borderRadius: 12, border: '1px solid var(--color-border)', background: '#fff', overflow: 'hidden' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles

const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

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
  padding: '7px 12px', borderRadius: 100,
  border: '1px dashed var(--color-border)', background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
};
function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 28, height: 28, padding: 0,
    borderRadius: 6, border: 'none',
    background: 'transparent', color: 'var(--color-text-muted)',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}

const colHead: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  background: 'var(--color-bg-hover)',
  borderTop: '1px solid var(--color-border-subtle)',
  borderBottom: '1px solid var(--color-border-subtle)',
};

const rowCell: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 8px',
  minHeight: 52,
  minWidth: 0,
  borderBottom: '1px solid var(--color-border-subtle)',
};

const expandedRowStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  padding: '12px 16px 14px 44px',
  background: 'var(--color-bg-hover)',
  borderBottom: '1px solid var(--color-border-subtle)',
};

const effectRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  padding: '10px 10px 10px 12px', borderRadius: 8,
  background: '#fff', border: '1px solid var(--color-border-subtle)',
};

const effectKind: React.CSSProperties = {
  flexShrink: 0, minWidth: 56,
  paddingTop: 11,
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
};

const detailsSummary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '14px 16px', cursor: 'pointer', userSelect: 'none',
  fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)',
  listStyle: 'none',
};

const posRowLabel: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
