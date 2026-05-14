/**
 * Downstream-impact preview for a manager's forecast adjustment.
 *
 * The narrative on the Forecast page is "every other tool reacts to the
 * number you set here." This file does the actual reaction maths in
 * pure functions so the page can show the cascade as soon as a stepper
 * is touched — no commits, no plan mutation.
 *
 * Three flavours of impact, in priority order:
 *   1. Ingredient consumption — qty delta × per-unit usage, summed
 *      across the recipe and its sub-recipes (one level deep).
 *   2. Hub-spoke allocation — when the active site is a Hub, the delta
 *      changes what the hub has to bake for each linked receiver.
 *   3. Bench schedule (informational) — recipe category alone is enough
 *      to say "this affects the bench plan" without re-running the
 *      allocator; the narrative is what matters, not the bench id.
 *
 * Returned data is intentionally a typed list of strongly-shaped
 * impacts so the UI can render them as chips / lines without doing any
 * arithmetic itself.
 */

import {
  getIngredient,
  getRecipe,
  getSite,
  ingredientUsageFor,
  linkedReceiversFor,
  productionItemsAt,
  type IngredientId,
  type RecipeId,
  type SiteId,
  type SkuId,
} from '@/components/Production/fixtures';

export type IngredientImpact = {
  ingredientId: IngredientId;
  ingredientName: string;
  /** Absolute change in canonical-unit qty (g / ml / unit). Negative = needs less. */
  deltaQty: number;
  /** Canonical unit of the ingredient. */
  unit: 'g' | 'ml' | 'unit';
  /** Pretty-printed for chip captions — e.g. "+0.8 kg" or "+24 units". */
  prettyDelta: string;
  /** Source recipe(s) that drove this delta — for tooltips. */
  via: { recipeId: RecipeId; recipeName: string }[];
};

export type SpokeImpact = {
  spokeId: SiteId;
  spokeName: string;
  deltaUnits: number;
};

export type BenchImpact = {
  /** Category bucket — bench scheduling lives one level above SKU. */
  category: string;
  /** A one-line caption the UI can stamp into the chip row. */
  caption: string;
};

export type DownstreamImpact = {
  skuId: SkuId;
  deltaUnits: number;
  ingredients: IngredientImpact[];
  spokes: SpokeImpact[];
  bench?: BenchImpact;
  /** True when there's nothing material to show — the narrative collapses. */
  isEmpty: boolean;
};

/**
 * Compute the cascade for a single SKU adjustment at `siteId` of
 * `deltaUnits` (positive = more units forecast / committed). `deltaUnits`
 * of 0 returns an empty impact so callers can render the same component
 * regardless of whether the manager has touched the stepper.
 *
 * For ingredients we walk the recipe and its sub-recipes (one level
 * deep, matching the existing AmountsView constraint cascade). Each
 * ingredient's per-unit consumption is multiplied by `deltaUnits` and
 * tagged with the contributing recipe(s) so the UI can show provenance.
 *
 * For hub-spoke we read `salesFactor` off every linked receiver — each
 * spoke "owes" us a fraction of the day's bake, so a +10 hub forecast
 * means roughly +`salesFactor*10` extra units to dispatch to that spoke.
 * Spokes whose factor would round their delta to 0 are dropped to keep
 * the chip row terse.
 */
export function computeDownstreamImpact(
  siteId: SiteId,
  skuId: SkuId,
  deltaUnits: number,
): DownstreamImpact {
  if (deltaUnits === 0) {
    return {
      skuId,
      deltaUnits,
      ingredients: [],
      spokes: [],
      bench: undefined,
      isEmpty: true,
    };
  }

  // Resolve the SKU's primary recipe from the site (or the parent hub
  // when the active site doesn't bake it itself). This is a best-effort
  // lookup — if the SKU genuinely isn't on this site or its hub's
  // production list (e.g. a forecast-only line for catering), we still
  // surface the empty impact so the UI doesn't break.
  const recipe = resolveRecipeForSku(siteId, skuId);
  const ingredients: IngredientImpact[] = [];

  if (recipe) {
    const ingredientAccum = new Map<
      IngredientId,
      { unit: 'g' | 'ml' | 'unit'; delta: number; via: Set<RecipeId> }
    >();

    // Walk this recipe's direct ingredient usage…
    accumulateUsage(ingredientAccum, recipe.id, deltaUnits);

    // …and the sub-recipes' usage. We multiply by the sub-recipe's
    // declared per-unit count (treating gram-based sub-recipes as a
    // proportional pull on the parent's qty). For the prototype we
    // approximate this as 1:1 because sub-recipe per-unit ratios are
    // already baked into the ingredient quantities — the goal is a
    // narrative, not an accounting ledger.
    for (const sub of recipe.subRecipes ?? []) {
      accumulateUsage(ingredientAccum, sub.recipeId, deltaUnits);
    }

    for (const [ingId, agg] of ingredientAccum.entries()) {
      const ing = getIngredient(ingId);
      if (!ing) continue;
      ingredients.push({
        ingredientId: ingId,
        ingredientName: ing.name,
        deltaQty: agg.delta,
        unit: agg.unit,
        prettyDelta: formatIngredientDelta(agg.delta, agg.unit),
        via: Array.from(agg.via)
          .map(rid => {
            const r = getRecipe(rid);
            return r ? { recipeId: rid, recipeName: r.name } : undefined;
          })
          .filter((v): v is { recipeId: RecipeId; recipeName: string } => !!v),
      });
    }

    // Sort ingredients with the biggest absolute change first — the
    // operator's attention should land on the binding ones.
    ingredients.sort((a, b) => Math.abs(b.deltaQty) - Math.abs(a.deltaQty));
  }

  // Hub-spoke: only meaningful when the active site is the Hub. Spokes
  // looking at their own forecast don't change anyone else's bake — the
  // hub's number is the upstream lever.
  const spokes: SpokeImpact[] = [];
  const site = getSite(siteId);
  if (site?.type === 'HUB') {
    const receivers = linkedReceiversFor(siteId);
    for (const r of receivers) {
      const factor = r.salesFactor ?? 0.4;
      const spokeDelta = Math.round(deltaUnits * factor);
      if (spokeDelta === 0) continue;
      spokes.push({
        spokeId: r.id,
        spokeName: r.name,
        deltaUnits: spokeDelta,
      });
    }
    spokes.sort((a, b) => Math.abs(b.deltaUnits) - Math.abs(a.deltaUnits));
  }

  const bench: BenchImpact | undefined = recipe
    ? {
        category: recipe.category,
        // Narrative-only: we don't try to recompute the bench plan.
        // The phrasing changes if the adjustment is tiny vs. material —
        // tiny moves land within an existing run / batch rule rounding,
        // so we tell the operator that explicitly.
        caption:
          Math.abs(deltaUnits) < 4
            ? `${recipe.category} bench plan absorbs ${signed(deltaUnits)} within existing batches`
            : `${signed(deltaUnits)} on the ${recipe.category} bench schedule`,
      }
    : undefined;

  return {
    skuId,
    deltaUnits,
    ingredients,
    spokes,
    bench,
    isEmpty: ingredients.length === 0 && spokes.length === 0,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function resolveRecipeForSku(siteId: SiteId, skuId: SkuId) {
  // Prefer the site's own production items — they reference the recipe
  // id directly via `productionItemsAt`. Fall back to the parent hub
  // when the site doesn't bake the SKU itself (typical for spokes /
  // hybrids / linked standalones).
  const site = getSite(siteId);
  const hit = findRecipeAtSite(siteId, skuId);
  if (hit) return hit;
  if (site?.hubId) {
    const fallback = findRecipeAtSite(site.hubId, skuId);
    if (fallback) return fallback;
  }
  return undefined;
}

function findRecipeAtSite(siteId: SiteId, skuId: SkuId) {
  for (const item of productionItemsAt(siteId)) {
    if (item.skuId === skuId) {
      return getRecipe(item.recipeId);
    }
  }
  return undefined;
}

function accumulateUsage(
  acc: Map<IngredientId, { unit: 'g' | 'ml' | 'unit'; delta: number; via: Set<RecipeId> }>,
  recipeId: RecipeId,
  units: number,
) {
  for (const usage of ingredientUsageFor(recipeId)) {
    const existing = acc.get(usage.ingredientId);
    const delta = usage.quantityPerUnit * units;
    if (existing) {
      existing.delta += delta;
      existing.via.add(recipeId);
    } else {
      const via = new Set<RecipeId>();
      via.add(recipeId);
      acc.set(usage.ingredientId, { unit: usage.unit, delta, via });
    }
  }
}

function formatIngredientDelta(delta: number, unit: 'g' | 'ml' | 'unit'): string {
  const sign = delta >= 0 ? '+' : '−';
  const abs = Math.abs(delta);
  if (unit === 'unit') {
    return `${sign}${Math.round(abs)} ${abs === 1 ? 'unit' : 'units'}`;
  }
  if (abs >= 1000) {
    const value = abs / 1000;
    const pretty = value >= 10 ? value.toFixed(0) : value.toFixed(1);
    return `${sign}${pretty} ${unit === 'g' ? 'kg' : 'L'}`;
  }
  return `${sign}${Math.round(abs)} ${unit === 'g' ? 'g' : 'ml'}`;
}

function signed(n: number): string {
  if (n === 0) return '0 units';
  return n > 0 ? `+${n} units` : `${n} units`;
}
