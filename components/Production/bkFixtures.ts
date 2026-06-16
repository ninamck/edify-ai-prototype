/**
 * Burger King fixture bundle — a second brand in the production prototype.
 *
 * This file is intentionally self-contained: it imports ONLY *types* from
 * `./fixtures` (erased at compile time) so there's no runtime import cycle
 * even though `fixtures.ts` imports the data arrays below to make its
 * lookup helpers (getSite / getRecipe / benchesAt / …) brand-aware.
 *
 * Modelling notes
 * ----------------
 * Burger King is a *standalone hot-production* site:
 *  - No hub, no dispatch — it cooks for its own counter only.
 *  - No benches in the Pret sense; it has flame-broiler + build *stations*
 *    that drop fresh batches on a fixed 15-minute cadence ("increment" mode).
 *  - The things that get planned + dropped + held are the COOK COMPONENTS
 *    (beef patties, chicken fillet, bacon, cheese-melted patties) — these
 *    are what the crew screen counts in / out of the holding cabinet. The
 *    assembled burgers (Whopper, Cheeseburger, …) live in the menu/recipe
 *    library and pull those components, but aren't separately "dropped".
 */

import type {
  Bench,
  DemandForecastEntry,
  Estate,
  Format,
  Ingredient,
  IngredientUsage,
  ProductionItem,
  ProductionRecipe,
  ProductionWorkflow,
  RecipeId,
  Site,
  WorkflowId,
  WorkType,
} from './fixtures';

/** Brand discriminator shared with the fixture `Site` type. */
export type Brand = 'pret' | 'bk';

// ─────────────────────────────────────────────────────────────────────────────
// Demo clock — Burger King runs its own lunch-rush scenario so the crew
// screen has visible movement the moment you open it.
// ─────────────────────────────────────────────────────────────────────────────

/** Service window (minutes from midnight) the crew screen schedules across. */
export const BK_SERVICE_START_MIN = 11 * 60; // 11:00
export const BK_SERVICE_END_MIN = 21 * 60; // 21:00
/** Where the simulated demo clock starts — straight into the lunch rush. */
export const BK_DEMO_START_MIN = 12 * 60 + 5; // 12:05
/** The fixed drop cadence the whole BK model is built around. */
export const BK_DROP_INTERVAL_MIN = 15;

// ─────────────────────────────────────────────────────────────────────────────
// Estate / format / site
// ─────────────────────────────────────────────────────────────────────────────

export const BK_ESTATE: Estate = {
  id: 'estate-bk',
  name: 'Burger King UK',
  defaults: {
    cutoffTimeForSpokeSubmissions: '09:00',
    forecastHorizonDays: 3,
    carryOverEnabled: false,
  },
};

export const BK_FORMATS: Format[] = [
  {
    id: 'format-bk-restaurant',
    estateId: 'estate-bk',
    name: 'High-street restaurant',
    description: 'Flame-broiler line + build station. Cooks to a holding cabinet on a 15-min drop cadence.',
  },
];

export const BK_SITE_ID = 'bk-stratford';

export const BK_SITES: Site[] = [
  {
    id: BK_SITE_ID,
    estateId: 'estate-bk',
    formatId: 'format-bk-restaurant',
    name: 'Burger King — Stratford',
    type: 'STANDALONE',
    brand: 'bk',
    openingHours: { open: '10:30', close: '23:00' },
    // Self-producing: no hub, so the sidebar drops Dispatch automatically.
    linkType: 'self',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Stations (modelled as benches so the generic plan/board path still works)
// ─────────────────────────────────────────────────────────────────────────────

export const BK_BROILER_ID = 'bk-bench-broiler';
export const BK_ASSEMBLY_ID = 'bk-bench-assembly';

export const BK_BENCHES: Bench[] = [
  {
    id: BK_BROILER_ID,
    siteId: BK_SITE_ID,
    name: 'Flame broiler',
    capabilities: ['oven', 'prep'],
    workTypes: ['grill', 'portion'],
    equipment: ['griddle'],
    batchRules: { min: 2, max: 24, multipleOf: 2 },
    online: true,
    primaryMode: 'increment',
  },
  {
    id: BK_ASSEMBLY_ID,
    siteId: BK_SITE_ID,
    name: 'Build & cheese station',
    capabilities: ['assemble', 'prep'],
    workTypes: ['assemble', 'grill', 'portion'],
    equipment: ['panini-press', 'prep-table'],
    batchRules: { min: 2, max: 20, multipleOf: 1 },
    online: true,
    primaryMode: 'increment',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Workflows — short cook chains with real-ish durations
// ─────────────────────────────────────────────────────────────────────────────

export const BK_WORKFLOWS: Record<WorkflowId, ProductionWorkflow> = {
  'wf-bk-broil': {
    id: 'wf-bk-broil',
    stages: [
      { id: 'bk-load', label: 'Load patties on the broiler', capability: 'prep', workType: 'portion', leadOffset: 0, durationMinutes: 1 },
      { id: 'bk-broil', label: 'Flame-broil', capability: 'oven', workType: 'grill', requiresEquipment: ['griddle'], leadOffset: 0, durationMinutes: 4 },
      { id: 'bk-hold', label: 'Move to holding cabinet', capability: 'pack', workType: 'pack', leadOffset: 0, durationMinutes: 1 },
    ],
    edges: [
      { from: 'bk-load', to: 'bk-broil' },
      { from: 'bk-broil', to: 'bk-hold' },
    ],
  },
  'wf-bk-chicken': {
    id: 'wf-bk-chicken',
    stages: [
      { id: 'bk-chk-prep', label: 'Lay out fillets', capability: 'prep', workType: 'portion', leadOffset: 0, durationMinutes: 1 },
      { id: 'bk-chk-cook', label: 'Fry crispy chicken', capability: 'oven', workType: 'grill', leadOffset: 0, durationMinutes: 6 },
      { id: 'bk-chk-hold', label: 'Move to holding cabinet', capability: 'pack', workType: 'pack', leadOffset: 0, durationMinutes: 1 },
    ],
    edges: [
      { from: 'bk-chk-prep', to: 'bk-chk-cook' },
      { from: 'bk-chk-cook', to: 'bk-chk-hold' },
    ],
  },
  'wf-bk-bacon': {
    id: 'wf-bk-bacon',
    stages: [
      { id: 'bk-bacon-cook', label: 'Grill smoked bacon', capability: 'oven', workType: 'grill', leadOffset: 0, durationMinutes: 4 },
      { id: 'bk-bacon-hold', label: 'Move to holding cabinet', capability: 'pack', workType: 'pack', leadOffset: 0, durationMinutes: 1 },
    ],
    edges: [{ from: 'bk-bacon-cook', to: 'bk-bacon-hold' }],
  },
  'wf-bk-cheese': {
    id: 'wf-bk-cheese',
    stages: [
      { id: 'bk-cheese-place', label: 'Cap patty with cheese', capability: 'assemble', workType: 'assemble', leadOffset: 0, durationMinutes: 1 },
      { id: 'bk-cheese-melt', label: 'Melt under salamander', capability: 'oven', workType: 'grill', requiresEquipment: ['panini-press'], leadOffset: 0, durationMinutes: 2 },
      { id: 'bk-cheese-hold', label: 'Move to holding cabinet', capability: 'pack', workType: 'pack', leadOffset: 0, durationMinutes: 1 },
    ],
    edges: [
      { from: 'bk-cheese-place', to: 'bk-cheese-melt' },
      { from: 'bk-cheese-melt', to: 'bk-cheese-hold' },
    ],
  },
  'wf-bk-angus': {
    id: 'wf-bk-angus',
    stages: [
      { id: 'bk-angus-load', label: 'Load Angus patties', capability: 'prep', workType: 'portion', leadOffset: 0, durationMinutes: 1 },
      { id: 'bk-angus-broil', label: 'Flame-broil thick patty', capability: 'oven', workType: 'grill', requiresEquipment: ['griddle'], leadOffset: 0, durationMinutes: 6 },
      { id: 'bk-angus-hold', label: 'Move to holding cabinet', capability: 'pack', workType: 'pack', leadOffset: 0, durationMinutes: 1 },
    ],
    edges: [
      { from: 'bk-angus-load', to: 'bk-angus-broil' },
      { from: 'bk-angus-broil', to: 'bk-angus-hold' },
    ],
  },
  // Plant-based patties cook on a dedicated zone to keep them separate.
  'wf-bk-plant': {
    id: 'wf-bk-plant',
    stages: [
      { id: 'bk-plant-load', label: 'Load plant-based patties', capability: 'prep', workType: 'portion', leadOffset: 0, durationMinutes: 1 },
      { id: 'bk-plant-broil', label: 'Flame-broil (separate zone)', capability: 'oven', workType: 'grill', requiresEquipment: ['griddle'], leadOffset: 0, durationMinutes: 4 },
      { id: 'bk-plant-hold', label: 'Move to holding cabinet', capability: 'pack', workType: 'pack', leadOffset: 0, durationMinutes: 1 },
    ],
    edges: [
      { from: 'bk-plant-load', to: 'bk-plant-broil' },
      { from: 'bk-plant-broil', to: 'bk-plant-hold' },
    ],
  },
  // Assembled burgers are built to order at the counter — a single quick step.
  'wf-bk-assemble': {
    id: 'wf-bk-assemble',
    stages: [
      { id: 'bk-build', label: 'Build to order', capability: 'assemble', workType: 'assemble', leadOffset: 0, durationMinutes: 1 },
    ],
    edges: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Recipes — cook components (planned + dropped + held) and assembled menu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an assembled menu item. These are library/menu only — built to order
 * at the counter and never "dropped" — so the only thing that matters is which
 * cook components (and how many) they pull from the cabinet. That's the whole
 * point of the model: a 20-item menu is just builds over ~7 components.
 */
function bkAssembled(
  id: string,
  name: string,
  pulls: { recipeId: RecipeId; quantityPerUnit: number }[],
): ProductionRecipe {
  return {
    id,
    name,
    category: 'Sandwich',
    shelfLifeMinutes: null,
    skuId: `sku-${id}`,
    subRecipes: pulls.map(p => ({ recipeId: p.recipeId, quantityPerUnit: p.quantityPerUnit, unit: 'unit' })),
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-bk-assemble',
    defaultMode: 'variable',
  };
}

export const BK_RECIPES: ProductionRecipe[] = [
  // ─── Cook components (these are what the crew screen drops + holds) ───────
  {
    id: 'bk-whopper-patty',
    name: 'Whopper patty (¼lb, flame-grilled)',
    category: 'Sandwich',
    shelfLifeMinutes: 20,
    batchRules: { min: 4, max: 24, multipleOf: 2 },
    skuId: 'sku-bk-whopper-patty',
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-bk-broil',
    defaultMode: 'increment',
  },
  {
    id: 'bk-junior-patty',
    name: 'Junior beef patty (2 oz)',
    category: 'Sandwich',
    shelfLifeMinutes: 20,
    batchRules: { min: 4, max: 24, multipleOf: 2 },
    skuId: 'sku-bk-junior-patty',
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-bk-broil',
    defaultMode: 'increment',
  },
  {
    id: 'bk-chicken-fillet',
    name: 'Crispy chicken fillet',
    category: 'Sandwich',
    shelfLifeMinutes: 30,
    batchRules: { min: 2, max: 16, multipleOf: 2 },
    skuId: 'sku-bk-chicken-fillet',
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-bk-chicken',
    defaultMode: 'increment',
  },
  {
    id: 'bk-bacon',
    name: 'Smoked streaky bacon',
    category: 'Sandwich',
    shelfLifeMinutes: 30,
    batchRules: { min: 4, max: 20, multipleOf: 2 },
    skuId: 'sku-bk-bacon',
    allowCarryOver: false,
    selectionTags: ['core', 'midday'],
    workflowId: 'wf-bk-bacon',
    defaultMode: 'increment',
  },
  {
    id: 'bk-cheese-melt',
    name: 'Cheese-topped patty',
    category: 'Sandwich',
    shelfLifeMinutes: 15,
    batchRules: { min: 2, max: 18, multipleOf: 1 },
    skuId: 'sku-bk-cheese-melt',
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-bk-cheese',
    defaultMode: 'increment',
  },
  {
    id: 'bk-angus-patty',
    name: 'Angus steakhouse patty',
    category: 'Sandwich',
    shelfLifeMinutes: 20,
    batchRules: { min: 2, max: 16, multipleOf: 2 },
    skuId: 'sku-bk-angus-patty',
    allowCarryOver: false,
    selectionTags: ['core', 'midday', 'afternoon'],
    workflowId: 'wf-bk-angus',
    defaultMode: 'increment',
  },
  {
    id: 'bk-plant-patty',
    name: 'Plant-based patty',
    category: 'Sandwich',
    shelfLifeMinutes: 20,
    batchRules: { min: 2, max: 12, multipleOf: 2 },
    skuId: 'sku-bk-plant-patty',
    allowCarryOver: false,
    selectionTags: ['core', 'midday'],
    workflowId: 'wf-bk-plant',
    defaultMode: 'increment',
  },

  // ─── Assembled menu (library only — built to order, pull components) ──────
  // ~20 menu items over the 7 cook components. The patty / bacon / cheese
  // counts are the build — the kitchen never plans these, only the components.

  // Whopper (¼lb flame-grilled) line — 1 / 2 / 3 patty + cheese & bacon
  bkAssembled('bk-whopper', 'Whopper', [{ recipeId: 'bk-whopper-patty', quantityPerUnit: 1 }]),
  bkAssembled('bk-whopper-cheese', 'Whopper with Cheese', [{ recipeId: 'bk-whopper-patty', quantityPerUnit: 1 }]),
  bkAssembled('bk-double-whopper', 'Double Whopper', [{ recipeId: 'bk-whopper-patty', quantityPerUnit: 2 }]),
  bkAssembled('bk-double-whopper-bc', 'Double Whopper Bacon & Cheese', [
    { recipeId: 'bk-whopper-patty', quantityPerUnit: 2 },
    { recipeId: 'bk-bacon', quantityPerUnit: 2 },
  ]),
  bkAssembled('bk-triple-whopper', 'Triple Whopper', [{ recipeId: 'bk-whopper-patty', quantityPerUnit: 3 }]),
  bkAssembled('bk-whopper-jr', 'Whopper Jr', [{ recipeId: 'bk-junior-patty', quantityPerUnit: 1 }]),

  // Cheeseburger line (2oz patty, cheese melted = cheese-melt component)
  bkAssembled('bk-hamburger', 'Hamburger', [{ recipeId: 'bk-junior-patty', quantityPerUnit: 1 }]),
  bkAssembled('bk-cheeseburger', 'Cheeseburger', [{ recipeId: 'bk-cheese-melt', quantityPerUnit: 1 }]),
  bkAssembled('bk-double-cheeseburger', 'Double Cheeseburger', [{ recipeId: 'bk-cheese-melt', quantityPerUnit: 2 }]),
  bkAssembled('bk-bacon-double-cheese', 'Bacon Double Cheeseburger', [
    { recipeId: 'bk-cheese-melt', quantityPerUnit: 2 },
    { recipeId: 'bk-bacon', quantityPerUnit: 2 },
  ]),

  // Kings & big builds
  bkAssembled('bk-bacon-king', 'Bacon King', [
    { recipeId: 'bk-whopper-patty', quantityPerUnit: 2 },
    { recipeId: 'bk-bacon', quantityPerUnit: 4 },
  ]),
  bkAssembled('bk-bacon-king-jr', 'Bacon King Jr', [
    { recipeId: 'bk-junior-patty', quantityPerUnit: 1 },
    { recipeId: 'bk-bacon', quantityPerUnit: 2 },
  ]),
  bkAssembled('bk-big-king-xl', 'Big King XL', [{ recipeId: 'bk-whopper-patty', quantityPerUnit: 2 }]),
  bkAssembled('bk-steakhouse-angus', 'BBQ Steakhouse Angus', [
    { recipeId: 'bk-angus-patty', quantityPerUnit: 1 },
    { recipeId: 'bk-bacon', quantityPerUnit: 2 },
  ]),

  // Chicken line
  bkAssembled('bk-chicken-royale', 'Chicken Royale', [{ recipeId: 'bk-chicken-fillet', quantityPerUnit: 1 }]),
  bkAssembled('bk-double-chicken-royale', 'Double Chicken Royale', [{ recipeId: 'bk-chicken-fillet', quantityPerUnit: 2 }]),
  bkAssembled('bk-chicken-royale-bc', 'Chicken Royale Bacon & Cheese', [
    { recipeId: 'bk-chicken-fillet', quantityPerUnit: 1 },
    { recipeId: 'bk-bacon', quantityPerUnit: 2 },
  ]),

  // Plant-based
  bkAssembled('bk-plant-whopper', 'Plant-based Whopper', [{ recipeId: 'bk-plant-patty', quantityPerUnit: 1 }]),
  bkAssembled('bk-vegan-royale', 'Vegan Royale', [{ recipeId: 'bk-plant-patty', quantityPerUnit: 1 }]),
];

// ─────────────────────────────────────────────────────────────────────────────
// Production items — every cook component drops on a 15-minute cadence
// ─────────────────────────────────────────────────────────────────────────────

const BK_CADENCE = {
  intervalMinutes: BK_DROP_INTERVAL_MIN,
  startTime: '11:00',
  endTime: '21:00',
  quinnProposed: true,
} as const;

export const BK_PRODUCTION_ITEMS: ProductionItem[] = [
  { id: 'pi-bk-whopper-patty', siteId: BK_SITE_ID, recipeId: 'bk-whopper-patty', skuId: 'sku-bk-whopper-patty', mode: 'increment', batchSize: 12, cadence: { ...BK_CADENCE }, preferredBenchId: BK_BROILER_ID, targetMinutes: 6 },
  { id: 'pi-bk-junior-patty',  siteId: BK_SITE_ID, recipeId: 'bk-junior-patty',  skuId: 'sku-bk-junior-patty',  mode: 'increment', batchSize: 16, cadence: { ...BK_CADENCE }, preferredBenchId: BK_BROILER_ID, targetMinutes: 6 },
  { id: 'pi-bk-chicken-fillet',siteId: BK_SITE_ID, recipeId: 'bk-chicken-fillet',skuId: 'sku-bk-chicken-fillet',mode: 'increment', batchSize: 8,  cadence: { ...BK_CADENCE }, preferredBenchId: BK_BROILER_ID, targetMinutes: 8 },
  { id: 'pi-bk-bacon',         siteId: BK_SITE_ID, recipeId: 'bk-bacon',         skuId: 'sku-bk-bacon',         mode: 'increment', batchSize: 10, cadence: { ...BK_CADENCE }, preferredBenchId: BK_BROILER_ID, targetMinutes: 5 },
  { id: 'pi-bk-cheese-melt',   siteId: BK_SITE_ID, recipeId: 'bk-cheese-melt',   skuId: 'sku-bk-cheese-melt',   mode: 'increment', batchSize: 10, cadence: { ...BK_CADENCE }, preferredBenchId: BK_ASSEMBLY_ID, targetMinutes: 3 },
  { id: 'pi-bk-angus-patty',   siteId: BK_SITE_ID, recipeId: 'bk-angus-patty',   skuId: 'sku-bk-angus-patty',   mode: 'increment', batchSize: 8,  cadence: { ...BK_CADENCE }, preferredBenchId: BK_BROILER_ID,  targetMinutes: 8 },
  { id: 'pi-bk-plant-patty',   siteId: BK_SITE_ID, recipeId: 'bk-plant-patty',   skuId: 'sku-bk-plant-patty',   mode: 'increment', batchSize: 6,  cadence: { ...BK_CADENCE }, preferredBenchId: BK_BROILER_ID,  targetMinutes: 6 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Forecast — per-component daily demand for the demo day
// ─────────────────────────────────────────────────────────────────────────────

export const BK_FORECAST: DemandForecastEntry[] = [
  { siteId: BK_SITE_ID, skuId: 'sku-bk-whopper-patty',  date: '', projectedUnits: 240, byPhase: { morning: 36, midday: 132, afternoon: 72 }, signals: [{ signal: 'sales-history', weight: 0.6, note: '4-week median for Thu' }, { signal: 'event', weight: 0.4, note: 'Westfield footfall peak' }], status: 'confirmed' },
  { siteId: BK_SITE_ID, skuId: 'sku-bk-junior-patty',   date: '', projectedUnits: 280, byPhase: { morning: 40, midday: 150, afternoon: 90 }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'online-orders', weight: 0.2, note: 'Delivery mix high at lunch' }], status: 'confirmed' },
  { siteId: BK_SITE_ID, skuId: 'sku-bk-chicken-fillet', date: '', projectedUnits: 120, byPhase: { morning: 14, midday: 64, afternoon: 42 },  signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: BK_SITE_ID, skuId: 'sku-bk-bacon',          date: '', projectedUnits: 70,  byPhase: { morning: 12, midday: 40, afternoon: 18 },  signals: [{ signal: 'sales-history', weight: 1, note: 'Bacon King + add-ons' }], status: 'confirmed' },
  { siteId: BK_SITE_ID, skuId: 'sku-bk-cheese-melt',    date: '', projectedUnits: 200, byPhase: { morning: 28, midday: 110, afternoon: 62 }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'weather', weight: 0.3 }], status: 'confirmed' },
  { siteId: BK_SITE_ID, skuId: 'sku-bk-angus-patty',    date: '', projectedUnits: 90,  byPhase: { morning: 10, midday: 48, afternoon: 32 },  signals: [{ signal: 'sales-history', weight: 0.7, note: 'Gourmet Kings range' }, { signal: 'event', weight: 0.3 }], status: 'confirmed' },
  { siteId: BK_SITE_ID, skuId: 'sku-bk-plant-patty',    date: '', projectedUnits: 60,  byPhase: { morning: 8,  midday: 34, afternoon: 18 },  signals: [{ signal: 'sales-history', weight: 1, note: 'Plant-based mix ~8%' }], status: 'confirmed' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Ingredients (for the recipe library + crew stepper component lists)
// NOTE: deliberately NOT wired into the ingredient stock-cap model, so BK
// recipes never get capped to zero by a missing stock snapshot.
// ─────────────────────────────────────────────────────────────────────────────

export const BK_INGREDIENTS: Ingredient[] = [
  { id: 'ing-bk-beef',    name: '100% beef patty',        canonicalUnit: 'unit', category: 'protein' },
  { id: 'ing-bk-chicken', name: 'Breaded chicken fillet', canonicalUnit: 'unit', category: 'protein' },
  { id: 'ing-bk-bacon',   name: 'Smoked bacon rasher',    canonicalUnit: 'unit', category: 'protein' },
  { id: 'ing-bk-cheese',  name: 'American cheese slice',  canonicalUnit: 'unit', category: 'dairy'   },
  { id: 'ing-bk-angus',   name: 'Angus beef patty',       canonicalUnit: 'unit', category: 'protein' },
  { id: 'ing-bk-plant',   name: 'Plant-based patty',      canonicalUnit: 'unit', category: 'protein' },
  { id: 'ing-bk-bun',     name: 'Sesame seed bun',        canonicalUnit: 'unit', category: 'flour'   },
  { id: 'ing-bk-lettuce', name: 'Shredded lettuce',       canonicalUnit: 'g',    category: 'produce' },
  { id: 'ing-bk-tomato',  name: 'Tomato slice',           canonicalUnit: 'unit', category: 'produce' },
  { id: 'ing-bk-onion',   name: 'Sliced onion',           canonicalUnit: 'g',    category: 'produce' },
  { id: 'ing-bk-pickle',  name: 'Pickle slice',           canonicalUnit: 'unit', category: 'produce' },
];

export const BK_INGREDIENT_USAGE: IngredientUsage[] = [
  { recipeId: 'bk-whopper-patty',  ingredientId: 'ing-bk-beef',    quantityPerUnit: 1, unit: 'unit' },
  { recipeId: 'bk-junior-patty',   ingredientId: 'ing-bk-beef',    quantityPerUnit: 1, unit: 'unit' },
  { recipeId: 'bk-chicken-fillet', ingredientId: 'ing-bk-chicken', quantityPerUnit: 1, unit: 'unit' },
  { recipeId: 'bk-bacon',          ingredientId: 'ing-bk-bacon',   quantityPerUnit: 1, unit: 'unit' },
  { recipeId: 'bk-cheese-melt',    ingredientId: 'ing-bk-beef',    quantityPerUnit: 1, unit: 'unit' },
  { recipeId: 'bk-cheese-melt',    ingredientId: 'ing-bk-cheese',  quantityPerUnit: 1, unit: 'unit' },
  { recipeId: 'bk-angus-patty',    ingredientId: 'ing-bk-angus',   quantityPerUnit: 1, unit: 'unit' },
  { recipeId: 'bk-plant-patty',    ingredientId: 'ing-bk-plant',   quantityPerUnit: 1, unit: 'unit' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Stations view — drives the crew NOW / NEXT / HAVE screen
// ─────────────────────────────────────────────────────────────────────────────

export type BkStationId = typeof BK_BROILER_ID | typeof BK_ASSEMBLY_ID;

export type BkStation = {
  id: BkStationId;
  /** Short name the crew reads at a glance. */
  name: string;
  /** Sub-label / what the station handles. */
  caption: string;
  /** Accent colour for the station header. */
  accent: string;
  /** Recipe ids cooked + held at this station, in display order. */
  recipeIds: RecipeId[];
};

export const BK_STATIONS: BkStation[] = [
  {
    id: BK_BROILER_ID,
    name: 'Broiler',
    caption: 'Flame-grill — patties, chicken & bacon',
    accent: '#d62300', // BK flame red
    recipeIds: ['bk-whopper-patty', 'bk-junior-patty', 'bk-angus-patty', 'bk-plant-patty', 'bk-chicken-fillet', 'bk-bacon'],
  },
  {
    id: BK_ASSEMBLY_ID,
    name: 'Build & cheese',
    caption: 'Cheese-melt & assembly',
    accent: '#f5a623', // BK amber
    recipeIds: ['bk-cheese-melt'],
  },
];

/** Map a recipe id to the station that cooks it. */
export function bkStationForRecipe(recipeId: RecipeId): BkStation | undefined {
  return BK_STATIONS.find(s => s.recipeIds.includes(recipeId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Holding cabinet — initial seed state (counts decay live in crewLoopStore)
// ─────────────────────────────────────────────────────────────────────────────

export type BkHolderSeed = {
  recipeId: RecipeId;
  /** Units currently in the cabinet. */
  count: number;
  /** How long ago (demo minutes) the batch was cooked — drives time-to-bin. */
  cookedMinAgo: number;
};

export const BK_HOLDER_SEED: BkHolderSeed[] = [
  { recipeId: 'bk-whopper-patty',  count: 8,  cookedMinAgo: 6 },
  { recipeId: 'bk-junior-patty',   count: 10, cookedMinAgo: 11 },
  { recipeId: 'bk-chicken-fillet', count: 5,  cookedMinAgo: 9 },
  { recipeId: 'bk-bacon',          count: 6,  cookedMinAgo: 14 },
  { recipeId: 'bk-cheese-melt',    count: 4,  cookedMinAgo: 5 },
  { recipeId: 'bk-angus-patty',    count: 3,  cookedMinAgo: 8 },
  { recipeId: 'bk-plant-patty',    count: 2,  cookedMinAgo: 7 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Crew stepper — glanceable cook steps the floor sees per component
// ─────────────────────────────────────────────────────────────────────────────

export type BkCrewStep = {
  label: string;
  detail: string;
  /** Seconds the step takes — drives the stepper timer. */
  seconds: number;
  workType: WorkType;
};

export const BK_CREW_STEPS: Record<RecipeId, BkCrewStep[]> = {
  'bk-whopper-patty': [
    { label: 'Load', detail: 'Lay ¼lb patties on the broiler chain', seconds: 20, workType: 'portion' },
    { label: 'Flame-broil', detail: 'Through the broiler — 90s each side', seconds: 240, workType: 'grill' },
    { label: 'Season & hold', detail: 'Salt, stack in the cabinet — Whopper slot', seconds: 30, workType: 'pack' },
  ],
  'bk-junior-patty': [
    { label: 'Load', detail: 'Lay 2oz patties on the broiler chain', seconds: 15, workType: 'portion' },
    { label: 'Flame-broil', detail: 'Through the broiler', seconds: 180, workType: 'grill' },
    { label: 'Hold', detail: 'Stack in the cabinet — Junior slot', seconds: 25, workType: 'pack' },
  ],
  'bk-chicken-fillet': [
    { label: 'Lay out', detail: 'Drop fillets into the fryer basket', seconds: 20, workType: 'portion' },
    { label: 'Fry', detail: 'Fry until 75°C core / golden', seconds: 360, workType: 'grill' },
    { label: 'Drain & hold', detail: 'Drain, move to the chicken slot', seconds: 30, workType: 'pack' },
  ],
  'bk-bacon': [
    { label: 'Grill', detail: 'Lay rashers on the flat-top', seconds: 240, workType: 'grill' },
    { label: 'Hold', detail: 'Move to the bacon slot', seconds: 20, workType: 'pack' },
  ],
  'bk-cheese-melt': [
    { label: 'Cap', detail: 'Cheese slice onto a held patty', seconds: 20, workType: 'assemble' },
    { label: 'Melt', detail: 'Under the salamander until glossy', seconds: 120, workType: 'grill' },
    { label: 'Hold', detail: 'Cheese-melt slot — bin at 15 min', seconds: 20, workType: 'pack' },
  ],
  'bk-angus-patty': [
    { label: 'Load', detail: 'Lay thick Angus patties on the broiler', seconds: 20, workType: 'portion' },
    { label: 'Flame-broil', detail: 'Thicker patty — full pass + rest', seconds: 360, workType: 'grill' },
    { label: 'Hold', detail: 'Stack in the cabinet — Angus slot', seconds: 30, workType: 'pack' },
  ],
  'bk-plant-patty': [
    { label: 'Load', detail: 'Separate zone — avoid cross-contact', seconds: 20, workType: 'portion' },
    { label: 'Flame-broil', detail: 'Through the broiler', seconds: 240, workType: 'grill' },
    { label: 'Hold', detail: 'Stack in the cabinet — Plant slot', seconds: 25, workType: 'pack' },
  ],
};
