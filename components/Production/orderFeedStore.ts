'use client';

/**
 * orderFeedStore — the live "what's selling" loop for the Burger King line.
 *
 * Where `crewLoopStore` is the *make* side (drop → hold → bin), this is the
 * *sell* side: discrete orders arrive over the service, split into the two
 * channels an operator actually separates on the floor —
 *
 *   • Deliveries  — Uber Eats / Deliveroo / Just Eat / BK App
 *   • In-store    — Kiosk / Front counter / Drive-thru
 *
 * Every order is fulfilled from the Pan Holding Unit (the holding cabinet of
 * cooked components), oldest batch first (FIFO), and we record how fresh the
 * burger served was — minutes since it came off the grill, as a fraction of
 * its hold life. That's the whole point of the screen: prove the burgers
 * going out the door are fresh, on both channels, while the AI keeps the
 * cabinet topped up so nothing is served tired and nothing is binned.
 *
 * Self-contained + deterministic (seeded per demo-minute) so reloads and
 * hand-stepping are stable. Reuses only the BK *fixtures*.
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
  BK_RECIPES,
} from './bkFixtures';
import { getRecipe, getWorkflow } from './fixtures';
import type { RecipeId } from './fixtures';
import { minutesToHHMM } from './time';

// ─────────────────────────────────────────────────────────────────────────────
// Shared demand curve (same twin-peak shape the make-side uses)
// ─────────────────────────────────────────────────────────────────────────────

function intensityAt(min: number): number {
  const lunch = Math.exp(-(((min - 750) / 70) ** 2));
  const dinner = Math.exp(-(((min - 1110) / 80) ** 2));
  return 0.25 + lunch + 0.75 * dinner;
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

function demandForWindow(recipeId: RecipeId, startMin: number): number {
  const dayTotal = DAY_TOTAL[recipeId] ?? 0;
  if (dayTotal === 0) return 0;
  let share = 0;
  const end = Math.min(startMin + BK_DROP_INTERVAL_MIN, BK_SERVICE_END_MIN);
  for (let m = Math.max(startMin, BK_SERVICE_START_MIN); m < end; m += 1) share += intensityAt(m);
  return (dayTotal * share) / TOTAL_INTENSITY;
}

function windowStart(min: number): number {
  const offset = min - BK_SERVICE_START_MIN;
  return BK_SERVICE_START_MIN + Math.floor(offset / BK_DROP_INTERVAL_MIN) * BK_DROP_INTERVAL_MIN;
}

/** Total cooked components demanded per minute across the menu, right now. */
function itemsPerMinAt(min: number): number {
  let s = 0;
  for (const recipeId of Object.keys(DAY_TOTAL) as RecipeId[]) {
    s += demandForWindow(recipeId, windowStart(min)) / BK_DROP_INTERVAL_MIN;
  }
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component config (Pan Holding Unit) + menu
// ─────────────────────────────────────────────────────────────────────────────

type CompConfig = { recipeId: RecipeId; name: string; cookMinutes: number; shelfLifeMin: number };

const COMP_CONFIG: Record<RecipeId, CompConfig> = (() => {
  const out: Record<RecipeId, CompConfig> = {};
  for (const item of BK_PRODUCTION_ITEMS) {
    const recipe = getRecipe(item.recipeId);
    if (!recipe) continue;
    const wf = getWorkflow(recipe.workflowId);
    const cookMinutes = wf ? Math.max(1, wf.stages.reduce((a, s) => a + s.durationMinutes, 0)) : 4;
    out[item.recipeId] = {
      recipeId: item.recipeId,
      name: recipe.name,
      cookMinutes,
      shelfLifeMin: recipe.shelfLifeMinutes ?? 20,
    };
  }
  return out;
})();

const COMPONENTS = Object.values(COMP_CONFIG);

/** Per-component "value" used to synthesise a menu price. */
const COMP_VALUE: Record<string, number> = {
  'bk-whopper-patty': 2.6,
  'bk-junior-patty': 1.6,
  'bk-chicken-fillet': 2.4,
  'bk-bacon': 0.8,
  'bk-angus-patty': 3.6,
  'bk-plant-patty': 2.8,
};

/** Relative how-often-ordered weight for the headline menu items. */
const MENU_WEIGHT: Record<string, number> = {
  'bk-whopper': 10,
  'bk-cheeseburger': 9,
  'bk-whopper-jr': 8,
  'bk-chicken-royale': 7,
  'bk-double-whopper': 5,
  'bk-double-cheeseburger': 5,
  'bk-hamburger': 5,
  'bk-bacon-double-cheese': 4,
  'bk-whopper-cheese': 4,
  'bk-bacon-king': 3,
  'bk-steakhouse-angus': 3,
  'bk-plant-whopper': 3,
  'bk-double-chicken-royale': 2,
  'bk-triple-whopper': 1,
  'bk-bacon-king-jr': 2,
  'bk-big-king-xl': 2,
  'bk-chicken-royale-bc': 2,
  'bk-vegan-royale': 2,
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
  weight: number;
  /** Cooked components this build pulls from the Pan Holding Unit. */
  components: Array<{ recipeId: RecipeId; qty: number }>;
};

const MENU: MenuItem[] = (() => {
  const items: MenuItem[] = [];
  for (const r of BK_RECIPES) {
    const subs = r.subRecipes ?? [];
    if (subs.length === 0) continue; // assembled menu items only
    const components = subs.map(s => ({ recipeId: s.recipeId, qty: s.quantityPerUnit }));
    const raw = 2.2 + components.reduce((a, c) => a + (COMP_VALUE[c.recipeId] ?? 1.5) * c.qty, 0);
    const price = Math.round(raw) - 0.01; // £x.99-ish
    items.push({ id: r.id, name: r.name, price, weight: MENU_WEIGHT[r.id] ?? 2, components });
  }
  return items;
})();

const MENU_WEIGHT_TOTAL = MENU.reduce((a, m) => a + m.weight, 0);

// ─────────────────────────────────────────────────────────────────────────────
// Channels
// ─────────────────────────────────────────────────────────────────────────────

export type ChannelGroup = 'delivery' | 'in-store';

export const DELIVERY_SOURCES = ['Uber Eats', 'Deliveroo', 'Just Eat', 'BK App'] as const;
export const IN_STORE_SOURCES = ['Kiosk', 'Front counter', 'Drive-thru'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Freshness
// ─────────────────────────────────────────────────────────────────────────────

export type FreshnessTier = 'fresh' | 'good' | 'last-call' | 'made-to-order';

function tierForFrac(frac: number, madeToOrder: boolean): FreshnessTier {
  if (madeToOrder) return 'made-to-order';
  if (frac < 0.4) return 'fresh';
  if (frac < 0.75) return 'good';
  return 'last-call';
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic RNG (mulberry32) seeded per demo-minute
// ─────────────────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
}

function pickMenu(r: () => number): MenuItem {
  let x = r() * MENU_WEIGHT_TOTAL;
  for (const m of MENU) {
    x -= m.weight;
    if (x <= 0) return m;
  }
  return MENU[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

type HeldBatch = { id: string; recipeId: RecipeId; count: number; cookedAtMin: number; expiresAtMin: number };

export type OrderLine = { name: string; qty: number };

export type Order = {
  id: string;
  atMin: number;
  channel: ChannelGroup;
  source: string;
  lines: OrderLine[];
  itemsCount: number;
  total: number;
  /** Worst (oldest) freshness fraction among the burgers served. */
  freshnessFrac: number;
  /** Minutes since the least-fresh served burger came off the grill. */
  ageMin: number;
  tier: FreshnessTier;
};

type ChannelTally = {
  orders: number;
  items: number;
  revenue: number;
  burgers: number;
  ageSumMin: number;
  servedFresh: number; // fresh + good
};

function emptyTally(): ChannelTally {
  return { orders: 0, items: 0, revenue: 0, burgers: 0, ageSumMin: 0, servedFresh: 0 };
}

type SimState = {
  nowMin: number;
  holder: HeldBatch[];
  lastDropWindow: Record<RecipeId, number>;
  orders: Order[]; // newest first, capped
  orderCarry: number;
  tally: Record<ChannelGroup, ChannelTally>;
  madeToOrder: number;
  seq: number;
};

const ORDER_LOG_CAP = 40;

function seedHolder(startMin: number): HeldBatch[] {
  return BK_HOLDER_SEED.map((seed, i) => {
    const cfg = COMP_CONFIG[seed.recipeId];
    const shelf = cfg?.shelfLifeMin ?? 20;
    const cookedAtMin = startMin - seed.cookedMinAgo;
    return {
      id: `${i}-seed`,
      recipeId: seed.recipeId,
      count: seed.count,
      cookedAtMin,
      expiresAtMin: cookedAtMin + shelf,
    };
  });
}

function freshInitialState(): SimState {
  const lastDropWindow: Record<RecipeId, number> = {};
  for (const c of COMPONENTS) lastDropWindow[c.recipeId] = -1;
  return {
    nowMin: BK_DEMO_START_MIN,
    holder: seedHolder(BK_DEMO_START_MIN),
    lastDropWindow,
    orders: [],
    orderCarry: 0,
    tally: { delivery: emptyTally(), 'in-store': emptyTally() },
    madeToOrder: 0,
    seq: 0,
  };
}

function heldOf(state: SimState, recipeId: RecipeId): number {
  return state.holder
    .filter(b => b.recipeId === recipeId && b.expiresAtMin > state.nowMin)
    .reduce((a, b) => a + b.count, 0);
}

/**
 * Take `qty` of a component from the cabinet, oldest fresh batch first.
 * Returns the age (minutes since grilled) of the oldest unit served, or null
 * if there wasn't enough stock (→ cooked to order, served fresh).
 */
function consumeOldest(state: SimState, recipeId: RecipeId, qty: number): number | null {
  const batches = state.holder
    .filter(b => b.recipeId === recipeId && b.count > 0 && b.expiresAtMin > state.nowMin)
    .sort((a, b) => a.cookedAtMin - b.cookedAtMin);
  let need = qty;
  let oldestAge: number | null = null;
  for (const b of batches) {
    if (need <= 0) break;
    const take = Math.min(b.count, need);
    if (take > 0 && oldestAge === null) oldestAge = state.nowMin - b.cookedAtMin;
    b.count -= take;
    need -= take;
  }
  if (need > 0) return null; // shortfall → made to order
  return oldestAge;
}

function advance(prev: SimState, stepMin: number): SimState {
  const state: SimState = {
    ...prev,
    holder: prev.holder.map(b => ({ ...b })),
    lastDropWindow: { ...prev.lastDropWindow },
    orders: prev.orders.slice(),
    tally: {
      delivery: { ...prev.tally.delivery },
      'in-store': { ...prev.tally['in-store'] },
    },
  };

  for (let m = prev.nowMin + 1; m <= prev.nowMin + stepMin; m += 1) {
    state.nowMin = m;

    // 1. Replenish the Pan Holding Unit on the drop cadence (AI keeps it
    //    topped to cover the next window, so stock stays available + fresh).
    const winStart = windowStart(m);
    if (m >= BK_SERVICE_START_MIN && m <= BK_SERVICE_END_MIN) {
      for (const c of COMPONENTS) {
        if (state.lastDropWindow[c.recipeId] === winStart) continue;
        const upcoming = demandForWindow(c.recipeId, winStart + BK_DROP_INTERVAL_MIN);
        const net = Math.ceil(upcoming - heldOf(state, c.recipeId));
        if (net > 0) {
          state.holder.push({
            id: `${state.seq++}-b`,
            recipeId: c.recipeId,
            count: net,
            cookedAtMin: m,
            expiresAtMin: m + c.shelfLifeMin,
          });
        }
        state.lastDropWindow[c.recipeId] = winStart;
      }
    }

    // 2. Bin anything past its hold (keeps freshness honest).
    state.holder = state.holder.filter(b => b.count > 0 && b.expiresAtMin > m);

    // 3. Generate this minute's orders deterministically.
    const expected = itemsPerMinAt(m) / 1.6; // items → orders (avg basket 1.6)
    state.orderCarry += expected;
    let n = Math.floor(state.orderCarry);
    state.orderCarry -= n;

    const r = mulberry32((m * 2654435761) >>> 0);
    while (n > 0) {
      n -= 1;
      const peakBias = Math.min(0.08, Math.max(0, (intensityAt(m) - 0.6) * 0.06));
      const isDelivery = r() < 0.38 + peakBias;
      const channel: ChannelGroup = isDelivery ? 'delivery' : 'in-store';
      const source = isDelivery ? pick(r, DELIVERY_SOURCES) : pick(r, IN_STORE_SOURCES);

      const basketRoll = r();
      const lineCount = basketRoll < 0.6 ? 1 : basketRoll < 0.9 ? 2 : 3;

      const lines: OrderLine[] = [];
      let total = 0;
      let itemsCount = 0;
      let worstFrac = -1;
      let worstAge = 0;
      let madeToOrder = false;

      for (let li = 0; li < lineCount; li += 1) {
        const menu = pickMenu(r);
        const qty = r() < 0.85 ? 1 : 2;
        lines.push({ name: menu.name, qty });
        total += menu.price * qty;
        itemsCount += qty;
        // Pull each component the build needs, per unit ordered.
        for (const comp of menu.components) {
          const age = consumeOldest(state, comp.recipeId, comp.qty * qty);
          const shelf = COMP_CONFIG[comp.recipeId]?.shelfLifeMin ?? 20;
          if (age === null) {
            madeToOrder = true;
          } else {
            const frac = age / shelf;
            if (frac > worstFrac) {
              worstFrac = frac;
              worstAge = age;
            }
          }
        }
      }

      if (worstFrac < 0) worstFrac = 0; // entirely made-to-order
      const tier = tierForFrac(worstFrac, madeToOrder && worstFrac < 0.4);

      const order: Order = {
        id: `o-${state.seq++}`,
        atMin: m,
        channel,
        source,
        lines,
        itemsCount,
        total: Math.round(total * 100) / 100,
        freshnessFrac: worstFrac,
        ageMin: Math.round(worstAge),
        tier,
      };
      state.orders.unshift(order);

      const t = state.tally[channel];
      t.orders += 1;
      t.items += itemsCount;
      t.revenue += order.total;
      t.burgers += itemsCount;
      t.ageSumMin += worstAge * itemsCount;
      if (tier === 'fresh' || tier === 'good' || tier === 'made-to-order') t.servedFresh += itemsCount;
      if (madeToOrder) state.madeToOrder += 1;
    }

    if (state.orders.length > ORDER_LOG_CAP) state.orders.length = ORDER_LOG_CAP;
  }

  return state;
}

/** Pre-roll a few minutes so the feed isn't empty when the screen opens. */
function initialState(): SimState {
  return advance(freshInitialState(), 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot
// ─────────────────────────────────────────────────────────────────────────────

export type ChannelSummary = {
  group: ChannelGroup;
  orders: number;
  items: number;
  revenue: number;
  /** Avg minutes since grilled across burgers served on this channel. */
  avgAgeMin: number;
  /** Share of burgers served fresh (fresh/good/made-to-order). */
  freshPct: number;
};

export type CabinetStatus = { recipeId: RecipeId; name: string; held: number; oldestAgeMin: number | null; shelfLifeMin: number };

export type OrderFeedSnapshot = {
  nowMin: number;
  nowHHMM: string;
  playing: boolean;
  atEnd: boolean;
  orders: Order[];
  delivery: ChannelSummary;
  inStore: ChannelSummary;
  /** Whole-service freshness: share of all burgers served fresh. */
  freshPctOverall: number;
  avgAgeOverall: number;
  burgersServed: number;
  /** Pan Holding Unit right now. */
  cabinet: CabinetStatus[];
  cabinetUnits: number;
};

function summarise(group: ChannelGroup, t: ChannelTally): ChannelSummary {
  return {
    group,
    orders: t.orders,
    items: t.items,
    revenue: t.revenue,
    avgAgeMin: t.burgers > 0 ? t.ageSumMin / t.burgers : 0,
    freshPct: t.burgers > 0 ? (t.servedFresh / t.burgers) * 100 : 100,
  };
}

function buildSnapshot(state: SimState, playing: boolean): OrderFeedSnapshot {
  const d = state.tally.delivery;
  const i = state.tally['in-store'];
  const burgers = d.burgers + i.burgers;
  const servedFresh = d.servedFresh + i.servedFresh;
  const ageSum = d.ageSumMin + i.ageSumMin;

  const cabinet: CabinetStatus[] = COMPONENTS.map(c => {
    const fresh = state.holder.filter(b => b.recipeId === c.recipeId && b.expiresAtMin > state.nowMin);
    const held = fresh.reduce((a, b) => a + b.count, 0);
    const oldest = fresh.length > 0 ? Math.max(...fresh.map(b => state.nowMin - b.cookedAtMin)) : null;
    return { recipeId: c.recipeId, name: c.name, held, oldestAgeMin: oldest, shelfLifeMin: c.shelfLifeMin };
  });

  return {
    nowMin: state.nowMin,
    nowHHMM: minutesToHHMM(Math.min(state.nowMin, 24 * 60 - 1)),
    playing,
    atEnd: state.nowMin >= BK_SERVICE_END_MIN,
    orders: state.orders,
    delivery: summarise('delivery', d),
    inStore: summarise('in-store', i),
    freshPctOverall: burgers > 0 ? (servedFresh / burgers) * 100 : 100,
    avgAgeOverall: burgers > 0 ? ageSum / burgers : 0,
    burgersServed: burgers,
    cabinet,
    cabinetUnits: cabinet.reduce((a, c) => a + c.held, 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

const TICK_MS = 1600;

export type OrderFeed = OrderFeedSnapshot & {
  togglePlay: () => void;
  reset: () => void;
  step: (min: number) => void;
};

export function useOrderFeed(): OrderFeed {
  const stateRef = useRef<SimState>(initialState());
  const [playing, setPlaying] = useState(false);
  const [, force] = useState(0);

  const advanceBy = (min: number) => {
    const target = Math.min(BK_SERVICE_END_MIN, stateRef.current.nowMin + min);
    const delta = target - stateRef.current.nowMin;
    if (delta > 0) stateRef.current = advance(stateRef.current, delta);
    force(n => n + 1);
  };

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateRef.current.nowMin, stateRef.current.orders, playing],
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
  };
}

export function gbp(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
}
