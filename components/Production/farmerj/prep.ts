/**
 * Prep list: what the basement makes on a given day at a given shop.
 *
 * Three reasons something is on today's list:
 *   today     Made on the day for the day's plan (kits, chopped parsley).
 *   tomorrow  Made the day before it is used (chickpeas, cucumber prep).
 *   ahead     Shelf-life scheduled (dressings, mixes, pickled preps). Only
 *             on this shop's make-on days for the group, sized to cover
 *             every day until the next make-on day.
 *
 * Hot cooked components (the bags in the oven, the rice cookers) are not
 * prep. They are the day plan itself and appear as cook tasks on Sections.
 *
 * Quantities are in the component's own unit, which is what the team
 * writes on the label: batches for kits and cooked preps, kilos on the
 * 1 to 18 kg matrix for dressings and mixes, packs where you open the can
 * and prep the can, kilos net for per-kilo vegetable prep. The manager can
 * type over any of them; the order sheet follows the typed number.
 */

import { batchesLabel, batchesToNumber, explode, inputScale, roundComponent, type Consumer } from './cascade';
import { addDays, daysCoveredFrom, isProductionDay, weekdayOf } from './calendar';
import { deepCleanDaysFor, productionDaysFor } from './makeOn';
import { computeDayPlan, type DayRecord } from './FjPlanStore';
import {
  COMPONENTS,
  CONTAINERS,
  INGREDIENTS,
  SHELF_LIFE_GROUPS,
  type Component,
  type ShelfLifeGroup,
  type ShelfLifeGroupId,
} from './recipes';

export type PrepReason = 'today' | 'tomorrow' | 'ahead';

export type PrepUnit = {
  /** 'batch' | 'kg' | 'pack' */
  kind: 'batch' | 'kg' | 'pack';
  noun: string;
  plural: string;
  /** Grams of finished component per one unit. */
  gramsEach: number;
  step: number;
  min: number;
  max?: number;
};

export type PrepInput = {
  ref: string;
  name: string;
  kind: 'ingredient' | 'component';
  grams: number;
  packs?: number;
  packLabel?: string;
};

export type PrepLine = {
  componentId: string;
  component: Component;
  reason: PrepReason;
  group: ShelfLifeGroup;
  /** Days this make covers, ISO, starting with the make-on day. */
  covers: string[];
  netGrams: number;
  unit: PrepUnit;
  suggestedQty: number;
  plannedQty: number;
  overridden: boolean;
  gramsMade: number;
  grossGrams: number;
  containers?: { count: number; name: string };
  consumers: Consumer[];
  shared: boolean;
  inputs: PrepInput[];
};

export type PrepCard = {
  id: string;
  title: string;
  reason: PrepReason;
  group?: ShelfLifeGroup;
  covers: string[];
  lines: PrepLine[];
};

export type PrepDay = {
  shopId: string;
  date: string;
  lines: PrepLine[];
  cards: PrepCard[];
  totals: { items: number; gramsMade: number; overridden: number };
  /** Make-ahead groups and whether today is a make-on day for each here. */
  aheadGroups: { group: ShelfLifeGroup; makeOn: boolean; days: number[] }[];
};

type GetRecord = (shopId: string, date: string) => DayRecord;

function unitFor(c: Component): PrepUnit {
  const label = (c.batch.label ?? '').replace(/^(from )?one /, '').replace(/,.*$/, '').trim();
  switch (c.roundTo) {
    case 'kilo':
      return { kind: 'kg', noun: 'kg', plural: 'kg', gramsEach: 1000, step: 1, min: 1, max: 18 };
    case 'pack': {
      const noun = label || 'pack';
      return { kind: 'pack', noun, plural: `${noun}s`, gramsEach: c.batch.fullG, step: 1, min: 0 };
    }
    case 'exact':
      return { kind: 'kg', noun: 'kg', plural: 'kg', gramsEach: 1000, step: 0.5, min: 0 };
    case 'batch':
    default: {
      // Labels that describe the output ("one tray", "about 28 toasts")
      // are not a unit the person counts in; those round in batches.
      const noun = label && !/tray|pot|per |about|toast/.test(label) ? label : 'batch';
      return { kind: 'batch', noun, plural: noun === 'batch' ? 'batches' : `${noun}s`, gramsEach: c.batch.fullG, step: c.batch.halfG ? 0.5 : 1, min: 0 };
    }
  }
}

/** Rounded suggestion in the component's unit. */
function suggestedQtyFor(c: Component, unit: PrepUnit, netGrams: number): number {
  if (netGrams <= 0) return 0;
  const r = roundComponent(c, netGrams);
  if (unit.kind === 'kg') {
    if (c.roundTo === 'exact') return Math.round((netGrams / 1000) * 2) / 2 || 0.5;
    return r.matrixKg ?? Math.ceil(netGrams / 1000);
  }
  if (unit.kind === 'pack') return r.batches.full;
  return batchesToNumber(r.batches);
}

function inputsFor(c: Component, gramsMade: number): PrepInput[] {
  const scale = (gramsMade / c.batch.fullG) * inputScale(c);
  return c.inputs
    .map(l => {
      const grams = l.grams * scale;
      const sub = COMPONENTS[l.ref];
      if (sub) return { ref: l.ref, name: sub.name, kind: 'component' as const, grams };
      const ing = INGREDIENTS[l.ref];
      const packs = ing && ing.pack.size > 0 && ing.id !== 'water' ? Math.ceil(grams / ing.pack.size - 0.001) : undefined;
      return { ref: l.ref, name: ing?.name ?? l.ref, kind: 'ingredient' as const, grams, packs, packLabel: ing?.pack.label };
    })
    .filter(i => i.grams > 0);
}

export function qtyLabel(line: PrepLine, qty = line.plannedQty): string {
  const u = line.unit;
  if (u.kind === 'kg') return `${qty % 1 === 0 ? qty : qty.toFixed(1)} kg`;
  if (u.kind === 'batch' && u.noun === 'batch') {
    const full = Math.floor(qty);
    const half = qty - full >= 0.5 ? 1 : 0;
    return batchesLabel({ full, half });
  }
  return `${qty % 1 === 0 ? qty : qty.toFixed(1)} ${qty === 1 ? u.noun : u.plural}`;
}

export function computePrepDay(shopId: string, date: string, getRecord: GetRecord): PrepDay {
  const planFor = (d: string) => computeDayPlan(shopId, d, getRecord(shopId, d), getRecord(shopId, addDays(d, -1)).close);
  const explosionCache = new Map<string, ReturnType<typeof explode>>();
  const explosionFor = (d: string) => {
    if (!explosionCache.has(d)) explosionCache.set(d, planFor(d).explosion);
    return explosionCache.get(d)!;
  };

  const record = getRecord(shopId, date);
  const overrides = record.prepOverrides ?? {};
  const today = explosionFor(date);
  const tomorrow = explosionFor(addDays(date, 1));
  const lines: PrepLine[] = [];

  const build = (c: Component, reason: PrepReason, covers: string[], netGrams: number, consumers: Consumer[]): PrepLine | null => {
    if (netGrams <= 0) return null;
    const unit = unitFor(c);
    const suggestedQty = suggestedQtyFor(c, unit, netGrams);
    const override = overrides[c.id];
    const plannedQty = override ?? suggestedQty;
    const gramsMade = plannedQty * unit.gramsEach;
    const grossGrams = c.inputs.reduce((n, l) => n + l.grams, 0) * (gramsMade / c.batch.fullG) * inputScale(c);
    const containers = c.container && c.containersPerBatch
      ? { count: Math.ceil((gramsMade / c.batch.fullG) * c.containersPerBatch - 0.001), name: CONTAINERS[c.container].name }
      : undefined;
    return {
      componentId: c.id, component: c, reason, group: SHELF_LIFE_GROUPS[c.shelfLife], covers, netGrams, unit,
      suggestedQty, plannedQty, overridden: override !== undefined, gramsMade, grossGrams, containers,
      consumers, shared: consumers.length > 1, inputs: inputsFor(c, gramsMade),
    };
  };

  for (const c of Object.values(COMPONENTS)) {
    if (c.section === 'hot') continue;
    if (c.when === 'on-day') {
      const need = today.components[c.id];
      if (need) { const l = build(c, 'today', [date], need.netGrams, need.consumers); if (l) lines.push(l); }
    } else if (c.when === 'day-before') {
      const need = tomorrow.components[c.id];
      if (need) { const l = build(c, 'tomorrow', [addDays(date, 1)], need.netGrams, need.consumers); if (l) lines.push(l); }
    } else {
      if (!isProductionDay(shopId, c.shelfLife, date)) continue;
      const covers = daysCoveredFrom(shopId, c.shelfLife, date);
      let net = 0;
      const consumers: Consumer[] = [];
      for (const d of covers) {
        const need = explosionFor(d).components[c.id];
        if (!need) continue;
        net += need.netGrams;
        for (const k of need.consumers) {
          const ex = consumers.find(x => x.ref === k.ref);
          if (ex) ex.grams += k.grams; else consumers.push({ ...k });
        }
      }
      const l = build(c, 'ahead', covers, net, consumers);
      if (l) lines.push(l);
    }
  }

  const kindOrder = ['kit', 'cooked', 'prep', 'dressing', 'mix'];
  lines.sort((a, b) => kindOrder.indexOf(a.component.kind) - kindOrder.indexOf(b.component.kind) || a.component.name.localeCompare(b.component.name));

  const cards: PrepCard[] = [];
  const todayLines = lines.filter(l => l.reason === 'today');
  const tomorrowLines = lines.filter(l => l.reason === 'tomorrow');
  if (todayLines.length) cards.push({ id: 'today', title: 'For today', reason: 'today', covers: [date], lines: todayLines });
  if (tomorrowLines.length) cards.push({ id: 'tomorrow', title: 'For tomorrow', reason: 'tomorrow', covers: [addDays(date, 1)], lines: tomorrowLines });
  const aheadOrder: ShelfLifeGroupId[] = ['coconut2', 'green3', 'blue4', 'weekly'];
  for (const g of aheadOrder) {
    const gl = lines.filter(l => l.reason === 'ahead' && l.component.shelfLife === g);
    if (!gl.length) continue;
    cards.push({ id: g, title: SHELF_LIFE_GROUPS[g].label, reason: 'ahead', group: SHELF_LIFE_GROUPS[g], covers: gl[0].covers, lines: gl });
  }

  const aheadGroups = aheadOrder.map(g => ({
    group: SHELF_LIFE_GROUPS[g],
    makeOn: isProductionDay(shopId, g, date),
    days: productionDaysFor(shopId, g).filter(d => !deepCleanDaysFor(shopId).includes(d) || g === 'daily'),
  }));

  return {
    shopId, date, lines, cards,
    totals: { items: lines.length, gramsMade: lines.reduce((n, l) => n + l.gramsMade, 0), overridden: lines.filter(l => l.overridden).length },
    aheadGroups,
  };
}

export function isDeepClean(shopId: string, date: string): boolean {
  return deepCleanDaysFor(shopId).includes(weekdayOf(date));
}
