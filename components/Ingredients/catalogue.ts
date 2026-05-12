'use client';

/**
 * Unified ingredient search facade.
 *
 * The recipe editor's ingredient picker should NEVER ask the user up-front
 * whether they want a master product or a supplier product. Both are
 * "ingredients" from the recipe's point of view — the user starts typing,
 * sees a single ranked list of matches, and picks whichever one they
 * recognise. The kind ("Master" vs supplier name vs "Made by us") is
 * shown as a small chip on each row so the user knows what they're
 * picking, but doesn't have to *decide* up-front.
 *
 * This module is a read-side facade. It does not own state — it queries
 * the existing Suppliers store (`useSuppliers`, `useProducts`,
 * `useMasterProducts`) and returns a normalised result list.
 */

import {
  findMasterProduct,
  findProduct,
  findSupplier,
  upsertMasterProduct,
  upsertProduct,
  useMasterProducts,
  useProducts,
  genId,
} from '@/components/Suppliers/store';
import {
  type MasterProduct,
  type Product,
  type ProductSource,
  type ProductCategory,
} from '@/components/Suppliers/fixtures';
import { findRecipe, useRecipes } from '@/components/Recipe/recipeStore';
import type { Recipe } from '@/components/Recipe/libraryFixtures';

/**
 * A single result row in the unified ingredient picker. Discriminated
 * by `kind`. The `ref` is what the recipe row stores so we can
 * resolve back to the underlying entity later.
 */
export type IngredientRef =
  | { kind: 'master'; masterProductId: string }
  | { kind: 'product'; productId: string }
  // Sub-recipe / component recipe used as an ingredient. Pickable
  // from the same unified search box — no separate "is this an
  // ingredient or a sub-recipe?" decision up-front.
  | { kind: 'subrecipe'; recipeId: string };

export type IngredientCatalogueRow = {
  ref: IngredientRef;
  /** Display label (the name). */
  label: string;
  /** Optional secondary line (e.g. unit / category). */
  sublabel?: string;
  /** Which kind of source this row represents. */
  kind: 'master' | 'supplier' | 'made' | 'subrecipe';
  /** For supplier / made rows, the human-readable source (supplier name or
   *  "Made in CPU" etc.). */
  sourceLabel?: string;
  category?: ProductCategory;
  /** True when this row already participates in a master product —
   *  surfaces a faint "→ also in Master" hint in the dropdown. */
  hasMaster: boolean;
};

// ────────────────────────────────────────────────────────────────────────────
// Search

/**
 * Rank a candidate label against a query. Higher is better. Used so
 * exact prefix matches surface above substring matches, and a master
 * outranks a supplier product of the same score.
 */
function scoreMatch(label: string, q: string): number {
  if (!q) return 1;
  const a = label.toLowerCase();
  const b = q.toLowerCase();
  if (a === b) return 1000;
  if (a.startsWith(b)) return 500;
  const i = a.indexOf(b);
  if (i >= 0) return 200 - i;
  // simple token-prefix match: any token starts with the query
  const tokens = a.split(/\s+/);
  if (tokens.some((t) => t.startsWith(b))) return 100;
  return -1;
}

function sourceLabelForProduct(p: Product): string {
  if (p.source === 'made') {
    return p.madeAtSite ? `Made @ ${p.madeAtSite}` : 'Made in-house';
  }
  const s = findSupplier(p.supplierId);
  return s?.shortCode ?? s?.name ?? 'Supplier';
}

/**
 * Pure function — usable from non-React callers (e.g. POS intake
 * matching). Pass in the latest snapshots from the Suppliers store
 * and the Recipe store (component / sub-recipes).
 */
export function searchIngredientCatalogue(
  query: string,
  snapshots: { masterProducts: MasterProduct[]; products: Product[]; recipes?: Recipe[] },
  opts?: { limit?: number; excludeRecipeIds?: string[] },
): IngredientCatalogueRow[] {
  const limit = opts?.limit ?? 30;
  const exclude = new Set(opts?.excludeRecipeIds ?? []);
  const rows: Array<IngredientCatalogueRow & { _score: number }> = [];

  for (const mp of snapshots.masterProducts) {
    const score = scoreMatch(mp.name, query);
    if (score < 0) continue;
    rows.push({
      _score: score + 50, // small boost so masters surface above products of same score
      ref: { kind: 'master', masterProductId: mp.id },
      label: mp.name,
      sublabel: mp.unit,
      kind: 'master',
      sourceLabel: 'Master',
      category: mp.category,
      hasMaster: true,
    });
  }

  for (const p of snapshots.products) {
    const score = scoreMatch(p.name, query);
    if (score < 0) continue;
    const isMade = p.source === 'made';
    rows.push({
      _score: score,
      ref: { kind: 'product', productId: p.id },
      label: p.name,
      sublabel: p.unitOfMeasure
        ? `${p.singleUnitVolumeOrWeight ?? ''}${p.unitOfMeasure}`.trim()
        : `${p.packQty}× ${p.singleUnitType}`,
      kind: isMade ? 'made' : 'supplier',
      sourceLabel: sourceLabelForProduct(p),
      category: p.category,
      hasMaster: !!p.masterProductId,
    });
  }

  // Sub-recipes / component recipes — anything tagged `kind: 'component'`
  // (or flagged as a sub-recipe via the editor's advanced section).
  // Slightly down-weighted vs raw products so a direct master/SKU match
  // still wins ties, but a clear name match (e.g. "Lemon Tahini") still
  // surfaces high.
  for (const r of snapshots.recipes ?? []) {
    if (r.kind !== 'component') continue;
    if (exclude.has(r.id)) continue;
    const score = scoreMatch(r.name, query);
    if (score < 0) continue;
    rows.push({
      _score: score - 10,
      ref: { kind: 'subrecipe', recipeId: r.id },
      label: r.name,
      sublabel: r.formExtras?.yieldUom
        ? `yields ${r.formExtras.yieldQty ?? 1} ${r.formExtras.yieldUom}`
        : 'sub-recipe',
      kind: 'subrecipe',
      sourceLabel: 'Sub-recipe',
      hasMaster: false,
    });
  }

  rows.sort((a, b) => b._score - a._score || a.label.localeCompare(b.label));
  return rows.slice(0, limit).map(({ _score, ...rest }) => rest);
}

// ────────────────────────────────────────────────────────────────────────────
// React hooks

/**
 * Subscribe to the Suppliers store and return a stable search function
 * bound to the latest snapshots. The function reference changes when
 * either the products or master-products list changes (which is fine —
 * the picker re-runs the query on every keystroke).
 */
export function useIngredientCatalogue(): {
  search: (
    query: string,
    opts?: { limit?: number; excludeRecipeIds?: string[] },
  ) => IngredientCatalogueRow[];
  resolveRef: (ref: IngredientRef) => ResolvedIngredient | undefined;
} {
  const masterProducts = useMasterProducts();
  const products = useProducts();
  const recipes = useRecipes();
  return {
    search: (q, opts) =>
      searchIngredientCatalogue(q, { masterProducts, products, recipes }, opts),
    resolveRef: (ref) => resolveIngredientRef(ref),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Resolution

export type ResolvedIngredient = {
  /** Display name. */
  name: string;
  /** Master product id if one is known (either picked directly OR via
   *  the picked Product's `masterProductId`). Cross-source modifier
   *  effects target this. */
  masterProductId?: string;
  /** Picked supplier-or-made Product, if any. */
  product?: Product;
  /** Picked Master, if any. */
  master?: MasterProduct;
  /** Picked sub-recipe / component recipe, if any. */
  subRecipe?: Recipe;
  /** Source kind of the underlying Product, when known. */
  productSource?: ProductSource;
  /** Best-effort canonical unit string (e.g. "ml", "g"). */
  unit?: string;
};

export function resolveIngredientRef(ref: IngredientRef | undefined): ResolvedIngredient | undefined {
  if (!ref) return undefined;
  if (ref.kind === 'master') {
    const m = findMasterProduct(ref.masterProductId);
    if (!m) return undefined;
    return {
      name: m.name,
      masterProductId: m.id,
      master: m,
      unit: m.unit,
    };
  }
  if (ref.kind === 'subrecipe') {
    const r = findRecipe(ref.recipeId);
    if (!r) return undefined;
    return {
      name: r.name,
      subRecipe: r,
      unit: r.formExtras?.yieldUom ?? 'each',
    };
  }
  const p = findProduct(ref.productId);
  if (!p) return undefined;
  const master = p.masterProductId ? findMasterProduct(p.masterProductId) : undefined;
  return {
    name: p.name,
    masterProductId: p.masterProductId,
    product: p,
    master,
    productSource: p.source ?? 'supplier',
    unit: p.unitOfMeasure,
  };
}

/**
 * "Promote to master": create a MasterProduct from a hand-typed name
 * and (optionally) link an existing supplier product to it. Used by
 * the inline "Create new master product" affordance in the picker
 * when no result matches the typed query.
 */
export function createMasterProductFromName(input: {
  name: string;
  category?: ProductCategory;
  unit?: string;
  linkProductId?: string;
}): MasterProduct {
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const mp: MasterProduct = {
    id: genId('mp'),
    name: input.name.trim(),
    category: input.category ?? 'Other',
    unit: input.unit ?? 'each',
    slug,
  };
  upsertMasterProduct(mp);
  if (input.linkProductId) {
    const existing = findProduct(input.linkProductId);
    if (existing && !existing.masterProductId) {
      upsertProduct({ ...existing, masterProductId: mp.id });
    }
  }
  return mp;
}
