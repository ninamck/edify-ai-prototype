'use client';

/**
 * forecastImpactStore — the "AI forecast vs the old way" head-to-head.
 *
 * This is the engine behind the headline forecast demo. It runs the *same*
 * Burger King lunch service twice, against identical real demand, with two
 * different production strategies:
 *
 *   • AI         — Edify's signal-weighted forecast. It cooks to the live
 *                  per-15-min demand curve and reacts to Quinn's intra-day
 *                  re-cuts (a mobile order lands, a coach party is flagged),
 *                  cooking ahead just before a surge and easing off after it.
 *   • Baseline   — the "old way": a flat par. The kitchen drops the same
 *                  steady number every window — the day's average — with no
 *                  curve and no reaction to anything happening on the day.
 *
 * Both strategies face the SAME real footfall (including surges — real demand
 * is real demand whether or not you predicted it). The only thing that differs
 * is how much each chose to cook. The divergence is the whole point:
 *
 *   • At the peak / during a surge the flat par runs dry → MISSED SALES.
 *   • Once the rush eases the flat par keeps cooking → WASTE (binned units).
 *   • The AI tracks the curve, so it does far less of both.
 *
 * We surface three things the room can read instantly:
 *   • £ the AI saved so far today (waste avoided + sales rescued)
 *   • a live, side-by-side scoreboard that diverges as the clock advances
 *   • a projected full-day figure (a deterministic fast-forward of the whole
 *     service for both strategies), so the headline lands before you step.
 *
 * Self-contained: it reuses only the BK *fixtures* (day totals, batch rules,
 * shelf life, holder seed) and re-derives the demand curve locally, so it
 * never touches the crew-line `crewLoopStore`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BK_DEMO_START_MIN,
  BK_DROP_INTERVAL_MIN,
  BK_HOLDER_SEED,
  BK_PRODUCTION_ITEMS,
  BK_SERVICE_END_MIN,
  BK_SERVICE_START_MIN,
  BK_FORECAST,
} from '@/components/Production/bkFixtures';
import { getRecipe, getWorkflow } from '@/components/Production/fixtures';
import type { RecipeId } from '@/components/Production/fixtures';
import { minutesToHHMM } from '@/components/Production/time';

// ─────────────────────────────────────────────────────────────────────────────
// Demand model — identical twin-peak curve to the crew line, kept local so this
// engine has no dependency on the crew-loop internals.
// ─────────────────────────────────────────────────────────────────────────────

function intensityAt(min: number): number {
  const lunch = Math.exp(-(((min - 750) / 70) ** 2)); // ~12:30 peak
  const dinner = Math.exp(-(((min - 1110) / 80) ** 2)); // ~18:30 peak
  const base = 0.25;
  return base + lunch + 0.75 * dinner;
}

const TOTAL_INTENSITY = (() => {
  let sum = 0;
  for (let m = BK_SERVICE_START_MIN; m < BK_SERVICE_END_MIN; m += 1) sum += intensityAt(m);
  return sum;
})();

const DAY_TOTAL: Record<RecipeId, number> = (() => {
  const out: Record<RecipeId, number> = {};
  for (const item of BK_PRODUCTION_ITEMS) {
    const f = BK_FORECAST.find(x => x.skuId === item.skuId);
    out[item.recipeId] = f?.projectedUnits ?? 0;
  }
  return out;
})();

/** Forecast units for a recipe across the 15-min window starting at `startMin`. */
function demandForWindow(recipeId: RecipeId, startMin: number): number {
  const dayTotal = DAY_TOTAL[recipeId] ?? 0;
  if (dayTotal === 0) return 0;
  let share = 0;
  const end = Math.min(startMin + BK_DROP_INTERVAL_MIN, BK_SERVICE_END_MIN);
  for (let m = Math.max(startMin, BK_SERVICE_START_MIN); m < end; m += 1) {
    share += intensityAt(m);
  }
  return (dayTotal * share) / TOTAL_INTENSITY;
}

function windowStart(min: number): number {
  const offset = min - BK_SERVICE_START_MIN;
  return BK_SERVICE_START_MIN + Math.floor(offset / BK_DROP_INTERVAL_MIN) * BK_DROP_INTERVAL_MIN;
}

const WINDOW_COUNT = Math.max(
  1,
  Math.round((BK_SERVICE_END_MIN - BK_SERVICE_START_MIN) / BK_DROP_INTERVAL_MIN),
);

// ─────────────────────────────────────────────────────────────────────────────
// Per-recipe config + economics
// ─────────────────────────────────────────────────────────────────────────────

type RecipeConfig = {
  recipeId: RecipeId;
  name: string;
  multipleOf: number;
  cookMinutes: number;
  shelfLifeMin: number;
  /** Flat par the baseline drops every window (the day average, rounded). */
  flatPar: number;
  /** Average sell price — drives "missed sales" (lost revenue). */
  price: number;
  /** Food cost per unit — drives "waste" (money in the bin). */
  cost: number;
};

/** Eyeballed BK-ish economics (£). Not load-bearing; tune freely per estate. */
const ECON: Record<string, { price: number; cost: number }> = {
  'bk-whopper-patty': { price: 5.49, cost: 1.4 },
  'bk-junior-patty': { price: 3.49, cost: 0.8 },
  'bk-chicken-fillet': { price: 4.99, cost: 1.3 },
  'bk-bacon': { price: 1.5, cost: 0.45 },
  'bk-angus-patty': { price: 6.49, cost: 1.8 },
  'bk-plant-patty': { price: 5.49, cost: 1.6 },
};

const RECIPE_CONFIG: Record<RecipeId, RecipeConfig> = (() => {
  const out: Record<RecipeId, RecipeConfig> = {};
  for (const item of BK_PRODUCTION_ITEMS) {
    const recipe = getRecipe(item.recipeId);
    if (!recipe) continue;
    const wf = getWorkflow(recipe.workflowId);
    const cookMinutes = wf
      ? Math.max(1, wf.stages.reduce((a, s) => a + s.durationMinutes, 0))
      : 4;
    const multipleOf = recipe.batchRules?.multipleOf ?? 2;
    const dayTotal = DAY_TOTAL[item.recipeId] ?? 0;
    const avgPerWindow = dayTotal / WINDOW_COUNT;
    const flatPar = Math.max(multipleOf, Math.round(avgPerWindow / multipleOf) * multipleOf);
    const econ = ECON[item.recipeId] ?? { price: 4.5, cost: 1.2 };
    out[item.recipeId] = {
      recipeId: item.recipeId,
      name: recipe.name,
      multipleOf,
      cookMinutes,
      shelfLifeMin: recipe.shelfLifeMinutes ?? 20,
      flatPar,
      price: econ.price,
      cost: econ.cost,
    };
  }
  return out;
})();

const ALL_RECIPES = Object.values(RECIPE_CONFIG);

// ─────────────────────────────────────────────────────────────────────────────
// Quinn re-cut script — the intra-day signals the AI reacts to (and the
// baseline ignores). Surges raise *real* demand for everyone; only the AI's
// drop decisions anticipate them.
// ─────────────────────────────────────────────────────────────────────────────

export type RecutTone = 'info' | 'cook-ahead' | 'ease-off';

type RecutEvent = {
  atOffset: number;
  message: string;
  tone: RecutTone;
  surge?: { recipeId: RecipeId; multiplier: number; forMinutes: number };
};

const RECUT_SCRIPT: RecutEvent[] = [
  { atOffset: 4, message: 'Lunch rush building — cooking ahead on Whoppers', tone: 'cook-ahead', surge: { recipeId: 'bk-whopper-patty', multiplier: 1.6, forMinutes: 22 } },
  { atOffset: 16, message: 'Large mobile order just landed (24 burgers) — dropping 2 trays of Juniors', tone: 'cook-ahead', surge: { recipeId: 'bk-junior-patty', multiplier: 2.2, forMinutes: 14 } },
  { atOffset: 30, message: 'Coach party flagged for 13:15 — getting chicken ahead', tone: 'cook-ahead', surge: { recipeId: 'bk-chicken-fillet', multiplier: 2.5, forMinutes: 18 } },
  { atOffset: 46, message: 'Rush easing — holding back so nothing gets binned', tone: 'ease-off' },
  { atOffset: 64, message: 'Steady trade — cooking to the cabinet, no waste', tone: 'info' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Simulation state — one RunState per strategy, shared demand + surges
// ─────────────────────────────────────────────────────────────────────────────

export type StrategyId = 'ai' | 'baseline';

type HeldBatch = {
  id: string;
  recipeId: RecipeId;
  count: number;
  expiresAtMin: number;
};

type CookingBatch = { recipeId: RecipeId; qty: number; readyAtMin: number };

type RunState = {
  holder: HeldBatch[];
  cooking: CookingBatch[];
  sellCarry: Record<RecipeId, number>;
  lastDropWindow: Record<RecipeId, number>;
  produced: number;
  sold: number;
  wasteUnits: Record<RecipeId, number>;
  missedUnits: Record<RecipeId, number>;
  seq: number;
};

type Surge = { recipeId: RecipeId; multiplier: number; untilMin: number };

type SimState = {
  nowMin: number;
  ai: RunState;
  baseline: RunState;
  surges: Surge[];
  firedRecuts: Set<number>;
  recut: { id: number; message: string; tone: RecutTone; atMin: number } | null;
};

function emptyRun(): RunState {
  const sellCarry: Record<RecipeId, number> = {};
  const lastDropWindow: Record<RecipeId, number> = {};
  const wasteUnits: Record<RecipeId, number> = {};
  const missedUnits: Record<RecipeId, number> = {};
  for (const cfg of ALL_RECIPES) {
    sellCarry[cfg.recipeId] = 0;
    lastDropWindow[cfg.recipeId] = -1;
    wasteUnits[cfg.recipeId] = 0;
    missedUnits[cfg.recipeId] = 0;
  }
  return {
    holder: [],
    cooking: [],
    sellCarry,
    lastDropWindow,
    produced: 0,
    sold: 0,
    wasteUnits,
    missedUnits,
    seq: 0,
  };
}

/** Seed a run's cabinet from the shared BK holder seed (both start identical). */
function seedRun(run: RunState, startMin: number): void {
  run.holder = BK_HOLDER_SEED.map((seed, i) => {
    const cfg = RECIPE_CONFIG[seed.recipeId];
    const shelf = cfg?.shelfLifeMin ?? 20;
    const cookedAtMin = startMin - seed.cookedMinAgo;
    return {
      id: `${i}-seed`,
      recipeId: seed.recipeId,
      count: seed.count,
      expiresAtMin: cookedAtMin + shelf,
    };
  });
}

function initialState(): SimState {
  const start = BK_DEMO_START_MIN;
  const ai = emptyRun();
  const baseline = emptyRun();
  seedRun(ai, start);
  seedRun(baseline, start);
  return {
    nowMin: start,
    ai,
    baseline,
    surges: [],
    firedRecuts: new Set(),
    recut: null,
  };
}

const WASTE_GRACE_MIN = 10;

function surgeMultiplier(state: SimState, recipeId: RecipeId): number {
  let mult = 1;
  for (const s of state.surges) {
    if (s.recipeId === recipeId && state.nowMin < s.untilMin) mult *= s.multiplier;
  }
  return mult;
}

function heldOf(run: RunState, recipeId: RecipeId, nowMin: number): number {
  return run.holder
    .filter(b => b.recipeId === recipeId && b.expiresAtMin > nowMin)
    .reduce((a, b) => a + b.count, 0);
}

function cookingOf(run: RunState, recipeId: RecipeId): number {
  return run.cooking.filter(b => b.recipeId === recipeId).reduce((a, b) => a + b.qty, 0);
}

function roundToMultiple(n: number, multiple: number): number {
  if (multiple <= 1) return Math.max(0, Math.round(n));
  return Math.max(0, Math.ceil(n / multiple) * multiple);
}

function cloneRun(run: RunState): RunState {
  return {
    ...run,
    holder: run.holder.map(b => ({ ...b })),
    cooking: run.cooking.map(b => ({ ...b })),
    sellCarry: { ...run.sellCarry },
    lastDropWindow: { ...run.lastDropWindow },
    wasteUnits: { ...run.wasteUnits },
    missedUnits: { ...run.missedUnits },
  };
}

/**
 * Advance a single strategy's run by one demo-minute against the shared real
 * demand. `decideDrop` returns how many units to start cooking at a window
 * boundary (0 = don't drop this window).
 */
function stepRun(
  run: RunState,
  nowMin: number,
  realPerMin: (recipeId: RecipeId) => number,
  decideDrop: (run: RunState, cfg: RecipeConfig, nowMin: number) => number,
): void {
  // 1. Finished cooks → cabinet.
  const stillCooking: CookingBatch[] = [];
  for (const cook of run.cooking) {
    if (cook.readyAtMin <= nowMin) {
      const cfg = RECIPE_CONFIG[cook.recipeId];
      run.holder.push({
        id: `${run.seq++}-b`,
        recipeId: cook.recipeId,
        count: cook.qty,
        expiresAtMin: cook.readyAtMin + (cfg?.shelfLifeMin ?? 20),
      });
    } else {
      stillCooking.push(cook);
    }
  }
  run.cooking = stillCooking;

  // 2. Sell against real demand (oldest fresh first). Unmet demand = missed.
  for (const cfg of ALL_RECIPES) {
    let toSell = realPerMin(cfg.recipeId) + (run.sellCarry[cfg.recipeId] ?? 0);
    let want = Math.floor(toSell);
    run.sellCarry[cfg.recipeId] = toSell - want;
    if (want <= 0) continue;
    const batches = run.holder
      .filter(b => b.recipeId === cfg.recipeId && b.expiresAtMin > nowMin)
      .sort((a, b) => a.expiresAtMin - b.expiresAtMin);
    for (const batch of batches) {
      if (want <= 0) break;
      const take = Math.min(batch.count, want);
      batch.count -= take;
      want -= take;
      run.sold += take;
    }
    // Anything still wanted after draining the cabinet is a lost sale.
    if (want > 0) run.missedUnits[cfg.recipeId] += want;
  }

  // 3. Bin anything past its hold (after a short grace).
  const survivors: HeldBatch[] = [];
  for (const batch of run.holder) {
    if (batch.count <= 0) continue;
    if (batch.expiresAtMin + WASTE_GRACE_MIN <= nowMin) {
      run.wasteUnits[batch.recipeId] += batch.count;
    } else {
      survivors.push(batch);
    }
  }
  run.holder = survivors;

  // 4. Drops — once per cadence window.
  const winStart = windowStart(nowMin);
  if (nowMin >= BK_SERVICE_START_MIN && nowMin <= BK_SERVICE_END_MIN) {
    for (const cfg of ALL_RECIPES) {
      if (run.lastDropWindow[cfg.recipeId] === winStart) continue;
      const qty = decideDrop(run, cfg, nowMin);
      if (qty > 0) {
        run.cooking.push({ recipeId: cfg.recipeId, qty, readyAtMin: nowMin + cfg.cookMinutes });
        run.produced += qty;
      }
      run.lastDropWindow[cfg.recipeId] = winStart;
    }
  }
}

/** AI strategy: cover net need for the next window, surge-aware. */
function aiDrop(state: SimState) {
  return (run: RunState, cfg: RecipeConfig, nowMin: number): number => {
    const winStart = windowStart(nowMin);
    const upcoming =
      demandForWindow(cfg.recipeId, winStart + BK_DROP_INTERVAL_MIN) *
      surgeMultiplier(state, cfg.recipeId);
    const net = upcoming - heldOf(run, cfg.recipeId, nowMin) - cookingOf(run, cfg.recipeId);
    return net > 0 ? Math.max(cfg.multipleOf, roundToMultiple(net, cfg.multipleOf)) : 0;
  };
}

/** Baseline strategy: drop the same flat par every window, blind to the day. */
function baselineDrop(cfg: RecipeConfig): number {
  // Cook the flat par regardless of curve or surge — the "set it and forget
  // it" plan a manager writes once in the morning and never revisits.
  return cfg.flatPar;
}

function advance(prev: SimState, stepMin: number): SimState {
  const state: SimState = {
    nowMin: prev.nowMin + stepMin,
    ai: cloneRun(prev.ai),
    baseline: cloneRun(prev.baseline),
    surges: prev.surges.filter(s => prev.nowMin < s.untilMin),
    firedRecuts: new Set(prev.firedRecuts),
    recut: prev.recut,
  };

  for (let m = prev.nowMin + 1; m <= state.nowMin; m += 1) {
    // Fire scheduled re-cuts (and apply their surges to real demand).
    for (let i = 0; i < RECUT_SCRIPT.length; i += 1) {
      const ev = RECUT_SCRIPT[i];
      const fireAt = BK_DEMO_START_MIN + ev.atOffset;
      if (m >= fireAt && !state.firedRecuts.has(i)) {
        state.firedRecuts.add(i);
        state.recut = { id: i, message: ev.message, tone: ev.tone, atMin: m };
        if (ev.surge) {
          state.surges.push({
            recipeId: ev.surge.recipeId,
            multiplier: ev.surge.multiplier,
            untilMin: m + ev.surge.forMinutes,
          });
        }
      }
    }

    const tmp: SimState = { ...state, nowMin: m };
    const realPerMin = (recipeId: RecipeId) =>
      (demandForWindow(recipeId, windowStart(m)) / BK_DROP_INTERVAL_MIN) *
      surgeMultiplier(tmp, recipeId);

    stepRun(state.ai, m, realPerMin, aiDrop(tmp));
    stepRun(state.baseline, m, realPerMin, (_run, cfg) => baselineDrop(cfg));
  }

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot — what the scoreboard renders
// ─────────────────────────────────────────────────────────────────────────────

export type StrategyScore = {
  produced: number;
  sold: number;
  wasteUnits: number;
  missedUnits: number;
  /** £ of food binned. */
  wasteCost: number;
  /** £ of sales lost to empty cabinets. */
  missedRevenue: number;
  /** wasteCost + missedRevenue — total money left on the table. */
  totalLoss: number;
  /** Per-recipe breakdown for the detail rows. */
  perRecipe: Array<{
    recipeId: RecipeId;
    name: string;
    wasteUnits: number;
    missedUnits: number;
    wasteCost: number;
    missedRevenue: number;
  }>;
};

function scoreRun(run: RunState): StrategyScore {
  let wasteCost = 0;
  let missedRevenue = 0;
  let wasteUnits = 0;
  let missedUnits = 0;
  const perRecipe = ALL_RECIPES.map(cfg => {
    const w = run.wasteUnits[cfg.recipeId] ?? 0;
    const mu = run.missedUnits[cfg.recipeId] ?? 0;
    const wc = w * cfg.cost;
    const mr = mu * cfg.price;
    wasteUnits += w;
    missedUnits += mu;
    wasteCost += wc;
    missedRevenue += mr;
    return { recipeId: cfg.recipeId, name: cfg.name, wasteUnits: w, missedUnits: mu, wasteCost: wc, missedRevenue: mr };
  }).sort((a, b) => b.wasteCost + b.missedRevenue - (a.wasteCost + a.missedRevenue));
  return {
    produced: run.produced,
    sold: run.sold,
    wasteUnits,
    missedUnits,
    wasteCost,
    missedRevenue,
    totalLoss: wasteCost + missedRevenue,
    perRecipe,
  };
}

export type ForecastImpactSnapshot = {
  nowMin: number;
  nowHHMM: string;
  playing: boolean;
  atEnd: boolean;
  /** Fraction of the live demo window elapsed (0–1) for progress UI. */
  progress: number;
  recut: { id: number; message: string; tone: RecutTone; atMin: number } | null;
  ai: StrategyScore;
  baseline: StrategyScore;
  /** baseline.totalLoss − ai.totalLoss, so far today. */
  savedSoFar: number;
  /** Same metric, fast-forwarded across the whole service. */
  projectedFullDay: { ai: StrategyScore; baseline: StrategyScore; saved: number };
};

/** The live demo runs from the demo start to the dinner lull so both the
 *  surge (missed sales) and the easing (waste) phases are visible. */
const DEMO_END_MIN = Math.min(BK_SERVICE_END_MIN, BK_DEMO_START_MIN + 150);

function buildSnapshot(state: SimState, playing: boolean): ForecastImpactSnapshot {
  const ai = scoreRun(state.ai);
  const baseline = scoreRun(state.baseline);
  const span = Math.max(1, DEMO_END_MIN - BK_DEMO_START_MIN);
  return {
    nowMin: state.nowMin,
    nowHHMM: minutesToHHMM(Math.min(state.nowMin, 24 * 60 - 1)),
    playing,
    atEnd: state.nowMin >= DEMO_END_MIN,
    progress: Math.max(0, Math.min(1, (state.nowMin - BK_DEMO_START_MIN) / span)),
    recut: state.recut,
    ai,
    baseline,
    savedSoFar: baseline.totalLoss - ai.totalLoss,
    projectedFullDay: PROJECTED_FULL_DAY,
  };
}

/** Deterministic fast-forward of the entire service for both strategies. */
const PROJECTED_FULL_DAY: { ai: StrategyScore; baseline: StrategyScore; saved: number } = (() => {
  let s = initialState();
  while (s.nowMin < BK_SERVICE_END_MIN) {
    s = advance(s, BK_DROP_INTERVAL_MIN);
  }
  const ai = scoreRun(s.ai);
  const baseline = scoreRun(s.baseline);
  return { ai, baseline, saved: baseline.totalLoss - ai.totalLoss };
})();

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

const TICK_MS = 1400;

export type ForecastImpact = ForecastImpactSnapshot & {
  togglePlay: () => void;
  reset: () => void;
  step: (min: number) => void;
  stepToNextDrop: () => void;
  demoEndMin: number;
};

export function useForecastImpact(): ForecastImpact {
  const stateRef = useRef<SimState>(initialState());
  const [playing, setPlaying] = useState(false);
  const [, force] = useState(0);

  const advanceBy = (min: number) => {
    const target = Math.min(DEMO_END_MIN, stateRef.current.nowMin + min);
    const delta = target - stateRef.current.nowMin;
    if (delta > 0) stateRef.current = advance(stateRef.current, delta);
    force(n => n + 1);
  };

  // Auto-play advances one demo-minute per tick until the demo window ends.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (stateRef.current.nowMin >= DEMO_END_MIN) {
        setPlaying(false);
        return;
      }
      stateRef.current = advance(stateRef.current, 1);
      force(n => n + 1);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  const snapshot = useMemo(
    () => buildSnapshot(stateRef.current, playing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateRef.current.nowMin, stateRef.current.recut, playing],
  );

  return {
    ...snapshot,
    demoEndMin: DEMO_END_MIN,
    togglePlay: () => setPlaying(p => !p),
    reset: () => {
      stateRef.current = initialState();
      setPlaying(false);
      force(n => n + 1);
    },
    step: (min: number) => advanceBy(min),
    stepToNextDrop: () => {
      const now = stateRef.current.nowMin;
      const next = windowStart(now) + BK_DROP_INTERVAL_MIN;
      advanceBy(Math.max(1, next - now));
    },
  };
}

/** Currency formatting used across the scoreboard. */
export function gbp(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}
