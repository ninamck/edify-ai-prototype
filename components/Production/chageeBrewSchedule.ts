/**
 * chageeBrewSchedule — CHAGEE's "when to brew, how much" brain.
 *
 * CHAGEE's operational pain, in one sentence: several teas take up to ~2 hours
 * from START to serve-ready, so "brew when you run low" is always two hours too
 * late. This module solves that by BACK-SCHEDULING. For each base/topping it:
 *
 *   1. spreads the day's forecast demand across the service window (using each
 *      item's morning/midday/afternoon split),
 *   2. simulates the urns minute-by-minute — batches land, demand draws them
 *      down, stock ages out on its shelf life,
 *   3. and, reading ahead by exactly the item's brew lead time, decides the
 *      moment a batch must START so the urn never runs dry — sized to cover the
 *      window it's brewed for and rounded to the batch rules.
 *
 * The result is a full-day schedule of concrete batches (start → ready →
 * expire, with a quantity and the reason). `deriveBrewLineState(now)` then
 * projects that schedule onto a given clock: what's holding in the urns right
 * now, what's brewing, what to start now, and what's coming later.
 *
 * Pure + deterministic — no React, no time-of-day reads — so the crew view can
 * drive it from a simulated clock and it always tells the same story.
 */

import {
  CHAGEE_SERVICE_START_MIN,
  CHAGEE_SERVICE_END_MIN,
  CHAGEE_BREW_SPECS,
  CHAGEE_FORECAST,
  CHAGEE_RECIPES,
  CHAGEE_STATIONS,
  chageeBrewSpec,
  type ChageeBrewSpec,
  type ChageeStationId,
} from './chageeFixtures';
import type { ProductionRecipe, RecipeId } from './fixtures';
import { minutesToHHMM } from './time';

// ─────────────────────────────────────────────────────────────────────────────
// Tuning — kept together so the schedule's "personality" is easy to read.
// ─────────────────────────────────────────────────────────────────────────────

/** Simulation resolution. 5-min buckets are plenty for a service day. */
const STEP_MIN = 5;

/**
 * Daypart windows (minutes from midnight) the forecast's morning/midday/
 * afternoon splits map onto. They tile the 10:00–22:00 service day.
 */
const PHASE_WINDOWS = {
  morning: [CHAGEE_SERVICE_START_MIN, 13 * 60], // 10:00–13:00
  midday: [13 * 60, 17 * 60], // 13:00–17:00
  afternoon: [17 * 60, CHAGEE_SERVICE_END_MIN], // 17:00–22:00
} as const;

/**
 * How far past a batch's ready time it should aim to cover, capped so we never
 * brew so much it ages out on the shelf. The sim clamps this to the shelf life.
 */
const TARGET_COVERAGE_MIN = 150;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BrewBatch = {
  id: string;
  recipeId: RecipeId;
  recipeName: string;
  lineId: ChageeStationId;
  lineName: string;
  accent: string;
  /** Servings this batch yields. */
  qty: number;
  /** When the crew must START the batch. */
  startMin: number;
  /** When it's ready to serve (start + lead). */
  readyMin: number;
  /** When it ages out of the urn (ready + shelf life). */
  expireMin: number;
  leadMinutes: number;
  longLead: boolean;
  /** Human reason, e.g. "Covers the 17:00 afternoon peak". */
  reason: string;
};

/** Per-recipe urn state at a given clock. */
export type HoldingNow = {
  recipeId: RecipeId;
  recipeName: string;
  lineId: ChageeStationId;
  accent: string;
  /** Fresh servings remaining across all live batches. */
  servings: number;
  /** Minutes until the oldest live batch ages out (the binding freshness). */
  minsToExpiry: number | null;
  /** Shelf life of the item, for the freshness bar denominator. */
  shelfLifeMin: number;
};

export type BrewLineState = {
  nowMin: number;
  /** The full day's schedule (all lifecycle stages). */
  schedule: BrewBatch[];
  /** start ≤ now < ready — steeping/cooling now, with a countdown to ready. */
  brewing: BrewBatch[];
  /** now < start ≤ now + START_SOON — the crew should put these on now/soon. */
  startNow: BrewBatch[];
  /** Scheduled further out today. */
  later: BrewBatch[];
  /** Current urn levels, one row per item that has stock or is due. */
  holding: HoldingNow[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Demand model
// ─────────────────────────────────────────────────────────────────────────────

type Recipe = ProductionRecipe;

const RECIPE_BY_ID: Map<RecipeId, Recipe> = new Map(
  CHAGEE_RECIPES.map(r => [r.id, r]),
);

const FORECAST_BY_SKU = new Map(CHAGEE_FORECAST.map(f => [f.skuId, f]));

/** Servings of `recipeId` demanded in the 5-min bucket starting at `t`. */
function demandAt(recipeId: RecipeId, t: number): number {
  const recipe = RECIPE_BY_ID.get(recipeId);
  const fc = recipe ? FORECAST_BY_SKU.get(recipe.skuId ?? '') : undefined;
  if (!fc) return 0;
  const phase = (
    t < PHASE_WINDOWS.morning[1]
      ? 'morning'
      : t < PHASE_WINDOWS.midday[1]
        ? 'midday'
        : 'afternoon'
  ) as keyof typeof PHASE_WINDOWS;
  const [lo, hi] = PHASE_WINDOWS[phase];
  if (t < lo || t >= hi) return 0;
  const phaseUnits = fc.byPhase?.[phase] ?? 0;
  const buckets = (hi - lo) / STEP_MIN;
  return phaseUnits / buckets;
}

/** Total demand for `recipeId` across [from, to). */
function demandOver(recipeId: RecipeId, from: number, to: number): number {
  let total = 0;
  const start = Math.max(CHAGEE_SERVICE_START_MIN, Math.floor(from / STEP_MIN) * STEP_MIN);
  for (let t = start; t < to; t += STEP_MIN) total += demandAt(recipeId, t);
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch sizing
// ─────────────────────────────────────────────────────────────────────────────

function batchRulesFor(recipe: Recipe): { min: number; max: number; multipleOf: number } {
  return recipe.batchRules ?? { min: 10, max: 60, multipleOf: 10 };
}

/** Round a raw servings figure up to the nearest legal batch quantity. */
function clampToBatch(raw: number, rules: { min: number; max: number; multipleOf: number }): number {
  const stepped = Math.ceil(raw / rules.multipleOf) * rules.multipleOf;
  return Math.max(rules.min, Math.min(rules.max, stepped));
}

/** Which daypart is `t` in — used to phrase the batch's reason. */
function phaseLabel(t: number): string {
  if (t < PHASE_WINDOWS.morning[1]) return 'the morning';
  if (t < PHASE_WINDOWS.midday[1]) return 'the midday run';
  if (t < 19 * 60) return 'the afternoon peak';
  return 'the evening peak';
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-item simulation → schedule
// ─────────────────────────────────────────────────────────────────────────────

/** One live urn batch during the simulation. */
type SimBatch = { readyMin: number; expireMin: number; remaining: number; startMin: number; qty: number };

function scheduleForItem(spec: ChageeBrewSpec): BrewBatch[] {
  const recipe = RECIPE_BY_ID.get(spec.recipeId);
  if (!recipe) return [];
  const rules = batchRulesFor(recipe);
  const shelf = recipe.shelfLifeMinutes ?? 240;
  const lead = spec.leadMinutes;
  const station = CHAGEE_STATIONS.find(s => s.id === spec.lineId);
  const coverage = Math.min(TARGET_COVERAGE_MIN, shelf);

  const inflight: SimBatch[] = [];
  const holding: SimBatch[] = [];
  const out: BrewBatch[] = [];
  let seq = 0;

  // Seed an opening brew so the store isn't dry at 10:00 — started before open.
  const openingNeed = demandOver(spec.recipeId, CHAGEE_SERVICE_START_MIN, CHAGEE_SERVICE_START_MIN + coverage);
  if (openingNeed > 0) {
    const qty = clampToBatch(openingNeed, rules);
    const b: SimBatch = {
      startMin: CHAGEE_SERVICE_START_MIN - lead,
      readyMin: CHAGEE_SERVICE_START_MIN,
      expireMin: CHAGEE_SERVICE_START_MIN + shelf,
      remaining: qty,
      qty,
    };
    inflight.push(b);
    out.push(toBrewBatch(spec, recipe, station, b, ++seq, 'Opening urn — ready for first orders'));
  }

  for (let t = CHAGEE_SERVICE_START_MIN; t <= CHAGEE_SERVICE_END_MIN; t += STEP_MIN) {
    // 1. Land any batches that have become ready.
    for (let i = inflight.length - 1; i >= 0; i--) {
      if (inflight[i].readyMin <= t) {
        holding.push(inflight[i]);
        inflight.splice(i, 1);
      }
    }
    // 2. Bin anything that's aged out.
    for (let i = holding.length - 1; i >= 0; i--) {
      if (holding[i].expireMin <= t) holding.splice(i, 1);
    }
    // 3. Draw down demand, oldest urn first (FIFO).
    let need = demandAt(spec.recipeId, t);
    holding.sort((a, b) => a.expireMin - b.expireMin);
    for (const h of holding) {
      if (need <= 0) break;
      const take = Math.min(h.remaining, need);
      h.remaining -= take;
      need -= take;
    }

    // 4. Look ahead one lead time: will supply cover demand until a batch
    //    started now could land? If not, start one now.
    if (t + lead <= CHAGEE_SERVICE_END_MIN) {
      const horizon = t + lead;
      const supplyInWindow =
        holding.reduce((a, h) => a + h.remaining, 0) +
        inflight.filter(b => b.readyMin <= horizon).reduce((a, b) => a + b.remaining, 0);
      const demandInWindow = demandOver(spec.recipeId, t, horizon);
      if (supplyInWindow < demandInWindow) {
        const readyMin = t + lead;
        // Size to cover from ready → ready+coverage, net of what's already coming.
        const futureSupply =
          holding.reduce((a, h) => a + h.remaining, 0) +
          inflight.reduce((a, b) => a + b.remaining, 0);
        const futureNeed = demandOver(spec.recipeId, t, readyMin + coverage);
        const shortfall = Math.max(demandInWindow - supplyInWindow, futureNeed - futureSupply);
        const qty = clampToBatch(shortfall, rules);
        const b: SimBatch = { startMin: t, readyMin, expireMin: readyMin + shelf, remaining: qty, qty };
        inflight.push(b);
        out.push(toBrewBatch(spec, recipe, station, b, ++seq, `Covers ${phaseLabel(readyMin)}`));
      }
    }
  }

  return out;
}

function toBrewBatch(
  spec: ChageeBrewSpec,
  recipe: Recipe,
  station: { name: string; accent: string } | undefined,
  b: SimBatch,
  seq: number,
  reason: string,
): BrewBatch {
  return {
    id: `${spec.recipeId}-${seq}`,
    recipeId: spec.recipeId,
    recipeName: recipe.name,
    lineId: spec.lineId,
    lineName: station?.name ?? 'Brew',
    accent: station?.accent ?? '#A4123F',
    qty: b.qty,
    startMin: b.startMin,
    readyMin: b.readyMin,
    expireMin: b.expireMin,
    leadMinutes: spec.leadMinutes,
    longLead: spec.longLead,
    reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** The full day's brew schedule across every base + topping. */
export function buildBrewSchedule(): BrewBatch[] {
  return CHAGEE_BREW_SPECS.flatMap(scheduleForItem).sort((a, b) => a.startMin - b.startMin);
}

/** How many servings of `recipeId` are live in the urns at `now`. */
function holdingAt(schedule: BrewBatch[], recipeId: RecipeId, now: number): { servings: number; minsToExpiry: number | null } {
  // Re-run FIFO consumption up to `now` for just this item so urn levels match
  // the same draw-down the schedule was built from.
  const spec = chageeBrewSpec(recipeId);
  if (!spec) return { servings: 0, minsToExpiry: null };
  const live: { readyMin: number; expireMin: number; remaining: number }[] = schedule
    .filter(b => b.recipeId === recipeId)
    .map(b => ({ readyMin: b.readyMin, expireMin: b.expireMin, remaining: b.qty }));

  for (let t = CHAGEE_SERVICE_START_MIN; t <= now; t += STEP_MIN) {
    let need = demandAt(recipeId, t);
    const ready = live
      .filter(b => b.readyMin <= t && b.expireMin > t && b.remaining > 0)
      .sort((a, b) => a.expireMin - b.expireMin);
    for (const b of ready) {
      if (need <= 0) break;
      const take = Math.min(b.remaining, need);
      b.remaining -= take;
      need -= take;
    }
  }

  const fresh = live.filter(b => b.readyMin <= now && b.expireMin > now && b.remaining > 0.5);
  const servings = Math.round(fresh.reduce((a, b) => a + b.remaining, 0));
  const minsToExpiry = fresh.length
    ? Math.max(0, Math.round(Math.min(...fresh.map(b => b.expireMin)) - now))
    : null;
  return { servings, minsToExpiry };
}

/** How soon an upcoming batch counts as "start now" rather than "later". */
const START_SOON_MIN = 20;

/** Project the day's schedule onto a clock. */
export function deriveBrewLineState(now: number, lineId?: ChageeStationId): BrewLineState {
  const all = buildBrewSchedule();
  const schedule = lineId ? all.filter(b => b.lineId === lineId) : all;

  const brewing = schedule
    .filter(b => b.startMin <= now && b.readyMin > now)
    .sort((a, b) => a.readyMin - b.readyMin);
  const startNow = schedule
    .filter(b => b.startMin > now && b.startMin <= now + START_SOON_MIN)
    .sort((a, b) => a.startMin - b.startMin);
  const later = schedule
    .filter(b => b.startMin > now + START_SOON_MIN)
    .sort((a, b) => a.startMin - b.startMin);

  const recipeIds = Array.from(new Set(schedule.map(b => b.recipeId)));
  const holding: HoldingNow[] = recipeIds
    .map(recipeId => {
      const recipe = RECIPE_BY_ID.get(recipeId);
      const spec = chageeBrewSpec(recipeId);
      const station = CHAGEE_STATIONS.find(s => s.id === spec?.lineId);
      const { servings, minsToExpiry } = holdingAt(all, recipeId, now);
      return {
        recipeId,
        recipeName: recipe?.name ?? recipeId,
        lineId: spec?.lineId ?? '',
        accent: station?.accent ?? '#A4123F',
        servings,
        minsToExpiry,
        shelfLifeMin: recipe?.shelfLifeMinutes ?? 240,
      };
    })
    .sort((a, b) => b.servings - a.servings);

  return { nowMin: now, schedule, brewing, startNow, later, holding };
}

/** Convenience re-export so the view doesn't need a second import. */
export { minutesToHHMM };
