/**
 * What a publish did downstream, in one or two lines for the log.
 *
 * Jana changes a yield loss or a make-on day and wants to know what moved:
 * "kale up one bag at eight shops", not a list of fields. The Setup screen
 * takes a snapshot of every shop's current planning window before it
 * publishes (the engines still run on the old rules at that point), takes
 * another once the stores have settled, and `describeImpact` turns the two
 * into plain sentences.
 */

import { addDays, planningWindowFor } from './calendar';
import { computeDayPlan, type DayRecord } from './FjPlanStore';
import { computeOrderSheet } from './ordering';
import { INGREDIENTS } from './recipes';

type GetRecord = (shopId: string, date: string) => DayRecord;

export type ShopImpact = {
  /** Batches across the window's day plans. */
  batches: number;
  /** Grams of prep made across the window. */
  prepGrams: number;
  /** Packs to order, by ingredient id. */
  packs: Record<string, number>;
};

export type ImpactSnapshot = { window: string[]; byShop: Record<string, ShopImpact> };

export function snapshotImpact(shopIds: string[], date: string, getRecord: GetRecord): ImpactSnapshot {
  const window = planningWindowFor(date);
  const byShop: Record<string, ShopImpact> = {};
  for (const shopId of shopIds) {
    let batches = 0;
    for (const d of window.days) {
      const plan = computeDayPlan(shopId, d, getRecord(shopId, d), getRecord(shopId, addDays(d, -1)).close);
      batches += plan.totals.batches;
    }
    const sheet = computeOrderSheet(shopId, window, getRecord);
    const prepGrams = sheet.make.reduce((n, g) => n + g.lines.reduce((m, l) => m + l.totalGramsMade, 0), 0);
    const packs: Record<string, number> = {};
    for (const g of sheet.order) for (const l of g.lines) packs[l.ingredientId] = (packs[l.ingredientId] ?? 0) + l.packs;
    byShop[shopId] = { batches: Math.round(batches * 2) / 2, prepGrams, packs };
  }
  return { window: window.days, byShop };
}

const signed = (n: number, unit: string) => `${n > 0 ? '+' : '−'}${Math.abs(n)}${unit}`;
const shopsWord = (n: number) => (n === 1 ? '1 shop' : `${n} shops`);

export function describeImpact(before: ImpactSnapshot, after: ImpactSnapshot): string[] {
  const out: string[] = [];
  const shops = Object.keys(after.byShop).filter(id => before.byShop[id]);

  let batchDelta = 0;
  let batchShops = 0;
  let prepDelta = 0;
  let prepShops = 0;
  const packDelta: Record<string, { total: number; shops: number }> = {};
  for (const id of shops) {
    const a = before.byShop[id];
    const b = after.byShop[id];
    if (a.batches !== b.batches) { batchDelta += b.batches - a.batches; batchShops += 1; }
    if (Math.abs(a.prepGrams - b.prepGrams) >= 50) { prepDelta += b.prepGrams - a.prepGrams; prepShops += 1; }
    const ids = new Set([...Object.keys(a.packs), ...Object.keys(b.packs)]);
    for (const ing of ids) {
      const d = (b.packs[ing] ?? 0) - (a.packs[ing] ?? 0);
      if (!d) continue;
      const e = (packDelta[ing] ??= { total: 0, shops: 0 });
      e.total += d;
      e.shops += 1;
    }
  }

  if (batchShops) out.push(`Batches ${signed(Math.round(batchDelta * 2) / 2, '')} across ${shopsWord(batchShops)}.`);
  if (prepShops) {
    const kg = Math.abs(prepDelta) >= 10_000 ? Math.round(prepDelta / 1000) : Math.round(prepDelta / 100) / 10;
    out.push(`Prep ${signed(kg, ' kg')} across ${shopsWord(prepShops)}.`);
  }
  const packs = Object.entries(packDelta)
    .sort((x, y) => y[1].shops - x[1].shops || Math.abs(y[1].total) - Math.abs(x[1].total))
    .slice(0, 3)
    .map(([ing, d]) => {
      const name = INGREDIENTS[ing]?.name ?? ing;
      // Packs are whole, so the typical shop's move is the rounded average.
      const per = Math.round(d.total / d.shops) || (d.total > 0 ? 1 : -1);
      const pack = INGREDIENTS[ing]?.pack.label ?? 'pack';
      return `${name} ${signed(per, ` × ${pack}`)} at ${shopsWord(d.shops)}`;
    });
  if (packs.length) out.push(`Order: ${packs.join('; ')}.`);

  if (!out.length) {
    const from = before.window[0];
    const to = before.window[before.window.length - 1];
    out.push(`No change to plans, prep or orders for ${from.slice(8, 10)} to ${to.slice(8, 10)} at ${shopsWord(shops.length)}.`);
  }
  return out;
}
