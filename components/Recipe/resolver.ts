/**
 * applyModifiers — flatten a (recipe + selected options + site)
 * triple into a `ResolvedComposition`: the concrete list of
 * ingredient lines that should be deducted from stock when this
 * order fires.
 *
 * Post-merge: a Recipe IS the sellable unit. The MenuItem entity is gone.
 * The recipe carries its own `slots` and `modifierGroupIds`, and this
 * resolver folds them together with the customer's selections and the
 * site context to produce a deterministic line list.
 *
 * Effect application order (deterministic):
 *   1. Start with the recipe's typed ingredient list (`ingredientsV2`).
 *   2. Apply `set-slot` effects — these update the live slot map BEFORE
 *      lines are materialised, so the spirit / wine / size patterns work.
 *   3. Add slot lines for slots that don't duplicate a recipe ingredient.
 *   4. Apply `replace` effects — swap ingredients in place.
 *   5. Apply `add` effects — append new ingredients.
 *   6. Apply `scale` effects — multiply quantities (last so it picks
 *      up adds and replaces).
 *
 * Site overrides:
 *   - When a `RecipeIngredient` has `siteOverrides[siteId]`, that qty
 *     wins over the base qty for the resolved line.
 */

import type {
  Recipe,
  RecipeIngredient,
  RecipeIngredientQty,
  RecipeSlot,
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
    | { kind: 'slot'; slotKey: string }
    | { kind: 'modifier-add'; groupId: string; optionId: string }
    | { kind: 'modifier-replace'; groupId: string; optionId: string; replacedRef: IngredientRef }
    | { kind: 'modifier-scale'; groupId: string; optionId: string; factor: number };
};

export type ResolvedComposition = {
  recipeId: string;
  siteId?: string;
  selectedOptionIds: string[];
  lines: ResolvedLine[];
  priceDelta: number;
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
}): ResolvedComposition {
  const { recipe, siteId } = input;
  const warnings: string[] = [];

  const selectedIds = new Set(input.selectedOptionIds);
  if (input.selectedByGroup) {
    for (const ids of Object.values(input.selectedByGroup)) {
      for (const id of ids) selectedIds.add(id);
    }
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

  // ── Step 0 — slot map ────────────────────────────────────────────────────
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

  // ── Step 1 — base lines from the recipe ──────────────────────────────────
  const lines: ResolvedLine[] = [];
  if (recipe.ingredientsV2) {
    for (const ri of recipe.ingredientsV2) {
      lines.push({
        id: newLineId(),
        ref: ri.ref,
        name: nameForRef(ri.ref),
        qty: pickRecipeIngredientQty(ri, siteId),
        source: { kind: 'recipe-base' },
      });
    }
  }
  // Packaging is just another kind of product the order consumes, so
  // it goes into the same line list as ingredients. Modifier effects
  // (replace / add / scale) therefore work on packaging too — e.g.
  // Large coffee → replace 8oz cup with 12oz cup.
  if (recipe.packagingV2) {
    for (const ri of recipe.packagingV2) {
      lines.push({
        id: newLineId(),
        ref: ri.ref,
        name: nameForRef(ri.ref),
        qty: pickRecipeIngredientQty(ri, siteId),
        source: { kind: 'recipe-packaging' },
      });
    }
  }

  // ── Step 1b — slot lines (modifier-driven recipes + recipes whose
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

  // ── Step 2 — replace effects ─────────────────────────────────────────────
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

  // ── Step 3 — add effects ─────────────────────────────────────────────────
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

  // ── Step 4 — scale effects ───────────────────────────────────────────────
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
    lines,
    priceDelta,
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

export type { ModifierGroup, ModifierOption };
export { findGroup, findOption };
