'use client';

/**
 * Variants section for the recipe editor — matrix view.
 *
 * Mental model: a recipe with variants is essentially a small
 * spreadsheet. Rows are the ingredients / packaging items / modifier
 * groups the recipe uses; columns are the variants (Small, Medium,
 * Large). Cells say "in this variant, this thing has this qty (or is
 * attached / not)".
 *
 * This is intentionally *one* surface for the composition of all
 * variants — no per-variant repetition of the full ingredient list,
 * no nested cards. When variants exist, the page hides its base
 * Ingredients / Packaging / POS-and-modifiers cards because the
 * matrix is the source of truth for what fires per variant.
 *
 * Alignment is by position (row i = ith ingredient of each variant).
 * "+ Add ingredient" appends a row to ALL variants seeded with the
 * picked ref + qty 0; the user then types qty per cell. Per-cell
 * remove drops the ingredient from a single variant; per-row remove
 * drops it everywhere.
 *
 * Differs-from-others highlighting: cells whose qty (or ref) doesn't
 * match the other cells in the same row get a tinted background so
 * the eye lands on real variation, not on the cells that are just
 * copies of each other.
 */

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, X, Check, Lock, Pencil, Copy, MoreHorizontal,
} from 'lucide-react';
import type {
  RecipeIngredient,
  RecipeIngredientQty,
  RecipeVariant,
} from './libraryFixtures';
import {
  resolveIngredientRef,
  type IngredientRef,
} from '@/components/Ingredients/catalogue';
import { IngredientRefPicker } from './IngredientRefPicker';
import { useModifierGroups } from '@/components/Modifiers/store';
import type { ModifierGroup } from '@/components/Modifiers/types';
import { GroupEditorDrawer } from '@/components/Modifiers/GroupEditorDrawer';

const UNITS = ['g', 'kg', 'ml', 'L', 'each', 'unit', 'slice', 'tsp', 'tbsp', 'cup'];

function newVariantId(): string {
  return `var-${Math.random().toString(36).slice(2, 8)}`;
}
function newRowId(): string {
  return `ri-${Math.random().toString(36).slice(2, 8)}`;
}
function cloneIngredient(ri: RecipeIngredient): RecipeIngredient {
  return {
    ...ri,
    id: newRowId(),
    baseQty: { ...ri.baseQty },
    siteOverrides: ri.siteOverrides ? { ...ri.siteOverrides } : undefined,
    tags: ri.tags ? [...ri.tags] : undefined,
  };
}

function refKey(ref: IngredientRef): string {
  if (ref.kind === 'master') return `m:${ref.masterProductId}`;
  if (ref.kind === 'product') return `p:${ref.productId}`;
  return `s:${ref.recipeId}`;
}
function refName(ref: IngredientRef): string {
  return resolveIngredientRef(ref)?.name ?? '(unknown)';
}

/** True when these cells don't all describe the same thing — used to
 *  visually flag rows where variants actually vary. */
function rowVaries(
  cells: Array<{ ref: IngredientRef; qty: RecipeIngredientQty } | undefined>,
): boolean {
  const filled = cells.filter((c): c is { ref: IngredientRef; qty: RecipeIngredientQty } => !!c);
  if (filled.length <= 1) return false;
  const first = filled[0];
  for (let i = 1; i < filled.length; i++) {
    if (refKey(filled[i].ref) !== refKey(first.ref)) return true;
    if (filled[i].qty.value !== first.qty.value) return true;
    if (filled[i].qty.unit !== first.qty.unit) return true;
  }
  // Also "varies" when one variant has the row and another doesn't.
  return cells.some((c) => !c);
}

export function VariantsSection({
  variants,
  baseIngredients,
  basePackaging,
  baseModifierGroupIds,
  basePrices,
  onChange,
}: {
  variants: RecipeVariant[];
  /** Used to seed the very first variant (and as the fallback for
   *  picking a default new-ingredient unit). */
  baseIngredients: RecipeIngredient[];
  basePackaging: RecipeIngredient[];
  baseModifierGroupIds: string[];
  basePrices: { dineIn: number; takeaway: number; delivery: number };
  onChange: (next: RecipeVariant[]) => void;
}) {
  function addVariant() {
    const name = suggestVariantName(variants);
    let next: RecipeVariant;
    if (variants.length === 0) {
      // First variant: seed from the recipe's base composition so the
      // matrix has the same rows the user already typed into the base
      // cards above. After that, base is unused (cards hide).
      next = {
        id: newVariantId(),
        name,
        isDefault: true,
        ingredients: baseIngredients.map(cloneIngredient),
        packaging: basePackaging.map(cloneIngredient),
        modifierGroupIds: [...baseModifierGroupIds],
        priceDineIn: basePrices.dineIn || undefined,
        priceTakeaway: basePrices.takeaway || undefined,
        priceDelivery: basePrices.delivery || undefined,
      };
    } else {
      // Subsequent variants seed from the FIRST existing variant so
      // rows stay aligned by position in the matrix.
      const template = variants[0];
      next = {
        id: newVariantId(),
        name,
        ingredients: template.ingredients.map(cloneIngredient),
        packaging: template.packaging.map(cloneIngredient),
        modifierGroupIds: [...template.modifierGroupIds],
        priceDineIn: template.priceDineIn,
        priceTakeaway: template.priceTakeaway,
        priceDelivery: template.priceDelivery,
      };
    }
    onChange([...variants, next]);
  }

  function duplicateVariant(id: string) {
    const src = variants.find((v) => v.id === id);
    if (!src) return;
    const copy: RecipeVariant = {
      ...src,
      id: newVariantId(),
      name: `${src.name} (copy)`,
      isDefault: false,
      ingredients: src.ingredients.map(cloneIngredient),
      packaging: src.packaging.map(cloneIngredient),
      modifierGroupIds: [...src.modifierGroupIds],
    };
    onChange([...variants, copy]);
  }

  function patchVariant(id: string, patch: Partial<RecipeVariant>) {
    onChange(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  function removeVariant(id: string) {
    const removed = variants.find((v) => v.id === id);
    const next = variants.filter((v) => v.id !== id);
    if (removed?.isDefault && next.length > 0) {
      next[0] = { ...next[0], isDefault: true };
    }
    onChange(next);
  }

  function setDefault(id: string) {
    onChange(variants.map((v) => ({ ...v, isDefault: v.id === id })));
  }

  // ── Row mutations (Ingredients) ───────────────────────────────────────────

  function addIngredientRow(ref: IngredientRef) {
    const resolved = resolveIngredientRef(ref);
    const unit = resolved?.unit ?? 'g';
    onChange(variants.map((v) => ({
      ...v,
      ingredients: [
        ...v.ingredients,
        { id: newRowId(), ref, baseQty: { value: 0, unit } },
      ],
    })));
  }

  function patchIngredientCell(
    variantId: string,
    rowIndex: number,
    patch: Partial<{ ref: IngredientRef; value: number; unit: string }>,
  ) {
    onChange(variants.map((v) => {
      if (v.id !== variantId) return v;
      const ing = v.ingredients[rowIndex];
      if (!ing) return v;
      const updated: RecipeIngredient = {
        ...ing,
        ref: patch.ref ?? ing.ref,
        baseQty: {
          value: patch.value ?? ing.baseQty.value,
          unit: patch.unit ?? ing.baseQty.unit,
        },
      };
      const nextIngs = [...v.ingredients];
      nextIngs[rowIndex] = updated;
      return { ...v, ingredients: nextIngs };
    }));
  }

  function removeIngredientRow(rowIndex: number) {
    onChange(variants.map((v) => ({
      ...v,
      ingredients: v.ingredients.filter((_, i) => i !== rowIndex),
    })));
  }

  function clearIngredientCell(variantId: string, rowIndex: number) {
    // "Not in this variant" — we mark by removing the row only from
    // this variant. To keep alignment we'd need a placeholder; instead
    // we leave a placeholder ref with qty 0 so the row still aligns
    // and the cell renders as "—".
    onChange(variants.map((v) => {
      if (v.id !== variantId) return v;
      const ing = v.ingredients[rowIndex];
      if (!ing) return v;
      const nextIngs = [...v.ingredients];
      nextIngs[rowIndex] = { ...ing, baseQty: { value: 0, unit: ing.baseQty.unit } };
      return { ...v, ingredients: nextIngs };
    }));
  }

  // ── Row mutations (Packaging) ─────────────────────────────────────────────

  function addPackagingRow(ref: IngredientRef) {
    const resolved = resolveIngredientRef(ref);
    const unit = resolved?.unit ?? 'each';
    onChange(variants.map((v) => ({
      ...v,
      packaging: [
        ...v.packaging,
        { id: newRowId(), ref, baseQty: { value: 1, unit } },
      ],
    })));
  }

  function patchPackagingCell(
    variantId: string,
    rowIndex: number,
    patch: Partial<{ ref: IngredientRef; value: number; unit: string }>,
  ) {
    onChange(variants.map((v) => {
      if (v.id !== variantId) return v;
      const ing = v.packaging[rowIndex];
      if (!ing) return v;
      const updated: RecipeIngredient = {
        ...ing,
        ref: patch.ref ?? ing.ref,
        baseQty: {
          value: patch.value ?? ing.baseQty.value,
          unit: patch.unit ?? ing.baseQty.unit,
        },
      };
      const next = [...v.packaging];
      next[rowIndex] = updated;
      return { ...v, packaging: next };
    }));
  }

  function removePackagingRow(rowIndex: number) {
    onChange(variants.map((v) => ({
      ...v,
      packaging: v.packaging.filter((_, i) => i !== rowIndex),
    })));
  }

  // ── Modifier matrix ───────────────────────────────────────────────────────

  function toggleModifier(variantId: string, groupId: string) {
    onChange(variants.map((v) => {
      if (v.id !== variantId) return v;
      const has = v.modifierGroupIds.includes(groupId);
      return {
        ...v,
        modifierGroupIds: has
          ? v.modifierGroupIds.filter((g) => g !== groupId)
          : [...v.modifierGroupIds, groupId],
      };
    }));
  }

  function removeModifierRow(groupId: string) {
    onChange(variants.map((v) => ({
      ...v,
      modifierGroupIds: v.modifierGroupIds.filter((g) => g !== groupId),
    })));
  }

  function addModifierToAll(groupId: string) {
    onChange(variants.map((v) =>
      v.modifierGroupIds.includes(groupId)
        ? v
        : { ...v, modifierGroupIds: [...v.modifierGroupIds, groupId] }
    ));
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (variants.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            padding: '16px 18px', borderRadius: 10,
            background: 'var(--color-bg-hover)',
            fontSize: 12.5, color: 'var(--color-text-secondary)',
            lineHeight: 1.55,
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
            No variants — this recipe is sold as a single SKU.
          </div>
          Add a variant when this recipe has alternative versions (Small /
          Medium / Large, Hot / Iced). Variants become columns in a matrix
          below; the Ingredients, Packaging and Modifiers cards above fold
          into that matrix so there&apos;s only one place to think about
          composition.
        </div>
        <button type="button" onClick={addVariant} style={addBtnStyle}>
          <Plus size={13} strokeWidth={2.4} />
          Add first variant
        </button>
      </div>
    );
  }

  // ── Matrix ────────────────────────────────────────────────────────────────

  const maxIngRows = Math.max(...variants.map((v) => v.ingredients.length), 0);
  const maxPkgRows = Math.max(...variants.map((v) => v.packaging.length), 0);
  const allModifierGroupIds = Array.from(
    new Set(variants.flatMap((v) => v.modifierGroupIds))
  );

  // CSS grid template: a row-label column on the left + one column per
  // variant. We don't use a separate trailing column for "+ variant"
  // because that button is more discoverable as its own pill above
  // the matrix.
  const gridTemplate = `220px repeat(${variants.length}, minmax(140px, 1fr))`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Variant identity strip.
       *
       * NOTE on `overflow: visible` — the header popover (variant
       * settings) is positioned absolutely against its header cell, so
       * any `overflow: hidden` on this wrapper would clip it. We
       * tolerate the small visual artefact at the rounded corners
       * (inner cells render rectangularly into the rounded outer
       * border) so the popover can escape. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap: 1,
          background: 'var(--color-border-subtle)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 10,
        }}
      >
        {/* top-left empty cell — anchors the row-label column */}
        <div style={{ background: '#fff', padding: '10px 12px' }}>
          <div style={subLabelStyle}>Variants</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
            Each column is one full alternative composition.
          </div>
        </div>
        {variants.map((v) => (
          <VariantHeaderCell
            key={v.id}
            variant={v}
            basePrices={basePrices}
            onPatch={(p) => patchVariant(v.id, p)}
            onRemove={() => removeVariant(v.id)}
            onDuplicate={() => duplicateVariant(v.id)}
            onSetDefault={() => setDefault(v.id)}
          />
        ))}
      </div>

      <div>
        <button type="button" onClick={addVariant} style={addBtnStyle}>
          <Plus size={13} strokeWidth={2.4} />
          Add variant
        </button>
      </div>

      {/* Ingredients matrix */}
      <MatrixSection
        title="Ingredients"
        hint="One row per ingredient. Cells that differ across variants are highlighted."
        gridTemplate={gridTemplate}
        emptyCopy="No ingredients yet."
        addPickerPlaceholder="Add ingredient…"
        onAddRow={addIngredientRow}
      >
        {Array.from({ length: maxIngRows }).map((_, rowIdx) => {
          const cells = variants.map((v) => {
            const ing = v.ingredients[rowIdx];
            if (!ing) return undefined;
            // Treat qty 0 as "not in this variant" for highlight purposes.
            if (ing.baseQty.value === 0) return undefined;
            return { ref: ing.ref, qty: ing.baseQty };
          });
          const varies = rowVaries(cells);
          const labelRef = variants.find((v) => v.ingredients[rowIdx])?.ingredients[rowIdx]?.ref;
          return (
            <MatrixRow
              key={`ing-${rowIdx}`}
              label={labelRef ? refName(labelRef) : '(unknown)'}
              gridTemplate={gridTemplate}
              varies={varies}
              onRemoveRow={() => removeIngredientRow(rowIdx)}
            >
              {variants.map((v) => {
                const ing = v.ingredients[rowIdx];
                const empty = !ing || ing.baseQty.value === 0;
                return (
                  <QtyCell
                    key={`${v.id}-ing-${rowIdx}`}
                    empty={empty}
                    value={ing?.baseQty.value ?? 0}
                    unit={ing?.baseQty.unit ?? 'g'}
                    onChange={(patch) => patchIngredientCell(v.id, rowIdx, patch)}
                    onClear={() => clearIngredientCell(v.id, rowIdx)}
                    highlight={varies && !empty}
                  />
                );
              })}
            </MatrixRow>
          );
        })}
      </MatrixSection>

      {/* Packaging matrix */}
      <MatrixSection
        title="Packaging"
        hint="Cups, lids, bags. Tap a cell&apos;s ref label to swap packaging in one variant (e.g. 12oz cup for Large)."
        gridTemplate={gridTemplate}
        emptyCopy="No packaging yet."
        addPickerPlaceholder="Add packaging…"
        onAddRow={addPackagingRow}
      >
        {Array.from({ length: maxPkgRows }).map((_, rowIdx) => {
          const cells = variants.map((v) => {
            const ing = v.packaging[rowIdx];
            if (!ing) return undefined;
            return { ref: ing.ref, qty: ing.baseQty };
          });
          const varies = rowVaries(cells);
          // Packaging row label uses majority ref (or first available).
          const labelRef = variants.find((v) => v.packaging[rowIdx])?.packaging[rowIdx]?.ref;
          return (
            <MatrixRow
              key={`pkg-${rowIdx}`}
              label={labelRef ? refName(labelRef) : '(unknown)'}
              gridTemplate={gridTemplate}
              varies={varies}
              onRemoveRow={() => removePackagingRow(rowIdx)}
            >
              {variants.map((v) => {
                const ing = v.packaging[rowIdx];
                return (
                  <PackagingCell
                    key={`${v.id}-pkg-${rowIdx}`}
                    ingredient={ing}
                    onPatch={(patch) => patchPackagingCell(v.id, rowIdx, patch)}
                    highlight={varies}
                  />
                );
              })}
            </MatrixRow>
          );
        })}
      </MatrixSection>

      {/* Modifiers matrix */}
      <ModifiersMatrixSection
        gridTemplate={gridTemplate}
        variants={variants}
        attachedGroupIds={allModifierGroupIds}
        onToggle={toggleModifier}
        onRemoveRow={removeModifierRow}
        onAddRow={addModifierToAll}
      />
    </div>
  );
}

function suggestVariantName(existing: RecipeVariant[]): string {
  const taken = new Set(existing.map((v) => v.name.trim().toLowerCase()));
  for (const candidate of ['Small', 'Medium', 'Large']) {
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `Variant ${existing.length + 1}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant column header — name + default toggle + price summary + popover

function VariantHeaderCell({
  variant,
  basePrices,
  onPatch,
  onRemove,
  onDuplicate,
  onSetDefault,
}: {
  variant: RecipeVariant;
  basePrices: { dineIn: number; takeaway: number; delivery: number };
  onPatch: (patch: Partial<RecipeVariant>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const dineIn = variant.priceDineIn ?? basePrices.dineIn;
  const priceIsBase = variant.priceDineIn === undefined;

  return (
    <div
      style={{
        position: 'relative',
        background: '#fff',
        padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          value={variant.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Variant name"
          style={{
            flex: 1, minWidth: 0,
            border: 'none', outline: 'none', padding: 0, margin: 0,
            background: 'transparent',
            fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
          }}
        />
        <button
          type="button"
          onClick={() => setPopoverOpen((v) => !v)}
          title="Edit prices, POS id, default"
          aria-label="More"
          style={iconBtn}
        >
          <MoreHorizontal size={12} />
        </button>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11.5, color: 'var(--color-text-muted)', fontWeight: 500,
        minHeight: 18,
      }}>
        {variant.isDefault && (
          <span style={defaultPillStyle}>
            <Lock size={9} /> default
          </span>
        )}
        <span style={{ color: priceIsBase ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}>
          {dineIn > 0 ? `£${dineIn.toFixed(2)}` : '—'}
          {priceIsBase ? ' base' : ''}
        </span>
      </div>

      {popoverOpen && (
        <VariantSettingsPopover
          variant={variant}
          basePrices={basePrices}
          onPatch={onPatch}
          onSetDefault={onSetDefault}
          onDuplicate={() => { setPopoverOpen(false); onDuplicate(); }}
          onRemove={() => { setPopoverOpen(false); onRemove(); }}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </div>
  );
}

function VariantSettingsPopover({
  variant, basePrices,
  onPatch, onSetDefault, onDuplicate, onRemove, onClose,
}: {
  variant: RecipeVariant;
  basePrices: { dineIn: number; takeaway: number; delivery: number };
  onPatch: (p: Partial<RecipeVariant>) => void;
  onSetDefault: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  function setPrice(
    channel: 'priceDineIn' | 'priceTakeaway' | 'priceDelivery',
    raw: string,
  ) {
    if (raw === '') {
      onPatch({ [channel]: undefined } as Partial<RecipeVariant>);
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n)) onPatch({ [channel]: n } as Partial<RecipeVariant>);
  }
  return (
    <div
      style={{
        position: 'absolute', top: '100%', right: 8, zIndex: 60,
        marginTop: 6, width: 260,
        background: '#fff', borderRadius: 10,
        border: '1px solid var(--color-border)',
        boxShadow: '0 12px 32px rgba(3,15,58,0.12)',
        padding: 12,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={subLabelStyle}>Variant settings</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onClose} aria-label="Close" style={{
          border: 'none', background: 'transparent', padding: 2, cursor: 'pointer',
          color: 'var(--color-text-muted)',
        }}>
          <X size={13} />
        </button>
      </div>
      <button
        type="button"
        onClick={onSetDefault}
        disabled={variant.isDefault}
        style={{
          padding: '7px 10px', borderRadius: 7,
          border: '1px solid ' + (variant.isDefault ? 'transparent' : 'var(--color-border-subtle)'),
          background: variant.isDefault ? 'rgba(3,28,89,0.08)' : '#fff',
          color: variant.isDefault ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
          fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)',
          cursor: variant.isDefault ? 'default' : 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}
      >
        {variant.isDefault ? <Check size={11} strokeWidth={2.6} /> : <Lock size={10} />}
        {variant.isDefault ? 'Default variant' : 'Make default'}
      </button>
      <div>
        <div style={subLabelStyle}>Prices <SubSoft>(blank = use base)</SubSoft></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <PriceField
            label="Dine"
            value={variant.priceDineIn}
            placeholder={basePrices.dineIn ? basePrices.dineIn.toFixed(2) : ''}
            onChange={(v) => setPrice('priceDineIn', v)}
          />
          <PriceField
            label="T-away"
            value={variant.priceTakeaway}
            placeholder={basePrices.takeaway ? basePrices.takeaway.toFixed(2) : ''}
            onChange={(v) => setPrice('priceTakeaway', v)}
          />
          <PriceField
            label="Delivery"
            value={variant.priceDelivery}
            placeholder={basePrices.delivery ? basePrices.delivery.toFixed(2) : ''}
            onChange={(v) => setPrice('priceDelivery', v)}
          />
        </div>
      </div>
      <div>
        <div style={subLabelStyle}>POS source id <SubSoft>(optional)</SubSoft></div>
        <input
          value={variant.posSourceId ?? ''}
          onChange={(e) => onPatch({ posSourceId: e.target.value || undefined })}
          placeholder="e.g. sq-var-small"
          style={textInputStyle}
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={onDuplicate} style={{ ...secondaryBtn, flex: 1 }}>
          <Copy size={11} /> Duplicate
        </button>
        <button
          type="button"
          onClick={onRemove}
          style={{ ...secondaryBtn, flex: 1, color: 'var(--color-text-secondary)' }}
        >
          <X size={11} /> Remove
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix building blocks

function MatrixSection({
  title, hint, gridTemplate,
  emptyCopy, addPickerPlaceholder,
  onAddRow,
  children,
}: {
  title: string;
  hint: string;
  gridTemplate: string;
  emptyCopy: string;
  addPickerPlaceholder: string;
  onAddRow: (ref: IngredientRef) => void;
  children: React.ReactNode;
}) {
  const hasRows = React.Children.count(children) > 0;
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.4, marginTop: 2 }}>
          {hint}
        </div>
      </div>
      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {hasRows ? (
          <div style={{
            display: 'grid', gridTemplateColumns: gridTemplate, gap: 1,
            background: 'var(--color-border-subtle)',
          }}>
            {children}
          </div>
        ) : (
          <div style={{
            padding: '14px 16px', background: '#fff',
            fontSize: 12, color: 'var(--color-text-muted)',
          }}>
            {emptyCopy}
          </div>
        )}
        <div
          style={{
            background: '#fff',
            borderTop: hasRows ? '1px solid var(--color-border-subtle)' : 'none',
            padding: 10,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {pickerOpen ? (
            <div style={{ minWidth: 260, flex: 1 }}>
              <IngredientRefPicker
                onChange={(ref) => { onAddRow(ref); setPickerOpen(false); }}
                placeholder={addPickerPlaceholder}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              style={addRowBtnStyle}
            >
              <Plus size={12} strokeWidth={2.4} />
              {addPickerPlaceholder}
            </button>
          )}
          {pickerOpen && (
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                padding: 4, color: 'var(--color-text-muted)',
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MatrixRow({
  label, gridTemplate, varies, onRemoveRow, children,
}: {
  label: string;
  gridTemplate: string;
  varies: boolean;
  onRemoveRow: () => void;
  children: React.ReactNode;
}) {
  // Render label + variant cells as contents of the parent grid so
  // they align with the variant headers. We can't grid inside the row
  // because we already have a single parent grid; instead we emit
  // siblings (label cell + N data cells) that flow naturally.
  return (
    <>
      <div
        style={{
          background: '#fff',
          padding: '8px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
          minWidth: 0,
        }}
      >
        {varies && <span style={variesDotStyle} title="Varies across variants" />}
        <span
          title={label}
          style={{
            flex: 1, fontSize: 12.5, fontWeight: 600,
            color: 'var(--color-text-primary)',
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={onRemoveRow}
          title="Remove row from all variants"
          aria-label="Remove row"
          style={{ ...iconBtn, opacity: 0.6 }}
        >
          <X size={11} />
        </button>
      </div>
      {children}
    </>
  );
}

function QtyCell({
  empty, value, unit, onChange, onClear, highlight,
}: {
  empty: boolean;
  value: number;
  unit: string;
  onChange: (patch: { value?: number; unit?: string }) => void;
  onClear: () => void;
  highlight: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? 'rgba(143,92,199,0.10)' : '#fff',
        padding: '6px 8px',
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      {empty ? (
        <button
          type="button"
          onClick={() => onChange({ value: 1 })}
          title="Add to this variant"
          style={{
            flex: 1,
            padding: '4px 8px', borderRadius: 6,
            border: '1px dashed var(--color-border)',
            background: 'transparent', cursor: 'pointer',
            color: 'var(--color-text-muted)',
            fontSize: 11.5, fontFamily: 'var(--font-primary)',
          }}
        >
          —
        </button>
      ) : (
        <>
          <input
            type="number"
            value={value}
            onChange={(e) =>
              onChange({ value: e.target.value === '' ? 0 : Number(e.target.value) })
            }
            style={cellQtyInputStyle}
          />
          <select
            value={unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            style={cellUnitSelectStyle}
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button
            type="button"
            onClick={onClear}
            title="Remove from this variant"
            aria-label="Remove from variant"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: 2, color: 'var(--color-text-muted)',
            }}
          >
            <X size={10} />
          </button>
        </>
      )}
    </div>
  );
}

function PackagingCell({
  ingredient, onPatch, highlight,
}: {
  ingredient: RecipeIngredient | undefined;
  onPatch: (patch: { ref?: IngredientRef; value?: number; unit?: string }) => void;
  highlight: boolean;
}) {
  const [editingRef, setEditingRef] = useState(false);
  if (!ingredient) {
    return (
      <div style={{
        background: highlight ? 'rgba(143,92,199,0.10)' : '#fff',
        padding: '6px 8px',
        display: 'flex', alignItems: 'center',
        color: 'var(--color-text-muted)', fontSize: 11.5,
      }}>
        —
      </div>
    );
  }
  return (
    <div
      style={{
        background: highlight ? 'rgba(143,92,199,0.10)' : '#fff',
        padding: '6px 8px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      {editingRef ? (
        <IngredientRefPicker
          value={ingredient.ref}
          onChange={(ref) => { onPatch({ ref }); setEditingRef(false); }}
          placeholder="Pick packaging…"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingRef(true)}
          style={{
            background: 'transparent', border: 'none', padding: 0, margin: 0,
            cursor: 'pointer', textAlign: 'left',
            fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-primary)',
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-primary)',
          }}
          title={`${refName(ingredient.ref)} — click to swap`}
        >
          {refName(ingredient.ref)}
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number"
          value={ingredient.baseQty.value}
          onChange={(e) =>
            onPatch({ value: e.target.value === '' ? 0 : Number(e.target.value) })
          }
          style={cellQtyInputStyle}
        />
        <select
          value={ingredient.baseQty.unit}
          onChange={(e) => onPatch({ unit: e.target.value })}
          style={cellUnitSelectStyle}
        >
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modifier matrix

function ModifiersMatrixSection({
  gridTemplate,
  variants,
  attachedGroupIds,
  onToggle,
  onRemoveRow,
  onAddRow,
}: {
  gridTemplate: string;
  variants: RecipeVariant[];
  attachedGroupIds: string[];
  onToggle: (variantId: string, groupId: string) => void;
  onRemoveRow: (groupId: string) => void;
  onAddRow: (groupId: string) => void;
}) {
  const router = useRouter();
  const allGroups = useModifierGroups();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ModifierGroup | null>(null);

  const attachedGroups = useMemo(
    () => attachedGroupIds
      .map((id) => allGroups.find((g) => g.id === id))
      .filter((g): g is ModifierGroup => !!g),
    [attachedGroupIds, allGroups],
  );
  const unattachedGroups = useMemo(
    () => allGroups.filter((g) => !attachedGroupIds.includes(g.id)),
    [allGroups, attachedGroupIds],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Modifiers
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.4, marginTop: 2 }}>
          Modifier groups attached to each variant. Toggle a cell to attach / detach for a single variant.
        </div>
      </div>
      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {attachedGroups.length > 0 ? (
          <div style={{
            display: 'grid', gridTemplateColumns: gridTemplate, gap: 1,
            background: 'var(--color-border-subtle)',
          }}>
            {attachedGroups.map((g) => {
              const cells = variants.map((v) => v.modifierGroupIds.includes(g.id));
              const varies = cells.some((c) => c) && cells.some((c) => !c);
              return (
                <React.Fragment key={g.id}>
                  <div
                    style={{
                      background: '#fff',
                      padding: '8px 10px',
                      display: 'flex', alignItems: 'center', gap: 6,
                      minWidth: 0,
                    }}
                  >
                    {varies && <span style={variesDotStyle} title="Varies across variants" />}
                    <span
                      title={g.name}
                      style={{
                        flex: 1, fontSize: 12.5, fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {g.name}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      {g.selection === 'one' ? '1' : 'n'} · {g.options.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditGroup(g)}
                      title="Edit in library"
                      aria-label="Edit group"
                      style={{ ...iconBtn, opacity: 0.6 }}
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveRow(g.id)}
                      title="Detach from all variants"
                      aria-label="Detach group"
                      style={{ ...iconBtn, opacity: 0.6 }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                  {variants.map((v, i) => {
                    const on = cells[i];
                    return (
                      <button
                        key={`${g.id}-${v.id}`}
                        type="button"
                        onClick={() => onToggle(v.id, g.id)}
                        style={{
                          background: varies ? 'rgba(143,92,199,0.10)' : '#fff',
                          padding: 0,
                          border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          minHeight: 36,
                        }}
                        aria-label={on ? 'Detach' : 'Attach'}
                      >
                        <span
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 22, height: 22, borderRadius: 5,
                            border: on
                              ? '1px solid var(--color-accent-active)'
                              : '1px solid var(--color-border-subtle)',
                            background: on ? 'var(--color-accent-active)' : '#fff',
                            color: on ? '#fff' : 'transparent',
                          }}
                        >
                          <Check size={13} strokeWidth={3} />
                        </span>
                      </button>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: '14px 16px', background: '#fff',
            fontSize: 12, color: 'var(--color-text-muted)',
          }}>
            No modifier groups attached to any variant.
          </div>
        )}
        <div
          style={{
            background: '#fff',
            borderTop: attachedGroups.length > 0 ? '1px solid var(--color-border-subtle)' : 'none',
            padding: 10,
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
          }}
        >
          {pickerOpen ? (
            <ModifierPicker
              unattached={unattachedGroups}
              onPick={(id) => { onAddRow(id); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
              onGoToLibrary={() => router.push('/modifier-groups')}
            />
          ) : (
            <button
              type="button"
              onClick={() => unattachedGroups.length > 0
                ? setPickerOpen(true)
                : router.push('/modifier-groups')
              }
              style={addRowBtnStyle}
            >
              <Plus size={12} strokeWidth={2.4} />
              {unattachedGroups.length > 0 ? 'Attach modifier group' : 'Create in library'}
            </button>
          )}
        </div>
      </div>

      <GroupEditorDrawer
        open={editGroup !== null}
        mode="edit"
        initial={editGroup}
        onClose={() => setEditGroup(null)}
        onSaved={() => { /* catalogue already updated via upsertGroup */ }}
        onDeleted={(id) => {
          setEditGroup(null);
          onRemoveRow(id);
        }}
      />
    </div>
  );
}

function ModifierPicker({
  unattached, onPick, onClose, onGoToLibrary,
}: {
  unattached: ModifierGroup[];
  onPick: (id: string) => void;
  onClose: () => void;
  onGoToLibrary: () => void;
}) {
  return (
    <div
      style={{
        flex: 1, minWidth: 240,
        padding: '10px 12px', borderRadius: 8,
        background: '#fff', border: '1px solid var(--color-border-subtle)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={subLabelStyle}>Attach modifier group</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close picker"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: 4, color: 'var(--color-text-muted)',
          }}
        >
          <X size={13} />
        </button>
      </div>
      {unattached.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
          Every group in the library is already attached.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflow: 'auto' }}>
          {unattached.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onPick(g.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 9px', borderRadius: 7,
                border: '1px solid var(--color-border-subtle)',
                background: '#fff', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'var(--font-primary)',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
                {g.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {g.selection === 'one' ? 'pick one' : 'pick many'} · {g.options.length}
              </span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flex: 1 }}>
          Need a new group?
        </span>
        <button type="button" onClick={onGoToLibrary} style={addRowBtnStyle}>
          Open library
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small bits

function PriceField({
  label, value, placeholder, onChange,
}: {
  label: string;
  value: number | undefined;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{label}</span>
      <input
        type="number"
        step="0.01"
        value={value ?? ''}
        placeholder={placeholder || '—'}
        onChange={(e) => onChange(e.target.value)}
        style={textInputStyle}
      />
    </label>
  );
}

function SubSoft({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontWeight: 500, color: 'var(--color-text-muted)',
      textTransform: 'none', letterSpacing: 0,
    }}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles

const subLabelStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--color-text-muted)',
  marginBottom: 4,
};

const textInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 9px', borderRadius: 6,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  fontSize: 12.5, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
};

const cellQtyInputStyle: React.CSSProperties = {
  width: 0, flex: 1, minWidth: 40,
  padding: '4px 6px', borderRadius: 5,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  fontSize: 12, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const cellUnitSelectStyle: React.CSSProperties = {
  width: 50,
  padding: '4px 4px', borderRadius: 5,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  fontSize: 11.5, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)',
  outline: 'none',
};

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 22, height: 22, borderRadius: 5,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff', color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  padding: '6px 9px', borderRadius: 7,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff', color: 'var(--color-text-secondary)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const addBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 8,
  border: '1px dashed var(--color-border)',
  background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const addRowBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 11px', borderRadius: 100,
  border: '1px dashed var(--color-border)', background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const defaultPillStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '2px 7px', borderRadius: 100,
  background: 'rgba(3,28,89,0.08)', color: 'var(--color-accent-active)',
  fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
};

const variesDotStyle: React.CSSProperties = {
  display: 'inline-block', width: 6, height: 6, borderRadius: 100,
  background: '#8F5CC7', flexShrink: 0,
};
