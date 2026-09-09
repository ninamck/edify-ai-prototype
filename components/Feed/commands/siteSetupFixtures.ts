/**
 * siteSetupFixtures — data for the "set up new sites" Command Centre
 * wizard (Pret UK rollout demo).
 *
 * Three data sets:
 *   • NEW_SITES — the shops on the spreadsheet the operator attaches
 *     (SITE_SHEET_FILE_NAME). Sites are NOT held in Workday, so the
 *     property/ops team sends a sheet with one row per shop: name,
 *     site code, profit centre, address, opening date, delivery window,
 *     delivery contact. Step 1 parses that sheet and shows every field
 *     filled in and editable. Each entry also carries the staff roster,
 *     which DOES come from Workday (the HR system) once the shop is
 *     matched by name.
 *   • TEMPLATE_SHOPS — live Pret shops a new site can copy its setup
 *     from: range, tier-per-day pattern, production week, selection
 *     times, permissions.
 *   • RANGES — the range/tier ladders. Tiers are modelled as ordered
 *     supersets (a "floor"): each tier's recipe count is cumulative,
 *     tier N contains everything in tier N−1 plus more. Picking a tier
 *     for a day gives the shop that whole menu — recipes are never
 *     assigned to a site by hand. This is the target model from the
 *     Site Setup at Scale PRD (4.6), not the folder-per-tier model in
 *     the current production codebase.
 *
 * Pure data + tiny lookups. No React.
 */

// ─── Days ────────────────────────────────────────────────────────────────────

export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const DAY_KEYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Roles ───────────────────────────────────────────────────────────────────

/** Job title as it appears in Workday. */
export type WorkdayRole =
  | 'General Manager'
  | 'Assistant Manager'
  | 'Area Manager'
  | 'Team Leader'
  | 'Team Member'
  | 'Barista';

/** Edify role, matching Edify main's user roles: Employee, Manager,
 *  Admin. Managers carry the standard shop permission set on top
 *  (suppliers, products, recipes, checklists, dashboards, deliveries,
 *  stocktakes, production settings). */
export type EdifyRole = 'Admin' | 'Manager' | 'Employee';

export const EDIFY_ROLES: EdifyRole[] = ['Employee', 'Manager', 'Admin'];

/** Default Workday job → Edify role mapping. Managers of any flavour
 *  land on Manager; everyone else is an Employee. */
export function defaultEdifyRole(workdayRole: WorkdayRole): EdifyRole {
  if (
    workdayRole === 'General Manager' ||
    workdayRole === 'Assistant Manager' ||
    workdayRole === 'Area Manager'
  ) {
    return 'Manager';
  }
  return 'Employee';
}

export interface WorkdayPerson {
  id: string;
  name: string;
  workdayRole: WorkdayRole;
}

// ─── Ranges & tier ladders ──────────────────────────────────────────────────

export interface RangeLadder {
  id: string;
  name: string;
  /** Cumulative recipe count per tier, index 0 = tier 1. Tier N is a
   *  superset of tier N−1, so counts only ever grow. */
  tierRecipes: number[];
}

export const RANGES: RangeLadder[] = [
  { id: 'regional',      name: 'Regional',      tierRecipes: [96, 148, 185, 212, 236, 251] },
  { id: 'london-worker', name: 'London Worker', tierRecipes: [104, 162, 199, 228, 249, 262] },
  { id: 'transport-hub', name: 'Transport Hub', tierRecipes: [88, 132, 171, 198, 221, 240] },
];

export function getRange(id: string): RangeLadder | undefined {
  return RANGES.find((r) => r.id === id);
}

/** Recipe count for a tier (1-based) in a range. */
export function recipesAtTier(rangeId: string, tier: number): number {
  const range = getRange(rangeId);
  if (!range) return 0;
  return range.tierRecipes[Math.min(Math.max(tier, 1), range.tierRecipes.length) - 1] ?? 0;
}

/**
 * Compress a 7-day tier pattern into human-readable runs:
 * { Mon:4,…,Thu:4, Fri:2, Sat:2, Sun:2 } → "Tier 4 Mon–Thu · Tier 2 Fri–Sun".
 */
export function describeTierPattern(tiers: Record<DayKey, number>): string {
  const runs: { from: DayKey; to: DayKey; tier: number }[] = [];
  for (const day of DAY_KEYS) {
    const tier = tiers[day];
    const last = runs[runs.length - 1];
    if (last && last.tier === tier) last.to = day;
    else runs.push({ from: day, to: day, tier });
  }
  return runs
    .map((r) => `Tier ${r.tier} ${r.from === r.to ? r.from : `${r.from}–${r.to}`}`)
    .join(' · ');
}

/** Same run-compression, but rendering recipe counts:
 *  "212 recipes Mon–Thu · 148 Fri–Sun". */
export function describeRecipeCounts(rangeId: string, tiers: Record<DayKey, number>): string {
  const runs: { from: DayKey; to: DayKey; tier: number }[] = [];
  for (const day of DAY_KEYS) {
    const tier = tiers[day];
    const last = runs[runs.length - 1];
    if (last && last.tier === tier) last.to = day;
    else runs.push({ from: day, to: day, tier });
  }
  return runs
    .map((r, i) => {
      const count = recipesAtTier(rangeId, r.tier);
      const days = r.from === r.to ? r.from : `${r.from}–${r.to}`;
      return `${count}${i === 0 ? ' recipes' : ''} ${days}`;
    })
    .join(' · ');
}

// ─── Hubs (CPUs) and site types ─────────────────────────────────────────────

export interface Hub {
  id: string;
  name: string;
}

export const HUBS: Hub[] = [
  { id: 'park-royal',   name: 'Park Royal CPU' },
  { id: 'northern-cpu', name: 'Northern CPU · Leeds' },
  { id: 'midlands-cpu', name: 'Midlands CPU · Birmingham' },
];

export function getHub(id: string): Hub | undefined {
  return HUBS.find((h) => h.id === id);
}

/**
 * Hub linking, mirroring Edify main's Settings → Production →
 * Hub & spoke: one kitchen produces for several shops. A shop is
 * either linked to a hub (it plans daily quantities, the hub makes the
 * combined total and transfers the finished items back) or standalone
 * (everything made in the shop). Pret shops don't order products
 * through Edify — the hub relationship is about where food is made.
 *
 * In the hubs record a site maps to a hub id or to STANDALONE.
 */
export const STANDALONE = 'standalone';

/** Plain-language line under the hub pick. */
export function describeHubLink(hubName: string | undefined): string {
  if (!hubName) return 'No hub. Everything is made in the shop.';
  return `The shop plans its daily quantities; ${hubName} makes the combined total and transfers it back. Cutoffs come with the copy.`;
}

/** Short read-back form: "linked to Northern CPU · Leeds", "standalone". */
export function hubLinkSummary(hubName: string | undefined): string {
  return hubName ? `linked to ${hubName}` : 'standalone';
}

// ─── Template shops (copy sources) ──────────────────────────────────────────

export interface TimeWindow {
  start: string;
  end: string;
}

/** One production run in the copied shop's schedule, mirroring Edify
 *  main's Production settings: a bench window (when the run is made)
 *  and a sales-forecast window (the sales period used to predict
 *  quantities), plus the per-category refinements of that forecast
 *  window. All copied with the shop. */
export interface ProductionRun {
  name: string;
  bench: TimeWindow;
  forecast: TimeWindow;
  categories: Record<string, TimeWindow>;
}

/** Per site → per day → that day's runs. */
export type SiteProductionSchedules = Record<string, Record<DayKey, ProductionRun[]>>;

const toMins = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (mins: number): string =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** Category refinements of a run's forecast window, as a copied shop
 *  would have tuned them: bakery sells early, hot food later. */
function deriveCategoryWindows(forecast: TimeWindow): Record<string, TimeWindow> {
  const s = toMins(forecast.start);
  const e = toMins(forecast.end);
  return {
    'Croissants & bakery': { start: forecast.start, end: toTime(Math.min(s + 180, e)) },
    'Sandwiches & baguettes': { ...forecast },
    'Hot food': { start: toTime(Math.min(s + 60, e)), end: forecast.end },
    'Salads & bowls': { ...forecast },
  };
}

// ─── Benches & hot production ────────────────────────────────────────────────
//
// Mirrors the Benches and Hot production tabs on the Production
// settings page: bench count, production stations (hot-food recipes
// made together on a timed batch cycle), full-selection times (at a
// set time, top up the forecast with a fixed extra quantity of chosen
// recipes), the default planner window, Product Control Review, and
// the carry-over adjustment setting. All copied with the shop.

export interface HotStation {
  name: string;
  /** Batch cycle: how often a new batch starts. */
  slotMins: number;
  /** Recipes assigned to the station's batch cycle. */
  recipes: string[];
  /** Min / max batch size and rounding multiple. 0 = none. */
  min: number;
  max: number;
  multiple: number;
}

export interface FullSelectionRow {
  time: string;
  recipes: string[];
  qty: number;
}

export interface BenchesHotSetup {
  stations: HotStation[];
  fullSelectionTimes: FullSelectionRow[];
  plannerWindow: TimeWindow;
  productControlReview: boolean;
  /** Include bench-assigned productions in carry-over adjustments. */
  carryOverBenchAssigned: boolean;
}

export type SiteBenchesHot = Record<string, BenchesHotSetup>;

/** Hot recipes a station can be assigned, for the add-recipe search. */
export const HOT_RECIPE_POOL = {
  bakery: [
    'All Butter Croissant',
    'Pain au Chocolat',
    'Almond Croissant',
    'Ham & Cheese Croissant',
    'Mozz & Tomato Croissant',
    'Pain aux Raisins',
    'Cinnamon Danish',
    'Chocolate Chunk Cookie',
    'Berry Muffin',
    'Cheese Twist',
    'Sausage Roll',
    'Vegan Sausage Roll',
  ],
  hotChef: [
    'Hot Wrap Swedish Meatball',
    'Hot Wrap Chipotle Chicken',
    'Falafel Hot Wrap',
    'Mac & Cheese',
    'Mac & Cheese Prosciutto',
    'Soup Chicken Laksa',
    'Tomato Soup',
    'Chicken Miso Soup',
    'Leek & Potato Soup',
    'Cheese Toastie',
    'Ham & Cheese Toastie',
    'Tuna Melt Toastie',
    'Chorizo Toastie',
    'Bacon Roll',
    'Sausage Bap',
    'Meatball Baguette',
    'Chicken Katsu Pot',
    'Veggie Chilli Pot',
  ],
};

export const ALL_HOT_RECIPES = [...HOT_RECIPE_POOL.bakery, ...HOT_RECIPE_POOL.hotChef];

const station = (name: string, slotMins: number, recipes: string[], min = 0, max = 0, multiple = 0): HotStation => ({
  name,
  slotMins,
  recipes,
  min,
  max,
  multiple,
});

/** Hot production for a new site, deep-copied from its copied shop so
 *  edits don't leak between sites. */
export function defaultBenchesHot(templateId: string): BenchesHotSetup {
  const src = getTemplateShop(templateId)?.benchesHot;
  if (!src) {
    return {
      stations: [],
      fullSelectionTimes: [],
      plannerWindow: { start: '05:00', end: '18:00' },
      productControlReview: true,
      carryOverBenchAssigned: true,
    };
  }
  return {
    stations: src.stations.map((s) => ({ ...s, recipes: [...s.recipes] })),
    fullSelectionTimes: src.fullSelectionTimes.map((r) => ({ ...r, recipes: [...r.recipes] })),
    plannerWindow: { ...src.plannerWindow },
    productControlReview: src.productControlReview,
    carryOverBenchAssigned: src.carryOverBenchAssigned,
  };
}

export interface TemplateShop {
  id: string;
  name: string;
  /** Short human descriptor shown under the pick ("High street · full range"). */
  descriptor: string;
  rangeId: string;
  hubId: string;
  tierByDay: Record<DayKey, number>;
  /** The production runs the copy brings, per day. */
  productionRuns: ProductionRun[];
  /** Benches the runs are assigned across. */
  benches: number;
  /** Hot production settings the copy brings. */
  benchesHot: BenchesHotSetup;
}

/** Per-day run schedules for a new site, seeded from its copied shop.
 *  Deep-copied per day so edits to one day (or one site) don't leak. */
export function defaultRunSchedules(templateId: string): Record<DayKey, ProductionRun[]> {
  const runs = getTemplateShop(templateId)?.productionRuns ?? [];
  const copy = (): ProductionRun[] => runs.map((r) => ({
    name: r.name,
    bench: { ...r.bench },
    forecast: { ...r.forecast },
    categories: Object.fromEntries(
      Object.entries(r.categories).map(([cat, w]) => [cat, { ...w }]),
    ),
  }));
  return Object.fromEntries(DAY_KEYS.map((d) => [d, copy()])) as Record<DayKey, ProductionRun[]>;
}

const tiers7 = (mon: number, tue: number, wed: number, thu: number, fri: number, sat: number, sun: number): Record<DayKey, number> => ({
  Mon: mon, Tue: tue, Wed: wed, Thu: thu, Fri: fri, Sat: sat, Sun: sun,
});

const run = (name: string, benchStart: string, benchEnd: string, fcStart: string, fcEnd: string): ProductionRun => ({
  name,
  bench: { start: benchStart, end: benchEnd },
  forecast: { start: fcStart, end: fcEnd },
  categories: deriveCategoryWindows({ start: fcStart, end: fcEnd }),
});

export const TEMPLATE_SHOPS: TemplateShop[] = [
  {
    id: 'villiers',
    name: 'Villiers Street',
    descriptor: 'London high street · full range weekdays',
    rangeId: 'london-worker',
    hubId: 'park-royal',
    tierByDay: tiers7(4, 4, 4, 4, 2, 2, 2),
    productionRuns: [
      run('Production 1', '05:00', '07:00', '06:00', '11:00'),
      run('Production 2', '10:30', '12:00', '11:00', '15:00'),
    ],
    benches: 3,
    benchesHot: {
      stations: [
        station('Bakery', 60, HOT_RECIPE_POOL.bakery.slice(0, 10), 2, 12),
        station('Hot Chef', 30, HOT_RECIPE_POOL.hotChef.slice(0, 14), 1, 6),
      ],
      fullSelectionTimes: [
        { time: '05:00', recipes: ['All Butter Croissant', 'Pain au Chocolat'], qty: 2 },
        { time: '07:30', recipes: ['Sausage Roll'], qty: 1 },
      ],
      plannerWindow: { start: '05:00', end: '18:00' },
      productControlReview: true,
      carryOverBenchAssigned: true,
    },
  },
  {
    id: 'crown-passage',
    name: 'Crown Passage',
    descriptor: 'Small London shop · core range',
    rangeId: 'london-worker',
    hubId: 'park-royal',
    tierByDay: tiers7(2, 2, 2, 2, 2, 2, 2),
    productionRuns: [
      run('Production 1', '06:00', '07:30', '07:00', '14:00'),
    ],
    benches: 2,
    benchesHot: {
      stations: [
        station('Bakery', 60, HOT_RECIPE_POOL.bakery.slice(0, 8), 1, 8),
        station('Hot Chef', 30, HOT_RECIPE_POOL.hotChef.slice(0, 10), 1, 4),
      ],
      fullSelectionTimes: [
        { time: '06:30', recipes: ['All Butter Croissant'], qty: 1 },
      ],
      plannerWindow: { start: '06:00', end: '16:00' },
      productControlReview: false,
      carryOverBenchAssigned: true,
    },
  },
  {
    id: 'cheapside',
    name: 'Cheapside',
    descriptor: 'City shop · widest weekday range',
    rangeId: 'london-worker',
    hubId: 'park-royal',
    tierByDay: tiers7(5, 5, 5, 5, 5, 3, 3),
    productionRuns: [
      run('Production 1', '05:00', '07:00', '06:00', '11:00'),
      run('Production 2', '10:00', '11:30', '11:00', '14:30'),
      run('Production 3', '14:00', '15:00', '14:30', '18:00'),
    ],
    benches: 4,
    benchesHot: {
      stations: [
        station('Bakery', 60, HOT_RECIPE_POOL.bakery, 2, 12, 2),
        station('Hot Chef', 30, HOT_RECIPE_POOL.hotChef.slice(0, 16), 2, 8),
      ],
      fullSelectionTimes: [
        { time: '05:00', recipes: ['All Butter Croissant', 'Pain au Chocolat', 'Almond Croissant'], qty: 2 },
        { time: '11:30', recipes: ['Mac & Cheese'], qty: 2 },
      ],
      plannerWindow: { start: '05:00', end: '18:00' },
      productControlReview: true,
      carryOverBenchAssigned: true,
    },
  },
  {
    id: 'manchester-market-st',
    name: 'Manchester Market Street',
    descriptor: 'Regional high street',
    rangeId: 'regional',
    hubId: 'northern-cpu',
    tierByDay: tiers7(4, 4, 4, 4, 4, 4, 3),
    productionRuns: [
      run('Production 1', '05:30', '07:30', '06:30', '12:00'),
      run('Production 2', '11:00', '12:30', '12:00', '16:00'),
    ],
    benches: 3,
    benchesHot: {
      stations: [
        station('Bakery', 60, HOT_RECIPE_POOL.bakery.slice(0, 9), 2, 10),
        station('Hot Chef', 30, HOT_RECIPE_POOL.hotChef.slice(0, 12), 1, 6),
      ],
      fullSelectionTimes: [
        { time: '06:00', recipes: ['All Butter Croissant', 'Bacon Roll'], qty: 2 },
      ],
      plannerWindow: { start: '05:30', end: '17:00' },
      productControlReview: true,
      carryOverBenchAssigned: false,
    },
  },
  {
    id: 'st-pancras',
    name: 'St Pancras',
    descriptor: 'Station shop · steady seven-day trade',
    rangeId: 'transport-hub',
    hubId: 'park-royal',
    tierByDay: tiers7(3, 3, 3, 3, 3, 3, 3),
    productionRuns: [
      run('Production 1', '04:30', '06:30', '05:30', '10:30'),
      run('Production 2', '10:00', '11:30', '10:30', '15:00'),
      run('Production 3', '15:00', '16:00', '15:00', '20:00'),
    ],
    benches: 4,
    benchesHot: {
      stations: [
        station('Bakery', 45, HOT_RECIPE_POOL.bakery.slice(0, 11), 2, 12, 2),
        station('Hot Chef', 30, HOT_RECIPE_POOL.hotChef, 2, 10),
      ],
      fullSelectionTimes: [
        { time: '04:30', recipes: ['All Butter Croissant', 'Pain au Chocolat'], qty: 3 },
        { time: '16:00', recipes: ['Cheese Toastie'], qty: 2 },
      ],
      plannerWindow: { start: '04:30', end: '20:00' },
      productControlReview: true,
      carryOverBenchAssigned: true,
    },
  },
];

export function getTemplateShop(id: string): TemplateShop | undefined {
  return TEMPLATE_SHOPS.find((t) => t.id === id);
}

// ─── Shop recipes (copied with the shop) ─────────────────────────────────────
//
// The production recipes a shop makes on site: what lands on the bench
// and the hot stations, plus barista drinks. Distinct from the range /
// tier ladder above, which sets which menu sells on which day. In Edify
// main recipes are held per site, so a new shop copies its mirror
// shop's library (~95 recipes) and the operator unticks anything the
// new shop won't make. All copied unless unticked.

export type RecipeCategory =
  | 'Croissants & bakery'
  | 'Breakfast'
  | 'Sandwiches & baguettes'
  | 'Wraps & flatbreads'
  | 'Hot food & soups'
  | 'Salads & bowls'
  | 'Sweet treats'
  | 'Coffee & drinks';

export const RECIPE_CATEGORIES: RecipeCategory[] = [
  'Croissants & bakery',
  'Breakfast',
  'Sandwiches & baguettes',
  'Wraps & flatbreads',
  'Hot food & soups',
  'Salads & bowls',
  'Sweet treats',
  'Coffee & drinks',
];

export interface ShopRecipe {
  id: string;
  name: string;
  category: RecipeCategory;
  /** Only these template shops carry it (city / station extras). */
  only?: string[];
  /** These template shops don't carry it (small-shop core range). */
  not?: string[];
}

const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function recipes(category: RecipeCategory, names: string[], flags?: { only?: string[]; not?: string[] }): ShopRecipe[] {
  return names.map((name) => ({ id: slug(name), name, category, ...(flags ?? {}) }));
}

const SMALL = ['crown-passage'];
const CITY = ['cheapside'];
const STATION = ['st-pancras'];

/** Every recipe any copied shop holds. `templateRecipes` narrows it. */
export const RECIPE_LIBRARY: ShopRecipe[] = [
  ...recipes('Croissants & bakery', HOT_RECIPE_POOL.bakery),
  ...recipes('Breakfast', [
    'Porridge',
    'Bircher Muesli',
    'Greek Yoghurt & Granola Pot',
    'Egg Mayo Breakfast Baguette',
    'Avocado & Egg Brioche',
    'Bacon & Egg Brioche',
    'Fruit Salad Pot',
    'Berry & Yoghurt Pot',
  ]),
  ...recipes('Sandwiches & baguettes', [
    'Chicken Caesar & Bacon Baguette',
    'Tuna Mayo & Cucumber Baguette',
    'Egg Mayo & Tomato Baguette',
    'Ham & Greve Baguette',
    'Brie, Tomato & Basil Baguette',
    'Chicken & Avocado Sandwich',
    'Classic Super Club',
    'Posh Cheddar & Pickle Sandwich',
    'Egg & Spinach Protein Pot Sandwich',
    'Smoked Salmon & Egg Sandwich',
    'Coronation Chicken Sandwich',
    'Italian Prosciutto Baguette',
    'Falafel & Red Pepper Tapenade Baguette',
    'Roast Chicken & Slaw Sandwich',
    'Chargrilled Chicken & Pesto Baguette',
    'Hummus & Chipotle Veggie Sandwich',
  ]),
  ...recipes('Sandwiches & baguettes', ['Steak & Horseradish Baguette', 'Lobster & Prawn Brioche'], { only: CITY }),
  ...recipes('Sandwiches & baguettes', ['Ham & Cheese Croissant Roll', 'Grab & Go Chicken Wrap Box'], { only: STATION }),
  ...recipes('Wraps & flatbreads', [
    'Chicken Caesar Wrap',
    'Falafel & Halloumi Wrap',
    'Tuna Nicoise Wrap',
    'Hoisin Duck Wrap',
    'Chipotle Chicken Flatbread',
    'Halloumi & Red Pepper Flatbread',
    'Veggie Rainbow Wrap',
    'Egg & Avocado Wrap',
  ]),
  ...recipes('Hot food & soups', HOT_RECIPE_POOL.hotChef),
  ...recipes('Salads & bowls', [
    'Chicken Caesar Salad',
    'Tuna Nicoise Salad',
    'Falafel & Hummus Salad Bowl',
    'Chef\u2019s Italian Chicken Salad',
    'Greek Salad',
    'Rainbow Veggie Bowl',
    'Chicken & Quinoa Protein Bowl',
    'Smoked Salmon Salad Bowl',
  ]),
  ...recipes('Salads & bowls', ['Miso Salmon Rice Bowl', 'Superfood Green Bowl'], { not: SMALL }),
  ...recipes('Sweet treats', [
    'Love Bar',
    'Chocolate Brownie',
    'Lemon Drizzle Slice',
    'Carrot Cake Slice',
    'Flapjack',
    'Millionaire Shortbread',
    'Raspberry & Almond Slice',
    'Banana Bread',
    'Popcorn Bar',
    'Fruit Scone',
  ]),
  ...recipes('Coffee & drinks', [
    'Espresso',
    'Americano',
    'Flat White',
    'Latte',
    'Cappuccino',
    'Mocha',
    'Hot Chocolate',
    'Chai Latte',
    'English Breakfast Tea',
    'Fresh Mint Tea',
    'Iced Latte',
  ]),
  ...recipes('Coffee & drinks', ['Matcha Latte', 'Iced Matcha', 'Cold Brew'], { not: SMALL }),
];

/** The recipes a copied shop actually holds, in category order. */
export function templateRecipes(templateId: string): ShopRecipe[] {
  return RECIPE_LIBRARY.filter(
    (r) => (!r.only || r.only.includes(templateId)) && (!r.not || !r.not.includes(templateId)),
  );
}

export function getRecipe(id: string): ShopRecipe | undefined {
  return RECIPE_LIBRARY.find((r) => r.id === id);
}

/** Per site → recipe ids the operator unticked. Empty = copy them all. */
export type RecipeExclusions = Record<string, string[]>;

/** "93 of 95 recipes" for one site. */
export function describeRecipeCopy(templateId: string, excluded: string[] | undefined): string {
  const total = templateRecipes(templateId).length;
  const kept = total - (excluded?.length ?? 0);
  return kept === total ? `all ${total} recipes` : `${kept} of ${total} recipes`;
}

// ─── New sites from the operator's spreadsheet ──────────────────────────────

/** The file the operator attaches. Used for the echo chip and the
 *  card's provenance line when no real file was paperclipped. */
export const SITE_SHEET_FILE_NAME = 'new-sites-september.xlsx';

export interface DeliveryContact {
  name: string;
  position: string;
  phone: string;
}

/**
 * The fields on Edify main's Create site form (Settings → Sites), in
 * the same order. Everything here is editable in step 1. Per-site
 * values come off the sheet; the batch-wide settings a sheet wouldn't
 * carry live in `SharedSiteSettings`.
 */
export interface SiteDetails {
  name: string;
  /** Central Production Unit. The sheet's "Type" column: Shop or CPU. */
  isCpu: boolean;
  siteIdentifier: string;
  profitCentre: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  /** Display-ready ("22 September"). Seeds the go-live date. */
  openingDate: string;
  /** Per day: a window, or null when the shop takes no deliveries. */
  deliveryWindows: Record<DayKey, TimeWindow | null>;
  deliveryContact: DeliveryContact;
  deliveryNotes: string;
  /** PO attachment copies go here. */
  forwardEmails: string[];
}

/** Fields the Create site form marks required. Continue stays off
 *  until every ticked site has them. */
export const REQUIRED_SITE_FIELDS: { key: keyof SiteDetails; label: string }[] = [
  { key: 'name', label: 'Site name' },
  { key: 'addressLine1', label: 'Address line 1' },
  { key: 'city', label: 'City' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'country', label: 'Country' },
];

export function missingRequired(details: SiteDetails): string[] {
  return REQUIRED_SITE_FIELDS
    .filter(({ key }) => String(details[key] ?? '').trim() === '')
    .map(({ label }) => label);
}

/** Non-required fields the sheet left blank: worth a glance, not a
 *  blocker. */
export function sheetGaps(details: SiteDetails): string[] {
  const gaps: string[] = [];
  if (!details.deliveryContact.name.trim()) gaps.push('Delivery contact');
  if (details.deliveryContact.name.trim() && !details.deliveryContact.phone.trim()) gaps.push('Contact phone');
  if (details.forwardEmails.length === 0) gaps.push('Forward email');
  return gaps;
}

/**
 * Settings the Create site form asks for that no property sheet
 * carries. Assumed once for the whole batch, shown with a one-line
 * why, editable before continue.
 */
export interface SharedSiteSettings {
  timezone: string;
  deliveriesRequireReference: boolean;
  showTheoreticalOnHand: boolean;
  forceTraceabilityTags: boolean;
}

export const DEFAULT_SHARED_SITE_SETTINGS: SharedSiteSettings = {
  timezone: 'Europe/London',
  deliveriesRequireReference: false,
  showTheoreticalOnHand: false,
  forceTraceabilityTags: false,
};

/** "Mon–Sat 05:30–08:00 · Sun none". Same run-compression as tiers. */
export function describeDeliveryWindows(windows: Record<DayKey, TimeWindow | null>): string {
  const key = (w: TimeWindow | null) => (w ? `${w.start}–${w.end}` : 'none');
  const runs: { from: DayKey; to: DayKey; text: string }[] = [];
  for (const day of DAY_KEYS) {
    const text = key(windows[day]);
    const last = runs[runs.length - 1];
    if (last && last.text === text) last.to = day;
    else runs.push({ from: day, to: day, text });
  }
  return runs
    .map((r) => `${r.from === r.to ? r.from : `${r.from}–${r.to}`} ${r.text}`)
    .join(' · ');
}

/** Weekday / Saturday / Sunday delivery windows → the 7-day record.
 *  null = no deliveries that day. */
function deliveries(
  weekday: TimeWindow | null,
  saturday: TimeWindow | null,
  sunday: TimeWindow | null,
): Record<DayKey, TimeWindow | null> {
  const copy = (w: TimeWindow | null) => (w ? { ...w } : null);
  return {
    Mon: copy(weekday), Tue: copy(weekday), Wed: copy(weekday), Thu: copy(weekday), Fri: copy(weekday),
    Sat: copy(saturday), Sun: copy(sunday),
  };
}

export interface NewSite {
  id: string;
  /** Full name as it appears on the sheet (and in Workday, so the
   *  roster matches). */
  name: string;
  /** Short name for card copy ("Leeds Trinity"). */
  shortName: string;
  location: string;
  /** Planned opening, display-ready ("22 September"). */
  openingDate: string;
  /** Opening hours from the sheet — drives full selection defaults. */
  open: { weekday: string; saturday: string; sunday: string };
  /** Edify's suggested copy source + why. */
  suggestedTemplateId: string;
  suggestedReason: string;
  suggestedHubId: string;
  /** The rest of the sheet row: what the Create site form needs. */
  sheet: Omit<SiteDetails, 'name' | 'openingDate'>;
  /** Staff, from Workday, matched to the shop by name. */
  roster: WorkdayPerson[];
}

/** The editable Create-site record for a sheet row. Deep-copied so
 *  edits in one card never leak into the fixture. */
export function sheetDetailsFor(site: NewSite): SiteDetails {
  return {
    name: site.name,
    openingDate: site.openingDate,
    ...site.sheet,
    deliveryWindows: Object.fromEntries(
      DAY_KEYS.map((d) => [d, site.sheet.deliveryWindows[d] ? { ...site.sheet.deliveryWindows[d]! } : null]),
    ) as Record<DayKey, TimeWindow | null>,
    deliveryContact: { ...site.sheet.deliveryContact },
    forwardEmails: [...site.sheet.forwardEmails],
  };
}

/** Address on one line for registers and read-backs. */
export function oneLineAddress(d: SiteDetails): string {
  return [d.addressLine1, d.addressLine2, `${d.city} ${d.postcode}`.trim()]
    .filter((s) => s && s.trim())
    .join(', ');
}

/** Compact sheet-row builder. */
function sheetRow(input: {
  code: string;
  profitCentre: string;
  address1: string;
  address2?: string;
  city: string;
  postcode: string;
  deliveries: Record<DayKey, TimeWindow | null>;
  contact: DeliveryContact;
  notes?: string;
  emails?: string[];
}): NewSite['sheet'] {
  return {
    isCpu: false,
    siteIdentifier: input.code,
    profitCentre: input.profitCentre,
    addressLine1: input.address1,
    addressLine2: input.address2 ?? '',
    city: input.city,
    postcode: input.postcode,
    country: 'United Kingdom',
    deliveryWindows: input.deliveries,
    deliveryContact: input.contact,
    deliveryNotes: input.notes ?? '',
    forwardEmails: input.emails ?? [],
  };
}

/** Compact roster builder — tuples of [name, workdayRole]. */
function roster(siteId: string, people: [string, WorkdayRole][]): WorkdayPerson[] {
  return people.map(([name, workdayRole], i) => ({
    id: `${siteId}-p${i + 1}`,
    name,
    workdayRole,
  }));
}

export const NEW_SITES: NewSite[] = [
  {
    id: 'leeds-trinity',
    name: 'Pret Leeds Trinity',
    shortName: 'Leeds Trinity',
    location: 'Trinity Leeds, Albion Street, Leeds LS1',
    openingDate: '22 September',
    open: { weekday: '06:30', saturday: '07:00', sunday: '08:00' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street, similar footprint',
    suggestedHubId: 'northern-cpu',
    sheet: sheetRow({
      code: '4127',
      profitCentre: '4127-LEEDS-TRI',
      address1: 'Unit 24, Trinity Leeds',
      address2: 'Albion Street',
      city: 'Leeds',
      postcode: 'LS1 5AT',
      deliveries: deliveries({ start: '05:30', end: '08:00' }, { start: '06:00', end: '08:30' }, null),
      contact: { name: 'Hannah Osei', position: 'General Manager', phone: '07700 900412' },
      notes: 'Service yard off Boar Lane. Ring the bell at the roller door.',
      emails: ['leeds.trinity@pret.co.uk'],
    }),
    roster: roster('leeds-trinity', [
      ['Hannah Osei', 'General Manager'],
      ['Marcus Webb', 'Assistant Manager'],
      ['Priya Sharma', 'Area Manager'],
      ['Tom Riley', 'Team Leader'],
      ['Aisha Bello', 'Team Member'],
      ['Jakub Nowak', 'Team Member'],
      ['Sofia Marino', 'Barista'],
      ['Daniel Craven', 'Team Member'],
      ['Leah Whitfield', 'Team Member'],
      ['Omar Haddad', 'Team Member'],
      ['Grace Lindley', 'Barista'],
      ['Callum Doyle', 'Team Member'],
      ['Nadia Ferreira', 'Team Member'],
      ['Ben Ashworth', 'Team Member'],
    ]),
  },
  {
    id: 'manchester-piccadilly',
    name: 'Pret Manchester Piccadilly',
    shortName: 'Manchester Piccadilly',
    location: 'Piccadilly Station Approach, Manchester M1',
    openingDate: '22 September',
    open: { weekday: '05:30', saturday: '06:00', sunday: '07:00' },
    suggestedTemplateId: 'st-pancras',
    suggestedReason: 'Station shop, long trading hours',
    suggestedHubId: 'northern-cpu',
    sheet: sheetRow({
      code: '4128',
      profitCentre: '4128-MCR-PICC',
      address1: 'Unit 3, Piccadilly Station Approach',
      city: 'Manchester',
      postcode: 'M1 2PB',
      deliveries: deliveries({ start: '04:30', end: '07:00' }, { start: '05:00', end: '07:30' }, { start: '05:00', end: '07:30' }),
      contact: { name: 'Ryan Fletcher', position: 'General Manager', phone: '07700 900338' },
      notes: 'Station loading bay. Drivers need a Network Rail vehicle pass.',
      emails: ['manchester.piccadilly@pret.co.uk'],
    }),
    roster: roster('manchester-piccadilly', [
      ['Ryan Fletcher', 'General Manager'],
      ['Chioma Eze', 'Assistant Manager'],
      ['David Lindqvist', 'Area Manager'],
      ['Ellie Barrow', 'Team Leader'],
      ['Yusuf Khan', 'Team Member'],
      ['Martyna Kowalczyk', 'Team Member'],
      ['Jordan Pryce', 'Barista'],
      ['Isabella Rossi', 'Team Member'],
      ['Kwame Mensah', 'Team Member'],
      ['Holly Sutcliffe', 'Team Member'],
      ['Andrei Popescu', 'Team Member'],
      ['Megan Tran', 'Barista'],
      ['Lewis Cartwright', 'Team Member'],
      ['Fatima Noor', 'Team Member'],
      ['Sam Ogilvie', 'Team Member'],
    ]),
  },
  {
    id: 'birmingham-grand-central',
    name: 'Pret Birmingham Grand Central',
    shortName: 'Birmingham Grand Central',
    location: 'Grand Central, Stephenson Street, Birmingham B2',
    openingDate: '29 September',
    open: { weekday: '06:00', saturday: '06:30', sunday: '07:30' },
    suggestedTemplateId: 'st-pancras',
    suggestedReason: 'Station shop, matching trade pattern',
    suggestedHubId: 'midlands-cpu',
    sheet: sheetRow({
      code: '4129',
      profitCentre: '4129-BHM-GC',
      address1: 'Unit 12, Grand Central',
      address2: 'Stephenson Street',
      city: 'Birmingham',
      postcode: 'B2 4XJ',
      deliveries: deliveries({ start: '05:00', end: '07:30' }, { start: '05:30', end: '08:00' }, { start: '06:00', end: '08:00' }),
      contact: { name: 'Simone Clarke', position: 'General Manager', phone: '07700 900275' },
      notes: 'Goods lift from the Navigation Street dock.',
      emails: ['birmingham.grandcentral@pret.co.uk'],
    }),
    roster: roster('birmingham-grand-central', [
      ['Simone Clarke', 'General Manager'],
      ['Harvey Dunn', 'Assistant Manager'],
      ['Zara Iqbal', 'Team Leader'],
      ['Patrick O\u2019Shea', 'Team Member'],
      ['Lucia Fernandez', 'Team Member'],
      ['Theo Jarvis', 'Barista'],
      ['Amara Diallo', 'Team Member'],
      ['Oliver Stanton', 'Team Member'],
      ['Renata Silva', 'Team Member'],
      ['Josh Whelan', 'Team Member'],
      ['Keira Bowen', 'Barista'],
      ['Adam Szabo', 'Team Member'],
    ]),
  },
  {
    id: 'york-coney-st',
    name: 'Pret York Coney Street',
    shortName: 'York Coney Street',
    location: '18 Coney Street, York YO1',
    openingDate: '6 October',
    open: { weekday: '07:00', saturday: '07:00', sunday: '08:00' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street',
    suggestedHubId: 'northern-cpu',
    // Sheet gap: no site email on this row.
    sheet: sheetRow({
      code: '4130',
      profitCentre: '4130-YORK-CON',
      address1: '18 Coney Street',
      city: 'York',
      postcode: 'YO1 9NA',
      deliveries: deliveries({ start: '06:00', end: '08:30' }, { start: '06:30', end: '09:00' }, null),
      contact: { name: 'Freya Dalton', position: 'General Manager', phone: '07700 900519' },
      notes: 'Pedestrian zone: vehicles allowed before 10:30 only.',
    }),
    roster: roster('york-coney-st', [
      ['Freya Dalton', 'General Manager'],
      ['Milo Hart', 'Assistant Manager'],
      ['Anya Petrova', 'Team Member'],
      ['George Ferns', 'Team Member'],
      ['Lily Chambers', 'Barista'],
      ['Hassan Farah', 'Team Member'],
      ['Poppy Nield', 'Team Member'],
      ['Ethan Marsh', 'Team Member'],
      ['Carmen Ruiz', 'Team Member'],
      ['Rhys Bevan', 'Team Member'],
    ]),
  },
  {
    id: 'liverpool-one',
    name: 'Pret Liverpool One',
    shortName: 'Liverpool One',
    location: 'Liverpool ONE, Paradise Street, Liverpool L1',
    openingDate: '6 October',
    open: { weekday: '06:30', saturday: '07:00', sunday: '08:00' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street',
    suggestedHubId: 'northern-cpu',
    sheet: sheetRow({
      code: '4131',
      profitCentre: '4131-LPL-ONE',
      address1: 'Unit 8, Liverpool ONE',
      address2: 'Paradise Street',
      city: 'Liverpool',
      postcode: 'L1 8JF',
      deliveries: deliveries({ start: '05:30', end: '08:00' }, { start: '06:00', end: '08:30' }, { start: '07:00', end: '09:00' }),
      contact: { name: 'Niamh Gallagher', position: 'General Manager', phone: '07700 900644' },
      notes: 'Book a slot with Liverpool ONE logistics the day before.',
      emails: ['liverpool.one@pret.co.uk'],
    }),
    roster: roster('liverpool-one', [
      ['Niamh Gallagher', 'General Manager'],
      ['Kofi Antwi', 'Assistant Manager'],
      ['Erin Maddox', 'Team Leader'],
      ['Stefan Ilic', 'Team Member'],
      ['Ruby Latham', 'Team Member'],
      ['Idris Balogun', 'Barista'],
      ['Chloe Winstan', 'Team Member'],
      ['Mateusz Zielinski', 'Team Member'],
      ['Tia Osborne', 'Team Member'],
      ['Finn Docherty', 'Team Member'],
      ['Sana Malik', 'Team Member'],
      ['Jay Herrick', 'Team Member'],
    ]),
  },
  {
    id: 'sheffield-fargate',
    name: 'Pret Sheffield Fargate',
    shortName: 'Sheffield Fargate',
    location: '32 Fargate, Sheffield S1',
    openingDate: '13 October',
    open: { weekday: '07:00', saturday: '07:30', sunday: '08:30' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street',
    suggestedHubId: 'northern-cpu',
    // Sheet gap: GM named but no phone number on this row.
    sheet: sheetRow({
      code: '4132',
      profitCentre: '4132-SHF-FAR',
      address1: '32 Fargate',
      city: 'Sheffield',
      postcode: 'S1 2HE',
      deliveries: deliveries({ start: '06:00', end: '08:30' }, { start: '06:30', end: '09:00' }, null),
      contact: { name: 'Aaron Blythe', position: 'General Manager', phone: '' },
      emails: ['sheffield.fargate@pret.co.uk'],
    }),
    roster: roster('sheffield-fargate', [
      ['Aaron Blythe', 'General Manager'],
      ['Dina Rashid', 'Assistant Manager'],
      ['Toby Cresswell', 'Team Member'],
      ['Ines Moreau', 'Team Member'],
      ['Zack Palmer', 'Barista'],
      ['Willow Grant', 'Team Member'],
      ['Emeka Obi', 'Team Member'],
      ['Katie Rundle', 'Team Member'],
      ['Luka Horvat', 'Team Member'],
      ['Bea Sanderson', 'Team Member'],
    ]),
  },
  {
    id: 'newcastle-grainger',
    name: 'Pret Newcastle Grainger Street',
    shortName: 'Newcastle Grainger Street',
    location: '45 Grainger Street, Newcastle NE1',
    openingDate: '13 October',
    open: { weekday: '06:30', saturday: '07:00', sunday: '08:00' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street',
    suggestedHubId: 'northern-cpu',
    sheet: sheetRow({
      code: '4133',
      profitCentre: '4133-NCL-GRA',
      address1: '45 Grainger Street',
      city: 'Newcastle upon Tyne',
      postcode: 'NE1 5JE',
      deliveries: deliveries({ start: '05:30', end: '08:00' }, { start: '06:00', end: '08:30' }, null),
      contact: { name: 'Paige Redfern', position: 'General Manager', phone: '07700 900781' },
      notes: 'Rear access via Nun Street. No parking on Grainger Street.',
      emails: ['newcastle.grainger@pret.co.uk'],
    }),
    roster: roster('newcastle-grainger', [
      ['Paige Redfern', 'General Manager'],
      ['Dominic Achebe', 'Assistant Manager'],
      ['Skye Mowbray', 'Team Leader'],
      ['Arjun Nair', 'Team Member'],
      ['Tegan Lowry', 'Team Member'],
      ['Micah Turnbull', 'Barista'],
      ['Elsa Bergstrom', 'Team Member'],
      ['Cormac Quinn', 'Team Member'],
      ['Robyn Faulks', 'Team Member'],
      ['Dev Chauhan', 'Team Member'],
      ['Sadie Whitmore', 'Team Member'],
      ['Leon Marek', 'Team Member'],
    ]),
  },
  {
    id: 'nottingham-clumber',
    name: 'Pret Nottingham Clumber Street',
    shortName: 'Nottingham Clumber Street',
    location: '12 Clumber Street, Nottingham NG1',
    openingDate: '20 October',
    open: { weekday: '07:00', saturday: '07:00', sunday: '08:00' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street',
    suggestedHubId: 'midlands-cpu',
    sheet: sheetRow({
      code: '4134',
      profitCentre: '4134-NOT-CLU',
      address1: '12 Clumber Street',
      city: 'Nottingham',
      postcode: 'NG1 3ED',
      deliveries: deliveries({ start: '06:00', end: '08:30' }, { start: '06:30', end: '09:00' }, { start: '07:30', end: '09:00' }),
      contact: { name: 'Imogen Vasey', position: 'General Manager', phone: '07700 900856' },
      notes: 'Shared yard with the neighbouring units. Keep the gate clear.',
      emails: ['nottingham.clumber@pret.co.uk'],
    }),
    roster: roster('nottingham-clumber', [
      ['Imogen Vasey', 'General Manager'],
      ['Bilal Hussain', 'Assistant Manager'],
      ['Cara Netherton', 'Team Member'],
      ['Rocco Amato', 'Team Member'],
      ['Jess Pemberton', 'Barista'],
      ['Kian Rowbotham', 'Team Member'],
      ['Alba Diaz', 'Team Member'],
      ['Noah Kingsley', 'Team Member'],
      ['Mia Stroud', 'Team Member'],
      ['Felix Anand', 'Team Member'],
      ['Darcy Ellwood', 'Team Member'],
    ]),
  },
];

export function getNewSite(id: string): NewSite | undefined {
  return NEW_SITES.find((s) => s.id === id);
}

// ─── Derived helpers ─────────────────────────────────────────────────────────

/** Role split for a roster given per-person overrides. */
export function roleCounts(
  people: WorkdayPerson[],
  overrides: Record<string, EdifyRole>,
): Record<EdifyRole, number> {
  const counts: Record<EdifyRole, number> = { Employee: 0, Manager: 0, Admin: 0 };
  for (const p of people) {
    counts[overrides[p.id] ?? defaultEdifyRole(p.workdayRole)] += 1;
  }
  return counts;
}

/** "8 Managers · 33 Employees" — omits zero-count roles,
 *  singular/plural aware. */
export function describeRoleCounts(counts: Record<EdifyRole, number>): string {
  const order: EdifyRole[] = ['Manager', 'Employee', 'Admin'];
  return order
    .filter((r) => counts[r] > 0)
    .map((r) => `${counts[r]} ${r}${counts[r] === 1 ? '' : 's'}`)
    .join(' · ');
}
