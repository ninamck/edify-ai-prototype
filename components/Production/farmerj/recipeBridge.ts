import type { ComponentRow, Recipe, RecipeCategory, RecipeIngredient } from '@/components/Recipe/libraryFixtures';
import { METHOD_DEFAULTS, RECIPE_CLASS_BY_ID, methodNumber, methodOverrideFor, recipeClassFrom, resolveEquipment, resolveMethod, type RecipeClassId, type RecipeMethod } from '@/components/Recipe/recipeClasses';
import type { MasterProduct, ProductCategory } from '@/components/Suppliers/fixtures';
import { EQUIPMENT_LABELS, type Equipment } from '../fixtures';
import {
  COMPONENTS,
  CONTAINERS,
  INGREDIENTS,
  PRODUCTS,
  PRODUCT_BY_ID,
  SHELF_LIFE_GROUPS,
  type Component,
  type ContainerId,
  type FinishedProduct,
  type ShelfLifeGroupId,
} from './recipes';
import { FJ_SHOPS } from './shops';

/** Farmer J's shops, by the names the recipe form and per-site overrides use. */
export const FJ_SITE_NAMES: string[] = FJ_SHOPS.map(s => s.name);

/**
 * Farmer J's recipe book lives in `recipes.ts` as typed constants the
 * planning engines read directly. The recipe library (`/recipes`) is the
 * screen Jana edits recipes on. This module keeps the two in step:
 *
 *  - `buildFarmerJRecipes()` publishes the book into the library as
 *    `brand: 'farmerj'` recipes, one per component and finished product.
 *  - `applyFarmerJRecipes(recipes)` writes the library's production
 *    fields back into the constants, so a save on the recipe page (or a
 *    publish from Setup) changes tomorrow's prep list.
 *  - `saveFarmerJOverrides` / `loadFarmerJOverrides` persist edits across
 *    a refresh (the library itself is in-memory).
 *
 * Ids are prefixed so components and products with the same id (coconut
 * chia is both) stay distinct: `fj:c:kale-prep`, `fj:p:amba-chicken`.
 */

export const FJ_RECIPE_OVERRIDES_KEY = 'edify.farmerj.recipes.v1';

export type FjProductionFields = {
  yieldLossPct: number;
  shelfLifeGroup: ShelfLifeGroupId | '';
  halfBatch: boolean;
  outputContainer: ContainerId | '';
  containersPerBatch: number | '';
  /** Recipe class (company list in `recipeClasses.ts`). */
  recipeClass: RecipeClassId | '';
  /** Kit override. `null` inherits the class default. */
  equipment: Equipment[] | null;
  /** Method, one step a line. Drives the stepper and the Sections method panel. */
  steps: string[];
  /**
   * Method settings set on this recipe: programme, time, core temp, rest,
   * hold, hand tools. Only the fields that differ from the class default
   * (`METHOD_DEFAULTS` in recipeClasses.ts, published from Setup).
   */
  method: Partial<RecipeMethod>;
};

/** `formExtras.instructions` is the method, one step a line. */
export function stepsFromInstructions(instructions: string | undefined): string[] | undefined {
  if (instructions === undefined) return undefined;
  return instructions.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

const KIND_CLASS: Record<Component['kind'], RecipeClassId> = { cooked: 'cooked', kit: 'kit', prep: 'prep', dressing: 'dressing', mix: 'mix' };

/** Equipment strings on an HTC that name the machine rather than a hand tool. */
const MACHINE_WORDS = /^(oven|rice cooker|food processor|griddle|grill|hob|combi oven)(\s*[(,]|$)/i;

/** The method as the HTC wrote it, whole. */
export function bookMethod(c: Component): RecipeMethod {
  const minutes = c.cook?.minutes;
  return {
    programme: c.cook?.programme ?? '',
    minutesFrom: minutes === undefined ? '' : Array.isArray(minutes) ? minutes[0] : minutes,
    minutesTo: Array.isArray(minutes) ? minutes[1] : '',
    coreTempC: c.cook?.coreTempC ?? '',
    restMinutes: c.restMinutes ?? '',
    holdMinutes: c.holdMinutes ?? '',
    handTools: (c.equipment ?? []).filter(e => !MACHINE_WORDS.test(e)),
  };
}

/**
 * The method fields the HTC sets beyond its class default. Unset numbers
 * where the class has one become 0 ("off"), so a dressing with no hold
 * stays without one when the class default says two hours.
 */
export function authoredMethod(c: Component): Partial<RecipeMethod> {
  const cls = KIND_CLASS[c.kind];
  const m = bookMethod(c);
  const dflt = METHOD_DEFAULTS[cls];
  for (const k of ['minutesFrom', 'minutesTo', 'coreTempC', 'restMinutes', 'holdMinutes'] as const) {
    if (m[k] === '' && dflt[k] !== '') m[k] = 0;
  }
  return methodOverrideFor(cls, m, METHOD_DEFAULTS);
}

/**
 * The kit the book implies for a component, from the HTC's own equipment
 * list and cook programme. Returns null when the class default already
 * says it (chicken is cooked, cooked means oven), so the recipe shows as
 * inheriting rather than overriding.
 */
export function authoredEquipment(c: Component): Equipment[] | null {
  const text = [...(c.equipment ?? []), c.cook?.programme ?? ''].join(' ').toLowerCase();
  let kit: Equipment[];
  if (text.includes('rice cooker')) kit = ['rice-cooker'];
  else if (c.cook?.programme.toLowerCase() === 'grill') kit = ['griddle'];
  else if (c.cook) kit = ['oven'];
  else if (text.includes('food processor')) kit = ['food-processor'];
  else if (c.kind === 'cooked') kit = [];
  else kit = RECIPE_CLASS_BY_ID[KIND_CLASS[c.kind]].defaultEquipment;
  const dflt = RECIPE_CLASS_BY_ID[KIND_CLASS[c.kind]].defaultEquipment;
  return sameList(kit, dflt) ? null : kit;
}

/** The kit a component needs before any library edit: class default or the HTC's own. */
export function bookEquipment(c: Component): Equipment[] {
  return resolveEquipment(KIND_CLASS[c.kind], authoredEquipment(c));
}

function sameList(a: readonly string[] | null, b: readonly string[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function componentRecipeId(id: string): string {
  return `fj:c:${id}`;
}
export function productRecipeId(id: string): string {
  return `fj:p:${id}`;
}
export function isFarmerJRecipeId(recipeId: string): boolean {
  return recipeId.startsWith('fj:');
}
/** Which book entry a library id points at. */
export function bookRef(recipeId: string): { kind: 'component'; component: Component } | { kind: 'product'; product: FinishedProduct } | null {
  if (recipeId.startsWith('fj:c:')) {
    const c = COMPONENTS[recipeId.slice(5)];
    return c ? { kind: 'component', component: c } : null;
  }
  if (recipeId.startsWith('fj:p:')) {
    const p = PRODUCT_BY_ID[recipeId.slice(5)];
    return p ? { kind: 'product', product: p } : null;
  }
  return null;
}

// ─── Authored baseline ───────────────────────────────────────────────────────

function fieldsOfComponent(c: Component): FjProductionFields {
  return {
    yieldLossPct: c.yieldLossPct,
    shelfLifeGroup: c.shelfLife,
    halfBatch: c.batch.halfG !== undefined,
    outputContainer: c.container ?? '',
    containersPerBatch: c.containersPerBatch ?? '',
    recipeClass: KIND_CLASS[c.kind],
    equipment: authoredEquipment(c),
    steps: c.steps ?? [],
    method: authoredMethod(c),
  };
}
function fieldsOfProduct(p: FinishedProduct): FjProductionFields {
  return {
    yieldLossPct: p.yieldLossPct,
    shelfLifeGroup: '',
    halfBatch: p.halfBatch,
    outputContainer: p.unit,
    containersPerBatch: p.unitsPerBatch,
    recipeClass: 'finished',
    equipment: null,
    steps: [],
    method: {},
  };
}

/** Half-batch weights the book wrote down, so switching halves off and on restores them. */
const AUTHORED_HALF_G: Record<string, number> = Object.fromEntries(
  Object.values(COMPONENTS).filter(c => c.batch.halfG !== undefined).map(c => [c.id, c.batch.halfG as number]),
);

/** What the recipe book was written with, by library id. Taken once at load. */
export const AUTHORED_FIELDS: Record<string, FjProductionFields> = {
  ...Object.fromEntries(Object.values(COMPONENTS).map(c => [componentRecipeId(c.id), fieldsOfComponent(c)])),
  ...Object.fromEntries(PRODUCTS.map(p => [productRecipeId(p.id), fieldsOfProduct(p)])),
};

// ─── Library ⇄ fields ────────────────────────────────────────────────────────

export function productionFieldsOf(r: Recipe): FjProductionFields {
  const authored = AUTHORED_FIELDS[r.id];
  const pe = r.formExtras?.productionExtras ?? {};
  return {
    yieldLossPct: typeof pe.yieldLossPct === 'number' ? pe.yieldLossPct : authored?.yieldLossPct ?? 0,
    shelfLifeGroup: (pe.shelfLifeGroup as ShelfLifeGroupId | undefined) ?? authored?.shelfLifeGroup ?? '',
    halfBatch: pe.halfBatch ?? authored?.halfBatch ?? false,
    outputContainer: (pe.outputContainer as ContainerId | undefined) ?? authored?.outputContainer ?? '',
    containersPerBatch: pe.containersPerBatch ?? authored?.containersPerBatch ?? '',
    recipeClass: recipeClassFrom(r.formExtras?.advanced?.productClass)?.id ?? authored?.recipeClass ?? '',
    equipment: pe.requiresEquipment !== undefined ? (pe.requiresEquipment as Equipment[]) : authored?.equipment ?? null,
    steps: stepsFromInstructions(r.formExtras?.instructions) ?? authored?.steps ?? [],
    method: (pe.method as Partial<RecipeMethod> | undefined) ?? authored?.method ?? {},
  };
}

/** The kit a recipe's cook loads are sized against: its override or its class default. */
export function equipmentOf(f: Pick<FjProductionFields, 'recipeClass' | 'equipment'>): Equipment[] {
  return resolveEquipment(f.recipeClass, f.equipment);
}

/** The method the stepper shows: class default with the recipe's own fields on top. */
export function methodOf(f: Pick<FjProductionFields, 'recipeClass' | 'method'>): RecipeMethod {
  return resolveMethod(f.recipeClass, f.method);
}

export function withProductionFields(r: Recipe, f: Partial<FjProductionFields>): Recipe {
  const cur = productionFieldsOf(r);
  const next = { ...cur, ...f };
  const group = next.shelfLifeGroup ? SHELF_LIFE_GROUPS[next.shelfLifeGroup] : undefined;
  const productionExtras = {
    ...(r.formExtras?.productionExtras ?? {}),
    yieldLossPct: next.yieldLossPct,
    shelfLifeGroup: next.shelfLifeGroup,
    halfBatch: next.halfBatch,
    outputContainer: next.outputContainer,
    containersPerBatch: next.containersPerBatch,
    requiresEquipment: next.equipment ?? undefined,
    method: next.method,
  };
  if (next.equipment === null) delete productionExtras.requiresEquipment;
  return {
    ...r,
    production: {
      ...r.production,
      shelfLifeMinutes: group ? group.days * 1440 : r.production.shelfLifeMinutes,
    },
    formExtras: {
      ...(r.formExtras ?? {}),
      instructions: next.steps.join('\n'),
      productionExtras,
      advanced: {
        ...(r.formExtras?.advanced ?? {}),
        productClass: next.recipeClass || undefined,
        ...(group ? { shelfLifeValue: group.days, shelfLifeUnit: 'days' as const } : {}),
      },
    },
  };
}

export function sameFields(a: FjProductionFields, b: FjProductionFields): boolean {
  return a.yieldLossPct === b.yieldLossPct && a.shelfLifeGroup === b.shelfLifeGroup && a.halfBatch === b.halfBatch
    && a.outputContainer === b.outputContainer && a.containersPerBatch === b.containersPerBatch
    && a.recipeClass === b.recipeClass && sameList(a.equipment, b.equipment)
    && a.steps.length === b.steps.length && a.steps.every((x, i) => x === b.steps[i])
    && sameMethod(a.method, b.method);
}

export function sameMethod(a: Partial<RecipeMethod>, b: Partial<RecipeMethod>): boolean {
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])) as (keyof RecipeMethod)[];
  return keys.every(k => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null));
}

// ─── Book → library ──────────────────────────────────────────────────────────

const CATEGORY_BY_GROUP: Record<FinishedProduct['group'], RecipeCategory> = {
  breakfast: 'Food', bases: 'Food', proteins: 'Food', 'hot-sides': 'Food', salads: 'Salad',
};

function ingredientRows(lines: { ref: string; grams: number }[]): Recipe['ingredients'] {
  return lines
    .filter(l => INGREDIENTS[l.ref])
    .map(l => {
      const ing = INGREDIENTS[l.ref];
      return { name: ing.name, qty: `${l.grams}${ing.pack.unit}`, supplier: ing.supplier, price: Math.round(ing.costPerKg * (l.grams / 1000) * 100) / 100 };
    });
}
function subRecipeRows(lines: { ref: string; grams: number }[]): Recipe['subRecipes'] {
  const rows = lines.filter(l => COMPONENTS[l.ref]).map(l => ({ recipeId: componentRecipeId(l.ref), quantityPerUnit: l.grams, unit: 'g' }));
  return rows.length ? rows : undefined;
}
// ─── Bought-in ingredients as master products ───────────────────────────────

export function masterProductId(ingredientId: string): string {
  return `fj-mp-${ingredientId}`;
}

const CATEGORY_BY_SUPPLIER: Record<string, ProductCategory> = {
  'Fresh produce': 'Produce', Butcher: 'Meat', Fish: 'Seafood', Chilled: 'Dairy', 'Dry goods': 'Pantry',
  'Med Cuisine': 'Pantry', 'H&B': 'Pantry', Frozen: 'Other', Tap: 'Other',
};

/** Farmer J's bought-in ingredients, so recipe rows resolve to a name and a cost. */
export function buildFarmerJMasterProducts(): MasterProduct[] {
  return Object.values(INGREDIENTS).map(ing => {
    const unit = /\d\s*(kg|g|ml|l)\b/i.test(ing.pack.label) ? ing.pack.label : `${ing.pack.size}${ing.pack.unit}`;
    return {
      id: masterProductId(ing.id),
      name: ing.name,
      category: CATEGORY_BY_SUPPLIER[ing.supplier] ?? 'Other',
      unit,
      slug: `fj-${ing.id}`,
      productClass: 'Food',
      status: 'Available',
      siteCosts: { 'Farmer J': { wac: Math.round(ing.costPerKg * (ing.pack.size / 1000) * 100) / 100, onHandQty: 1, lastCalculated: 'estimated' } },
    };
  });
}

/** Typed ingredient rows: sub-recipes first (build order), then bought-in. */
function ingredientsV2(lines: { ref: string; grams: number }[]): RecipeIngredient[] {
  const out: RecipeIngredient[] = [];
  for (const l of lines) {
    if (COMPONENTS[l.ref]) out.push({ id: `fj-ri-${l.ref}`, ref: { kind: 'subrecipe', recipeId: componentRecipeId(l.ref) }, baseQty: { value: l.grams, unit: 'g' } });
  }
  for (const l of lines) {
    const ing = INGREDIENTS[l.ref];
    if (ing) out.push({ id: `fj-ri-${l.ref}`, ref: { kind: 'master', masterProductId: masterProductId(l.ref) }, baseQty: { value: l.grams, unit: ing.pack.unit } });
  }
  return out;
}

/** The editor's unified component list, with stable ids so the form opens clean. */
function componentRows(lines: { ref: string; grams: number }[]): ComponentRow[] {
  const out: ComponentRow[] = [];
  for (const l of lines) {
    if (COMPONENTS[l.ref]) out.push({ id: `fj-row-${l.ref}`, kind: 'recipe', recipeId: componentRecipeId(l.ref), qty: l.grams, uom: 'g' });
  }
  for (const l of lines) {
    const ing = INGREDIENTS[l.ref];
    if (ing) out.push({ id: `fj-row-${l.ref}`, kind: 'item', name: ing.name, supplier: ing.supplier, qty: l.grams, uom: ing.pack.unit, unitCostP: Math.round((ing.costPerKg / 10) * 1000) / 1000 });
  }
  return out;
}

/** Pounds of bought-in ingredients in one full batch, walking sub-recipes. */
function batchCost(lines: { ref: string; grams: number }[], depth = 0): number {
  let total = 0;
  for (const l of lines) {
    const ing = INGREDIENTS[l.ref];
    if (ing) { total += ing.costPerKg * (l.grams / 1000); continue; }
    const c = COMPONENTS[l.ref];
    if (c && depth < 6) total += batchCost(c.inputs, depth + 1) * (l.grams / c.batch.fullG);
  }
  return total;
}

function componentToRecipe(c: Component): Recipe {
  const f = fieldsOfComponent(c);
  const group = SHELF_LIFE_GROUPS[c.shelfLife];
  const perKg = batchCost(c.inputs) / (c.batch.fullG / 1000);
  return {
    id: componentRecipeId(c.id),
    name: c.name,
    category: 'Food',
    brand: 'farmerj',
    ingredientCost: Math.round(perKg * 100) / 100,
    priceDineIn: 0, priceTakeaway: 0, priceDelivery: 0, marginPct: 0,
    status: 'Active',
    flag: null,
    ingredients: ingredientRows(c.inputs),
    ingredientsV2: ingredientsV2(c.inputs),
    subRecipes: subRecipeRows(c.inputs),
    posLinked: false,
    production: { visibility: 'Kitchen', shelfLifeMinutes: group.days * 1440, prepTimeSeconds: null },
    kind: 'component',
    isPrep: c.kind === 'prep',
    countInStockTake: c.carryable,
    formExtras: {
      yieldQty: Math.round(c.batch.fullG / 10) / 100, yieldUom: 'kg',
      sites: FJ_SITE_NAMES,
      instructions: c.steps?.join('\n') ?? '',
      components: componentRows(c.inputs),
      productionExtras: {
        visibility: ['Kitchen'],
        productionRef: c.htcCode ?? '',
        tags: [RECIPE_CLASS_BY_ID[f.recipeClass as RecipeClassId].label, group.label],
        minBatch: f.halfBatch ? 0.5 : 1,
        maxBatch: 'unlimited',
        batchMultiple: f.halfBatch ? 0.5 : 1,
        yieldLossPct: f.yieldLossPct,
        shelfLifeGroup: f.shelfLifeGroup,
        halfBatch: f.halfBatch,
        outputContainer: f.outputContainer,
        containersPerBatch: f.containersPerBatch,
        ...(f.equipment ? { requiresEquipment: f.equipment } : {}),
        method: f.method,
      },
      advanced: {
        productClass: f.recipeClass,
        isSubRecipe: true,
        countInStockTake: c.carryable,
        shelfLifeValue: group.days, shelfLifeUnit: 'days',
        allowCarryOver: c.carryable,
      },
    },
  };
}

function productToRecipe(p: FinishedProduct): Recipe {
  const f = fieldsOfProduct(p);
  const perBatch = batchCost(p.recipe);
  return {
    id: productRecipeId(p.id),
    name: p.name,
    category: CATEGORY_BY_GROUP[p.group],
    brand: 'farmerj',
    ingredientCost: Math.round((perBatch / Math.max(1, p.unitsPerBatch)) * 100) / 100,
    priceDineIn: 0, priceTakeaway: 0, priceDelivery: 0, marginPct: 0,
    status: 'Active',
    flag: null,
    ingredients: ingredientRows(p.recipe),
    ingredientsV2: ingredientsV2(p.recipe),
    subRecipes: subRecipeRows(p.recipe),
    posLinked: true,
    production: { visibility: 'Kitchen', shelfLifeMinutes: p.holdMinutes, prepTimeSeconds: null },
    kind: 'assembly',
    formExtras: {
      yieldQty: p.unitsPerBatch, yieldUom: CONTAINERS[p.unit].name.toLowerCase(),
      sites: FJ_SITE_NAMES,
      components: componentRows(p.recipe),
      productionExtras: {
        visibility: ['Kitchen'],
        tags: [p.group],
        minBatch: f.halfBatch ? 0.5 : 1,
        maxBatch: 'unlimited',
        batchMultiple: f.halfBatch ? 0.5 : 1,
        yieldLossPct: f.yieldLossPct,
        shelfLifeGroup: '',
        halfBatch: f.halfBatch,
        outputContainer: f.outputContainer,
        containersPerBatch: f.containersPerBatch,
      },
      advanced: {
        productClass: 'finished',
        isSubRecipe: false,
        shelfLifeValue: Math.round(p.holdMinutes / 60), shelfLifeUnit: 'hours',
        allowCarryOver: Boolean(p.countedAs),
      },
    },
  };
}

export function buildFarmerJRecipes(): Recipe[] {
  return [...PRODUCTS.map(productToRecipe), ...Object.values(COMPONENTS).map(componentToRecipe)];
}

// ─── Library → book ──────────────────────────────────────────────────────────

let appliedJSON = '';

/**
 * Write the library's production fields into the recipe book constants the
 * engines read. Returns true when anything changed. Cheap when nothing did.
 */
export function applyFarmerJRecipes(recipes: Recipe[]): boolean {
  const fj = recipes.filter(r => r.brand === 'farmerj');
  const json = JSON.stringify([METHOD_DEFAULTS, fj.map(r => [r.id, productionFieldsOf(r)])]);
  if (json === appliedJSON) return false;
  appliedJSON = json;
  for (const r of fj) {
    const ref = bookRef(r.id);
    if (!ref) continue;
    const f = productionFieldsOf(r);
    if (ref.kind === 'component') {
      const c = ref.component;
      c.yieldLossPct = f.yieldLossPct;
      if (f.shelfLifeGroup) c.shelfLife = f.shelfLifeGroup;
      c.container = f.outputContainer || undefined;
      c.containersPerBatch = typeof f.containersPerBatch === 'number' ? f.containersPerBatch : undefined;
      c.batch.halfG = f.halfBatch ? AUTHORED_HALF_G[c.id] ?? c.batch.fullG / 2 : undefined;
      c.requiresEquipment = equipmentOf(f);
      // The method the stepper reads. An empty method falls back to the
      // generated weigh / cook / container steps in `stepsForTask`.
      c.steps = f.steps.length ? f.steps : undefined;
      // The method behind the chips: class default with the recipe's own
      // fields on top. Sections timing reads cook, rest and hold from here.
      const m = methodOf(f);
      const from = methodNumber(m.minutesFrom);
      const to = methodNumber(m.minutesTo);
      c.cook = m.programme && from
        ? { programme: m.programme, minutes: to && to !== from ? [from, to] : from, coreTempC: methodNumber(m.coreTempC) }
        : undefined;
      c.restMinutes = methodNumber(m.restMinutes);
      c.holdMinutes = methodNumber(m.holdMinutes);
      const machines = equipmentOf(f).filter(e => e !== 'prep-table' && e !== 'counter').map(e => EQUIPMENT_LABELS[e]);
      const tools = [...machines, ...m.handTools];
      c.equipment = tools.length ? tools : undefined;
    } else {
      const p = ref.product;
      p.yieldLossPct = f.yieldLossPct;
      p.halfBatch = f.halfBatch;
      if (f.outputContainer) p.unit = f.outputContainer;
      if (typeof f.containersPerBatch === 'number' && f.containersPerBatch > 0) p.unitsPerBatch = f.containersPerBatch;
    }
  }
  return true;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export type FjRecipeOverrides = Record<string, Partial<FjProductionFields>>;

export function loadFarmerJOverrides(): FjRecipeOverrides {
  try {
    const raw = window.localStorage.getItem(FJ_RECIPE_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as FjRecipeOverrides) : {};
  } catch {
    return {};
  }
}

/** Store only what differs from the authored book, so a reset is a delete. */
export function saveFarmerJOverrides(recipes: Recipe[]): void {
  const out: FjRecipeOverrides = {};
  for (const r of recipes) {
    if (r.brand !== 'farmerj') continue;
    const authored = AUTHORED_FIELDS[r.id];
    if (!authored) continue;
    const f = productionFieldsOf(r);
    if (!sameFields(f, authored)) out[r.id] = f;
  }
  try {
    if (Object.keys(out).length) window.localStorage.setItem(FJ_RECIPE_OVERRIDES_KEY, JSON.stringify(out));
    else window.localStorage.removeItem(FJ_RECIPE_OVERRIDES_KEY);
  } catch {
    // localStorage unavailable; edits just won't survive a refresh
  }
}

export function applyOverridesToRecipes(recipes: Recipe[], overrides: FjRecipeOverrides): Recipe[] {
  if (!Object.keys(overrides).length) return recipes;
  return recipes.map(r => (overrides[r.id] ? withProductionFields(r, overrides[r.id]) : r));
}
