import type { ChangeRecord } from '@/components/Feed/taskHistoryStore';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import type { RecipeEditKind } from '@/components/Feed/commands/parsers';

/**
 * Diff for the recipe-edit wizard (add / swap / remove an ingredient).
 *
 * We only touch the legacy free-text `ingredients` array in the
 * prototype (matches what `confirmRecipeEdit` actually mutates), so the
 * diff is a single ChangeRecord against `ingredients` with `before` /
 * `after` as the full row arrays. The renderer ('ChangeDiff') summarises
 * array diffs as added / removed counts; this keeps us honest without
 * pretending we have row-level uniqueness.
 */
export function diffRecipeEdit(args: {
  before: Recipe;
  after: Recipe;
  final: {
    recipeId: string;
    recipeName: string;
    kind: RecipeEditKind;
    fromName?: string;
    toName?: string;
    qty?: number;
    uom?: string;
  };
}): ChangeRecord[] {
  const { before, after, final } = args;
  const fieldLabel =
    final.kind === 'add' ? 'Ingredient added' :
    final.kind === 'remove' ? 'Ingredient removed' :
    'Ingredient swapped';
  return [
    {
      entityType: 'recipe',
      entityId: final.recipeId,
      entityLabel: final.recipeName,
      fieldPath: 'ingredients',
      fieldLabel,
      before: before.ingredients ?? [],
      after: after.ingredients ?? [],
      valueKind: 'array',
    },
  ];
}
