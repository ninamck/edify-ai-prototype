import type { ChangeRecord } from '@/components/Feed/taskHistoryStore';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import type { MenuAction } from '@/components/Feed/commands/parsers';

/**
 * Diff for the menu command — sets price or flips POS availability.
 *
 * Price changes write three identical channel prices (dineIn /
 * takeaway / delivery) so we emit one ChangeRecord against `priceDineIn`
 * as the canonical line and skip the channel duplicates. If we ever
 * support per-channel pricing this should fan out into three records.
 */
export function diffMenu(args: {
  before: Recipe;
  after: Recipe;
  final: {
    recipeId: string;
    recipeName: string;
    action: MenuAction;
    price?: number;
    priceDelta?: number;
    previousPrice: number;
    previousAvailable: boolean;
  };
}): ChangeRecord[] {
  const { before, after, final } = args;
  const changes: ChangeRecord[] = [];

  if (final.action === 'availability-off' || final.action === 'availability-on') {
    changes.push({
      entityType: 'recipe',
      entityId: final.recipeId,
      entityLabel: final.recipeName,
      fieldPath: 'posLinked',
      fieldLabel: 'POS availability',
      before: before.posLinked ?? false,
      after: after.posLinked ?? false,
      valueKind: 'boolean',
    });
  } else if (final.action === 'price-set' || final.action === 'price-delta') {
    changes.push({
      entityType: 'recipe',
      entityId: final.recipeId,
      entityLabel: final.recipeName,
      fieldPath: 'priceDineIn',
      fieldLabel: 'Price (all channels)',
      before: before.priceDineIn,
      after: after.priceDineIn,
      unit: '$',
      valueKind: 'currency',
    });
    if (
      Math.abs((before.marginPct ?? 0) - (after.marginPct ?? 0)) > 0.01
    ) {
      changes.push({
        entityType: 'recipe',
        entityId: final.recipeId,
        entityLabel: final.recipeName,
        fieldPath: 'marginPct',
        fieldLabel: 'Dine-in margin',
        before: before.marginPct,
        after: after.marginPct,
        unit: '%',
        valueKind: 'number',
      });
    }
  }
  return changes;
}
