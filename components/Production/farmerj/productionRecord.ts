import { batchesToNumber, fullBatchGrams, portionsOf, productCostPerKg, type ProductPlan } from './cascade';
import { addDays } from './calendar';
import { computeDayPlan, type DayRecord, type MadeEntry } from './FjPlanStore';
import { PRODUCT_GROUP_LABELS, type FinishedProduct, type ProductGroup } from './recipes';
import { daySales, secondLineNet, type DayDemand } from './sales';
import { computeSectionsDay, type SectionTask } from './sections';

/**
 * Production control record: one row per finished product for a shop-day,
 * planned against made against sold, with who made it and what was left.
 * The ProMap workbook kept this as a printed sheet the kitchen filled in
 * by hand (planned, actual made, carry over, initials). Here it fills
 * itself:
 *
 *   Planned      the approved day plan's batches and containers
 *   Made         the batches recorded when each task was ticked on
 *                Sections (planned unless the person corrected it)
 *   Carried in   last night's count, off this morning's plan
 *   Sold         the till, for the date (Marylebone today is the real
 *                export; every other shop-day is modelled)
 *   Left         tonight's close count, carried and binned
 *   Variance     made + carried in − sold − left − binned. Positive is
 *                food nobody can account for; negative means the line
 *                sold more than the record says was made.
 */

export type RecordLine = {
  productId: string;
  product: FinishedProduct;
  group: ProductGroup;
  plan: ProductPlan;
  plannedBatches: number;
  plannedUnits: number;
  plannedGrams: number;
  /** Tasks on Sections that make this product, and how many are ticked. */
  tasks: number;
  ticked: number;
  /** Batches recorded as made, when at least one task is ticked. */
  madeBatches?: number;
  madeGrams: number;
  carriedInGrams: number;
  soldGrams: number;
  soldPortions: number;
  soldNet: number;
  closeCarriedGrams?: number;
  closeBinnedGrams?: number;
  /** Grams unaccounted for once the close is in. */
  varianceGrams?: number;
  variancePounds?: number;
  who: string[];
  lastTickISO?: string;
};

export type ProductionRecord = {
  shopId: string;
  date: string;
  lines: RecordLine[];
  groups: { group: ProductGroup; label: string; lines: RecordLine[] }[];
  sales: DayDemand;
  approved: boolean;
  approvedBy?: string;
  closed: boolean;
  closedBy?: string;
  closedAtISO?: string;
  totals: {
    plannedBatches: number;
    madeBatches: number;
    tasks: number;
    ticked: number;
    plannedPortions: number;
    madePortions: number;
    soldPortions: number;
    soldNet: number;
    secondLineShare: number;
    trays: number;
    leftPortions: number;
    binnedPortions: number;
    variancePortions?: number;
    variancePounds?: number;
    wastePounds: number;
  };
};

type GetRecord = (shopId: string, date: string) => DayRecord;

const GROUP_ORDER: ProductGroup[] = ['breakfast', 'bases', 'proteins', 'hot-sides', 'salads'];

/** Tasks whose tick records batches of this product. */
function tasksFor(p: ProductPlan, tasks: SectionTask[]): SectionTask[] {
  return tasks.filter(t =>
    (t.kind === 'cook' && t.productId === p.productId) ||
    ((t.kind === 'kit' || t.kind === 'prep') && t.componentId !== undefined && t.componentId === p.product.countedAs && t.slot === 'am'),
  );
}

export function computeProductionRecord(shopId: string, date: string, getRecord: GetRecord, isToday: boolean): ProductionRecord {
  const record = getRecord(shopId, date);
  const yesterday = getRecord(shopId, addDays(date, -1));
  const plan = computeDayPlan(shopId, date, record, yesterday.close);
  const sections = computeSectionsDay(shopId, date, getRecord, isToday);
  const sales = daySales(shopId, date);
  const made: Record<string, MadeEntry> = record.made ?? {};
  const ticks = record.ticks ?? {};
  const close = record.close;

  const lines: RecordLine[] = plan.plans.map(p => {
    const mine = tasksFor(p, sections.tasks);
    const tickedTasks = mine.filter(t => ticks[t.id]);
    const batchG = fullBatchGrams(p.product);
    const plannedBatches = batchesToNumber(p.batches);
    let madeBatches: number | undefined;
    if (tickedTasks.length) {
      // Ticked tasks say what they made; untouched tasks count as their plan
      // once the first tick is in, so a half-finished day still reads.
      madeBatches = mine.reduce((n, t) => n + (ticks[t.id] ? (made[t.id]?.batches ?? t.batches ?? 0) : (t.batches ?? 0)), 0);
      if (mine.every(t => t.batches === undefined)) madeBatches = plannedBatches;
    }
    const madeGrams = (madeBatches ?? 0) * batchG;
    const sold = sales.products[p.productId];
    const soldGrams = sold?.grams ?? 0;
    const closeCarriedGrams = close ? close.carried[p.productId] ?? 0 : undefined;
    const closeBinnedGrams = close ? close.binned[p.productId]?.grams ?? 0 : undefined;
    const varianceGrams = close && madeBatches !== undefined
      ? madeGrams + p.carriedGrams - soldGrams - (closeCarriedGrams ?? 0) - (closeBinnedGrams ?? 0)
      : undefined;
    const who = Array.from(new Set(tickedTasks.map(t => made[t.id]?.by).filter((s): s is string => Boolean(s))));
    const lastTickISO = tickedTasks.map(t => ticks[t.id]).sort().pop();
    return {
      productId: p.productId,
      product: p.product,
      group: p.product.group,
      plan: p,
      plannedBatches,
      plannedUnits: p.lines.reduce((n, l) => n + l.plannedUnits, 0),
      plannedGrams: p.gramsMade,
      tasks: mine.length,
      ticked: tickedTasks.length,
      madeBatches,
      madeGrams,
      carriedInGrams: p.carriedGrams,
      soldGrams,
      soldPortions: Math.round(sold?.portions ?? 0),
      soldNet: sold?.net ?? 0,
      closeCarriedGrams,
      closeBinnedGrams,
      varianceGrams,
      variancePounds: varianceGrams !== undefined ? (varianceGrams / 1000) * productCostPerKg(p.productId) : undefined,
      who,
      lastTickISO,
    };
  });

  lines.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.product.name.localeCompare(b.product.name));
  const groups = GROUP_ORDER.map(g => ({ group: g, label: PRODUCT_GROUP_LABELS[g], lines: lines.filter(l => l.group === g) })).filter(g => g.lines.length);

  const portions = (l: RecordLine, grams: number) => portionsOf(l.product, grams);
  const withVariance = lines.filter(l => l.varianceGrams !== undefined);
  const totals = {
    plannedBatches: lines.reduce((n, l) => n + l.plannedBatches, 0),
    madeBatches: lines.reduce((n, l) => n + (l.madeBatches ?? 0), 0),
    tasks: lines.reduce((n, l) => n + l.tasks, 0),
    ticked: lines.reduce((n, l) => n + l.ticked, 0),
    plannedPortions: lines.reduce((n, l) => n + portions(l, l.plannedGrams), 0),
    madePortions: lines.reduce((n, l) => n + portions(l, l.madeGrams), 0),
    soldPortions: lines.reduce((n, l) => n + l.soldPortions, 0),
    soldNet: sales.net,
    secondLineShare: sales.net > 0 ? secondLineNet(sales) / sales.net : 0,
    trays: Math.round(sales.trays),
    leftPortions: lines.reduce((n, l) => n + portions(l, l.closeCarriedGrams ?? 0), 0),
    binnedPortions: lines.reduce((n, l) => n + portions(l, l.closeBinnedGrams ?? 0), 0),
    variancePortions: withVariance.length ? withVariance.reduce((n, l) => n + portions(l, l.varianceGrams ?? 0), 0) : undefined,
    variancePounds: withVariance.length ? withVariance.reduce((n, l) => n + (l.variancePounds ?? 0), 0) : undefined,
    wastePounds: lines.reduce((n, l) => n + ((l.closeBinnedGrams ?? 0) / 1000) * productCostPerKg(l.productId), 0),
  };

  return {
    shopId,
    date,
    lines,
    groups,
    sales,
    approved: plan.approved,
    approvedBy: record.approvedBy,
    closed: Boolean(close),
    closedBy: close?.countedBy,
    closedAtISO: close?.countedAtISO,
    totals,
  };
}

/** "3" or "2½" for a batch count. */
export function batchesText(n: number | undefined): string {
  if (n === undefined) return '—';
  if (n % 1 === 0) return `${n}`;
  return `${Math.floor(n) || ''}½`;
}
