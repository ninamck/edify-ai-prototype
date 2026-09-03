/**
 * The cascade: sales → finished products in cast irons and batches →
 * everything below as tasks and order lines.
 *
 * Rules (from the calls and Jana's workbook):
 *  - Suggested quantity = reference-day average × flex, plus catering,
 *    minus what was counted in the fridge tonight and is still in date.
 *  - Demand splits across the shop's lines by sales channel (the lines are
 *    the shop's benches; see `lines.ts`). A full-batch line plates the
 *    recipe's container, a half-batch line plates small containers.
 *    Batches are rounded once, on the total across lines.
 *  - Override wins. Flex never touches an overridden row.
 *  - Every component below the plan is derived. Shared components (parsley,
 *    Loose Miso hispi, Shifka prep) aggregate across every consumer and
 *    list them.
 *  - Gross is what the team weighs; net is what the recipe needs. Loss is a
 *    percentage per component that Jana edits.
 */

import {
  AUTHORED_YIELD_LOSS,
  CONTAINERS,
  COMPONENTS,
  INGREDIENTS,
  PORTION_GRAMS,
  PRODUCT_BY_ID,
  type Component,
  type FinishedProduct,
  type LineItem,
} from './recipes';
import type { DayDemand } from './sales';
import { carryLine, cateringLine, defaultLines, type PlanLine } from './lines';

// ─────────────────────────────────────────────────────────────────────────────
// Rounding
// ─────────────────────────────────────────────────────────────────────────────

export type Batches = { full: number; half: number };

export function batchesToNumber(b: Batches): number {
  return b.full + b.half * 0.5;
}

export function batchesLabel(b: Batches): string {
  if (b.full === 0 && b.half === 0) return 'none';
  const parts: string[] = [];
  if (b.full) parts.push(`${b.full} full`);
  if (b.half) parts.push(`${b.half} half`);
  return parts.join(' + ');
}

/** Component batches: whole batches, last one a half when the remainder is small. */
export function roundMainLine(batchesNeeded: number, halfAllowed: boolean): Batches {
  if (batchesNeeded <= 0) return { full: 0, half: 0 };
  const full = Math.floor(batchesNeeded);
  const rem = batchesNeeded - full;
  if (rem < 0.001) return { full, half: 0 };
  if (halfAllowed && rem <= 0.5) return { full, half: 1 };
  return { full: full + 1, half: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product plan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One service line of a product's plan. Units are what the manager sets:
 * the recipe's container on a full-batch line, small containers on a
 * half-batch line.
 */
export type LinePlan = {
  lineId: string;
  lineName: string;
  halfBatches: boolean;
  /** Share of the reference-day grams this line's channels sold. */
  share: number;
  /** Grams the line needs after flex, catering and carryover. */
  demandGrams: number;
  /** Units Edify suggests. */
  suggestedUnits: number;
  /** Units that will be plated: the override when set, otherwise suggested. */
  plannedUnits: number;
  unitName: string;
  /** Grams of finished product one unit holds on this line. */
  gramsPerUnit: number;
  gramsPlanned: number;
  /** Carry-over lands here; catering is plated here. */
  takesCarry: boolean;
  takesCatering: boolean;
};

export type ProductPlan = {
  productId: string;
  product: FinishedProduct;
  /** Portions on the reference days (average). */
  referencePortions: number;
  referenceGrams: number;
  /** Pounds where this product is the headline till line (trays, bowls, extras). */
  referenceNet: number;
  flexPct: number;
  cateringGrams: number;
  carriedGrams: number;
  /** One entry per line, in the shop's line order. */
  lines: LinePlan[];
  /**
   * Batches to cook or assemble for every line together. Rice is cooked
   * once and plated to cast irons and gastronorms from the same blue box,
   * so rounding happens once, on the total.
   */
  batches: Batches;
  batchesSuggested: Batches;
  gramsMade: number;
  overridden: boolean;
  /** Plain-words derivation for the "why this number" drawer. */
  notes: string[];
};

/** Units per product per line, as the manager typed them. */
export type LineOverride = Record<string, number>;

export type PlanOptions = {
  /** Whole-day percentage, e.g. -20. Skips overridden rows. */
  flexPct?: number;
  /** Catering grams by product for the day. */
  catering?: Record<string, number>;
  /** Grams counted at close last night that are still in date. */
  carried?: Record<string, number>;
  /** Manager overrides in units, per product and line id. */
  overrides?: Record<string, LineOverride>;
  /** The shop's service lines. Defaults to the company's two. */
  lines?: PlanLine[];
};

/** Planned units on lines that plate the recipe's full container. */
export function fullLineUnits(p: ProductPlan): number {
  return p.lines.filter(l => !l.halfBatches).reduce((n, l) => n + l.plannedUnits, 0);
}

/** Planned units on lines that plate small containers. */
export function halfLineUnits(p: ProductPlan): number {
  return p.lines.filter(l => l.halfBatches).reduce((n, l) => n + l.plannedUnits, 0);
}

/** The line catering is plated on for this product. */
export function cateringLineOf(p: ProductPlan): LinePlan {
  return p.lines.find(l => l.takesCatering) ?? p.lines[p.lines.length - 1];
}

/** Name of the recipe's own container, lower case, for captions. */
export function mainUnitName(p: FinishedProduct): string {
  return CONTAINERS[p.unit].name.toLowerCase();
}

/**
 * How much more (or less) raw input a component needs than the recipe
 * book wrote down, because Jana has changed its yield loss in Setup.
 * 30% authored and 35% set: every input scales by 0.70 / 0.65.
 */
export function inputScale(c: Component): number {
  const authored = AUTHORED_YIELD_LOSS[c.id] ?? c.yieldLossPct;
  const now = Math.min(99, c.yieldLossPct);
  return (1 - authored / 100) / (1 - now / 100);
}

export function fullBatchGrams(p: FinishedProduct): number {
  return p.batch.fullG * (1 - p.yieldLossPct / 100);
}

/** Grams of finished product one main-line unit holds. */
export function gramsPerMainUnit(p: FinishedProduct): number {
  return fullBatchGrams(p) / p.unitsPerBatch;
}

/**
 * The portion a GM pictures for this product: a tray protein (100 g), a
 * tray base (150 g), a side (100 g), a breakfast pot (150 g). Used to turn
 * grams back into portions and "portions per cast iron" on the screens,
 * so the plan reads in kitchen words rather than kilos.
 */
export function portionGrams(p: FinishedProduct): number {
  switch (p.group) {
    case 'proteins': return PORTION_GRAMS.trayProtein;
    case 'bases': return PORTION_GRAMS.trayBase;
    // Breakfast batches are sized in portions, so one unit is one portion.
    case 'breakfast': return gramsPerMainUnit(p);
    default: return PORTION_GRAMS.side;
  }
}

export function portionsOf(p: FinishedProduct, grams: number): number {
  return Math.round(grams / portionGrams(p));
}

/** Portions one main-line container serves. */
export function portionsPerMainUnit(p: FinishedProduct): number {
  return Math.round(gramsPerMainUnit(p) / portionGrams(p));
}

/** Portions one second-make-line container serves. */
export function portionsPerSecondUnit(p: FinishedProduct): number {
  return Math.round((gramsPerMainUnit(p) * p.secondLineFraction) / portionGrams(p));
}

/** Grams as main-line containers, to the nearest half. */
export function mainUnitsOf(p: FinishedProduct, grams: number): number {
  return Math.round((grams / gramsPerMainUnit(p)) * 2) / 2;
}

export function secondLineUnitName(p: FinishedProduct): string {
  return p.unit === 'salad-gn' || p.unit === 'breakfast-pot' || p.unit === 'portion' ? CONTAINERS[p.unit].name : CONTAINERS['gn-1-2'].name;
}

/**
 * Round a batch count for a finished product.
 *  - Recipes with a half batch round to the nearest half: a spare tenth of
 *    a cooker is not worth a cooker (2.95 → 3, 3.07 → 3, 3.3 → 3.5).
 *  - Recipes without a half round up: a bag of chicken is a bag.
 */
export function roundProductBatches(p: FinishedProduct, batchesNeeded: number): Batches {
  if (batchesNeeded <= 0) return { full: 0, half: 0 };
  if (p.halfBatch && p.batch.halfG) {
    const halves = Math.max(1, Math.round(batchesNeeded * 2));
    return { full: Math.floor(halves / 2), half: halves % 2 };
  }
  return { full: Math.ceil(batchesNeeded - 0.02), half: 0 };
}

/** Plan one finished product for one day. */
export function planProduct(productId: string, demand: DayDemand, opts: PlanOptions = {}): ProductPlan {
  const product = PRODUCT_BY_ID[productId];
  const d = demand.products[productId];
  const lines = opts.lines?.length ? opts.lines : defaultLines();
  const referenceGrams = d?.grams ?? 0;
  const referencePortions = d?.portions ?? 0;
  const override = opts.overrides?.[productId] ?? {};
  const overridden = lines.some(l => override[l.id] !== undefined);
  const flexPct = overridden ? 0 : opts.flexPct ?? 0;
  const flexed = referenceGrams * (1 + flexPct / 100);
  const cateringGrams = opts.catering?.[productId] ?? 0;
  const carriedGrams = Math.min(opts.carried?.[productId] ?? 0, flexed);
  const batchG = fullBatchGrams(product);
  const mainUnitG = gramsPerMainUnit(product);
  const carry = carryLine(lines);
  const catering = cateringLine(lines);

  // Each line's share of the day is what its channels sold on the reference
  // days. With no sales history everything lands on the carry line.
  const shareOf = (line: PlanLine): number => {
    if (referenceGrams <= 0) return line.id === carry.id ? 1 : 0;
    return line.channels.reduce((n, ch) => n + (d?.byChannel[ch] ?? 0), 0) / referenceGrams;
  };

  const linePlans: LinePlan[] = lines.map(line => {
    const share = shareOf(line);
    const unitG = line.halfBatches ? mainUnitG * product.secondLineFraction : mainUnitG;
    // Carry-over comes off the line it is served from. Catering is plated
    // on the small-container line.
    const demandGrams = Math.max(0, flexed * share - (line.id === carry.id ? carriedGrams : 0)) + (line.id === catering.id ? cateringGrams : 0);
    const suggestedUnits = ceilUnits(demandGrams / unitG);
    const plannedUnits = override[line.id] ?? suggestedUnits;
    return {
      lineId: line.id,
      lineName: line.name,
      halfBatches: line.halfBatches,
      share,
      demandGrams,
      suggestedUnits,
      plannedUnits,
      unitName: line.halfBatches ? secondLineUnitName(product) : CONTAINERS[product.unit].name,
      gramsPerUnit: unitG,
      gramsPlanned: plannedUnits * unitG,
      takesCarry: line.id === carry.id,
      takesCatering: line.id === catering.id,
    };
  });

  // Batches cover what gets plated: 12 cast irons and 2 gastronorms of Amba
  // is 13 bags in the oven. Rice rounds to the nearest half cooker, so a
  // 22nd cast-iron equivalent on top of 21 does not trigger a half batch.
  const suggestedBatchGrams = linePlans.reduce((n, l) => n + l.suggestedUnits * l.gramsPerUnit, 0);
  const plannedBatchGrams = linePlans.reduce((n, l) => n + l.gramsPlanned, 0);
  const batchesSuggested = roundProductBatches(product, suggestedBatchGrams / batchG);
  const batches = roundProductBatches(product, plannedBatchGrams / batchG);
  const gramsMade = batchesToNumber(batches) * batchG;

  const unitName = CONTAINERS[product.unit].name;
  const notes: string[] = [];
  notes.push(`${Math.round(referencePortions)} portions, about ${kg(referenceGrams)}, sold on average across the reference days.`);
  if (flexPct) notes.push(`Whole-day flex ${flexPct > 0 ? '+' : ''}${flexPct}%: ${kg(flexed)}.`);
  if (cateringGrams) notes.push(`Catering adds ${kg(cateringGrams)} on ${catering.name}.`);
  if (carriedGrams) notes.push(`${kg(carriedGrams)} counted in the fridge last night comes off ${carry.name}.`);
  for (const l of linePlans) {
    if (l.demandGrams <= 0 && l.share <= 0) continue;
    const line = lines.find(x => x.id === l.lineId)!;
    const channels = line.channels.map(c => CHANNEL_WORDS[c]).join(', ');
    notes.push(`${l.lineName} ${Math.round(l.share * 100)}%${channels ? ` (${channels})` : ''} → ${kg(l.demandGrams)} → ${l.suggestedUnits} ${plural(l.suggestedUnits, l.unitName)} at about ${kg(l.gramsPerUnit)} each.`);
  }
  notes.push(`One full batch makes ${kg(batchG)}, about ${product.unitsPerBatch} ${plural(product.unitsPerBatch, unitName)}${product.halfBatch ? '; half batches allowed, so batches round to the nearest half' : '; no half batch, so batches round up'}. ${lines.length === 1 ? 'The line needs' : 'All lines together need'} ${(plannedBatchGrams / batchG).toFixed(2)} batches → ${batchesLabel(batches)}.`);
  if (overridden) notes.push('You set this line by hand. Flex and re-drafts leave it alone.');

  return {
    productId,
    product,
    referencePortions,
    referenceGrams,
    referenceNet: d?.net ?? 0,
    flexPct,
    cateringGrams,
    carriedGrams,
    overridden,
    lines: linePlans,
    batches,
    batchesSuggested,
    gramsMade,
    notes,
  };
}

const CHANNEL_WORDS: Record<string, string> = { instore: 'in store', kiosk: 'kiosk', deliveroo: 'Deliveroo', clickcollect: 'Click & Collect', corporate: 'Corporate', citypantry: 'CityPantry', ordit: 'Ordit' };

function ceilUnits(n: number): number {
  return n <= 0 ? 0 : Math.ceil(n - 0.02);
}

function plural(n: number, word: string): string {
  // Container names can carry a bracketed qualifier: pluralise the noun,
  // keep the qualifier ("gastronorms (second make line)").
  const m = word.match(/^(.*?)(\s*\(.*\))?$/);
  const noun = (m?.[1] ?? word).toLowerCase();
  const tail = m?.[2] ?? '';
  return n === 1 ? `${noun}${tail}` : `${noun}s${tail}`;
}

/** Plan every product that has demand (or an override) for the day. */
export function planDay(demand: DayDemand, productIds: string[], opts: PlanOptions = {}): ProductPlan[] {
  return productIds.map(id => planProduct(id, demand, opts));
}

// ─────────────────────────────────────────────────────────────────────────────
// Explosion: plan → components → ingredients
// ─────────────────────────────────────────────────────────────────────────────

export type Consumer = { ref: string; name: string; grams: number };

export type ComponentNeed = {
  componentId: string;
  component: Component;
  /** Net grams the plan needs. */
  netGrams: number;
  /** Gross grams the team weighs in (sum of inputs). */
  grossGrams: number;
  /** Batches to make, rounded by the component's own batch rule. */
  batches: Batches;
  /** Net grams the rounded batches produce. */
  gramsMade: number;
  consumers: Consumer[];
  shared: boolean;
  /** Dressings and preps sized to the 1 to 18 kg matrix. */
  matrixKg?: number;
};

export type IngredientNeed = {
  ingredientId: string;
  grams: number;
  packs: number;
  packLabel: string;
  consumers: Consumer[];
};

export type Explosion = {
  components: Record<string, ComponentNeed>;
  ingredients: Record<string, IngredientNeed>;
};

/** Round component batches by the component's own rule (see `roundTo`). */
export function roundComponent(c: Component, netGrams: number): { batches: Batches; gramsMade: number; matrixKg?: number } {
  if (netGrams <= 0) return { batches: { full: 0, half: 0 }, gramsMade: 0 };
  switch (c.roundTo) {
    case 'kilo': {
      const kgs = Math.min(18, Math.max(1, Math.ceil(netGrams / 1000 - 0.001)));
      return { batches: { full: kgs, half: 0 }, gramsMade: kgs * 1000, matrixKg: kgs };
    }
    case 'pack': {
      // You open the can, you prep the can.
      const packs = Math.ceil(netGrams / c.batch.fullG - 0.001);
      return { batches: { full: packs, half: 0 }, gramsMade: packs * c.batch.fullG };
    }
    case 'exact': {
      const b = Math.round((netGrams / c.batch.fullG) * 100) / 100;
      return { batches: { full: b, half: 0 }, gramsMade: netGrams };
    }
    case 'batch':
    default: {
      const b = roundMainLine(netGrams / c.batch.fullG, Boolean(c.batch.halfG));
      return { batches: b, gramsMade: batchesToNumber(b) * c.batch.fullG };
    }
  }
}

/**
 * Explode a set of product plans (and any direct component demand such as
 * sauces) into every component and ingredient needed.
 */
export function explode(plans: ProductPlan[], direct: Record<string, { grams: number }> = {}): Explosion {
  const comps: Record<string, ComponentNeed> = {};
  const ings: Record<string, IngredientNeed> = {};
  const pending: { ref: string; grams: number; from: Consumer }[] = [];

  const push = (line: LineItem, scale: number, from: { ref: string; name: string }) => {
    const grams = line.grams * scale;
    if (grams <= 0) return;
    pending.push({ ref: line.ref, grams, from: { ...from, grams } });
  };

  for (const plan of plans) {
    const batches = batchesToNumber(plan.batches);
    if (batches <= 0) continue;
    for (const line of plan.product.recipe) push(line, batches, { ref: plan.productId, name: plan.product.name });
  }
  for (const [id, d] of Object.entries(direct)) {
    if (d.grams > 0) pending.push({ ref: id, grams: d.grams, from: { ref: 'till', name: 'Sold as sauce or topping', grams: d.grams } });
  }

  // Breadth-first so shared components accumulate all their consumers
  // before their own inputs are pushed. Each component is expanded once
  // its total is known; we re-expand on growth by tracking expanded grams.
  const expandedGrams: Record<string, number> = {};
  while (pending.length) {
    const item = pending.shift()!;
    const comp = COMPONENTS[item.ref];
    if (comp) {
      const need = (comps[item.ref] ??= {
        componentId: item.ref, component: comp, netGrams: 0, grossGrams: 0,
        batches: { full: 0, half: 0 }, gramsMade: 0, consumers: [], shared: false,
      });
      need.netGrams += item.grams;
      mergeConsumer(need.consumers, item.from);
      continue;
    }
    const ing = INGREDIENTS[item.ref];
    if (ing) {
      const need = (ings[item.ref] ??= { ingredientId: item.ref, grams: 0, packs: 0, packLabel: ing.pack.label, consumers: [] });
      need.grams += item.grams;
      mergeConsumer(need.consumers, item.from);
    }
  }

  // Now expand components level by level: a component's inputs depend on
  // its rounded batches, and a component may feed another component, so
  // iterate until nothing changes.
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    for (const need of Object.values(comps)) {
      const rounded = roundComponent(need.component, need.netGrams);
      need.batches = rounded.batches;
      need.gramsMade = rounded.gramsMade;
      need.matrixKg = rounded.matrixKg;
      const already = expandedGrams[need.componentId] ?? 0;
      if (Math.abs(need.gramsMade - already) < 0.5) continue;
      changed = true;
      const delta = need.gramsMade - already;
      expandedGrams[need.componentId] = need.gramsMade;
      const scale = (delta / need.component.batch.fullG) * inputScale(need.component);
      for (const line of need.component.inputs) {
        const grams = line.grams * scale;
        const from: Consumer = { ref: need.componentId, name: need.component.name, grams };
        const sub = COMPONENTS[line.ref];
        if (sub) {
          const subNeed = (comps[line.ref] ??= {
            componentId: line.ref, component: sub, netGrams: 0, grossGrams: 0,
            batches: { full: 0, half: 0 }, gramsMade: 0, consumers: [], shared: false,
          });
          subNeed.netGrams += grams;
          mergeConsumer(subNeed.consumers, from);
        } else if (INGREDIENTS[line.ref]) {
          const ingNeed = (ings[line.ref] ??= { ingredientId: line.ref, grams: 0, packs: 0, packLabel: INGREDIENTS[line.ref].pack.label, consumers: [] });
          ingNeed.grams += grams;
          mergeConsumer(ingNeed.consumers, from);
        }
      }
    }
  }

  for (const need of Object.values(comps)) {
    need.grossGrams = need.component.inputs.reduce((n, l) => n + l.grams, 0) * (need.gramsMade / need.component.batch.fullG) * inputScale(need.component);
    need.shared = need.consumers.length > 1;
  }
  for (const need of Object.values(ings)) {
    const ing = INGREDIENTS[need.ingredientId];
    need.packs = ing.pack.size > 0 ? Math.ceil(need.grams / ing.pack.size - 0.001) : 0;
  }
  return { components: comps, ingredients: ings };
}

function mergeConsumer(list: Consumer[], c: Consumer) {
  const existing = list.find(x => x.ref === c.ref);
  if (existing) existing.grams += c.grams;
  else list.push({ ...c });
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers shared by the screens
// ─────────────────────────────────────────────────────────────────────────────

export function kg(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(grams >= 10000 ? 0 : 1)} kg`;
  return `${Math.round(grams)} g`;
}

export function gbp(n: number): string {
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}

/** Cost of a component's net grams at ingredient prices, for waste in pounds. */
export function costPerKgOf(ref: string, depth = 0): number {
  const ing = INGREDIENTS[ref];
  if (ing) return ing.costPerKg;
  const comp = COMPONENTS[ref];
  if (!comp || depth > 6) return 0;
  const inputCost = comp.inputs.reduce((n, l) => n + (l.grams / 1000) * costPerKgOf(l.ref, depth + 1), 0);
  return comp.batch.fullG > 0 ? inputCost / (comp.batch.fullG / 1000) : 0;
}

export function productCostPerKg(productId: string): number {
  const p = PRODUCT_BY_ID[productId];
  if (!p) return 0;
  const inputCost = p.recipe.reduce((n, l) => n + (l.grams / 1000) * costPerKgOf(l.ref), 0);
  return inputCost / (fullBatchGrams(p) / 1000);
}
