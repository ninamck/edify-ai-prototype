import { costPerKgOf, gramsPerMainUnit, portionsPerMainUnit, type ProductPlan } from './cascade';
import { addDays, weekdayLabel } from './calendar';
import { computeDayPlan, type CloseCount, type DayRecord } from './FjPlanStore';
import { COMPONENTS, CONTAINERS, SHELF_LIFE_GROUPS, type Component, type FinishedProduct } from './recipes';

/**
 * End-of-day close. The closing manager counts what is left of each cooked
 * or assembled component in the fridge, in the same container the line
 * uses, and anything binned is logged by reason. The count is written to
 * the day record as `close`, and `computeDayPlan` for the next day takes it
 * off the main line.
 *
 * Rules seeded here:
 *  - Only components flagged `carryable` in the recipe book are counted.
 *    Dressed salads (two-hour hold) and fish are listed under "Not carried"
 *    so the rule stays visible.
 *  - Expected leftover = what was made (plus what came in from last night)
 *    minus what the reference days say sold. Edify drafts the count from
 *    that; the manager types over it.
 *  - Waste is priced at ingredient cost so the summary can show pounds.
 *  - Use-by comes from the component's shelf-life group: a daily item
 *    counted tonight is good for tomorrow only.
 */

export type CloseLine = {
  productId: string;
  product: FinishedProduct;
  component: Component;
  plan: ProductPlan;
  carryable: boolean;
  /** Grams made today plus grams that came in from last night. */
  availableGrams: number;
  /** Grams the reference days say sold (after flex, with catering). */
  soldGrams: number;
  expectedGrams: number;
  /** Expected leftover in main-line containers, to the nearest half. */
  expectedUnits: number;
  unitName: string;
  gramsPerUnit: number;
  portionsPerUnit: number;
  /** "tomorrow" or a weekday when the component keeps longer. */
  useBy: string;
  /** Why an item is not carried. */
  notCarriedReason?: string;
};

export type CloseDraft = {
  /** Containers counted per product. */
  counted: Record<string, number>;
  /** Containers binned per product, with a reason. */
  binned: Record<string, { units: number; reason: string }>;
};

export const WASTE_REASONS = ['Over-production', 'End of shelf life', 'Dropped or spoiled', 'Quality'] as const;

type GetRecord = (shopId: string, date: string) => DayRecord;

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

function expiryLabel(component: Component, date: string): string {
  const group = SHELF_LIFE_GROUPS[component.shelfLife];
  // Group days include the make-on day; tonight's count is day 1 gone.
  const daysLeft = Math.max(1, group.days - 1);
  if (daysLeft <= 1) return 'tomorrow';
  return weekdayLabel(addDays(date, daysLeft));
}

export function computeCloseDay(shopId: string, date: string, getRecord: GetRecord) {
  const record = getRecord(shopId, date);
  const plan = computeDayPlan(shopId, date, record, getRecord(shopId, addDays(date, -1)).close);
  const lines: CloseLine[] = [];
  for (const p of plan.plans) {
    if (!p.product.countedAs) continue;
    const component = COMPONENTS[p.product.countedAs];
    if (!component) continue;
    const availableGrams = p.gramsMade + p.carriedGrams;
    if (availableGrams <= 0) continue;
    const soldGrams = p.referenceGrams * (1 + p.flexPct / 100) + p.cateringGrams;
    const expectedGrams = Math.max(0, availableGrams - soldGrams);
    const gramsPerUnit = gramsPerMainUnit(p.product);
    // Salads are counted as their undressed kit: the kit keeps, the dressed
    // salad does not, so `countedAs` points at the kit.
    const carryable = component.carryable;
    lines.push({
      productId: p.productId,
      product: p.product,
      component,
      plan: p,
      carryable,
      availableGrams,
      soldGrams,
      expectedGrams,
      expectedUnits: carryable ? roundHalf(expectedGrams / gramsPerUnit) : 0,
      unitName: CONTAINERS[p.product.unit].name,
      gramsPerUnit,
      portionsPerUnit: portionsPerMainUnit(p.product),
      useBy: expiryLabel(component, date),
      notCarriedReason: carryable
        ? undefined
        : component.holdMinutes && component.holdMinutes <= 60
          ? `${component.holdMinutes}-minute hold, not kept overnight`
          : 'Not carried by recipe',
    });
  }
  const order = ['hot', 'salads', 'prep', 'second'];
  lines.sort((a, b) => order.indexOf(a.product.section) - order.indexOf(b.product.section) || a.product.name.localeCompare(b.product.name));
  return {
    plan,
    lines: lines.filter(l => l.carryable),
    notCarried: lines.filter(l => !l.carryable),
  };
}

/** Edify's draft: expected leftover in every carryable line, nothing binned. */
export function draftFromExpected(lines: CloseLine[]): CloseDraft {
  const counted: Record<string, number> = {};
  for (const l of lines) counted[l.productId] = l.expectedUnits;
  return { counted, binned: {} };
}

/** Rebuild a draft from a saved count so the manager can reopen it. */
export function draftFromClose(lines: CloseLine[], close: CloseCount): CloseDraft {
  const counted: Record<string, number> = {};
  const binned: CloseDraft['binned'] = {};
  for (const l of lines) {
    const c = close.carried[l.productId];
    counted[l.productId] = c === undefined ? 0 : roundHalf(c / l.gramsPerUnit);
    const b = close.binned[l.productId];
    if (b) binned[l.productId] = { units: roundHalf(b.grams / l.gramsPerUnit), reason: b.reason };
  }
  return { counted, binned };
}

export function draftToCloseCount(lines: CloseLine[], draft: CloseDraft, countedBy: string, nowISO = new Date().toISOString()): CloseCount {
  const carried: Record<string, number> = {};
  const binned: CloseCount['binned'] = {};
  for (const l of lines) {
    const units = draft.counted[l.productId] ?? 0;
    if (units > 0) carried[l.productId] = Math.round(units * l.gramsPerUnit);
    const b = draft.binned[l.productId];
    if (b && b.units > 0) binned[l.productId] = { grams: Math.round(b.units * l.gramsPerUnit), reason: b.reason };
  }
  return { carried, binned, countedAtISO: nowISO, countedBy };
}

export type CloseTotals = {
  carriedUnits: number;
  carriedPortions: number;
  binnedUnits: number;
  wastePounds: number;
  /** Main-line containers tomorrow's plan drops because of the count. */
  tomorrowDelta: number;
};

/**
 * What tonight's count does to tomorrow. Tomorrow's plan is computed twice,
 * with and without the carried grams, and the main-line containers compared
 * per product.
 */
export function tomorrowEffect(shopId: string, date: string, getRecord: GetRecord, lines: CloseLine[], draft: CloseDraft) {
  const tomorrow = addDays(date, 1);
  const rec = getRecord(shopId, tomorrow);
  const before = computeDayPlan(shopId, tomorrow, rec, undefined);
  const after = computeDayPlan(shopId, tomorrow, rec, draftToCloseCount(lines, draft, 'draft'));
  const byProduct: Record<string, { before: number; after: number; unitName: string }> = {};
  for (const p of before.plans) {
    const a = after.plans.find(x => x.productId === p.productId);
    byProduct[p.productId] = { before: p.main.plannedUnits, after: a?.main.plannedUnits ?? p.main.plannedUnits, unitName: p.main.unitName };
  }
  return { tomorrow, before, after, byProduct };
}

export function closeTotals(lines: CloseLine[], draft: CloseDraft, effect: ReturnType<typeof tomorrowEffect>): CloseTotals {
  let carriedUnits = 0;
  let carriedPortions = 0;
  let binnedUnits = 0;
  let wastePounds = 0;
  for (const l of lines) {
    const c = draft.counted[l.productId] ?? 0;
    carriedUnits += c;
    carriedPortions += Math.round(c * l.portionsPerUnit);
    const b = draft.binned[l.productId];
    if (b) {
      binnedUnits += b.units;
      wastePounds += (b.units * l.gramsPerUnit / 1000) * costPerKgOf(l.component.id);
    }
  }
  const tomorrowDelta = Object.values(effect.byProduct).reduce((n, x) => n + (x.after - x.before), 0);
  return { carriedUnits, carriedPortions, binnedUnits, wastePounds, tomorrowDelta };
}

export function unitsLabel(units: number, unitName: string): string {
  const noun = unitName.toLowerCase();
  const whole = Math.floor(units);
  const n = units % 1 === 0 ? String(units) : whole === 0 ? '½' : `${whole}½`;
  return `${n} ${units === 1 ? noun : `${noun}s`}`;
}
