'use client';

/**
 * crewLoopStore — the simulated closed loop behind the Burger King crew
 * line display.
 *
 * It models the full forecast → drop → hold → sell → re-cut loop the CEO
 * brief describes, fast-forwarded so a demo viewer sees it move:
 *
 *   • a demo clock advances ~1 minute per real second
 *   • forecast demand per 15-min window drives how many of each component
 *     the line should be holding
 *   • the line auto-drops fresh batches to cover the NET need
 *     (forecast − held − already-cooking), respecting the 15-min cadence
 *   • cooked batches land in the holding cabinet and decay; anything past
 *     its shelf life is binned and counted as waste
 *   • Quinn periodically "re-cuts" the plan with a one-line human reason
 *     (a big delivery order, a coach party, the rush easing) — never a
 *     klaxon, always an explanation
 *
 * The whole thing is a single self-contained hook so the crew display can
 * `const loop = useCrewLoop()` and render. Nothing here touches the real
 * PlanStore — it's a self-driving demo.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BK_DEMO_START_MIN,
  BK_DROP_INTERVAL_MIN,
  BK_HOLDER_SEED,
  BK_PRODUCTION_ITEMS,
  BK_SERVICE_END_MIN,
  BK_SERVICE_START_MIN,
  BK_STATIONS,
  BK_FORECAST,
  type BkStation,
} from './bkFixtures';
import { getRecipe, getWorkflow } from './fixtures';
import type { RecipeId } from './fixtures';
import { minutesToHHMM } from './time';

// ─────────────────────────────────────────────────────────────────────────────
// Demand model — turn a daily forecast into a per-15-min-window curve
// ─────────────────────────────────────────────────────────────────────────────

/** Twin-peak (lunch + dinner) intensity across the service window. */
function intensityAt(min: number): number {
  const lunch = Math.exp(-(((min - 750) / 70) ** 2)); // ~12:30 peak
  const dinner = Math.exp(-(((min - 1110) / 80) ** 2)); // ~18:30 peak
  const base = 0.25; // a steady trickle between peaks
  return base + lunch + 0.75 * dinner;
}

/** Pre-integrate intensity across the service window so window shares sum to 1. */
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

/** Start minute of the 15-min window containing `min`. */
function windowStart(min: number): number {
  const offset = min - BK_SERVICE_START_MIN;
  return BK_SERVICE_START_MIN + Math.floor(offset / BK_DROP_INTERVAL_MIN) * BK_DROP_INTERVAL_MIN;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-recipe static config (batch size + cook time from the workflow)
// ─────────────────────────────────────────────────────────────────────────────

type RecipeConfig = {
  recipeId: RecipeId;
  name: string;
  batchSize: number;
  multipleOf: number;
  cookMinutes: number;
  shelfLifeMin: number;
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
    out[item.recipeId] = {
      recipeId: item.recipeId,
      name: recipe.name,
      batchSize: item.batchSize,
      multipleOf: recipe.batchRules?.multipleOf ?? 2,
      cookMinutes,
      shelfLifeMin: recipe.shelfLifeMinutes ?? 20,
    };
  }
  return out;
})();

// ─────────────────────────────────────────────────────────────────────────────
// Re-cut script — scheduled Quinn nudges relative to the demo start
// ─────────────────────────────────────────────────────────────────────────────

export type RecutTone = 'info' | 'cook-ahead' | 'ease-off';

type RecutEvent = {
  /** Demo minutes after start when this fires. */
  atOffset: number;
  message: string;
  /** Short label for the "on the radar" ribbon (what's coming). */
  radarLabel: string;
  /**
   * Why Quinn expects it — the learned pattern from history. Quinn can't know
   * about a one-off future event before it happens; it predicts from what the
   * POS has actually done at this slot on past comparable days.
   */
  basis: string;
  tone: RecutTone;
  /** Optional temporary demand surge applied when the event fires. */
  surge?: { recipeId: RecipeId; multiplier: number; forMinutes: number };
};

const RECUT_SCRIPT: RecutEvent[] = [
  { atOffset: 4, message: 'Lunch building right on cue — same curve as the last 4 Fridays. Cooking Whoppers ahead.', radarLabel: 'Whopper lunch peak', basis: 'last 4 Fridays', tone: 'cook-ahead', surge: { recipeId: 'bk-whopper-patty', multiplier: 1.5, forMinutes: 20 } },
  { atOffset: 16, message: 'App orders usually jump about now (last Friday, same slot) — dropping 2 trays of Juniors ahead.', radarLabel: 'App order bump', basis: 'last Fri, this slot', tone: 'cook-ahead', surge: { recipeId: 'bk-junior-patty', multiplier: 2.1, forMinutes: 12 } },
  { atOffset: 24, message: 'Fries always spike with the lunch meals (every weekday) — keeping the fryer ahead.', radarLabel: 'Fries spike', basis: 'every weekday lunch', tone: 'cook-ahead', surge: { recipeId: 'bk-fries', multiplier: 1.8, forMinutes: 16 } },
  { atOffset: 30, message: 'Chicken Royale picks up around now most days (last 2 weeks) — getting fillets ahead.', radarLabel: 'Royale pickup', basis: 'last 2 weeks, ~13:00', tone: 'cook-ahead', surge: { recipeId: 'bk-chicken-fillet', multiplier: 2.4, forMinutes: 18 } },
  { atOffset: 46, message: 'Rush easing — same as last week\u2019s tail. Holding back so nothing gets binned.', radarLabel: 'Rush eases', basis: 'last week\u2019s curve', tone: 'ease-off' },
  { atOffset: 60, message: 'Steady afternoon trade — cooking to the cabinet, no waste so far.', radarLabel: 'Steady trade', basis: 'typical afternoon', tone: 'info' },
];

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

type Surge = { recipeId: RecipeId; multiplier: number; startMin: number; untilMin: number };

/** One fired Quinn call, kept in a running log so the line can show recency. */
export type RecutLogEntry = { id: number; message: string; tone: RecutTone; atMin: number };

type SimState = {
  nowMin: number;
  holder: HeldBatch[];
  cooking: CookingBatch[];
  sellCarry: Record<RecipeId, number>;
  wasteTotal: number;
  soldTotal: number;
  /** Units sold today per recipe — drives the per-line "sold today" stat. */
  soldByRecipe: Record<RecipeId, number>;
  lastDropWindow: Record<RecipeId, number>;
  surges: Surge[];
  firedRecuts: Set<number>;
  recut: { id: number; message: string; tone: RecutTone; atMin: number } | null;
  /** Every fired re-cut, oldest first. */
  recutLog: RecutLogEntry[];
  seq: number;
};

/** How long after a predicted surge fires we badge its drops "Called it". */
const SURGE_LANDED_WINDOW_MIN = 6;
/** How far ahead the "on the radar" ribbon looks for upcoming Quinn calls. */
const RADAR_LOOKAHEAD_MIN = 30;

function initialState(): SimState {
  const start = BK_DEMO_START_MIN;
  const holder: HeldBatch[] = BK_HOLDER_SEED.map((seed, i) => {
    const cfg = RECIPE_CONFIG[seed.recipeId];
    const shelf = cfg?.shelfLifeMin ?? 20;
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
  for (const cfg of Object.values(RECIPE_CONFIG)) {
    sellCarry[cfg.recipeId] = 0;
    soldByRecipe[cfg.recipeId] = 0;
    lastDropWindow[cfg.recipeId] = -1;
  }
  return {
    nowMin: start,
    holder,
    cooking: [],
    sellCarry,
    wasteTotal: 0,
    soldTotal: 0,
    soldByRecipe,
    lastDropWindow,
    surges: [],
    firedRecuts: new Set(),
    recut: null,
    recutLog: [],
    seq: 0,
  };
}

/** Effective demand multiplier from any active surges for a recipe. */
function surgeMultiplier(state: SimState, recipeId: RecipeId): number {
  let mult = 1;
  for (const s of state.surges) {
    if (s.recipeId === recipeId && state.nowMin < s.untilMin) mult *= s.multiplier;
  }
  return mult;
}

/**
 * True if a recipe has an active surge that fired *recently* — i.e. the
 * predicted order has just landed. Drives the "Called it" badge that closes
 * the loop on Quinn's anticipation.
 */
function surgeLandedRecently(state: SimState, recipeId: RecipeId): boolean {
  for (const s of state.surges) {
    if (
      s.recipeId === recipeId &&
      state.nowMin < s.untilMin &&
      state.nowMin - s.startMin <= SURGE_LANDED_WINDOW_MIN
    ) {
      return true;
    }
  }
  return false;
}

/** Held units of a recipe that are still within their hold (sellable). */
function heldOf(state: SimState, recipeId: RecipeId): number {
  return state.holder
    .filter(b => b.recipeId === recipeId && b.expiresAtMin > state.nowMin)
    .reduce((a, b) => a + b.count, 0);
}

/** Units of a recipe currently on the broiler. */
function cookingOf(state: SimState, recipeId: RecipeId): number {
  return state.cooking
    .filter(b => b.recipeId === recipeId)
    .reduce((a, b) => a + b.qty, 0);
}

function roundToMultiple(n: number, multiple: number): number {
  if (multiple <= 1) return Math.max(0, Math.round(n));
  return Math.max(0, Math.ceil(n / multiple) * multiple);
}

/**
 * How long an expired batch lingers in the cabinet flagged "WASTE" before the
 * loop actually bins it. Gives the crew a visible window to pull it after the
 * hold time is up (rather than it silently vanishing between drops).
 */
const WASTE_GRACE_MIN = 20;

/**
 * Advance the simulation by `stepMin` demo-minutes (mutates a fresh copy).
 */
function advance(prev: SimState, stepMin: number): SimState {
  const state: SimState = {
    ...prev,
    holder: prev.holder.map(b => ({ ...b })),
    cooking: prev.cooking.map(b => ({ ...b })),
    sellCarry: { ...prev.sellCarry },
    soldByRecipe: { ...prev.soldByRecipe },
    lastDropWindow: { ...prev.lastDropWindow },
    surges: prev.surges.filter(s => prev.nowMin < s.untilMin),
    firedRecuts: new Set(prev.firedRecuts),
    recutLog: [...prev.recutLog],
  };
  state.nowMin = prev.nowMin + stepMin;
  const now = state.nowMin;

  // 1. Fire any scheduled re-cut events we've passed.
  for (let i = 0; i < RECUT_SCRIPT.length; i += 1) {
    const ev = RECUT_SCRIPT[i];
    const fireAt = BK_DEMO_START_MIN + ev.atOffset;
    if (now >= fireAt && !state.firedRecuts.has(i)) {
      state.firedRecuts.add(i);
      state.recut = { id: i, message: ev.message, tone: ev.tone, atMin: now };
      state.recutLog.push({ id: i, message: ev.message, tone: ev.tone, atMin: now });
      if (ev.surge) {
        state.surges.push({
          recipeId: ev.surge.recipeId,
          multiplier: ev.surge.multiplier,
          startMin: now,
          untilMin: now + ev.surge.forMinutes,
        });
      }
    }
  }

  // 2. Move finished cooks into the holding cabinet.
  const stillCooking: CookingBatch[] = [];
  for (const cook of state.cooking) {
    if (cook.readyAtMin <= now) {
      const cfg = RECIPE_CONFIG[cook.recipeId];
      state.holder.push({
        id: `b-${state.seq++}`,
        recipeId: cook.recipeId,
        count: cook.qty,
        cookedAtMin: cook.readyAtMin,
        expiresAtMin: cook.readyAtMin + (cfg?.shelfLifeMin ?? 20),
      });
    } else {
      stillCooking.push(cook);
    }
  }
  state.cooking = stillCooking;

  // 3. Sell from the cabinet against demand (oldest batch first).
  for (const cfg of Object.values(RECIPE_CONFIG)) {
    const winStart = windowStart(now);
    const perMin =
      (demandForWindow(cfg.recipeId, winStart) / BK_DROP_INTERVAL_MIN) *
      surgeMultiplier(state, cfg.recipeId);
    let toSell = perMin * stepMin + (state.sellCarry[cfg.recipeId] ?? 0);
    let sellWhole = Math.floor(toSell);
    state.sellCarry[cfg.recipeId] = toSell - sellWhole;
    if (sellWhole <= 0) continue;
    // Only sell fresh stock — anything past its hold is dead and awaiting waste.
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

  // 4. Anything past its hold lingers in the cabinet flagged WASTE for a grace
  //    window so the crew can pull it; once the grace is up it's binned and
  //    counted as waste. Empty batches drop out.
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

  // 5. Decide drops once per cadence window: cover NET need for the
  //    *next* window so a fresh batch is ready as demand lands.
  const winStart = windowStart(now);
  for (const cfg of Object.values(RECIPE_CONFIG)) {
    if (state.lastDropWindow[cfg.recipeId] === winStart) continue;
    if (now < BK_SERVICE_START_MIN || now > BK_SERVICE_END_MIN) continue;
    const upcoming =
      demandForWindow(cfg.recipeId, winStart + BK_DROP_INTERVAL_MIN) *
      surgeMultiplier(state, cfg.recipeId);
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
// Snapshot shape consumed by the crew display
// ─────────────────────────────────────────────────────────────────────────────

export type RecipeStatus = {
  recipeId: RecipeId;
  name: string;
  held: number;
  cooking: number;
  /** Net need for the current window (forecast − held − cooking). */
  nowNeed: number;
  /** Forecast for the next window. */
  nextNeed: number;
  shelfLifeMin: number;
  /** Minutes until the oldest held batch is binned (null = nothing held). */
  oldestExpiresInMin: number | null;
};

export type HeldDisplay = {
  id: string;
  recipeId: RecipeId;
  name: string;
  count: number;
  expiresInMin: number;
  shelfLifeMin: number;
  /** Hold window is up — pull and bin it. */
  expired: boolean;
};

export type StationSnapshot = {
  station: BkStation;
  recipes: RecipeStatus[];
  now: { recipeId: RecipeId; name: string; count: number } | null;
  next: { recipeId: RecipeId; name: string; count: number } | null;
  held: HeldDisplay[];
};

/**
 * A single item on the drop clock — one component to cook, sized for the
 * 15-min drop. `readyInMin` is set when it's already on the broiler (so the
 * crew sees the cook timer); `null` means it's planned / not started yet.
 */
export type DropItem = {
  id: string;
  recipeId: RecipeId;
  name: string;
  count: number;
  stationId: string;
  stationName: string;
  stationAccent: string;
  cookMinutes: number;
  readyInMin: number | null;
  /** Demand is surging right now (Quinn cooking ahead) — highlight it. */
  surged: boolean;
  /** A predicted surge just landed for this recipe — badge it "Called it". */
  surgeLanded: boolean;
  /** Started by the crew from the stepper (vs auto-dropped by the loop). */
  crew?: boolean;
  /** Live wall-clock seconds left for a crew-started cook (mm:ss on the card). */
  liveSeconds?: number | null;
};

/** An upcoming Quinn call on the "on the radar" ribbon. */
export type RadarItem = {
  id: number;
  label: string;
  /** The learned pattern Quinn is predicting from (e.g. "last 4 Fridays"). */
  basis: string;
  tone: RecutTone;
  /** Demo minutes until it fires. */
  minsUntil: number;
};

export type CrewLoopSnapshot = {
  nowMin: number;
  nowHHMM: string;
  playing: boolean;
  recut: { id: number; message: string; tone: RecutTone; atMin: number } | null;
  /** Fired Quinn calls, newest first — drives the persistent Quinn strip. */
  recutLog: RecutLogEntry[];
  /** Quinn calls coming up within the lookahead window, soonest first. */
  radar: RadarItem[];
  stations: StationSnapshot[];
  wasteTotal: number;
  soldTotal: number;
  /** Units sold today per recipe — for per-line totals. */
  soldByRecipe: Record<RecipeId, number>;
  // ── Drop-clock view ──────────────────────────────────────────────────────
  /** Minutes until the next 15-min drop boundary. */
  minsToNextDrop: number;
  /** Length of a drop window (minutes) — for rendering the countdown ring. */
  dropIntervalMin: number;
  /** Clock time of the next drop, e.g. "13:00". */
  nextDropHHMM: string;
  /** Current window label, e.g. "12:45 → 13:00". */
  currentWindowLabel: string;
  /** Net shortfall right now that isn't yet cooking — the urgent "drop now". */
  dropNow: DropItem[];
  /** Batches on the line right now, with their cook timers. */
  cooking: DropItem[];
  /** Planned counts for the upcoming drop so the crew can pace. */
  nextDrop: DropItem[];
  /** Everything in the holding cabinet, freshest-expiring first. */
  cabinet: HeldDisplay[];
};

/** Recipe → its station, for colouring/grouping the flat drop lists. */
const STATION_FOR_RECIPE: Record<RecipeId, BkStation> = (() => {
  const out: Record<RecipeId, BkStation> = {};
  for (const st of BK_STATIONS) {
    for (const rid of st.recipeIds) out[rid] = st;
  }
  return out;
})();

function buildSnapshot(state: SimState, playing: boolean): CrewLoopSnapshot {
  const winStart = windowStart(state.nowMin);

  const stations: StationSnapshot[] = BK_STATIONS.map(station => {
    const recipes: RecipeStatus[] = station.recipeIds
      .map(recipeId => {
        const cfg = RECIPE_CONFIG[recipeId];
        if (!cfg) return null;
        const held = heldOf(state, recipeId);
        const cooking = cookingOf(state, recipeId);
        const surge = surgeMultiplier(state, recipeId);
        const nowDemand = demandForWindow(recipeId, winStart) * surge;
        const nextDemand =
          demandForWindow(recipeId, winStart + BK_DROP_INTERVAL_MIN) * surge;
        const nowNeed = Math.max(0, Math.round(nowDemand - held - cooking));
        const batches = state.holder
          .filter(b => b.recipeId === recipeId)
          .sort((a, b) => a.expiresAtMin - b.expiresAtMin);
        const oldestExpiresInMin =
          batches.length > 0 ? Math.max(0, batches[0].expiresAtMin - state.nowMin) : null;
        return {
          recipeId,
          name: cfg.name,
          held,
          cooking,
          nowNeed,
          nextNeed: Math.round(nextDemand),
          shelfLifeMin: cfg.shelfLifeMin,
          oldestExpiresInMin,
        } as RecipeStatus;
      })
      .filter((r): r is RecipeStatus => r !== null);

    // NOW = the single most urgent component to cook at this station.
    const nowCandidate = [...recipes]
      .filter(r => r.nowNeed > 0)
      .sort((a, b) => b.nowNeed - a.nowNeed)[0];
    const now = nowCandidate
      ? { recipeId: nowCandidate.recipeId, name: nowCandidate.name, count: nowCandidate.nowNeed }
      : null;

    // NEXT = the biggest demand in the upcoming window (so they can pace).
    const nextCandidate = [...recipes]
      .filter(r => r.recipeId !== nowCandidate?.recipeId && r.nextNeed > 0)
      .sort((a, b) => b.nextNeed - a.nextNeed)[0];
    const next = nextCandidate
      ? { recipeId: nextCandidate.recipeId, name: nextCandidate.name, count: nextCandidate.nextNeed }
      : null;

    const held: HeldDisplay[] = state.holder
      .filter(b => station.recipeIds.includes(b.recipeId))
      .sort((a, b) => a.expiresAtMin - b.expiresAtMin)
      .map(b => ({
        id: b.id,
        recipeId: b.recipeId,
        name: RECIPE_CONFIG[b.recipeId]?.name ?? b.recipeId,
        count: b.count,
        expiresInMin: Math.max(0, b.expiresAtMin - state.nowMin),
        shelfLifeMin: RECIPE_CONFIG[b.recipeId]?.shelfLifeMin ?? 20,
        expired: b.expiresAtMin <= state.nowMin,
      }));

    return { station, recipes, now, next, held };
  });

  // ── Drop-clock fields ──────────────────────────────────────────────────
  const nextWin = winStart + BK_DROP_INTERVAL_MIN;
  const minsToNextDrop = Math.max(0, nextWin - state.nowMin);

  const stationOf = (recipeId: RecipeId) => STATION_FOR_RECIPE[recipeId];
  const mkItem = (
    recipeId: RecipeId,
    count: number,
    readyInMin: number | null,
    idSuffix: string,
  ): DropItem | null => {
    const cfg = RECIPE_CONFIG[recipeId];
    const st = stationOf(recipeId);
    if (!cfg || !st) return null;
    return {
      id: `${recipeId}-${idSuffix}`,
      recipeId,
      name: cfg.name,
      count,
      stationId: st.id,
      stationName: st.name,
      stationAccent: st.accent,
      cookMinutes: cfg.cookMinutes,
      readyInMin,
      surged: surgeMultiplier(state, recipeId) > 1.01,
      surgeLanded: surgeLandedRecently(state, recipeId),
    };
  };

  // Cooking right now — what's on the line, sorted by who's ready first.
  const cooking: DropItem[] = state.cooking
    .slice()
    .sort((a, b) => a.readyAtMin - b.readyAtMin)
    .map(c => mkItem(c.recipeId, c.qty, Math.max(0, c.readyAtMin - state.nowMin), c.id))
    .filter((x): x is DropItem => x !== null);

  // Urgent shortfall — demand this window not covered by held + cooking.
  const dropNow: DropItem[] = [];
  for (const cfg of Object.values(RECIPE_CONFIG)) {
    const surge = surgeMultiplier(state, cfg.recipeId);
    const nowDemand = demandForWindow(cfg.recipeId, winStart) * surge;
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
      if (item) dropNow.push(item);
    }
  }
  dropNow.sort((a, b) => b.count - a.count);

  // Next drop — expected demand for the upcoming window, as a pacing forecast
  // (not net need: the upcoming batch is usually already broiling, so showing
  // raw forecast tells the crew what's coming without reading as extra work).
  const nextDrop: DropItem[] = [];
  for (const cfg of Object.values(RECIPE_CONFIG)) {
    const surge = surgeMultiplier(state, cfg.recipeId);
    const upcoming = Math.round(demandForWindow(cfg.recipeId, nextWin) * surge);
    if (upcoming > 0) {
      const item = mkItem(cfg.recipeId, upcoming, null, 'next');
      if (item) nextDrop.push(item);
    }
  }
  nextDrop.sort((a, b) => b.count - a.count);

  // Cabinet — flat, freshest-expiring first, tagged with station accent.
  const cabinet: HeldDisplay[] = state.holder
    .slice()
    .sort((a, b) => a.expiresAtMin - b.expiresAtMin)
    .map(b => ({
      id: b.id,
      recipeId: b.recipeId,
      name: RECIPE_CONFIG[b.recipeId]?.name ?? b.recipeId,
      count: b.count,
      expiresInMin: Math.max(0, b.expiresAtMin - state.nowMin),
      shelfLifeMin: RECIPE_CONFIG[b.recipeId]?.shelfLifeMin ?? 20,
      expired: b.expiresAtMin <= state.nowMin,
    }));

  // ── Quinn presence: fired log (newest first) + upcoming radar ───────────
  const recutLog: RecutLogEntry[] = [...state.recutLog].reverse();
  const radar: RadarItem[] = [];
  for (let i = 0; i < RECUT_SCRIPT.length; i += 1) {
    if (state.firedRecuts.has(i)) continue;
    const ev = RECUT_SCRIPT[i];
    const minsUntil = BK_DEMO_START_MIN + ev.atOffset - state.nowMin;
    if (minsUntil > 0 && minsUntil <= RADAR_LOOKAHEAD_MIN) {
      radar.push({ id: i, label: ev.radarLabel, basis: ev.basis, tone: ev.tone, minsUntil });
    }
  }
  radar.sort((a, b) => a.minsUntil - b.minsUntil);

  return {
    nowMin: state.nowMin,
    nowHHMM: minutesToHHMM(Math.min(state.nowMin, 24 * 60 - 1)),
    playing,
    recut: state.recut,
    recutLog,
    radar,
    stations,
    wasteTotal: state.wasteTotal,
    soldTotal: state.soldTotal,
    soldByRecipe: state.soldByRecipe,
    minsToNextDrop,
    dropIntervalMin: BK_DROP_INTERVAL_MIN,
    nextDropHHMM: minutesToHHMM(Math.min(nextWin, 24 * 60 - 1)),
    currentWindowLabel: `${minutesToHHMM(winStart)} → ${minutesToHHMM(Math.min(nextWin, 24 * 60 - 1))}`,
    dropNow,
    cooking,
    nextDrop,
    cabinet,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

// The demo is driven by hand: the presenter steps the clock forward a drop
// (or a few minutes) at a time so the room can see what changed between drops,
// rather than a clock racing past. An optional auto-play is deliberately slow.
/** Real milliseconds per demo-minute when auto-play is on (slow on purpose). */
const TICK_MS = 2500;

export type CrewLoop = CrewLoopSnapshot & {
  togglePlay: () => void;
  reset: () => void;
  /** Advance the simulation by `min` demo-minutes (one minute at a time). */
  step: (min: number) => void;
  /** Jump straight to the next 15-min drop boundary. */
  stepToNextDrop: () => void;
  /** True once the service window is over — nothing left to step. */
  atEnd: boolean;
};

export function useCrewLoop(): CrewLoop {
  const stateRef = useRef<SimState>(initialState());
  // Default paused: the demo is stepped by hand.
  const [playing, setPlaying] = useState(false);
  const [, force] = useState(0);

  const advanceBy = (min: number) => {
    let s = stateRef.current;
    for (let i = 0; i < min; i += 1) {
      if (s.nowMin >= BK_SERVICE_END_MIN) break;
      s = advance(s, 1);
    }
    stateRef.current = s;
    force(n => n + 1);
  };

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      // Stop advancing once we run off the end of service.
      if (stateRef.current.nowMin >= BK_SERVICE_END_MIN) {
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
    // Re-derive on every forced tick + play/pause change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateRef.current.nowMin, stateRef.current.recut, playing],
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
    stepToNextDrop: () => {
      const now = stateRef.current.nowMin;
      const next = windowStart(now) + BK_DROP_INTERVAL_MIN;
      const jump = next - now;
      advanceBy(jump > 0 ? jump : BK_DROP_INTERVAL_MIN);
    },
    atEnd: stateRef.current.nowMin >= BK_SERVICE_END_MIN,
  };
}
