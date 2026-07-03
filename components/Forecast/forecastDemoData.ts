'use client';

/**
 * forecastDemoData — the swappable dataset behind the headline AI-forecast
 * demo (`AiForecastImpact` / `forecastImpactStore`).
 *
 * The simulation engine is brand-agnostic: it only needs a list of held items
 * (day total, batch rules, cook/hold times, £ economics), a demand curve, a
 * cabinet seed and an intra-day re-cut script. This module supplies that bundle
 * per customer:
 *
 *   • edify / default  — rebuilt from the Burger King production fixtures, so
 *                        the internal demo is byte-for-byte what it always was.
 *   • chagee           — a hand-authored afternoon tea service (brewed bases
 *                        and fresh-milk prep held at the bar).
 *
 * The Chagee numbers (names, prices, volumes, hold times) are a credible first
 * draft — confirm them against Chagee's real menu before anything customer-final.
 */

import {
  BK_DEMO_START_MIN,
  BK_DROP_INTERVAL_MIN,
  BK_FORECAST,
  BK_HOLDER_SEED,
  BK_PRODUCTION_ITEMS,
  BK_SERVICE_END_MIN,
  BK_SERVICE_START_MIN,
} from '@/components/Production/bkFixtures';
import { getRecipe, getWorkflow } from '@/components/Production/fixtures';
import { demoCustomer } from '@/lib/demoConfig';

export type RecutTone = 'info' | 'cook-ahead' | 'ease-off';

/** One held item: the thing that is dropped/brewed, held, and sold. */
export type ForecastDemoItem = {
  id: string;
  name: string;
  /** Projected units for the whole demo day. */
  dayTotal: number;
  /** Batch granularity — drops are rounded up to a multiple of this. */
  multipleOf: number;
  /** Minutes from drop to ready-to-sell (cook / brew / prep). */
  cookMinutes: number;
  /** Minutes a batch can be held before it must be binned. */
  shelfLifeMin: number;
  /** Average sell price (£) — drives missed-sales value. */
  price: number;
  /** Unit cost (£) — drives waste value. */
  cost: number;
};

export type ForecastRecut = {
  /** Demo-minutes after `demoStartMin` at which the signal fires. */
  atOffset: number;
  message: string;
  tone: RecutTone;
  /** Optional real-demand surge the AI anticipates and the baseline ignores. */
  surge?: { itemId: string; multiplier: number; forMinutes: number };
};

/** A Gaussian demand peak (centre + width in minutes-from-midnight). */
export type DemandPeak = { centre: number; width: number; weight: number };

export type ForecastDemoData = {
  serviceStartMin: number;
  serviceEndMin: number;
  demoStartMin: number;
  dropIntervalMin: number;
  baseIntensity: number;
  peaks: DemandPeak[];
  items: ForecastDemoItem[];
  holderSeed: { itemId: string; count: number; cookedMinAgo: number }[];
  recuts: ForecastRecut[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Default (Burger King) — rebuilt from the production fixtures so the internal
// demo behaves exactly as before this became data-driven.
// ─────────────────────────────────────────────────────────────────────────────

const BK_ECON: Record<string, { price: number; cost: number }> = {
  'bk-whopper-patty': { price: 5.49, cost: 1.4 },
  'bk-junior-patty': { price: 3.49, cost: 0.8 },
  'bk-chicken-fillet': { price: 4.99, cost: 1.3 },
  'bk-bacon': { price: 1.5, cost: 0.45 },
  'bk-angus-patty': { price: 6.49, cost: 1.8 },
  'bk-plant-patty': { price: 5.49, cost: 1.6 },
  'bk-grilled-chicken': { price: 4.99, cost: 1.3 },
  'bk-fish': { price: 4.49, cost: 1.2 },
  'bk-fries': { price: 1.99, cost: 0.35 },
  'bk-nuggets': { price: 3.49, cost: 0.9 },
  'bk-onion-rings': { price: 2.49, cost: 0.6 },
};

const BK_RECUTS: ForecastRecut[] = [
  { atOffset: 4, message: 'Lunch building like the last 4 Fridays — cooking ahead on Whoppers', tone: 'cook-ahead', surge: { itemId: 'bk-whopper-patty', multiplier: 1.6, forMinutes: 22 } },
  { atOffset: 16, message: 'App orders usually jump now (last Friday, same slot) — dropping 2 trays of Juniors', tone: 'cook-ahead', surge: { itemId: 'bk-junior-patty', multiplier: 2.2, forMinutes: 14 } },
  { atOffset: 30, message: 'Chicken Royale picks up around now most days (last 2 weeks) — getting fillets ahead', tone: 'cook-ahead', surge: { itemId: 'bk-chicken-fillet', multiplier: 2.5, forMinutes: 18 } },
  { atOffset: 46, message: 'Rush easing — same as last week\u2019s tail. Holding back so nothing gets binned', tone: 'ease-off' },
  { atOffset: 64, message: 'Steady trade — cooking to the cabinet, no waste', tone: 'info' },
];

function buildBkData(): ForecastDemoData {
  const items: ForecastDemoItem[] = [];
  for (const item of BK_PRODUCTION_ITEMS) {
    const recipe = getRecipe(item.recipeId);
    if (!recipe) continue;
    const wf = getWorkflow(recipe.workflowId);
    const cookMinutes = wf
      ? Math.max(1, wf.stages.reduce((a, s) => a + s.durationMinutes, 0))
      : 4;
    const f = BK_FORECAST.find(x => x.skuId === item.skuId);
    const econ = BK_ECON[item.recipeId] ?? { price: 4.5, cost: 1.2 };
    items.push({
      id: item.recipeId,
      name: recipe.name,
      dayTotal: f?.projectedUnits ?? 0,
      multipleOf: recipe.batchRules?.multipleOf ?? 2,
      cookMinutes,
      shelfLifeMin: recipe.shelfLifeMinutes ?? 20,
      price: econ.price,
      cost: econ.cost,
    });
  }
  return {
    serviceStartMin: BK_SERVICE_START_MIN,
    serviceEndMin: BK_SERVICE_END_MIN,
    demoStartMin: BK_DEMO_START_MIN,
    dropIntervalMin: BK_DROP_INTERVAL_MIN,
    baseIntensity: 0.25,
    peaks: [
      { centre: 750, width: 70, weight: 1 }, // ~12:30 lunch
      { centre: 1110, width: 80, weight: 0.75 }, // ~18:30 dinner
    ],
    items,
    holderSeed: BK_HOLDER_SEED.map(s => ({
      itemId: s.recipeId,
      count: s.count,
      cookedMinAgo: s.cookedMinAgo,
    })),
    recuts: BK_RECUTS,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAGEE — an afternoon tea service. The "held batch" is a freshly brewed tea
// base / fresh-milk prep held at the bar: over-brew and it's tipped (waste),
// under-brew and the queue can't be served at peak (missed sales).
//
// DRAFT DATA — names/prices/volumes/hold-times to confirm against the real menu.
// ─────────────────────────────────────────────────────────────────────────────

function buildChageeData(): ForecastDemoData {
  // The held unit is a cup's-worth of freshly prepared tea base. `multipleOf`
  // is the small top-up increment a barista draws/brews at a time (not a giant
  // urn), so the naive flat-par plan tracks demand roughly and the AI's win
  // comes from peak shortfalls + tail waste rather than gross over-brewing.
  const items: ForecastDemoItem[] = [
    { id: 'cg-boya', name: 'Boya Jue Xian · Jasmine Milk Tea', dayTotal: 320, multipleOf: 6, cookMinutes: 3, shelfLifeMin: 60, price: 5.4, cost: 1.05 },
    { id: 'cg-wanli', name: 'Wan Li Mu Lan · Roasted Oolong Milk Tea', dayTotal: 180, multipleOf: 4, cookMinutes: 3, shelfLifeMin: 60, price: 5.6, cost: 1.15 },
    { id: 'cg-guifu', name: 'Gui Fu Lan Xiang · Osmanthus Oolong', dayTotal: 150, multipleOf: 4, cookMinutes: 3, shelfLifeMin: 55, price: 5.6, cost: 1.15 },
    { id: 'cg-baihao', name: 'Bai Hao · Jasmine White Milk Tea', dayTotal: 120, multipleOf: 3, cookMinutes: 3, shelfLifeMin: 55, price: 5.4, cost: 1.05 },
    { id: 'cg-grapefruit', name: 'Fresh Grapefruit Jasmine (fruit tea)', dayTotal: 110, multipleOf: 3, cookMinutes: 3, shelfLifeMin: 40, price: 6.0, cost: 1.5 },
    { id: 'cg-grape', name: 'Green Grape Oolong (fruit tea)', dayTotal: 90, multipleOf: 2, cookMinutes: 3, shelfLifeMin: 40, price: 6.0, cost: 1.45 },
    { id: 'cg-latte', name: 'Tie Guan Yin Tea Latte', dayTotal: 80, multipleOf: 2, cookMinutes: 3, shelfLifeMin: 45, price: 5.6, cost: 1.2 },
  ];
  return {
    // Long trading day, demo drops into the mid-afternoon tea rush.
    serviceStartMin: 10 * 60, // 10:00
    serviceEndMin: 22 * 60, // 22:00
    demoStartMin: 14 * 60, // 14:00
    dropIntervalMin: 15,
    baseIntensity: 0.3,
    peaks: [
      { centre: 13 * 60, width: 55, weight: 0.6 }, // lunch pickup
      { centre: 15 * 60, width: 80, weight: 1 }, // afternoon tea peak
      { centre: 19 * 60, width: 70, weight: 0.7 }, // evening
    ],
    items,
    holderSeed: [
      { itemId: 'cg-boya', count: 14, cookedMinAgo: 12 },
      { itemId: 'cg-wanli', count: 8, cookedMinAgo: 15 },
      { itemId: 'cg-guifu', count: 7, cookedMinAgo: 10 },
      { itemId: 'cg-baihao', count: 6, cookedMinAgo: 14 },
      { itemId: 'cg-grapefruit', count: 6, cookedMinAgo: 8 },
      { itemId: 'cg-grape', count: 4, cookedMinAgo: 9 },
      { itemId: 'cg-latte', count: 4, cookedMinAgo: 7 },
    ],
    recuts: [
      { atOffset: 4, message: 'Afternoon rush building like the last 4 Saturdays — brewing Boya Jue Xian base ahead', tone: 'cook-ahead', surge: { itemId: 'cg-boya', multiplier: 1.5, forMinutes: 22 } },
      { atOffset: 16, message: 'Office pickup orders usually spike now (same slot last week) — prepping Grapefruit Jasmine', tone: 'cook-ahead', surge: { itemId: 'cg-grapefruit', multiplier: 1.8, forMinutes: 14 } },
      { atOffset: 30, message: 'Roasted Oolong climbs mid-afternoon most days (last 2 weeks) — brewing ahead', tone: 'cook-ahead', surge: { itemId: 'cg-wanli', multiplier: 1.8, forMinutes: 18 } },
      { atOffset: 46, message: 'Rush easing — same as last week\u2019s tail. Holding back so no base gets tipped', tone: 'ease-off' },
      { atOffset: 64, message: 'Steady trade — brewing to the counter, nothing wasted', tone: 'info' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const BUILDERS: Record<string, () => ForecastDemoData> = {
  chagee: buildChageeData,
};

/** The dataset for the current build, selected by the active demo customer. */
export const FORECAST_DEMO: ForecastDemoData = (
  BUILDERS[demoCustomer.id] ?? buildBkData
)();
