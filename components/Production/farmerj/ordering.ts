import { batchesLabel, batchesToNumber, inputScale, type Batches } from './cascade';
import { addDays, isShopOpen, planningWindowFor, weekdayLabel, type PlanningWindow } from './calendar';
import { computeDayPlan, type DayRecord } from './FjPlanStore';
import { computePrepDay, qtyLabel } from './prep';
import { INGREDIENTS, type Component, type ComponentKind, type Ingredient } from './recipes';

/**
 * Ingredient needs for a set of days, derived from the plan cascade.
 *
 * Grams come from the make list rather than straight from the cascade, so
 * an override on a prep line changes the order: if the manager typed 13
 * bags of parsley, the order says 13. Hot-section components (rice, roast
 * veg) are not on the prep list; their inputs are taken from the day plan's
 * cascade directly. Water is left out.
 *
 * `computeOrderSheet` is the window view (what to make per day, what to
 * order per supplier). Predictive ordering uses `computeIngredientNeeds`
 * per supplier delivery cycle instead.
 */

export type PrepEdit = { date: string; component: string; planned: string; suggested: string };

export type IngredientNeed = {
  ingredientId: string;
  ingredient: Ingredient;
  grams: number;
  /** Grams before any prep-list override. */
  suggestedGrams: number;
  perDay: Record<string, number>;
  /** Component names that use it, most grams first. */
  usedBy: string[];
  /** Components with trim loss that consume it, for the "why" copy. */
  lossFrom: { component: string; pct: number }[];
  edits: PrepEdit[];
};

type GetRecord = (shopId: string, date: string) => DayRecord;

export function computeIngredientNeeds(shopId: string, days: string[], getRecord: GetRecord): Record<string, IngredientNeed> {
  const needs: Record<string, IngredientNeed> = {};
  const usedGrams: Record<string, Record<string, number>> = {};

  const add = (ref: string, date: string, grams: number, suggestedGrams: number, from: Component | string) => {
    const ing = INGREDIENTS[ref];
    if (!ing || grams <= 0 || ing.supplier === 'Tap') return;
    const e = (needs[ref] ??= { ingredientId: ref, ingredient: ing, grams: 0, suggestedGrams: 0, perDay: {}, usedBy: [], lossFrom: [], edits: [] });
    e.grams += grams;
    e.suggestedGrams += suggestedGrams;
    e.perDay[date] = (e.perDay[date] ?? 0) + grams;
    const name = typeof from === 'string' ? from : from.name;
    const u = (usedGrams[ref] ??= {});
    u[name] = (u[name] ?? 0) + grams;
    if (typeof from !== 'string' && from.yieldLossPct > 0 && !e.lossFrom.some(l => l.component === from.name)) {
      e.lossFrom.push({ component: from.name, pct: from.yieldLossPct });
    }
  };

  for (const date of days) {
    if (!isShopOpen(shopId, date)) continue;
    const record = getRecord(shopId, date);
    const prep = computePrepDay(shopId, date, getRecord);
    for (const l of prep.lines) {
      const suggestedScale = l.overridden && l.gramsMade > 0 ? (l.suggestedQty * l.unit.gramsEach) / l.gramsMade : 1;
      for (const i of l.inputs) {
        if (i.kind !== 'ingredient') continue;
        add(i.ref, date, i.grams, i.grams * suggestedScale, l.component);
        if (l.overridden) {
          const e = needs[i.ref];
          if (e && !e.edits.some(x => x.date === date && x.component === l.component.name)) {
            e.edits.push({ date, component: l.component.name, planned: qtyLabel(l), suggested: qtyLabel(l, l.suggestedQty) });
          }
        }
      }
    }
    const plan = computeDayPlan(shopId, date, record, getRecord(shopId, addDays(date, -1)).close);
    for (const need of Object.values(plan.explosion.components)) {
      if (need.component.section !== 'hot' || need.gramsMade <= 0) continue;
      const scale = (need.gramsMade / need.component.batch.fullG) * inputScale(need.component);
      for (const inp of need.component.inputs) {
        if (INGREDIENTS[inp.ref]) add(inp.ref, date, inp.grams * scale, inp.grams * scale, need.component);
      }
    }
    for (const p of plan.plans) {
      const b = batchesToNumber(p.batches);
      if (b <= 0) continue;
      for (const line of p.product.recipe) {
        if (INGREDIENTS[line.ref]) add(line.ref, date, line.grams * b, line.grams * b, p.product.name);
      }
    }
  }

  for (const e of Object.values(needs)) {
    e.usedBy = Object.entries(usedGrams[e.ingredientId] ?? {}).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }
  return needs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Window view (what to make per day, what to order per supplier)
// ─────────────────────────────────────────────────────────────────────────────

export type MakeCell = { qtyLabel: string; gramsMade: number; overridden: boolean; suggestedLabel?: string };

export type MakeLine = {
  componentId: string;
  component: Component;
  perDay: Record<string, MakeCell>;
  totalGramsMade: number;
  overridden: boolean;
};

export type MakeGroup = { kind: ComponentKind; label: string; lines: MakeLine[] };

export type OrderLine = {
  ingredientId: string;
  ingredient: Ingredient;
  grams: number;
  packs: number;
  usedBy: string[];
  /** True when a prep-list override changed the figure. */
  overridden: boolean;
  suggestedPacks: number;
};

export type SupplierGroup = { supplier: string; lines: OrderLine[]; packs: number };

export type OrderSheet = {
  shopId: string;
  window: PlanningWindow;
  days: string[];
  make: MakeGroup[];
  order: SupplierGroup[];
  totals: { makeLines: number; ingredients: number; packs: number; overridden: number; costPounds: number };
};

const KIND_ORDER: ComponentKind[] = ['cooked', 'kit', 'prep', 'dressing', 'mix'];
const KIND_LABELS: Record<ComponentKind, string> = {
  cooked: 'Cooked on the day',
  kit: 'Kits',
  prep: 'Prep',
  dressing: 'Dressings',
  mix: 'Mixes',
};

/** Three windows from a date: the one it is in, then the next two. */
export function windowsFrom(date: string, count = 3): PlanningWindow[] {
  const out: PlanningWindow[] = [];
  let cursor = date;
  for (let i = 0; i < count; i++) {
    const w = planningWindowFor(cursor);
    out.push(w);
    cursor = addDays(w.to, 1);
  }
  return out;
}

export function computeOrderSheet(shopId: string, window: PlanningWindow, getRecord: GetRecord): OrderSheet {
  const days = window.days.filter(d => isShopOpen(shopId, d));
  const makeById: Record<string, MakeLine> = {};
  const cell = (id: string, c: Component, date: string, mc: MakeCell) => {
    const line = (makeById[id] ??= { componentId: id, component: c, perDay: {}, totalGramsMade: 0, overridden: false });
    line.perDay[date] = mc;
    line.totalGramsMade += mc.gramsMade;
    if (mc.overridden) line.overridden = true;
  };

  for (const date of days) {
    const prep = computePrepDay(shopId, date, getRecord);
    for (const l of prep.lines) {
      cell(l.componentId, l.component, date, {
        qtyLabel: qtyLabel(l),
        gramsMade: l.gramsMade,
        overridden: l.overridden,
        suggestedLabel: l.overridden ? qtyLabel(l, l.suggestedQty) : undefined,
      });
    }
    const plan = computeDayPlan(shopId, date, getRecord(shopId, date), getRecord(shopId, addDays(date, -1)).close);
    for (const need of Object.values(plan.explosion.components)) {
      if (need.component.section !== 'hot' || need.gramsMade <= 0) continue;
      cell(need.componentId, need.component, date, { qtyLabel: hotLabel(need.component, need.batches), gramsMade: need.gramsMade, overridden: false });
    }
  }

  const make: MakeGroup[] = KIND_ORDER.map(kind => ({
    kind,
    label: KIND_LABELS[kind],
    lines: Object.values(makeById).filter(l => l.component.kind === kind).sort((a, b) => a.component.name.localeCompare(b.component.name)),
  })).filter(g => g.lines.length > 0);

  const needs = computeIngredientNeeds(shopId, days, getRecord);
  const orderLines: OrderLine[] = Object.values(needs).map(e => {
    const ing = e.ingredient;
    const packs = ing.pack.size > 0 ? Math.ceil(e.grams / ing.pack.size - 0.001) : 0;
    const suggestedPacks = ing.pack.size > 0 ? Math.ceil(e.suggestedGrams / ing.pack.size - 0.001) : 0;
    return { ingredientId: e.ingredientId, ingredient: ing, grams: e.grams, packs, usedBy: e.usedBy, overridden: packs !== suggestedPacks, suggestedPacks };
  });
  const suppliers = Array.from(new Set(orderLines.map(l => l.ingredient.supplier))).sort();
  const order: SupplierGroup[] = suppliers.map(s => {
    const lines = orderLines.filter(l => l.ingredient.supplier === s).sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name));
    return { supplier: s, lines, packs: lines.reduce((n, l) => n + l.packs, 0) };
  });

  return {
    shopId, window, days, make, order,
    totals: {
      makeLines: Object.keys(makeById).length,
      ingredients: orderLines.length,
      packs: orderLines.reduce((n, l) => n + l.packs, 0),
      overridden: orderLines.filter(l => l.overridden).length,
      costPounds: orderLines.reduce((n, l) => n + (l.packs * l.ingredient.pack.size / 1000) * l.ingredient.costPerKg, 0),
    },
  };
}

function hotLabel(c: Component, b: Batches): string {
  const label = (c.batch.label ?? '').replace(/^(from )?one /, '').replace(/,.*$/, '').trim();
  const n = batchesToNumber(b);
  if (label && !/tray|pot|per /.test(label)) {
    const shown = n % 1 === 0 ? String(n) : n.toFixed(1).replace('.5', '½');
    return `${shown} ${n === 1 ? label : `${label}s`}`;
  }
  return batchesLabel(b);
}

export function windowLabel(w: PlanningWindow): string {
  const day = (iso: string) => `${weekdayLabel(iso)} ${Number(iso.slice(8, 10))}`;
  return `${day(w.from)} to ${day(w.to)}`;
}

export type { PlanningWindow };
