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
 * Differs-from-others emphasis: values that vary across the row render
 * bold in the primary text colour; values that are identical in every
 * variant render muted. No colour fills — weight and tone carry the
 * signal so the eye lands on real variation.
 *
 * Layout is one CSS grid for the whole matrix (header row, group bands,
 * rows, add-row footers) so every column lines up. Cells draw their own
 * borders (no gap/background trick) because the header popover needs
 * `overflow: visible` on the container.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { IngredientSourceBadge } from './IngredientSourceBadge';
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

export type VariantSeed = {
  /** Used to seed the very first variant (and as the fallback for
   *  picking a default new-ingredient unit). */
  baseIngredients: RecipeIngredient[];
  basePackaging: RecipeIngredient[];
  baseModifierGroupIds: string[];
  basePrices: { dineIn: number; takeaway: number; delivery: number };
};

/**
 * Returns `variants` with one more appended. Exported so the parent
 * section can own the "Add variant" button (it sits in the section
 * header, next to the title) while the seeding rules stay here with the
 * rest of the variant logic.
 */
export function appendVariant(variants: RecipeVariant[], seed: VariantSeed): RecipeVariant[] {
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
      ingredients: seed.baseIngredients.map(cloneIngredient),
      packaging: seed.basePackaging.map(cloneIngredient),
      modifierGroupIds: [...seed.baseModifierGroupIds],
      priceDineIn: seed.basePrices.dineIn || undefined,
      priceTakeaway: seed.basePrices.takeaway || undefined,
      priceDelivery: seed.basePrices.delivery || undefined,
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
  return [...variants, next];
}

export function VariantsSection({
  variants,
  baseIngredients,
  basePackaging,
  baseModifierGroupIds,
  basePrices,
  onChange,
}: VariantSeed & {
  variants: RecipeVariant[];
  onChange: (next: RecipeVariant[]) => void;
}) {
  function addVariant() {
    onChange(appendVariant(variants, {
      baseIngredients, basePackaging, baseModifierGroupIds, basePrices,
    }));
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

  // "Not in this variant" is expressed as qty 0: the row keeps its slot so
  // columns stay aligned, and the cell renders as "Not used". The user
  // gets there by typing 0; no separate clear action needed.

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
            fontSize: 13.5, color: 'var(--color-text-secondary)',
            lineHeight: 1.55,
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
            No variants. This recipe is sold as a single SKU.
          </div>
          Add a variant when this recipe comes in sizes or formats (Small /
          Medium / Large, Hot / Iced). Each variant becomes a column with its
          own quantities, packaging and price.
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

  // One grid for the whole matrix: a row-label column on the left plus
  // one column per variant. Group bands and add-row footers span every
  // column so the variant columns stay continuous from header to foot.
  //
  // Many variants: the grid has a hard minimum width (label column plus
  // MIN_VARIANT_COL per variant). Up to about six fit a laptop-width card;
  // beyond that the wrapper scrolls sideways with the label column pinned
  // on the left, so ingredient names never leave the screen.
  const gridTemplate = `${LABEL_COL_WIDTH}px repeat(${variants.length}, minmax(${MIN_VARIANT_COL}px, 1fr))`;
  const gridMinWidth = LABEL_COL_WIDTH + variants.length * MIN_VARIANT_COL;

  return (
    <MatrixScroller>
      <div
        className="vm"
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          minWidth: gridMinWidth,
        }}
      >
      {/* ── Header row: the variants themselves ── */}
      <div className="vm-pin" style={{ ...headerCellStyle, display: 'flex', alignItems: 'flex-end', paddingBottom: 12 }}>
        <span style={subLabelStyle}>
          {variants.length} {variants.length === 1 ? 'variant' : 'variants'}
        </span>
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

      {/* ── Ingredients ── */}
      <GroupBand title="Ingredients" />
      {maxIngRows === 0 && <EmptyRows copy="No ingredients yet." />}
      {Array.from({ length: maxIngRows }).map((_, rowIdx) => {
        const cells = variants.map((v) => {
          const ing = v.ingredients[rowIdx];
          if (!ing) return undefined;
          // Treat qty 0 as "not in this variant" for emphasis purposes.
          if (ing.baseQty.value === 0) return undefined;
          return { ref: ing.ref, qty: ing.baseQty };
        });
        const varies = rowVaries(cells);
        const labelRef = variants.find((v) => v.ingredients[rowIdx])?.ingredients[rowIdx]?.ref;
        return (
          <MatrixRow
            key={`ing-${rowIdx}`}
            label={labelRef ? refName(labelRef) : '(unknown)'}
            sourceRef={labelRef}
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
                  emphasis={varies && !empty}
                />
              );
            })}
          </MatrixRow>
        );
      })}
      <AddRowFooter placeholder="Add ingredient" onAddRow={addIngredientRow} />

      {/* ── Packaging ── */}
      <GroupBand title="Packaging" />
      {maxPkgRows === 0 && <EmptyRows copy="No packaging yet." />}
      {Array.from({ length: maxPkgRows }).map((_, rowIdx) => {
        const cells = variants.map((v) => {
          const ing = v.packaging[rowIdx];
          if (!ing) return undefined;
          return { ref: ing.ref, qty: ing.baseQty };
        });
        const varies = rowVaries(cells);
        // Packaging row label uses the first available ref.
        const labelRef = variants.find((v) => v.packaging[rowIdx])?.packaging[rowIdx]?.ref;
        return (
          <MatrixRow
            key={`pkg-${rowIdx}`}
            label={labelRef ? refName(labelRef) : '(unknown)'}
            sourceRef={labelRef}
            onRemoveRow={() => removePackagingRow(rowIdx)}
          >
            {variants.map((v) => {
              const ing = v.packaging[rowIdx];
              return (
                <PackagingCell
                  key={`${v.id}-pkg-${rowIdx}`}
                  ingredient={ing}
                  onPatch={(patch) => patchPackagingCell(v.id, rowIdx, patch)}
                  emphasis={varies}
                />
              );
            })}
          </MatrixRow>
        );
      })}
      <AddRowFooter placeholder="Add packaging" onAddRow={addPackagingRow} />

      {/* ── Modifiers ── */}
      <ModifiersMatrixRows
        variants={variants}
        attachedGroupIds={allModifierGroupIds}
        onToggle={toggleModifier}
        onRemoveRow={removeModifierRow}
        onAddRow={addModifierToAll}
      />
      </div>
    </MatrixScroller>
  );
}

/**
 * Horizontal scroll wrapper for the matrix. Tracks scroll position so the
 * pinned label column gets an edge shadow once content has slid under it,
 * and a fade on the right edge says "more columns this way" until the
 * user reaches the end.
 */
function MatrixScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const maxLeft = el.scrollWidth - el.clientWidth;
    const next = { left: el.scrollLeft > 1, right: maxLeft - el.scrollLeft > 1 };
    setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [measure]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={ref}
        onScroll={measure}
        className={`vm-scroll${edges.left ? ' vm-scrolled' : ''}`}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 10,
        }}
      >
        {children}
      </div>
      {edges.right && (
        <div
          aria-hidden
          style={{
            position: 'absolute', top: 1, right: 1, bottom: 1, width: 40,
            pointerEvents: 'none',
            borderRadius: '0 10px 10px 0',
            background: 'linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.95))',
          }}
        />
      )}
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
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);
  const dineIn = variant.priceDineIn ?? basePrices.dineIn;
  const priceIsBase = variant.priceDineIn === undefined;

  // Name takes the full header width on its own line; price, default
  // marker and the settings button share the second line. That keeps a
  // column legible at MIN_VARIANT_COL when there are many variants.
  return (
    <div
      style={{
        ...headerCellStyle,
        borderLeft: '1px solid var(--color-border-subtle)',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <input
        className="vm-name"
        value={variant.name}
        onChange={(e) => onPatch({ name: e.target.value })}
        placeholder="Variant name"
        title="Rename variant"
        aria-label="Variant name"
        style={{
          width: 'calc(100% + 12px)', minWidth: 0,
          border: 'none', outline: 'none', margin: 0,
          padding: '2px 6px', marginLeft: -6, borderRadius: 6,
          background: 'transparent',
          fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-primary)',
          textOverflow: 'ellipsis',
        }}
      />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12.5, color: 'var(--color-text-secondary)', fontWeight: 500,
        minHeight: 24,
      }}>
        <span style={{
          fontWeight: priceIsBase ? 500 : 700,
          color: priceIsBase ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}>
          {dineIn > 0 ? `£${dineIn.toFixed(2)}` : 'No price'}
        </span>
        {priceIsBase && dineIn > 0 && (
          <span style={{ color: 'var(--color-text-muted)' }}>base</span>
        )}
        {variant.isDefault && (
          <span
            style={defaultPillStyle}
            title="Default variant: the one POS sales map to unless told otherwise"
            aria-label="Default variant"
          >
            <Lock size={10} />
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          ref={settingsBtnRef}
          type="button"
          onClick={() => setPopoverOpen((v) => !v)}
          title="Prices, POS id, default, duplicate, remove"
          aria-label={`Settings for ${variant.name || 'variant'}`}
          aria-expanded={popoverOpen}
          style={{ ...iconBtn, marginRight: -4 }}
        >
          <MoreHorizontal size={13} />
        </button>
      </div>

      {popoverOpen && (
        <VariantSettingsPopover
          anchorRef={settingsBtnRef}
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

/**
 * Rendered through a portal and positioned against the settings button.
 * The matrix lives inside a horizontal scroll container, which would clip
 * anything absolutely positioned within a header cell.
 */
function VariantSettingsPopover({
  anchorRef, variant, basePrices,
  onPatch, onSetDefault, onDuplicate, onRemove, onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  variant: RecipeVariant;
  basePrices: { dineIn: number; takeaway: number; delivery: number };
  onPatch: (p: Partial<RecipeVariant>) => void;
  onSetDefault: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const POPOVER_WIDTH = 260;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    function place() {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const margin = 8;
      const left = Math.max(margin, Math.min(r.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - margin));
      setPos({ top: r.bottom + 6, left });
    }
    place();
    // Capture phase catches the matrix scroller and any scrolling ancestor.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchorRef]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onClose]);

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
  if (!pos || typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Variant settings"
      style={{
        position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000,
        width: POPOVER_WIDTH,
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
          padding: '8px 11px', borderRadius: 7,
          border: '1px solid ' + (variant.isDefault ? 'transparent' : 'var(--color-border-subtle)'),
          background: variant.isDefault ? 'rgba(0, 28, 53,0.08)' : '#fff',
          color: variant.isDefault ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
          fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)',
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
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix building blocks
//
// Every piece here is emitted as direct children of the single matrix
// grid. Rows are fragments (label cell + N data cells); bands and footers
// span all columns with `gridColumn: '1 / -1'`. Spanning cells can't be
// pinned as a whole, so their content sits in a `.vm-pin-inline` wrapper
// that sticks to the left edge while the columns scroll underneath.

/** Grey band that names a group of rows (Ingredients / Packaging / Modifiers). */
function GroupBand({ title }: { title: string }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        background: 'var(--color-bg-hover)',
        padding: '7px 12px',
        display: 'flex', alignItems: 'center',
      }}
    >
      <span className="vm-pin-inline" style={{ ...subLabelStyle, marginBottom: 0 }}>{title}</span>
    </div>
  );
}

/** Full-width placeholder row shown when a group has no rows yet. */
function EmptyRows({ copy }: { copy: string }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        padding: '10px 12px',
        fontSize: 13, color: 'var(--color-text-muted)',
        borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex',
      }}
    >
      <span className="vm-pin-inline">{copy}</span>
    </div>
  );
}

/** Full-width footer with the add-row action for a group. Opens the
 *  ingredient picker inline; the new row appears directly above. */
function AddRowFooter({
  placeholder, onAddRow,
}: {
  placeholder: string;
  onAddRow: (ref: IngredientRef) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div style={footerStyle}>
      <div className="vm-pin-inline" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {pickerOpen ? (
          <>
            <div style={{ width: 360 }}>
              <IngredientRefPicker
                onChange={(ref) => { onAddRow(ref); setPickerOpen(false); }}
                placeholder={`${placeholder}…`}
              />
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              aria-label="Cancel"
              style={ghostIconBtn}
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setPickerOpen(true)} style={addRowBtnStyle}>
            <Plus size={13} strokeWidth={2.4} />
            {placeholder}
          </button>
        )}
      </div>
    </div>
  );
}

function MatrixRow({
  label, sourceRef, onRemoveRow, children,
}: {
  label: string;
  /** Optional ingredient ref for the row's source badge (Master /
   *  Sub-recipe / Made @ X / Supplier). Pass undefined for non-
   *  ingredient rows (e.g. modifier groups). NB: NOT named `ref`
   *  because React reserves that prop name on function components. */
  sourceRef?: IngredientRef;
  onRemoveRow: () => void;
  children: React.ReactNode;
}) {
  // Label + variant cells are emitted as siblings of the parent grid so
  // they line up with the variant headers.
  return (
    <>
      <div className="vm-row-label vm-pin" style={labelCellStyle}>
        <span
          title={label}
          style={{
            ...rowLabelTextStyle,
          }}
        >
          {label}
        </span>
        {sourceRef && <IngredientSourceBadge ingredientRef={sourceRef} size="xs" />}
        <button
          type="button"
          onClick={onRemoveRow}
          title="Remove row from all variants"
          aria-label={`Remove ${label} from all variants`}
          className="vm-reveal"
          style={ghostIconBtn}
        >
          <X size={12} />
        </button>
      </div>
      {children}
    </>
  );
}

/**
 * Quantity + unit as one compact control. `emphasis` (this value differs
 * from the other variants in the row) renders the number bold in the
 * primary colour; identical values render muted so they recede.
 */
function QtyControl({
  value, unit, emphasis, onChange, ariaLabel, title,
}: {
  value: number;
  unit: string;
  emphasis: boolean;
  onChange: (patch: { value?: number; unit?: string }) => void;
  ariaLabel: string;
  title?: string;
}) {
  return (
    <div className="vm-qty" style={qtyControlStyle}>
      <input
        type="number"
        value={value}
        aria-label={ariaLabel}
        title={title}
        onChange={(e) =>
          onChange({ value: e.target.value === '' ? 0 : Number(e.target.value) })
        }
        style={{
          ...cellQtyInputStyle,
          fontWeight: emphasis ? 700 : 500,
          color: emphasis ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        }}
      />
      <select
        value={unit}
        aria-label={`${ariaLabel} unit`}
        onChange={(e) => onChange({ unit: e.target.value })}
        style={{
          ...cellUnitSelectStyle,
          color: emphasis ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        }}
      >
        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  );
}

function QtyCell({
  empty, value, unit, onChange, emphasis,
}: {
  empty: boolean;
  value: number;
  unit: string;
  onChange: (patch: { value?: number; unit?: string }) => void;
  emphasis: boolean;
}) {
  return (
    <div className="vm-cell" style={dataCellStyle}>
      {empty ? (
        <button
          type="button"
          onClick={() => onChange({ value: 1 })}
          title="Add to this variant"
          style={notInVariantBtnStyle}
        >
          Not used
        </button>
      ) : (
        <QtyControl
          value={value}
          unit={unit}
          emphasis={emphasis}
          onChange={onChange}
          ariaLabel="Quantity"
          title="Set to 0 to leave out of this variant"
        />
      )}
    </div>
  );
}

function PackagingCell({
  ingredient, onPatch, emphasis,
}: {
  ingredient: RecipeIngredient | undefined;
  onPatch: (patch: { ref?: IngredientRef; value?: number; unit?: string }) => void;
  emphasis: boolean;
}) {
  const [editingRef, setEditingRef] = useState(false);
  if (!ingredient) {
    return (
      <div className="vm-cell" style={{ ...dataCellStyle, color: 'var(--color-text-muted)', fontSize: 12.5 }}>
        Not used
      </div>
    );
  }
  return (
    <div className="vm-cell" style={{ ...dataCellStyle, flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>
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
            fontSize: 12.5,
            fontWeight: emphasis ? 700 : 500,
            color: emphasis ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-primary)',
          }}
          title={`${refName(ingredient.ref)}. Click to swap for this variant`}
        >
          {refName(ingredient.ref)}
        </button>
      )}
      <QtyControl
        value={ingredient.baseQty.value}
        unit={ingredient.baseQty.unit}
        emphasis={emphasis}
        onChange={onPatch}
        ariaLabel="Packaging quantity"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modifier rows

function ModifiersMatrixRows({
  variants,
  attachedGroupIds,
  onToggle,
  onRemoveRow,
  onAddRow,
}: {
  variants: RecipeVariant[];
  attachedGroupIds: string[];
  onToggle: (variantId: string, groupId: string) => void;
  onRemoveRow: (groupId: string) => void;
  onAddRow: (groupId: string) => void;
}) {
  const allGroups = useModifierGroups();
  // Discriminated drawer state — edit hosts an existing group, create
  // opens a blank one. Single state keeps the two flows mutually
  // exclusive (you can't be editing and creating simultaneously).
  const [drawer, setDrawer] = useState<
    | { mode: 'closed' }
    | { mode: 'create' }
    | { mode: 'edit'; group: ModifierGroup }
  >({ mode: 'closed' });

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
    <>
      <GroupBand title="Modifiers" />

      {attachedGroups.length === 0 && <EmptyRows copy="No modifier groups attached yet." />}

      {attachedGroups.map((g) => {
        const cells = variants.map((v) => v.modifierGroupIds.includes(g.id));
        return (
          <React.Fragment key={g.id}>
            <div className="vm-row-label vm-pin" style={labelCellStyle}>
              <span
                title={g.name}
                style={{
                  ...rowLabelTextStyle,
                }}
              >
                {g.name}
              </span>
              <button
                type="button"
                onClick={() => setDrawer({ mode: 'edit', group: g })}
                title="Edit group"
                aria-label={`Edit ${g.name}`}
                className="vm-reveal"
                style={ghostIconBtn}
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() => onRemoveRow(g.id)}
                title="Detach from all variants"
                aria-label={`Detach ${g.name} from all variants`}
                className="vm-reveal"
                style={ghostIconBtn}
              >
                <X size={12} />
              </button>
            </div>
            {variants.map((v, i) => {
              const on = cells[i];
              return (
                <div key={`${g.id}-${v.id}`} className="vm-cell" style={{ ...dataCellStyle, justifyContent: 'center' }}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => onToggle(v.id, g.id)}
                    aria-label={`${g.name} on ${v.name || 'variant'}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 40, height: 40, borderRadius: 8,
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: 6,
                        border: on
                          ? '1.5px solid var(--color-accent-active)'
                          : '1.5px solid var(--color-border)',
                        background: on ? 'var(--color-accent-active)' : '#fff',
                        color: on ? '#fff' : 'transparent',
                      }}
                    >
                      <Check size={13} strokeWidth={3} />
                    </span>
                  </button>
                </div>
              );
            })}
          </React.Fragment>
        );
      })}

      <div style={footerStyle}>
        <div className="vm-pin-inline" style={{ display: 'flex', alignItems: 'center' }}>
          <ModifierPicker
            unattached={unattachedGroups}
            onPick={onAddRow}
            onCreate={() => setDrawer({ mode: 'create' })}
          />
        </div>
      </div>

      <GroupEditorDrawer
        open={drawer.mode !== 'closed'}
        mode={drawer.mode === 'edit' ? 'edit' : 'create'}
        initial={drawer.mode === 'edit' ? drawer.group : null}
        onClose={() => setDrawer({ mode: 'closed' })}
        onSaved={(group) => {
          // In create mode, auto-attach the new group as a matrix row so
          // the user can immediately tick which variants it applies to.
          if (drawer.mode === 'create' && !attachedGroupIds.includes(group.id)) {
            onAddRow(group.id);
          }
          setDrawer({ mode: 'closed' });
        }}
        onDeleted={(id) => {
          setDrawer({ mode: 'closed' });
          onRemoveRow(id);
        }}
      />
    </>
  );
}

/**
 * "Attach modifier group" trigger plus its dropdown. The list floats over
 * the page (portalled, fixed coords) so opening it never reflows the
 * matrix; it flips above the button when there is no room below.
 */
function ModifierPicker({
  unattached, onPick, onCreate,
}: {
  unattached: ModifierGroup[];
  onPick: (id: string) => void;
  /** Opens the modifier-group editor drawer in create mode so the user
   *  can build a brand-new group without leaving the recipe. */
  onCreate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const trimmedQ = q.trim().toLowerCase();
  const results = trimmedQ
    ? unattached.filter((g) => g.name.toLowerCase().includes(trimmedQ))
    : unattached;

  const computePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    const h = dropdownRef.current?.offsetHeight ?? PICKER_MAX_HEIGHT;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) {
      const above = r.top - 6 - h;
      if (above >= 8) top = above;
    }
    setPos({ left: r.left, top });
  }, []);

  useLayoutEffect(() => {
    if (open) computePosition();
  }, [open, computePosition]);

  useEffect(() => {
    if (!open || !dropdownRef.current) return;
    computePosition();
  }, [open, results.length, computePosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (buttonRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', computePosition, true);
    window.addEventListener('resize', computePosition);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', computePosition, true);
      window.removeEventListener('resize', computePosition);
    };
  }, [open, computePosition]);

  function close() { setOpen(false); setQ(''); }

  const dropdown = open && typeof document !== 'undefined' ? createPortal(
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label="Modifier groups"
      style={{
        position: 'fixed',
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        width: 320, zIndex: 1000,
        background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8,
        boxShadow: '0 12px 32px rgba(3,15,58,0.12)',
        maxHeight: PICKER_MAX_HEIGHT, overflow: 'auto',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {unattached.length > 6 && (
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search modifier groups…"
          aria-label="Search modifier groups"
          style={{
            width: '100%', padding: '9px 12px', boxSizing: 'border-box',
            border: 'none', borderBottom: '1px solid var(--color-border-subtle)',
            outline: 'none', fontFamily: 'var(--font-primary)', fontSize: 13,
            position: 'sticky', top: 0, background: '#fff', zIndex: 1,
          }}
        />
      )}
      {results.map((g) => (
        <button
          key={g.id}
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => { onPick(g.id); close(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '9px 12px', border: 'none',
            background: '#fff', cursor: 'pointer', textAlign: 'left',
            fontFamily: 'var(--font-primary)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
        >
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {g.name}
          </span>
        </button>
      ))}
      {results.length === 0 && (
        <div style={{ padding: '12px', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
          {unattached.length === 0
            ? 'Every group in the library is already attached.'
            : `No groups match "${q.trim()}".`}
        </div>
      )}
      <button
        type="button"
        onClick={() => { close(); onCreate(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '11px 12px', border: 'none',
          borderTop: '1px solid var(--color-border-subtle)',
          background: '#fff', cursor: 'pointer', textAlign: 'left',
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-accent-active)', fontWeight: 700, fontSize: 13,
          position: 'sticky', bottom: 0, zIndex: 1,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
      >
        <Plus size={13} strokeWidth={2.4} />
        New modifier group
      </button>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (unattached.length > 0 ? setOpen((v) => !v) : onCreate())}
        style={addRowBtnStyle}
      >
        <Plus size={13} strokeWidth={2.4} />
        {unattached.length > 0 ? 'Attach modifier group' : 'Create modifier group'}
      </button>
      {dropdown}
    </>
  );
}

const PICKER_MAX_HEIGHT = 320;

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
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{label}</span>
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
  fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--color-text-muted)',
  marginBottom: 4,
};

const textInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  fontSize: 13.5, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
};

// ── Matrix grid cells ──
// Cells draw their own dividers: rows get a top border, data cells a left
// border. The grid container supplies the outer border and radius.

/** Pinned row-label column. 200px fits two-line ingredient names plus a
 *  source badge and the hover × without wasting width on short names. */
const LABEL_COL_WIDTH = 200;
/** Narrowest a variant column goes before the matrix scrolls sideways.
 *  Fits "160 ml" (number + unit select) and a "£4.40 · default · ⋯" header.
 *  At a 1100px card that means six variants sit without scrolling. */
const MIN_VARIANT_COL = 132;

const headerCellStyle: React.CSSProperties = {
  padding: '12px 12px 10px',
  borderBottom: '1px solid var(--color-border)',
  minWidth: 0,
};

/** Row name: wraps to two lines rather than truncating, so "Espresso Blend
 *  Beans" stays readable next to its source badge. */
const rowLabelTextStyle: React.CSSProperties = {
  flex: 1, fontSize: 13.5, fontWeight: 600, lineHeight: 1.3,
  color: 'var(--color-text-primary)',
  minWidth: 0, overflow: 'hidden',
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
};

const labelCellStyle: React.CSSProperties = {
  padding: '6px 6px 6px 12px',
  minHeight: 48,
  borderTop: '1px solid var(--color-border-subtle)',
  display: 'flex', alignItems: 'center', gap: 6,
  minWidth: 0,
};

const dataCellStyle: React.CSSProperties = {
  padding: '6px 8px',
  minHeight: 48,
  borderTop: '1px solid var(--color-border-subtle)',
  borderLeft: '1px solid var(--color-border-subtle)',
  display: 'flex', alignItems: 'center', gap: 4,
  minWidth: 0,
};

const footerStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  padding: '6px 8px',
  borderTop: '1px solid var(--color-border-subtle)',
  display: 'flex', alignItems: 'center', gap: 8,
};

/** Number + unit share one bordered field so a cell reads as one value ("160 ml"). */
const qtyControlStyle: React.CSSProperties = {
  flex: 1, minWidth: 0,
  display: 'flex', alignItems: 'center',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 6,
  background: '#fff',
  overflow: 'hidden',
};

const cellQtyInputStyle: React.CSSProperties = {
  width: 0, flex: 1, minWidth: 40,
  padding: '7px 6px',
  border: 'none',
  background: 'transparent',
  fontSize: 13.5, fontFamily: 'var(--font-primary)',
  outline: 'none',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const cellUnitSelectStyle: React.CSSProperties = {
  width: 'auto', maxWidth: 66,
  padding: '7px 4px 7px 2px',
  border: 'none',
  borderLeft: '1px solid var(--color-border-subtle)',
  background: 'transparent',
  fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font-primary)',
  outline: 'none',
  cursor: 'pointer',
};

const notInVariantBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '7px 8px', borderRadius: 6,
  border: '1px dashed var(--color-border-subtle)',
  background: 'transparent', cursor: 'pointer',
  color: 'var(--color-text-muted)',
  fontSize: 12.5, fontFamily: 'var(--font-primary)',
  textAlign: 'left',
};

/** Borderless icon button for secondary row/cell actions. Paired with the
 *  `vm-reveal` class it stays hidden until the row is hovered or focused. */
const ghostIconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
  border: 'none', background: 'transparent',
  color: 'var(--color-text-muted)', cursor: 'pointer',
  padding: 0,
};

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 24, height: 24, borderRadius: 5,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff', color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  padding: '7px 10px', borderRadius: 7,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff', color: 'var(--color-text-secondary)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const addBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 13px', borderRadius: 8,
  border: '1px dashed var(--color-border)',
  background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 13.5, fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const addRowBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '7px 12px', borderRadius: 100,
  border: '1px dashed var(--color-border)', background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

/** Icon-only so the header's second line (price · default · ⋯) still fits a
 *  MIN_VARIANT_COL column. The tooltip and settings popover carry the words. */
const defaultPillStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 20, height: 20, borderRadius: 100, flexShrink: 0,
  background: 'rgba(0, 28, 53,0.08)', color: 'var(--color-accent-active)',
};
