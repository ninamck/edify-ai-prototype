'use client';

/**
 * pretHotLoopStore — the simulated closed loop behind the Pret hot-line
 * crew screen.
 *
 * Same shape as `crewLoopStore` (the Burger King line) but tuned for Pret's
 * hot shelf: a 30-minute batch cadence, the Pret hot-prod menu, and a
 * per-item "sold so far" tally the shelf cards surface. There is no Quinn /
 * Edify re-cut script here — the hot line screen is kept deliberately plain.
 *
 *   • a demo clock advances ~1 minute per real second
 *   • forecast demand per 30-min window drives how many of each item the
 *     line should be holding
 *   • the line auto-drops fresh batches to cover the NET need
 *     (forecast − held − already-cooking), respecting the 30-min cadence
 *   • cooked batches land on the holding shelf and decay; anything past its
 *     hold life lingers flagged "pull" then drops off
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PRET_HOT_BATCH_INTERVAL_MIN,
  PRET_HOT_DEMO_START_MIN,
  PRET_HOT_ITEMS,
  PRET_HOT_SERVICE_END_MIN,
  PRET_HOT_SERVICE_START_MIN,
  PRET_HOT_SHELF_SEED,
  type PretHotItem,
} from './pretHotFixtures';
import type { RecipeId } from './fixtures';
import { minutesToHHMM } from './time';

// ─────────────────────────────────────────────────────────────────────────────
// Demand model — turn a daily forecast into a per-30-min-window curve
// ─────────────────────────────────────────────────────────────────────────────

/** Twin-peak (breakfast + lunch) intensity across the service window. */
function intensityAt(min: number): number {
  const breakfast = 0.7 * Math.exp(-(((min - 510) / 70) ** 2)); // ~08:30
  const lunch = Math.exp(-(((min - 765) / 75) ** 2)); // ~12:45 peak
  const base = 0.22; // a steady trickle between peaks
  return base + breakfast + lunch;
}

/** Pre-integrate intensity across the service window so window shares sum to 1. */
const TOTAL_INTENSITY = (() => {
  let sum = 0;
  for (let m = PRET_HOT_SERVICE_START_MIN; m < PRET_HOT_SERVICE_END_MIN; m += 1) {
    sum += intensityAt(m);
  }
  return sum;
})();

const DAY_TOTAL: Record<RecipeId, number> = (() => {
  const out: Record<RecipeId, number> = {};
  for (const item of PRET_HOT_ITEMS) out[item.recipeId] = item.dayTotal;
  return out;
})();

/** Forecast units for an item across the 30-min window starting at `startMin`. */
function demandForWindow(recipeId: RecipeId, startMin: number): number {
  const dayTotal = DAY_TOTAL[recipeId] ?? 0;
  if (dayTotal === 0) return 0;
  let share = 0;
  const end = Math.min(startMin + PRET_HOT_BATCH_INTERVAL_MIN, PRET_HOT_SERVICE_END_MIN);
  for (let m = Math.max(startMin, PRET_HOT_SERVICE_START_MIN); m < end; m += 1) {
    share += intensityAt(m);
  }
  return (dayTotal * share) / TOTAL_INTENSITY;
}

/** Start minute of the 30-min window containing `min`. */
function windowStart(min: number): number {
  const offset = min - PRET_HOT_SERVICE_START_MIN;
  return (
    PRET_HOT_SERVICE_START_MIN +
    Math.floor(offset / PRET_HOT_BATCH_INTERVAL_MIN) * PRET_HOT_BATCH_INTERVAL_MIN
  );
}

const ITEM_CONFIG: Record<RecipeId, PretHotItem> = (() => {
  const out: Record<RecipeId, PretHotItem> = {};
  for (const item of PRET_HOT_ITEMS) out[item.recipeId] = item;
  return out;
})();

// ─────────────────────────────────────────────────────────────────────────────
// Mutable simulation state
// ─────────────────────────────────────────────────────────────────────────────

type HeldBatch = {
  id: string;
  recipeId: RecipeId;
  count: number;
  cookedAtMin: number;
  expiresAtMin: number;
};

type CookingBatch = {
  id: string;
  recipeId: RecipeId;
  qty: number;
  readyAtMin: number;
};

type SimState = {
  nowMin: number;
  holder: HeldBatch[];
  cooking: CookingBatch[];
  sellCarry: Record<RecipeId, number>;
  soldByRecipe: Record<RecipeId, number>;
  wasteTotal: number;
  soldTotal: number;
  lastDropWindow: Record<RecipeId, number>;
  seq: number;
};

function initialState(): SimState {
  const start = PRET_HOT_DEMO_START_MIN;
  const holder: HeldBatch[] = PRET_HOT_SHELF_SEED.map((seed, i) => {
    const cfg = ITEM_CONFIG[seed.recipeId];
    const shelf = cfg?.shelfLifeMin ?? 45;
    const cookedAtMin = start - seed.cookedMinAgo;
    return {
      id: `seed-${i}`,
      recipeId: seed.recipeId,
      count: seed.count,
      cookedAtMin,
      expiresAtMin: cookedAtMin + shelf,
    };
  });
  const sellCarry: Record<RecipeId, number> = {};
  const soldByRecipe: Record<RecipeId, number> = {};
  const lastDropWindow: Record<RecipeId, number> = {};
  for (const cfg of PRET_HOT_ITEMS) {
    sellCarry[cfg.recipeId] = 0;
    // Seed a believable mid-service "sold so far" so the shelf cards read real.
    soldByRecipe[cfg.recipeId] = Math.round(cfg.dayTotal * 0.32);
    lastDropWindow[cfg.recipeId] = -1;
  }
  const soldTotal = Object.values(soldByRecipe).reduce((a, b) => a + b, 0);
  return {
    nowMin: start,
    holder,
    cooking: [],
    sellCarry,
    soldByRecipe,
    wasteTotal: 0,
    soldTotal,
    lastDropWindow,
    seq: 0,
  };
}

/** Held units of an item that are still within their hold (sellable). */
function heldOf(state: SimState, recipeId: RecipeId): number {
  return state.holder
    .filter(b => b.recipeId === recipeId && b.expiresAtMin > state.nowMin)
    .reduce((a, b) => a + b.count, 0);
}

/** Units of an item currently in the oven / on the press. */
function cookingOf(state: SimState, recipeId: RecipeId): number {
  return state.cooking
    .filter(b => b.recipeId === recipeId)
    .reduce((a, b) => a + b.qty, 0);
}

function roundToMultiple(n: number, multiple: number): number {
  if (multiple <= 1) return Math.max(0, Math.round(n));
  return Math.max(0, Math.ceil(n / multiple) * multiple);
}

/** Grace window an over-hold batch lingers flagged "pull" before it drops off. */
const WASTE_GRACE_MIN = 20;

/** Advance the simulation by `stepMin` demo-minutes (mutates a fresh copy). */
function advance(prev: SimState, stepMin: number): SimState {
  const state: SimState = {
    ...prev,
    holder: prev.holder.map(b => ({ ...b })),
    cooking: prev.cooking.map(b => ({ ...b })),
    sellCarry: { ...prev.sellCarry },
    soldByRecipe: { ...prev.soldByRecipe },
    lastDropWindow: { ...prev.lastDropWindow },
  };
  state.nowMin = prev.nowMin + stepMin;
  const now = state.nowMin;

  // 1. Move finished cooks onto the holding shelf.
  const stillCooking: CookingBatch[] = [];
  for (const cook of state.cooking) {
    if (cook.readyAtMin <= now) {
      const cfg = ITEM_CONFIG[cook.recipeId];
      state.holder.push({
        id: `b-${state.seq++}`,
        recipeId: cook.recipeId,
        count: cook.qty,
        cookedAtMin: cook.readyAtMin,
        expiresAtMin: cook.readyAtMin + (cfg?.shelfLifeMin ?? 45),
      });
    } else {
      stillCooking.push(cook);
    }
  }
  state.cooking = stillCooking;

  // 2. Sell from the shelf against demand (oldest batch first).
  for (const cfg of PRET_HOT_ITEMS) {
    const winStart = windowStart(now);
    const perMin = demandForWindow(cfg.recipeId, winStart) / PRET_HOT_BATCH_INTERVAL_MIN;
    const toSell = perMin * stepMin + (state.sellCarry[cfg.recipeId] ?? 0);
    let sellWhole = Math.floor(toSell);
    state.sellCarry[cfg.recipeId] = toSell - sellWhole;
    if (sellWhole <= 0) continue;
    const batches = state.holder
      .filter(b => b.recipeId === cfg.recipeId && b.expiresAtMin > now)
      .sort((a, b) => a.expiresAtMin - b.expiresAtMin);
    for (const batch of batches) {
      if (sellWhole <= 0) break;
      const take = Math.min(batch.count, sellWhole);
      batch.count -= take;
      sellWhole -= take;
      state.soldTotal += take;
      state.soldByRecipe[cfg.recipeId] = (state.soldByRecipe[cfg.recipeId] ?? 0) + take;
    }
  }

  // 3. Anything past its hold lingers flagged "pull" for a grace window, then
  //    drops off the shelf. Empty batches drop out.
  const survivors: HeldBatch[] = [];
  for (const batch of state.holder) {
    if (batch.count <= 0) continue;
    if (batch.expiresAtMin + WASTE_GRACE_MIN <= now) {
      state.wasteTotal += batch.count;
    } else {
      survivors.push(batch);
    }
  }
  state.holder = survivors;

  // 4. Decide drops once per cadence window: cover NET need for the *next*
  //    window so a fresh batch is ready as demand lands.
  const winStart = windowStart(now);
  for (const cfg of PRET_HOT_ITEMS) {
    if (state.lastDropWindow[cfg.recipeId] === winStart) continue;
    if (now < PRET_HOT_SERVICE_START_MIN || now > PRET_HOT_SERVICE_END_MIN) continue;
    const upcoming = demandForWindow(cfg.recipeId, winStart + PRET_HOT_BATCH_INTERVAL_MIN);
    const net = upcoming - heldOf(state, cfg.recipeId) - cookingOf(state, cfg.recipeId);
    if (net > 0) {
      const qty = Math.max(cfg.multipleOf, roundToMultiple(net, cfg.multipleOf));
      state.cooking.push({
        id: `c-${state.seq++}`,
        recipeId: cfg.recipeId,
        qty,
        readyAtMin: now + cfg.cookMinutes,
      });
    }
    state.lastDropWindow[cfg.recipeId] = winStart;
  }

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot shape consumed by the hot-line display
// ─────────────────────────────────────────────────────────────────────────────

export type HotDropItem = {
  id: string;
  recipeId: RecipeId;
  name: string;
  count: number;
  cookMinutes: number;
  /** Minutes left when it's already cooking; null when planned / not started. */
  readyInMin: number | null;
};

/** One upcoming batch window — the forecast for a future 30-min slot. */
export type UpcomingBatch = {
  id: string;
  /** Clock time the batch lands, e.g. "13:30". */
  hhmm: string;
  /** Demo minutes until this window starts. */
  minsUntil: number;
  items: HotDropItem[];
};

export type HotHeldDisplay = {
  id: string;
  recipeId: RecipeId;
  name: string;
  count: number;
  /** Units of this item sold so far today. */
  sold: number;
  expiresInMin: number;
  shelfLifeMin: number;
  /** Hold window is up — pull it. */
  expired: boolean;
};

export type PretHotLoopSnapshot = {
  nowMin: number;
  nowHHMM: string;
  playing: boolean;
  soldTotal: number;
  wasteTotal: number;
  // ── Batch-clock view ─────────────────────────────────────────────────────
  minsToNextBatch: number;
  batchIntervalMin: number;
  nextBatchHHMM: string;
  currentWindowLabel: string;
  /** Net shortfall right now that isn't yet cooking — "Now". */
  toMake: HotDropItem[];
  /** Batches cooking right now, with their timers. */
  cooking: HotDropItem[];
  /** Forecast counts for the upcoming batch so the crew can pace. */
  nextBatch: HotDropItem[];
  /** Forecast for the next several batch windows (for the "show more" toggle). */
  upcomingBatches: UpcomingBatch[];
  /** Everything on the holding shelf, freshest-expiring first. */
  shelf: HotHeldDisplay[];
};

function mkItem(
  recipeId: RecipeId,
  count: number,
  readyInMin: number | null,
  idSuffix: string,
): HotDropItem | null {
  const cfg = ITEM_CONFIG[recipeId];
  if (!cfg) return null;
  return {
    id: `${recipeId}-${idSuffix}`,
    recipeId,
    name: cfg.name,
    count,
    cookMinutes: cfg.cookMinutes,
    readyInMin,
  };
}

function buildSnapshot(state: SimState, playing: boolean): PretHotLoopSnapshot {
  const winStart = windowStart(state.nowMin);
  const nextWin = winStart + PRET_HOT_BATCH_INTERVAL_MIN;
  const minsToNextBatch = Math.max(0, nextWin - state.nowMin);

  // Cooking right now — what's on the line, sorted by who's ready first.
  const cooking: HotDropItem[] = state.cooking
    .slice()
    .sort((a, b) => a.readyAtMin - b.readyAtMin)
    .map(c => mkItem(c.recipeId, c.qty, Math.max(0, c.readyAtMin - state.nowMin), c.id))
    .filter((x): x is HotDropItem => x !== null);

  // Now — demand this window not covered by held + cooking.
  const toMake: HotDropItem[] = [];
  for (const cfg of PRET_HOT_ITEMS) {
    const nowDemand = demandForWindow(cfg.recipeId, winStart);
    const net = Math.round(
      nowDemand - heldOf(state, cfg.recipeId) - cookingOf(state, cfg.recipeId),
    );
    if (net > 0) {
      const item = mkItem(
        cfg.recipeId,
        Math.max(cfg.multipleOf, roundToMultiple(net, cfg.multipleOf)),
        null,
        'now',
      );
      if (item) toMake.push(item);
    }
  }
  toMake.sort((a, b) => b.count - a.count);

  // Upcoming batches — forecast across the next few 30-min windows so the
  // crew can pace ahead. The first window is the immediate "next batch".
  const upcomingBatches: UpcomingBatch[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const ws = winStart + i * PRET_HOT_BATCH_INTERVAL_MIN;
    if (ws >= PRET_HOT_SERVICE_END_MIN) break;
    const items: HotDropItem[] = [];
    for (const cfg of PRET_HOT_ITEMS) {
      const upcoming = Math.round(demandForWindow(cfg.recipeId, ws));
      if (upcoming > 0) {
        const item = mkItem(cfg.recipeId, upcoming, null, `up${i}`);
        if (item) items.push(item);
      }
    }
    items.sort((a, b) => b.count - a.count);
    if (items.length > 0) {
      upcomingBatches.push({
        id: `win-${ws}`,
        hhmm: minutesToHHMM(Math.min(ws, 24 * 60 - 1)),
        minsUntil: Math.max(0, ws - state.nowMin),
        items,
      });
    }
  }
  const nextBatch = upcomingBatches[0]?.items ?? [];

  // Shelf — flat, freshest-expiring first, with per-item sold tally.
  const shelf: HotHeldDisplay[] = state.holder
    .slice()
    .sort((a, b) => a.expiresAtMin - b.expiresAtMin)
    .map(b => ({
      id: b.id,
      recipeId: b.recipeId,
      name: ITEM_CONFIG[b.recipeId]?.name ?? b.recipeId,
      count: b.count,
      sold: state.soldByRecipe[b.recipeId] ?? 0,
      expiresInMin: Math.max(0, b.expiresAtMin - state.nowMin),
      shelfLifeMin: ITEM_CONFIG[b.recipeId]?.shelfLifeMin ?? 45,
      expired: b.expiresAtMin <= state.nowMin,
    }));

  return {
    nowMin: state.nowMin,
    nowHHMM: minutesToHHMM(Math.min(state.nowMin, 24 * 60 - 1)),
    playing,
    soldTotal: state.soldTotal,
    wasteTotal: state.wasteTotal,
    minsToNextBatch,
    batchIntervalMin: PRET_HOT_BATCH_INTERVAL_MIN,
    nextBatchHHMM: minutesToHHMM(Math.min(nextWin, 24 * 60 - 1)),
    currentWindowLabel: `${minutesToHHMM(winStart)} → ${minutesToHHMM(Math.min(nextWin, 24 * 60 - 1))}`,
    toMake,
    cooking,
    nextBatch,
    upcomingBatches,
    shelf,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/** Real milliseconds per demo-minute when auto-play is on (slow on purpose). */
const TICK_MS = 2500;

export type PretHotLoop = PretHotLoopSnapshot & {
  togglePlay: () => void;
  reset: () => void;
  /** Advance the simulation by `min` demo-minutes (one minute at a time). */
  step: (min: number) => void;
  /** Jump straight to the next 30-min batch boundary. */
  stepToNextBatch: () => void;
  /**
   * Drop an extra order straight onto the line now (a large order just came
   * in). Each item starts cooking immediately and lands on the shelf when done.
   */
  addOrder: (orders: { recipeId: RecipeId; qty: number }[]) => void;
  /** True once the service window is over — nothing left to step. */
  atEnd: boolean;
};

export function usePretHotLoop(): PretHotLoop {
  const stateRef = useRef<SimState>(initialState());
  // Default paused: the demo is stepped by hand.
  const [playing, setPlaying] = useState(false);
  // `tick` both forces a re-render and re-runs the snapshot memo — needed for
  // in-place mutations (addOrder) that don't advance the clock.
  const [tick, force] = useState(0);

  const advanceBy = (min: number) => {
    let s = stateRef.current;
    for (let i = 0; i < min; i += 1) {
      if (s.nowMin >= PRET_HOT_SERVICE_END_MIN) break;
      s = advance(s, 1);
    }
    stateRef.current = s;
    force(n => n + 1);
  };

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (stateRef.current.nowMin >= PRET_HOT_SERVICE_END_MIN) {
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
    [stateRef.current.nowMin, playing, tick],
  );

  return {
    ...snapshot,
    togglePlay: () => setPlaying(p => !p),
    reset: () => {
      stateRef.current = initialState();
      setPlaying(false);
      force(n => n + 1);
    },
    step: (min: number) => advanceBy(min),
    addOrder: (orders: { recipeId: RecipeId; qty: number }[]) => {
      const s = stateRef.current;
      let added = false;
      for (const o of orders) {
        if (o.qty <= 0) continue;
        const cfg = ITEM_CONFIG[o.recipeId];
        if (!cfg) continue;
        s.cooking.push({
          id: `order-${s.seq++}`,
          recipeId: o.recipeId,
          qty: o.qty,
          readyAtMin: s.nowMin + cfg.cookMinutes,
        });
        added = true;
      }
      if (added) force(n => n + 1);
    },
    stepToNextBatch: () => {
      const now = stateRef.current.nowMin;
      const next = windowStart(now) + PRET_HOT_BATCH_INTERVAL_MIN;
      const jump = next - now;
      advanceBy(jump > 0 ? jump : PRET_HOT_BATCH_INTERVAL_MIN);
    },
    atEnd: stateRef.current.nowMin >= PRET_HOT_SERVICE_END_MIN,
  };
}
