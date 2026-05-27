/**
 * economics.ts — operator-language aggregates on top of the SKU forecasts.
 *
 * The fixtures only ship per-SKU unit forecasts and synthesised hourly
 * actuals. Operators don't think in SKUs and units — they think in:
 *
 *   • Currency    (£ revenue for the day / phase)
 *   • Items       (quantity sold)
 *   • Transactions(basket counts)
 *
 * This module layers those three numbers — plus channel mix and a plain-
 * English "why" — over the existing per-recipe report so the headline
 * surfaces on /forecast can stay short and operator-readable.
 *
 * All synthesised quantities (price, basket size, channel split, miss
 * narrative) are deterministic on their inputs (no Math.random) so demo
 * reloads are stable.
 */

import {
  dayOfWeek,
  forecastFor,
  getRecipe,
  getSite,
  productionItemsAt,
  PRET_RECIPES,
  type DemandSignal,
  type ProductionRecipe,
  type SiteId,
  type SkuId,
} from '@/components/Production/fixtures';
import { daySummary } from '@/components/Production/salesReport';
import { buildHourlySalesByRecipe } from '@/components/Production/salesActuals';
import { DEMO_NOW_HHMM } from '@/components/Production/PlanStore';
import { DEMO_TODAY } from '@/components/Production/fixtures';

// ────────────────────────────────────────────────────────────────────────────
// 1. Pricing — synthesised per-SKU sell price.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Average sell-price by category. These are eyeballed Pret-like values
 * (in £) so the headline currency number reads in the right ballpark for
 * a typical mid-size store. They're not load-bearing — anyone can tune
 * them per estate later — they just need to be consistent.
 */
const CATEGORY_BASE_PRICE: Record<ProductionRecipe['category'], number> = {
  Bakery: 2.55,
  Sandwich: 4.95,
  Salad: 6.5,
  Snack: 2.1,
  Beverage: 3.15,
};

/** Deterministic 0–1 noise from a string seed. FNV-1a. */
function seededNoise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Cache of SKU \u2192 recipe used by `unitPriceFor`. Built lazily on first call. */
let SKU_TO_RECIPE: Map<SkuId, ProductionRecipe> | null = null;
function getRecipeBySku(skuId: SkuId): ProductionRecipe | undefined {
  if (!SKU_TO_RECIPE) {
    SKU_TO_RECIPE = new Map();
    for (const r of PRET_RECIPES) SKU_TO_RECIPE.set(r.skuId, r);
  }
  return SKU_TO_RECIPE.get(skuId);
}

/**
 * Effective per-unit price for a SKU. Base price by category, plus a
 * deterministic \u00b1~15% wobble keyed on the SKU id so a chicken caesar and
 * a tuna sandwich aren't priced identically.
 */
export function unitPriceFor(skuId: SkuId): number {
  const recipe = getRecipeBySku(skuId);
  const category = recipe?.category ?? 'Sandwich';
  const base = CATEGORY_BASE_PRICE[category];
  const wobble = 0.85 + seededNoise(`price|${skuId}`) * 0.3; // 0.85..1.15
  return Math.round(base * wobble * 100) / 100; // round to pence
}

/**
 * Cheap wrapper that takes a `recipe` rather than re-resolving from the
 * SKU id. Used in hot paths that already have the recipe in hand.
 */
function unitPriceForRecipe(skuId: SkuId, recipe: ProductionRecipe): number {
  const base = CATEGORY_BASE_PRICE[recipe.category];
  const wobble = 0.85 + seededNoise(`price|${skuId}`) * 0.3;
  return Math.round(base * wobble * 100) / 100;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Basket size — items per transaction.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Average basket size for a (site, date). The number is bounded between
 * 1.25 and 1.85 — Pret-like: most people buy a coffee + one thing, some
 * buy a sandwich + drink + bakery, very few buy a single bakery item.
 *
 * - Weekends skew slightly lower (more single-purchase commuters absent).
 * - Hub / CBD sites skew slightly higher (group lunch orders).
 */
export function basketSizeFor(siteId: SiteId, date: string): number {
  const site = getSite(siteId);
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const weekendDip = dow === 0 || dow === 6 ? -0.05 : 0;
  const hubBoost = site?.type === 'HUB' ? 0.1 : 0;
  const noise = (seededNoise(`basket|${siteId}|${date}`) - 0.5) * 0.1; // ±0.05
  const v = 1.55 + weekendDip + hubBoost + noise;
  return Math.max(1.25, Math.min(1.85, Number(v.toFixed(2))));
}

/** Convert an item count → transactions for a (site, date). */
export function transactionsForItems(items: number, siteId: SiteId, date: string): number {
  const basket = basketSizeFor(siteId, date);
  return Math.max(0, Math.round(items / basket));
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Channel mix — takeaway / eat-in / delivery split.
// ────────────────────────────────────────────────────────────────────────────

export type Channel = 'takeaway' | 'eatIn' | 'delivery';

export const CHANNEL_LABEL: Record<Channel, string> = {
  takeaway: 'Takeaway',
  eatIn: 'Eat-in',
  delivery: 'Delivery',
};

export type ChannelSplit = {
  takeaway: number;
  eatIn: number;
  delivery: number;
};

/**
 * Synthesised channel mix for a (site, date). The shape varies by site
 * archetype and slightly by day-of-week so the demo doesn't show the
 * same three percentages on every site / day.
 *
 * Hub / large standalone (CBD)   → takeaway-heavy
 * Hybrid                         → balanced
 * Spoke / suburban standalone    → more eat-in
 *
 * All three values sum to ~1.0 within a rounding hair.
 */
export function channelMixFor(siteId: SiteId, date: string): ChannelSplit {
  const site = getSite(siteId);
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const isWeekend = dow === 0 || dow === 6;

  // Baseline by site archetype.
  let takeaway = 0.6;
  let eatIn = 0.25;
  let delivery = 0.15;

  if (site?.type === 'HUB') {
    takeaway = 0.65;
    eatIn = 0.2;
    delivery = 0.15;
  } else if (site?.type === 'HYBRID') {
    takeaway = 0.55;
    eatIn = 0.3;
    delivery = 0.15;
  } else if (site?.type === 'SPOKE') {
    takeaway = 0.5;
    eatIn = 0.35;
    delivery = 0.15;
  }

  // Weekend tilt: more eat-in, slightly more delivery, less takeaway.
  if (isWeekend) {
    takeaway -= 0.07;
    eatIn += 0.05;
    delivery += 0.02;
  }

  // Small site-day wobble (±2%) so neighbouring days aren't pixel-identical.
  const wobble = (seededNoise(`channel|${siteId}|${date}`) - 0.5) * 0.04;
  takeaway = clamp01(takeaway + wobble);
  eatIn = clamp01(eatIn - wobble * 0.6);
  delivery = clamp01(delivery - wobble * 0.4);

  // Renormalise so they exactly sum to 1.
  const sum = takeaway + eatIn + delivery;
  return {
    takeaway: takeaway / sum,
    eatIn: eatIn / sum,
    delivery: delivery / sum,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Site-day totals (forward + actual flavours).
// ────────────────────────────────────────────────────────────────────────────

export type Phase = 'morning' | 'midday' | 'afternoon';

export const PHASE_LABEL: Record<Phase, string> = {
  morning: 'Morning',
  midday: 'Midday',
  afternoon: 'Afternoon',
};

/**
 * The three operator-language numbers, plus a phase breakdown.
 *
 * `items` is the quantity sold. `revenue` is in £. `transactions` is the
 * number of baskets (derived from items via `basketSizeFor`).
 */
export type DayTotals = {
  date: string;
  revenue: number;
  items: number;
  transactions: number;
  byPhase: Record<Phase, { revenue: number; items: number; transactions: number }>;
  channel: {
    revenue: ChannelSplit;
    items: ChannelSplit;
    transactions: ChannelSplit;
  };
};

/**
 * Forward-looking forecast totals for a (site, date) — uses the SKU-level
 * forecasts in fixtures + the synthesised prices/channel-mix.
 *
 * Phase breakdown comes from each forecast entry's `byPhase` shares.
 * Channel split is uniform across all SKUs (since the fixtures don't
 * track channel per SKU); we apply it after totals are computed.
 */
export function forwardTotalsFor(siteId: SiteId, date: string): DayTotals {
  let items = 0;
  let revenue = 0;
  const phaseItems: Record<Phase, number> = { morning: 0, midday: 0, afternoon: 0 };
  const phaseRevenue: Record<Phase, number> = { morning: 0, midday: 0, afternoon: 0 };

  // Walk every SKU the site sells (direct + hub-linked).
  const skus = sellableSkusForSite(siteId);
  for (const { skuId, recipe } of skus) {
    const f = forecastFor(siteId, skuId, date);
    if (!f || f.projectedUnits <= 0) continue;
    const price = unitPriceForRecipe(skuId, recipe);
    items += f.projectedUnits;
    revenue += f.projectedUnits * price;
    if (f.byPhase) {
      phaseItems.morning += f.byPhase.morning;
      phaseItems.midday += f.byPhase.midday;
      phaseItems.afternoon += f.byPhase.afternoon;
      phaseRevenue.morning += f.byPhase.morning * price;
      phaseRevenue.midday += f.byPhase.midday * price;
      phaseRevenue.afternoon += f.byPhase.afternoon * price;
    } else {
      // Fall back to a 25/55/20 split if a SKU lacks `byPhase` info.
      phaseItems.morning += f.projectedUnits * 0.25;
      phaseItems.midday += f.projectedUnits * 0.55;
      phaseItems.afternoon += f.projectedUnits * 0.2;
      phaseRevenue.morning += f.projectedUnits * 0.25 * price;
      phaseRevenue.midday += f.projectedUnits * 0.55 * price;
      phaseRevenue.afternoon += f.projectedUnits * 0.2 * price;
    }
  }

  return assembleTotals(siteId, date, revenue, items, phaseItems, phaseRevenue);
}

/**
 * Actuals-aware totals for a (site, date). For past dates the actuals
 * are full-day; for today they're partial (everything that has rung
 * through the till up to `DEMO_NOW_HHMM`).
 *
 * Uses `daySummary` for the SKU-level rows so it shares the same
 * actuals synthesiser as the rest of the platform.
 */
export function actualTotalsFor(siteId: SiteId, date: string): DayTotals {
  const ds = daySummary(siteId, date);
  let items = 0;
  let revenue = 0;
  for (const row of ds.rows) {
    const skuId = row.line.item.skuId;
    const price = unitPriceForRecipe(skuId, row.line.recipe);
    items += row.sold;
    revenue += row.sold * price;
  }

  // Phase totals come from the hourly cells.
  const phaseItems = phaseSplitFromHourly(siteId, date, 'actual');
  const phaseRevenue: Record<Phase, number> = { morning: 0, midday: 0, afternoon: 0 };
  // Distribute revenue proportionally to item shares within each phase.
  const totalPhaseItems = phaseItems.morning + phaseItems.midday + phaseItems.afternoon;
  if (totalPhaseItems > 0) {
    phaseRevenue.morning = revenue * (phaseItems.morning / totalPhaseItems);
    phaseRevenue.midday = revenue * (phaseItems.midday / totalPhaseItems);
    phaseRevenue.afternoon = revenue * (phaseItems.afternoon / totalPhaseItems);
  }

  return assembleTotals(siteId, date, revenue, items, phaseItems, phaseRevenue);
}

function assembleTotals(
  siteId: SiteId,
  date: string,
  revenue: number,
  items: number,
  phaseItems: Record<Phase, number>,
  phaseRevenue: Record<Phase, number>,
): DayTotals {
  const transactions = transactionsForItems(items, siteId, date);
  const mix = channelMixFor(siteId, date);

  const byPhase: DayTotals['byPhase'] = {
    morning: {
      revenue: Math.round(phaseRevenue.morning),
      items: Math.round(phaseItems.morning),
      transactions: transactionsForItems(phaseItems.morning, siteId, date),
    },
    midday: {
      revenue: Math.round(phaseRevenue.midday),
      items: Math.round(phaseItems.midday),
      transactions: transactionsForItems(phaseItems.midday, siteId, date),
    },
    afternoon: {
      revenue: Math.round(phaseRevenue.afternoon),
      items: Math.round(phaseItems.afternoon),
      transactions: transactionsForItems(phaseItems.afternoon, siteId, date),
    },
  };

  return {
    date,
    revenue: Math.round(revenue),
    items: Math.round(items),
    transactions,
    byPhase,
    channel: {
      revenue: mix,
      items: mix,
      transactions: mix,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Phase split from hourly cells — for actuals.
// ────────────────────────────────────────────────────────────────────────────

const MIDDAY_START = 11;
const AFTERNOON_START = 15;

function hourToPhase(hour: number): Phase {
  if (hour < MIDDAY_START) return 'morning';
  if (hour < AFTERNOON_START) return 'midday';
  return 'afternoon';
}

function phaseSplitFromHourly(
  siteId: SiteId,
  date: string,
  mode: 'forecast' | 'actual',
): Record<Phase, number> {
  const nowHHMM = date === DEMO_TODAY ? DEMO_NOW_HHMM : '23:59';
  const data = buildHourlySalesByRecipe(siteId, date, nowHHMM);
  const out: Record<Phase, number> = { morning: 0, midday: 0, afternoon: 0 };
  for (const ht of data.hourTotals) {
    const v = mode === 'forecast' ? ht.forecast : ht.actual ?? 0;
    out[hourToPhase(ht.hour)] += v;
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// 5b. Time-aware day comparison — apples-to-apples forecast vs actual.
//
// `actualTotalsFor` returns sold-so-far (partial for DEMO_TODAY); pairing
// it with a full-day forecast produces a -100% miss for any phase that
// hasn't started yet, which is exactly the trap operators read first.
//
// `compareDay` reads the same per-hour cells the live actuals come from
// and returns both numbers truncated at "now": forecast-so-far + actual-
// so-far. It also exposes the full-day forecast separately (so the card
// can still show "of £X expected for the full day") and a per-phase
// status so the UI can show pending phases as "Not yet" instead of a
// -100% delta.
// ────────────────────────────────────────────────────────────────────────────

export type PhaseStatus = 'complete' | 'current' | 'pending';

export type DayCompare = {
  date: string;
  /** True when `date === DEMO_TODAY` — the day is still in progress. */
  isPartial: boolean;
  /** Per-phase progress. Pending phases haven't started yet (today only). */
  phaseStatus: Record<Phase, PhaseStatus>;
  /** What had been forecasted vs sold by `now` (full-day for past dates). */
  soFar: { forecast: DayTotals; actual: DayTotals };
  /** Full-day forecast (always full day) — what the day should land at. */
  fullDayForecast: DayTotals;
};

export function compareDay(siteId: SiteId, date: string): DayCompare {
  const nowHHMM = date === DEMO_TODAY ? DEMO_NOW_HHMM : '23:59';
  const data = buildHourlySalesByRecipe(siteId, date, nowHHMM);
  const isPartial = date === DEMO_TODAY;

  // Phase status — derived from the hour cells' past/current/future flags.
  const counts: Record<Phase, { past: number; current: number; future: number }> = {
    morning: { past: 0, current: 0, future: 0 },
    midday: { past: 0, current: 0, future: 0 },
    afternoon: { past: 0, current: 0, future: 0 },
  };
  for (const ht of data.hourTotals) {
    const p = hourToPhase(ht.hour);
    if (ht.isCurrent) counts[p].current += 1;
    else if (ht.isPast) counts[p].past += 1;
    else counts[p].future += 1;
  }
  const phaseStatus: Record<Phase, PhaseStatus> = {
    morning: 'pending',
    midday: 'pending',
    afternoon: 'pending',
  };
  (['morning', 'midday', 'afternoon'] as const).forEach(p => {
    if (counts[p].current > 0 || (counts[p].past > 0 && counts[p].future > 0)) {
      phaseStatus[p] = 'current';
    } else if (counts[p].future === 0 && (counts[p].past > 0 || counts[p].current > 0)) {
      phaseStatus[p] = 'complete';
    } else {
      phaseStatus[p] = 'pending';
    }
  });

  // Walk every row × cell so per-phase aggregates and per-day totals use
  // the same numbers (the cell-level forecastSoFar accounts for partial
  // hours via the prorating in `salesActuals.distributeAcrossHours`).
  let fcItems = 0;
  let acItems = 0;
  let fcRevenue = 0;
  let acRevenue = 0;
  const fcPhaseItems: Record<Phase, number> = { morning: 0, midday: 0, afternoon: 0 };
  const acPhaseItems: Record<Phase, number> = { morning: 0, midday: 0, afternoon: 0 };
  const fcPhaseRevenue: Record<Phase, number> = { morning: 0, midday: 0, afternoon: 0 };
  const acPhaseRevenue: Record<Phase, number> = { morning: 0, midday: 0, afternoon: 0 };

  for (const row of data.rows) {
    const skuId = row.line.item.skuId;
    const price = unitPriceForRecipe(skuId, row.line.recipe);
    fcItems += row.forecastSoFar;
    acItems += row.soldSoFar;
    fcRevenue += row.forecastSoFar * price;
    acRevenue += row.soldSoFar * price;
    for (const cell of row.cells) {
      const p = hourToPhase(cell.hour);
      fcPhaseItems[p] += cell.forecastSoFar;
      acPhaseItems[p] += cell.actual ?? 0;
      fcPhaseRevenue[p] += cell.forecastSoFar * price;
      acPhaseRevenue[p] += (cell.actual ?? 0) * price;
    }
  }

  const forecastSoFar = assembleTotals(
    siteId,
    date,
    fcRevenue,
    fcItems,
    fcPhaseItems,
    fcPhaseRevenue,
  );
  const actualSoFar = assembleTotals(
    siteId,
    date,
    acRevenue,
    acItems,
    acPhaseItems,
    acPhaseRevenue,
  );
  const fullDayForecast = forwardTotalsFor(siteId, date);

  return {
    date,
    isPartial,
    phaseStatus,
    soFar: { forecast: forecastSoFar, actual: actualSoFar },
    fullDayForecast,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 6. "Why" — aggregate the per-SKU signals into a site-level narrative.
// ────────────────────────────────────────────────────────────────────────────

export const SIGNAL_LABEL: Record<DemandSignal, string> = {
  'sales-history': 'Sales history',
  weather: 'Weather',
  'stock-on-hand': 'Stock on hand',
  'online-orders': 'Online orders',
  'waste-history': 'Waste history',
  event: 'Local events',
  promo: 'Promo',
};

const SIGNAL_PHRASE: Record<DemandSignal, string> = {
  'sales-history': 'recent sales pattern',
  weather: 'today\u2019s weather',
  'stock-on-hand': 'stock on hand',
  'online-orders': 'online order pipeline',
  'waste-history': 'recent waste trend',
  event: 'local events',
  promo: 'active promo',
};

export type AggregatedSignal = {
  signal: DemandSignal;
  label: string;
  /** 0–1; share of total weighted contribution across SKUs for the day. */
  share: number;
  /** A representative note pulled from one of the contributing SKUs, when present. */
  note?: string;
};

/**
 * Aggregate the per-SKU `signals` arrays into a site-day weighted ranking.
 * Each SKU's signal weights are multiplied by its projected units so a
 * 100-unit SKU with weight 0.3 outranks a 5-unit SKU with weight 0.9.
 *
 * Returns the top contributors normalised so `share` values across the
 * full list sum to 1. The caller decides how many to surface (top 2–3
 * is usually enough for a single sentence).
 */
export function aggregateForwardSignals(siteId: SiteId, date: string): AggregatedSignal[] {
  const acc = new Map<DemandSignal, { weight: number; note?: string }>();

  const skus = sellableSkusForSite(siteId);
  for (const { skuId } of skus) {
    const f = forecastFor(siteId, skuId, date);
    if (!f || f.projectedUnits <= 0) continue;
    for (const s of f.signals ?? []) {
      const e = acc.get(s.signal) ?? { weight: 0 };
      e.weight += s.weight * f.projectedUnits;
      if (!e.note && s.note) e.note = s.note;
      acc.set(s.signal, e);
    }
  }

  const total = Array.from(acc.values()).reduce((a, b) => a + b.weight, 0) || 1;
  const ranked: AggregatedSignal[] = Array.from(acc.entries())
    .map(([signal, e]) => ({
      signal,
      label: SIGNAL_LABEL[signal],
      share: e.weight / total,
      note: e.note,
    }))
    .sort((a, b) => b.share - a.share);

  return ranked;
}

/**
 * Compact one-sentence narrative for the forward forecast. Reads like:
 *   "Driven mostly by recent sales pattern (62%) and today's weather (24%)."
 *
 * Falls back to a softer string when no signals are present (e.g. very
 * early in the forecast window).
 */
export function narrateForwardWhy(siteId: SiteId, date: string): string {
  const signals = aggregateForwardSignals(siteId, date);
  if (signals.length === 0) {
    return `Using the ${dayOfWeek(date).toLowerCase()} baseline for this site \u2014 no extra signals firing today.`;
  }
  const top = signals.slice(0, 2);
  const parts = top.map(
    s => `${SIGNAL_PHRASE[s.signal]} (${Math.round(s.share * 100)}%)`,
  );
  const tail = signals.length > 2 ? `, with ${signals.length - 2} smaller signals on top` : '';
  return `Driven mostly by ${parts.join(' and ')}${tail}.`;
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Miss narration — why we under/over-forecasted.
// ────────────────────────────────────────────────────────────────────────────

export type MissNarrative = {
  /** Variance as a pct of forecast (signed). Empty if forecast was 0. */
  variancePct: number;
  /** Where the miss is concentrated (the phase with the largest abs delta). */
  worstPhase?: Phase;
  /** A single-sentence operator-readable explanation. */
  sentence: string;
};

/**
 * Compute the miss narrative for a comparison.
 *
 * Uses `compareDay` so today and past dates both produce apples-to-apples
 * comparisons (today truncated at "now", past full-day). When the day is
 * partial we phrase the sentence as a "so far" reading rather than a
 * verdict on the whole day.
 *
 * The "why" we surface is a heuristic — the prototype doesn't run a real
 * attribution model — but it's grounded in the same signals the forward
 * forecast uses: when forecast > actual we lean on the dominant signal
 * as the likely over-weighted contributor, and vice versa.
 */
export function narrateMiss(siteId: SiteId, date: string): MissNarrative {
  const cmp = compareDay(siteId, date);
  const f = cmp.soFar.forecast;
  const a = cmp.soFar.actual;
  const variance = a.items - f.items;
  const variancePct = f.items > 0 ? (variance / f.items) * 100 : 0;

  // Worst phase — only considers phases that have data so we don't blame
  // the afternoon for being "off" when it hasn't started yet.
  const phases: Phase[] = ['morning', 'midday', 'afternoon'];
  let worstPhase: Phase | undefined;
  let worstDelta = 0;
  for (const p of phases) {
    if (cmp.phaseStatus[p] === 'pending') continue;
    const d = a.byPhase[p].items - f.byPhase[p].items;
    if (Math.abs(d) > Math.abs(worstDelta)) {
      worstDelta = d;
      worstPhase = p;
    }
  }

  const signals = aggregateForwardSignals(siteId, date);
  const cause = signals[0];

  // Avoid naming the forecasting model in the narrative — the operator
  // reads the sentence as "what happened in the shop", not "what the
  // AI did". Subject is always "sales" (the thing that happened);
  // partial days use present-progressive ("are running"), settled days
  // use past tense.
  const dayPrefix = cmp.isPartial
    ? `By ${DEMO_NOW_HHMM} ${dayOfWeek(date).toLowerCase()}, sales`
    : `Sales`;
  const direction =
    variance > 0
      ? cmp.isPartial
        ? `${dayPrefix} are running ahead of forecast`
        : `${dayPrefix} ran ahead of forecast`
      : variance < 0
        ? cmp.isPartial
          ? `${dayPrefix} are running behind forecast`
          : `${dayPrefix} ran behind forecast`
        : cmp.isPartial
          ? `${dayPrefix} are tracking forecast`
          : `${dayPrefix} tracked forecast`;
  const phaseText = worstPhase ? `, mostly in the ${PHASE_LABEL[worstPhase].toLowerCase()}` : '';
  const causeText = cause
    ? variance > 0
      ? ` \u2014 ${SIGNAL_PHRASE[cause.signal]} likely under-weighted.`
      : variance < 0
        ? ` \u2014 ${SIGNAL_PHRASE[cause.signal]} likely over-weighted.`
        : '.'
    : '.';

  if (f.items === 0 && a.items === 0) {
    return {
      variancePct: 0,
      worstPhase: undefined,
      sentence: cmp.isPartial
        ? `The day hasn\u2019t opened yet \u2014 actuals will fill in across the morning.`
        : `No forecast or actuals for ${dayOfWeek(date).toLowerCase()}.`,
    };
  }

  const sentence =
    Math.abs(variancePct) < 1
      ? `${direction} \u2014 within 1% (on target)${phaseText}.`
      : `${direction} by ${Math.abs(Math.round(variancePct))}%${phaseText}${causeText}`;

  return { variancePct, worstPhase, sentence };
}

// ────────────────────────────────────────────────────────────────────────────
// 8. Helpers
// ────────────────────────────────────────────────────────────────────────────

type SellableSku = { skuId: SkuId; recipe: ProductionRecipe };

/**
 * The set of SKUs a site sells in a day — its own production items plus
 * any items inherited from its hub when it's hub-linked. Mirrors the
 * union used by `buildForecastRows` so totals stay consistent.
 */
function sellableSkusForSite(siteId: SiteId): SellableSku[] {
  const out = new Map<SkuId, SellableSku>();
  for (const item of productionItemsAt(siteId)) {
    const recipe = getRecipe(item.recipeId);
    if (recipe) out.set(item.skuId, { skuId: item.skuId, recipe });
  }
  const site = getSite(siteId);
  if (site?.hubId) {
    for (const item of productionItemsAt(site.hubId)) {
      const recipe = getRecipe(item.recipeId);
      if (recipe && !out.has(item.skuId)) {
        out.set(item.skuId, { skuId: item.skuId, recipe });
      }
    }
  }
  return Array.from(out.values());
}

// ────────────────────────────────────────────────────────────────────────────
// 9. Formatters — single place so headline + drill-down stay consistent.
// ────────────────────────────────────────────────────────────────────────────

export function formatCurrency(n: number): string {
  if (n >= 10_000) return `£${(n / 1000).toFixed(1)}k`;
  return `£${n.toLocaleString('en-GB')}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-GB');
}

export function formatPct(n: number, opts?: { sign?: boolean }): string {
  const sign = opts?.sign && n > 0 ? '+' : '';
  if (Math.abs(n) < 1) return '0%';
  return `${sign}${Math.round(n)}%`;
}
