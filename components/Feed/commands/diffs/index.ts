/**
 * Per-command diff helpers — translate a confirm-time before/after into
 * a list of structured `ChangeRecord`s for the Activity log.
 *
 * Each helper takes the same shape: the snapshot taken before the
 * mutation, the final args passed to the confirm function, and any
 * post-mutation state we want to read directly. It returns a
 * JSON-serialisable list of changes (and, where useful, a blast-radius
 * list — currently only product-swap computes one).
 *
 * Keeping these in a separate folder rather than inline in
 * `useCommandRunner.tsx` is deliberate: the runner is already 1.4k
 * lines, and each command's diff has its own taxonomy (production
 * fields vs supplier fields vs recipe edits) that's easier to evolve
 * in isolation.
 */

export { diffRecipeEdit } from './recipeEditDiff';
export { diffProduction } from './productionDiff';
export { diffMenu } from './menuDiff';
export { diffSupplier } from './supplierDiff';
export { diffProductSwap, splitProductSwapPerRecipe } from './productSwapDiff';
export type { RecipeSwapSlice } from './productSwapDiff';
export { diffWaste } from './wasteDiff';
export { diffStock } from './stockDiff';
export {
  computeProductSwapBlastRadius,
  averageGpDelta,
  worstGpLine,
} from './productSwapBlastRadius';
