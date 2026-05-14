/**
 * applyModifiers — flatten a (recipe + selected variant options +
 * selected modifier options + site) tuple into a `ResolvedComposition`:
 * the concrete list of ingredient lines that should be deducted from
 * stock when this order fires.
 *
 * Post-merge: a Recipe IS the sellable unit. The MenuItem entity is gone.
 * The recipe carries its own `variantDimensions`, `slots`, and
 * `modifierGroupIds`, and this resolver folds them together with the
 * customer's selections and the site context to produce a deterministic
 * line list.
 *
 * Effect application order (deterministic):
 *   1. Resolve variants — fold per-ingredient + per-packaging overrides
 *      into the working base lists, and stash the variant's price
 *      overrides for the channel price.
 *   2. Build the live slot map from recipe slots + `set-slot` modifier
 *      effects (these run BEFORE lines are materialised so the spirit /
 *      wine patterns work).
 *   3. Materialise base + packaging lines (variant overrides applied).
 *   4. Slot lines for slots that don't duplicate a recipe ingredient.
 *   5. Apply `replace` effects — swap ingredients in place.
 *   6. Apply `add` effects — append new ingredients.
 *   7. Apply `scale` effects — multiply quantities (last so it picks
 *      up adds and replaces).
 *
 * Variant resolution is additive: a recipe with no `variantDimensions`
 * goes through the same code path with no overrides applied, so the
 * behaviour for un-migrated recipes is byte-identical to before.
 *
 * Site overrides:
 *   - When a `RecipeIngredient` has `siteOverrides[siteId]`, that qty
 *     wins over the base qty for the resolved line. Variant overrides
 *     replace the base qty entirely (site overrides on the base row do
 *     not stack with a variant ingredient override).
 */

import type {
  Recipe,
  RecipeIngredient,
  RecipeIngredientQty,
  RecipeSlot,
  RecipeVariantDimension,
  RecipeVariantOption,
} from '@/components/Recipe/libraryFixtures';
import type {
  ModifierGroup,
  ModifierOption,
  Quantity,
} from '@/components/Modifiers/types';
import { findGroup, findOption } from '@/components/Modifiers/store';
import {
  resolveIngredientRef,
  type IngredientRef,
} from '@/components/Ingredients/catalogue';

export type ResolvedLine = {
  id: string;
  ref: IngredientRef;
  name: string;
  qty: Quantity;
  source:
    | { kind: 'recipe-base' }
    | { kind: 'recipe-packaging' }
    | { kind: 'variant-ingredient'; dimensionId: string; optionId: string }
    | { kind: 'variant-packaging'; dimensionId: string; optionId: string; replacedRef?: IngredientRef }
    | { kind: 'slot'; slotKey: string }
    | { kind: 'modifier-add'; groupId: string; optionId: string }
    | { kind: 'modifier-replace'; groupId: string; optionId: string; replacedRef: IngredientRef }
    | { kind: 'modifier-scale'; groupId: string; optionId: string; factor: number };
};

/** Per-channel price overrides contributed by the selected variant
 *  options. `undefined` on a channel means "use the recipe's base
 *  channel price"; this lets the caller decide how to fall back. */
export type VariantPricing = {
  priceDineIn?: number;
  priceTakeaway?: number;
  priceDelivery?: number;
};

export type ResolvedComposition = {
  recipeId: string;
  siteId?: string;
  selectedOptionIds: string[];
  /** Map of dimensionId → optionId for the variant choices that drove
   *  this resolution. Empty when the recipe has no variant dimensions. */
  selectedVariantOptions: Record<string, string>;
  lines: ResolvedLine[];
  /** Sum of modifier-option `priceDelta`s (variants are channel
   *  overrides, not deltas — see `variantPricing`). */
  priceDelta: number;
  /** Per-channel price overrides contributed by the selected variant
   *  options. The most-specific override wins when multiple dimensions
   *  set the same channel. */
  variantPricing: VariantPricing;
  warnings: string[];
};

function refKey(ref: IngredientRef): string {
  if (ref.kind === 'master') return `m:${ref.masterProductId}`;
  if (ref.kind === 'product') return `p:${ref.productId}`;
  return `s:${ref.recipeId}`;
}

function refsEqual(a: IngredientRef, b: IngredientRef): boolean {
  return refKey(a) === refKey(b);
}

function nameForRef(ref: IngredientRef): string {
  return resolveIngredientRef(ref)?.name ?? '(unknown ingredient)';
}

/** Resolve "do these refs target the same underlying master?" — used
 *  by replace + scale + slot-dedupe so a modifier targeting
 *  `master X` matches a recipe row that picked a Product whose
 *  `masterProductId` is X. */
function refsShareMaster(a: IngredientRef, b: IngredientRef): boolean {
  if (refsEqual(a, b)) return true;
  const ra = resolveIngredientRef(a);
  const rb = resolveIngredientRef(b);
  if (!ra?.masterProductId || !rb?.masterProductId) return false;
  return ra.masterProductId === rb.masterProductId;
}

function pickRecipeIngredientQty(
  ri: RecipeIngredient,
  siteId: string | undefined,
): RecipeIngredientQty {
  if (siteId && ri.siteOverrides && ri.siteOverrides[siteId]) {
    return ri.siteOverrides[siteId];
  }
  return ri.baseQty;
}

function newLineId(): string {
  return `ln-${Math.random().toString(36).slice(2, 8)}`;
}

export function applyModifiers(input: {
  recipe: Recipe;
  selectedOptionIds: string[];
  siteId?: string;
  /** Optional override map of group → option ids (single-select callers
   *  can use a flat array via `selectedOptionIds`; the map form is
   *  convenient for the editor preview where state is keyed by group). */
  selectedByGroup?: Record<string, string[]>;
  /** Variant choices keyed by dimension id → option id. Variants are
   *  mandatory: when a dimension is present but missing here, the
   *  resolver falls back to the dimension's default (or first) option. */
  selectedVariantOptions?: Record<string, string>;
}): ResolvedComposition {
  const { recipe, siteId } = input;
  const warnings: string[] = [];

  const selectedIds = new Set(input.selectedOptionIds);
  if (input.selectedByGroup) {
    for (const ids of Object.values(input.selectedByGroup)) {
      for (const id of ids) selectedIds.add(id);
    }
  }

  // ── Step 0 — variant resolution ──────────────────────────────────────────
  // Variants override per-ingredient quantities, swap packaging, and
  // override per-channel prices BEFORE any modifier effects apply.
  const variantSel: Record<string, string> = {};
  const variantPricing: VariantPricing = {};
  // Map of recipe-ingredient id → effective qty for this variant set.
  const ingredientQtyOverrides = new Map<string, RecipeIngredientQty>();
  // Map of recipe-packaging id → { ref, qty? } swap for this variant set.
  const packagingOverrides = new Map<
    string,
    { ref: IngredientRef; qty?: RecipeIngredientQty; dimensionId: string; optionId: string }
  >();

  for (const dim of recipe.variantDimensions ?? []) {
    if (dim.options.length === 0) continue;
    const explicit = input.selectedVariantOptions?.[dim.id];
    const picked: RecipeVariantOption | undefined =
      (explicit && dim.options.find((o) => o.id === explicit)) ||
      dim.options.find((o) => o.isDefault) ||
      dim.options[0];
    if (!picked) continue;
    variantSel[dim.id] = picked.id;

    for (const ov of picked.ingredientOverrides) {
      ingredientQtyOverrides.set(ov.recipeIngredientId, ov.qty);
    }
    for (const ov of picked.packagingOverrides) {
      packagingOverrides.set(ov.recipePackagingId, {
        ref: ov.ref,
        qty: ov.qty,
        dimensionId: dim.id,
        optionId: picked.id,
      });
    }
    // Most-specific override wins; later dimensions overwrite earlier
    // ones for the same channel. Two dimensions setting the same
    // channel price is uncommon but legal.
    if (picked.priceDineIn !== undefined) variantPricing.priceDineIn = picked.priceDineIn;
    if (picked.priceTakeaway !== undefined) variantPricing.priceTakeaway = picked.priceTakeaway;
    if (picked.priceDelivery !== undefined) variantPricing.priceDelivery = picked.priceDelivery;
  }

  // Pull groups + selected options for every group attached to the
  // recipe. We also pick up `isDefault` options when no override is
  // provided so default orders resolve correctly.
  const orderedSelections: Array<{ group: ModifierGroup; option: ModifierOption }> = [];
  for (const groupId of recipe.modifierGroupIds ?? []) {
    const group = findGroup(groupId);
    if (!group) {
      warnings.push(`Modifier group ${groupId} attached to recipe but not found in catalogue.`);
      continue;
    }
    const overridden = group.options.filter((o) => selectedIds.has(o.id));
    if (overridden.length === 0) {
      const defaults = group.options.filter((o) => o.isDefault);
      if (group.required && defaults.length === 0) {
        warnings.push(`Required modifier group "${group.name}" has no default and no selection — leaving blank.`);
      }
      defaults.forEach((opt) => orderedSelections.push({ group, option: opt }));
    } else {
      overridden.forEach((opt) => orderedSelections.push({ group, option: opt }));
    }
  }

  // ── Step 1 — slot map ────────────────────────────────────────────────────
  type LiveSlot = { slot: RecipeSlot; ref?: IngredientRef; qty?: Quantity };
  const slotMap = new Map<string, LiveSlot>();
  for (const slot of recipe.slots ?? []) {
    slotMap.set(slot.key, { slot, ref: slot.defaultRef, qty: slot.defaultQty });
  }
  for (const { group, option } of orderedSelections) {
    for (const eff of option.effects) {
      if (eff.kind !== 'set-slot') continue;
      const live = slotMap.get(eff.slotKey);
      if (!live) {
        warnings.push(`Modifier "${group.name} → ${option.name}" targets slot "${eff.slotKey}" which doesn't exist on "${recipe.name}".`);
        continue;
      }
      slotMap.set(eff.slotKey, {
        slot: live.slot,
        ref: eff.ref ?? live.ref,
        qty: eff.qty ?? live.qty,
      });
    }
  }

  // ── Step 2 — base + packaging lines (variant overrides applied) ──────────
  const lines: ResolvedLine[] = [];
  if (recipe.ingredientsV2) {
    for (const ri of recipe.ingredientsV2) {
      const override = ingredientQtyOverrides.get(ri.id);
      // Find which variant dimension/option set this override so the
      // source provenance points back at the right variant. We track
      // the last write only — multiple dimensions overriding the same
      // ingredient is rare and the last one wins (same as pricing).
      let variantSource: { dimensionId: string; optionId: string } | undefined;
      if (override) {
        for (const dim of recipe.variantDimensions ?? []) {
          const optionId = variantSel[dim.id];
          if (!optionId) continue;
          const opt = dim.options.find((o) => o.id === optionId);
          if (opt?.ingredientOverrides.some((o) => o.recipeIngredientId === ri.id)) {
            variantSource = { dimensionId: dim.id, optionId };
          }
        }
      }
      lines.push({
        id: newLineId(),
        ref: ri.ref,
        name: nameForRef(ri.ref),
        qty: override ?? pickRecipeIngredientQty(ri, siteId),
        source: variantSource
          ? { kind: 'variant-ingredient', dimensionId: variantSource.dimensionId, optionId: variantSource.optionId }
          : { kind: 'recipe-base' },
      });
    }
  }
  // Packaging is just another kind of product the order consumes, so
  // it goes into the same line list as ingredients. Modifier effects
  // (replace / add / scale) therefore work on packaging too — e.g.
  // Large coffee → replace 8oz cup with 12oz cup.
  if (recipe.packagingV2) {
    for (const ri of recipe.packagingV2) {
      const swap = packagingOverrides.get(ri.id);
      lines.push({
        id: newLineId(),
        ref: swap?.ref ?? ri.ref,
        name: nameForRef(swap?.ref ?? ri.ref),
        qty: swap?.qty ?? pickRecipeIngredientQty(ri, siteId),
        source: swap
          ? {
              kind: 'variant-packaging',
              dimensionId: swap.dimensionId,
              optionId: swap.optionId,
              replacedRef: ri.ref,
            }
          : { kind: 'recipe-packaging' },
      });
    }
  }

  // ── Step 2b — slot lines (modifier-driven recipes + recipes whose
  //               composition relies on a slot ingredient) ────────────────
  for (const [, live] of slotMap) {
    if (!live.ref) continue;
    // Skip if the recipe already provides this ingredient — slot is
    // just a hint for modifier targeting, not a duplicate row.
    const dupe = lines.some((ln) => refsShareMaster(ln.ref, live.ref!));
    if (dupe) continue;
    if (!live.qty) {
      warnings.push(`Slot "${live.slot.label}" has no quantity (waiting on a modifier choice).`);
      continue;
    }
    lines.push({
      id: newLineId(),
      ref: live.ref,
      name: nameForRef(live.ref),
      qty: live.qty,
      source: { kind: 'slot', slotKey: live.slot.key },
    });
  }

  // ── Step 3 — replace effects ─────────────────────────────────────────────
  for (const { group, option } of orderedSelections) {
    for (const eff of option.effects) {
      if (eff.kind !== 'replace') continue;
      const target = lines.find((ln) => refsShareMaster(ln.ref, eff.from));
      if (!target) continue;
      const replacedRef = target.ref;
      target.ref = eff.to;
      target.name = nameForRef(eff.to);
      if (eff.qtyMode !== 'same') target.qty = eff.qtyMode.qty;
      target.source = {
        kind: 'modifier-replace',
        groupId: group.id,
        optionId: option.id,
        replacedRef,
      };
    }
  }

  // ── Step 4 — add effects ─────────────────────────────────────────────────
  for (const { group, option } of orderedSelections) {
    for (const eff of option.effects) {
      if (eff.kind !== 'add') continue;
      lines.push({
        id: newLineId(),
        ref: eff.ref,
        name: nameForRef(eff.ref),
        qty: eff.qty,
        source: { kind: 'modifier-add', groupId: group.id, optionId: option.id },
      });
    }
  }

  // ── Step 5 — scale effects ───────────────────────────────────────────────
  for (const { group, option } of orderedSelections) {
    for (const eff of option.effects) {
      if (eff.kind !== 'scale') continue;
      const targets = eff.targetMasterProductIds && eff.targetMasterProductIds.length > 0
        ? new Set(eff.targetMasterProductIds)
        : null;
      for (const ln of lines) {
        if (targets) {
          const r = resolveIngredientRef(ln.ref);
          if (!r?.masterProductId || !targets.has(r.masterProductId)) continue;
        }
        ln.qty = { value: ln.qty.value * eff.factor, unit: ln.qty.unit };
        ln.source = {
          kind: 'modifier-scale',
          groupId: group.id,
          optionId: option.id,
          factor: eff.factor,
        };
      }
    }
  }

  const priceDelta = orderedSelections.reduce(
    (sum, { option }) => sum + (option.priceDelta ?? 0),
    0,
  );

  return {
    recipeId: recipe.id,
    siteId,
    selectedOptionIds: Array.from(selectedIds),
    selectedVariantOptions: variantSel,
    lines,
    priceDelta,
    variantPricing,
    warnings,
  };
}

/**
 * Convenience: pick the default-selected option ids for every modifier
 * group attached to a recipe.
 */
export function defaultSelectionFor(recipe: Recipe): string[] {
  const out: string[] = [];
  for (const groupId of recipe.modifierGroupIds ?? []) {
    const group = findGroup(groupId);
    if (!group) continue;
    for (const opt of group.options) {
      if (opt.isDefault) out.push(opt.id);
    }
  }
  return out;
}

/**
 * Convenience: pick the default option for every variant dimension on a
 * recipe — uses the `isDefault: true` option per dimension, falling
 * back to the first option. Returns `{}` for recipes with no variants.
 */
export function defaultVariantSelectionFor(recipe: Recipe): Record<string, string> {
  const out: Record<string, string> = {};
  for (const dim of recipe.variantDimensions ?? []) {
    if (dim.options.length === 0) continue;
    const picked = dim.options.find((o) => o.isDefault) ?? dim.options[0];
    out[dim.id] = picked.id;
  }
  return out;
}

export type { ModifierGroup, ModifierOption, RecipeVariantDimension };
export { findGroup, findOption };
