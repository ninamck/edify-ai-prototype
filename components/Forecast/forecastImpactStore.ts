'use client';

/**
 * forecastImpactStore — the "AI forecast vs the old way" head-to-head.
 *
 * This is the engine behind the headline forecast demo. It runs the *same*
 * service twice, against identical real demand, with two production strategies:
 *
 *   • AI         — Edify's signal-weighted forecast. It cooks to the live
 *                  per-15-min demand curve and reacts to Quinn's intra-day
 *                  re-cuts (learned demand patterns from past comparable days),
 *                  cooking ahead just before a surge and easing off after it.
 *   • Baseline   — the "old way": a flat par. The kitchen drops the same
 *                  steady number every window — the day's average — with no
 *                  curve and no reaction to anything happening on the day.
 *
 * Both strategies face the SAME real footfall (including surges — real demand
 * is real demand whether or not you predicted it). The only thing that differs
 * is how much each chose to make. The divergence is the whole point:
 *
 *   • At the peak / during a surge the flat par runs dry → MISSED SALES.
 *   • Once the rush eases the flat par keeps making → WASTE (binned units).
 *   • The AI tracks the curve, so it does far less of both.
 *
 * The dataset (items, demand curve, cabinet seed, re-cut script, service clock)
 * is supplied by `forecastDemoData` and swaps per customer — burgers for the
 * internal build, drinks for a customer demo — without touching this engine.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { minutesToHHMM } from '@/components/Production/time';
import { FORECAST_DEMO, type RecutTone } from './forecastDemoData';

export type { RecutTone };

/** Item ids are opaque strings supplied by the dataset. */
type ItemId = string;

const SERVICE_START = FORECAST_DEMO.serviceStartMin;
const SERVICE_END = FORECAST_DEMO.serviceEndMin;
const DEMO_START = FORECAST_DEMO.demoStartMin;
const DROP_INTERVAL = FORECAST_DEMO.dropIntervalMin;
const ITEMS = FORECAST_DEMO.items;
const PEAKS = FORECAST_DEMO.peaks;
const BASE_INTENSITY = FORECAST_DEMO.baseIntensity;

// ─────────────────────────────────────────────────────────────────────────────
// Demand model — a base level plus one Gaussian per configured peak.
// ─────────────────────────────────────────────────────────────────────────────

function intensityAt(min: number): number {
  let v = BASE_INTENSITY;
  for (const p of PEAKS) v += p.weight * Math.exp(-(((min - p.centre) / p.width) ** 2));
  return v;
}

const TOTAL_INTENSITY = (() => {
  let sum = 0;
  for (let m = SERVICE_START; m < SERVICE_END; m += 1) sum += intensityAt(m);
  return sum;
})();

const DAY_TOTAL: Record<ItemId, number> = (() => {
  const out: Record<ItemId, number> = {};
  for (const item of ITEMS) out[item.id] = item.dayTotal;
  return out;
})();

/** Forecast units for an item across the 15-min window starting at `startMin`. */
function demandForWindow(itemId: ItemId, startMin: number): number {
  const dayTotal = DAY_TOTAL[itemId] ?? 0;
  if (dayTotal === 0) return 0;
  let share = 0;
  const end = Math.min(startMin + DROP_INTERVAL, SERVICE_END);
  for (let m = Math.max(startMin, SERVICE_START); m < end; m += 1) {
    share += intensityAt(m);
  }
  return (dayTotal * share) / TOTAL_INTENSITY;
}

function windowStart(min: number): number {
  const offset = min - SERVICE_START;
  return SERVICE_START + Math.floor(offset / DROP_INTERVAL) * DROP_INTERVAL;
}

const WINDOW_COUNT = Math.max(1, Math.round((SERVICE_END - SERVICE_START) / DROP_INTERVAL));

// ─────────────────────────────────────────────────────────────────────────────
// Per-item config + economics
// ─────────────────────────────────────────────────────────────────────────────

type ItemConfig = {
  itemId: ItemId;
  name: string;
  multipleOf: number;
  cookMinutes: number;
  shelfLifeMin: number;
  /** Flat par the baseline drops every window (the day average, rounded). */
  flatPar: number;
  /** Average sell price — drives "missed sales" (lost revenue). */
  price: number;
  /** Cost per unit — drives "waste" (money in the bin). */
  cost: number;
};

const ITEM_CONFIG: Record<ItemId, ItemConfig> = (() => {
  const out: Record<ItemId, ItemConfig> = {};
  for (const item of ITEMS) {
    const multipleOf = item.multipleOf;
    const avgPerWindow = item.dayTotal / WINDOW_COUNT;
    const flatPar = Math.max(multipleOf, Math.round(avgPerWindow / multipleOf) * multipleOf);
    out[item.id] = {
      itemId: item.id,
      name: item.name,
      multipleOf,
      cookMinutes: item.cookMinutes,
      shelfLifeMin: item.shelfLifeMin,
      flatPar,
      price: item.price,
      cost: item.cost,
    };
  }
  return out;
})();

const ALL_ITEMS = Object.values(ITEM_CONFIG);

// ─────────────────────────────────────────────────────────────────────────────
// Quinn re-cut script — the intra-day signals the AI reacts to (and the
// baseline ignores). Surges raise *real* demand for everyone; only the AI's
// drop decisions anticipate them.
// ─────────────────────────────────────────────────────────────────────────────

const RECUTS = FORECAST_DEMO.recuts;

// ─────────────────────────────────────────────────────────────────────────────
// Simulation state — one RunState per strategy, shared demand + surges
// ─────────────────────────────────────────────────────────────────────────────

export type StrategyId = 'ai' | 'baseline';

type HeldBatch = {
  id: string;
  itemId: ItemId;
  count: number;
  expiresAtMin: number;
};

type CookingBatch = { itemId: ItemId; qty: number; readyAtMin: number };

type RunState = {
  holder: HeldBatch[];
  cooking: CookingBatch[];
  sellCarry: Record<ItemId, number>;
  lastDropWindow: Record<ItemId, number>;
  produced: number;
  sold: number;
  wasteUnits: Record<ItemId, number>;
  missedUnits: Record<ItemId, number>;
  seq: number;
};

type Surge = { itemId: ItemId; multiplier: number; untilMin: number };

type SimState = {
  nowMin: number;
  ai: RunState;
  baseline: RunState;
  surges: Surge[];
  firedRecuts: Set<number>;
  recut: { id: number; message: string; tone: RecutTone; atMin: number } | null;
};

function emptyRun(): RunState {
  const sellCarry: Record<ItemId, number> = {};
  const lastDropWindow: Record<ItemId, number> = {};
  const wasteUnits: Record<ItemId, number> = {};
  const missedUnits: Record<ItemId, number> = {};
  for (const cfg of ALL_ITEMS) {
    sellCarry[cfg.itemId] = 0;
    lastDropWindow[cfg.itemId] = -1;
    wasteUnits[cfg.itemId] = 0;
    missedUnits[cfg.itemId] = 0;
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

/** Seed a run's cabinet from the shared holder seed (both start identical). */
function seedRun(run: RunState, startMin: number): void {
  run.holder = FORECAST_DEMO.holderSeed.map((seed, i) => {
    const cfg = ITEM_CONFIG[seed.itemId];
    const shelf = cfg?.shelfLifeMin ?? 20;
    const cookedAtMin = startMin - seed.cookedMinAgo;
    return {
      id: `${i}-seed`,
      itemId: seed.itemId,
      count: seed.count,
      expiresAtMin: cookedAtMin + shelf,
    };
  });
}

function initialState(): SimState {
  const start = DEMO_START;
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

function surgeMultiplier(state: SimState, itemId: ItemId): number {
  let mult = 1;
  for (const s of state.surges) {
    if (s.itemId === itemId && state.nowMin < s.untilMin) mult *= s.multiplier;
  }
  return mult;
}

function heldOf(run: RunState, itemId: ItemId, nowMin: number): number {
  return run.holder
    .filter(b => b.itemId === itemId && b.expiresAtMin > nowMin)
    .reduce((a, b) => a + b.count, 0);
}

function cookingOf(run: RunState, itemId: ItemId): number {
  return run.cooking.filter(b => b.itemId === itemId).reduce((a, b) => a + b.qty, 0);
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
 * demand. `decideDrop` returns how many units to start making at a window
 * boundary (0 = don't drop this window).
 */
function stepRun(
  run: RunState,
  nowMin: number,
  realPerMin: (itemId: ItemId) => number,
  decideDrop: (run: RunState, cfg: ItemConfig, nowMin: number) => number,
): void {
  // 1. Finished cooks → cabinet.
  const stillCooking: CookingBatch[] = [];
  for (const cook of run.cooking) {
    if (cook.readyAtMin <= nowMin) {
      const cfg = ITEM_CONFIG[cook.itemId];
      run.holder.push({
        id: `${run.seq++}-b`,
        itemId: cook.itemId,
        count: cook.qty,
        expiresAtMin: cook.readyAtMin + (cfg?.shelfLifeMin ?? 20),
      });
    } else {
      stillCooking.push(cook);
    }
  }
  run.cooking = stillCooking;

  // 2. Sell against real demand (oldest fresh first). Unmet demand = missed.
  for (const cfg of ALL_ITEMS) {
    const toSell = realPerMin(cfg.itemId) + (run.sellCarry[cfg.itemId] ?? 0);
    let want = Math.floor(toSell);
    run.sellCarry[cfg.itemId] = toSell - want;
    if (want <= 0) continue;
    const batches = run.holder
      .filter(b => b.itemId === cfg.itemId && b.expiresAtMin > nowMin)
      .sort((a, b) => a.expiresAtMin - b.expiresAtMin);
    for (const batch of batches) {
      if (want <= 0) break;
      const take = Math.min(batch.count, want);
      batch.count -= take;
      want -= take;
      run.sold += take;
    }
    // Anything still wanted after draining the cabinet is a lost sale.
    if (want > 0) run.missedUnits[cfg.itemId] += want;
  }

  // 3. Bin anything past its hold (after a short grace).
  const survivors: HeldBatch[] = [];
  for (const batch of run.holder) {
    if (batch.count <= 0) continue;
    if (batch.expiresAtMin + WASTE_GRACE_MIN <= nowMin) {
      run.wasteUnits[batch.itemId] += batch.count;
    } else {
      survivors.push(batch);
    }
  }
  run.holder = survivors;

  // 4. Drops — once per cadence window.
  const winStart = windowStart(nowMin);
  if (nowMin >= SERVICE_START && nowMin <= SERVICE_END) {
    for (const cfg of ALL_ITEMS) {
      if (run.lastDropWindow[cfg.itemId] === winStart) continue;
      const qty = decideDrop(run, cfg, nowMin);
      if (qty > 0) {
        run.cooking.push({ itemId: cfg.itemId, qty, readyAtMin: nowMin + cfg.cookMinutes });
        run.produced += qty;
      }
      run.lastDropWindow[cfg.itemId] = winStart;
    }
  }
}

/** AI strategy: cover net need for the next window, surge-aware. */
function aiDrop(state: SimState) {
  return (run: RunState, cfg: ItemConfig, nowMin: number): number => {
    const winStart = windowStart(nowMin);
    const upcoming =
      demandForWindow(cfg.itemId, winStart + DROP_INTERVAL) *
      surgeMultiplier(state, cfg.itemId);
    const net = upcoming - heldOf(run, cfg.itemId, nowMin) - cookingOf(run, cfg.itemId);
    return net > 0 ? Math.max(cfg.multipleOf, roundToMultiple(net, cfg.multipleOf)) : 0;
  };
}

/** Baseline strategy: drop the same flat par every window, blind to the day. */
function baselineDrop(cfg: ItemConfig): number {
  // Make the flat par regardless of curve or surge — the "set it and forget
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
    for (let i = 0; i < RECUTS.length; i += 1) {
      const ev = RECUTS[i];
      const fireAt = DEMO_START + ev.atOffset;
      if (m >= fireAt && !state.firedRecuts.has(i)) {
        state.firedRecuts.add(i);
        state.recut = { id: i, message: ev.message, tone: ev.tone, atMin: m };
        if (ev.surge) {
          state.surges.push({
            itemId: ev.surge.itemId,
            multiplier: ev.surge.multiplier,
            untilMin: m + ev.surge.forMinutes,
          });
        }
      }
    }

    const tmp: SimState = { ...state, nowMin: m };
    const realPerMin = (itemId: ItemId) =>
      (demandForWindow(itemId, windowStart(m)) / DROP_INTERVAL) *
      surgeMultiplier(tmp, itemId);

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
  /** £ of stock binned. */
  wasteCost: number;
  /** £ of sales lost to empty cabinets. */
  missedRevenue: number;
  /** wasteCost + missedRevenue — total money left on the table. */
  totalLoss: number;
  /** Per-item breakdown for the detail rows. */
  perRecipe: Array<{
    recipeId: string;
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
  const perRecipe = ALL_ITEMS.map(cfg => {
    const w = run.wasteUnits[cfg.itemId] ?? 0;
    const mu = run.missedUnits[cfg.itemId] ?? 0;
    const wc = w * cfg.cost;
    const mr = mu * cfg.price;
    wasteUnits += w;
    missedUnits += mu;
    wasteCost += wc;
    missedRevenue += mr;
    return { recipeId: cfg.itemId, name: cfg.name, wasteUnits: w, missedUnits: mu, wasteCost: wc, missedRevenue: mr };
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

/** The live demo runs from the demo start to the lull so both the surge
 *  (missed sales) and the easing (waste) phases are visible. */
const DEMO_END_MIN = Math.min(SERVICE_END, DEMO_START + 150);

function buildSnapshot(state: SimState, playing: boolean): ForecastImpactSnapshot {
  const ai = scoreRun(state.ai);
  const baseline = scoreRun(state.baseline);
  const span = Math.max(1, DEMO_END_MIN - DEMO_START);
  return {
    nowMin: state.nowMin,
    nowHHMM: minutesToHHMM(Math.min(state.nowMin, 24 * 60 - 1)),
    playing,
    atEnd: state.nowMin >= DEMO_END_MIN,
    progress: Math.max(0, Math.min(1, (state.nowMin - DEMO_START) / span)),
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
  while (s.nowMin < SERVICE_END) {
    s = advance(s, DROP_INTERVAL);
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
      const next = windowStart(now) + DROP_INTERVAL;
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
