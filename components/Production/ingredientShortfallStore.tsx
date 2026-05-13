'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  getRecipe,
  getSite,
  ingredientShortfallFor,
  PRET_INGREDIENT_SHORTFALL_SEEDS,
  submissionsForHub,
  type IngredientShortfallSeed,
  type SiteId,
  type SkuId,
} from './fixtures';

/**
 * In-memory store for *applied* ingredient shortfalls — the result of
 * the manager hitting "Adjust to capacity (pro-rata)" inside the
 * recipe focus drawer on the plan grid.
 *
 * Lifecycle for one (hub, recipe, forDate) triple:
 *   1. Seeded shortfall exists in fixtures (`PRET_INGREDIENT_SHORTFALL_SEEDS`).
 *      → row chip reads "Ingredient short — adjust" (warning tone).
 *   2. Manager taps Apply in the drawer
 *      → `apply()` writes a record here with the per-spoke pro-rata
 *        cuts. Row chip flips to "Cut applied · -N" (info tone),
 *        spoke-side nudge fires.
 *   3. Manager taps Undo (rare; mostly in case they applied by
 *      accident) → `undo()` removes the record. Row chip reverts to
 *      step 1.
 *
 * The seed itself stays in fixtures.ts and is never mutated; the
 * store only carries the applied state on top.
 */

/** One spoke's pro-rated allocation after the cut. */
export type AppliedShortfallLine = {
  spokeId: SiteId;
  /** Original ask before the cut. */
  requestedUnits: number;
  /** What the spoke gets after the pro-rata trim. */
  allocatedUnits: number;
  /** `requestedUnits - allocatedUnits` (always ≥ 0). */
  cutUnits: number;
};

export type AppliedIngredientShortfall = {
  /** Mirrors the seed id so consumers can join back to the
   *  static metadata (reason, bottleneck ingredient, etc.). */
  seedId: string;
  hubId: SiteId;
  recipeId: string;
  skuId: SkuId;
  forDate: string;
  /** Cap that drove the cut — copied off the seed so the record is
   *  self-contained even if the seed shape changes later. */
  availableUnits: number;
  /** Total units across all spoke requests *before* the cut. */
  totalRequestedUnits: number;
  /** Total units committed *after* the cut (≤ availableUnits). */
  totalAllocatedUnits: number;
  /** ISO timestamp the cut was applied at. */
  appliedAtISO: string;
  /** Per-spoke breakdown of who absorbed how much. */
  lines: AppliedShortfallLine[];
};

function recordKey(hubId: SiteId, recipeId: string, forDate: string): string {
  return `${hubId}:${recipeId}:${forDate}`;
}

/**
 * Pro-rata pure function. Takes a list of (spokeId, requestedUnits)
 * inputs + the available cap, returns the per-spoke allocation.
 *
 * Algorithm:
 *   1. If everyone fits under the cap, no cut — return inputs unchanged.
 *   2. Otherwise compute each spoke's *fractional* share of the cap
 *      (`requested / totalRequested * available`), floor it.
 *   3. Distribute the leftover units (from flooring) one at a time to
 *      the spokes with the largest fractional remainders. This means:
 *        - The cap is *exactly* respected (no floating-point drift).
 *        - The spoke with the biggest "rounded-down loss" gets the
 *          leftover unit, which feels fair vs. picking arbitrarily.
 *   4. `cutUnits` = `requested - allocated` for each row.
 *
 * Pure + deterministic; the row indicator and the drawer can both
 * call this on every render without flicker.
 */
export function computeProRataCut(
  inputs: Array<{ spokeId: SiteId; requestedUnits: number }>,
  availableUnits: number,
): AppliedShortfallLine[] {
  const totalRequested = inputs.reduce((acc, i) => acc + i.requestedUnits, 0);
  // No cut needed — return identity allocation.
  if (totalRequested <= availableUnits || totalRequested === 0) {
    return inputs.map(i => ({
      spokeId: i.spokeId,
      requestedUnits: i.requestedUnits,
      allocatedUnits: i.requestedUnits,
      cutUnits: 0,
    }));
  }
  // Floor each share, track the remainder so we can distribute the
  // residual fairly.
  const draft = inputs.map(i => {
    const exact = (i.requestedUnits / totalRequested) * availableUnits;
    const floor = Math.floor(exact);
    return {
      spokeId: i.spokeId,
      requestedUnits: i.requestedUnits,
      allocatedUnits: floor,
      remainder: exact - floor,
    };
  });
  let allocatedSoFar = draft.reduce((acc, d) => acc + d.allocatedUnits, 0);
  // Sort by remainder desc → those who lost the most to flooring get
  // the leftover units first. Break ties by larger original request.
  const orderForLeftover = [...draft].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return b.requestedUnits - a.requestedUnits;
  });
  let i = 0;
  while (allocatedSoFar < availableUnits && i < orderForLeftover.length) {
    const row = orderForLeftover[i];
    // Don't push a row above its requested ask.
    if (row.allocatedUnits < row.requestedUnits) {
      row.allocatedUnits += 1;
      allocatedSoFar += 1;
    }
    i += 1;
    // Wrap around if we've handed out one to everyone but still
    // have leftover (rare; only when the cap is very close to total).
    if (i >= orderForLeftover.length && allocatedSoFar < availableUnits) {
      i = 0;
    }
  }
  return draft.map(d => ({
    spokeId: d.spokeId,
    requestedUnits: d.requestedUnits,
    allocatedUnits: d.allocatedUnits,
    cutUnits: d.requestedUnits - d.allocatedUnits,
  }));
}

type Store = {
  applied: Record<string, AppliedIngredientShortfall>;
  /** Apply a pro-rata cut for one (hub, recipe, date) triple.
   *  `inputs` is the per-spoke ask the planner is cutting from. */
  apply: (args: {
    seedId: string;
    hubId: SiteId;
    recipeId: string;
    skuId: SkuId;
    forDate: string;
    availableUnits: number;
    inputs: Array<{ spokeId: SiteId; requestedUnits: number }>;
  }) => void;
  /** Drop a previously-applied cut. */
  undo: (hubId: SiteId, recipeId: string, forDate: string) => void;
  /** Read the applied record for a triple, if any. */
  get: (
    hubId: SiteId,
    recipeId: string,
    forDate: string,
  ) => AppliedIngredientShortfall | undefined;
  /** All applied cuts for a hub (used by the dispatch surface in
   *  future iterations; not consumed yet). */
  forHub: (hubId: SiteId) => AppliedIngredientShortfall[];
  /** All applied cuts where a spoke was on the receiving end —
   *  drives the spoke nudge feed + inline banner. */
  forSpoke: (spokeId: SiteId) => AppliedIngredientShortfall[];
};

const IngredientShortfallContext = createContext<Store | null>(null);

export function IngredientShortfallStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [applied, setApplied] = useState<
    Record<string, AppliedIngredientShortfall>
  >({});

  const apply = useCallback<Store['apply']>(({
    seedId,
    hubId,
    recipeId,
    skuId,
    forDate,
    availableUnits,
    inputs,
  }) => {
    const lines = computeProRataCut(inputs, availableUnits);
    const totalRequested = inputs.reduce((acc, i) => acc + i.requestedUnits, 0);
    const totalAllocated = lines.reduce((acc, l) => acc + l.allocatedUnits, 0);
    const k = recordKey(hubId, recipeId, forDate);
    setApplied(prev => ({
      ...prev,
      [k]: {
        seedId,
        hubId,
        recipeId,
        skuId,
        forDate,
        availableUnits,
        totalRequestedUnits: totalRequested,
        totalAllocatedUnits: totalAllocated,
        appliedAtISO: new Date().toISOString(),
        lines,
      },
    }));
  }, []);

  const undo = useCallback<Store['undo']>((hubId, recipeId, forDate) => {
    const k = recordKey(hubId, recipeId, forDate);
    setApplied(prev => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, []);

  const get = useCallback<Store['get']>(
    (hubId, recipeId, forDate) => applied[recordKey(hubId, recipeId, forDate)],
    [applied],
  );

  const forHub = useCallback<Store['forHub']>(
    hubId => Object.values(applied).filter(r => r.hubId === hubId),
    [applied],
  );

  const forSpoke = useCallback<Store['forSpoke']>(
    spokeId =>
      Object.values(applied).filter(r =>
        r.lines.some(l => l.spokeId === spokeId && l.cutUnits > 0),
      ),
    [applied],
  );

  const value = useMemo<Store>(
    () => ({ applied, apply, undo, get, forHub, forSpoke }),
    [applied, apply, undo, get, forHub, forSpoke],
  );

  return (
    <IngredientShortfallContext.Provider value={value}>
      {children}
    </IngredientShortfallContext.Provider>
  );
}

export function useIngredientShortfallStore(): Store {
  const ctx = useContext(IngredientShortfallContext);
  if (!ctx) {
    // Safe defaults — components used outside the provider get a
    // read-only store rather than crashing. Mirrors hubUnlockStore's
    // approach so the prototype stays demo-able everywhere.
    return {
      applied: {},
      apply: () => {},
      undo: () => {},
      get: () => undefined,
      forHub: () => [],
      forSpoke: () => [],
    };
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived hooks for the row indicator + drawer
// ─────────────────────────────────────────────────────────────────────────────

export type ShortfallStatus =
  | { kind: 'none' }
  | { kind: 'open';    seed: IngredientShortfallSeed }
  | { kind: 'applied'; seed: IngredientShortfallSeed; record: AppliedIngredientShortfall };

/**
 * Resolve the shortfall state for a (hub, recipe, date) triple in a
 * single call. Used by both the row chip (RecipeFirstGrid) and the
 * drawer section (RecipeFocusPanel) so the two surfaces never drift.
 */
export function useShortfallStatus(
  hubId: SiteId,
  recipeId: string,
  forDate: string,
): ShortfallStatus {
  const { get } = useIngredientShortfallStore();
  return useMemo(() => {
    const seed = ingredientShortfallFor(hubId, recipeId, forDate);
    if (!seed) return { kind: 'none' };
    const record = get(hubId, recipeId, forDate);
    if (record) return { kind: 'applied', seed, record };
    return { kind: 'open', seed };
  }, [hubId, recipeId, forDate, get]);
}

/**
 * Pre-compute the per-spoke inputs for the pro-rata cut by reading
 * each spoke's submitted (or Quinn-proposed) qty for this SKU on
 * `forDate`. Returns the inputs the manager would pass into `apply()`.
 *
 * Splitting this out makes the drawer's "Apply" button trivial — it
 * just calls `apply({ ...seed, availableUnits, inputs })` — and gives
 * the drawer a stable preview of the cut without the manager having
 * to commit.
 */
export function useShortfallInputs(
  hubId: SiteId,
  skuId: SkuId,
  forDate: string,
): Array<{ spokeId: SiteId; requestedUnits: number }> {
  return useMemo(() => {
    const submissions = submissionsForHub(hubId, forDate);
    const out: Array<{ spokeId: SiteId; requestedUnits: number }> = [];
    for (const sub of submissions) {
      const line = sub.lines.find(l => l.skuId === skuId);
      if (!line) continue;
      const units = line.confirmedUnits ?? line.quinnProposedUnits ?? 0;
      if (units <= 0) continue;
      out.push({ spokeId: sub.fromSiteId, requestedUnits: units });
    }
    return out;
  }, [hubId, skuId, forDate]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Spoke-facing nudges for QuinnProductionPanel
// ─────────────────────────────────────────────────────────────────────────────

export type ShortfallNudge = {
  id: string;
  tone: 'success' | 'warning' | 'info' | 'error';
  title: string;
  body: string;
  cta: { label: string; href: string };
};

/**
 * Spoke-facing: pinned while the hub has applied a cut against any
 * recipe this spoke had ordered. Body explains the bottleneck and
 * the new committed quantity so the spoke can re-plan their day
 * before the dispatch arrives.
 *
 * Only fires once `apply()` has run — the open (un-applied) state is
 * the hub manager's problem; we don't want to nudge spokes about
 * something the hub might not even action.
 */
export function useSpokeIngredientShortfallNudges(
  spokeId: SiteId,
): ShortfallNudge[] {
  const { forSpoke } = useIngredientShortfallStore();
  return useMemo(() => {
    const records = forSpoke(spokeId);
    if (records.length === 0) return [];
    return records.map(rec => {
      const seed = PRET_INGREDIENT_SHORTFALL_SEEDS.find(s => s.id === rec.seedId);
      const recipeName = getRecipe(rec.recipeId)?.name ?? rec.recipeId;
      const hubName = getSite(rec.hubId)?.name ?? rec.hubId;
      const myLine = rec.lines.find(l => l.spokeId === spokeId);
      const beforeUnits = myLine?.requestedUnits ?? 0;
      const afterUnits = myLine?.allocatedUnits ?? 0;
      const cut = beforeUnits - afterUnits;
      const reason = seed?.reason ?? 'Ingredient shortage';
      const ingredient = seed?.bottleneckIngredient ?? 'an ingredient';
      return {
        id: `ingredient-shortfall-${rec.seedId}-${spokeId}`,
        tone: 'warning' as const,
        title: `${hubName} cut your ${recipeName} order to ${afterUnits}`,
        body:
          `${reason} — ${ingredient} ran short, so the hub had to trim ${cut} unit${
            cut === 1 ? '' : 's'
          } off your ${rec.forDate} order. Originally asked for ${beforeUnits}; you'll receive ${afterUnits}.`,
        cta: { label: 'Open my order', href: '/production/spokes' },
      };
    });
  }, [forSpoke, spokeId]);
}
