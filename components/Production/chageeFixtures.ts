/**
 * CHAGEE fixture bundle — a single-client standalone tea store.
 *
 * Same self-contained shape as `./bkFixtures`: it imports ONLY *types* from
 * `./fixtures` (erased at compile time) so there's no runtime import cycle,
 * while `fixtures.ts` imports the data arrays below to make its lookup helpers
 * (getSite / getRecipe / benchesAt / forecastFor / …) brand-aware.
 *
 * Modelling notes
 * ----------------
 * CHAGEE is a *fresh-brew tea bar* — the tea equivalent of the Burger King
 * standalone model:
 *  - No hub, no dispatch — it brews for its own counter only.
 *  - The things that get planned + dropped + held are the BREWED TEA BASES and
 *    prepped TOPPINGS (jasmine green, orchid oolong, cooked tapioca pearls …).
 *    These are what the crew screen counts in / out of the holding urns, and —
 *    critically for CHAGEE's "freshly brewed, never stewed" positioning — each
 *    base has a tight shelf life and is binned when it ages out.
 *  - The assembled drinks (Boya Juexian, Bai Ya Qi Lan …) live in the
 *    menu/recipe library and pull those bases + toppings, but aren't separately
 *    "brewed" — they're built to order at the bar.
 */

import type {
  Bench,
  DemandForecastEntry,
  Estate,
  Format,
  Ingredient,
  IngredientUsage,
  PlannedInstance,
  ProductionItem,
  ProductionRecipe,
  ProductionWorkflow,
  RecipeId,
  Site,
  User,
  UserId,
  WorkflowId,
  WorkType,
} from './fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// Demo clock — CHAGEE runs an afternoon tea-rush scenario so the crew screen
// has visible movement the moment you open it.
// ─────────────────────────────────────────────────────────────────────────────

/** Service window (minutes from midnight) the crew screen schedules across. */
export const CHAGEE_SERVICE_START_MIN = 10 * 60; // 10:00
export const CHAGEE_SERVICE_END_MIN = 22 * 60; // 22:00
/** Where the simulated demo clock starts — straight into the afternoon rush. */
export const CHAGEE_DEMO_START_MIN = 15 * 60 + 10; // 15:10
/** The fixed brew/drop cadence the whole CHAGEE model is built around. */
export const CHAGEE_DROP_INTERVAL_MIN = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Estate / format / site
// ─────────────────────────────────────────────────────────────────────────────

export const CHAGEE_ESTATE: Estate = {
  id: 'estate-chagee',
  name: 'CHAGEE',
  defaults: {
    cutoffTimeForSpokeSubmissions: '09:00',
    forecastHorizonDays: 3,
    carryOverEnabled: false,
  },
};

export const CHAGEE_FORMATS: Format[] = [
  {
    id: 'format-chagee-teahouse',
    estateId: 'estate-chagee',
    name: 'Flagship tea house',
    description:
      'Fresh-brew tea bar. Brews tea bases + preps toppings to holding urns on a 20-min freshness cadence, then builds drinks to order.',
  },
];

export const CHAGEE_SITE_ID = 'chagee-flagship';

export const CHAGEE_SITES: Site[] = [
  {
    id: CHAGEE_SITE_ID,
    estateId: 'estate-chagee',
    formatId: 'format-chagee-teahouse',
    name: 'CHAGEE — Flagship',
    type: 'STANDALONE',
    brand: 'chagee',
    openingHours: { open: '10:00', close: '22:00' },
    // Self-producing: no hub, so the sidebar drops Dispatch automatically.
    linkType: 'self',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Benches (stations) — modelled as benches so the generic plan/board path works
// ─────────────────────────────────────────────────────────────────────────────

export const CHAGEE_BREW_ID = 'chagee-bench-brew';
export const CHAGEE_TOPPING_ID = 'chagee-bench-topping';
export const CHAGEE_ASSEMBLY_ID = 'chagee-bench-assembly';

export const CHAGEE_BENCHES: Bench[] = [
  {
    id: CHAGEE_BREW_ID,
    siteId: CHAGEE_SITE_ID,
    name: 'Tea brew bar',
    capabilities: ['prep', 'pack'],
    workTypes: ['weigh-up', 'mix', 'pack'],
    equipment: ['hob'],
    batchRules: { min: 10, max: 90, multipleOf: 10 },
    online: true,
    primaryMode: 'increment',
  },
  {
    id: CHAGEE_TOPPING_ID,
    siteId: CHAGEE_SITE_ID,
    name: 'Topping prep',
    capabilities: ['prep', 'pack'],
    workTypes: ['mix', 'portion', 'pack'],
    equipment: ['hob'],
    batchRules: { min: 10, max: 80, multipleOf: 10 },
    online: true,
    primaryMode: 'increment',
  },
  {
    id: CHAGEE_ASSEMBLY_ID,
    siteId: CHAGEE_SITE_ID,
    name: 'Build & seal bar',
    capabilities: ['assemble', 'prep', 'pack'],
    workTypes: ['assemble', 'portion', 'pack'],
    equipment: ['blender'],
    batchRules: { min: 1, max: 20, multipleOf: 1 },
    online: true,
    primaryMode: 'increment',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Workflows — short brew / prep chains with real-ish durations
// ─────────────────────────────────────────────────────────────────────────────

export const CHAGEE_WORKFLOWS: Record<WorkflowId, ProductionWorkflow> = {
  'wf-cg-brew': {
    id: 'wf-cg-brew',
    stages: [
      { id: 'cg-weigh', label: 'Weigh out loose-leaf tea', capability: 'prep', workType: 'weigh-up', leadOffset: 0, durationMinutes: 2 },
      { id: 'cg-steep', label: 'Steep at temperature', capability: 'prep', workType: 'mix', requiresEquipment: ['hob'], leadOffset: 0, durationMinutes: 5 },
      { id: 'cg-urn', label: 'Strain & fill holding urn', capability: 'pack', workType: 'pack', leadOffset: 0, durationMinutes: 2 },
    ],
    edges: [
      { from: 'cg-weigh', to: 'cg-steep' },
      { from: 'cg-steep', to: 'cg-urn' },
    ],
  },
  'wf-cg-topping': {
    id: 'wf-cg-topping',
    stages: [
      { id: 'cg-top-prep', label: 'Portion & rinse', capability: 'prep', workType: 'portion', leadOffset: 0, durationMinutes: 2 },
      { id: 'cg-top-cook', label: 'Cook / simmer', capability: 'prep', workType: 'mix', requiresEquipment: ['hob'], leadOffset: 0, durationMinutes: 8 },
      { id: 'cg-top-hold', label: 'Sweeten & move to warmer', capability: 'pack', workType: 'pack', leadOffset: 0, durationMinutes: 2 },
    ],
    edges: [
      { from: 'cg-top-prep', to: 'cg-top-cook' },
      { from: 'cg-top-cook', to: 'cg-top-hold' },
    ],
  },
  // Drinks are built to order at the bar — a single quick step.
  'wf-cg-assemble': {
    id: 'wf-cg-assemble',
    stages: [
      { id: 'cg-build', label: 'Build & seal to order', capability: 'assemble', workType: 'assemble', leadOffset: 0, durationMinutes: 1 },
    ],
    edges: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Recipes — brewed bases + prepped toppings (planned + dropped + held) and the
// assembled drink menu (library only — built to order, pull bases + toppings)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an assembled drink. These are library/menu only — built to order at the
 * bar and never separately "brewed" — so the only thing that matters is which
 * brewed bases (and toppings) they pull from the holding urns.
 */
function cgDrink(
  id: string,
  name: string,
  pulls: { recipeId: RecipeId; quantityPerUnit: number }[],
): ProductionRecipe {
  return {
    id,
    name,
    category: 'Beverage',
    shelfLifeMinutes: null,
    skuId: `sku-${id}`,
    subRecipes: pulls.map(p => ({ recipeId: p.recipeId, quantityPerUnit: p.quantityPerUnit, unit: 'unit' })),
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-cg-assemble',
    defaultMode: 'variable',
  };
}

export const CHAGEE_RECIPES: ProductionRecipe[] = [
  // ─── Brewed tea bases (what the crew brews, holds + bins for freshness) ────
  {
    id: 'cg-jasmine-green',
    name: 'Jasmine green tea base',
    category: 'Beverage',
    shelfLifeMinutes: 180,
    batchRules: { min: 20, max: 90, multipleOf: 10 },
    skuId: 'sku-cg-jasmine-green',
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-cg-brew',
    defaultMode: 'increment',
  },
  {
    id: 'cg-orchid-oolong',
    name: 'Orchid oolong (Bai Ya Qi Lan) base',
    category: 'Beverage',
    shelfLifeMinutes: 240,
    batchRules: { min: 10, max: 70, multipleOf: 10 },
    skuId: 'sku-cg-orchid-oolong',
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-cg-brew',
    defaultMode: 'increment',
  },
  {
    id: 'cg-roasted-oolong',
    name: 'Roasted oolong base',
    category: 'Beverage',
    shelfLifeMinutes: 240,
    batchRules: { min: 10, max: 60, multipleOf: 10 },
    skuId: 'sku-cg-roasted-oolong',
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-cg-brew',
    defaultMode: 'increment',
  },
  {
    id: 'cg-bold-black',
    name: 'Bold black tea base',
    category: 'Beverage',
    shelfLifeMinutes: 240,
    batchRules: { min: 10, max: 60, multipleOf: 10 },
    skuId: 'sku-cg-bold-black',
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-cg-brew',
    defaultMode: 'increment',
  },
  {
    id: 'cg-aged-puer',
    name: "Aged pu'er base",
    category: 'Beverage',
    shelfLifeMinutes: 300,
    batchRules: { min: 10, max: 50, multipleOf: 10 },
    skuId: 'sku-cg-aged-puer',
    allowCarryOver: false,
    selectionTags: ['core', 'afternoon'],
    workflowId: 'wf-cg-brew',
    defaultMode: 'increment',
  },
  {
    id: 'cg-green-base',
    name: 'Signature green tea base (fruit teas)',
    category: 'Beverage',
    shelfLifeMinutes: 180,
    batchRules: { min: 10, max: 70, multipleOf: 10 },
    skuId: 'sku-cg-green-base',
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-cg-brew',
    defaultMode: 'increment',
  },

  // ─── Prepped toppings (cooked + held on their own line) ────────────────────
  {
    id: 'cg-boba',
    name: 'Tapioca pearls (fresh-cooked)',
    category: 'Snack',
    shelfLifeMinutes: 240,
    batchRules: { min: 10, max: 80, multipleOf: 10 },
    skuId: 'sku-cg-boba',
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-cg-topping',
    defaultMode: 'increment',
  },
  {
    id: 'cg-red-bean',
    name: 'Slow-cooked red bean',
    category: 'Snack',
    shelfLifeMinutes: 8 * 60,
    batchRules: { min: 10, max: 40, multipleOf: 10 },
    skuId: 'sku-cg-red-bean',
    allowCarryOver: false,
    selectionTags: ['core', 'afternoon'],
    workflowId: 'wf-cg-topping',
    defaultMode: 'increment',
  },
  {
    id: 'cg-grass-jelly',
    name: 'Herbal grass jelly',
    category: 'Snack',
    shelfLifeMinutes: 8 * 60,
    batchRules: { min: 10, max: 40, multipleOf: 10 },
    skuId: 'sku-cg-grass-jelly',
    allowCarryOver: false,
    selectionTags: ['core', 'afternoon'],
    workflowId: 'wf-cg-topping',
    defaultMode: 'increment',
  },

  // ─── Assembled drink menu (library only — built to order, pull bases) ───────

  // Signature fresh milk teas
  cgDrink('cg-boya-juexian', 'Boya Juexian · Jasmine Green Milk Tea', [{ recipeId: 'cg-jasmine-green', quantityPerUnit: 1 }]),
  cgDrink('cg-baiya-qilan', 'Bai Ya Qi Lan · Orchid Oolong Milk Tea', [{ recipeId: 'cg-orchid-oolong', quantityPerUnit: 1 }]),
  cgDrink('cg-guose-tianxiang', 'Guo Se Tian Xiang · Bold Black Milk Tea', [{ recipeId: 'cg-bold-black', quantityPerUnit: 1 }]),
  cgDrink('cg-roasted-oolong-milk', 'Roasted Oolong Milk Tea', [{ recipeId: 'cg-roasted-oolong', quantityPerUnit: 1 }]),
  cgDrink('cg-puer-milk', "Aged Pu'er Milk Tea", [{ recipeId: 'cg-aged-puer', quantityPerUnit: 1 }]),

  // Milk teas with pearls / toppings
  cgDrink('cg-boya-boba', 'Boya Juexian with Pearls', [
    { recipeId: 'cg-jasmine-green', quantityPerUnit: 1 },
    { recipeId: 'cg-boba', quantityPerUnit: 1 },
  ]),
  cgDrink('cg-qilan-boba', 'Bai Ya Qi Lan with Pearls', [
    { recipeId: 'cg-orchid-oolong', quantityPerUnit: 1 },
    { recipeId: 'cg-boba', quantityPerUnit: 1 },
  ]),
  cgDrink('cg-black-red-bean', 'Bold Black Milk Tea with Red Bean', [
    { recipeId: 'cg-bold-black', quantityPerUnit: 1 },
    { recipeId: 'cg-red-bean', quantityPerUnit: 1 },
  ]),

  // Pure teas (no milk)
  cgDrink('cg-jasmine-pure', 'Jasmine Green Tea (pure)', [{ recipeId: 'cg-jasmine-green', quantityPerUnit: 1 }]),
  cgDrink('cg-oolong-pure', 'Orchid Oolong Tea (pure)', [{ recipeId: 'cg-orchid-oolong', quantityPerUnit: 1 }]),

  // Fruit teas
  cgDrink('cg-peach-oolong', 'Sunset Peach Oolong', [{ recipeId: 'cg-roasted-oolong', quantityPerUnit: 1 }]),
  cgDrink('cg-grapefruit-green', 'Ruby Grapefruit Green Tea', [{ recipeId: 'cg-green-base', quantityPerUnit: 1 }]),
  cgDrink('cg-lychee-green', 'Lychee Blossom Green Tea', [{ recipeId: 'cg-green-base', quantityPerUnit: 1 }]),
  cgDrink('cg-grass-jelly-green', 'Green Tea with Grass Jelly', [
    { recipeId: 'cg-green-base', quantityPerUnit: 1 },
    { recipeId: 'cg-grass-jelly', quantityPerUnit: 1 },
  ]),
];

// ─────────────────────────────────────────────────────────────────────────────
// Production items — every base + topping brews on a 20-minute cadence
// ─────────────────────────────────────────────────────────────────────────────

const CHAGEE_CADENCE = {
  intervalMinutes: CHAGEE_DROP_INTERVAL_MIN,
  startTime: '10:00',
  endTime: '22:00',
  quinnProposed: true,
} as const;

export const CHAGEE_PRODUCTION_ITEMS: ProductionItem[] = [
  { id: 'pi-cg-jasmine-green',  siteId: CHAGEE_SITE_ID, recipeId: 'cg-jasmine-green',  skuId: 'sku-cg-jasmine-green',  mode: 'increment', batchSize: 40, cadence: { ...CHAGEE_CADENCE }, preferredBenchId: CHAGEE_BREW_ID, targetMinutes: 9 },
  { id: 'pi-cg-orchid-oolong',  siteId: CHAGEE_SITE_ID, recipeId: 'cg-orchid-oolong',  skuId: 'sku-cg-orchid-oolong',  mode: 'increment', batchSize: 30, cadence: { ...CHAGEE_CADENCE }, preferredBenchId: CHAGEE_BREW_ID, targetMinutes: 9 },
  { id: 'pi-cg-roasted-oolong', siteId: CHAGEE_SITE_ID, recipeId: 'cg-roasted-oolong', skuId: 'sku-cg-roasted-oolong', mode: 'increment', batchSize: 20, cadence: { ...CHAGEE_CADENCE }, preferredBenchId: CHAGEE_BREW_ID, targetMinutes: 9 },
  { id: 'pi-cg-bold-black',     siteId: CHAGEE_SITE_ID, recipeId: 'cg-bold-black',     skuId: 'sku-cg-bold-black',     mode: 'increment', batchSize: 20, cadence: { ...CHAGEE_CADENCE }, preferredBenchId: CHAGEE_BREW_ID, targetMinutes: 9 },
  { id: 'pi-cg-aged-puer',      siteId: CHAGEE_SITE_ID, recipeId: 'cg-aged-puer',      skuId: 'sku-cg-aged-puer',      mode: 'increment', batchSize: 20, cadence: { ...CHAGEE_CADENCE }, preferredBenchId: CHAGEE_BREW_ID, targetMinutes: 10 },
  { id: 'pi-cg-green-base',     siteId: CHAGEE_SITE_ID, recipeId: 'cg-green-base',     skuId: 'sku-cg-green-base',     mode: 'increment', batchSize: 30, cadence: { ...CHAGEE_CADENCE }, preferredBenchId: CHAGEE_BREW_ID, targetMinutes: 9 },
  // Topping line
  { id: 'pi-cg-boba',           siteId: CHAGEE_SITE_ID, recipeId: 'cg-boba',           skuId: 'sku-cg-boba',           mode: 'increment', batchSize: 40, cadence: { ...CHAGEE_CADENCE }, preferredBenchId: CHAGEE_TOPPING_ID, targetMinutes: 12 },
  { id: 'pi-cg-red-bean',       siteId: CHAGEE_SITE_ID, recipeId: 'cg-red-bean',       skuId: 'sku-cg-red-bean',       mode: 'increment', batchSize: 20, cadence: { ...CHAGEE_CADENCE }, preferredBenchId: CHAGEE_TOPPING_ID, targetMinutes: 12 },
  { id: 'pi-cg-grass-jelly',    siteId: CHAGEE_SITE_ID, recipeId: 'cg-grass-jelly',    skuId: 'sku-cg-grass-jelly',    mode: 'increment', batchSize: 20, cadence: { ...CHAGEE_CADENCE }, preferredBenchId: CHAGEE_TOPPING_ID, targetMinutes: 12 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Forecast — per-base/topping daily demand for the demo day (afternoon-peaked)
// ─────────────────────────────────────────────────────────────────────────────

/** Split a day's units across phases on integer counts that sum exactly. */
function cgPhaseSplit(units: number, w: [number, number, number]) {
  const morning = Math.round(units * w[0]);
  const midday = Math.round(units * w[1]);
  const afternoon = units - morning - midday;
  return { morning, midday, afternoon };
}

/** Afternoon-peaked daypart split for a tea house. */
const CHAGEE_PHASE_DEFAULT: [number, number, number] = [0.2, 0.35, 0.45];

export const CHAGEE_FORECAST: DemandForecastEntry[] = [
  { siteId: CHAGEE_SITE_ID, skuId: 'sku-cg-jasmine-green',  date: '', projectedUnits: 320, byPhase: cgPhaseSplit(320, CHAGEE_PHASE_DEFAULT), signals: [{ signal: 'sales-history', weight: 0.7, note: '4-week median for Thu' }, { signal: 'event', weight: 0.3, note: 'Boya Juexian is the #1 seller' }], status: 'confirmed' },
  { siteId: CHAGEE_SITE_ID, skuId: 'sku-cg-orchid-oolong',  date: '', projectedUnits: 190, byPhase: cgPhaseSplit(190, CHAGEE_PHASE_DEFAULT), signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: CHAGEE_SITE_ID, skuId: 'sku-cg-roasted-oolong', date: '', projectedUnits: 120, byPhase: cgPhaseSplit(120, CHAGEE_PHASE_DEFAULT), signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: CHAGEE_SITE_ID, skuId: 'sku-cg-bold-black',     date: '', projectedUnits: 110, byPhase: cgPhaseSplit(110, CHAGEE_PHASE_DEFAULT), signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: CHAGEE_SITE_ID, skuId: 'sku-cg-aged-puer',      date: '', projectedUnits: 70,  byPhase: cgPhaseSplit(70, [0.12, 0.33, 0.55]),   signals: [{ signal: 'sales-history', weight: 1, note: 'Skews late afternoon' }], status: 'confirmed' },
  { siteId: CHAGEE_SITE_ID, skuId: 'sku-cg-green-base',     date: '', projectedUnits: 160, byPhase: cgPhaseSplit(160, CHAGEE_PHASE_DEFAULT), signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'event', weight: 0.2, note: 'Fruit teas trend in warm weather' }], status: 'confirmed' },
  // Topping line
  { siteId: CHAGEE_SITE_ID, skuId: 'sku-cg-boba',           date: '', projectedUnits: 230, byPhase: cgPhaseSplit(230, CHAGEE_PHASE_DEFAULT), signals: [{ signal: 'sales-history', weight: 0.9, note: 'Attaches to ~1 in 3 drinks' }], status: 'confirmed' },
  { siteId: CHAGEE_SITE_ID, skuId: 'sku-cg-red-bean',       date: '', projectedUnits: 60,  byPhase: cgPhaseSplit(60, CHAGEE_PHASE_DEFAULT),  signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: CHAGEE_SITE_ID, skuId: 'sku-cg-grass-jelly',    date: '', projectedUnits: 50,  byPhase: cgPhaseSplit(50, CHAGEE_PHASE_DEFAULT),  signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Menu forecast layer — the *sellable* drinks menu (what's on the wall),
// separate from the brewed-base model above. The crew screen / drop plan only
// care about the bases + toppings; /forecast speaks operator language ("how
// many Boya Juexian will we sell today"), so it reads this menu list instead.
// These items are forecast-only: NOT added to CHAGEE_PRODUCTION_ITEMS, so they
// never reach the brew/urn loop or the prep sheet.
//
// Prices are à la carte single prices (GBP) off the in-store menu board.
// ─────────────────────────────────────────────────────────────────────────────

type ChageeMenuDef = {
  /** Recipe id stem — sku becomes `sku-${id}`, item `pi-${id}`. */
  id: string;
  name: string;
  category: ProductionRecipe['category'];
  /** À la carte single price, GBP. */
  price: number;
  /** Projected units for the demo day. */
  units: number;
  /** Phase weights [morning, midday, afternoon]; defaults to afternoon-peak. */
  phase?: [number, number, number];
  signals?: { signal: DemandForecastEntry['signals'][number]['signal']; weight: number; note?: string }[];
};

const CHAGEE_MENU_SIGNAL_DEFAULT: ChageeMenuDef['signals'] = [
  { signal: 'sales-history', weight: 1, note: '4-week median for this weekday' },
];

/**
 * Source-of-truth drinks menu. Everything below (recipes, sellable items,
 * forecast, price map) is derived from this so the views can't drift.
 */
const CHAGEE_MENU_DEFS: ChageeMenuDef[] = [
  // ─── Signature fresh milk teas ─────────────────────────────────────────────
  { id: 'cg-boya-juexian', name: 'Boya Juexian · Jasmine Green Milk Tea', category: 'Beverage', price: 4.8, units: 210, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'event', weight: 0.3, note: '#1 signature' }] },
  { id: 'cg-baiya-qilan', name: 'Bai Ya Qi Lan · Orchid Oolong Milk Tea', category: 'Beverage', price: 4.8, units: 150 },
  { id: 'cg-guose-tianxiang', name: 'Guo Se Tian Xiang · Bold Black Milk Tea', category: 'Beverage', price: 4.6, units: 95 },
  { id: 'cg-roasted-oolong-milk', name: 'Roasted Oolong Milk Tea', category: 'Beverage', price: 4.6, units: 80 },
  { id: 'cg-puer-milk', name: "Aged Pu'er Milk Tea", category: 'Beverage', price: 5.0, units: 60, phase: [0.12, 0.33, 0.55] },
  // ─── Milk teas with toppings ───────────────────────────────────────────────
  { id: 'cg-boya-boba', name: 'Boya Juexian with Pearls', category: 'Beverage', price: 5.4, units: 130 },
  { id: 'cg-qilan-boba', name: 'Bai Ya Qi Lan with Pearls', category: 'Beverage', price: 5.4, units: 70 },
  { id: 'cg-black-red-bean', name: 'Bold Black Milk Tea with Red Bean', category: 'Beverage', price: 5.6, units: 45 },
  // ─── Pure teas ─────────────────────────────────────────────────────────────
  { id: 'cg-jasmine-pure', name: 'Jasmine Green Tea (pure)', category: 'Beverage', price: 3.8, units: 70 },
  { id: 'cg-oolong-pure', name: 'Orchid Oolong Tea (pure)', category: 'Beverage', price: 3.8, units: 50 },
  // ─── Fruit teas ────────────────────────────────────────────────────────────
  { id: 'cg-peach-oolong', name: 'Sunset Peach Oolong', category: 'Beverage', price: 5.2, units: 85 },
  { id: 'cg-grapefruit-green', name: 'Ruby Grapefruit Green Tea', category: 'Beverage', price: 5.2, units: 75 },
  { id: 'cg-lychee-green', name: 'Lychee Blossom Green Tea', category: 'Beverage', price: 5.2, units: 60 },
  { id: 'cg-grass-jelly-green', name: 'Green Tea with Grass Jelly', category: 'Beverage', price: 5.0, units: 40 },
];

export const CHAGEE_MENU_RECIPES: ProductionRecipe[] = CHAGEE_MENU_DEFS.map(d => ({
  id: d.id,
  name: d.name,
  category: d.category,
  shelfLifeMinutes: null,
  skuId: `sku-${d.id}`,
  allowCarryOver: false,
  selectionTags: ['core', 'midday', 'afternoon'],
  workflowId: 'wf-cg-assemble',
  defaultMode: 'variable',
}));

export const CHAGEE_MENU_ITEMS: ProductionItem[] = CHAGEE_MENU_DEFS.map(d => ({
  id: `pi-${d.id}`,
  siteId: CHAGEE_SITE_ID,
  recipeId: d.id,
  skuId: `sku-${d.id}`,
  mode: 'variable',
  batchSize: 1,
}));

export const CHAGEE_MENU_FORECAST: DemandForecastEntry[] = CHAGEE_MENU_DEFS.map(d => ({
  siteId: CHAGEE_SITE_ID,
  skuId: `sku-${d.id}`,
  date: '',
  projectedUnits: d.units,
  byPhase: cgPhaseSplit(d.units, d.phase ?? CHAGEE_PHASE_DEFAULT),
  signals: d.signals ?? CHAGEE_MENU_SIGNAL_DEFAULT,
  status: 'confirmed',
}));

/** À la carte single price (GBP) keyed by sellable SKU. */
export const CHAGEE_MENU_PRICES: Record<string, number> = Object.fromEntries(
  CHAGEE_MENU_DEFS.map(d => [`sku-${d.id}`, d.price]),
);

// ─────────────────────────────────────────────────────────────────────────────
// Ingredients (for the recipe library + crew stepper component lists)
// NOTE: deliberately NOT wired into the ingredient stock-cap model, so CHAGEE
// recipes never get capped to zero by a missing stock snapshot.
// ─────────────────────────────────────────────────────────────────────────────

export const CHAGEE_INGREDIENTS: Ingredient[] = [
  { id: 'ing-cg-jasmine',   name: 'Jasmine green tea leaf',   canonicalUnit: 'g',    category: 'pantry'    },
  { id: 'ing-cg-oolong',    name: 'Orchid oolong tea leaf',   canonicalUnit: 'g',    category: 'pantry'    },
  { id: 'ing-cg-roasted',   name: 'Roasted oolong tea leaf',  canonicalUnit: 'g',    category: 'pantry'    },
  { id: 'ing-cg-black',     name: 'Bold black tea leaf',      canonicalUnit: 'g',    category: 'pantry'    },
  { id: 'ing-cg-puer',      name: "Aged pu'er tea leaf",      canonicalUnit: 'g',    category: 'pantry'    },
  { id: 'ing-cg-milk',      name: 'Fresh whole milk',         canonicalUnit: 'ml',   category: 'dairy'     },
  { id: 'ing-cg-tapioca',   name: 'Tapioca pearls (dry)',     canonicalUnit: 'g',    category: 'pantry'    },
  { id: 'ing-cg-brown-sugar', name: 'Brown sugar syrup',      canonicalUnit: 'ml',   category: 'pantry'    },
  { id: 'ing-cg-red-bean',  name: 'Adzuki red beans',         canonicalUnit: 'g',    category: 'pantry'    },
  { id: 'ing-cg-grass-jelly', name: 'Grass jelly powder',     canonicalUnit: 'g',    category: 'pantry'    },
  { id: 'ing-cg-peach',     name: 'Peach purée',              canonicalUnit: 'ml',   category: 'produce'   },
  { id: 'ing-cg-grapefruit',name: 'Ruby grapefruit',          canonicalUnit: 'unit', category: 'produce'   },
  { id: 'ing-cg-lychee',    name: 'Lychee purée',             canonicalUnit: 'ml',   category: 'produce'   },
  { id: 'ing-cg-cup',       name: 'Sealed cup + lid (500ml)', canonicalUnit: 'unit', category: 'packaging' },
];

export const CHAGEE_INGREDIENT_USAGE: IngredientUsage[] = [
  { recipeId: 'cg-jasmine-green',  ingredientId: 'ing-cg-jasmine', quantityPerUnit: 4, unit: 'g' },
  { recipeId: 'cg-orchid-oolong',  ingredientId: 'ing-cg-oolong',  quantityPerUnit: 4, unit: 'g' },
  { recipeId: 'cg-roasted-oolong', ingredientId: 'ing-cg-roasted', quantityPerUnit: 4, unit: 'g' },
  { recipeId: 'cg-bold-black',     ingredientId: 'ing-cg-black',   quantityPerUnit: 4, unit: 'g' },
  { recipeId: 'cg-aged-puer',      ingredientId: 'ing-cg-puer',    quantityPerUnit: 5, unit: 'g' },
  { recipeId: 'cg-green-base',     ingredientId: 'ing-cg-jasmine', quantityPerUnit: 3, unit: 'g' },
  { recipeId: 'cg-boba',           ingredientId: 'ing-cg-tapioca', quantityPerUnit: 30, unit: 'g' },
  { recipeId: 'cg-red-bean',       ingredientId: 'ing-cg-red-bean',quantityPerUnit: 25, unit: 'g' },
  { recipeId: 'cg-grass-jelly',    ingredientId: 'ing-cg-grass-jelly', quantityPerUnit: 8, unit: 'g' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Stations view — drives the crew NOW / NEXT / HAVE screen
// ─────────────────────────────────────────────────────────────────────────────

export type ChageeStationId = string;

export type ChageeStation = {
  id: ChageeStationId;
  /** Short name the crew reads at a glance. */
  name: string;
  /** Sub-label / what the station handles. */
  caption: string;
  /** Accent colour for the station header. */
  accent: string;
  /** Recipe ids brewed + held at this station, in display order. */
  recipeIds: RecipeId[];
};

/** CHAGEE red — matches demoConfig accent. */
const CHAGEE_RED = '#A4123F';

export const CHAGEE_LINES: ChageeStation[] = [
  {
    id: CHAGEE_BREW_ID,
    name: 'Tea brew bar',
    caption: 'Fresh-brewed tea bases',
    accent: CHAGEE_RED,
    recipeIds: ['cg-jasmine-green', 'cg-orchid-oolong', 'cg-roasted-oolong', 'cg-bold-black', 'cg-aged-puer', 'cg-green-base'],
  },
  {
    id: CHAGEE_TOPPING_ID,
    name: 'Toppings',
    caption: 'Pearls, red bean & grass jelly',
    accent: '#7A5C1E',
    recipeIds: ['cg-boba', 'cg-red-bean', 'cg-grass-jelly'],
  },
];

export const CHAGEE_STATIONS: ChageeStation[] = CHAGEE_LINES;

/** Map a recipe id to the station/line that brews it. */
export function chageeStationForRecipe(recipeId: RecipeId): ChageeStation | undefined {
  return CHAGEE_STATIONS.find(s => s.recipeIds.includes(recipeId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Holding urns — initial seed state (counts decay live in the crew loop store)
// ─────────────────────────────────────────────────────────────────────────────

export type ChageeHolderSeed = {
  recipeId: RecipeId;
  /** Servings currently in the urn / warmer. */
  count: number;
  /** How long ago (demo minutes) the batch was brewed — drives time-to-bin. */
  cookedMinAgo: number;
};

export const CHAGEE_HOLDER_SEED: ChageeHolderSeed[] = [
  { recipeId: 'cg-jasmine-green',  count: 18, cookedMinAgo: 22 },
  { recipeId: 'cg-orchid-oolong',  count: 12, cookedMinAgo: 35 },
  { recipeId: 'cg-roasted-oolong', count: 8,  cookedMinAgo: 40 },
  { recipeId: 'cg-bold-black',     count: 7,  cookedMinAgo: 28 },
  { recipeId: 'cg-aged-puer',      count: 5,  cookedMinAgo: 18 },
  { recipeId: 'cg-green-base',     count: 10, cookedMinAgo: 30 },
  // Topping line
  { recipeId: 'cg-boba',           count: 16, cookedMinAgo: 25 },
  { recipeId: 'cg-red-bean',       count: 6,  cookedMinAgo: 45 },
  { recipeId: 'cg-grass-jelly',    count: 5,  cookedMinAgo: 50 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Brew specs — the heart of CHAGEE's planning problem.
//
// Every base/topping has a LEAD TIME: the minutes from the moment the crew
// START a batch to the moment it's actually ready to serve — weigh + steep +
// (crucially) cool/settle to serving temperature, or a long simmer/set. Some
// run to ~2 hours. That's exactly why a plain "make it when you run low" board
// fails here: by the time you notice you're low, you're two hours from a
// refill. The brew line back-schedules from the forecast against these leads so
// the crew know when to START, not just what to make.
//
// `servingsPerBatch` is the yield of one standard batch (a filled urn / warmer
// pan). Batch sizing rules (min/max/step) live on each recipe's `batchRules`.
// ─────────────────────────────────────────────────────────────────────────────

export type ChageeBrewSpec = {
  recipeId: RecipeId;
  lineId: ChageeStationId;
  /** Minutes from START → READY-to-serve (weigh + steep + cool/settle/simmer). */
  leadMinutes: number;
  /** Servings yielded by one standard batch (one filled urn / warmer). */
  servingsPerBatch: number;
  /** True for the long brews a manager must plan hours ahead for (≥ 75 min). */
  longLead: boolean;
  /** Glanceable reason the lead time is what it is. */
  leadNote: string;
};

export const CHAGEE_BREW_SPECS: ChageeBrewSpec[] = [
  // ─── Brewed tea bases ──────────────────────────────────────────────────────
  { recipeId: 'cg-jasmine-green',  lineId: CHAGEE_BREW_ID,    leadMinutes: 40,  servingsPerBatch: 40, longLead: false, leadNote: 'Steep 5 min, then cool to iced-serve temp' },
  { recipeId: 'cg-orchid-oolong',  lineId: CHAGEE_BREW_ID,    leadMinutes: 55,  servingsPerBatch: 30, longLead: false, leadNote: 'Steep 5 min, longer cool-down for oolong' },
  { recipeId: 'cg-roasted-oolong', lineId: CHAGEE_BREW_ID,    leadMinutes: 90,  servingsPerBatch: 20, longLead: true,  leadNote: 'Deep-roast needs a long settle before service' },
  { recipeId: 'cg-bold-black',     lineId: CHAGEE_BREW_ID,    leadMinutes: 55,  servingsPerBatch: 20, longLead: false, leadNote: 'Steep 5 min, then cool' },
  { recipeId: 'cg-aged-puer',      lineId: CHAGEE_BREW_ID,    leadMinutes: 120, servingsPerBatch: 20, longLead: true,  leadNote: 'Rinse, long steep and full cool — ~2 hours' },
  { recipeId: 'cg-green-base',     lineId: CHAGEE_BREW_ID,    leadMinutes: 40,  servingsPerBatch: 30, longLead: false, leadNote: 'Steep 4 min, cool for fruit-tea builds' },
  // ─── Prepped toppings ──────────────────────────────────────────────────────
  { recipeId: 'cg-boba',           lineId: CHAGEE_TOPPING_ID, leadMinutes: 45,  servingsPerBatch: 40, longLead: false, leadNote: 'Cook 25 min, rest, coat in syrup' },
  { recipeId: 'cg-red-bean',       lineId: CHAGEE_TOPPING_ID, leadMinutes: 120, servingsPerBatch: 20, longLead: true,  leadNote: 'Slow simmer to soft — ~2 hours' },
  { recipeId: 'cg-grass-jelly',    lineId: CHAGEE_TOPPING_ID, leadMinutes: 80,  servingsPerBatch: 20, longLead: true,  leadNote: 'Heat, pour to set, then chill' },
];

/** Lookup a brew spec by recipe id. */
export function chageeBrewSpec(recipeId: RecipeId): ChageeBrewSpec | undefined {
  return CHAGEE_BREW_SPECS.find(s => s.recipeId === recipeId);
}

// ─────────────────────────────────────────────────────────────────────────────
// PCR (Production Compliance Record) — brewed/prepped batches awaiting a
// manager's quality sign-off. CHAGEE brews on a live increment cadence, which
// the generic board planner deliberately doesn't schedule as instances (the
// brew line owns that). So the PCR queue is seeded here directly: a realistic
// afternoon of finished tea/topping batches the manager needs to check
// (taste, temperature, freshness label) before they go on the bar.
//
// `EXTRA_PRODUCTION_INSTANCES_BY_SITE` (in fixtures.ts) splices these into the
// board plan for the flagship, and the PCR page turns each into a batch:
// finished before the CHAGEE "now" → Awaiting review; a few are pre-signed /
// failed via the seeded drafts in fixtures.ts to fill the other sections.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Team — the crew who run the brew bar and topping station. Names match the
// PCR sign-off roster. Kwame manages; the rest work the floor. Used by the
// productivity report (leaderboard / batch detail) via getUser().
// ─────────────────────────────────────────────────────────────────────────────

export const CHAGEE_USERS: User[] = [
  { id: 'user-cg-mgr', name: 'Kwame — Manager, CHAGEE Flagship', role: 'Manager', siteId: CHAGEE_SITE_ID },
  { id: 'user-cg-1',   name: 'Mei Ling — Staff, CHAGEE Flagship', role: 'Staff', siteId: CHAGEE_SITE_ID },
  { id: 'user-cg-2',   name: 'Arun — Staff, CHAGEE Flagship',     role: 'Staff', siteId: CHAGEE_SITE_ID },
  { id: 'user-cg-3',   name: 'Sofia — Staff, CHAGEE Flagship',    role: 'Staff', siteId: CHAGEE_SITE_ID },
  { id: 'user-cg-4',   name: 'Yuki — Staff, CHAGEE Flagship',     role: 'Staff', siteId: CHAGEE_SITE_ID },
];

/** Who works which station (round-robined by the batch generator). */
export const CHAGEE_BREW_STAFF: UserId[] = ['user-cg-1', 'user-cg-2', 'user-cg-3'];
export const CHAGEE_TOPPING_STAFF: UserId[] = ['user-cg-3', 'user-cg-4'];

/** The clock the PCR queue reads for CHAGEE — mid-afternoon tea service. */
export const CHAGEE_PCR_NOW_HHMM = '17:05';

export const CHAGEE_PCR_INSTANCES: PlannedInstance[] = [
  // ── Tea brew bar ──────────────────────────────────────────────────────────
  { id: 'pi-cg-pcr-jasmine-1450',  productionItemId: 'pi-cg-jasmine-green',  stageId: 'cg-urn', date: '', startTime: '14:50', endTime: '15:00', benchId: CHAGEE_BREW_ID,    plannedQty: 40 },
  { id: 'pi-cg-pcr-puer-1500',     productionItemId: 'pi-cg-aged-puer',      stageId: 'cg-urn', date: '', startTime: '15:00', endTime: '15:20', benchId: CHAGEE_BREW_ID,    plannedQty: 20 },
  { id: 'pi-cg-pcr-orchid-1510',   productionItemId: 'pi-cg-orchid-oolong',  stageId: 'cg-urn', date: '', startTime: '15:10', endTime: '15:20', benchId: CHAGEE_BREW_ID,    plannedQty: 30 },
  { id: 'pi-cg-pcr-green-1540',    productionItemId: 'pi-cg-green-base',     stageId: 'cg-urn', date: '', startTime: '15:40', endTime: '15:50', benchId: CHAGEE_BREW_ID,    plannedQty: 30 },
  { id: 'pi-cg-pcr-black-1600',    productionItemId: 'pi-cg-bold-black',     stageId: 'cg-urn', date: '', startTime: '16:00', endTime: '16:10', benchId: CHAGEE_BREW_ID,    plannedQty: 20 },
  { id: 'pi-cg-pcr-roasted-1620',  productionItemId: 'pi-cg-roasted-oolong', stageId: 'cg-urn', date: '', startTime: '16:20', endTime: '16:35', benchId: CHAGEE_BREW_ID,    plannedQty: 20 },
  // ── Topping prep ──────────────────────────────────────────────────────────
  { id: 'pi-cg-pcr-redbean-1445',  productionItemId: 'pi-cg-red-bean',       stageId: 'cg-top-hold', date: '', startTime: '14:45', endTime: '15:05', benchId: CHAGEE_TOPPING_ID, plannedQty: 20 },
  { id: 'pi-cg-pcr-boba-1505',     productionItemId: 'pi-cg-boba',           stageId: 'cg-top-hold', date: '', startTime: '15:05', endTime: '15:20', benchId: CHAGEE_TOPPING_ID, plannedQty: 40 },
  { id: 'pi-cg-pcr-grassjelly-1600', productionItemId: 'pi-cg-grass-jelly',  stageId: 'cg-top-hold', date: '', startTime: '16:00', endTime: '16:15', benchId: CHAGEE_TOPPING_ID, plannedQty: 20 },
  // ── Still to come (planned — sits ahead of "now", not yet awaiting) ────────
  { id: 'pi-cg-pcr-jasmine-1720',  productionItemId: 'pi-cg-jasmine-green',  stageId: 'cg-urn', date: '', startTime: '17:20', endTime: '17:30', benchId: CHAGEE_BREW_ID,    plannedQty: 40 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Crew stepper — glanceable brew steps the floor sees per base/topping
// ─────────────────────────────────────────────────────────────────────────────

export type ChageeCrewStep = {
  label: string;
  detail: string;
  /** Seconds the step takes — drives the stepper timer. */
  seconds: number;
  workType: WorkType;
};

export const CHAGEE_CREW_STEPS: Record<RecipeId, ChageeCrewStep[]> = {
  'cg-jasmine-green': [
    { label: 'Weigh', detail: 'Weigh jasmine green leaf for the batch', seconds: 40, workType: 'weigh-up' },
    { label: 'Steep', detail: 'Steep at 85°C — pull on time, never stew', seconds: 300, workType: 'mix' },
    { label: 'Strain & fill', detail: 'Strain, fill the urn, start the freshness timer', seconds: 60, workType: 'pack' },
  ],
  'cg-orchid-oolong': [
    { label: 'Weigh', detail: 'Weigh orchid oolong leaf', seconds: 40, workType: 'weigh-up' },
    { label: 'Steep', detail: 'Steep at 90°C', seconds: 300, workType: 'mix' },
    { label: 'Strain & fill', detail: 'Strain, fill the urn', seconds: 60, workType: 'pack' },
  ],
  'cg-roasted-oolong': [
    { label: 'Weigh', detail: 'Weigh roasted oolong leaf', seconds: 40, workType: 'weigh-up' },
    { label: 'Steep', detail: 'Steep at 95°C', seconds: 300, workType: 'mix' },
    { label: 'Strain & fill', detail: 'Strain, fill the urn', seconds: 60, workType: 'pack' },
  ],
  'cg-bold-black': [
    { label: 'Weigh', detail: 'Weigh bold black leaf', seconds: 40, workType: 'weigh-up' },
    { label: 'Steep', detail: 'Steep at 95°C', seconds: 300, workType: 'mix' },
    { label: 'Strain & fill', detail: 'Strain, fill the urn', seconds: 60, workType: 'pack' },
  ],
  'cg-aged-puer': [
    { label: 'Weigh', detail: "Weigh aged pu'er leaf", seconds: 45, workType: 'weigh-up' },
    { label: 'Steep', detail: 'Rinse then steep at 95°C', seconds: 360, workType: 'mix' },
    { label: 'Strain & fill', detail: 'Strain, fill the urn', seconds: 60, workType: 'pack' },
  ],
  'cg-green-base': [
    { label: 'Weigh', detail: 'Weigh green tea leaf for fruit teas', seconds: 35, workType: 'weigh-up' },
    { label: 'Steep', detail: 'Steep at 80°C — bright, not bitter', seconds: 240, workType: 'mix' },
    { label: 'Strain & fill', detail: 'Strain, fill the urn', seconds: 60, workType: 'pack' },
  ],
  'cg-boba': [
    { label: 'Boil', detail: 'Drop pearls into rolling water', seconds: 60, workType: 'portion' },
    { label: 'Cook & rest', detail: 'Cook 25 min, rest covered', seconds: 420, workType: 'mix' },
    { label: 'Sweeten & hold', detail: 'Drain, coat in brown sugar syrup, hold warm', seconds: 90, workType: 'pack' },
  ],
  'cg-red-bean': [
    { label: 'Rinse', detail: 'Rinse soaked adzuki beans', seconds: 60, workType: 'portion' },
    { label: 'Simmer', detail: 'Simmer until soft, sweeten', seconds: 480, workType: 'mix' },
    { label: 'Hold', detail: 'Move to the warmer', seconds: 60, workType: 'pack' },
  ],
  'cg-grass-jelly': [
    { label: 'Whisk', detail: 'Whisk grass jelly powder with water', seconds: 60, workType: 'portion' },
    { label: 'Set', detail: 'Heat, pour to set, then cube', seconds: 420, workType: 'mix' },
    { label: 'Hold', detail: 'Chill and hold', seconds: 60, workType: 'pack' },
  ],
};
