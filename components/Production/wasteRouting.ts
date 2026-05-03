import type { ProductionBatch, RecipeId, SpokeRejectLine } from './fixtures';
import { getProductionItem, getRecipe } from './fixtures';

/**
 * Best-effort mapping from production recipes → existing waste-log products.
 * V1 is deliberately sparse; unmatched recipes fall back to a generic id so
 * the waste form can still open with a sensible default.
 */
const RECIPE_TO_WASTE_PRODUCT: Partial<Record<RecipeId, string>> = {
  'prec-croissant': 'croissant-plain',
  'prec-pain-au-chocolat': 'croissant-almond',
  'prec-cookies': 'muffin-chocolate',
  'prec-club-sandwich': 'baguette-hamcheese',
  'prec-salad-chicken-caesar': 'baguette-veggie',
};

/**
 * Build a deep-link to /log-waste for a given failed production batch.
 * Uses query params consumed by app/log-waste/page.tsx.
 */
export function wasteLogUrlForBatch(batch: ProductionBatch): string {
  const item = getProductionItem(batch.productionItemId);
  const recipe = item ? getRecipe(item.recipeId) : undefined;
  const wasteProductId =
    (recipe && RECIPE_TO_WASTE_PRODUCT[recipe.id]) ?? 'croissant-plain';

  const params = new URLSearchParams({
    itemId: wasteProductId,
    qty: String(batch.actualQty),
    reason: 'damaged', // failed production → damaged in waste taxonomy
  });
  return `/log-waste?${params.toString()}`;
}

/**
 * Build a deep-link to /log-waste for a single spoke reject line (PAC141 —
 * "captures recorded information of rejects under Hub waste"). Reuses the
 * recipe → waste-product mapping above, with `damaged` as the default
 * waste reason when the spoke didn't pick a specific one.
 */
export function wasteLogUrlForRejectLine(line: SpokeRejectLine, recordedAtISO?: string): string {
  const recipe = getRecipe(line.recipeId);
  const wasteProductId =
    (recipe && RECIPE_TO_WASTE_PRODUCT[recipe.id]) ?? 'croissant-plain';
  const params = new URLSearchParams({
    itemId: wasteProductId,
    qty: String(line.rejectedUnits),
    reason: line.reason === 'damaged' ? 'damaged' : line.reason === 'short-life' ? 'expired' : 'damaged',
  });
  if (recordedAtISO) params.set('source', 'spoke-reject');
  return `/log-waste?${params.toString()}`;
}

export { RECIPE_TO_WASTE_PRODUCT };
