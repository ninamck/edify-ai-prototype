/**
 * applyModifiers — flatten a (menu item + selected options + site)
 * triple into a `ResolvedComposition`: the concrete list of
 * ingredient lines that should be deducted from stock when this
 * order fires.
 *
 * This is the single function consumers (costing, production planning,
 * the menu-item preview, POS event handlers) call to know "what does
 * this order actually use?". By centralising the rules here, the rest
 * of the system only ever speaks in resolved compositions.
 *
 * Effect application order (deterministic):
 *   1. Start with the recipe's ingredient list (via the slot lookup
 *      where applicable).
 *   2. Apply `set-slot` effects — these change the composition's slot
 *      ingredient + qty before any other math runs.
 *   3. Apply `replace` effects — swap ingredients in place.
 *   4. Apply `add` effects — append new ingredients.
 *   5. Apply `scale` effects — multiply quantities (last so it picks
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
} from '@/components/Recipe/libraryFixtures';
import type {
  IngredientEffect,
  ModifierGroup,
  ModifierOption,
  Quantity,
} from '@/components/Modifiers/types';
import { findGroup, findOption } from '@/components/Modifiers/store';
import {
  resolveIngredientRef,
  type IngredientRef,
} from '@/components/Ingredients/catalogue';
import type { MenuItem, MenuItemSlot } from './types';

export type ResolvedLine = {
  /** Stable line id for diffing in previews. */
  id: string;
  /** The ingredient ref used for this line (master or product). */
  ref: IngredientRef;
  /** Display name pulled via the catalogue. */
  name: string;
  /** Quantity for this order, after all modifier effects + site
   *  overrides have been applied. */
  qty: Quantity;
  /** Provenance — useful for debugging and the preview's "why is this
   *  here?" affordance. */
  source:
    | { kind: 'recipe-base' }
    | { kind: 'slot'; slotKey: string }
    | { kind: 'modifier-add'; groupId: string; optionId: string }
    | { kind: 'modifier-replace'; groupId: string; optionId: string; replacedRef: IngredientRef }
    | { kind: 'modifier-scale'; groupId: string; optionId: string; factor: number };
};

export type ResolvedComposition = {
  menuItemId: string;
  recipeId?: string;
  siteId?: string;
  selectedOptionIds: string[];
  lines: ResolvedLine[];
  /** Sum of priceDeltas from selected options, before VAT. */
  priceDelta: number;
  /** Issues encountered while resolving (missing slots, dangling refs,
   *  etc.). UI surfaces these as warnings rather than failing hard. */
  warnings: string[];
};

function refKey(ref: IngredientRef): string {
  return ref.kind === 'master' ? `m:${ref.masterProductId}` : `p:${ref.productId}`;
}

function refsEqual(a: IngredientRef, b: IngredientRef): boolean {
  return refKey(a) === refKey(b);
}

function nameForRef(ref: IngredientRef): string {
  return resolveIngredientRef(ref)?.name ?? '(unknown ingredient)';
}

/** Resolve "do these refs target the same underlying master?" — used
 *  by replace + scale effects so a `replace { from: master X }` can
 *  match a recipe row that picked a Product whose masterProductId
 *  is X. */
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
  menuItem: MenuItem;
  recipe?: Recipe;
  selectedOptionIds: string[];
  siteId?: string;
  /** Optional override map of group → option (single-select) for use
   *  when callers know the resolved picks but haven't flattened them
   *  to a list. The `selectedOptionIds` arg above is canonical;
   *  this one is appended. */
  selectedByGroup?: Record<string, string[]>;
}): ResolvedComposition {
  const { menuItem, recipe, siteId } = input;
  const warnings: string[] = [];

  // Flatten the selected option ids — preserve declared order across groups
  // so deterministic effect application is possible.
  const selectedIds = new Set(input.selectedOptionIds);
  if (input.selectedByGroup) {
    for (const ids of Object.values(input.selectedByGroup)) {
      for (const id of ids) selectedIds.add(id);
    }
  }

  // Look up groups + selected options for every group attached to the
  // menu item (so we also pick up `isDefault` options when no override
  // is provided).
  const orderedSelections: Array<{ group: ModifierGroup; option: ModifierOption }> = [];
  for (const groupId of menuItem.modifierGroupIds) {
    const group = findGroup(groupId);
    if (!group) {
      warnings.push(`Modifier group ${groupId} attached to menu item but not found in catalogue.`);
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
  // Build the live slot map. Modifier `set-slot` effects update this
  // map BEFORE we materialise the recipe lines, so the ref / qty used
  // for the slot reflects the customer's pick.
  type LiveSlot = { slot: MenuItemSlot; ref?: IngredientRef; qty?: Quantity };
  const slotMap = new Map<string, LiveSlot>();
  for (const slot of menuItem.slots) {
    slotMap.set(slot.key, { slot, ref: slot.defaultRef, qty: slot.defaultQty });
  }
  for (const { group, option } of orderedSelections) {
    for (const eff of option.effects) {
      if (eff.kind !== 'set-slot') continue;
      const live = slotMap.get(eff.slotKey);
      if (!live) {
        warnings.push(`Modifier "${group.name} → ${option.name}" targets slot "${eff.slotKey}" which doesn't exist on "${menuItem.name}".`);
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
  // Read the typed ingredient list (post-rethink) when present. The legacy
  // free-text `recipe.ingredients` array is intentionally NOT consumed
  // here — those rows can't be resolved to a master / product ref.
  if (recipe?.ingredientsV2) {
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

  // ── Step 1b — slot lines (modifier-driven items + recipes whose
  //               composition relies on a slot ingredient) ────────────────
  for (const [, live] of slotMap) {
    if (!live.ref) continue;
    // Skip if the recipe already provides this ingredient (slot is just
    // a hint for modifier targeting, not a duplicate row).
    const dupe = lines.some((ln) => refsShareMaster(ln.ref, live.ref!));
    if (dupe) continue;
    if (!live.qty) {
      // No qty — likely a required-but-not-yet-set slot. Surface as a
      // warning rather than silently dropping.
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

  // ── Price delta sum ──────────────────────────────────────────────────────
  const priceDelta = orderedSelections.reduce(
    (sum, { option }) => sum + (option.priceDelta ?? 0),
    0,
  );

  return {
    menuItemId: menuItem.id,
    recipeId: recipe?.id,
    siteId,
    selectedOptionIds: Array.from(selectedIds),
    lines,
    priceDelta,
    warnings,
  };
}

/**
 * Convenience: pick the default-selected option ids for every modifier
 * group attached to a menu item. Used by the editor preview's "show me
 * what a default order looks like" mode.
 */
export function defaultSelectionFor(menuItem: MenuItem): string[] {
  const out: string[] = [];
  for (const groupId of menuItem.modifierGroupIds) {
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
