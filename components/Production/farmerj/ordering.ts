import { batchesLabel, batchesToNumber, type Batches } from './cascade';
import { addDays, isShopOpen, planningWindowFor, weekdayLabel, type PlanningWindow } from './calendar';
import { computeDayPlan, type DayRecord } from './FjPlanStore';
import { computePrepDay, qtyLabel } from './prep';
import { INGREDIENTS, type Component, type ComponentKind, type Ingredient } from './recipes';

/**
 * Order sheet for a planning window. Two views of the same cascade:
 *
 *  What to make: every sub-recipe the window's plans call for, one line
 *  per component with a quantity per day. Sub-recipes stay as sub-recipes
 *  (a rice kit, not rice plus salt plus oil). Prep-list overrides show
 *  here, so if the manager typed 13 bags of parsley the sheet says 13.
 *
 *  What to order: raw ingredients rolled up across the window, in the
 *  supplier's pack, grouped by supplier. Needed packs come from grams;
 *  the manager enters what is already in the store room and the sheet
 *  says what to order. Water is not on it.
 *
 * Ingredient grams are taken from the make list, not straight from the
 * cascade, so an override on a prep line changes the order. Hot-section
 * components (rice, roast veg) are not on the prep list; their inputs are
 * taken from the day plan's cascade directly.
 */

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
  inStock: number;
  toOrder: number;
  /** Component names that use it in the window. */
  usedBy: string[];
  /** True when a prep-list override changed the figure. */
  overridden: boolean;
  suggestedPacks: number;
};

export type SupplierGroup = { supplier: string; lines: OrderLine[]; packs: number; toOrder: number };

export type OrderSheet = {
  shopId: string;
  window: PlanningWindow;
  /** Days in the window the shop trades. */
  days: string[];
  make: MakeGroup[];
  order: SupplierGroup[];
  totals: { makeLines: number; ingredients: number; packs: number; toOrder: number; overridden: number; costPounds: number };
};

type GetRecord = (shopId: string, date: string) => DayRecord;

const KIND_ORDER: ComponentKind[] = ['cooked', 'kit', 'prep', 'dressing', 'mix'];
const KIND_LABELS: Record<ComponentKind, string> = {
  cooked: 'Cooked on the day',
  kit: 'Kits',
  prep: 'Prep',
  dressing: 'Dressings',
  mix: 'Mixes',
};

/** Three windows from today: the one we are in, then the next two. */
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

export function computeOrderSheet(shopId: string, window: PlanningWindow, getRecord: GetRecord, stock: Record<string, number> = {}): OrderSheet {
  const days = window.days.filter(d => isShopOpen(shopId, d));
  const makeById: Record<string, MakeLine> = {};
  const ingGrams: Record<string, { grams: number; suggestedGrams: number; usedBy: Set<string> }> = {};

  const addIng = (ref: string, grams: number, suggestedGrams: number, from: string) => {
    const ing = INGREDIENTS[ref];
    if (!ing || grams <= 0 || ing.supplier === 'Tap') return;
    const e = (ingGrams[ref] ??= { grams: 0, suggestedGrams: 0, usedBy: new Set() });
    e.grams += grams;
    e.suggestedGrams += suggestedGrams;
    e.usedBy.add(from);
  };

  const cell = (id: string, c: Component, date: string, mc: MakeCell) => {
    const line = (makeById[id] ??= { componentId: id, component: c, perDay: {}, totalGramsMade: 0, overridden: false });
    line.perDay[date] = mc;
    line.totalGramsMade += mc.gramsMade;
    if (mc.overridden) line.overridden = true;
  };

  for (const date of days) {
    const record = getRecord(shopId, date);
    const prep = computePrepDay(shopId, date, getRecord);
    for (const l of prep.lines) {
      cell(l.componentId, l.component, date, {
        qtyLabel: qtyLabel(l),
        gramsMade: l.gramsMade,
        overridden: l.overridden,
        suggestedLabel: l.overridden ? qtyLabel(l, l.suggestedQty) : undefined,
      });
      const suggestedScale = l.overridden && l.gramsMade > 0 ? (l.suggestedQty * l.unit.gramsEach) / l.gramsMade : 1;
      for (const i of l.inputs) {
        if (i.kind === 'ingredient') addIng(i.ref, i.grams, i.grams * suggestedScale, l.component.name);
      }
    }

    // Hot-section components and anything the finished products use
    // straight from a pack are not on the prep list.
    const plan = computeDayPlan(shopId, date, record, getRecord(shopId, addDays(date, -1)).close);
    for (const need of Object.values(plan.explosion.components)) {
      if (need.component.section !== 'hot') continue;
      if (need.gramsMade <= 0) continue;
      cell(need.componentId, need.component, date, { qtyLabel: hotLabel(need.component, need.batches), gramsMade: need.gramsMade, overridden: false });
      const scale = need.gramsMade / need.component.batch.fullG;
      for (const inp of need.component.inputs) {
        if (INGREDIENTS[inp.ref]) addIng(inp.ref, inp.grams * scale, inp.grams * scale, need.component.name);
      }
    }
    for (const p of plan.plans) {
      const b = batchesToNumber(p.batches);
      if (b <= 0) continue;
      for (const line of p.product.recipe) {
        if (INGREDIENTS[line.ref]) addIng(line.ref, line.grams * b, line.grams * b, p.product.name);
      }
    }
  }

  const make: MakeGroup[] = KIND_ORDER.map(kind => ({
    kind,
    label: KIND_LABELS[kind],
    lines: Object.values(makeById)
      .filter(l => l.component.kind === kind)
      .sort((a, b) => a.component.name.localeCompare(b.component.name)),
  })).filter(g => g.lines.length > 0);

  const orderLines: OrderLine[] = Object.entries(ingGrams).map(([id, e]) => {
    const ing = INGREDIENTS[id];
    const packs = ing.pack.size > 0 ? Math.ceil(e.grams / ing.pack.size - 0.001) : 0;
    const suggestedPacks = ing.pack.size > 0 ? Math.ceil(e.suggestedGrams / ing.pack.size - 0.001) : 0;
    const inStock = stock[id] ?? 0;
    return {
      ingredientId: id,
      ingredient: ing,
      grams: e.grams,
      packs,
      inStock,
      toOrder: Math.max(0, packs - inStock),
      usedBy: Array.from(e.usedBy).sort(),
      overridden: packs !== suggestedPacks,
      suggestedPacks,
    };
  });

  const supplierOrder = ['Fresh produce', 'Chilled', 'Dry goods', 'Frozen', 'Bakery'];
  const suppliers = Array.from(new Set(orderLines.map(l => l.ingredient.supplier))).sort(
    (a, b) => (supplierOrder.indexOf(a) === -1 ? 99 : supplierOrder.indexOf(a)) - (supplierOrder.indexOf(b) === -1 ? 99 : supplierOrder.indexOf(b)) || a.localeCompare(b),
  );
  const order: SupplierGroup[] = suppliers.map(s => {
    const lines = orderLines.filter(l => l.ingredient.supplier === s).sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name));
    return { supplier: s, lines, packs: lines.reduce((n, l) => n + l.packs, 0), toOrder: lines.reduce((n, l) => n + l.toOrder, 0) };
  });

  const totals = {
    makeLines: Object.keys(makeById).length,
    ingredients: orderLines.length,
    packs: orderLines.reduce((n, l) => n + l.packs, 0),
    toOrder: orderLines.reduce((n, l) => n + l.toOrder, 0),
    overridden: orderLines.filter(l => l.overridden).length,
    costPounds: orderLines.reduce((n, l) => n + (l.toOrder * l.ingredient.pack.size / 1000) * l.ingredient.costPerKg, 0),
  };

  return { shopId, window, days, make, order, totals };
}

function hotLabel(c: Component, b: Batches): string {
  const label = (c.batch.label ?? '').replace(/^(from )?one /, '').replace(/,.*$/, '').trim();
  const n = batchesToNumber(b);
  if (label && !/tray|pot|per /.test(label)) {
    const noun = label;
    const shown = n % 1 === 0 ? String(n) : n.toFixed(1).replace('.5', '½');
    return `${shown} ${n === 1 ? noun : `${noun}s`}`;
  }
  return batchesLabel(b);
}

export function windowLabel(w: PlanningWindow): string {
  const day = (iso: string) => `${weekdayLabel(iso)} ${Number(iso.slice(8, 10))}`;
  return `${day(w.from)} to ${day(w.to)}`;
}

export type { PlanningWindow };
