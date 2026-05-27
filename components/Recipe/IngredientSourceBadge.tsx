'use client';

/**
 * Small chip that visualises the *source* of an ingredient — what kind
 * of catalogue entry the recipe row points at:
 *
 *   - Master:     the canonical master product (cross-supplier)
 *   - Sub-recipe: another recipe used as an input (component recipe)
 *   - Made @ X:   a product produced in-house at site X
 *   - {Supplier}: a supplier-specific SKU — chip shows the supplier
 *                 shortCode (or name) so the user knows where it comes from
 *
 * Used by the variants matrix (row labels), the ingredients table, and
 * anywhere else we need to surface "what is this thing?" without
 * forcing the user to hover and read a tooltip. Centralising it here
 * keeps tones/labels consistent across the recipe editor.
 */

import React from 'react';
import {
  resolveIngredientRef,
  type IngredientRef,
} from '@/components/Ingredients/catalogue';
import { findSupplier } from '@/components/Suppliers/store';

type Tone = 'master' | 'supplier' | 'made' | 'subrecipe';

const TONES: Record<Tone, { bg: string; color: string }> = {
  master:    { bg: 'rgba(3,28,89,0.08)',    color: 'var(--color-accent-active)' },
  supplier:  { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' },
  made:      { bg: 'rgba(241,180,52,0.16)', color: 'var(--color-warning)' },
  subrecipe: { bg: 'rgba(82,170,150,0.18)', color: 'var(--color-success, #347262)' },
};

/** Resolve a ref into a tone + display label. Pure data — callers
 *  that want custom styling can use this and render the chip
 *  themselves. */
export function describeIngredientSource(
  ref: IngredientRef | undefined,
): { tone: Tone; label: string; title?: string } | null {
  if (!ref) return null;
  const resolved = resolveIngredientRef(ref);
  if (!resolved) return null;

  if (ref.kind === 'master') {
    return { tone: 'master', label: 'Master', title: 'Cross-supplier master product' };
  }
  if (ref.kind === 'subrecipe') {
    const cat = resolved.subRecipe?.category;
    return {
      tone: 'subrecipe',
      label: 'Sub-recipe',
      title: cat ? `Sub-recipe · ${cat}` : 'Sub-recipe (component recipe)',
    };
  }

  const product = resolved.product;
  if (product?.source === 'made') {
    const site = product.madeAtSite?.replace(/^PRET\s+/i, '');
    return {
      tone: 'made',
      label: site ? `Made @ ${site}` : 'Made in-house',
      title: 'Produced in-house',
    };
  }

  // Supplier SKU — prefer the supplier's shortCode, fall back to its
  // full name, then a generic label so we never render an opaque id.
  const supplier = findSupplier(product?.supplierId);
  const label = supplier?.shortCode ?? supplier?.name ?? 'Supplier';
  const title = supplier?.name
    ? `${supplier.name}${resolved.masterProductId ? ' · also in Master' : ''}`
    : 'Supplier SKU';
  return { tone: 'supplier', label, title };
}

export function IngredientSourceBadge({
  ingredientRef, size = 'sm',
}: {
  /** Prop is named `ingredientRef` (not `ref`) because React swallows
   *  the `ref` prop on regular function components. */
  ingredientRef: IngredientRef | undefined;
  size?: 'sm' | 'xs';
}) {
  const meta = describeIngredientSource(ingredientRef);
  if (!meta) return null;
  const t = TONES[meta.tone];
  return (
    <span
      title={meta.title}
      style={{
        padding: size === 'xs' ? '1px 6px' : '2px 7px',
        borderRadius: 100,
        background: t.bg, color: t.color,
        fontSize: size === 'xs' ? 9.5 : 10,
        fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {meta.label}
    </span>
  );
}
