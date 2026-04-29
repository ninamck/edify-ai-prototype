'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  amountsForSiteOnDate,
  benchesAt,
  effectiveBatchRules,
  getRecipe,
  getWorkflow,
  proposeBatchSplit,
  productionItemsAt,
  PRET_PLAN,
  PRET_PRODUCTION_ITEMS,
  type AmountsLine,
  type BenchId,
  type PlannedInstance,
  type ProductionItem,
  type ProductionItemId,
  type ProductionPlan,
  type ProductionRecipe,
  type RecipeId,
  type SiteId,
} from './fixtures';
import { hhmmToMinutes, minutesToHHMM } from './time';

/**
 * One tray of filling weighs ~4kg in this demo. Used to convert gram-based
 * sub-recipe dependencies (e.g. 80g of egg mayo per sandwich) into tray counts.
 */
export const FILLING_TRAY_GRAMS = 4000;

type Overrides = Record<ProductionItemId, number>;

type SetPlannedFn = (itemId: ProductionItemId, qty: number) => void;
type ResetFn = (itemId: ProductionItemId) => void;

type PlanStoreContextValue = {
  /** Raw manager override per ProductionItem (empty = no override; use Quinn's proposal). */
  overrides: Overrides;
  setPlanned: SetPlannedFn;
  resetToQuinn: ResetFn;
  resetAll: () => void;
  /** Number of recipes the manager has manually overridden. */
  overrideCount: number;
};

const PlanStoreContext = createContext<PlanStoreContextValue | null>(null);

export function PlanStoreProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Overrides>({});

  const setPlanned: SetPlannedFn = useCallback((itemId, qty) => {
    setOverrides(prev => ({ ...prev, [itemId]: Math.max(0, Math.round(qty)) }));
  }, []);

  const resetToQuinn: ResetFn = useCallback(itemId => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const resetAll = useCallback(() => setOverrides({}), []);

  const value = useMemo<PlanStoreContextValue>(
    () => ({
      overrides,
      setPlanned,
      resetToQuinn,
      resetAll,
      overrideCount: Object.keys(overrides).length,
    }),
    [overrides, setPlanned, resetToQuinn, resetAll],
  );

  return <PlanStoreContext.Provider value={value}>{children}</PlanStoreContext.Provider>;
}

export function usePlanStore(): PlanStoreContextValue {
  const ctx = useContext(PlanStoreContext);
  if (!ctx) {
    // Safe fallback so components mounted outside the provider don't crash.
    return {
      overrides: {},
      setPlanned: () => {},
      resetToQuinn: () => {},
      resetAll: () => {},
      overrideCount: 0,
    };
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived views — assembly cascade
// ─────────────────────────────────────────────────────────────────────────────

/** A component row's inbound demand from all assemblies that consume it. */
export type AssemblyDemand = {
  /** Total component demand in the component's natural unit (units or trays). */
  totalUnits: number;
  /** When the sub-recipe is mass-based, the raw grams implied. Undefined for unit-based deps. */
  totalGrams?: number;
  /** Per-assembly breakdown so the UI can explain where the demand came from. */
  sources: Array<{
    parentItem: ProductionItem;
    parentRecipeId: RecipeId;
    parentPlannedQty: number;
    /** quantityPerUnit from the sub-recipe graph. */
    quantityPerUnit: number;
    unit: string;
    /** Contributed units/trays of the component. */
    contributedUnits: number;
  }>;
};

/**
 * Build a full `AmountsLine` snapshot for a site that includes:
 *  - `planned`     — Quinn proposal merged with any manager override
 *  - `assemblyDemand` — component demand driven by other recipes' planned qty
 *  - `effectivePlanned` — how much will actually be produced (max of own plan + assemblyDemand)
 */
export type PlanLine = AmountsLine & {
  planned: number;
  isOverridden: boolean;
  assemblyDemand: AssemblyDemand;
  effectivePlanned: number;
};

export function resolvePlan(siteId: SiteId, date: string, overrides: Overrides): PlanLine[] {
  const baseLines = amountsForSiteOnDate(siteId, date);

  // Pass 1: compute direct planned qty for every item.
  const directPlan = new Map<ProductionItemId, number>();
  for (const line of baseLines) {
    const override = overrides[line.item.id];
    directPlan.set(line.item.id, override ?? line.quinnProposed);
  }

  // Pass 2: cascade assembly → component demand.
  // We iterate all production items at the site; for each recipe with subRecipes,
  // distribute planned quantity × quantityPerUnit to its component item (matching by recipeId).
  const demandByComponent = new Map<ProductionItemId, AssemblyDemand>();

  const itemsBySiteAndRecipe = new Map<RecipeId, ProductionItem[]>();
  for (const it of PRET_PRODUCTION_ITEMS.filter(p => p.siteId === siteId)) {
    const arr = itemsBySiteAndRecipe.get(it.recipeId) ?? [];
    arr.push(it);
    itemsBySiteAndRecipe.set(it.recipeId, arr);
  }

  for (const parent of productionItemsAt(siteId)) {
    const recipe = getRecipe(parent.recipeId);
    if (!recipe?.subRecipes) continue;
    const parentPlanned = directPlan.get(parent.id) ?? 0;
    if (parentPlanned === 0) continue;
    for (const sub of recipe.subRecipes) {
      // Find the component item at the same site.
      const componentItems = itemsBySiteAndRecipe.get(sub.recipeId) ?? [];
      const componentItem = componentItems[0];
      if (!componentItem) continue;

      let contributedUnits: number;
      let grams: number | undefined;
      if (sub.unit === 'unit') {
        contributedUnits = parentPlanned * sub.quantityPerUnit;
      } else if (sub.unit === 'g' || sub.unit === 'ml') {
        grams = parentPlanned * sub.quantityPerUnit;
        // Convert grams → trays using the demo convention.
        contributedUnits = Math.ceil(grams / FILLING_TRAY_GRAMS);
      } else {
        contributedUnits = parentPlanned * sub.quantityPerUnit;
      }

      const existing =
        demandByComponent.get(componentItem.id) ?? ({ totalUnits: 0, totalGrams: undefined, sources: [] } as AssemblyDemand);
      existing.totalUnits += contributedUnits;
      if (grams !== undefined) {
        existing.totalGrams = (existing.totalGrams ?? 0) + grams;
      }
      existing.sources.push({
        parentItem: parent,
        parentRecipeId: parent.recipeId,
        parentPlannedQty: parentPlanned,
        quantityPerUnit: sub.quantityPerUnit,
        unit: sub.unit,
        contributedUnits,
      });
      demandByComponent.set(componentItem.id, existing);
    }
  }

  // Pass 3: produce enriched lines.
  return baseLines.map(line => {
    const planned = directPlan.get(line.item.id) ?? line.quinnProposed;
    const isOverridden = overrides[line.item.id] !== undefined;
    const assemblyDemand: AssemblyDemand =
      demandByComponent.get(line.item.id) ?? { totalUnits: 0, sources: [] };
    // Effective production = max of direct plan and inbound assembly demand.
    // If the Manager intentionally plans more than assemblies need, we honour it.
    // If they plan less, the floor becomes the assembly demand (and we surface a shortfall).
    const effectivePlanned = Math.max(planned, assemblyDemand.totalUnits);
    return {
      ...line,
      planned,
      isOverridden,
      assemblyDemand,
      effectivePlanned,
    };
  });
}

/** Convenience hook that resolves the plan for a site/date using current overrides. */
export function usePlan(siteId: SiteId, date: string): PlanLine[] {
  const { overrides } = usePlanStore();
  return useMemo(() => resolvePlan(siteId, date, overrides), [siteId, date, overrides]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Board projection — materialize the plan as PlannedInstances on the board
// ─────────────────────────────────────────────────────────────────────────────

/** Default bench cursor start time (minutes from midnight) by recipe category. */
const CATEGORY_START_MINS: Record<ProductionRecipe['category'], number> = {
  Bakery: 5 * 60,       // 05:00 — early bake
  Sandwich: 7 * 60 + 30, // 07:30 — after fillings are up
  Salad: 10 * 60,       // 10:00 — plate before lunch
  Snack: 7 * 60,        // 07:00
  Beverage: 6 * 60,     // 06:00
};

/** Buffer between packed batches on the same bench (minutes). */
const BENCH_BUFFER_MINS = 5;

/** How board time wraps (end of displayed day, to clamp cursors). */
const BOARD_END_MINS = 20 * 60; // 20:00

/**
 * Build a board-ready ProductionPlan that layers virtual PlannedInstances on
 * top of the static fixture plan, for any production item whose plan exists
 * only in the PlanStore (i.e. hasn't been hand-authored in PRET_PLAN).
 *
 * Notes:
 *  - When the Manager has overridden an item that's already scheduled in the
 *    authored plan (e.g. Club sandwich), we drop that item's authored D0
 *    blocks and regenerate virtual ones so the board stays in sync with the
 *    Amounts page. Authored D-1 stages (e.g. croissant ferment overnight)
 *    stay in place.
 *  - Increment items (coffee, smoothie, porridge) aren't scheduled here — the
 *    cadence strip already owns that surface.
 */
export function deriveBoardPlan(
  siteId: SiteId,
  date: string,
  overrides: Overrides,
): ProductionPlan {
  const lines = resolvePlan(siteId, date, overrides);

  // Start from the authored fixture plan — only when we're on the same site.
  const basePlan = PRET_PLAN.siteId === siteId
    ? PRET_PLAN
    : {
        ...PRET_PLAN,
        siteId,
        plannedInstances: [],
        batches: [],
        pcrRecords: [],
      };

  // Items that have a Manager override: drop their authored D0 blocks so
  // we can re-plan the bench time live. Keep D-1 (e.g. ferment) stages.
  const overriddenItemIds = new Set(
    lines.filter(l => l.isOverridden).map(l => l.item.id),
  );
  const authoredPlannedInstances = basePlan.plannedInstances.filter(pi => {
    if (pi.date !== date) return true; // out-of-date-range stays
    return !overriddenItemIds.has(pi.productionItemId);
  });
  const authoredBatches = basePlan.batches.filter(b => {
    if (b.date !== date) return true;
    return !overriddenItemIds.has(b.productionItemId);
  });

  const alreadyScheduled = new Set(
    authoredPlannedInstances
      .filter(pi => pi.date === date)
      .map(pi => pi.productionItemId),
  );

  // Bench cursor in minutes. Shared across all items so multiple recipes
  // stacking on the same bench pack sequentially.
  const benchCursor = new Map<BenchId, number>();

  // Track when each production item's last block finishes (mins). Seeded from
  // authored D0 instances so virtual assemblies can wait for authored bread/
  // filling to finish, and updated as we lay down new virtual blocks.
  const itemFinish = new Map<ProductionItemId, number>();
  for (const pi of authoredPlannedInstances) {
    if (pi.date !== date) continue;
    const finish = hhmmToMinutes(pi.endTime);
    const prev = itemFinish.get(pi.productionItemId) ?? -Infinity;
    if (finish > prev) itemFinish.set(pi.productionItemId, finish);
  }

  // recipeId → ProductionItem(s) at this site, so we can look up "what
  // production item supplies this sub-recipe".
  const itemsByRecipeAtSite = new Map<RecipeId, ProductionItem[]>();
  for (const it of productionItemsAt(siteId)) {
    const arr = itemsByRecipeAtSite.get(it.recipeId) ?? [];
    arr.push(it);
    itemsByRecipeAtSite.set(it.recipeId, arr);
  }

  // For each line, the set of upstream production item ids that must finish
  // before this line starts. Skips deps whose own line is increment-mode or
  // not actually being produced today (so a missing component doesn't infinitely
  // delay the assembly — it just shows a shortfall on Amounts).
  const lineByItemId = new Map(lines.map(l => [l.item.id, l]));
  function depsForItem(itemId: ProductionItemId): ProductionItemId[] {
    const line = lineByItemId.get(itemId);
    if (!line?.recipe.subRecipes) return [];
    const out: ProductionItemId[] = [];
    for (const sub of line.recipe.subRecipes) {
      const subItems = itemsByRecipeAtSite.get(sub.recipeId) ?? [];
      for (const subItem of subItems) {
        const subLine = lineByItemId.get(subItem.id);
        if (!subLine) continue;
        if (subLine.effectivePlanned <= 0) continue;
        out.push(subItem.id);
      }
    }
    return out;
  }

  // Topological "level": components are level 0, sandwiches that depend on them
  // are level 1, etc. Cycle-safe with a visiting set.
  const levelCache = new Map<ProductionItemId, number>();
  function levelOf(itemId: ProductionItemId, visiting: Set<ProductionItemId>): number {
    if (levelCache.has(itemId)) return levelCache.get(itemId)!;
    if (visiting.has(itemId)) return 0;
    visiting.add(itemId);
    let max = -1;
    for (const dep of depsForItem(itemId)) {
      max = Math.max(max, levelOf(dep, visiting));
    }
    visiting.delete(itemId);
    const lvl = max + 1;
    levelCache.set(itemId, lvl);
    return lvl;
  }

  const virtualInstances: PlannedInstance[] = [];

  // Schedule order:
  //  1. Topological level (components before assemblies)
  //  2. Category start time (Bakery 5am → Salad 10am)
  //  3. Shelf-life ascending (short-shelf first within a tier)
  const sorted = [...lines].sort((a, b) => {
    const la = levelOf(a.item.id, new Set());
    const lb = levelOf(b.item.id, new Set());
    if (la !== lb) return la - lb;
    const as = CATEGORY_START_MINS[a.recipe.category];
    const bs = CATEGORY_START_MINS[b.recipe.category];
    if (as !== bs) return as - bs;
    const ashelf = a.recipe.shelfLifeMinutes ?? 24 * 60;
    const bshelf = b.recipe.shelfLifeMinutes ?? 24 * 60;
    return ashelf - bshelf;
  });

  for (const line of sorted) {
    if (alreadyScheduled.has(line.item.id)) continue;
    if (line.item.mode === 'increment') continue;
    if (line.effectivePlanned <= 0) continue;

    const recipe = line.recipe;
    const wf = getWorkflow(recipe.workflowId);
    if (!wf || !line.primaryBench) continue;

    // Use the last D0 stage as the visible "bench work" block. That matches
    // primaryBench selection logic and gives the user-relevant duration.
    const d0Stages = wf.stages.filter(s => s.leadOffset === 0);
    const visibleStage = d0Stages[d0Stages.length - 1] ?? wf.stages[wf.stages.length - 1];
    const duration = Math.max(6, visibleStage.durationMinutes); // clamp tiny blocks so they're readable

    // Resolve the bench for the visible stage at this site
    const bench =
      benchesAt(siteId).find(b => b.capabilities.includes(visibleStage.capability)) ??
      line.primaryBench;

    // Split into batches
    const eff = effectiveBatchRules(recipe.batchRules, bench.batchRules);
    const split = proposeBatchSplit(line.effectivePlanned, eff);
    if (split.batches.length === 0) continue;

    // Earliest start = max(bench cursor, dependency-ready time, category start)
    const categoryStart = CATEGORY_START_MINS[recipe.category] ?? 6 * 60;
    const benchAvailable = benchCursor.get(bench.id) ?? categoryStart;

    let depReady = -Infinity;
    for (const depId of depsForItem(line.item.id)) {
      const finish = itemFinish.get(depId);
      if (finish != null && finish > depReady) depReady = finish;
    }

    let cursor = benchAvailable;
    if (Number.isFinite(depReady)) {
      cursor = Math.max(cursor, depReady + BENCH_BUFFER_MINS);
    }

    let lastEnd = cursor;
    split.batches.forEach((qty, idx) => {
      const startMins = Math.min(cursor, BOARD_END_MINS - duration);
      const endMins = startMins + duration;
      virtualInstances.push({
        id: `virtual-${line.item.id}-${idx}`,
        productionItemId: line.item.id,
        stageId: visibleStage.id,
        date,
        startTime: minutesToHHMM(startMins),
        endTime: minutesToHHMM(endMins),
        benchId: bench.id,
        plannedQty: qty,
        forecastRef: line.forecast
          ? { siteId, skuId: line.item.skuId, date: line.forecast.date }
          : undefined,
      });
      cursor = endMins + BENCH_BUFFER_MINS;
      lastEnd = endMins;
    });

    benchCursor.set(bench.id, cursor);

    // Record finish time so downstream assemblies can sequence after us.
    const prev = itemFinish.get(line.item.id) ?? -Infinity;
    if (lastEnd > prev) itemFinish.set(line.item.id, lastEnd);
  }

  return {
    ...basePlan,
    plannedInstances: [...authoredPlannedInstances, ...virtualInstances],
    batches: authoredBatches,
  };
}

/** Hook form — live-derived board plan reacting to Manager overrides. */
export function useBoardPlan(siteId: SiteId, date: string): ProductionPlan {
  const { overrides } = usePlanStore();
  return useMemo(() => deriveBoardPlan(siteId, date, overrides), [siteId, date, overrides]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dependency graph — "what does this block depend on / drive?"
// ─────────────────────────────────────────────────────────────────────────────

export type RelatedItems = {
  /** The clicked item itself. */
  focus: ProductionItemId;
  /** Transitive components this item consumes (bread, fillings, sub-sub-recipes). */
  upstream: Set<ProductionItemId>;
  /** Transitive assemblies that consume this item. */
  downstream: Set<ProductionItemId>;
};

/**
 * Walk the assembly graph in both directions for a given item at a site.
 * Used by the board to highlight a block's dependency chain.
 */
export function computeRelatedItems(siteId: SiteId, itemId: ProductionItemId): RelatedItems {
  const itemsAtSite = productionItemsAt(siteId);
  const byItemId = new Map<ProductionItemId, ProductionItem>(itemsAtSite.map(it => [it.id, it]));

  const itemsByRecipe = new Map<RecipeId, ProductionItem[]>();
  for (const it of itemsAtSite) {
    const arr = itemsByRecipe.get(it.recipeId) ?? [];
    arr.push(it);
    itemsByRecipe.set(it.recipeId, arr);
  }

  // Parent index: for each recipe consumed as a sub-recipe, which items consume it.
  const parentsByRecipeId = new Map<RecipeId, ProductionItemId[]>();
  for (const it of itemsAtSite) {
    const recipe = getRecipe(it.recipeId);
    if (!recipe?.subRecipes) continue;
    for (const sub of recipe.subRecipes) {
      const arr = parentsByRecipeId.get(sub.recipeId) ?? [];
      arr.push(it.id);
      parentsByRecipeId.set(sub.recipeId, arr);
    }
  }

  const upstream = new Set<ProductionItemId>();
  function walkUp(id: ProductionItemId): void {
    const it = byItemId.get(id);
    if (!it) return;
    const recipe = getRecipe(it.recipeId);
    if (!recipe?.subRecipes) return;
    for (const sub of recipe.subRecipes) {
      const subItems = itemsByRecipe.get(sub.recipeId) ?? [];
      for (const subIt of subItems) {
        if (upstream.has(subIt.id) || subIt.id === itemId) continue;
        upstream.add(subIt.id);
        walkUp(subIt.id);
      }
    }
  }
  walkUp(itemId);

  const downstream = new Set<ProductionItemId>();
  function walkDown(id: ProductionItemId): void {
    const it = byItemId.get(id);
    if (!it) return;
    const parents = parentsByRecipeId.get(it.recipeId) ?? [];
    for (const p of parents) {
      if (downstream.has(p) || p === itemId) continue;
      downstream.add(p);
      walkDown(p);
    }
  }
  walkDown(itemId);

  return { focus: itemId, upstream, downstream };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan-derived Quinn nudges
// ─────────────────────────────────────────────────────────────────────────────

export type PlanNudge = {
  id: string;
  tone: 'info' | 'warning' | 'error' | 'success';
  title: string;
  body: string;
  cta: { label: string; href: string };
  surface: 'amounts';
};

/**
 * Derive live Quinn nudges from the current plan state. Surfaces:
 *  - component shortfalls (an assembly is planned but its component isn't)
 *  - aggressive manager overrides (large +/- swings vs Quinn)
 *  - recipes still on draft forecast
 */
export function usePlanNudges(siteId: SiteId, date: string): PlanNudge[] {
  const lines = usePlan(siteId, date);

  return useMemo(() => {
    const nudges: PlanNudge[] = [];

    const shortfalls = lines.filter(l => l.assemblyDemand.totalUnits > l.planned);
    if (shortfalls.length > 0) {
      const first = shortfalls[0];
      nudges.push({
        id: `plan-shortfall-${first.item.id}`,
        tone: 'error',
        surface: 'amounts',
        title:
          shortfalls.length === 1
            ? `Short on ${first.recipe.name}`
            : `${shortfalls.length} components short on plan`,
        body:
          shortfalls.length === 1
            ? `Assemblies need ${first.assemblyDemand.totalUnits}, you’re only making ${first.planned}. Tap Cover to match.`
            : shortfalls
                .slice(0, 3)
                .map(l => `${l.recipe.name}: need ${l.assemblyDemand.totalUnits}, plan ${l.planned}`)
                .join(' · '),
        cta: { label: 'Open Amounts', href: '/production/amounts' },
      });
    }

    const bigOverrides = lines.filter(l => {
      if (!l.isOverridden) return false;
      const base = l.quinnProposed || 1;
      return Math.abs(l.planned - l.quinnProposed) / base >= 0.25;
    });
    if (bigOverrides.length >= 3) {
      nudges.push({
        id: 'plan-big-overrides',
        tone: 'warning',
        surface: 'amounts',
        title: `${bigOverrides.length} recipes are ±25% off Quinn’s forecast`,
        body: 'Worth a sanity check before the first run — big swings on multiple SKUs usually share a cause (event, weather, promo).',
        cta: { label: 'Review amounts', href: '/production/amounts' },
      });
    }

    const draftForecasts = lines.filter(l => l.forecast?.status === 'draft');
    if (draftForecasts.length > 0) {
      nudges.push({
        id: 'plan-draft-forecasts',
        tone: 'info',
        surface: 'amounts',
        title: `${draftForecasts.length} forecast${draftForecasts.length === 1 ? '' : 's'} still in draft`,
        body: 'I flagged these for a quick Manager confirmation before the first run.',
        cta: { label: 'Confirm forecasts', href: '/production/amounts' },
      });
    }

    return nudges;
  }, [lines]);
}
