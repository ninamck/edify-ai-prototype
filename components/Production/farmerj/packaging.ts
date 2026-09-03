import { addDays } from './calendar';
import { boxesByFormat } from './catering';
import { computeDayPlan, type DayRecord } from './FjPlanStore';
import { PRODUCTS } from './recipes';
import type { SalesChannel } from './salesDay';

/**
 * Packaging on the order sheet.
 *
 * ProMap carried packaging in the bill of materials next to food: glassine
 * bags, 12 oz pots and lids, Deliveroo bags and catering boxes, all from
 * Packaging Environmental with an 11:00 cut-off. Our order sheet was food
 * only. This module counts packaging the same way the plan counts food,
 * from the trays and portions the shop expects to sell on the days the
 * delivery covers, times the day's flex, plus the boxes the catering orders
 * on those days need.
 *
 * Counts are per tray or per portion, never per gram, so they come off the
 * demand model rather than the recipe cascade. Item list, pack sizes and
 * prices are demo-modelled; Ed swaps in the real catalogue.
 */

export type PackagingId =
  | 'fieldtray-box'
  | 'fieldtray-lid'
  | 'pot-12oz'
  | 'lid-12oz'
  | 'glassine-bag'
  | 'deliveroo-bag'
  | 'catering-box-x4'
  | 'catering-box-x6';

export type PackagingItem = {
  id: PackagingId;
  name: string;
  /** Units in one case, the unit the supplier sells. */
  caseSize: number;
  caseLabel: string;
  costPerCase: number;
  /** Plain-words rule for the "why this number" drawer. */
  rule: string;
};

export const PACKAGING_SUPPLIER = 'Packaging Environmental';

export const PACKAGING: Record<PackagingId, PackagingItem> = {
  'fieldtray-box':   { id: 'fieldtray-box',   name: 'Fieldtray box',        caseSize: 200,  caseLabel: 'case of 200',  costPerCase: 38, rule: 'one per tray sold, every channel' },
  'fieldtray-lid':   { id: 'fieldtray-lid',   name: 'Fieldtray lid',        caseSize: 200,  caseLabel: 'case of 200',  costPerCase: 16, rule: 'one per tray sold, every channel' },
  'pot-12oz':        { id: 'pot-12oz',        name: '12 oz pot',            caseSize: 500,  caseLabel: 'case of 500',  costPerCase: 45, rule: 'one per breakfast pot and per sauce or pickle sold on its own' },
  'lid-12oz':        { id: 'lid-12oz',        name: '12 oz lid',            caseSize: 500,  caseLabel: 'case of 500',  costPerCase: 25, rule: 'one per 12 oz pot' },
  'glassine-bag':    { id: 'glassine-bag',    name: 'Glassine bag',         caseSize: 1000, caseLabel: 'case of 1000', costPerCase: 30, rule: 'one per hand-held breakfast item (toast, roll)' },
  'deliveroo-bag':   { id: 'deliveroo-bag',   name: 'Delivery bag',         caseSize: 250,  caseLabel: 'case of 250',  costPerCase: 55, rule: 'one per Deliveroo or Click & Collect order, about 1.6 trays an order' },
  'catering-box-x4': { id: 'catering-box-x4', name: 'Catering box, X4',     caseSize: 50,   caseLabel: 'case of 50',   costPerCase: 55, rule: 'one per X4 box on the catering orders for the day' },
  'catering-box-x6': { id: 'catering-box-x6', name: 'Catering box, X6',     caseSize: 25,   caseLabel: 'case of 25',   costPerCase: 40, rule: 'one per X6 box on the catering orders for the day' },
};

export const PACKAGING_ORDER: PackagingId[] = [
  'fieldtray-box', 'fieldtray-lid', 'pot-12oz', 'lid-12oz', 'glassine-bag', 'deliveroo-bag', 'catering-box-x4', 'catering-box-x6',
];

const TRAYS_PER_DELIVERY_ORDER = 1.6;
const BAGGED_CHANNELS: ReadonlySet<SalesChannel> = new Set<SalesChannel>(['deliveroo', 'clickcollect']);

const POT_PRODUCTS = new Set(PRODUCTS.filter(p => p.unit === 'breakfast-pot').map(p => p.id));
const BAGGED_PRODUCTS = new Set(PRODUCTS.filter(p => p.group === 'breakfast' && p.unit === 'portion').map(p => p.id));

export type PackagingDay = { date: string; units: Record<PackagingId, number>; trays: number; flexPct: number };

export type PackagingNeed = {
  item: PackagingItem;
  units: number;
  /** Units without the flex, so an edited day shows what changed. */
  suggestedUnits: number;
  perDay: PackagingDay[];
  /** One line of derivation per driver, for the "why this number" drawer. */
  drivers: string[];
};

type GetRecord = (shopId: string, date: string) => DayRecord;

function emptyUnits(): Record<PackagingId, number> {
  return Object.fromEntries(PACKAGING_ORDER.map(id => [id, 0])) as Record<PackagingId, number>;
}

/** Packaging one shop-day needs, from its plan's demand, flex and catering. */
export function packagingForDay(shopId: string, date: string, getRecord: GetRecord): PackagingDay {
  const plan = computeDayPlan(shopId, date, getRecord(shopId, date), getRecord(shopId, addDays(date, -1)).close);
  const flex = 1 + plan.record.flexPct / 100;
  const units = emptyUnits();

  let trays = 0;
  let bagged = 0;
  for (const byCh of Object.values(plan.demand.traysByHour)) {
    for (const [ch, n] of Object.entries(byCh) as [SalesChannel, number][]) {
      trays += n;
      if (BAGGED_CHANNELS.has(ch)) bagged += n;
    }
  }
  trays = Math.round(trays * flex);
  bagged = Math.round(bagged * flex);

  units['fieldtray-box'] = trays;
  units['fieldtray-lid'] = trays;
  units['deliveroo-bag'] = Math.ceil(bagged / TRAYS_PER_DELIVERY_ORDER);

  let pots = 0;
  let handHeld = 0;
  for (const d of Object.values(plan.demand.products)) {
    if (POT_PRODUCTS.has(d.productId)) pots += d.portions;
    if (BAGGED_PRODUCTS.has(d.productId)) handHeld += d.portions;
  }
  for (const c of Object.values(plan.demand.components)) pots += c.portions;
  units['pot-12oz'] = Math.round(pots * flex);
  units['lid-12oz'] = units['pot-12oz'];
  units['glassine-bag'] = Math.round(handHeld * flex);

  const boxes = boxesByFormat(plan.activeOrders);
  units['catering-box-x4'] = boxes.x4;
  units['catering-box-x6'] = boxes.x6;

  return { date, units, trays, flexPct: plan.record.flexPct };
}

/** Packaging needs across the days a delivery covers, one entry per item with any demand. */
export function computePackagingNeeds(shopId: string, days: string[], getRecord: GetRecord): PackagingNeed[] {
  const perDay = days.map(d => packagingForDay(shopId, d, getRecord));
  const out: PackagingNeed[] = [];
  for (const id of PACKAGING_ORDER) {
    const units = perDay.reduce((n, d) => n + d.units[id], 0);
    if (units <= 0) continue;
    const suggestedUnits = perDay.reduce((n, d) => {
      const flex = 1 + d.flexPct / 100;
      const isCatering = id === 'catering-box-x4' || id === 'catering-box-x6';
      return n + (isCatering || flex === 0 ? d.units[id] : Math.round(d.units[id] / flex));
    }, 0);
    out.push({ item: PACKAGING[id], units, suggestedUnits, perDay, drivers: driversFor(id, perDay) });
  }
  return out;
}

function driversFor(id: PackagingId, perDay: PackagingDay[]): string[] {
  const item = PACKAGING[id];
  const out = [`Rule: ${item.rule}`];
  const trays = perDay.reduce((n, d) => n + d.trays, 0);
  if (id === 'fieldtray-box' || id === 'fieldtray-lid') out.push(`${trays} trays expected across ${perDay.length} day${perDay.length === 1 ? '' : 's'}, after flex`);
  const flexed = perDay.filter(d => d.flexPct !== 0);
  for (const d of flexed) out.push(`${d.date.slice(5)} flex ${d.flexPct > 0 ? '+' : ''}${d.flexPct}% applied`);
  return out;
}

/** Cases to order once the shelf count is taken off, never negative. */
export function casesFor(item: PackagingItem, units: number, onHandCases: number): number {
  return Math.max(0, Math.ceil((units - onHandCases * item.caseSize) / item.caseSize - 0.001));
}
