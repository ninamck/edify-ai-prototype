/**
 * Quick count and group count variance for the COGS Variance tab.
 *
 * The COGS period runs from the opening stocktake (a full count) to the
 * closing stocktake (the next full count). Quick counts and group counts
 * happen in between. They never change the opening or closing figures
 * or the period COGS; they show where stock went missing along the way.
 *
 * For each product in a count:
 *   • Expected      opening stocktake + purchases ± transfers − waste −
 *                   theo usage, all since the opening stocktake.
 *   • Var vs previous count   (previous count + movements in between) −
 *                   counted. If the product wasn't in the count before,
 *                   "previous" is the most recent count that included it.
 *   • Var vs opening stocktake   expected − counted.
 *
 * Signs follow the full variance table: positive = more used than the
 * recipes explain (stock missing).
 *
 * The plans are authored day by day so the 7 Jan closing full count lands
 * exactly on `COGS_VARIANCE_ROWS`: Var Qty vs opening on that count equals
 * the period Var Qty for every product.
 */

import { COGS_VARIANCE_ROWS, type ProductClass } from './fixtures';

export const PERIOD_DAYS = 7;
export const DAY_LABELS = ['31 Dec', '1 Jan', '2 Jan', '3 Jan', '4 Jan', '5 Jan', '6 Jan', '7 Jan'];

/** Calendar date of a period day. Day 0 is the opening stocktake. */
function dateOf(day: number): Date {
  return new Date(2025, 11, 31 + day);
}

export function longDayLabel(day: number): string {
  return dateOf(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "w/c 29 Dec": the Monday of the week the day falls in. */
export function weekLabel(day: number): string {
  const d = dateOf(day);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `w/c ${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

type ItemPlan = {
  rowId: string;
  /** Counting precision; everything is authored in multiples of this. */
  step: number;
  /** Days (1–7) a delivery landed. Period purchases split evenly. */
  deliveryDays: number[];
  waste: Record<number, number>;
  transfer?: { day: number; qty: number };
  /** Unexplained loss per day, index 0 = 1 Jan. Sums to period Var Qty. */
  loss: number[];
  /** A count that was wrong on the night: stock didn't move, the number did. */
  miscount?: { day: number; qty: number };
};

const PLANS: ItemPlan[] = [
  { rowId: 'avocado', step: 0.1, deliveryDays: [1, 3, 5], waste: { 6: 2 }, loss: [9, 9, 10, 20, 9, 10, 9] },
  { rowId: 'smoked-salmon', step: 1, deliveryDays: [1, 3, 5], waste: { 2: 1 }, loss: [0, 0, 7, 0, 0, 0, 0] },
  { rowId: 'house-red-wine', step: 1, deliveryDays: [2, 5], waste: { 4: 2 }, loss: [1, 2, 1, 3, 1, 2, 2], miscount: { day: 5, qty: 6 } },
  { rowId: 'sourdough-loaf', step: 1, deliveryDays: [1, 2, 3, 4, 5, 6, 7], waste: { 3: 5 }, loss: [3, 4, 3, 4, 4, 4, 3] },
  { rowId: 'chicken-breast', step: 0.1, deliveryDays: [1, 3, 5], waste: { 6: 2 }, transfer: { day: 4, qty: -6 }, loss: [2, 3, 2, 3, 3, 2, 3] },
  { rowId: 'basil-leaves-sanitized', step: 1, deliveryDays: [1, 4], waste: { 3: 2, 6: 2 }, loss: [0, 1, 1, 1, 1, 1, 1] },
  { rowId: 'whole-milk', step: 1, deliveryDays: [1, 3, 5], waste: { 2: 2, 4: 2, 6: 2, 7: 2 }, transfer: { day: 2, qty: -20 }, loss: [4, 4, 4, 4, 4, 4, 3] },
  { rowId: 'oat-milk', step: 1, deliveryDays: [1, 4], waste: { 3: 2, 6: 2 }, loss: [4, 4, 5, 4, 4, 5, 4] },
  { rowId: 'arabica-beans', step: 0.5, deliveryDays: [2, 5], waste: {}, transfer: { day: 3, qty: -2 }, loss: [0, 0, 0, 0.5, 0, 0, 0] },
  { rowId: 'cheddar-block', step: 1, deliveryDays: [1, 4], waste: { 5: 1 }, loss: [0, 0, 0, 0, 1, 0, 0] },
];

export type CountKind = 'full' | 'quick' | 'group';

export type CountSession = {
  id: string;
  /** 0 = 31 Dec opening stocktake, 1–7 = 1–7 Jan. */
  day: number;
  kind: CountKind;
  /** Group name, for group counts. */
  groupName?: string;
  counter: string;
  itemIds: string[];
};

const FAST_MOVERS = ['avocado', 'smoked-salmon', 'chicken-breast', 'sourdough-loaf', 'house-red-wine'];
const ALL_ITEMS = PLANS.map((p) => p.rowId);

export const COUNT_SESSIONS: CountSession[] = [
  { id: 'c0', day: 0, kind: 'full', counter: 'External auditor', itemIds: ALL_ITEMS },
  { id: 'c1', day: 1, kind: 'quick', counter: 'Priya Naidoo', itemIds: FAST_MOVERS },
  { id: 'c2', day: 2, kind: 'quick', counter: 'Priya Naidoo', itemIds: [...FAST_MOVERS, 'basil-leaves-sanitized'] },
  { id: 'c3', day: 3, kind: 'quick', counter: 'Maya Chen', itemIds: FAST_MOVERS },
  { id: 'c4', day: 4, kind: 'group', groupName: 'Bar and coffee', counter: 'Tom Iyer', itemIds: ['house-red-wine', 'whole-milk', 'oat-milk', 'arabica-beans'] },
  { id: 'c5', day: 5, kind: 'quick', counter: 'Priya Naidoo', itemIds: [...FAST_MOVERS, 'basil-leaves-sanitized'] },
  { id: 'c6', day: 6, kind: 'quick', counter: 'Maya Chen', itemIds: [...FAST_MOVERS, 'oat-milk'] },
  { id: 'c7', day: 7, kind: 'full', counter: 'External auditor', itemIds: ALL_ITEMS },
];

/** The quick and group counts between the opening and closing stocktake. */
export const QUICK_COUNT_SESSIONS = COUNT_SESSIONS.filter((s) => s.kind !== 'full');

export const COUNT_KIND_LABEL: Record<CountKind, string> = {
  full: 'Full count',
  quick: 'Quick count',
  group: 'Group count',
};

export function countLabel(s: CountSession): string {
  if (s.kind === 'group' && s.groupName) return `${s.groupName} group count`;
  return COUNT_KIND_LABEL[s.kind];
}

// ── Derivation ─────────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Split `total` across `n` slots in multiples of `step`; the last slot
 *  takes the remainder so the sum is exact. */
function split(total: number, n: number, step: number): number[] {
  const each = Math.round(total / n / step) * step;
  const out = Array.from({ length: n }, () => r2(each));
  out[n - 1] = r2(total - each * (n - 1));
  return out;
}

type DayMovement = { delivered: number; transfer: number; waste: number; used: number; loss: number };

type ItemModel = {
  id: string;
  opening: number;
  /** Index 1–7. Index 0 is unused. */
  days: DayMovement[];
  miscount?: { day: number; qty: number };
};

const MODELS: Record<string, ItemModel> = Object.fromEntries(
  PLANS.map((plan) => {
    const row = COGS_VARIANCE_ROWS.find((r) => r.id === plan.rowId);
    if (!row) throw new Error(`quickCounts: no COGS row for ${plan.rowId}`);
    const used = split(row.theoUsage, PERIOD_DAYS, plan.step);
    const deliveries = split(row.purchases, plan.deliveryDays.length, plan.step);
    const days: DayMovement[] = [{ delivered: 0, transfer: 0, waste: 0, used: 0, loss: 0 }];
    for (let d = 1; d <= PERIOD_DAYS; d++) {
      const dIdx = plan.deliveryDays.indexOf(d);
      days.push({
        delivered: dIdx >= 0 ? deliveries[dIdx] : 0,
        transfer: plan.transfer?.day === d ? plan.transfer.qty : 0,
        waste: plan.waste[d] ?? 0,
        used: used[d - 1],
        loss: plan.loss[d - 1],
      });
    }
    return [plan.rowId, { id: plan.rowId, opening: row.openingStock, days, miscount: plan.miscount }];
  }),
);

function movementsBetween(m: ItemModel, fromDay: number, toDay: number) {
  let purchases = 0;
  let transfer = 0;
  let waste = 0;
  let theoUsage = 0;
  let loss = 0;
  for (let d = fromDay + 1; d <= toDay; d++) {
    const mv = m.days[d];
    purchases += mv.delivered;
    transfer += mv.transfer;
    waste += mv.waste;
    theoUsage += mv.used;
    loss += mv.loss;
  }
  return { purchases: r2(purchases), transfer: r2(transfer), waste: r2(waste), theoUsage: r2(theoUsage), loss: r2(loss) };
}

function expectedAt(m: ItemModel, day: number): number {
  const mv = movementsBetween(m, 0, day);
  return r2(m.opening + mv.purchases + mv.transfer - mv.waste - mv.theoUsage);
}

/** What the counter wrote down at close of `day`. */
function countedAt(m: ItemModel, day: number): number {
  const off = m.miscount?.day === day ? m.miscount.qty : 0;
  return r2(expectedAt(m, day) - movementsBetween(m, 0, day).loss + off);
}

function countsOf(itemId: string): CountSession[] {
  return COUNT_SESSIONS.filter((s) => s.itemIds.includes(itemId));
}

export type CountPoint = {
  sessionId: string;
  day: number;
  kind: CountKind;
  counted: number;
  /** Positive = stock missing since the previous count of this product. */
  varPrevQty: number;
  /** Positive = stock missing since the opening stocktake. */
  varOpeningQty: number;
};

function pointFor(m: ItemModel, s: CountSession, prev: CountSession | undefined): CountPoint {
  const counted = countedAt(m, s.day);
  const varOpeningQty = r2(expectedAt(m, s.day) - counted);
  const prevVar = prev ? expectedAt(m, prev.day) - countedAt(m, prev.day) : varOpeningQty;
  return { sessionId: s.id, day: s.day, kind: s.kind, counted, varPrevQty: r2(varOpeningQty - prevVar), varOpeningQty };
}

export type QuickCountRow = {
  id: string;
  /** The count this row comes from. */
  countDay: number;
  countKind: CountKind;
  name: string;
  productClass: ProductClass;
  packType: string;
  unitCost: number;
  /** All movement columns run from the opening stocktake to this count. */
  openingStock: number;
  purchases: number;
  transfer: number;
  waste: number;
  theoUsage: number;
  expectedStock: number;
  countedStock: number;
  stockValue: number;
  prevCount: number;
  prevDay: number;
  prevKind: CountKind;
  varPrevQty: number;
  varPrevCost: number;
  varOpeningQty: number;
  varOpeningCost: number;
  /** Var vs opening as a % of theo usage, like the full table's Var %. */
  varPct: number;
  insightId?: string;
};

export function getQuickCountRows(sessionId: string): QuickCountRow[] {
  const session = COUNT_SESSIONS.find((s) => s.id === sessionId);
  if (!session || session.day === 0) return [];
  return session.itemIds.map((itemId) => {
    const m = MODELS[itemId];
    const row = COGS_VARIANCE_ROWS.find((r) => r.id === itemId)!;
    const sessions = countsOf(itemId);
    const prev = sessions[sessions.findIndex((s) => s.id === sessionId) - 1];
    const point = pointFor(m, session, prev);
    const mv = movementsBetween(m, 0, session.day);
    return {
      id: itemId,
      countDay: session.day,
      countKind: session.kind,
      name: row.name,
      productClass: row.productClass,
      packType: row.packType,
      unitCost: row.unitCost,
      openingStock: m.opening,
      purchases: mv.purchases,
      transfer: mv.transfer,
      waste: mv.waste,
      theoUsage: mv.theoUsage,
      expectedStock: expectedAt(m, session.day),
      countedStock: point.counted,
      stockValue: r2(point.counted * row.unitCost),
      prevCount: countedAt(m, prev.day),
      prevDay: prev.day,
      prevKind: prev.kind,
      varPrevQty: point.varPrevQty,
      varPrevCost: r2(point.varPrevQty * row.unitCost),
      varOpeningQty: point.varOpeningQty,
      varOpeningCost: r2(point.varOpeningQty * row.unitCost),
      varPct: mv.theoUsage > 0 ? r2((point.varOpeningQty / mv.theoUsage) * 100) : 0,
      insightId: row.insightId,
    };
  });
}

/** One row per product, from the most recent quick or group count that
 *  included it. Products are counted on different nights, so rows can
 *  come from different counts. */
export function getLatestCountRows(): QuickCountRow[] {
  const latest = new Map<string, QuickCountRow>();
  for (const s of QUICK_COUNT_SESSIONS) {
    for (const row of getQuickCountRows(s.id)) latest.set(row.id, row);
  }
  return Array.from(latest.values());
}

/** Net var cost vs previous across every product in a count. */
export function sessionVarPrevCost(sessionId: string): number {
  return getQuickCountRows(sessionId).reduce((a, r) => a + r.varPrevCost, 0);
}

/** Every count of one product this period, or null when it isn't in any
 *  quick or group count. */
export function getItemCountHistory(itemId: string): { unitCost: number; points: CountPoint[] } | null {
  const m = MODELS[itemId];
  const row = COGS_VARIANCE_ROWS.find((r) => r.id === itemId);
  if (!m || !row) return null;
  const sessions = countsOf(itemId);
  return { unitCost: row.unitCost, points: sessions.map((s, i) => pointFor(m, s, sessions[i - 1])) };
}
