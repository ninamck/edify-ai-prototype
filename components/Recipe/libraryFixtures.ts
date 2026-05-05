export type RecipeCategory =
  | 'Coffee' | 'Tea' | 'Pastry' | 'Food' | 'Wine' | 'Spirits' | 'Kids'
  | 'Bakery' | 'Sandwich' | 'Salad' | 'Snack' | 'Beverage';
export type RecipeStatus = 'Active' | 'Draft' | 'Archived';
export type RecipeFlag =
  | { type: 'cost-drift'; label: string }
  | { type: 'missing-prod'; label: string }
  | { type: 'missing-size'; label: string }
  | null;

export type RecipeKind = 'standalone' | 'component' | 'assembly';

export type RecipeSubRecipe = {
  recipeId: string;
  quantityPerUnit: number;
  unit: string;
};

/**
 * Rich row used by the new full-page editor (manual-intake-style). When set on
 * a recipe these take precedence over `ingredients` / `packaging` for editing.
 * The lighter `ingredients` array is still used by the read-only drawer view
 * for back-compat with existing fixtures.
 */
export type RichRow = {
  id: string;
  name: string;
  supplier: string;
  qty: number | '';
  uom: string;
  unitCostP: number;
};

export type RichVariableRow = RichRow & { type: string };

/**
 * Unified "what goes into this recipe" row. A recipe component is either:
 *   - a raw ingredient (kind: 'item') — name + supplier + qty + uom + cost, OR
 *   - a sub-recipe (kind: 'recipe') — references another Recipe by id.
 *
 * The order of rows is the build order (top → bottom in the UI). On save the
 * page splits these into the legacy `Recipe.ingredients` and `Recipe.subRecipes`
 * arrays for back-compat with read-only views.
 */
export type ItemComponent = {
  id: string;
  kind: 'item';
  name: string;
  supplier: string;
  qty: number | '';
  uom: string;
  unitCostP: number;
  /**
   * Optional link to the master ingredient (`PRET_INGREDIENTS`). When set,
   * the component inherits the ingredient's `defaultPrepWork` unless
   * `prepWorkOverride` below is non-empty. When unset, only `prepWorkOverride`
   * contributes prep-work chips for this row.
   */
  ingredientId?: string;
  /**
   * Per-recipe prep-work override. When non-empty, REPLACES the master
   * ingredient's `defaultPrepWork` for this row (e.g. "for THIS recipe
   * we want the tomato diced not sliced"). Each entry may carry an
   * optional `leadOffset` so the work is scheduled the day before
   * (`-1`) or two days before (`-2`) consumption.
   */
  prepWorkOverride?: import('@/components/Production/fixtures').PrepWorkEntry[];
};

export type RecipeComponent = {
  id: string;
  kind: 'recipe';
  recipeId: string;
  qty: number | '';
  uom: string;
};

export type ComponentRow = ItemComponent | RecipeComponent;

export type RecipeFormExtras = {
  yieldQty?: number | '';
  yieldUom?: string;
  sites?: string[];
  instructions?: string;
  allergens?: string[];
  photoName?: string | null;
  /** Unified component list (items + sub-recipes). When set, takes precedence
   *  over `Recipe.ingredients` and `Recipe.subRecipes` for editing purposes. */
  components?: ComponentRow[];
  /** @deprecated kept for back-compat; use `components` */
  detailedIngredients?: RichRow[];
  variableIngredients?: RichVariableRow[];
  packaging?: RichRow[];
  productionExtras?: {
    visibility?: string[];
    prepSeconds?: number | '';
    productionRef?: string;
    keyIngredients?: string[];
    tags?: string[];
    minBatch?: number | '';
    maxBatch?: number | '' | 'unlimited';
    batchMultiple?: number | '';
  };
  advanced?: {
    productClass?: string;
    isSubRecipe?: boolean;
    countInStockTake?: boolean;
    excludeFromCogs?: boolean;
    shelfLifeValue?: number | '';
    shelfLifeUnit?: 'minutes' | 'hours' | 'days';
    closingRange?: string;
    bakeryHot?: string;
    allowCarryOver?: boolean;
    enablePcr?: boolean;
    usedFor?: string[];
  };
  pricing?: {
    desiredMargin?: number | '';
    vatPct?: number | '';
    hotCold?: 'hot' | 'cold' | null;
    srpDineInEx?: number | '';
    srpTakeawayEx?: number | '';
    srpDeliveryEx?: number | '';
    deliveryCommission?: number | '';
  };
};

export type Recipe = {
  id: string;
  name: string;
  category: RecipeCategory;
  ingredientCost: number;        // £ per serve
  priceDineIn: number;
  priceTakeaway: number;
  priceDelivery: number;
  marginPct: number;             // dine-in margin
  status: RecipeStatus;
  flag: RecipeFlag;
  menuItems: { name: string; posLinked: boolean }[];
  ingredients: { name: string; qty: string; supplier: string }[];
  modifierGroups: string[];
  production: {
    visibility: 'Bar' | 'Kitchen' | 'Both' | null;
    shelfLifeMinutes: number | null;
    prepTimeSeconds: number | null;
  };
  /** Stand-alone / component / assembly. Drives the Type pill and Components filter. */
  kind: RecipeKind;
  /** When this recipe is an assembly: ordered components consumed per unit. */
  subRecipes?: RecipeSubRecipe[];
  /** Links to PRET_WORKFLOWS for the production-flow DAG view. */
  workflowId?: string;
  /** Orphan prep flag (e.g. end-of-day mise that no current assembly explicitly pulls). */
  isPrep?: boolean;
  /** Include this recipe when counting physical inventory at stock take.
   *  Defaults to true — opt out for items where on-hand counts don't
   *  make sense (made-to-order coffees, custom assemblies, etc.). */
  countInStockTake?: boolean;
  /** Exclude this recipe from cost-of-goods calculations. Useful for
   *  comp / staff items, complimentary tasters, or recipes whose cost
   *  is rolled up via a parent assembly. Defaults to false. */
  excludeFromCogs?: boolean;
  /** Rich form fields edited via the full-page recipe editor. All optional so
   *  existing fixtures don't need to fill them in. */
  formExtras?: RecipeFormExtras;
};

const coffeeIngs = (withMilkMl: number | null) => {
  const list: Recipe['ingredients'] = [
    { name: 'Espresso blend', qty: '7g', supplier: 'Bidvest' },
  ];
  if (withMilkMl != null) {
    list.push({ name: 'Whole milk', qty: `${withMilkMl}ml`, supplier: 'Fresh Earth Produce' });
  }
  return list;
};

export const FITZROY_RECIPES: Omit<Recipe, 'kind'>[] = [
  {
    id: 'rec-flat-white',
    name: 'Flat white (8oz)',
    category: 'Coffee',
    ingredientCost: 0.84,
    priceDineIn: 4.00,
    priceTakeaway: 3.80,
    priceDelivery: 4.20,
    marginPct: 79,
    status: 'Active',
    flag: null,
    menuItems: [
      { name: 'Flat white', posLinked: true },
      { name: 'Oat flat white', posLinked: true },
    ],
    ingredients: coffeeIngs(180),
    modifierGroups: ['Alt milks', 'Cup sizes'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 90 },
  },
  {
    id: 'rec-cappuccino',
    name: 'Cappuccino',
    category: 'Coffee',
    ingredientCost: 0.81,
    priceDineIn: 4.00,
    priceTakeaway: 3.80,
    priceDelivery: 4.20,
    marginPct: 73,
    status: 'Active',
    flag: { type: 'cost-drift', label: 'cost drift' },
    menuItems: [{ name: 'Cappuccino', posLinked: true }],
    ingredients: coffeeIngs(150),
    modifierGroups: ['Alt milks', 'Cup sizes'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 95 },
  },
  {
    id: 'rec-latte',
    name: 'Latte',
    category: 'Coffee',
    ingredientCost: 0.82,
    priceDineIn: 4.20,
    priceTakeaway: 4.00,
    priceDelivery: 4.40,
    marginPct: 72,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Latte', posLinked: true }],
    ingredients: coffeeIngs(200),
    modifierGroups: ['Alt milks', 'Cup sizes'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 100 },
  },
  {
    id: 'rec-americano',
    name: 'Americano',
    category: 'Coffee',
    ingredientCost: 0.45,
    priceDineIn: 3.20,
    priceTakeaway: 3.00,
    priceDelivery: 3.40,
    marginPct: 86,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Americano', posLinked: true }],
    ingredients: coffeeIngs(null),
    modifierGroups: ['Alt milks'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 60 },
  },
  {
    id: 'rec-mocha',
    name: 'Mocha',
    category: 'Coffee',
    ingredientCost: 0.95,
    priceDineIn: 4.60,
    priceTakeaway: 4.40,
    priceDelivery: 4.80,
    marginPct: 66,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Mocha', posLinked: true }],
    ingredients: [
      { name: 'Espresso blend', qty: '7g', supplier: 'Bidvest' },
      { name: 'Whole milk', qty: '180ml', supplier: 'Fresh Earth Produce' },
      { name: 'Chocolate syrup', qty: '20ml', supplier: 'Bidvest' },
      { name: 'Cocoa powder', qty: '2g', supplier: 'Bidvest' },
    ],
    modifierGroups: ['Alt milks', 'Cup sizes'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 110 },
  },
  {
    id: 'rec-cortado',
    name: 'Cortado',
    category: 'Coffee',
    ingredientCost: 0.68,
    priceDineIn: 3.60,
    priceTakeaway: 3.40,
    priceDelivery: 3.80,
    marginPct: 81,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Cortado', posLinked: true }],
    ingredients: coffeeIngs(90),
    modifierGroups: ['Alt milks'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 80 },
  },
  {
    id: 'rec-macchiato',
    name: 'Macchiato',
    category: 'Coffee',
    ingredientCost: 0.54,
    priceDineIn: 3.20,
    priceTakeaway: 3.00,
    priceDelivery: 3.40,
    marginPct: 83,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Macchiato', posLinked: true }],
    ingredients: coffeeIngs(30),
    modifierGroups: ['Alt milks'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 70 },
  },
  {
    id: 'rec-iced-latte',
    name: 'Iced latte',
    category: 'Coffee',
    ingredientCost: 0.94,
    priceDineIn: 4.60,
    priceTakeaway: 4.40,
    priceDelivery: 4.80,
    marginPct: 79,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Iced latte', posLinked: true }],
    ingredients: [
      { name: 'Espresso blend', qty: '14g', supplier: 'Bidvest' },
      { name: 'Whole milk', qty: '200ml', supplier: 'Fresh Earth Produce' },
      { name: 'Ice', qty: '80g', supplier: 'In-house' },
    ],
    modifierGroups: ['Alt milks'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 85 },
  },
  {
    id: 'rec-english-breakfast',
    name: 'English breakfast',
    category: 'Tea',
    ingredientCost: 0.32,
    priceDineIn: 2.80,
    priceTakeaway: 2.60,
    priceDelivery: 3.00,
    marginPct: 89,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'English breakfast', posLinked: true }],
    ingredients: [
      { name: 'English breakfast tea', qty: '1 bag', supplier: 'Bidvest' },
      { name: 'Hot water', qty: '250ml', supplier: 'In-house' },
    ],
    modifierGroups: ['Cup sizes'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 40 },
  },
  {
    id: 'rec-earl-grey',
    name: 'Earl Grey',
    category: 'Tea',
    ingredientCost: 0.34,
    priceDineIn: 2.80,
    priceTakeaway: 2.60,
    priceDelivery: 3.00,
    marginPct: 88,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Earl Grey', posLinked: true }],
    ingredients: [
      { name: 'Earl Grey tea', qty: '1 bag', supplier: 'Bidvest' },
      { name: 'Hot water', qty: '250ml', supplier: 'In-house' },
    ],
    modifierGroups: ['Cup sizes'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 40 },
  },
  {
    id: 'rec-green-tea',
    name: 'Green tea',
    category: 'Tea',
    ingredientCost: 0.36,
    priceDineIn: 2.80,
    priceTakeaway: 2.60,
    priceDelivery: 3.00,
    marginPct: 87,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Green tea', posLinked: true }],
    ingredients: [
      { name: 'Green tea', qty: '1 bag', supplier: 'Bidvest' },
      { name: 'Hot water', qty: '250ml', supplier: 'In-house' },
    ],
    modifierGroups: ['Cup sizes'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 40 },
  },
  {
    id: 'rec-blueberry-muffin',
    name: 'Blueberry muffin',
    category: 'Pastry',
    ingredientCost: 1.12,
    priceDineIn: 3.20,
    priceTakeaway: 3.00,
    priceDelivery: 3.40,
    marginPct: 63,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Blueberry muffin', posLinked: true }],
    ingredients: [
      { name: 'Blueberry muffin', qty: '1 unit', supplier: 'Rise Bakery' },
    ],
    modifierGroups: [],
    production: { visibility: null, shelfLifeMinutes: 60 * 12, prepTimeSeconds: null },
  },
  {
    id: 'rec-croissant',
    name: 'Croissant',
    category: 'Pastry',
    ingredientCost: 0.85,
    priceDineIn: 2.80,
    priceTakeaway: 2.60,
    priceDelivery: 3.00,
    marginPct: 69,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Croissant', posLinked: true }],
    ingredients: [
      { name: 'Butter croissant', qty: '1 unit', supplier: 'Rise Bakery' },
    ],
    modifierGroups: [],
    production: { visibility: null, shelfLifeMinutes: 60 * 8, prepTimeSeconds: null },
  },
  {
    id: 'rec-almond-croissant',
    name: 'Almond croissant',
    category: 'Pastry',
    ingredientCost: 1.08,
    priceDineIn: 3.40,
    priceTakeaway: 3.20,
    priceDelivery: 3.60,
    marginPct: 68,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Almond croissant', posLinked: true }],
    ingredients: [
      { name: 'Almond croissant', qty: '1 unit', supplier: 'Rise Bakery' },
    ],
    modifierGroups: [],
    production: { visibility: null, shelfLifeMinutes: 60 * 8, prepTimeSeconds: null },
  },
  {
    id: 'rec-smirnoff',
    name: 'Smirnoff vodka',
    category: 'Spirits',
    ingredientCost: 0.95,
    priceDineIn: 4.50,
    priceTakeaway: 4.50,
    priceDelivery: 5.00,
    marginPct: 79,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Smirnoff vodka', posLinked: true }],
    ingredients: [
      { name: 'Smirnoff vodka', qty: '25ml', supplier: 'Bidvest' },
    ],
    modifierGroups: ['Pour size'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 30 },
  },
  {
    id: 'rec-tanqueray',
    name: 'Tanqueray gin',
    category: 'Spirits',
    ingredientCost: 1.15,
    priceDineIn: 5.00,
    priceTakeaway: 5.00,
    priceDelivery: 5.50,
    marginPct: 77,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Tanqueray gin', posLinked: true }],
    ingredients: [
      { name: 'Tanqueray gin', qty: '25ml', supplier: 'Bidvest' },
    ],
    modifierGroups: ['Pour size'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 30 },
  },
  {
    id: 'rec-savvy-b',
    name: 'Savvy B',
    category: 'Wine',
    ingredientCost: 8.20,
    priceDineIn: 22.00,
    priceTakeaway: 22.00,
    priceDelivery: 24.00,
    marginPct: 63,
    status: 'Draft',
    flag: { type: 'missing-size', label: 'no size modifier' },
    menuItems: [{ name: 'Savvy B', posLinked: false }],
    ingredients: [
      { name: 'Marlborough Sauv Blanc', qty: '750ml', supplier: 'Bidvest' },
    ],
    modifierGroups: [],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 30 },
  },
  {
    id: 'rec-house-red',
    name: 'House red (glass)',
    category: 'Wine',
    ingredientCost: 1.32,
    priceDineIn: 6.50,
    priceTakeaway: 6.50,
    priceDelivery: 7.00,
    marginPct: 80,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'House red', posLinked: true }],
    ingredients: [
      { name: 'House red', qty: '175ml', supplier: 'Bidvest' },
    ],
    modifierGroups: [],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 30 },
  },
  {
    id: 'rec-avocado-toast',
    name: 'Avocado toast',
    category: 'Food',
    ingredientCost: 2.04,
    priceDineIn: 8.50,
    priceTakeaway: 7.80,
    priceDelivery: 9.00,
    marginPct: 76,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Avocado toast', posLinked: true }],
    ingredients: [
      { name: 'Sourdough', qty: '2 slices', supplier: 'Rise Bakery' },
      { name: 'Avocado', qty: '1 unit', supplier: 'Fresh Earth Produce' },
      { name: 'Lemon', qty: '0.25 unit', supplier: 'Fresh Earth Produce' },
      { name: 'Chilli flakes', qty: '1g', supplier: 'Bidvest' },
      { name: 'Sea salt', qty: '1g', supplier: 'Bidvest' },
    ],
    modifierGroups: [],
    production: { visibility: 'Kitchen', shelfLifeMinutes: 20, prepTimeSeconds: 240 },
  },
  {
    id: 'rec-salmon-bagel',
    name: 'Smoked salmon bagel',
    category: 'Food',
    ingredientCost: 2.40,
    priceDineIn: 8.00,
    priceTakeaway: 7.20,
    priceDelivery: 8.50,
    marginPct: 70,
    status: 'Active',
    flag: { type: 'missing-prod', label: 'no prod' },
    menuItems: [{ name: 'Smoked salmon bagel', posLinked: true }],
    ingredients: [
      { name: 'Bagel', qty: '1 unit', supplier: 'Rise Bakery' },
      { name: 'Smoked salmon', qty: '60g', supplier: 'Fresh Earth Produce' },
      { name: 'Cream cheese', qty: '30g', supplier: 'The Cheese Board' },
      { name: 'Red onion', qty: '10g', supplier: 'Fresh Earth Produce' },
      { name: 'Dill', qty: '1g', supplier: 'Fresh Earth Produce' },
    ],
    modifierGroups: [],
    production: { visibility: null, shelfLifeMinutes: 30, prepTimeSeconds: 180 },
  },
  {
    id: 'rec-babyccino',
    name: 'Kids babyccino',
    category: 'Kids',
    ingredientCost: 0.18,
    priceDineIn: 1.20,
    priceTakeaway: 1.20,
    priceDelivery: 1.40,
    marginPct: 85,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Kids babyccino', posLinked: true }],
    ingredients: [
      { name: 'Whole milk', qty: '80ml', supplier: 'Fresh Earth Produce' },
      { name: 'Cocoa powder', qty: '1g', supplier: 'Bidvest' },
    ],
    modifierGroups: [],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 45 },
  },
];

export function flagVariant(flag: RecipeFlag): 'warning' | 'error' | null {
  if (!flag) return null;
  if (flag.type === 'cost-drift') return 'warning';
  return 'warning';
}

export function formatCost(n: number): string {
  return `£${n.toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pret library entries — derived from production fixtures so the Recipes page
// shows every product on the production board, with sub-recipe dependencies
// and a workflow id intact for the drawer DAG.
// ─────────────────────────────────────────────────────────────────────────────

import { PRET_RECIPES } from '@/components/Production/fixtures';

const PRET_CONSUMED_IDS: Set<string> = new Set(
  PRET_RECIPES.flatMap((r) => r.subRecipes?.map((s) => s.recipeId) ?? []),
);

function deriveKind(r: typeof PRET_RECIPES[number]): RecipeKind {
  if (r.subRecipes && r.subRecipes.length > 0) return 'assembly';
  if (PRET_CONSUMED_IDS.has(r.id)) return 'component';
  return 'standalone';
}

/**
 * Demo pricing for the Pret library entries on the Recipes page. Real
 * Pret menus price dine-in and takeaway the same and tack a small
 * surcharge onto delivery (delivery-platform commission). Components
 * (granary loaves, egg mayo fillings, etc.) aren't sold directly so
 * they keep £0 and the drawer hides the Price & margin section as
 * before. Margin uses a 30% food cost rule of thumb so the rendered
 * "margin %" reads sensibly without per-recipe ingredient costing.
 */
const PRET_DEMO_PRICE_BY_CATEGORY: Record<string, { dineIn: number; takeaway: number; delivery: number }> = {
  Sandwich: { dineIn: 4.50, takeaway: 4.50, delivery: 5.50 },
  Salad:    { dineIn: 6.00, takeaway: 6.00, delivery: 7.00 },
  Bakery:   { dineIn: 2.50, takeaway: 2.50, delivery: 3.00 },
  Snack:    { dineIn: 3.50, takeaway: 3.50, delivery: 4.00 },
  Beverage: { dineIn: 3.00, takeaway: 3.00, delivery: 3.50 },
};

function pricingFor(r: typeof PRET_RECIPES[number], kind: RecipeKind): {
  ingredientCost: number;
  priceDineIn: number;
  priceTakeaway: number;
  priceDelivery: number;
  marginPct: number;
} {
  // Components and prep items aren't sellable on their own — keep
  // them at £0 so the drawer's `noPrice` gate hides the section.
  if (kind === 'component' || r.isPrep) {
    return { ingredientCost: 0, priceDineIn: 0, priceTakeaway: 0, priceDelivery: 0, marginPct: 0 };
  }
  const tier = PRET_DEMO_PRICE_BY_CATEGORY[r.category];
  if (!tier) {
    return { ingredientCost: 0, priceDineIn: 0, priceTakeaway: 0, priceDelivery: 0, marginPct: 0 };
  }
  const ingredientCost = Math.round(tier.dineIn * 0.30 * 100) / 100;
  const marginPct = Math.round(((tier.dineIn - ingredientCost) / tier.dineIn) * 100);
  return {
    ingredientCost,
    priceDineIn: tier.dineIn,
    priceTakeaway: tier.takeaway,
    priceDelivery: tier.delivery,
    marginPct,
  };
}

export const PRET_LIBRARY_RECIPES: Recipe[] = PRET_RECIPES.map((r) => {
  const kind = deriveKind(r);
  const pricing = pricingFor(r, kind);
  return {
    id: r.id,
    name: r.name,
    category: r.category as RecipeCategory,
    ...pricing,
    status: 'Active' as RecipeStatus,
    flag: null,
    menuItems: [],
    ingredients: [],
    modifierGroups: [],
    production: {
      visibility: null,
      shelfLifeMinutes: r.shelfLifeMinutes,
      prepTimeSeconds: null,
    },
    kind,
    subRecipes: r.subRecipes?.map((s) => ({
      recipeId: s.recipeId,
      quantityPerUnit: s.quantityPerUnit,
      unit: s.unit,
    })),
    workflowId: r.workflowId,
    isPrep: r.isPrep,
  };
});

export const ALL_LIBRARY_RECIPES: Recipe[] = [
  ...FITZROY_RECIPES.map((r): Recipe => ({ ...r, kind: 'standalone' })),
  ...PRET_LIBRARY_RECIPES,
];

/** Inverse of subRecipes: which recipes consume this one. */
export function buildUsedInIndex(recipes: Recipe[]): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const r of recipes) {
    if (!r.subRecipes) continue;
    for (const sub of r.subRecipes) {
      const list = idx.get(sub.recipeId) ?? [];
      list.push(r.id);
      idx.set(sub.recipeId, list);
    }
  }
  return idx;
}
