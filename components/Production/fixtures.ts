// ─────────────────────────────────────────────────────────────────────────────
// Edify production fixtures — slice C
//
// Shape-first fixtures for the foundation rebuild of production. Covers every
// entity named in PRODUCTION_BRIEF.md / the scoping plan:
//
//   estate → formats → sites (4 types) → benches
//   recipes (incl. assembly) + production items (mode per SKU)
//   workflows (DAG w/ leadOffset up to D-2)
//   ranges + tiers + selection tags + intra-day availability
//   forecast → plan → planned instance → batch → PCR → transfer
//   carry-over, spoke submission, settings health, Quinn setup interview
//   users (Manager / Staff)
//
// All data is in-memory mock data; no persistence. Dates are anchored on
// DEMO_TODAY so the scenario stays stable across reloads.
// ─────────────────────────────────────────────────────────────────────────────

// ───── IDs (brand types kept loose so fixtures stay readable) ─────
export type EstateId = string;
export type FormatId = string;
export type SiteId = string;
export type BenchId = string;
export type RecipeId = string;
export type ProductionItemId = string;
export type SkuId = string;
export type WorkflowId = string;
export type StageId = string;
export type RangeId = string;
export type TierId = string;
export type UserId = string;
export type BatchId = string;

// ───── Core enums ─────
export type SiteType = 'STANDALONE' | 'HUB' | 'SPOKE' | 'HYBRID';
export type Role = 'Manager' | 'Staff';

export type ProductionMode = 'run' | 'variable' | 'increment';

export type BenchCapability =
  | 'oven'
  | 'prep'
  | 'pack'
  | 'proofing'
  | 'cold-prep'
  | 'front-of-house'
  | 'assemble';

export type SelectionTag =
  | 'breakfast'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'closing'
  | 'core';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ───── Date anchor (stable demo scenario) ─────
/** Demo "today" — a Thursday. All timing in fixtures is relative to this. */
export const DEMO_TODAY = '2026-04-23'; // Thursday

/** Offset a day (-2 for D-2, 0 for today, +1 for tomorrow, etc.). Returns ISO yyyy-mm-dd. */
export function dayOffset(days: number, anchor: string = DEMO_TODAY): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Day-of-week for a given ISO date. */
export function dayOfWeek(iso: string): DayOfWeek {
  const d = new Date(`${iso}T00:00:00Z`);
  return DAYS_OF_WEEK[(d.getUTCDay() + 6) % 7];
}

// ─────────────────────────────────────────────────────────────────────────────
// Estate + format
// ─────────────────────────────────────────────────────────────────────────────

export type Estate = {
  id: EstateId;
  name: string;
  /** Template defaults cascade from estate → format → site. */
  defaults: {
    cutoffTimeForSpokeSubmissions: string; // HH:MM (24h)
    forecastHorizonDays: number;
    carryOverEnabled: boolean;
  };
};

export type Format = {
  id: FormatId;
  estateId: EstateId;
  name: string;
  /** Format-level override of estate defaults (optional). */
  overrides?: Partial<Estate['defaults']>;
  /** Site shape fingerprint — "corner shop", "airport concourse", etc. */
  description: string;
};

export const PRET_ESTATE: Estate = {
  id: 'estate-pret',
  name: 'Pret a Manger',
  defaults: {
    cutoffTimeForSpokeSubmissions: '15:00',
    forecastHorizonDays: 5,
    carryOverEnabled: true,
  },
};

export const PRET_FORMATS: Format[] = [
  {
    id: 'format-corner',
    estateId: 'estate-pret',
    name: 'Corner shop',
    description: 'High-street format. 06:00–22:00 opening. Standard run profile.',
  },
  {
    id: 'format-airport',
    estateId: 'estate-pret',
    name: 'Airport concourse',
    description: 'Extended hours (04:30–23:00). Commuter-heavy. Longer increment runs.',
    overrides: {
      cutoffTimeForSpokeSubmissions: '14:00',
      forecastHorizonDays: 7,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sites
// ─────────────────────────────────────────────────────────────────────────────

export type Site = {
  id: SiteId;
  estateId: EstateId;
  formatId: FormatId;
  name: string;
  type: SiteType;
  /** Opening hours (HH:MM). */
  openingHours: { open: string; close: string };
  /** For SPOKE + HYBRID sites: the hub they pull from. */
  hubId?: SiteId;
  /** For HUB + HYBRID sites: spokes they supply. */
  servesSiteIds?: SiteId[];
};

export const PRET_SITES: Site[] = [
  {
    id: 'hub-central',
    estateId: 'estate-pret',
    formatId: 'format-corner',
    name: 'London Central Hub',
    type: 'HUB',
    openingHours: { open: '04:30', close: '22:00' },
    servesSiteIds: ['site-spoke-south', 'site-spoke-east', 'site-spoke-west'],
  },
  {
    id: 'site-standalone-north',
    estateId: 'estate-pret',
    formatId: 'format-corner',
    name: 'Islington North',
    type: 'STANDALONE',
    openingHours: { open: '06:00', close: '22:00' },
  },
  {
    id: 'site-spoke-south',
    estateId: 'estate-pret',
    formatId: 'format-corner',
    name: 'Clapham Junction',
    type: 'SPOKE',
    openingHours: { open: '06:00', close: '22:00' },
    hubId: 'hub-central',
  },
  {
    id: 'site-spoke-east',
    estateId: 'estate-pret',
    formatId: 'format-corner',
    name: 'Shoreditch East',
    type: 'SPOKE',
    openingHours: { open: '06:30', close: '21:30' },
    hubId: 'hub-central',
  },
  {
    id: 'site-spoke-west',
    estateId: 'estate-pret',
    formatId: 'format-corner',
    name: 'Notting Hill West',
    type: 'SPOKE',
    openingHours: { open: '06:30', close: '21:00' },
    hubId: 'hub-central',
  },
  {
    id: 'site-hybrid-airport',
    estateId: 'estate-pret',
    formatId: 'format-airport',
    name: 'Heathrow T5',
    type: 'HYBRID',
    openingHours: { open: '04:30', close: '23:00' },
    hubId: 'hub-central', // still pulls proofed dough from hub
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Benches (stations)
// ─────────────────────────────────────────────────────────────────────────────

export type BatchRules = {
  min: number;
  max: number;
  multipleOf: number;
};

/**
 * A scheduled production "run" on a bench — a fixed time slot during which the
 * team works through a planned batch of recipes (R1 morning bake, R2 lunch
 * bake, etc). Only meaningful on benches with primaryMode='run'. Rows are
 * bucketed into runs at render time based on when their demand lands across
 * the day (morning vs midday vs afternoon).
 */
export type RunSchedule = {
  id: string;
  /** Short label ("R1"). Full label composes from bench + time window. */
  label: string;
  /** HH:MM — start of the run. */
  startTime: string;
  /** Planned length of this run (minutes). */
  durationMinutes: number;
};

export type Bench = {
  id: BenchId;
  siteId: SiteId;
  name: string;
  capabilities: BenchCapability[];
  /** Bench-level batch rules (hardware limits). Recipe rules win if set. */
  batchRules?: BatchRules;
  /** Whether bench is currently online (false = out of service). */
  online: boolean;
  /**
   * The mode this bench is set up for during service. Pret (and most kitchens
   * we've seen) run one mode per bench so the team, station and tooling are
   * predictable across the day. Other-mode work (e.g. next-day filling prep)
   * only happens after the primary mode's runs are done and is rendered
   * separately as an "After service" tail on the card.
   */
  primaryMode?: ProductionMode;
  /**
   * Scheduled runs for run-mode benches. The board buckets recipes into each
   * run based on when their demand lands and surfaces "Next run" in the card
   * header.
   */
  runs?: RunSchedule[];
};

export const PRET_BENCHES: Bench[] = [
  // hub-central
  // ─── hub-central: 7 benches — one variable, three runs, one increment,
  //                  one grill, one assembly. Matches the layout we're
  //                  prototyping for Pret-style hub kitchens.
  {
    id: 'bench-variable',
    siteId: 'hub-central',
    name: 'Variable bench',
    capabilities: ['cold-prep', 'pack'],
    online: true,
    primaryMode: 'variable',
  },
  {
    id: 'bench-run-bakery',
    siteId: 'hub-central',
    name: 'Bakery oven',
    capabilities: ['oven', 'proofing'],
    batchRules: { min: 6, max: 24, multipleOf: 6 },
    online: true,
    primaryMode: 'run',
    runs: [
      { id: 'r1', label: 'R1', startTime: '05:00', durationMinutes: 180 },
      { id: 'r2', label: 'R2', startTime: '10:30', durationMinutes: 90 },
    ],
  },
  {
    id: 'bench-run-cold-prep',
    siteId: 'hub-central',
    name: 'Cold prep (fillings)',
    capabilities: ['cold-prep', 'prep'],
    online: true,
    primaryMode: 'run',
    runs: [
      { id: 'r1', label: 'R1', startTime: '05:30', durationMinutes: 150 },
      { id: 'r2', label: 'R2', startTime: '10:30', durationMinutes: 90 },
    ],
  },
  {
    id: 'bench-run-hot-prep',
    siteId: 'hub-central',
    name: 'Hot prep (roasts)',
    capabilities: ['prep'],
    online: true,
    primaryMode: 'run',
    runs: [
      { id: 'r1', label: 'R1', startTime: '06:00', durationMinutes: 180 },
    ],
  },
  {
    id: 'bench-increment-hot',
    siteId: 'hub-central',
    name: 'Hot shelf increments',
    capabilities: ['oven', 'prep'],
    batchRules: { min: 4, max: 18, multipleOf: 2 },
    online: true,
    primaryMode: 'increment',
  },
  {
    id: 'bench-grill',
    siteId: 'hub-central',
    name: 'Grill (sandwich components)',
    capabilities: ['prep'],
    online: true,
    primaryMode: 'run',
    runs: [
      { id: 'r1', label: 'R1', startTime: '08:00', durationMinutes: 120 },
      { id: 'r2', label: 'R2', startTime: '11:00', durationMinutes: 90 },
    ],
  },
  {
    id: 'bench-assembly',
    siteId: 'hub-central',
    name: 'Sandwich & salad assembly',
    capabilities: ['assemble'],
    online: true,
    primaryMode: 'variable',
  },

  // site-standalone-north
  {
    id: 'bench-north-oven',
    siteId: 'site-standalone-north',
    name: 'Convection oven',
    capabilities: ['oven'],
    batchRules: { min: 4, max: 12, multipleOf: 4 },
    online: true,
    primaryMode: 'run',
  },
  {
    id: 'bench-north-prep',
    siteId: 'site-standalone-north',
    name: 'Prep bench',
    capabilities: ['prep', 'assemble'],
    online: true,
    primaryMode: 'variable',
  },
  {
    id: 'bench-north-counter',
    siteId: 'site-standalone-north',
    name: 'Front counter',
    capabilities: ['front-of-house'],
    online: true,
  },

  // site-spoke-south (receives from hub — minimal kit)
  {
    id: 'bench-south-counter',
    siteId: 'site-spoke-south',
    name: 'Front counter',
    capabilities: ['front-of-house'],
    online: true,
  },

  // site-hybrid-airport
  {
    id: 'bench-airport-oven',
    siteId: 'site-hybrid-airport',
    name: 'Airport oven',
    capabilities: ['oven'],
    batchRules: { min: 4, max: 12, multipleOf: 4 },
    online: true,
    primaryMode: 'increment',
  },
  {
    id: 'bench-airport-prep',
    siteId: 'site-hybrid-airport',
    name: 'Airport prep',
    capabilities: ['prep', 'cold-prep'],
    online: true,
    primaryMode: 'run',
  },
  {
    id: 'bench-airport-assemble',
    siteId: 'site-hybrid-airport',
    name: 'Airport assemble',
    capabilities: ['assemble', 'pack'],
    online: true,
    primaryMode: 'variable',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Recipes (production view — narrower than full Recipe in libraryFixtures)
// ─────────────────────────────────────────────────────────────────────────────

export type SubRecipeRef = {
  recipeId: RecipeId;
  /** Quantity of the sub-recipe consumed per one unit of the parent assembly. */
  quantityPerUnit: number;
  unit: string; // 'unit', 'g', 'ml', etc.
};

export type ProductionRecipe = {
  id: RecipeId;
  name: string;
  category: 'Bakery' | 'Sandwich' | 'Snack' | 'Beverage' | 'Salad';
  /** Canonical shelf life from bake/assemble point. null = no shelf constraint. */
  shelfLifeMinutes: number | null;
  /** Recipe-level batch rules (wins over bench rules when present). */
  batchRules?: BatchRules;
  /** SKU equivalence — V1 is 1:1 (post-V1 a Product overlay resolves 1:N). */
  skuId: SkuId;
  /** Assembly? When non-empty this is an AssemblyRecipe. */
  subRecipes?: SubRecipeRef[];
  /** Whether today's unsolds can carry into tomorrow's plan. */
  allowCarryOver: boolean;
  /** Tags used by Quinn when scheduling within a tier. */
  selectionTags: SelectionTag[];
  /** Canonical workflow id. */
  workflowId: WorkflowId;
  /** Default mode — but still per-SKU authoritative on ProductionItem. */
  defaultMode: ProductionMode;
};

export const PRET_RECIPES: ProductionRecipe[] = [
  {
    id: 'prec-croissant',
    name: 'All-butter croissant',
    category: 'Bakery',
    shelfLifeMinutes: 8 * 60,
    batchRules: { min: 6, max: 24, multipleOf: 6 },
    skuId: 'sku-croissant',
    allowCarryOver: true,
    selectionTags: ['breakfast', 'morning'],
    workflowId: 'wf-croissant',
    defaultMode: 'run',
  },
  {
    id: 'prec-pain-au-chocolat',
    name: 'Pain au chocolat',
    category: 'Bakery',
    shelfLifeMinutes: 8 * 60,
    batchRules: { min: 6, max: 24, multipleOf: 6 },
    skuId: 'sku-pain-au-choc',
    allowCarryOver: true,
    selectionTags: ['breakfast', 'morning'],
    workflowId: 'wf-croissant', // shares shape with croissant
    defaultMode: 'run',
  },
  {
    id: 'prec-cookie',
    name: 'Double chocolate cookie',
    category: 'Bakery',
    shelfLifeMinutes: 120,
    // Recipe-level cap tighter than oven's 12 → surfaces the "recipe wins" rule
    batchRules: { min: 4, max: 8, multipleOf: 4 },
    skuId: 'sku-cookie',
    allowCarryOver: false,
    selectionTags: ['midday', 'afternoon', 'closing'],
    workflowId: 'wf-cookie',
    defaultMode: 'increment',
  },
  {
    id: 'prec-brewed-coffee',
    name: 'Brewed filter coffee (2L urn)',
    category: 'Beverage',
    shelfLifeMinutes: 60,
    batchRules: { min: 1, max: 1, multipleOf: 1 },
    skuId: 'sku-brewed-coffee',
    allowCarryOver: false,
    selectionTags: ['breakfast', 'morning', 'afternoon'],
    workflowId: 'wf-brewed-coffee',
    defaultMode: 'increment',
  },
  {
    id: 'prec-ciabatta',
    name: 'Ciabatta loaf',
    category: 'Bakery',
    shelfLifeMinutes: 12 * 60,
    batchRules: { min: 6, max: 24, multipleOf: 6 },
    skuId: 'sku-ciabatta',
    allowCarryOver: false, // consumed internally by assembly, not sold as-is
    selectionTags: ['core'],
    workflowId: 'wf-ciabatta',
    defaultMode: 'run',
  },
  {
    id: 'prec-chicken-mayo-filling',
    name: 'Chicken & mayo filling',
    category: 'Sandwich',
    shelfLifeMinutes: 4 * 60,
    batchRules: { min: 1, max: 4, multipleOf: 1 }, // 1 batch = 4kg tray
    skuId: 'sku-chicken-mayo-filling',
    allowCarryOver: false,
    selectionTags: ['core'],
    workflowId: 'wf-filling',
    defaultMode: 'run',
  },
  {
    id: 'prec-club-sandwich',
    name: 'Classic club sandwich',
    category: 'Sandwich',
    shelfLifeMinutes: 8 * 60,
    skuId: 'sku-club-sandwich',
    subRecipes: [
      { recipeId: 'prec-ciabatta', quantityPerUnit: 1, unit: 'unit' },
      { recipeId: 'prec-chicken-mayo-filling', quantityPerUnit: 80, unit: 'g' },
    ],
    allowCarryOver: true,
    selectionTags: ['core', 'midday'],
    workflowId: 'wf-sandwich',
    defaultMode: 'variable',
  },
  {
    id: 'prec-salad-bowl',
    name: 'Super-greens salad bowl',
    category: 'Salad',
    shelfLifeMinutes: 6 * 60,
    skuId: 'sku-salad-bowl',
    allowCarryOver: false,
    selectionTags: ['core', 'midday'],
    workflowId: 'wf-salad',
    defaultMode: 'variable',
  },

  // ─── Additional bakery ───────────────────────────────────────────────────
  { id: 'prec-almond-croissant', name: 'Almond croissant', category: 'Bakery', shelfLifeMinutes: 8 * 60, batchRules: { min: 6, max: 18, multipleOf: 6 }, skuId: 'sku-almond-croissant', allowCarryOver: true, selectionTags: ['breakfast', 'morning'], workflowId: 'wf-croissant', defaultMode: 'run' },
  { id: 'prec-cinnamon-swirl',   name: 'Cinnamon swirl',    category: 'Bakery', shelfLifeMinutes: 8 * 60, batchRules: { min: 6, max: 12, multipleOf: 6 }, skuId: 'sku-cinnamon-swirl',   allowCarryOver: true,  selectionTags: ['breakfast', 'morning'],            workflowId: 'wf-croissant', defaultMode: 'run' },
  { id: 'prec-baguette',         name: 'White baguette',    category: 'Bakery', shelfLifeMinutes: 12 * 60, batchRules: { min: 6, max: 18, multipleOf: 6 }, skuId: 'sku-baguette',         allowCarryOver: false, selectionTags: ['core'],                             workflowId: 'wf-ciabatta',  defaultMode: 'run' },
  { id: 'prec-granary',          name: 'Granary loaf',      category: 'Bakery', shelfLifeMinutes: 12 * 60, batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-granary',          allowCarryOver: false, selectionTags: ['core'],                             workflowId: 'wf-ciabatta',  defaultMode: 'run' },
  { id: 'prec-focaccia',         name: 'Rosemary focaccia', category: 'Bakery', shelfLifeMinutes: 8 * 60,  batchRules: { min: 4, max: 8,  multipleOf: 2 }, skuId: 'sku-focaccia',         allowCarryOver: false, selectionTags: ['core'],                             workflowId: 'wf-ciabatta',  defaultMode: 'run' },
  { id: 'prec-blueberry-muffin', name: 'Blueberry muffin',  category: 'Bakery', shelfLifeMinutes: 24 * 60, batchRules: { min: 6, max: 12, multipleOf: 6 }, skuId: 'sku-blueberry-muffin', allowCarryOver: true,  selectionTags: ['morning', 'midday', 'afternoon'],   workflowId: 'wf-cookie',    defaultMode: 'run' },
  { id: 'prec-banana-bread',     name: 'Banana bread slice',category: 'Bakery', shelfLifeMinutes: 24 * 60, batchRules: { min: 8, max: 16, multipleOf: 8 }, skuId: 'sku-banana-bread',     allowCarryOver: true,  selectionTags: ['midday', 'afternoon'],              workflowId: 'wf-cookie',    defaultMode: 'run' },
  { id: 'prec-brownie',          name: 'Chocolate brownie', category: 'Bakery', shelfLifeMinutes: 48 * 60, batchRules: { min: 8, max: 16, multipleOf: 8 }, skuId: 'sku-brownie',          allowCarryOver: true,  selectionTags: ['midday', 'afternoon', 'closing'],   workflowId: 'wf-cookie',    defaultMode: 'run' },

  // ─── Sub-recipes / fillings ──────────────────────────────────────────────
  { id: 'prec-egg-mayo-filling',  name: 'Egg mayo filling',  category: 'Sandwich', shelfLifeMinutes: 4 * 60,  batchRules: { min: 1, max: 4, multipleOf: 1 }, skuId: 'sku-egg-mayo-filling',  allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-tuna-mayo-filling', name: 'Tuna mayo filling', category: 'Sandwich', shelfLifeMinutes: 4 * 60,  batchRules: { min: 1, max: 4, multipleOf: 1 }, skuId: 'sku-tuna-mayo-filling', allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-hummus',            name: 'Classic hummus',    category: 'Sandwich', shelfLifeMinutes: 12 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-hummus',            allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },

  // ─── Assembly sandwiches ─────────────────────────────────────────────────
  { id: 'prec-egg-mayo-sandwich',   name: 'Egg mayo sandwich',        category: 'Sandwich', shelfLifeMinutes: 8 * 60, skuId: 'sku-egg-mayo-sandwich',   subRecipes: [{ recipeId: 'prec-granary',  quantityPerUnit: 1,  unit: 'unit' }, { recipeId: 'prec-egg-mayo-filling',  quantityPerUnit: 80, unit: 'g' }], allowCarryOver: true, selectionTags: ['core', 'midday'], workflowId: 'wf-sandwich', defaultMode: 'variable' },
  { id: 'prec-ham-cheese-baguette', name: 'Ham & cheese baguette',    category: 'Sandwich', shelfLifeMinutes: 8 * 60, skuId: 'sku-ham-cheese-baguette', subRecipes: [{ recipeId: 'prec-baguette', quantityPerUnit: 1,  unit: 'unit' }],                                                                          allowCarryOver: true, selectionTags: ['core', 'midday'], workflowId: 'wf-sandwich', defaultMode: 'variable' },
  { id: 'prec-tuna-sandwich',       name: 'Tuna & sweetcorn sandwich',category: 'Sandwich', shelfLifeMinutes: 8 * 60, skuId: 'sku-tuna-sandwich',       subRecipes: [{ recipeId: 'prec-granary',  quantityPerUnit: 1,  unit: 'unit' }, { recipeId: 'prec-tuna-mayo-filling', quantityPerUnit: 80, unit: 'g' }], allowCarryOver: true, selectionTags: ['core', 'midday'], workflowId: 'wf-sandwich', defaultMode: 'variable' },
  { id: 'prec-hummus-wrap',         name: 'Hummus & roasted veg wrap',category: 'Sandwich', shelfLifeMinutes: 8 * 60, skuId: 'sku-hummus-wrap',         subRecipes: [{ recipeId: 'prec-hummus',   quantityPerUnit: 60, unit: 'g' }],                                                                           allowCarryOver: true, selectionTags: ['core', 'midday'], workflowId: 'wf-sandwich', defaultMode: 'variable' },
  { id: 'prec-turkey-brie-baguette',name: 'Turkey & brie baguette',   category: 'Sandwich', shelfLifeMinutes: 8 * 60, skuId: 'sku-turkey-brie-baguette',subRecipes: [{ recipeId: 'prec-baguette', quantityPerUnit: 1,  unit: 'unit' }],                                                                          allowCarryOver: true, selectionTags: ['core', 'midday'], workflowId: 'wf-sandwich', defaultMode: 'variable' },

  // ─── Salads ──────────────────────────────────────────────────────────────
  { id: 'prec-chicken-caesar', name: 'Chicken Caesar salad',       category: 'Salad', shelfLifeMinutes: 6 * 60, skuId: 'sku-chicken-caesar', allowCarryOver: false, selectionTags: ['core', 'midday'], workflowId: 'wf-salad', defaultMode: 'variable' },
  { id: 'prec-med-grain-bowl', name: 'Mediterranean grain bowl',   category: 'Salad', shelfLifeMinutes: 6 * 60, skuId: 'sku-med-grain-bowl', allowCarryOver: false, selectionTags: ['core', 'midday'], workflowId: 'wf-salad', defaultMode: 'variable' },
  { id: 'prec-chicken-pasta',  name: 'Chicken pesto pasta',        category: 'Salad', shelfLifeMinutes: 6 * 60, skuId: 'sku-chicken-pasta',  allowCarryOver: false, selectionTags: ['core', 'midday'], workflowId: 'wf-salad', defaultMode: 'variable' },
  { id: 'prec-falafel-bowl',   name: 'Falafel & hummus bowl',      category: 'Salad', shelfLifeMinutes: 6 * 60, skuId: 'sku-falafel-bowl',   allowCarryOver: false, selectionTags: ['core', 'midday'], workflowId: 'wf-salad', defaultMode: 'variable' },

  // ─── Pots & snacks ───────────────────────────────────────────────────────
  { id: 'prec-fruit-pot',   name: 'Fresh fruit pot',       category: 'Snack', shelfLifeMinutes: 24 * 60, batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-fruit-pot',   allowCarryOver: true, selectionTags: ['morning', 'midday', 'afternoon'], workflowId: 'wf-filling', defaultMode: 'variable' },
  { id: 'prec-yogurt-pot',  name: 'Greek yogurt & honey',  category: 'Snack', shelfLifeMinutes: 24 * 60, batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-yogurt-pot',  allowCarryOver: true, selectionTags: ['breakfast', 'morning'],           workflowId: 'wf-filling', defaultMode: 'variable' },
  { id: 'prec-granola-pot', name: 'Granola & berries pot', category: 'Snack', shelfLifeMinutes: 24 * 60, batchRules: { min: 4, max: 10, multipleOf: 2 }, skuId: 'sku-granola-pot', allowCarryOver: true, selectionTags: ['breakfast', 'morning'],           workflowId: 'wf-filling', defaultMode: 'variable' },

  // ─── Beverages ───────────────────────────────────────────────────────────
  { id: 'prec-iced-coffee',    name: 'Iced caramel latte (2L)', category: 'Beverage', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 1, multipleOf: 1 }, skuId: 'sku-iced-coffee',    allowCarryOver: false, selectionTags: ['midday', 'afternoon'],               workflowId: 'wf-brewed-coffee', defaultMode: 'increment' },
  { id: 'prec-green-smoothie', name: 'Green smoothie',          category: 'Beverage', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 2, multipleOf: 1 }, skuId: 'sku-green-smoothie', allowCarryOver: false, selectionTags: ['breakfast', 'morning', 'midday'], workflowId: 'wf-brewed-coffee', defaultMode: 'increment' },
  { id: 'prec-porridge',       name: 'Oat porridge pot',        category: 'Bakery',   shelfLifeMinutes: 90,     batchRules: { min: 2, max: 6, multipleOf: 2 }, skuId: 'sku-porridge',       allowCarryOver: false, selectionTags: ['breakfast', 'morning'],             workflowId: 'wf-brewed-coffee', defaultMode: 'increment' },

  // ─── Hot-prep runs ───────────────────────────────────────────────────────
  { id: 'prec-roast-chicken', name: 'Pulled roast chicken (tray)', category: 'Sandwich', shelfLifeMinutes: 12 * 60, batchRules: { min: 1, max: 4, multipleOf: 1 }, skuId: 'sku-roast-chicken', allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-bolognese',     name: 'Slow-cooked bolognese',       category: 'Sandwich', shelfLifeMinutes: 12 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-bolognese',     allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-pulled-pork',   name: 'Pulled pork (tray)',          category: 'Sandwich', shelfLifeMinutes: 12 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-pulled-pork',   allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },

  // ─── Grill bench: hot components that feed sandwich assembly ────────────
  { id: 'prec-grilled-chicken',  name: 'Grilled chicken strips', category: 'Sandwich', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-grilled-chicken',  allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-grilled-halloumi', name: 'Chargrilled halloumi',   category: 'Sandwich', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-grilled-halloumi', allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-chargrilled-veg',  name: 'Chargrilled peppers & veg', category: 'Sandwich', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-chargrilled-veg', allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-crispy-bacon',     name: 'Crispy bacon',           category: 'Sandwich', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-crispy-bacon',     allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },

  // ─── Hot shelf increments (short shelf-life, baked through the day) ─────
  { id: 'prec-hot-croissant',  name: 'Hot croissant refresh',   category: 'Bakery', shelfLifeMinutes: 90,     batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-hot-croissant',  allowCarryOver: false, selectionTags: ['morning', 'midday'],             workflowId: 'wf-cookie', defaultMode: 'increment' },
  { id: 'prec-cheese-twist',   name: 'Cheese & marmite twist',  category: 'Bakery', shelfLifeMinutes: 3 * 60, batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-cheese-twist',   allowCarryOver: false, selectionTags: ['morning', 'midday', 'afternoon'], workflowId: 'wf-cookie', defaultMode: 'increment' },
  { id: 'prec-sausage-roll',   name: 'Sausage roll',            category: 'Bakery', shelfLifeMinutes: 4 * 60, batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-sausage-roll',   allowCarryOver: false, selectionTags: ['midday', 'afternoon'],           workflowId: 'wf-cookie', defaultMode: 'increment' },
  { id: 'prec-soup-day',       name: 'Soup of the day (2L)',    category: 'Sandwich',shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 2,  multipleOf: 1 }, skuId: 'sku-soup-day',       allowCarryOver: false, selectionTags: ['midday', 'afternoon'],           workflowId: 'wf-filling', defaultMode: 'increment' },
  { id: 'prec-pizza-slice',    name: 'Pizza slice',             category: 'Bakery', shelfLifeMinutes: 90,     batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-pizza-slice',    allowCarryOver: false, selectionTags: ['midday', 'afternoon'],           workflowId: 'wf-cookie', defaultMode: 'increment' },

  // ─── End-of-day next-day prep (off-mode on run benches) ─────────────────
  { id: 'prec-eod-chicken-prep', name: 'Tomorrow: chicken filling mise', category: 'Sandwich', shelfLifeMinutes: 12 * 60, batchRules: { min: 1, max: 4, multipleOf: 1 }, skuId: 'sku-eod-chicken-prep', allowCarryOver: false, selectionTags: ['closing'], workflowId: 'wf-filling', defaultMode: 'variable' },
  { id: 'prec-eod-dough-prep',   name: 'Tomorrow: dough proof',          category: 'Bakery',   shelfLifeMinutes: 18 * 60, batchRules: { min: 1, max: 6, multipleOf: 1 }, skuId: 'sku-eod-dough-prep',   allowCarryOver: false, selectionTags: ['closing'], workflowId: 'wf-filling', defaultMode: 'variable' },
  { id: 'prec-eod-roast-prep',   name: 'Tomorrow: roast & stock prep',   category: 'Sandwich', shelfLifeMinutes: 18 * 60, batchRules: { min: 1, max: 4, multipleOf: 1 }, skuId: 'sku-eod-roast-prep',   allowCarryOver: false, selectionTags: ['closing'], workflowId: 'wf-filling', defaultMode: 'variable' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Workflows (DAG)
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowStage = {
  id: StageId;
  label: string;
  capability: BenchCapability;
  /** -2 = D-2, -1 = D-1, 0 = D0 (same day as consumption). V1 max = -2. */
  leadOffset: -2 | -1 | 0;
  /** Estimated duration for planning a batch of default size (minutes). */
  durationMinutes: number;
  optional?: boolean;
  /** Stages in the same parallelGroup can run concurrently. */
  parallelGroup?: string;
};

export type WorkflowEdge = { from: StageId; to: StageId };

export type ProductionWorkflow = {
  id: WorkflowId;
  stages: WorkflowStage[];
  edges: WorkflowEdge[];
};

export const PRET_WORKFLOWS: Record<WorkflowId, ProductionWorkflow> = {
  'wf-croissant': {
    id: 'wf-croissant',
    stages: [
      { id: 'ferment', label: 'Overnight ferment', capability: 'proofing', leadOffset: -1, durationMinutes: 8 * 60 },
      { id: 'bake', label: 'Bake', capability: 'oven', leadOffset: 0, durationMinutes: 18 },
      { id: 'cool', label: 'Cool', capability: 'cold-prep', leadOffset: 0, durationMinutes: 12 },
      { id: 'pack', label: 'Pack', capability: 'pack', leadOffset: 0, durationMinutes: 10 },
    ],
    edges: [
      { from: 'ferment', to: 'bake' },
      { from: 'bake', to: 'cool' },
      { from: 'cool', to: 'pack' },
    ],
  },
  'wf-cookie': {
    id: 'wf-cookie',
    stages: [
      { id: 'bake', label: 'Bake', capability: 'oven', leadOffset: 0, durationMinutes: 12 },
    ],
    edges: [],
  },
  'wf-brewed-coffee': {
    id: 'wf-brewed-coffee',
    stages: [
      { id: 'brew', label: 'Brew', capability: 'cold-prep', leadOffset: 0, durationMinutes: 6 },
    ],
    edges: [],
  },
  'wf-ciabatta': {
    id: 'wf-ciabatta',
    stages: [
      { id: 'ferment', label: 'Overnight ferment', capability: 'proofing', leadOffset: -1, durationMinutes: 10 * 60 },
      { id: 'bake', label: 'Bake', capability: 'oven', leadOffset: 0, durationMinutes: 25 },
    ],
    edges: [{ from: 'ferment', to: 'bake' }],
  },
  'wf-filling': {
    id: 'wf-filling',
    stages: [
      { id: 'prep', label: 'Prep filling', capability: 'cold-prep', leadOffset: 0, durationMinutes: 30 },
    ],
    edges: [],
  },
  'wf-sandwich': {
    // demonstrates D-2 depth: ciabatta ferment is a dependency two days out for some hubs
    id: 'wf-sandwich',
    stages: [
      { id: 'assemble', label: 'Assemble', capability: 'assemble', leadOffset: 0, durationMinutes: 4 },
    ],
    edges: [],
  },
  'wf-salad': {
    id: 'wf-salad',
    stages: [
      { id: 'prep', label: 'Plate to order', capability: 'prep', leadOffset: 0, durationMinutes: 3 },
    ],
    edges: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Production items — per-SKU attachment: which site makes which recipe, how
// ─────────────────────────────────────────────────────────────────────────────

export type IncrementCadence = {
  /** How often a fresh batch should drop. */
  intervalMinutes: number;
  /** Start/end within the day (inclusive). HH:MM. */
  startTime: string;
  endTime: string;
  /** Quinn's proposal — the hub can override at the site level. */
  quinnProposed: boolean;
};

export type ProductionItem = {
  id: ProductionItemId;
  siteId: SiteId;
  recipeId: RecipeId;
  skuId: SkuId;
  mode: ProductionMode;
  /** Default batch size for planning (subject to batch rules + forecast). */
  batchSize: number;
  /** Only populated when mode === 'increment'. */
  cadence?: IncrementCadence;
  /**
   * Explicit bench override. When set, this bench is used as the item's
   * primary bench regardless of workflow capability or mode match. Used for
   * intentional off-mode work like next-day prep that happens on a run bench
   * after service, or for grouping hot components onto a dedicated grill
   * bench even though they have generic 'prep' capability.
   */
  preferredBenchId?: BenchId;
};

export const PRET_PRODUCTION_ITEMS: ProductionItem[] = [
  // hub-central — full bakery
  // ─── hub-central — 7-bench layout ────────────────────────────────────────
  // Bakery runs (all preferredBenchId: bench-run-bakery) -----------------
  { id: 'pi-central-croissant',        siteId: 'hub-central', recipeId: 'prec-croissant',        skuId: 'sku-croissant',        mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-pain',             siteId: 'hub-central', recipeId: 'prec-pain-au-chocolat', skuId: 'sku-pain-au-choc',     mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-ciabatta',         siteId: 'hub-central', recipeId: 'prec-ciabatta',         skuId: 'sku-ciabatta',         mode: 'run', batchSize: 18, preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-almond-croissant', siteId: 'hub-central', recipeId: 'prec-almond-croissant', skuId: 'sku-almond-croissant', mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-cinnamon-swirl',   siteId: 'hub-central', recipeId: 'prec-cinnamon-swirl',   skuId: 'sku-cinnamon-swirl',   mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-baguette',         siteId: 'hub-central', recipeId: 'prec-baguette',         skuId: 'sku-baguette',         mode: 'run', batchSize: 18, preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-granary',          siteId: 'hub-central', recipeId: 'prec-granary',          skuId: 'sku-granary',          mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-focaccia',         siteId: 'hub-central', recipeId: 'prec-focaccia',         skuId: 'sku-focaccia',         mode: 'run', batchSize: 8,  preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-blueberry-muffin', siteId: 'hub-central', recipeId: 'prec-blueberry-muffin', skuId: 'sku-blueberry-muffin', mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-banana-bread',     siteId: 'hub-central', recipeId: 'prec-banana-bread',     skuId: 'sku-banana-bread',     mode: 'run', batchSize: 16, preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-brownie',          siteId: 'hub-central', recipeId: 'prec-brownie',          skuId: 'sku-brownie',          mode: 'run', batchSize: 16, preferredBenchId: 'bench-run-bakery' },

  // Cold-prep runs: fillings, dips, dressings → bench-run-cold-prep ------
  { id: 'pi-central-filling',      siteId: 'hub-central', recipeId: 'prec-chicken-mayo-filling', skuId: 'sku-chicken-mayo-filling', mode: 'run', batchSize: 2, preferredBenchId: 'bench-run-cold-prep' },
  { id: 'pi-central-egg-filling',  siteId: 'hub-central', recipeId: 'prec-egg-mayo-filling',     skuId: 'sku-egg-mayo-filling',     mode: 'run', batchSize: 2, preferredBenchId: 'bench-run-cold-prep' },
  { id: 'pi-central-tuna-filling', siteId: 'hub-central', recipeId: 'prec-tuna-mayo-filling',    skuId: 'sku-tuna-mayo-filling',    mode: 'run', batchSize: 2, preferredBenchId: 'bench-run-cold-prep' },
  { id: 'pi-central-hummus',       siteId: 'hub-central', recipeId: 'prec-hummus',               skuId: 'sku-hummus',               mode: 'run', batchSize: 2, preferredBenchId: 'bench-run-cold-prep' },

  // Hot-prep runs: roasts, slow-cooks → bench-run-hot-prep ---------------
  { id: 'pi-central-roast-chicken', siteId: 'hub-central', recipeId: 'prec-roast-chicken', skuId: 'sku-roast-chicken', mode: 'run', batchSize: 8,  preferredBenchId: 'bench-run-hot-prep' },
  { id: 'pi-central-bolognese',     siteId: 'hub-central', recipeId: 'prec-bolognese',     skuId: 'sku-bolognese',     mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-hot-prep' },
  { id: 'pi-central-pulled-pork',   siteId: 'hub-central', recipeId: 'prec-pulled-pork',   skuId: 'sku-pulled-pork',   mode: 'run', batchSize: 6,  preferredBenchId: 'bench-run-hot-prep' },

  // Grill bench: hot components for sandwich assembly → bench-grill ------
  { id: 'pi-central-grilled-chicken',  siteId: 'hub-central', recipeId: 'prec-grilled-chicken',  skuId: 'sku-grilled-chicken',  mode: 'run', batchSize: 10, preferredBenchId: 'bench-grill' },
  { id: 'pi-central-grilled-halloumi', siteId: 'hub-central', recipeId: 'prec-grilled-halloumi', skuId: 'sku-grilled-halloumi', mode: 'run', batchSize: 8,  preferredBenchId: 'bench-grill' },
  { id: 'pi-central-chargrilled-veg',  siteId: 'hub-central', recipeId: 'prec-chargrilled-veg',  skuId: 'sku-chargrilled-veg',  mode: 'run', batchSize: 8,  preferredBenchId: 'bench-grill' },
  { id: 'pi-central-crispy-bacon',     siteId: 'hub-central', recipeId: 'prec-crispy-bacon',     skuId: 'sku-crispy-bacon',     mode: 'run', batchSize: 10, preferredBenchId: 'bench-grill' },

  // Assembly (variable): sandwiches + salads → bench-assembly ------------
  { id: 'pi-central-club',         siteId: 'hub-central', recipeId: 'prec-club-sandwich',         skuId: 'sku-club-sandwich',        mode: 'variable', batchSize: 10, preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-egg-mayo-sw',  siteId: 'hub-central', recipeId: 'prec-egg-mayo-sandwich',     skuId: 'sku-egg-mayo-sandwich',    mode: 'variable', batchSize: 10, preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-ham-cheese',   siteId: 'hub-central', recipeId: 'prec-ham-cheese-baguette',   skuId: 'sku-ham-cheese-baguette',  mode: 'variable', batchSize: 8,  preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-tuna-sw',      siteId: 'hub-central', recipeId: 'prec-tuna-sandwich',         skuId: 'sku-tuna-sandwich',        mode: 'variable', batchSize: 10, preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-hummus-wrap',  siteId: 'hub-central', recipeId: 'prec-hummus-wrap',           skuId: 'sku-hummus-wrap',          mode: 'variable', batchSize: 8,  preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-turkey-brie',  siteId: 'hub-central', recipeId: 'prec-turkey-brie-baguette',  skuId: 'sku-turkey-brie-baguette', mode: 'variable', batchSize: 8,  preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-salad',        siteId: 'hub-central', recipeId: 'prec-salad-bowl',            skuId: 'sku-salad-bowl',           mode: 'variable', batchSize: 1,  preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-caesar',       siteId: 'hub-central', recipeId: 'prec-chicken-caesar',        skuId: 'sku-chicken-caesar',       mode: 'variable', batchSize: 1,  preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-grain',        siteId: 'hub-central', recipeId: 'prec-med-grain-bowl',        skuId: 'sku-med-grain-bowl',       mode: 'variable', batchSize: 1,  preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-pasta',        siteId: 'hub-central', recipeId: 'prec-chicken-pasta',         skuId: 'sku-chicken-pasta',        mode: 'variable', batchSize: 1,  preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-falafel',      siteId: 'hub-central', recipeId: 'prec-falafel-bowl',          skuId: 'sku-falafel-bowl',         mode: 'variable', batchSize: 1,  preferredBenchId: 'bench-assembly' },

  // Variable bench: pots & sides (built through service) → bench-variable -
  { id: 'pi-central-fruit-pot',   siteId: 'hub-central', recipeId: 'prec-fruit-pot',   skuId: 'sku-fruit-pot',   mode: 'variable', batchSize: 1, preferredBenchId: 'bench-variable' },
  { id: 'pi-central-yogurt-pot',  siteId: 'hub-central', recipeId: 'prec-yogurt-pot',  skuId: 'sku-yogurt-pot',  mode: 'variable', batchSize: 1, preferredBenchId: 'bench-variable' },
  { id: 'pi-central-granola-pot', siteId: 'hub-central', recipeId: 'prec-granola-pot', skuId: 'sku-granola-pot', mode: 'variable', batchSize: 1, preferredBenchId: 'bench-variable' },

  // Hot shelf increments (10 total, short shelf-life) → bench-increment-hot
  {
    id: 'pi-central-cookie',
    siteId: 'hub-central', recipeId: 'prec-cookie', skuId: 'sku-cookie',
    mode: 'increment', batchSize: 8,
    cadence: { intervalMinutes: 45, startTime: '08:00', endTime: '18:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-coffee',
    siteId: 'hub-central', recipeId: 'prec-brewed-coffee', skuId: 'sku-brewed-coffee',
    mode: 'increment', batchSize: 1,
    cadence: { intervalMinutes: 30, startTime: '06:00', endTime: '20:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-iced-coffee',
    siteId: 'hub-central', recipeId: 'prec-iced-coffee', skuId: 'sku-iced-coffee',
    mode: 'increment', batchSize: 1,
    cadence: { intervalMinutes: 90, startTime: '08:00', endTime: '18:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-green-smoothie',
    siteId: 'hub-central', recipeId: 'prec-green-smoothie', skuId: 'sku-green-smoothie',
    mode: 'increment', batchSize: 1,
    cadence: { intervalMinutes: 60, startTime: '07:00', endTime: '15:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-porridge',
    siteId: 'hub-central', recipeId: 'prec-porridge', skuId: 'sku-porridge',
    mode: 'increment', batchSize: 4,
    cadence: { intervalMinutes: 45, startTime: '06:30', endTime: '10:30', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-hot-croissant',
    siteId: 'hub-central', recipeId: 'prec-hot-croissant', skuId: 'sku-hot-croissant',
    mode: 'increment', batchSize: 6,
    cadence: { intervalMinutes: 60, startTime: '07:00', endTime: '14:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-cheese-twist',
    siteId: 'hub-central', recipeId: 'prec-cheese-twist', skuId: 'sku-cheese-twist',
    mode: 'increment', batchSize: 8,
    cadence: { intervalMinutes: 60, startTime: '08:00', endTime: '16:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-sausage-roll',
    siteId: 'hub-central', recipeId: 'prec-sausage-roll', skuId: 'sku-sausage-roll',
    mode: 'increment', batchSize: 10,
    cadence: { intervalMinutes: 45, startTime: '09:00', endTime: '17:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-soup-day',
    siteId: 'hub-central', recipeId: 'prec-soup-day', skuId: 'sku-soup-day',
    mode: 'increment', batchSize: 8,
    cadence: { intervalMinutes: 90, startTime: '11:00', endTime: '16:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-pizza-slice',
    siteId: 'hub-central', recipeId: 'prec-pizza-slice', skuId: 'sku-pizza-slice',
    mode: 'increment', batchSize: 6,
    cadence: { intervalMinutes: 60, startTime: '11:00', endTime: '17:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },

  // End-of-day next-day prep (variable mode landing on run benches → tail)
  { id: 'pi-central-eod-chicken-prep', siteId: 'hub-central', recipeId: 'prec-eod-chicken-prep', skuId: 'sku-eod-chicken-prep', mode: 'variable', batchSize: 4, preferredBenchId: 'bench-run-cold-prep' },
  { id: 'pi-central-eod-dough-prep',   siteId: 'hub-central', recipeId: 'prec-eod-dough-prep',   skuId: 'sku-eod-dough-prep',   mode: 'variable', batchSize: 6, preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-eod-roast-prep',   siteId: 'hub-central', recipeId: 'prec-eod-roast-prep',   skuId: 'sku-eod-roast-prep',   mode: 'variable', batchSize: 4, preferredBenchId: 'bench-run-hot-prep' },

  // site-standalone-north — fully self-producing
  { id: 'pi-north-croissant', siteId: 'site-standalone-north', recipeId: 'prec-croissant', skuId: 'sku-croissant', mode: 'run', batchSize: 8 },
  { id: 'pi-north-club', siteId: 'site-standalone-north', recipeId: 'prec-club-sandwich', skuId: 'sku-club-sandwich', mode: 'variable', batchSize: 6 },
  { id: 'pi-north-salad', siteId: 'site-standalone-north', recipeId: 'prec-salad-bowl', skuId: 'sku-salad-bowl', mode: 'variable', batchSize: 1 },
  {
    id: 'pi-north-coffee',
    siteId: 'site-standalone-north',
    recipeId: 'prec-brewed-coffee',
    skuId: 'sku-brewed-coffee',
    mode: 'increment',
    batchSize: 1,
    cadence: { intervalMinutes: 45, startTime: '06:30', endTime: '19:00', quinnProposed: true },
  },

  // site-hybrid-airport — bakes some, receives some, assembles on-site
  { id: 'pi-airport-croissant', siteId: 'site-hybrid-airport', recipeId: 'prec-croissant', skuId: 'sku-croissant', mode: 'run', batchSize: 12 },
  { id: 'pi-airport-club', siteId: 'site-hybrid-airport', recipeId: 'prec-club-sandwich', skuId: 'sku-club-sandwich', mode: 'variable', batchSize: 8 },
  {
    id: 'pi-airport-coffee',
    siteId: 'site-hybrid-airport',
    recipeId: 'prec-brewed-coffee',
    skuId: 'sku-brewed-coffee',
    mode: 'increment',
    batchSize: 1,
    // airport override: Quinn proposed 30-min; hub overrode to 20-min for commuter peak
    cadence: { intervalMinutes: 20, startTime: '04:30', endTime: '22:30', quinnProposed: false },
  },

  // site-spoke-south — receive-only, no production items of its own
];

// ─────────────────────────────────────────────────────────────────────────────
// Effective batch rules — recipe wins, bench is the fallback
// ─────────────────────────────────────────────────────────────────────────────

export type EffectiveBatchRules = BatchRules & {
  /** Which side is currently the binding cap. */
  binding: 'recipe' | 'bench' | 'recipe+bench' | 'none';
  /** Plain-language explanation for the tooltip. */
  explain: string;
};

/**
 * Quinn's proposed batch split for a target quantity under given rules.
 * Packs full max-sized batches first, then rounds the remainder up to the
 * nearest multiple (capped at max; if that spills, splits in half).
 */
export function proposeBatchSplit(
  qty: number,
  rules: BatchRules,
): { batches: number[]; total: number; overshoot: number; undershoot: number } {
  const { min, max, multipleOf } = rules;
  if (qty <= 0 || max <= 0) {
    return { batches: [], total: 0, overshoot: 0, undershoot: Math.max(0, qty) };
  }
  const fullCount = Math.floor(qty / max);
  const batches: number[] = Array(fullCount).fill(max);
  const remainder = qty - fullCount * max;
  if (remainder > 0) {
    const rounded = Math.max(min, Math.ceil(remainder / multipleOf) * multipleOf);
    if (rounded <= max) {
      batches.push(rounded);
    } else {
      // Shouldn't happen under normal rules, but split in half defensively.
      const half = Math.max(min, Math.ceil(remainder / 2 / multipleOf) * multipleOf);
      batches.push(half, half);
    }
  }
  const total = batches.reduce((a, b) => a + b, 0);
  return {
    batches,
    total,
    overshoot: Math.max(0, total - qty),
    undershoot: Math.max(0, qty - total),
  };
}

/** Resolves the effective {min,max,multipleOf} when both a recipe and a bench define rules. */
export function effectiveBatchRules(
  recipeRules: BatchRules | undefined,
  benchRules: BatchRules | undefined,
): EffectiveBatchRules {
  if (!recipeRules && !benchRules) {
    return { min: 1, max: Infinity, multipleOf: 1, binding: 'none', explain: 'No batch rules set.' };
  }
  if (recipeRules && !benchRules) {
    return { ...recipeRules, binding: 'recipe', explain: `Recipe caps at ${recipeRules.min}–${recipeRules.max} in multiples of ${recipeRules.multipleOf}.` };
  }
  if (!recipeRules && benchRules) {
    return { ...benchRules, binding: 'bench', explain: `Bench holds ${benchRules.min}–${benchRules.max} in multiples of ${benchRules.multipleOf}.` };
  }
  // Both set — recipe wins on max. Take tightest min/max; lcm-ish multiple (take max for safety in V1).
  const r = recipeRules!;
  const b = benchRules!;
  const min = Math.max(r.min, b.min);
  const max = Math.min(r.max, b.max);
  const multipleOf = Math.max(r.multipleOf, b.multipleOf);
  const bindingMin = r.min >= b.min ? 'recipe' : 'bench';
  const bindingMax = r.max <= b.max ? 'recipe' : 'bench';
  const binding: EffectiveBatchRules['binding'] =
    bindingMin === bindingMax ? bindingMin : 'recipe+bench';
  const explain =
    `Bench holds ${b.min}–${b.max} in ${b.multipleOf}s; recipe caps at ${r.min}–${r.max} in ${r.multipleOf}s. ` +
    `Effective: ${min}–${max} in ${multipleOf}s (recipe wins on max).`;
  return { min, max, multipleOf, binding, explain };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assortment — Ranges + Tiers (single shape, two roles)
// ─────────────────────────────────────────────────────────────────────────────

export type TimeWindow = {
  start: string; // HH:MM
  end: string;   // HH:MM
  /** Granularity hint — how this window was authored. */
  granularity: 'hour' | 'run' | 'phase' | 'custom';
};

export type AvailabilityRule = {
  /** Days the SKU is available within this range. */
  daysOfWeek: DayOfWeek[];
  /** Intra-day windows; empty = all-day. Multiple windows allowed. */
  windows: TimeWindow[];
};

export type RangeEntry = {
  skuId: SkuId;
  recipeId: RecipeId;
  availability: AvailabilityRule;
};

export type Range = {
  id: RangeId;
  name: string;
  estateId: EstateId;
  /** SKUs in this range + per-SKU availability. */
  entries: RangeEntry[];
  /** Optional format constraint — when set, only sites in this format may use it. */
  formatFilter?: FormatId[];
};

export type Tier = {
  id: TierId;
  name: string;
  estateId: EstateId;
  /** Ranges this tier composes (stackable). */
  rangeIds: RangeId[];
  /** Explicit priority when ranges overlap on the same SKU; higher wins.
   *  Falls back to "more permissive window wins" if omitted. */
  priority?: Record<RangeId, number>;
};

export type SiteTierAssignment = {
  siteId: SiteId;
  /** Per-day tier assignment. */
  byDayOfWeek: Record<DayOfWeek, TierId>;
};

export const PRET_RANGES: Range[] = [
  {
    id: 'range-core',
    name: 'Core',
    estateId: 'estate-pret',
    entries: [
      { skuId: 'sku-croissant',         recipeId: 'prec-croissant',         availability: { daysOfWeek: DAYS_OF_WEEK, windows: [] } },
      { skuId: 'sku-pain-au-choc',      recipeId: 'prec-pain-au-chocolat',  availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '06:00', end: '12:00', granularity: 'phase' }] } },
      { skuId: 'sku-cookie',            recipeId: 'prec-cookie',            availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '08:00', end: '20:00', granularity: 'phase' }] } },
      { skuId: 'sku-brewed-coffee',     recipeId: 'prec-brewed-coffee',     availability: { daysOfWeek: DAYS_OF_WEEK, windows: [] } },
      { skuId: 'sku-club-sandwich',     recipeId: 'prec-club-sandwich',     availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '10:00', end: '20:00', granularity: 'custom' }] } },
      { skuId: 'sku-salad-bowl',        recipeId: 'prec-salad-bowl',        availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '11:00', end: '16:00', granularity: 'custom' }] } },
    ],
  },
  {
    id: 'range-brunch',
    name: 'Brunch (Sun)',
    estateId: 'estate-pret',
    entries: [
      // Stacked on Sunday — expands croissant window, adds pain au choc all morning
      { skuId: 'sku-croissant',    recipeId: 'prec-croissant',        availability: { daysOfWeek: ['Sun'], windows: [{ start: '09:00', end: '13:00', granularity: 'phase' }] } },
      { skuId: 'sku-pain-au-choc', recipeId: 'prec-pain-au-chocolat', availability: { daysOfWeek: ['Sun'], windows: [{ start: '09:00', end: '13:00', granularity: 'phase' }] } },
    ],
  },
  {
    id: 'range-airport-commuter',
    name: 'Airport commuter',
    estateId: 'estate-pret',
    formatFilter: ['format-airport'],
    entries: [
      { skuId: 'sku-brewed-coffee', recipeId: 'prec-brewed-coffee', availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '04:30', end: '10:00', granularity: 'hour' }] } },
      { skuId: 'sku-croissant',     recipeId: 'prec-croissant',     availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '04:30', end: '10:00', granularity: 'hour' }] } },
    ],
  },
];

export const PRET_TIERS: Tier[] = [
  { id: 'tier-weekday', name: 'Weekday',  estateId: 'estate-pret', rangeIds: ['range-core'] },
  { id: 'tier-weekend', name: 'Weekend',  estateId: 'estate-pret', rangeIds: ['range-core', 'range-brunch'] },
  { id: 'tier-airport', name: 'Airport',  estateId: 'estate-pret', rangeIds: ['range-core', 'range-airport-commuter'] },
];

export const PRET_SITE_TIER_ASSIGNMENTS: SiteTierAssignment[] = [
  {
    siteId: 'hub-central',
    byDayOfWeek: { Mon: 'tier-weekday', Tue: 'tier-weekday', Wed: 'tier-weekday', Thu: 'tier-weekday', Fri: 'tier-weekday', Sat: 'tier-weekday', Sun: 'tier-weekend' },
  },
  {
    siteId: 'site-standalone-north',
    byDayOfWeek: { Mon: 'tier-weekday', Tue: 'tier-weekday', Wed: 'tier-weekday', Thu: 'tier-weekday', Fri: 'tier-weekday', Sat: 'tier-weekday', Sun: 'tier-weekend' },
  },
  {
    siteId: 'site-spoke-south',
    byDayOfWeek: { Mon: 'tier-weekday', Tue: 'tier-weekday', Wed: 'tier-weekday', Thu: 'tier-weekday', Fri: 'tier-weekday', Sat: 'tier-weekday', Sun: 'tier-weekend' },
  },
  {
    siteId: 'site-hybrid-airport',
    byDayOfWeek: { Mon: 'tier-airport', Tue: 'tier-airport', Wed: 'tier-airport', Thu: 'tier-airport', Fri: 'tier-airport', Sat: 'tier-airport', Sun: 'tier-airport' },
  },
];

/** Is a SKU sellable/producible at a site on a given day+time? The hard gate. */
export function isSkuAvailable(
  skuId: SkuId,
  siteId: SiteId,
  iso: string,
  timeHHMM: string,
): { available: boolean; reason: string } {
  const dow = dayOfWeek(iso);
  const assignment = PRET_SITE_TIER_ASSIGNMENTS.find(a => a.siteId === siteId);
  if (!assignment) return { available: false, reason: `Site ${siteId} has no tier assignment.` };
  const tier = PRET_TIERS.find(t => t.id === assignment.byDayOfWeek[dow]);
  if (!tier) return { available: false, reason: `Tier missing for ${dow}.` };
  const site = PRET_SITES.find(s => s.id === siteId);
  const ranges = tier.rangeIds
    .map(rid => PRET_RANGES.find(r => r.id === rid))
    .filter((r): r is Range => !!r)
    .filter(r => !r.formatFilter || (site && r.formatFilter.includes(site.formatId)));
  for (const range of ranges) {
    for (const entry of range.entries.filter(e => e.skuId === skuId)) {
      if (!entry.availability.daysOfWeek.includes(dow)) continue;
      if (entry.availability.windows.length === 0) return { available: true, reason: `All-day in ${range.name}.` };
      for (const w of entry.availability.windows) {
        if (timeHHMM >= w.start && timeHHMM <= w.end) {
          return { available: true, reason: `Active window ${w.start}–${w.end} in ${range.name}.` };
        }
      }
    }
  }
  return { available: false, reason: `Outside tier windows for ${dow} at ${timeHHMM}.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Forecast + Plan + PlannedInstance + Batch + PCR
// ─────────────────────────────────────────────────────────────────────────────

export type DemandSignal =
  | 'sales-history'
  | 'weather'
  | 'stock-on-hand'
  | 'online-orders'
  | 'waste-history'
  | 'event'
  | 'promo';

export type DemandForecastEntry = {
  siteId: SiteId;
  skuId: SkuId;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  /** Projected units for the day. */
  projectedUnits: number;
  /** Per-phase breakdown (morning/midday/afternoon). Optional. */
  byPhase?: { morning: number; midday: number; afternoon: number };
  /** Signals contributing to the projection, with their relative weight (0–1). */
  signals: { signal: DemandSignal; weight: number; note?: string }[];
  /** Quinn-drafted; Manager confirms. */
  status: 'draft' | 'confirmed';
};

export const PRET_FORECAST: DemandForecastEntry[] = [
  // hub-central — Thursday (D0)
  {
    siteId: 'hub-central', skuId: 'sku-croissant', date: DEMO_TODAY, projectedUnits: 48,
    byPhase: { morning: 30, midday: 12, afternoon: 6 },
    signals: [
      { signal: 'sales-history', weight: 0.6, note: '4-week median for Thu' },
      { signal: 'weather', weight: 0.2, note: 'Dry, 14°C — commute normal' },
      { signal: 'waste-history', weight: 0.2, note: 'Avg 4/day last 2 weeks' },
    ],
    status: 'confirmed',
  },
  {
    siteId: 'hub-central', skuId: 'sku-pain-au-choc', date: DEMO_TODAY, projectedUnits: 36,
    byPhase: { morning: 24, midday: 8, afternoon: 4 },
    signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2 }],
    status: 'confirmed',
  },
  {
    siteId: 'hub-central', skuId: 'sku-club-sandwich', date: DEMO_TODAY, projectedUnits: 120,
    byPhase: { morning: 10, midday: 80, afternoon: 30 },
    signals: [
      { signal: 'sales-history', weight: 0.5 },
      { signal: 'online-orders', weight: 0.3, note: '18 pre-orders already in' },
      { signal: 'event', weight: 0.2, note: 'Conference 500m away' },
    ],
    status: 'confirmed',
  },
  {
    siteId: 'hub-central', skuId: 'sku-salad-bowl', date: DEMO_TODAY, projectedUnits: 40,
    byPhase: { morning: 2, midday: 28, afternoon: 10 },
    signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'weather', weight: 0.3 }],
    status: 'confirmed',
  },
  {
    siteId: 'hub-central', skuId: 'sku-cookie', date: DEMO_TODAY, projectedUnits: 72,
    byPhase: { morning: 12, midday: 30, afternoon: 30 },
    signals: [{ signal: 'sales-history', weight: 1 }],
    status: 'draft',
  },

  // site-hybrid-airport — Thursday
  {
    siteId: 'site-hybrid-airport', skuId: 'sku-croissant', date: DEMO_TODAY, projectedUnits: 60,
    byPhase: { morning: 48, midday: 8, afternoon: 4 },
    signals: [{ signal: 'sales-history', weight: 0.5 }, { signal: 'event', weight: 0.5, note: 'Outbound travel peak' }],
    status: 'confirmed',
  },

  // ─── hub-central: expanded SKU set for Thursday ──────────────────────────
  // Bakery (viennoiserie + breads + cakes)
  { siteId: 'hub-central', skuId: 'sku-almond-croissant', date: DEMO_TODAY, projectedUnits: 24, byPhase: { morning: 18, midday: 4,  afternoon: 2  }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'waste-history', weight: 0.3, note: 'Steady 2/day waste' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-cinnamon-swirl',   date: DEMO_TODAY, projectedUnits: 18, byPhase: { morning: 14, midday: 3,  afternoon: 1  }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-baguette',         date: DEMO_TODAY, projectedUnits: 42, byPhase: { morning: 12, midday: 24, afternoon: 6  }, signals: [{ signal: 'sales-history', weight: 0.9, note: 'Driven by sandwich assembly' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-granary',          date: DEMO_TODAY, projectedUnits: 36, byPhase: { morning: 8,  midday: 24, afternoon: 4  }, signals: [{ signal: 'sales-history', weight: 0.9, note: 'Driven by sandwich assembly' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-focaccia',         date: DEMO_TODAY, projectedUnits: 12, byPhase: { morning: 2,  midday: 8,  afternoon: 2  }, signals: [{ signal: 'sales-history', weight: 0.8 }], status: 'draft' },
  { siteId: 'hub-central', skuId: 'sku-blueberry-muffin', date: DEMO_TODAY, projectedUnits: 30, byPhase: { morning: 14, midday: 10, afternoon: 6  }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'weather', weight: 0.3 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-banana-bread',     date: DEMO_TODAY, projectedUnits: 24, byPhase: { morning: 6,  midday: 10, afternoon: 8  }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-brownie',          date: DEMO_TODAY, projectedUnits: 32, byPhase: { morning: 2,  midday: 14, afternoon: 16 }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'event', weight: 0.2, note: 'Conference nearby' }], status: 'confirmed' },

  // Fillings (drive assembly)
  { siteId: 'hub-central', skuId: 'sku-egg-mayo-filling',  date: DEMO_TODAY, projectedUnits: 6, byPhase: { morning: 4, midday: 2, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Trays of 4kg, derived from assembly forecasts' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-tuna-mayo-filling', date: DEMO_TODAY, projectedUnits: 5, byPhase: { morning: 3, midday: 2, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Derived from tuna sandwich forecast' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-hummus',            date: DEMO_TODAY, projectedUnits: 3, byPhase: { morning: 2, midday: 1, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Drives hummus wrap assembly' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-ciabatta',          date: DEMO_TODAY, projectedUnits: 120, byPhase: { morning: 30, midday: 70, afternoon: 20 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Sub-recipe for club sandwich' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-chicken-mayo-filling', date: DEMO_TODAY, projectedUnits: 7, byPhase: { morning: 5, midday: 2, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Drives club sandwich' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-brewed-coffee',     date: DEMO_TODAY, projectedUnits: 22, byPhase: { morning: 14, midday: 6, afternoon: 2 }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2, note: 'Cool morning' }], status: 'confirmed' },

  // Assembly sandwiches
  { siteId: 'hub-central', skuId: 'sku-egg-mayo-sandwich',    date: DEMO_TODAY, projectedUnits: 80,  byPhase: { morning: 20, midday: 50, afternoon: 10 }, signals: [{ signal: 'sales-history', weight: 0.6 }, { signal: 'online-orders', weight: 0.4, note: '12 pre-orders' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-ham-cheese-baguette',  date: DEMO_TODAY, projectedUnits: 60,  byPhase: { morning: 10, midday: 38, afternoon: 12 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-tuna-sandwich',        date: DEMO_TODAY, projectedUnits: 50,  byPhase: { morning: 8,  midday: 34, afternoon: 8 },  signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-hummus-wrap',          date: DEMO_TODAY, projectedUnits: 42,  byPhase: { morning: 4,  midday: 28, afternoon: 10 }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'event', weight: 0.3, note: 'Vegan-friendly tag trending' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-turkey-brie-baguette', date: DEMO_TODAY, projectedUnits: 36,  byPhase: { morning: 4,  midday: 26, afternoon: 6 },  signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },

  // Salads
  { siteId: 'hub-central', skuId: 'sku-chicken-caesar', date: DEMO_TODAY, projectedUnits: 45, byPhase: { morning: 2, midday: 34, afternoon: 9  }, signals: [{ signal: 'sales-history', weight: 0.6 }, { signal: 'weather', weight: 0.4, note: 'Warm at lunchtime' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-med-grain-bowl', date: DEMO_TODAY, projectedUnits: 32, byPhase: { morning: 2, midday: 24, afternoon: 6  }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'weather', weight: 0.3 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-chicken-pasta',  date: DEMO_TODAY, projectedUnits: 38, byPhase: { morning: 2, midday: 28, afternoon: 8  }, signals: [{ signal: 'sales-history', weight: 0.8 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-falafel-bowl',   date: DEMO_TODAY, projectedUnits: 28, byPhase: { morning: 1, midday: 22, afternoon: 5  }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'promo', weight: 0.3, note: 'Featured on home screen' }], status: 'draft' },

  // Pots & snacks
  { siteId: 'hub-central', skuId: 'sku-fruit-pot',   date: DEMO_TODAY, projectedUnits: 30, byPhase: { morning: 10, midday: 14, afternoon: 6 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-yogurt-pot',  date: DEMO_TODAY, projectedUnits: 24, byPhase: { morning: 18, midday: 4,  afternoon: 2 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-granola-pot', date: DEMO_TODAY, projectedUnits: 20, byPhase: { morning: 16, midday: 3,  afternoon: 1 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },

  // Beverages
  { siteId: 'hub-central', skuId: 'sku-iced-coffee',    date: DEMO_TODAY, projectedUnits: 7,  byPhase: { morning: 1, midday: 4,  afternoon: 2 }, signals: [{ signal: 'sales-history', weight: 0.5 }, { signal: 'weather', weight: 0.5, note: 'Warming up at lunch' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-green-smoothie', date: DEMO_TODAY, projectedUnits: 9,  byPhase: { morning: 5, midday: 4,  afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'promo', weight: 0.3 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-porridge',       date: DEMO_TODAY, projectedUnits: 18, byPhase: { morning: 18, midday: 0, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2 }], status: 'confirmed' },

  // Hot-prep runs (new)
  { siteId: 'hub-central', skuId: 'sku-roast-chicken', date: DEMO_TODAY, projectedUnits: 3, byPhase: { morning: 3, midday: 0, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Trays — drives hot sandwich assembly' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-bolognese',     date: DEMO_TODAY, projectedUnits: 2, byPhase: { morning: 2, midday: 0, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-pulled-pork',   date: DEMO_TODAY, projectedUnits: 2, byPhase: { morning: 2, midday: 0, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },

  // Grill bench (new) — drives sandwich assembly
  { siteId: 'hub-central', skuId: 'sku-grilled-chicken',  date: DEMO_TODAY, projectedUnits: 3, byPhase: { morning: 2, midday: 1, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Drives chicken caesar, club, hot wraps' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-grilled-halloumi', date: DEMO_TODAY, projectedUnits: 2, byPhase: { morning: 1, midday: 1, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-chargrilled-veg',  date: DEMO_TODAY, projectedUnits: 2, byPhase: { morning: 1, midday: 1, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-crispy-bacon',     date: DEMO_TODAY, projectedUnits: 3, byPhase: { morning: 2, midday: 1, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Drives BLT + club' }], status: 'confirmed' },

  // Hot shelf increments (new)
  { siteId: 'hub-central', skuId: 'sku-hot-croissant', date: DEMO_TODAY, projectedUnits: 36, byPhase: { morning: 24, midday: 10, afternoon: 2 }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-cheese-twist',  date: DEMO_TODAY, projectedUnits: 28, byPhase: { morning: 12, midday: 12, afternoon: 4 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-sausage-roll',  date: DEMO_TODAY, projectedUnits: 42, byPhase: { morning: 8,  midday: 26, afternoon: 8 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-soup-day',      date: DEMO_TODAY, projectedUnits: 3,  byPhase: { morning: 0,  midday: 2,  afternoon: 1 }, signals: [{ signal: 'sales-history', weight: 1, note: '2L batches, refreshed through service' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-pizza-slice',   date: DEMO_TODAY, projectedUnits: 24, byPhase: { morning: 0,  midday: 18, afternoon: 6 }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2 }], status: 'confirmed' },

  // End-of-day next-day prep (new — variable mode, lands on run benches as tail)
  { siteId: 'hub-central', skuId: 'sku-eod-chicken-prep', date: DEMO_TODAY, projectedUnits: 3, byPhase: { morning: 0, midday: 0, afternoon: 3 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Mise for tomorrow — 3 trays' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-eod-dough-prep',   date: DEMO_TODAY, projectedUnits: 4, byPhase: { morning: 0, midday: 0, afternoon: 4 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Tomorrow\'s dough to cold-proof overnight' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-eod-roast-prep',   date: DEMO_TODAY, projectedUnits: 2, byPhase: { morning: 0, midday: 0, afternoon: 2 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Overnight roast / stock reduction' }], status: 'confirmed' },
];

export type PlannedInstance = {
  id: string;
  productionItemId: ProductionItemId;
  /** The stage this instance is for (a recipe with multi-stage workflow spans multiple instances). */
  stageId: StageId;
  /** ISO date of the stage (D-1, D0, etc.). */
  date: string;
  /** HH:MM start on that date. */
  startTime: string;
  /** HH:MM end on that date. */
  endTime: string;
  benchId: BenchId;
  plannedQty: number;
  /** Which forecast entry this was derived from (for traceability). */
  forecastRef?: { siteId: SiteId; skuId: SkuId; date: string };
};

export type BatchStatus =
  | 'planned'
  | 'in-progress'
  | 'complete'
  | 'failed'
  | 'reviewed'
  | 'dispatched';

export type ProductionBatch = {
  id: BatchId;
  plannedInstanceId?: string; // undefined = on-demand (unplanned)
  productionItemId: ProductionItemId;
  benchId: BenchId;
  date: string;
  startTime: string;
  endTime: string;
  actualQty: number;
  status: BatchStatus;
  /** When failed, the reason. */
  failureReason?: 'burnt' | 'under-proofed' | 'allergen-cross-contact' | 'equipment' | 'other';
};

export type PCRType = 'batch' | 'on-demand' | 'preparation' | 'repackaging';

export type PCRRecord = {
  id: string;
  batchId: BatchId;
  type: PCRType;
  qualityCheck: boolean | null;
  labelCheck: boolean | null;
  signedBy?: UserId;
  signedAt?: string; // ISO datetime
  notes?: string;
};

export type ProductionPlan = {
  id: string;
  siteId: SiteId;
  /** The plan's anchor date (D0). */
  date: string;
  plannedInstances: PlannedInstance[];
  batches: ProductionBatch[];
  pcrRecords: PCRRecord[];
  /** Manager approval gate. */
  status: 'draft' | 'approved';
};

export const PRET_PLAN: ProductionPlan = {
  id: 'plan-central-thursday',
  siteId: 'hub-central',
  date: DEMO_TODAY,
  status: 'approved',
  plannedInstances: [
    // --- Croissant: D-1 ferment → D0 bake → D0 pack
    {
      id: 'pi-instance-croissant-ferment',
      productionItemId: 'pi-central-croissant',
      stageId: 'ferment',
      date: dayOffset(-1),
      startTime: '22:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 48,
      forecastRef: { siteId: 'hub-central', skuId: 'sku-croissant', date: DEMO_TODAY },
    },
    {
      id: 'pi-instance-croissant-bake-0530',
      productionItemId: 'pi-central-croissant',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '05:30',
      endTime: '05:48',
      benchId: 'bench-central-oven',
      plannedQty: 24,
    },
    {
      id: 'pi-instance-croissant-bake-0600',
      productionItemId: 'pi-central-croissant',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '06:00',
      endTime: '06:18',
      benchId: 'bench-central-oven',
      plannedQty: 24,
    },
    {
      id: 'pi-instance-croissant-pack',
      productionItemId: 'pi-central-croissant',
      stageId: 'pack',
      date: DEMO_TODAY,
      startTime: '06:30',
      endTime: '06:45',
      benchId: 'bench-central-pack',
      plannedQty: 48,
    },

    // --- Pain au chocolat: D-1 ferment → D0 bake
    {
      id: 'pi-instance-pain-ferment',
      productionItemId: 'pi-central-pain',
      stageId: 'ferment',
      date: dayOffset(-1),
      startTime: '22:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 36,
    },
    {
      id: 'pi-instance-pain-bake',
      productionItemId: 'pi-central-pain',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '06:30',
      endTime: '06:48',
      benchId: 'bench-central-oven',
      plannedQty: 36,
    },

    // --- Ciabatta: D-2 ferment → D-1 bake  (demonstrates D-2 depth)
    {
      id: 'pi-instance-ciabatta-ferment',
      productionItemId: 'pi-central-ciabatta',
      stageId: 'ferment',
      date: dayOffset(-2),
      startTime: '20:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 18,
    },
    {
      id: 'pi-instance-ciabatta-bake',
      productionItemId: 'pi-central-ciabatta',
      stageId: 'bake',
      date: dayOffset(-1),
      startTime: '07:00',
      endTime: '07:25',
      benchId: 'bench-central-oven',
      plannedQty: 18,
    },

    // --- Chicken-mayo filling: D0 prep (sub-recipe for club)
    {
      id: 'pi-instance-filling',
      productionItemId: 'pi-central-filling',
      stageId: 'prep',
      date: DEMO_TODAY,
      startTime: '08:30',
      endTime: '09:00',
      benchId: 'bench-central-prep',
      plannedQty: 2,
    },

    // --- Club sandwich: D0 assemble (variable)
    {
      id: 'pi-instance-club',
      productionItemId: 'pi-central-club',
      stageId: 'assemble',
      date: DEMO_TODAY,
      startTime: '09:30',
      endTime: '11:30',
      benchId: 'bench-central-prep',
      plannedQty: 120,
    },

    // --- Cookies: increment cadence, seeded with three planned drops
    {
      id: 'pi-instance-cookie-0800',
      productionItemId: 'pi-central-cookie',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '08:00',
      endTime: '08:12',
      benchId: 'bench-central-oven',
      plannedQty: 8,
    },
    {
      id: 'pi-instance-cookie-0845',
      productionItemId: 'pi-central-cookie',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '08:45',
      endTime: '08:57',
      benchId: 'bench-central-oven',
      plannedQty: 8,
    },
    {
      id: 'pi-instance-cookie-0930',
      productionItemId: 'pi-central-cookie',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '09:30',
      endTime: '09:42',
      benchId: 'bench-central-oven',
      plannedQty: 8,
    },

    // --- Brewed coffee: increment, one seeded drop
    {
      id: 'pi-instance-coffee-0700',
      productionItemId: 'pi-central-coffee',
      stageId: 'brew',
      date: DEMO_TODAY,
      startTime: '07:00',
      endTime: '07:06',
      benchId: 'bench-central-prep',
      plannedQty: 1,
    },

    // ─── Forward planning: tonight's ferment for Friday + Saturday's breads ───
    {
      id: 'pi-instance-croissant-ferment-tonight',
      productionItemId: 'pi-central-croissant',
      stageId: 'ferment',
      date: DEMO_TODAY,
      startTime: '22:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 48,
      forecastRef: { siteId: 'hub-central', skuId: 'sku-croissant', date: dayOffset(1) },
    },
    {
      id: 'pi-instance-croissant-bake-friday',
      productionItemId: 'pi-central-croissant',
      stageId: 'bake',
      date: dayOffset(1),
      startTime: '05:30',
      endTime: '06:18',
      benchId: 'bench-central-oven',
      plannedQty: 48,
    },
    {
      id: 'pi-instance-ciabatta-ferment-today',
      productionItemId: 'pi-central-ciabatta',
      stageId: 'ferment',
      date: DEMO_TODAY,
      startTime: '20:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 24,
      forecastRef: { siteId: 'hub-central', skuId: 'sku-ciabatta', date: dayOffset(1) },
    },
    {
      id: 'pi-instance-ciabatta-bake-friday',
      productionItemId: 'pi-central-ciabatta',
      stageId: 'bake',
      date: dayOffset(1),
      startTime: '07:00',
      endTime: '07:25',
      benchId: 'bench-central-oven',
      plannedQty: 24,
    },
    {
      id: 'pi-instance-club-friday',
      productionItemId: 'pi-central-club',
      stageId: 'assemble',
      date: dayOffset(1),
      startTime: '09:30',
      endTime: '11:30',
      benchId: 'bench-central-prep',
      plannedQty: 130,
    },
    {
      id: 'pi-instance-croissant-ferment-friday',
      productionItemId: 'pi-central-croissant',
      stageId: 'ferment',
      date: dayOffset(1),
      startTime: '22:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 60,
      forecastRef: { siteId: 'hub-central', skuId: 'sku-croissant', date: dayOffset(2) },
    },
    {
      id: 'pi-instance-croissant-bake-saturday',
      productionItemId: 'pi-central-croissant',
      stageId: 'bake',
      date: dayOffset(2),
      startTime: '05:30',
      endTime: '06:30',
      benchId: 'bench-central-oven',
      plannedQty: 60,
    },
  ],

  batches: [
    // Croissant bake 05:30 — done and signed off
    {
      id: 'batch-croissant-0530',
      plannedInstanceId: 'pi-instance-croissant-bake-0530',
      productionItemId: 'pi-central-croissant',
      benchId: 'bench-central-oven',
      date: DEMO_TODAY,
      startTime: '05:32',
      endTime: '05:50',
      actualQty: 24,
      status: 'reviewed',
    },
    // Croissant bake 06:00 — in progress
    {
      id: 'batch-croissant-0600',
      plannedInstanceId: 'pi-instance-croissant-bake-0600',
      productionItemId: 'pi-central-croissant',
      benchId: 'bench-central-oven',
      date: DEMO_TODAY,
      startTime: '06:00',
      endTime: '06:18',
      actualQty: 24,
      status: 'in-progress',
    },
    // Pain au choc bake — FAILED (burnt) → will route through waste
    {
      id: 'batch-pain-0630',
      plannedInstanceId: 'pi-instance-pain-bake',
      productionItemId: 'pi-central-pain',
      benchId: 'bench-central-oven',
      date: DEMO_TODAY,
      startTime: '06:30',
      endTime: '06:51',
      actualQty: 36,
      status: 'failed',
      failureReason: 'burnt',
    },
    // Cookie 08:00 bake — planned (not yet started)
    {
      id: 'batch-cookie-0800',
      plannedInstanceId: 'pi-instance-cookie-0800',
      productionItemId: 'pi-central-cookie',
      benchId: 'bench-central-oven',
      date: DEMO_TODAY,
      startTime: '08:00',
      endTime: '08:12',
      actualQty: 0,
      status: 'planned',
    },
    // Coffee 07:00 — complete, awaiting PCR
    {
      id: 'batch-coffee-0700',
      plannedInstanceId: 'pi-instance-coffee-0700',
      productionItemId: 'pi-central-coffee',
      benchId: 'bench-central-prep',
      date: DEMO_TODAY,
      startTime: '07:00',
      endTime: '07:06',
      actualQty: 1,
      status: 'complete',
    },
    // On-demand batch — customer walked in, no planned instance
    {
      id: 'batch-salad-on-demand-1100',
      productionItemId: 'pi-central-salad',
      benchId: 'bench-central-prep',
      date: DEMO_TODAY,
      startTime: '11:00',
      endTime: '11:04',
      actualQty: 1,
      status: 'reviewed',
    },
  ],

  pcrRecords: [
    {
      id: 'pcr-croissant-0530',
      batchId: 'batch-croissant-0530',
      type: 'batch',
      qualityCheck: true,
      labelCheck: true,
      signedBy: 'user-manager-central',
      signedAt: `${DEMO_TODAY}T05:52:00Z`,
      notes: 'Good colour, even bake.',
    },
    {
      id: 'pcr-pain-0630',
      batchId: 'batch-pain-0630',
      type: 'batch',
      qualityCheck: false,
      labelCheck: null,
      signedBy: 'user-manager-central',
      signedAt: `${DEMO_TODAY}T06:55:00Z`,
      notes: 'Over-baked. Routed to waste log; remake batch queued.',
    },
    {
      id: 'pcr-salad-on-demand',
      batchId: 'batch-salad-on-demand-1100',
      type: 'on-demand',
      qualityCheck: true,
      labelCheck: true,
      signedBy: 'user-staff-central',
      signedAt: `${DEMO_TODAY}T11:06:00Z`,
    },
    {
      id: 'pcr-filling-prep',
      // preparation PCR attaches to prep-stage batch (filling not yet baked into a parent)
      batchId: 'batch-coffee-0700', // placeholder to keep shape valid; in real life links to prep batch
      type: 'preparation',
      qualityCheck: true,
      labelCheck: true,
      signedBy: 'user-staff-central',
      signedAt: `${DEMO_TODAY}T09:05:00Z`,
      notes: 'Filling temp 4°C on completion.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Carry-over — yesterday's unsold adjusts today's plan
// ─────────────────────────────────────────────────────────────────────────────

export type CarryOverEntry = {
  id: string;
  siteId: SiteId;
  skuId: SkuId;
  recipeId: RecipeId;
  /** Units carried from D-1 into D0. */
  carriedUnits: number;
  /** Impact on today's plan (reducing planned qty). */
  planAdjustment: number;
  /** Quinn's proposal → Manager confirms. */
  status: 'draft' | 'confirmed';
  reason: string;
};

export const PRET_CARRY_OVER: CarryOverEntry[] = [
  {
    id: 'co-central-croissant',
    siteId: 'hub-central',
    skuId: 'sku-croissant',
    recipeId: 'prec-croissant',
    carriedUnits: 4,
    planAdjustment: -4,
    status: 'draft',
    reason: '4 croissants unsold yesterday, within 8h shelf. Net plan: 48 → 44.',
  },
  {
    id: 'co-central-pain',
    siteId: 'hub-central',
    skuId: 'sku-pain-au-choc',
    recipeId: 'prec-pain-au-chocolat',
    carriedUnits: 6,
    planAdjustment: -6,
    status: 'draft',
    reason: '6 pain au choc within shelf. Net plan: 36 → 30.',
  },
  {
    id: 'co-central-club',
    siteId: 'hub-central',
    skuId: 'sku-club-sandwich',
    recipeId: 'prec-club-sandwich',
    carriedUnits: 0, // expired — goes to waste not carry-over
    planAdjustment: 0,
    status: 'confirmed',
    reason: '2 sandwiches expired (>8h shelf). Logged to waste, no carry-over.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SPOKE submission — site-spoke-south → hub-central for tomorrow's dispatch
// ─────────────────────────────────────────────────────────────────────────────

export type SpokeSubmissionLine = {
  skuId: SkuId;
  recipeId: RecipeId;
  /** Quinn's proposed quantity. */
  quinnProposedUnits: number;
  /** Spoke manager's confirmed quantity (may differ). */
  confirmedUnits: number | null;
};

export type SpokeSubmission = {
  id: string;
  fromSiteId: SiteId;
  toHubId: SiteId;
  /** Date the spoke is ordering FOR. */
  forDate: string;
  /** Cutoff — must submit before this. */
  cutoffDateTime: string; // ISO datetime
  lines: SpokeSubmissionLine[];
  status: 'draft' | 'submitted' | 'acknowledged' | 'modified-by-hub';
  /** If hub modified, reasons + deltas. */
  hubModifications?: {
    byLine: Record<SkuId, { fromUnits: number; toUnits: number; reason: string }>;
  };
};

/**
 * Spoke submissions destined for the central hub. Two cohorts so both the
 * Today amounts view and the Dispatch matrix have something to show:
 *  - "Today" cohort: Spoke East has an acknowledged order for today, so
 *    the hub's Today amounts already include dispatch on top of counter sales.
 *  - "Tomorrow" cohort: South / East / West are all ordering for tomorrow
 *    in a mix of statuses so the Dispatch tab demo flow stays rich.
 */
export const PRET_SPOKE_SUBMISSIONS: SpokeSubmission[] = [
  {
    id: 'spoke-sub-east-today',
    fromSiteId: 'site-spoke-east',
    toHubId: 'hub-central',
    forDate: DEMO_TODAY,
    cutoffDateTime: `${dayOffset(-1)}T15:00:00Z`,
    status: 'acknowledged',
    lines: [
      { skuId: 'sku-croissant',     recipeId: 'prec-croissant',        quinnProposedUnits: 18, confirmedUnits: 18 },
      { skuId: 'sku-pain-au-choc',  recipeId: 'prec-pain-au-chocolat', quinnProposedUnits: 12, confirmedUnits: 12 },
      { skuId: 'sku-baguette',      recipeId: 'prec-baguette',         quinnProposedUnits: 10, confirmedUnits: 10 },
      { skuId: 'sku-tuna-sandwich', recipeId: 'prec-tuna-sandwich',    quinnProposedUnits: 14, confirmedUnits: 14 },
    ],
  },
  {
    id: 'spoke-sub-south-friday',
    fromSiteId: 'site-spoke-south',
    toHubId: 'hub-central',
    forDate: dayOffset(1),
    cutoffDateTime: `${DEMO_TODAY}T15:00:00Z`,
    status: 'draft',
    lines: [
      { skuId: 'sku-croissant',     recipeId: 'prec-croissant',        quinnProposedUnits: 30, confirmedUnits: null },
      { skuId: 'sku-pain-au-choc',  recipeId: 'prec-pain-au-chocolat', quinnProposedUnits: 20, confirmedUnits: null },
      { skuId: 'sku-club-sandwich', recipeId: 'prec-club-sandwich',    quinnProposedUnits: 40, confirmedUnits: null },
    ],
  },
  {
    id: 'spoke-sub-east-friday',
    fromSiteId: 'site-spoke-east',
    toHubId: 'hub-central',
    forDate: dayOffset(1),
    cutoffDateTime: `${DEMO_TODAY}T15:00:00Z`,
    status: 'submitted',
    lines: [
      { skuId: 'sku-croissant',     recipeId: 'prec-croissant',        quinnProposedUnits: 24, confirmedUnits: 24 },
      { skuId: 'sku-baguette',      recipeId: 'prec-baguette',         quinnProposedUnits: 12, confirmedUnits: 18 },
      { skuId: 'sku-tuna-sandwich', recipeId: 'prec-tuna-sandwich',    quinnProposedUnits: 18, confirmedUnits: 18 },
      { skuId: 'sku-club-sandwich', recipeId: 'prec-club-sandwich',    quinnProposedUnits: 32, confirmedUnits: 28 },
    ],
  },
  {
    id: 'spoke-sub-west-friday',
    fromSiteId: 'site-spoke-west',
    toHubId: 'hub-central',
    forDate: dayOffset(1),
    cutoffDateTime: `${DEMO_TODAY}T15:00:00Z`,
    status: 'acknowledged',
    lines: [
      { skuId: 'sku-pain-au-choc',     recipeId: 'prec-pain-au-chocolat', quinnProposedUnits: 18, confirmedUnits: 18 },
      { skuId: 'sku-almond-croissant', recipeId: 'prec-almond-croissant', quinnProposedUnits: 12, confirmedUnits: 12 },
      { skuId: 'sku-granary',          recipeId: 'prec-granary',          quinnProposedUnits: 8,  confirmedUnits: 8  },
      { skuId: 'sku-egg-mayo-sandwich', recipeId: 'prec-egg-mayo-sandwich', quinnProposedUnits: 22, confirmedUnits: 22 },
      { skuId: 'sku-hummus-wrap',      recipeId: 'prec-hummus-wrap',      quinnProposedUnits: 14, confirmedUnits: 14 },
    ],
  },
];

/**
 * Back-compat alias so existing single-submission consumers keep working
 * unchanged. Points at South's draft for tomorrow — that's the submission
 * the spoke-flow page surfaces as "the active draft to send".
 */
export const PRET_SPOKE_SUBMISSION: SpokeSubmission =
  PRET_SPOKE_SUBMISSIONS.find(s => s.id === 'spoke-sub-south-friday') ?? PRET_SPOKE_SUBMISSIONS[0];

/**
 * All submissions destined for the given hub on the given date (or any
 * date if `forDate` is omitted). Submissions are returned in the order
 * they appear in `PRET_SPOKE_SUBMISSIONS` (typically South / East / West).
 */
export function submissionsForHub(hubId: SiteId, forDate?: string): SpokeSubmission[] {
  return PRET_SPOKE_SUBMISSIONS.filter(s => {
    if (s.toHubId !== hubId) return false;
    if (forDate && s.forDate !== forDate) return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings health — stale / unused / suspect cards
// ─────────────────────────────────────────────────────────────────────────────

export type SettingsHealthStatus = 'stale' | 'unused' | 'suspect';

export type SettingsHealthItem = {
  id: string;
  status: SettingsHealthStatus;
  /** Surface in which this setting lives. */
  surface: 'batch-rules' | 'selection-tags' | 'cutoffs' | 'bench-capabilities' | 'ranges';
  /** Scope — estate, format, or site. */
  scope: { kind: 'estate' | 'format' | 'site'; id: string };
  title: string;
  body: string;
  /** One-tap remediations. */
  remediations: Array<{ id: string; label: string; kind: 'archive' | 'refresh' | 'edit' | 'ask-quinn' }>;
  /** Approximate dollar/unit impact if available. */
  impactSummary?: string;
};

export const PRET_SETTINGS_HEALTH: SettingsHealthItem[] = [
  {
    id: 'sh-1',
    status: 'stale',
    surface: 'batch-rules',
    scope: { kind: 'site', id: 'site-standalone-north' },
    title: 'Cookie batch rules not reviewed in 180 days',
    body: 'Recipe says max 8 but the oven at Islington North takes 12 comfortably. Likely a tuning opportunity.',
    remediations: [
      { id: 'r1', label: 'Refresh to 12', kind: 'refresh' },
      { id: 'r2', label: 'Ask Quinn to propose', kind: 'ask-quinn' },
    ],
    impactSummary: '~50 extra cookies/day if lifted.',
  },
  {
    id: 'sh-2',
    status: 'unused',
    surface: 'selection-tags',
    scope: { kind: 'site', id: 'site-standalone-north' },
    title: 'Selection tag “closing” unused for 45 days',
    body: 'No scheduled runs have been tagged closing at Islington North in the last 45 days. Tag may be redundant here.',
    remediations: [
      { id: 'r1', label: 'Archive tag', kind: 'archive' },
      { id: 'r2', label: 'Edit rules', kind: 'edit' },
    ],
  },
  {
    id: 'sh-3',
    status: 'suspect',
    surface: 'cutoffs',
    scope: { kind: 'site', id: 'site-spoke-south' },
    title: 'Spoke cutoff drifting',
    body: 'Cutoff is 15:00 but 62% of the last 20 submissions landed between 15:05 and 15:45.',
    remediations: [
      { id: 'r1', label: 'Move cutoff to 15:30', kind: 'edit' },
      { id: 'r2', label: 'Ask Quinn', kind: 'ask-quinn' },
    ],
    impactSummary: '12 late acknowledgements/month.',
  },
  {
    id: 'sh-4',
    status: 'unused',
    surface: 'bench-capabilities',
    scope: { kind: 'site', id: 'site-standalone-north' },
    title: 'Proofing capability never used on prep bench',
    body: 'bench-north-prep is tagged proofing but no scheduled stage has used that capability in 90 days.',
    remediations: [
      { id: 'r1', label: 'Remove capability', kind: 'edit' },
    ],
  },
  {
    id: 'sh-5',
    status: 'unused',
    surface: 'ranges',
    scope: { kind: 'estate', id: 'estate-pret' },
    title: 'Range “range-airport-commuter” used by 1 site',
    body: 'Only Heathrow T5 uses this range. Fine if intentional — flagged to confirm.',
    remediations: [
      { id: 'r1', label: 'Leave as-is', kind: 'archive' },
      { id: 'r2', label: 'Edit range', kind: 'edit' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Quinn setup interview — "opening a new site" scenario
// ─────────────────────────────────────────────────────────────────────────────

export type InterviewStepKind = 'single-select' | 'multi-select' | 'confirm-summary' | 'numeric';

export type InterviewStep = {
  id: string;
  kind: InterviewStepKind;
  prompt: string;
  /** For single/multi select. */
  options?: { id: string; label: string; detail?: string }[];
  /** Pre-selected option (Quinn's draft). */
  defaultOptionIds?: string[];
  /** For numeric steps. */
  numericDefault?: number;
  /** Help text shown below the prompt. */
  hint?: string;
};

export type SetupInterviewScenario = {
  id: string;
  title: string;
  subtitle: string;
  steps: InterviewStep[];
  /** Content of the final summary card; populated at runtime from step answers. */
  summaryTemplate: string;
};

export const PRET_QUINN_SETUP_INTERVIEW: SetupInterviewScenario = {
  id: 'setup-opening-new-site',
  title: 'Opening a new site',
  subtitle: 'I’ll ask a few questions and draft the production setup. You can tweak at the end.',
  steps: [
    {
      id: 'q-site-type',
      kind: 'single-select',
      prompt: 'What kind of site is this?',
      options: [
        { id: 'STANDALONE', label: 'Standalone', detail: 'Self-producing, no hub' },
        { id: 'HUB',        label: 'Hub',        detail: 'Produces for other sites' },
        { id: 'SPOKE',      label: 'Spoke',      detail: 'Receives from a hub' },
        { id: 'HYBRID',     label: 'Hybrid',     detail: 'Produces + receives' },
      ],
      defaultOptionIds: ['SPOKE'],
      hint: 'Most new sites in Pret’s estate this year are spokes.',
    },
    {
      id: 'q-format',
      kind: 'single-select',
      prompt: 'Which format is closest?',
      options: [
        { id: 'format-corner',  label: 'Corner shop',        detail: '06:00–22:00, standard run' },
        { id: 'format-airport', label: 'Airport concourse',  detail: '04:30–23:00, longer increment runs' },
      ],
      defaultOptionIds: ['format-corner'],
    },
    {
      id: 'q-hub',
      kind: 'single-select',
      prompt: 'Which hub will supply this site?',
      options: [
        { id: 'hub-central', label: 'London Central', detail: '4 benches, weekday tier' },
      ],
      defaultOptionIds: ['hub-central'],
      hint: 'Only hub in range right now.',
    },
    {
      id: 'q-tier',
      kind: 'single-select',
      prompt: 'Default tier for Mon–Sat?',
      options: [
        { id: 'tier-weekday', label: 'Weekday', detail: 'range-core' },
        { id: 'tier-weekend', label: 'Weekend', detail: 'range-core + range-brunch' },
      ],
      defaultOptionIds: ['tier-weekday'],
    },
    {
      id: 'q-cutoff',
      kind: 'numeric',
      prompt: 'Cutoff time for hub submissions (24h)?',
      numericDefault: 15,
      hint: 'Estate default is 15:00 — the hub will expect submissions before this.',
    },
    {
      id: 'q-summary',
      kind: 'confirm-summary',
      prompt: 'Ready to save?',
    },
  ],
  summaryTemplate:
    'Creating SPOKE site on corner format, supplied by London Central, tier-weekday Mon–Sat, tier-weekend Sun, cutoff 15:00. 1 front counter bench. No production items yet — Quinn will propose the first plan once 14 days of sales land.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Users (Role model)
// ─────────────────────────────────────────────────────────────────────────────

export type User = {
  id: UserId;
  name: string;
  role: Role;
  /** Primary site assignment. */
  siteId?: SiteId;
};

export const PRET_USERS: User[] = [
  { id: 'user-manager-central', name: 'Priya — Manager, London Central', role: 'Manager', siteId: 'hub-central' },
  { id: 'user-staff-central',   name: 'Dev — Staff, London Central',    role: 'Staff',   siteId: 'hub-central' },
  { id: 'user-manager-south',   name: 'Nia — Manager, Clapham Junction', role: 'Manager', siteId: 'site-spoke-south' },
  { id: 'user-manager-north',   name: 'Jules — Manager, Islington North', role: 'Manager', siteId: 'site-standalone-north' },
  { id: 'user-staff-airport',   name: 'Rae — Staff, Heathrow T5',        role: 'Staff',   siteId: 'site-hybrid-airport' },
];

/** Convenience: the "current user" for demo. Defaults to Central's manager. */
export const DEMO_CURRENT_USER_ID: UserId = 'user-manager-central';

// ─────────────────────────────────────────────────────────────────────────────
// Convenience lookups
// ─────────────────────────────────────────────────────────────────────────────

export function getSite(id: SiteId): Site | undefined {
  return PRET_SITES.find(s => s.id === id);
}

export function getBench(id: BenchId): Bench | undefined {
  return PRET_BENCHES.find(b => b.id === id);
}

export function getRecipe(id: RecipeId): ProductionRecipe | undefined {
  return PRET_RECIPES.find(r => r.id === id);
}

export function getProductionItem(id: ProductionItemId): ProductionItem | undefined {
  return PRET_PRODUCTION_ITEMS.find(p => p.id === id);
}

export function getWorkflow(id: WorkflowId): ProductionWorkflow | undefined {
  return PRET_WORKFLOWS[id];
}

export function getUser(id: UserId): User | undefined {
  return PRET_USERS.find(u => u.id === id);
}

export function benchesAt(siteId: SiteId): Bench[] {
  return PRET_BENCHES.filter(b => b.siteId === siteId);
}

export function productionItemsAt(siteId: SiteId): ProductionItem[] {
  return PRET_PRODUCTION_ITEMS.filter(p => p.siteId === siteId);
}

export function tierForSiteOnDate(siteId: SiteId, iso: string): Tier | undefined {
  const dow = dayOfWeek(iso);
  const assignment = PRET_SITE_TIER_ASSIGNMENTS.find(a => a.siteId === siteId);
  if (!assignment) return undefined;
  return PRET_TIERS.find(t => t.id === assignment.byDayOfWeek[dow]);
}

/** Forecast lookup for (site, sku, date). */
/**
 * Day-of-week multiplier applied to today's forecast when projecting future
 * (or past) days. Eyeballed to a Pret-style trade pattern: midweek peak,
 * Sunday softer. Manager-confirmed forecasts in `PRET_FORECAST` always win
 * over this projection.
 */
export const DOW_MULTIPLIER: Record<DayOfWeek, number> = {
  Mon: 0.95,
  Tue: 1.00,
  Wed: 1.05,
  Thu: 1.05,
  Fri: 1.10,
  Sat: 0.85,
  Sun: 0.65,
};

export function forecastFor(
  siteId: SiteId,
  skuId: SkuId,
  date: string,
): DemandForecastEntry | undefined {
  const exact = PRET_FORECAST.find(f => f.siteId === siteId && f.skuId === skuId && f.date === date);
  if (exact) return exact;

  // No hand-authored entry for this date — synthesise one from today's
  // forecast for the same SKU, scaled by the day-of-week multiplier. Returns
  // undefined when there's no anchor for today either (rare; means the SKU
  // simply isn't on plan at this site).
  const anchor = PRET_FORECAST.find(f => f.siteId === siteId && f.skuId === skuId && f.date === DEMO_TODAY);
  if (!anchor) return undefined;

  const multiplier = DOW_MULTIPLIER[dayOfWeek(date)] / DOW_MULTIPLIER[dayOfWeek(DEMO_TODAY)];
  const scale = (n: number) => Math.max(0, Math.round(n * multiplier));
  return {
    siteId,
    skuId,
    date,
    projectedUnits: scale(anchor.projectedUnits),
    byPhase: anchor.byPhase
      ? {
          morning: scale(anchor.byPhase.morning),
          midday: scale(anchor.byPhase.midday),
          afternoon: scale(anchor.byPhase.afternoon),
        }
      : undefined,
    signals: [
      {
        signal: 'sales-history',
        weight: 1,
        note: `Projected from ${dayOfWeek(DEMO_TODAY)} ${DEMO_TODAY} × ${dayOfWeek(date)} factor (${multiplier.toFixed(2)}×)`,
      },
    ],
    status: 'draft',
  };
}

/** Carry-over lookup (most recent entry for site/sku). */
export function carryOverFor(siteId: SiteId, skuId: SkuId): CarryOverEntry | undefined {
  return PRET_CARRY_OVER.find(c => c.siteId === siteId && c.skuId === skuId);
}

/** Pick the primary bench for a production item based on workflow's final stage. */
export function primaryBenchForItem(item: ProductionItem): Bench | undefined {
  const siteBenches = benchesAt(item.siteId);
  // Explicit override wins: used for intentional off-mode work (EOD prep on
  // a run bench) and for routing grill/hot-component work onto a dedicated
  // bench even though its capability is generic 'prep'.
  if (item.preferredBenchId) {
    const pinned = siteBenches.find(b => b.id === item.preferredBenchId);
    if (pinned) return pinned;
  }
  const recipe = getRecipe(item.recipeId);
  if (!recipe) return undefined;
  const wf = getWorkflow(recipe.workflowId);
  if (!wf || wf.stages.length === 0) return undefined;
  const finalStage = wf.stages[wf.stages.length - 1];
  const candidates = siteBenches.filter(b =>
    b.capabilities.includes(finalStage.capability),
  );
  if (candidates.length === 0) return undefined;
  // Prefer a bench whose configured primaryMode matches the item's mode.
  // If none match (e.g. tail prep work landing on a run-mode oven bench),
  // fall back to the first capable bench so the work still renders, and the
  // card will show it in the "After service" tail.
  const modeMatch = candidates.find(b => b.primaryMode === item.mode);
  return modeMatch ?? candidates[0];
}

/** All benches a production item touches across its workflow stages. */
export function benchesForItem(item: ProductionItem): Bench[] {
  const recipe = getRecipe(item.recipeId);
  if (!recipe) return [];
  const wf = getWorkflow(recipe.workflowId);
  if (!wf) return [];
  const siteBenches = benchesAt(item.siteId);
  const seen = new Set<BenchId>();
  const out: Bench[] = [];
  for (const stage of wf.stages) {
    const bench = siteBenches.find(b => b.capabilities.includes(stage.capability));
    if (bench && !seen.has(bench.id)) {
      seen.add(bench.id);
      out.push(bench);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan amounts — derive Quinn's suggested qty per SKU from forecast + carry-over
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-spoke breakdown of how many units this hub owes a single spoke on the
 * planned date. `units` uses the spoke's `confirmedUnits` when set, otherwise
 * Quinn's proposed number — the same "effective" rule the dispatch matrix uses.
 */
export type DispatchDemandLine = {
  spokeId: SiteId;
  spokeName: string;
  units: number;
  /** True when the spoke hasn't confirmed yet — number is still Quinn-proposed. */
  isQuinn: boolean;
  status: SpokeSubmission['status'];
};

export type AmountsLine = {
  item: ProductionItem;
  recipe: ProductionRecipe;
  forecast?: DemandForecastEntry;
  carryOver?: CarryOverEntry;
  /** Quinn-proposed quantity after considering forecast, carry-over and dispatch. */
  quinnProposed: number;
  /**
   * Total units this site needs to dispatch to its spokes on `date` for this
   * SKU. Always 0 for spoke sites (or hubs with no submissions for the date).
   * Already factored into `quinnProposed`.
   */
  dispatchDemand: number;
  /**
   * Per-spoke breakdown when `dispatchDemand > 0`. Same order as
   * `submissionsForHub()` returns submissions (typically South / East / West).
   */
  dispatchBySpoke?: DispatchDemandLine[];
  /** Primary bench (final stage). */
  primaryBench?: Bench;
  /** All benches in workflow order. */
  benches: Bench[];
};

/**
 * Build the ledger of recipes to plan for a given site/date.
 * Returns everything needed to render the Amounts view without further lookups.
 *
 * For HUB sites we additionally fold in spoke dispatch demand for `date`:
 * each SKU's Quinn proposal becomes `max(0, counterSales + dispatch − carry)`,
 * and per-line `dispatchDemand` + `dispatchBySpoke` carry the breakdown so
 * the UI can show "Counter X · Dispatch Y" without re-querying submissions.
 */
export function amountsForSiteOnDate(siteId: SiteId, date: string): AmountsLine[] {
  const items = productionItemsAt(siteId);
  const site = getSite(siteId);
  // Pre-build dispatch demand per SKU for this hub+date so each line is a
  // simple Map lookup rather than a re-scan of all submissions.
  const dispatchBySku = new Map<SkuId, DispatchDemandLine[]>();
  if (site?.type === 'HUB') {
    const subs = submissionsForHub(siteId, date);
    for (const sub of subs) {
      const spoke = getSite(sub.fromSiteId);
      const spokeName = spoke?.name ?? sub.fromSiteId;
      for (const ln of sub.lines) {
        const isQuinn = ln.confirmedUnits === null;
        const units = ln.confirmedUnits ?? ln.quinnProposedUnits;
        if (units <= 0) continue;
        const arr = dispatchBySku.get(ln.skuId) ?? [];
        arr.push({
          spokeId: sub.fromSiteId,
          spokeName,
          units,
          isQuinn,
          status: sub.status,
        });
        dispatchBySku.set(ln.skuId, arr);
      }
    }
  }

  const lines: AmountsLine[] = [];
  for (const item of items) {
    const recipe = getRecipe(item.recipeId);
    if (!recipe) continue;
    const forecast = forecastFor(siteId, item.skuId, date);
    const carryOver = carryOverFor(siteId, item.skuId);
    const counter = forecast?.projectedUnits ?? 0;
    const carried = carryOver ? carryOver.carriedUnits : 0;
    const dispatchLines = dispatchBySku.get(item.skuId);
    const dispatchDemand = dispatchLines
      ? dispatchLines.reduce((a, l) => a + l.units, 0)
      : 0;
    // Quinn proposal: own counter sales + dispatch − carry-over, never < 0.
    const quinnProposed = Math.max(0, counter + dispatchDemand - carried);
    lines.push({
      item,
      recipe,
      forecast,
      carryOver,
      quinnProposed,
      dispatchDemand,
      dispatchBySpoke: dispatchLines,
      primaryBench: primaryBenchForItem(item),
      benches: benchesForItem(item),
    });
  }
  return lines;
}
