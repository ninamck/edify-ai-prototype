/**
 * The cascade: sales → finished products in cast irons and batches →
 * everything below as tasks and order lines.
 *
 * Rules (from the calls and Jana's workbook):
 *  - Suggested quantity = reference-day average × flex, plus catering,
 *    minus what was counted in the fridge tonight and is still in date.
 *  - Main line rounds up to full batches, with the last one dropped to a
 *    half when the remainder is under half a batch and the recipe has a
 *    half. Second make line plates into gastronorms, which only hold a
 *    half, so it rounds to halves.
 *  - Override wins. Flex never touches an overridden row.
 *  - Every component below the plan is derived. Shared components (parsley,
 *    Loose Miso hispi, Shifka prep) aggregate across every consumer and
 *    list them.
 *  - Gross is what the team weighs; net is what the recipe needs. Loss is a
 *    percentage per component that Jana edits.
 */

import {
  CONTAINERS,
  COMPONENTS,
  INGREDIENTS,
  PRODUCT_BY_ID,
  type Component,
  type FinishedProduct,
  type LineItem,
} from './recipes';
import type { DayDemand } from './sales';

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

/** Main line: whole batches, last one a half when the remainder is small. */
export function roundMainLine(batchesNeeded: number, halfAllowed: boolean): Batches {
  if (batchesNeeded <= 0) return { full: 0, half: 0 };
  const full = Math.floor(batchesNeeded);
  const rem = batchesNeeded - full;
  if (rem < 0.001) return { full, half: 0 };
  if (halfAllowed && rem <= 0.5) return { full, half: 1 };
  return { full: full + 1, half: 0 };
}

/** Second make line: gastronorms hold a half, so halves only. */
export function roundSecondLine(batchesNeeded: number): Batches {
  if (batchesNeeded <= 0) return { full: 0, half: 0 };
  return { full: 0, half: Math.ceil(batchesNeeded * 2 - 0.001) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product plan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One service line of a product's plan. Units are what the manager sets:
 * cast irons on the main line, gastronorms on the second make line.
 */
export type LinePlan = {
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
  main: LinePlan;
  second: LinePlan;
  /**
   * Batches to cook or assemble for both lines together. Rice is cooked
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

export type PlanOptions = {
  /** Whole-day percentage, e.g. -20. Skips overridden rows. */
  flexPct?: number;
  /** Catering grams by product for the day. */
  catering?: Record<string, number>;
  /** Grams counted at close last night that are still in date. */
  carried?: Record<string, number>;
  /** Manager overrides in units, per product and line. */
  overrides?: Record<string, { main?: number; second?: number }>;
};

export function fullBatchGrams(p: FinishedProduct): number {
  return p.batch.fullG * (1 - p.yieldLossPct / 100);
}

/** Grams of finished product one main-line unit holds. */
export function gramsPerMainUnit(p: FinishedProduct): number {
  return fullBatchGrams(p) / p.unitsPerBatch;
}

export function secondLineUnitName(p: FinishedProduct): string {
  return p.unit === 'salad-gn' ? CONTAINERS['salad-gn'].name : p.unit === 'breakfast-pot' ? CONTAINERS['breakfast-pot'].name : CONTAINERS['gn-1-2'].name;
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
  const referenceGrams = d?.grams ?? 0;
  const referencePortions = d?.portions ?? 0;
  const mainShare = referenceGrams > 0 ? (d?.mainGrams ?? 0) / referenceGrams : 1;
  const override = opts.overrides?.[productId];
  const overridden = override?.main !== undefined || override?.second !== undefined;
  const flexPct = overridden ? 0 : opts.flexPct ?? 0;
  const flexed = referenceGrams * (1 + flexPct / 100);
  const cateringGrams = opts.catering?.[productId] ?? 0;
  const carriedGrams = Math.min(opts.carried?.[productId] ?? 0, flexed);
  const batchG = fullBatchGrams(product);
  const mainUnitG = gramsPerMainUnit(product);
  const secondUnitG = mainUnitG * product.secondLineFraction;

  // Carryover comes off the main line (it is served from the fridge onto
  // the main line). Catering is second make line work.
  const mainDemand = Math.max(0, flexed * mainShare - carriedGrams);
  const secondDemand = flexed * (1 - mainShare) + cateringGrams;

  const mainSuggested = ceilUnits(mainDemand / mainUnitG);
  const secondSuggested = ceilUnits(secondDemand / secondUnitG);
  const mainPlanned = override?.main ?? mainSuggested;
  const secondPlanned = override?.second ?? secondSuggested;

  const mainGrams = mainPlanned * mainUnitG;
  const secondGrams = secondPlanned * secondUnitG;
  // Batches cover what gets plated: 12 cast irons and 2 gastronorms of Amba
  // is 13 bags in the oven. Rice rounds to the nearest half cooker, so a
  // 22nd cast-iron equivalent on top of 21 does not trigger a half batch.
  const suggestedBatchGrams = mainSuggested * mainUnitG + secondSuggested * secondUnitG;
  const plannedBatchGrams = mainGrams + secondGrams;
  const batchesSuggested = roundProductBatches(product, suggestedBatchGrams / batchG);
  const batches = roundProductBatches(product, plannedBatchGrams / batchG);
  const gramsMade = batchesToNumber(batches) * batchG;

  const mainUnitName = CONTAINERS[product.unit].name;
  const secondUnitName = secondLineUnitName(product);
  const notes: string[] = [];
  notes.push(`${Math.round(referencePortions)} portions, about ${kg(referenceGrams)}, sold on average across the reference days.`);
  if (flexPct) notes.push(`Whole-day flex ${flexPct > 0 ? '+' : ''}${flexPct}%: ${kg(flexed)}.`);
  if (cateringGrams) notes.push(`Catering adds ${kg(cateringGrams)} on the second make line.`);
  if (carriedGrams) notes.push(`${kg(carriedGrams)} counted in the fridge last night comes off the main line.`);
  notes.push(`Main line ${Math.round(mainShare * 100)}% (in store and kiosk) → ${kg(mainDemand)} → ${mainSuggested} ${plural(mainSuggested, mainUnitName)} at about ${kg(mainUnitG)} each.`);
  if (secondDemand > 0) notes.push(`Second make line ${Math.round((1 - mainShare) * 100)}% (Deliveroo, Click & Collect) → ${kg(secondDemand)} → ${secondSuggested} ${plural(secondSuggested, secondUnitName)} at about ${kg(secondUnitG)} each.`);
  notes.push(`One full batch makes ${kg(batchG)}, about ${product.unitsPerBatch} ${plural(product.unitsPerBatch, mainUnitName)}${product.halfBatch ? '; half batches allowed, so batches round to the nearest half' : '; no half batch, so batches round up'}. Both lines together need ${(plannedBatchGrams / batchG).toFixed(2)} batches → ${batchesLabel(batches)}.`);
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
    main: { demandGrams: mainDemand, suggestedUnits: mainSuggested, plannedUnits: mainPlanned, unitName: mainUnitName, gramsPerUnit: mainUnitG, gramsPlanned: mainGrams },
    second: { demandGrams: secondDemand, suggestedUnits: secondSuggested, plannedUnits: secondPlanned, unitName: secondUnitName, gramsPerUnit: secondUnitG, gramsPlanned: secondGrams },
    batches,
    batchesSuggested,
    gramsMade,
    notes,
  };
}

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
      const scale = delta / need.component.batch.fullG;
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
    need.grossGrams = need.component.inputs.reduce((n, l) => n + l.grams, 0) * (need.gramsMade / need.component.batch.fullG);
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
