import type {
  ChangeRecord,
  BlastRadiusLine,
} from '@/components/Feed/taskHistoryStore';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import type { Product } from '@/components/Suppliers/fixtures';
import { computeProductSwapBlastRadius } from './productSwapBlastRadius';

/**
 * Per-recipe slice of a product-swap, written as a child Task by
 * `confirmProductSwap`. Each slice carries:
 *
 *   • `changes` — just the ingredient diff for this one recipe.
 *   • `blastRadius` — just this recipe's GP-impact line (if any).
 *   • `revertIntent` — a `recipe-edit`-shaped CommandIntent the
 *     existing Activity replay path can invert and re-confirm
 *     (`buildRevertArgs` already knows how to flip an add to a remove
 *     and a swap to its inverse). Storing the recipe-edit shape on
 *     the child means we don't need a new "single-recipe product-swap
 *     revert" code path — the swap-back happens through the same
 *     recipe-edit card the user already trusts.
 */
export interface RecipeSwapSlice {
  recipeId: string;
  recipeName: string;
  changes: ChangeRecord[];
  blastRadius: BlastRadiusLine[];
  revertIntent: {
    commandId: 'recipe-edit';
    cardMsgType: 'cmd-recipe-summary';
    args: {
      recipeId: string;
      recipeName: string;
      kind: 'add' | 'remove' | 'swap';
      fromName?: string;
      toName?: string;
      scope: 'all' | 'site';
      siteLabel?: string;
    };
  };
  /** Short headline for the child Task's title + receipt. */
  title: string;
}

/**
 * Diff + blast radius for the product-swap wizard.
 *
 * The wizard touches three stores at once (suppliers, products,
 * recipes). For audit purposes we now split the recording in two:
 *
 *   • The PARENT Task records the "global" effects — the new supplier
 *     (when minted) and the new product. Its blast radius is the
 *     aggregate GP impact across all recipes (so the parent row still
 *     shows the headline "average GP -1.2pp across 11 recipes").
 *
 *   • Each affected recipe gets its own CHILD Task (see
 *     `splitProductSwapPerRecipe`) carrying just that recipe's
 *     diff + blast-radius line + a focused revert intent.
 *
 * This function returns the parent slice. `splitProductSwapPerRecipe`
 * returns the children.
 */
export function diffProductSwap(args: {
  mode: 'add' | 'replace';
  newProduct: Product;
  oldProduct?: Product;
  newProductName: string;
  oldProductName?: string;
  supplierName: string;
  supplierCreated: boolean;
  recipesBefore: Recipe[];
  recipesAfter: Recipe[];
  affectedRecipeIds: string[];
}): { changes: ChangeRecord[]; blastRadius: BlastRadiusLine[] } {
  const {
    mode,
    newProduct,
    oldProduct,
    newProductName,
    supplierName,
    supplierCreated,
    recipesAfter,
    affectedRecipeIds,
  } = args;

  const changes: ChangeRecord[] = [];

  if (supplierCreated) {
    changes.push({
      entityType: 'supplier',
      entityId: newProduct.supplierId ?? 'unknown',
      entityLabel: supplierName,
      fieldPath: '__created__',
      fieldLabel: 'New supplier added',
      before: null,
      after: supplierName,
      valueKind: 'text',
    });
  }

  changes.push({
    entityType: 'product',
    entityId: newProduct.id,
    entityLabel: newProductName,
    fieldPath: '__created__',
    fieldLabel: 'New product added',
    before: null,
    after: newProductName,
    valueKind: 'text',
  });

  // Aggregate blast radius — same numbers as the in-chat preview card
  // so the parent row matches what the operator saw before confirming.
  const afterById = new Map(recipesAfter.map((r) => [r.id, r]));
  const affectedRecipes = affectedRecipeIds
    .map((id) => afterById.get(id))
    .filter((r): r is Recipe => Boolean(r));
  const blastRadius: BlastRadiusLine[] = computeProductSwapBlastRadius({
    mode,
    oldPackCost: oldProduct?.packCost,
    oldPackQty: oldProduct?.packQty,
    newPackCost: newProduct.packCost,
    newPackQty: newProduct.packQty,
    affectedRecipes,
  });

  return { changes, blastRadius };
}

/**
 * Per-recipe child slices for a product swap. The runner writes one
 * child Task per slice via `logChildTask`. Each child is independently
 * revertible — clicking Revert on a child row replays the slice's
 * `revertIntent` (a `recipe-edit` shape) through the chat, which
 * inverts via the existing `buildRevertArgs` path. The parent's
 * atomic snapshot undo is still available for batch rollback.
 */
export function splitProductSwapPerRecipe(args: {
  mode: 'add' | 'replace';
  newProduct: Product;
  oldProduct?: Product;
  newProductName: string;
  oldProductName?: string;
  recipesBefore: Recipe[];
  recipesAfter: Recipe[];
  affectedRecipeIds: string[];
  scope: 'all' | 'site';
  siteLabel?: string;
}): RecipeSwapSlice[] {
  const {
    mode,
    newProduct,
    oldProduct,
    newProductName,
    oldProductName,
    recipesBefore,
    recipesAfter,
    affectedRecipeIds,
    scope,
    siteLabel,
  } = args;

  const beforeById = new Map(recipesBefore.map((r) => [r.id, r]));
  const afterById = new Map(recipesAfter.map((r) => [r.id, r]));

  // Per-recipe GP-impact lines — reuse the same cost-delta math the
  // aggregate blast radius uses so parent + child numbers always
  // reconcile. We compute on a one-recipe slice so the child only sees
  // its own line.
  const sliceBlast = (after: Recipe): BlastRadiusLine[] =>
    computeProductSwapBlastRadius({
      mode,
      oldPackCost: oldProduct?.packCost,
      oldPackQty: oldProduct?.packQty,
      newPackCost: newProduct.packCost,
      newPackQty: newProduct.packQty,
      affectedRecipes: [after],
    }).filter((l) => l.metric === 'gp_pct');

  const slices: RecipeSwapSlice[] = [];
  for (const recipeId of affectedRecipeIds) {
    const before = beforeById.get(recipeId);
    const after = afterById.get(recipeId);
    if (!before || !after) continue;

    const verb =
      mode === 'replace' && oldProductName
        ? `${oldProductName} → ${newProductName}`
        : `Added ${newProductName}`;

    const change: ChangeRecord = {
      entityType: 'recipe',
      entityId: recipeId,
      entityLabel: after.name,
      fieldPath: 'ingredients',
      fieldLabel: verb,
      before: before.ingredients ?? [],
      after: after.ingredients ?? [],
      valueKind: 'array',
    };

    // Revert shape — recipe-edit owns this surface. For replace mode
    // the child reverts by swapping the new product back to the old.
    // For add mode the child reverts by removing the new product.
    // buildRevertArgs already knows how to flip both shapes, so we
    // store the FORWARD intent here and rely on the existing replay
    // path to invert it.
    const revertIntent: RecipeSwapSlice['revertIntent'] =
      mode === 'replace' && oldProductName
        ? {
            commandId: 'recipe-edit',
            cardMsgType: 'cmd-recipe-summary',
            args: {
              recipeId,
              recipeName: after.name,
              kind: 'swap',
              fromName: oldProductName,
              toName: newProductName,
              scope,
              siteLabel,
            },
          }
        : {
            commandId: 'recipe-edit',
            cardMsgType: 'cmd-recipe-summary',
            args: {
              recipeId,
              recipeName: after.name,
              kind: 'add',
              toName: newProductName,
              scope,
              siteLabel,
            },
          };

    const title =
      mode === 'replace' && oldProductName
        ? `Replaced ${oldProductName} with ${newProductName} · ${after.name}`
        : `Added ${newProductName} · ${after.name}`;

    slices.push({
      recipeId,
      recipeName: after.name,
      changes: [change],
      blastRadius: sliceBlast(after),
      revertIntent,
      title,
    });
  }
  return slices;
}
