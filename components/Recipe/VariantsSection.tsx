'use client';

/**
 * Variants section for the recipe editor.
 *
 * Variants are a named, mandatory dimension of a recipe — most commonly
 * Size (small / medium / large) but also temperature, dilution, etc.
 * The customer must pick exactly one option per dimension for the recipe
 * to be orderable.
 *
 * Variants are deliberately distinct from modifiers (optional one-to-one
 * changes) and slots (cross-recipe placeholders). Each variant option
 * may override:
 *   - per-ingredient quantities on `ingredientsV2`
 *   - the ref / qty of a `packagingV2` row (cup swap for large coffees)
 *   - per-channel prices
 *   - the POS source id (e.g. Square variation id)
 *
 * v1 caps dimensions at 2 per recipe (e.g. Size × Temperature). More
 * than that and the option grid stops being legible; we'd rather force
 * the user to think about whether the second axis is really a separate
 * recipe.
 */

import React, { useState } from 'react';
import {
  ChevronDown, ChevronRight, Plus, X, Copy, Check, Lock,
} from 'lucide-react';
import type {
  IngredientRefShape,
  RecipeIngredient,
  RecipeIngredientQty,
  RecipeVariantDimension,
  RecipeVariantOption,
  VariantIngredientOverride,
  VariantPackagingOverride,
} from './libraryFixtures';
import { IngredientRefPicker } from './IngredientRefPicker';
import { resolveIngredientRef } from '@/components/Ingredients/catalogue';

const MAX_DIMENSIONS = 2;
const UNITS = ['g', 'kg', 'ml', 'L', 'each', 'unit', 'slice', 'tsp', 'tbsp', 'cup'];

function newDimensionId(): string {
  return `vd-${Math.random().toString(36).slice(2, 8)}`;
}

function newOptionId(dimensionId: string): string {
  return `${dimensionId}-opt-${Math.random().toString(36).slice(2, 6)}`;
}

function copyIngredientOverridesFromBase(
  base: RecipeIngredient[],
): VariantIngredientOverride[] {
  return base.map((ri) => ({
    recipeIngredientId: ri.id,
    qty: { ...ri.baseQty },
  }));
}

export function VariantsSection({
  dimensions,
  baseIngredients,
  basePackaging,
  basePrices,
  onChange,
}: {
  dimensions: RecipeVariantDimension[];
  /** The recipe's base `ingredientsV2`. New options inherit these qtys. */
  baseIngredients: RecipeIngredient[];
  /** The recipe's base `packagingV2`. Used to render packaging swap rows. */
  basePackaging: RecipeIngredient[];
  /** The recipe's base per-channel prices. Shown as the fallback when a
   *  variant option doesn't override the channel. */
  basePrices: { dineIn: number; takeaway: number; delivery: number };
  onChange: (next: RecipeVariantDimension[]) => void;
}) {
  function addDimension() {
    if (dimensions.length >= MAX_DIMENSIONS) return;
    const id = newDimensionId();
    // Default to a Size dimension with three empty option slots — most
    // recipes want this and it's faster to delete options than to type
    // three names. Each option starts as a copy of the base qtys; the
    // user adjusts per-ingredient.
    const dim: RecipeVariantDimension = {
      id,
      name: dimensions.length === 0 ? 'Size' : 'Variant',
      options: [],
    };
    onChange([...dimensions, dim]);
  }

  function patchDimension(dimensionId: string, patch: Partial<RecipeVariantDimension>) {
    onChange(dimensions.map((d) => (d.id === dimensionId ? { ...d, ...patch } : d)));
  }

  function removeDimension(dimensionId: string) {
    onChange(dimensions.filter((d) => d.id !== dimensionId));
  }

  function addOption(dimensionId: string) {
    const dim = dimensions.find((d) => d.id === dimensionId);
    if (!dim) return;
    const optionId = newOptionId(dimensionId);
    const newOption: RecipeVariantOption = {
      id: optionId,
      name: `Option ${dim.options.length + 1}`,
      // Default to the first option being the default selection.
      isDefault: dim.options.length === 0,
      ingredientOverrides: copyIngredientOverridesFromBase(baseIngredients),
      packagingOverrides: [],
    };
    patchDimension(dimensionId, { options: [...dim.options, newOption] });
  }

  function patchOption(
    dimensionId: string,
    optionId: string,
    patch: Partial<RecipeVariantOption>,
  ) {
    const dim = dimensions.find((d) => d.id === dimensionId);
    if (!dim) return;
    patchDimension(dimensionId, {
      options: dim.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
    });
  }

  function removeOption(dimensionId: string, optionId: string) {
    const dim = dimensions.find((d) => d.id === dimensionId);
    if (!dim) return;
    patchDimension(dimensionId, {
      options: dim.options.filter((o) => o.id !== optionId),
    });
  }

  function setDefault(dimensionId: string, optionId: string) {
    const dim = dimensions.find((d) => d.id === dimensionId);
    if (!dim) return;
    patchDimension(dimensionId, {
      options: dim.options.map((o) => ({ ...o, isDefault: o.id === optionId })),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {dimensions.length === 0 && (
        <div
          style={{
            padding: '14px 16px', borderRadius: 10,
            background: 'var(--color-bg-hover)',
            fontSize: 12.5, color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          No variant dimensions yet. Variants are for size-like dimensions where
          the customer <em>must</em> pick one — small / medium / large, hot / iced, etc.
          Each option overrides per-ingredient quantities, packaging, and price.
        </div>
      )}

      {dimensions.map((dim) => (
        <DimensionBlock
          key={dim.id}
          dim={dim}
          baseIngredients={baseIngredients}
          basePackaging={basePackaging}
          basePrices={basePrices}
          onPatchDimension={(patch) => patchDimension(dim.id, patch)}
          onRemoveDimension={() => removeDimension(dim.id)}
          onAddOption={() => addOption(dim.id)}
          onPatchOption={(optionId, patch) => patchOption(dim.id, optionId, patch)}
          onRemoveOption={(optionId) => removeOption(dim.id, optionId)}
          onSetDefault={(optionId) => setDefault(dim.id, optionId)}
        />
      ))}

      <button
        type="button"
        onClick={addDimension}
        disabled={dimensions.length >= MAX_DIMENSIONS}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 8,
          border: '1px dashed var(--color-border)',
          background: '#fff',
          color: dimensions.length >= MAX_DIMENSIONS
            ? 'var(--color-text-muted)'
            : 'var(--color-text-secondary)',
          fontSize: 12.5, fontWeight: 600,
          cursor: dimensions.length >= MAX_DIMENSIONS ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-primary)',
          opacity: dimensions.length >= MAX_DIMENSIONS ? 0.6 : 1,
        }}
        title={dimensions.length >= MAX_DIMENSIONS
          ? 'Two variant dimensions per recipe is the v1 limit.'
          : undefined}
      >
        <Plus size={13} strokeWidth={2.4} />
        {dimensions.length === 0 ? 'Add variant dimension' : 'Add another dimension'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dimension block

function DimensionBlock({
  dim,
  baseIngredients,
  basePackaging,
  basePrices,
  onPatchDimension,
  onRemoveDimension,
  onAddOption,
  onPatchOption,
  onRemoveOption,
  onSetDefault,
}: {
  dim: RecipeVariantDimension;
  baseIngredients: RecipeIngredient[];
  basePackaging: RecipeIngredient[];
  basePrices: { dineIn: number; takeaway: number; delivery: number };
  onPatchDimension: (patch: Partial<RecipeVariantDimension>) => void;
  onRemoveDimension: () => void;
  onAddOption: () => void;
  onPatchOption: (optionId: string, patch: Partial<RecipeVariantOption>) => void;
  onRemoveOption: (optionId: string) => void;
  onSetDefault: (optionId: string) => void;
}) {
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(
    () => dim.options[0]?.id ?? null,
  );

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-hover)',
        padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={dim.name}
          onChange={(e) => onPatchDimension({ name: e.target.value })}
          placeholder="Dimension name (e.g. Size)"
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 8,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff', fontSize: 13.5, fontWeight: 600,
            fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onRemoveDimension}
          title="Remove dimension"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 10px', borderRadius: 8,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff', color: 'var(--color-text-secondary)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <X size={12} /> Remove
        </button>
      </div>

      {dim.options.length === 0 ? (
        <div
          style={{
            padding: '10px 12px', borderRadius: 8, background: '#fff',
            border: '1px dashed var(--color-border)',
            fontSize: 12.5, color: 'var(--color-text-muted)',
          }}
        >
          No options yet. Each option is a value of this dimension (e.g. Small,
          Medium, Large). The customer picks one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dim.options.map((opt) => (
            <OptionRow
              key={opt.id}
              option={opt}
              expanded={expandedOptionId === opt.id}
              baseIngredients={baseIngredients}
              basePackaging={basePackaging}
              basePrices={basePrices}
              onToggle={() =>
                setExpandedOptionId((prev) => (prev === opt.id ? null : opt.id))
              }
              onPatch={(patch) => onPatchOption(opt.id, patch)}
              onRemove={() => onRemoveOption(opt.id)}
              onSetDefault={() => onSetDefault(opt.id)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAddOption}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 11px', borderRadius: 100,
          border: '1px dashed var(--color-border)', background: '#fff',
          color: 'var(--color-text-secondary)',
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <Plus size={12} strokeWidth={2.4} /> Add option
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Option row (collapsed summary + expanded editor)

function OptionRow({
  option,
  expanded,
  baseIngredients,
  basePackaging,
  basePrices,
  onToggle,
  onPatch,
  onRemove,
  onSetDefault,
}: {
  option: RecipeVariantOption;
  expanded: boolean;
  baseIngredients: RecipeIngredient[];
  basePackaging: RecipeIngredient[];
  basePrices: { dineIn: number; takeaway: number; delivery: number };
  onToggle: () => void;
  onPatch: (patch: Partial<RecipeVariantOption>) => void;
  onRemove: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 10,
        border: '1px solid var(--color-border-subtle)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px',
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        {expanded
          ? <ChevronDown size={14} color="var(--color-text-muted)" />
          : <ChevronRight size={14} color="var(--color-text-muted)" />}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {option.name || <span style={{ color: 'var(--color-text-muted)' }}>(unnamed)</span>}
        </span>
        {option.isDefault && (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 100,
              background: 'rgba(3,28,89,0.08)', color: 'var(--color-accent-active)',
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
            }}
          >
            <Lock size={9} /> default
          </span>
        )}
        <span style={{ flex: 1 }} />
        <OptionSummary option={option} basePrices={basePrices} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove option"
          style={iconBtn}
        >
          <X size={12} />
        </button>
      </div>

      {expanded && (
        <div
          style={{
            padding: '12px 14px', borderTop: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-hover)',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}
        >
          {/* Name + default + POS id */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 220px', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <FieldLabelInline>Option name</FieldLabelInline>
              <input
                value={option.name}
                onChange={(e) => onPatch({ name: e.target.value })}
                placeholder="e.g. Small"
                style={inputStyle}
              />
            </div>
            <button
              type="button"
              onClick={onSetDefault}
              disabled={option.isDefault}
              style={{
                padding: '7px 11px', borderRadius: 8,
                border: '1px solid '
                  + (option.isDefault ? 'transparent' : 'var(--color-border-subtle)'),
                background: option.isDefault
                  ? 'rgba(3,28,89,0.08)'
                  : '#fff',
                color: option.isDefault
                  ? 'var(--color-accent-active)'
                  : 'var(--color-text-secondary)',
                fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: option.isDefault ? 'default' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}
              title="Pre-selected option for the customer. Exactly one default per dimension."
            >
              {option.isDefault ? <Check size={12} strokeWidth={2.6} /> : <Lock size={11} />}
              {option.isDefault ? 'Default option' : 'Make default'}
            </button>
            <div>
              <FieldLabelInline>POS source id</FieldLabelInline>
              <input
                value={option.posSourceId ?? ''}
                onChange={(e) => onPatch({ posSourceId: e.target.value || undefined })}
                placeholder="e.g. sq-var-small"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Ingredient overrides */}
          <IngredientOverridesEditor
            base={baseIngredients}
            overrides={option.ingredientOverrides}
            onChange={(next) => onPatch({ ingredientOverrides: next })}
          />

          {/* Packaging overrides */}
          <PackagingOverridesEditor
            base={basePackaging}
            overrides={option.packagingOverrides}
            onChange={(next) => onPatch({ packagingOverrides: next })}
          />

          {/* Price overrides */}
          <PriceOverridesEditor
            option={option}
            basePrices={basePrices}
            onPatch={onPatch}
          />
        </div>
      )}
    </div>
  );
}

function OptionSummary({
  option, basePrices,
}: {
  option: RecipeVariantOption;
  basePrices: { dineIn: number; takeaway: number; delivery: number };
}) {
  const overrideCount =
    option.ingredientOverrides.length + option.packagingOverrides.length;
  const priceLabel =
    option.priceDineIn != null
      ? `£${option.priceDineIn.toFixed(2)} dine-in`
      : `£${basePrices.dineIn.toFixed(2)} base`;
  return (
    <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontWeight: 500, display: 'inline-flex', gap: 8 }}>
      <span>{overrideCount} override{overrideCount === 1 ? '' : 's'}</span>
      <span>·</span>
      <span>{priceLabel}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingredient overrides editor

function IngredientOverridesEditor({
  base, overrides, onChange,
}: {
  base: RecipeIngredient[];
  overrides: VariantIngredientOverride[];
  onChange: (next: VariantIngredientOverride[]) => void;
}) {
  const overrideById = new Map(overrides.map((o) => [o.recipeIngredientId, o]));

  function setQty(recipeIngredientId: string, qty: RecipeIngredientQty) {
    const existing = overrideById.get(recipeIngredientId);
    if (existing) {
      onChange(overrides.map((o) =>
        o.recipeIngredientId === recipeIngredientId ? { ...o, qty } : o,
      ));
    } else {
      onChange([...overrides, { recipeIngredientId, qty }]);
    }
  }

  function toggleConstant(recipeIngredientId: string) {
    const existing = overrideById.get(recipeIngredientId);
    if (!existing) return;
    onChange(overrides.map((o) =>
      o.recipeIngredientId === recipeIngredientId
        ? { ...o, constant: !o.constant }
        : o,
    ));
  }

  function resetToBase() {
    onChange(copyIngredientOverridesFromBase(base));
  }

  function clearAll() {
    onChange([]);
  }

  if (base.length === 0) {
    return (
      <div>
        <FieldLabelInline>Ingredient quantities</FieldLabelInline>
        <div
          style={{
            padding: '10px 12px', borderRadius: 8, background: '#fff',
            border: '1px dashed var(--color-border)',
            fontSize: 12, color: 'var(--color-text-muted)',
          }}
        >
          No base ingredients yet. Add ingredients to the recipe first, then
          come back to override quantities here.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <FieldLabelInline noMargin>Ingredient quantities</FieldLabelInline>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={resetToBase} style={miniBtn} title="Copy current base quantities into this option's overrides.">
          <Copy size={11} /> Copy from base
        </button>
        <button type="button" onClick={clearAll} style={miniBtn} title="Remove all overrides — this option will use the base qtys.">
          Clear overrides
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {base.map((ri) => {
          const ov = overrideById.get(ri.id);
          const resolved = resolveIngredientRef(ri.ref);
          const displayQty = ov?.qty ?? ri.baseQty;
          return (
            <div
              key={ri.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 90px 110px 110px',
                gap: 8, alignItems: 'center',
                padding: '8px 10px', borderRadius: 8,
                background: '#fff', border: '1px solid var(--color-border-subtle)',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {resolved?.name ?? '(unknown ingredient)'}
                <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  base {ri.baseQty.value}{ri.baseQty.unit}
                </span>
              </span>
              <input
                type="number"
                value={displayQty.value}
                onChange={(e) => setQty(ri.id, {
                  value: Number(e.target.value),
                  unit: displayQty.unit,
                })}
                style={{ ...inputStyle, padding: '5px 8px', fontSize: 12 }}
              />
              <select
                value={displayQty.unit}
                onChange={(e) => setQty(ri.id, { value: displayQty.value, unit: e.target.value })}
                style={{ ...inputStyle, padding: '5px 8px', fontSize: 12 }}
              >
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <button
                type="button"
                onClick={() => toggleConstant(ri.id)}
                disabled={!ov}
                title={ov?.constant
                  ? 'Marked constant across variants — informational only.'
                  : 'Tag this override as "constant across variants" (e.g. coffee dose).'}
                style={{
                  padding: '5px 9px', borderRadius: 8,
                  border: '1px solid '
                    + (ov?.constant ? 'rgba(3,28,89,0.20)' : 'var(--color-border-subtle)'),
                  background: ov?.constant ? 'rgba(3,28,89,0.06)' : '#fff',
                  color: ov?.constant
                    ? 'var(--color-accent-active)'
                    : 'var(--color-text-secondary)',
                  fontSize: 11.5, fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: ov ? 'pointer' : 'not-allowed',
                  opacity: ov ? 1 : 0.5,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                {ov?.constant && <Check size={11} strokeWidth={2.6} />}
                {ov?.constant ? 'Constant' : 'Mark constant'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Packaging overrides editor

function PackagingOverridesEditor({
  base, overrides, onChange,
}: {
  base: RecipeIngredient[];
  overrides: VariantPackagingOverride[];
  onChange: (next: VariantPackagingOverride[]) => void;
}) {
  const overrideById = new Map(overrides.map((o) => [o.recipePackagingId, o]));

  function setRef(recipePackagingId: string, ref: IngredientRefShape) {
    const existing = overrideById.get(recipePackagingId);
    if (existing) {
      onChange(overrides.map((o) =>
        o.recipePackagingId === recipePackagingId ? { ...o, ref } : o,
      ));
    } else {
      onChange([...overrides, { recipePackagingId, ref }]);
    }
  }

  function clearSwap(recipePackagingId: string) {
    onChange(overrides.filter((o) => o.recipePackagingId !== recipePackagingId));
  }

  if (base.length === 0) return null;

  return (
    <div>
      <FieldLabelInline>Packaging swaps</FieldLabelInline>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {base.map((rp) => {
          const ov = overrideById.get(rp.id);
          const baseResolved = resolveIngredientRef(rp.ref);
          const swapResolved = ov ? resolveIngredientRef(ov.ref) : undefined;
          return (
            <div
              key={rp.id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto 1fr auto',
                gap: 10, alignItems: 'center',
                padding: '8px 10px', borderRadius: 8,
                background: '#fff', border: '1px solid var(--color-border-subtle)',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {baseResolved?.name ?? '(unknown packaging)'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>→</span>
              <div style={{ minWidth: 0 }}>
                <IngredientRefPicker
                  value={ov?.ref}
                  onChange={(ref) => setRef(rp.id, ref)}
                  placeholder={swapResolved?.name ?? 'Keep base packaging'}
                />
              </div>
              {ov ? (
                <button type="button" onClick={() => clearSwap(rp.id)} style={iconBtn} title="Revert to base packaging">
                  <X size={11} />
                </button>
              ) : <span />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Price overrides editor

function PriceOverridesEditor({
  option, basePrices, onPatch,
}: {
  option: RecipeVariantOption;
  basePrices: { dineIn: number; takeaway: number; delivery: number };
  onPatch: (patch: Partial<RecipeVariantOption>) => void;
}) {
  function set(channel: 'priceDineIn' | 'priceTakeaway' | 'priceDelivery', v: string) {
    if (v === '') {
      onPatch({ [channel]: undefined } as Partial<RecipeVariantOption>);
      return;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    onPatch({ [channel]: n } as Partial<RecipeVariantOption>);
  }

  return (
    <div>
      <FieldLabelInline>Price overrides <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(blank = base)</span></FieldLabelInline>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <PriceField
          label="Dine-in"
          value={option.priceDineIn}
          placeholder={basePrices.dineIn.toFixed(2)}
          onChange={(v) => set('priceDineIn', v)}
        />
        <PriceField
          label="Takeaway"
          value={option.priceTakeaway}
          placeholder={basePrices.takeaway.toFixed(2)}
          onChange={(v) => set('priceTakeaway', v)}
        />
        <PriceField
          label="Delivery"
          value={option.priceDelivery}
          placeholder={basePrices.delivery.toFixed(2)}
          onChange={(v) => set('priceDelivery', v)}
        />
      </div>
    </div>
  );
}

function PriceField({
  label, value, placeholder, onChange,
}: {
  label: string;
  value: number | undefined;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
          fontSize: 12, color: 'var(--color-text-muted)',
        }}>£</span>
        <input
          type="number"
          step="0.01"
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 22 }}
        />
      </div>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Local styles (kept here so the section is self-contained)

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 9px', borderRadius: 6,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  fontSize: 12.5, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
};

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 22, height: 22, borderRadius: 6,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff', color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

const miniBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 9px', borderRadius: 100,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff', color: 'var(--color-text-secondary)',
  fontSize: 11, fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

function FieldLabelInline({
  children, noMargin,
}: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div
      style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--color-text-muted)',
        marginBottom: noMargin ? 0 : 4,
      }}
    >
      {children}
    </div>
  );
}
