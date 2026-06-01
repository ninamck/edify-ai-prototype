import type { BlastRadiusLine } from '@/components/Feed/taskHistoryStore';
import type { Recipe } from '@/components/Recipe/libraryFixtures';

/**
 * Hypothetical-or-actual blast radius for the product-swap wizard.
 *
 * Shared between the preview card (what would happen) and the
 * confirm-time differ (what just happened). Same inputs, same maths —
 * keeps the card honest about the number the user will see in the
 * Activity log afterwards.
 *
 * Limitation: the cost-shift calculation uses the per-unit pack-cost
 * delta as a proxy for the recipe's ingredient cost change. We don't
 * re-resolve through `ingredientsV2` or per-recipe quantities, so this
 * is a directional estimate rather than a precise figure. Surface
 * copy should call that out.
 */
export interface ProductSwapBlastInput {
  mode: 'add' | 'replace';
  oldPackCost?: number;
  oldPackQty?: number;
  newPackCost?: number;
  newPackQty?: number;
  /** Recipes that will be (or were) affected by the swap. */
  affectedRecipes: Recipe[];
}

export function computeProductSwapBlastRadius(
  input: ProductSwapBlastInput,
): BlastRadiusLine[] {
  const lines: BlastRadiusLine[] = [];
  if (
    input.mode === 'replace' &&
    input.oldPackCost &&
    input.newPackCost &&
    input.oldPackCost > 0 &&
    input.newPackCost > 0
  ) {
    const unitCostBefore = input.oldPackCost / Math.max(input.oldPackQty ?? 1, 1);
    const unitCostAfter = input.newPackCost / Math.max(input.newPackQty ?? 1, 1);
    const delta = unitCostAfter - unitCostBefore;
    if (Math.abs(delta) > 0.001) {
      for (const r of input.affectedRecipes) {
        if (!r.priceDineIn || r.priceDineIn <= 0) continue;
        const gpBefore = ((r.priceDineIn - r.ingredientCost) / r.priceDineIn) * 100;
        const newCost = r.ingredientCost + delta;
        const gpAfter = ((r.priceDineIn - newCost) / r.priceDineIn) * 100;
        const lineDelta = +(gpAfter - gpBefore).toFixed(2);
        if (Math.abs(lineDelta) < 0.05) continue;
        lines.push({
          metric: 'gp_pct',
          entityLabel: r.name,
          before: +gpBefore.toFixed(1),
          after: +gpAfter.toFixed(1),
          delta: lineDelta,
          unit: 'pp',
        });
      }
    }
  }
  lines.push({
    metric: 'recipes_affected',
    entityLabel: input.mode === 'replace' ? 'Replace target' : 'Add target',
    before: 0,
    after: input.affectedRecipes.length,
    delta: input.affectedRecipes.length,
  });
  lines.sort((a, b) => {
    if (a.metric === 'recipes_affected') return 1;
    if (b.metric === 'recipes_affected') return -1;
    return Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0);
  });
  return lines;
}

/** Average GP% delta across all gp_pct lines (excluding the
 *  recipes_affected summary). Returned signed, in percentage points. */
export function averageGpDelta(lines: BlastRadiusLine[]): number | null {
  const gp = lines.filter((l) => l.metric === 'gp_pct');
  if (gp.length === 0) return null;
  const sum = gp.reduce((acc, l) => acc + (l.delta ?? 0), 0);
  return +(sum / gp.length).toFixed(2);
}

/** The single biggest (largest |delta|) GP impact line, or null. */
export function worstGpLine(lines: BlastRadiusLine[]): BlastRadiusLine | null {
  const gp = lines.filter((l) => l.metric === 'gp_pct');
  if (gp.length === 0) return null;
  return gp.reduce((worst, l) =>
    Math.abs(l.delta ?? 0) > Math.abs(worst.delta ?? 0) ? l : worst,
  );
}
