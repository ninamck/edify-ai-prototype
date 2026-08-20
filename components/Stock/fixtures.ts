import type {
  ItemGroup,
  StockItem,
  SiteStockSnapshot,
  StockMovement,
  StockMovementKind,
  StockItemType,
  StockCategory,
  StocktakeLine,
  StocktakeRecord,
} from './status';
import type { ConfidenceScore } from '@/app/assisted-ordering/types';

// Hours/days helpers — keep movement timestamps relative to "now" so
// the relative-date formatter renders sensibly whenever the demo is
// loaded, instead of going stale as fixed ISO dates would.
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * HOUR_MS).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * DAY_MS).toISOString();
}

// Concise movement builder — keeps the per-item fixture lists readable.
function mv(
  id: string,
  kind: StockMovementKind,
  date: string,
  quantity: number,
  note: string,
  ref?: string,
): StockMovement {
  return { id, kind, date, quantity, note, ref };
}

// ─── Supplier roster ──────────────────────────────────────────────────────────
// Named suppliers that the bulk-generated items below reference. Keeping
// them in one place means filters like "show only Bidvest items" will
// match cleanly across every site.

interface SupplierRef {
  id: string;
  name: string;
  leadTimeDays: number;
}

const SUPPLIERS = {
  bidvest:      { id: 'sup-bidvest',      name: 'Bidvest',                      leadTimeDays: 1 },
  freshEarth:   { id: 'sup-fresh-earth',  name: 'Fresh Earth Produce',          leadTimeDays: 1 },
  cpu:          { id: 'sup-cpu',          name: 'CPU — Central Kitchen',        leadTimeDays: 1 },
  barakat:      { id: 'sup-barakat',      name: 'Barakat Quality Plus',         leadTimeDays: 2 },
  alAccad:      { id: 'sup-al-accad',     name: 'Al Accad Department Stores',   leadTimeDays: 2 },
  essentially:  { id: 'sup-essentially',  name: 'Essentially Juices Mfg.',      leadTimeDays: 3 },
  bakeryDirect: { id: 'sup-bakery-direct',name: 'Bakery Direct',                leadTimeDays: 1 },
  highland:     { id: 'sup-highland',     name: 'Highland Meats',               leadTimeDays: 2 },
  pacific:      { id: 'sup-pacific',      name: 'Pacific Coast Seafood',        leadTimeDays: 2 },
  brakes:       { id: 'sup-brakes',       name: 'Brakes UK',                    leadTimeDays: 1 },
  bunzl:        { id: 'sup-bunzl',        name: 'Bunzl Catering Supplies',      leadTimeDays: 3 },
  lakeDistrict: { id: 'sup-lake-district',name: 'Lake District Dairies',        leadTimeDays: 1 },
  inHouse:      { id: 'sup-in-house',     name: '(in-house)',                   leadTimeDays: 0 },
} as const satisfies Record<string, SupplierRef>;

// ─── Item builder + templates ─────────────────────────────────────────────────
// Bulk-generating dozens of items inline would balloon this file beyond
// the point of being skimmable. The builder + template pattern below
// lets every per-site stock list pick up a coherent catalogue (~36
// shared items spanning every category + location) while keeping the
// hand-curated edge-case items (stockouts, spoilage stories) at the top
// of each site unchanged.

interface ItemTemplate {
  baseId: string;
  name: string;
  variant: string;
  type?: StockItemType;      // default 'product'
  category: StockCategory;
  unit: string;              // stockUnit
  alts?: string[];           // alternateUnits
  /** Pack-style conversions from alt unit → primary stockUnit. Mass /
   *  volume (g↔kg, mL↔L) is inferred automatically by status.ts, so
   *  only the pack-shaped alternates need an entry here (cases, bags,
   *  trays, sleeves, …). Keep keys aligned with `alts`. */
  conv?: Record<string, number>;
  recipes?: number;          // linkedRecipeCount
  /** Reference quantity. Per-site stock = baseStock × site multiplier. */
  baseStock: number;
  par: number;
  /** Cost per `unit` in GBP. For sub-recipes / recipes this is the
   *  calculated COGS per unit. */
  unitPrice: number;
  supplier: SupplierRef;
  /** When true, theoreticalStock is null + no POS data (recipes /
   *  sub-recipes that aren't sold directly). Default false. */
  recipeMode?: boolean;
}

/** Build a StockItem from a template + per-site context. Movements are
 *  auto-generated: a sale + delivery for products, a production cycle
 *  for recipes / sub-recipes — enough to make the drawer's history
 *  panel feel populated without us writing one by hand for every row. */
function buildItem(
  t: ItemTemplate,
  ctx: {
    sitePrefix: string;
    stockMul: number;
    ageDays: number;
    confidence: ConfidenceScore;
  },
): StockItem {
  const type = t.type ?? 'product';
  const stock = +(t.baseStock * ctx.stockMul).toFixed(2);
  // Theoretical hovers within ±10% of counted stock; null for recipes
  // that don't ring through POS.
  const theoretical = t.recipeMode
    ? null
    : +(stock * (1 + (Math.random() * 0.2 - 0.1))).toFixed(2);

  const id = `${ctx.sitePrefix}-${t.baseId}`;

  // Auto-generated movement set — short and shape-appropriate.
  let movements: StockMovement[];
  if (type === 'recipe' || type === 'sub-recipe') {
    movements = [
      mv(
        `m-${id}-1`,
        'production-out',
        hoursAgo(6),
        -(stock * 0.15),
        type === 'recipe' ? 'Assembled / sold' : 'Used in parent recipes',
      ),
      mv(
        `m-${id}-2`,
        'production-in',
        daysAgo(1),
        +(stock * 0.4),
        'Prep batch',
      ),
    ];
  } else {
    movements = [
      mv(`m-${id}-1`, 'sale',     hoursAgo(8), -(stock * 0.1), 'POS sale'),
      mv(`m-${id}-2`, 'delivery', daysAgo(2),   +(stock * 0.5), `GRN · ${t.supplier.name}`),
    ];
  }

  const stocktakeBand: 'fresh' | 'aging' | 'stale' =
    ctx.ageDays <= 3 ? 'fresh' : ctx.ageDays <= 7 ? 'aging' : 'stale';

  return {
    id,
    name: t.name,
    variant: t.variant,
    type,
    category: t.category,
    linkedRecipeCount: t.recipes ?? 0,
    stockUnit: t.unit,
    alternateUnits: t.alts ?? [],
    unitConversions: t.conv,
    currentStock: stock,
    parLevel: t.par,
    parConfirmed: true,
    stockDataAgeDays: ctx.ageDays,
    salesVelocity7d: +(stock * 0.07).toFixed(2),
    supplierId: t.supplier.id,
    supplierName: type === 'recipe' || type === 'sub-recipe'
      ? '(in-house)'
      : t.supplier.name,
    supplierLeadTimeDays: type === 'recipe' || type === 'sub-recipe'
      ? 0
      : t.supplier.leadTimeDays,
    posDataAvailable: type === 'product' || type === 'master-product',
    theoreticalStock: theoretical,
    unitPrice: t.unitPrice,
    confidenceScore: ctx.confidence,
    confidenceFactors: {
      stocktake: stocktakeBand,
      pos: t.recipeMode ? 'unavailable' : 'active',
      par: 'confirmed',
      variance: 'stable',
    },
    movements,
  };
}

/** The shared 36-item catalogue. Covers every category + every storage
 *  location the Stocktake view will tab through. Each template is
 *  realised per-site with a different stock multiplier so the Heathrow
 *  airport site naturally holds more than the King's Cross spoke. */
const SHARED_TEMPLATES: ItemTemplate[] = [
  // ─── Beverage (Bar) ────────────────────────────────────────────────
  // 24-can cases for soft drinks, 12-bottle cases for waters — standard
  // wholesale pack sizes. Carton drinks roll as 1 bottle = 1L.
  { baseId: 'coke',         name: 'Coca-Cola Classic',  variant: '330ml can',     category: 'Beverage', unit: 'cans',    alts: ['cases'], conv: { cases: 24 }, recipes: 0, baseStock: 48, par: 60, unitPrice: 0.45, supplier: SUPPLIERS.brakes },
  { baseId: 'coke-diet',    name: 'Diet Coke',          variant: '330ml can',     category: 'Beverage', unit: 'cans',    alts: ['cases'], conv: { cases: 24 }, recipes: 0, baseStock: 36, par: 48, unitPrice: 0.45, supplier: SUPPLIERS.brakes },
  { baseId: 'sparkling',    name: 'Sparkling Water',    variant: '500ml bottle',  category: 'Beverage', unit: 'bottles', alts: ['cases'], conv: { cases: 12 }, recipes: 0, baseStock: 24, par: 36, unitPrice: 0.30, supplier: SUPPLIERS.brakes },
  { baseId: 'still-water',  name: 'Still Water',        variant: '500ml bottle',  category: 'Beverage', unit: 'bottles', alts: ['cases'], conv: { cases: 12 }, recipes: 0, baseStock: 24, par: 36, unitPrice: 0.18, supplier: SUPPLIERS.brakes },
  { baseId: 'oj',           name: 'Orange Juice',       variant: '1L carton',     category: 'Beverage', unit: 'L',       alts: ['mL', 'bottles'], conv: { bottles: 1 }, recipes: 3, baseStock: 12, par: 16, unitPrice: 1.80, supplier: SUPPLIERS.essentially },
  { baseId: 'aj',           name: 'Apple Juice',        variant: '1L carton',     category: 'Beverage', unit: 'L',       alts: ['mL', 'bottles'], conv: { bottles: 1 }, recipes: 2, baseStock: 8,  par: 12, unitPrice: 1.60, supplier: SUPPLIERS.essentially },
  { baseId: 'almond-milk',  name: 'Almond Milk',        variant: '1L Califia',    category: 'Beverage', unit: 'L',       alts: ['mL', 'units'], conv: { units: 1 }, recipes: 5, baseStock: 10, par: 14, unitPrice: 2.20, supplier: SUPPLIERS.bidvest },
  { baseId: 'espresso-beans', name: 'Espresso Beans',   variant: 'House blend 1kg', type: 'master-product', category: 'Beverage', unit: 'kg', alts: ['g', 'bags'], conv: { bags: 1 }, recipes: 12, baseStock: 8, par: 10, unitPrice: 18.00, supplier: SUPPLIERS.barakat },

  // ─── Dairy (Kitchen) ───────────────────────────────────────────────
  // Pack sizes pulled straight from the variant: 2L milk bottles, 250g
  // butter blocks, trays of 30 eggs.
  { baseId: 'whole-milk',   name: 'Whole Milk',         variant: '2L bottle',     category: 'Dairy', unit: 'L', alts: ['mL', 'bottles'], conv: { bottles: 2 }, recipes: 9, baseStock: 24, par: 30, unitPrice: 0.90, supplier: SUPPLIERS.lakeDistrict },
  { baseId: 'greek-yogurt', name: 'Greek Yogurt',       variant: '5kg tub',       category: 'Dairy', unit: 'kg',alts: ['g'],            recipes: 4, baseStock: 8,  par: 10, unitPrice: 4.50, supplier: SUPPLIERS.lakeDistrict },
  { baseId: 'butter',       name: 'Butter',             variant: 'Unsalted 250g', category: 'Dairy', unit: 'kg',alts: ['g', 'units'],   conv: { units: 0.25 }, recipes: 7, baseStock: 5,  par: 8,  unitPrice: 6.20, supplier: SUPPLIERS.lakeDistrict },
  { baseId: 'cheddar',      name: 'Cheddar Cheese',     variant: 'Mature block 1kg', category: 'Dairy', unit: 'kg', alts: ['g'],        recipes: 6, baseStock: 6,  par: 8,  unitPrice: 8.50, supplier: SUPPLIERS.lakeDistrict },
  { baseId: 'eggs',         name: 'Free-range Eggs',    variant: 'Large, tray of 30', category: 'Dairy', unit: 'units', alts: ['trays'], conv: { trays: 30 }, recipes: 11, baseStock: 60, par: 90, unitPrice: 0.18, supplier: SUPPLIERS.freshEarth },

  // ─── Bakery (Front of House) ──────────────────────────────────────
  // Loaves count 1:1 against units (one loaf = one countable unit).
  // Bagels ship as packs of 6.
  { baseId: 'sourdough',    name: 'Sourdough Loaf',     variant: '800g',          category: 'Bakery', unit: 'units', alts: ['loaves'], conv: { loaves: 1 }, recipes: 3, baseStock: 12, par: 18, unitPrice: 1.40, supplier: SUPPLIERS.bakeryDirect },
  { baseId: 'multigrain',   name: 'Multigrain Bread',   variant: 'Sliced 800g',   category: 'Bakery', unit: 'units', alts: ['loaves'], conv: { loaves: 1 }, recipes: 4, baseStock: 8,  par: 12, unitPrice: 1.30, supplier: SUPPLIERS.bakeryDirect },
  { baseId: 'bagels',       name: 'Plain Bagels',       variant: 'Pack of 6',     category: 'Bakery', unit: 'units', alts: ['packs'],  conv: { packs: 6 }, recipes: 5, baseStock: 18, par: 24, unitPrice: 0.45, supplier: SUPPLIERS.bakeryDirect },
  { baseId: 'muffins',      name: 'Blueberry Muffins',  variant: 'Individual',    category: 'Bakery', unit: 'units', alts: [],         recipes: 0, baseStock: 24, par: 30, unitPrice: 0.55, supplier: SUPPLIERS.bakeryDirect },

  // ─── Produce (Kitchen) ────────────────────────────────────────────
  // Punnets are 250g, lemons ~10 to a kilo, bananas ~120g each. Loose
  // ranges so the operator can mix counts.
  { baseId: 'cherry-toms',  name: 'Cherry Tomatoes',    variant: 'Punnet 250g',   category: 'Produce', unit: 'kg', alts: ['g', 'punnets'], conv: { punnets: 0.25 }, recipes: 5, baseStock: 4, par: 6,  unitPrice: 4.20, supplier: SUPPLIERS.freshEarth },
  { baseId: 'romaine',      name: 'Romaine Lettuce',    variant: 'Head',          category: 'Produce', unit: 'units', alts: ['heads'], conv: { heads: 1 }, recipes: 4, baseStock: 12, par: 18, unitPrice: 0.90, supplier: SUPPLIERS.freshEarth },
  { baseId: 'cucumber',     name: 'Cucumber',           variant: 'Long English',  category: 'Produce', unit: 'units', alts: [],        recipes: 5, baseStock: 10, par: 14, unitPrice: 0.55, supplier: SUPPLIERS.freshEarth },
  { baseId: 'avocado',      name: 'Avocado',            variant: 'Hass medium',   category: 'Produce', unit: 'units', alts: [],        recipes: 6, baseStock: 18, par: 24, unitPrice: 0.60, supplier: SUPPLIERS.freshEarth },
  { baseId: 'lemon',        name: 'Lemons',             variant: 'Unwaxed',       category: 'Produce', unit: 'units', alts: ['kg'],    conv: { kg: 10 }, recipes: 8, baseStock: 20, par: 30, unitPrice: 0.25, supplier: SUPPLIERS.freshEarth },
  { baseId: 'bananas',      name: 'Bananas',            variant: 'Fairtrade',     category: 'Produce', unit: 'kg',    alts: ['g', 'units'], conv: { units: 0.12 }, recipes: 2, baseStock: 6, par: 9,  unitPrice: 1.20, supplier: SUPPLIERS.freshEarth },
  { baseId: 'berries',      name: 'Mixed Berries',      variant: 'Punnet 250g',   category: 'Produce', unit: 'kg',    alts: ['g', 'punnets'], conv: { punnets: 0.25 }, recipes: 3, baseStock: 2, par: 3,  unitPrice: 6.50, supplier: SUPPLIERS.freshEarth },

  // ─── Meat (Kitchen) ───────────────────────────────────────────────
  { baseId: 'chicken-bst',  name: 'Chicken Breast',     variant: 'Free-range, 2.5kg pack', category: 'Meat', unit: 'kg', alts: ['g', 'packs'], conv: { packs: 2.5 }, recipes: 9, baseStock: 12, par: 16, unitPrice: 8.50, supplier: SUPPLIERS.highland },
  { baseId: 'smoked-salmon',name: 'Smoked Salmon',      variant: 'Scottish, 500g', category: 'Meat', unit: 'kg', alts: ['g', 'packs'], conv: { packs: 0.5 }, recipes: 4, baseStock: 3,  par: 4,  unitPrice: 24.00, supplier: SUPPLIERS.pacific },
  { baseId: 'bacon',        name: 'Streaky Bacon',      variant: '1kg pack',      category: 'Meat', unit: 'kg', alts: ['g', 'packs'], conv: { packs: 1 }, recipes: 5, baseStock: 5,  par: 7,  unitPrice: 8.00, supplier: SUPPLIERS.highland },

  // ─── Pantry (Dry Store) ───────────────────────────────────────────
  // Pack sizes from the variant: 1kg pasta bags, 5kg rice sacks, 1kg
  // Dijon jars, 100-bag tea boxes.
  { baseId: 'penne',        name: 'Penne Pasta',        variant: 'Bronze-cut 1kg',category: 'Pantry', unit: 'kg', alts: ['g', 'bags'], conv: { bags: 1 }, recipes: 6, baseStock: 10, par: 14, unitPrice: 1.80, supplier: SUPPLIERS.bidvest },
  { baseId: 'basmati',      name: 'Basmati Rice',       variant: '5kg sack',      category: 'Pantry', unit: 'kg', alts: ['g', 'sacks'], conv: { sacks: 5 }, recipes: 5, baseStock: 15, par: 20, unitPrice: 1.20, supplier: SUPPLIERS.bidvest },
  { baseId: 'mayo',         name: 'Mayonnaise',         variant: 'Hellmann\'s 5L',category: 'Pantry', unit: 'L',  alts: ['mL'],         recipes: 11, baseStock: 8, par: 10, unitPrice: 4.20, supplier: SUPPLIERS.bidvest },
  { baseId: 'dijon',        name: 'Dijon Mustard',      variant: '1kg jar',       category: 'Pantry', unit: 'kg', alts: ['g', 'jars'],  conv: { jars: 1 }, recipes: 7,  baseStock: 3, par: 4,  unitPrice: 8.00, supplier: SUPPLIERS.bidvest },
  { baseId: 'tea-eb',       name: 'English Breakfast Tea', variant: 'Box of 100', category: 'Pantry', unit: 'units', alts: ['boxes'],   conv: { boxes: 100 }, recipes: 0,  baseStock: 200, par: 250, unitPrice: 0.04, supplier: SUPPLIERS.brakes },

  // ─── Packaging (Dry Store) ────────────────────────────────────────
  { baseId: 'cups-12',      name: '12oz Coffee Cups',   variant: 'Sleeve of 50',  category: 'Packaging', unit: 'units', alts: ['sleeves'], conv: { sleeves: 50 }, recipes: 0, baseStock: 250, par: 350, unitPrice: 0.06, supplier: SUPPLIERS.bunzl },
  { baseId: 'lids-12',      name: '12oz Cup Lids',      variant: 'Sleeve of 100', category: 'Packaging', unit: 'units', alts: ['sleeves'], conv: { sleeves: 100 }, recipes: 0, baseStock: 300, par: 400, unitPrice: 0.04, supplier: SUPPLIERS.bunzl },
  { baseId: 'paper-bags',   name: 'Paper Bags',         variant: 'Medium, pack of 250', category: 'Packaging', unit: 'units', alts: ['packs'], conv: { packs: 250 }, recipes: 0, baseStock: 500, par: 750, unitPrice: 0.05, supplier: SUPPLIERS.bunzl },

  // ─── Cleaning (Back of House) ─────────────────────────────────────
  { baseId: 'hand-soap',    name: 'Hand Soap',          variant: 'Refill 5L',     category: 'Cleaning', unit: 'L',     alts: ['mL', 'bottles'], conv: { bottles: 5 }, recipes: 0, baseStock: 4, par: 6,  unitPrice: 3.50, supplier: SUPPLIERS.bunzl },
  { baseId: 'sanitiser',    name: 'Surface Sanitiser',  variant: '750mL spray',   category: 'Cleaning', unit: 'units', alts: ['bottles'],       conv: { bottles: 1 }, recipes: 0, baseStock: 6, par: 10, unitPrice: 4.20, supplier: SUPPLIERS.bunzl },

  // ─── Prepared (Kitchen) ───────────────────────────────────────────
  // Sub-recipes / recipes carry a calculated COGS rather than a
  // supplier purchase price — used the same way for stock valuation.
  // Hummus portions are 50g; the recipe is portion-driven so a 1:1
  // unit↔portion map.
  { baseId: 'hummus-base',  name: 'Hummus Base',        variant: 'House sub-recipe', type: 'sub-recipe', category: 'Prepared', unit: 'kg', alts: ['g', 'portions'], conv: { portions: 0.05 }, recipes: 3, baseStock: 1.5, par: 2,   unitPrice: 3.80, supplier: SUPPLIERS.inHouse, recipeMode: true },

  // ─── Recipe (Kitchen) ─────────────────────────────────────────────
  { baseId: 'caesar-wrap',  name: 'Chicken Caesar Wrap',variant: 'House recipe',  type: 'recipe', category: 'Prepared', unit: 'units', alts: [], recipes: 0, baseStock: 12, par: 18, unitPrice: 1.95, supplier: SUPPLIERS.inHouse, recipeMode: true },
];

/** Realise all shared templates against a site's context. Returns a
 *  fresh StockItem[] each call (no shared references across sites). */
function expandTemplates(
  sitePrefix: string,
  stockMul: number,
  ageDays: number,
  confidence: ConfidenceScore = 'high',
): StockItem[] {
  return SHARED_TEMPLATES.map(t =>
    buildItem(t, { sitePrefix, stockMul, ageDays, confidence }),
  );
}

// ─── Active site stock ────────────────────────────────────────────────────────
// Curated set covering every status in the taxonomy + every item type
// so the demo shows the full UI matrix on one screen. Reuses ingredient
// vocabulary from /assisted-ordering so the operator sees identical
// names across surfaces, but extends each row with the velocity +
// supplier + theoretical + type + category + movements context Monitor
// stock needs.

export const STOCK_ITEMS: StockItem[] = [
  // ─── Stockout — Product ─────────────────────────────────────────────
  {
    id: 'ing-oatmilk',
    unitPrice: 2.50,
    name: 'Oat Milk',
    variant: 'Califa Farms 1L',
    type: 'product',
    category: 'Dairy',
    linkedRecipeCount: 7,
    stockUnit: 'L',
    alternateUnits: ['mL', 'units'],
    unitConversions: { units: 1 },
    currentStock: 2,
    parLevel: 10,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 1.6,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 2.4,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-oat-1', 'sale',      hoursAgo(2),  -0.5, 'POS sale · Flat White × 4'),
      mv('m-oat-2', 'sale',      hoursAgo(6),  -0.7, 'POS sale · Latte × 6'),
      mv('m-oat-3', 'sale',      daysAgo(1),   -1.4, 'POS sale · mixed coffees'),
      mv('m-oat-4', 'stocktake', daysAgo(1),    0,   'Manager stocktake — counted 4L'),
      mv('m-oat-5', 'delivery', daysAgo(3),    8,   'GRN #4821 · Bidvest', 'grn-4821'),
      mv('m-oat-6', 'sale',      daysAgo(4),   -1.5, 'POS sale · mixed coffees'),
    ],
  },
  {
    id: 'ing-croissants',
    unitPrice: 8.00,
    name: 'Croissants',
    variant: 'Butter, box of 12',
    type: 'product',
    category: 'Bakery',
    linkedRecipeCount: 2,
    stockUnit: 'boxes',
    alternateUnits: ['units'],
    unitConversions: { units: 1 / 12 },
    currentStock: 0,
    parLevel: 6,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 1.4,
    supplierId: 'sup-risebakery',
    supplierName: 'Rise Bakery',
    supplierLeadTimeDays: 0,
    posDataAvailable: true,
    theoreticalStock: 0.2,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-cr-1', 'sale',      hoursAgo(3), -2,   'POS sale · pastry rush'),
      mv('m-cr-2', 'waste',     hoursAgo(8), -1,   'End-of-day waste'),
      mv('m-cr-3', 'delivery',  daysAgo(1),   4,   'GRN #4830 · Rise Bakery', 'grn-4830'),
      mv('m-cr-4', 'sale',      daysAgo(2),  -1.6, 'POS sale · weekend rush'),
    ],
  },
  {
    id: 'ing-spinach',
    unitPrice: 6.00,
    name: 'Baby Spinach',
    variant: 'Loose 200g bag',
    type: 'product',
    category: 'Produce',
    linkedRecipeCount: 5,
    stockUnit: 'kg',
    alternateUnits: ['g'],
    currentStock: 0.4,
    parLevel: 3,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 0.5,
    supplierId: 'sup-freshearth',
    supplierName: 'Fresh Earth Produce',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 0.6,
    confidenceScore: 'medium',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'moderate',
    },
    movements: [
      mv('m-sp-1', 'sale',      hoursAgo(4), -0.2, 'POS sale · salad bowls'),
      mv('m-sp-2', 'stocktake', daysAgo(1),   0,   'Counted 0.4 kg vs theoretical 0.6'),
      mv('m-sp-3', 'delivery',  daysAgo(2),   2,   'GRN #4810 · Fresh Earth'),
    ],
  },

  // ─── Variance — Product ─────────────────────────────────────────────
  {
    id: 'ing-chicken',
    unitPrice: 8.50,
    name: 'Chicken Breast',
    variant: 'Free-range portion',
    type: 'product',
    category: 'Meat',
    linkedRecipeCount: 8,
    stockUnit: 'kg',
    alternateUnits: ['g', 'units'],
    unitConversions: { units: 0.2 },
    currentStock: 3.5,
    parLevel: 12,
    parConfirmed: false,
    stockDataAgeDays: 2,
    salesVelocity7d: 1.8,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 6.2,
    confidenceScore: 'low',
    confidenceFactors: {
      stocktake: 'aging', pos: 'active', par: 'suggested', variance: 'high',
    },
    movements: [
      mv('m-ck-1', 'stocktake',     daysAgo(2),  -2.7, 'Counted 3.5 kg vs theoretical 6.2 kg — 43% gap'),
      mv('m-ck-2', 'sale',          daysAgo(2),  -1.2, 'POS sale · chicken wraps'),
      mv('m-ck-3', 'production-out',daysAgo(3),  -2.0, 'Used in Chicken Avo Sandwich prep'),
      mv('m-ck-4', 'delivery',      daysAgo(4),   10,  'GRN #4798 · Bidvest', 'grn-4798'),
      mv('m-ck-5', 'waste',         daysAgo(5),  -0.3, 'Trim waste'),
    ],
  },
  {
    id: 'ing-gruyere',
    unitPrice: 14.00,
    name: 'Gruyère',
    variant: 'Le Gruyère AOP 500g',
    type: 'product',
    category: 'Dairy',
    linkedRecipeCount: 3,
    stockUnit: 'kg',
    alternateUnits: ['g'],
    currentStock: 0.5,
    parLevel: 3,
    parConfirmed: false,
    stockDataAgeDays: 2,
    salesVelocity7d: 0.3,
    supplierId: 'sup-cheese',
    supplierName: 'The Cheese Board',
    supplierLeadTimeDays: 2,
    posDataAvailable: true,
    theoreticalStock: 0.9,
    confidenceScore: 'medium',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'suggested', variance: 'moderate',
    },
    movements: [
      mv('m-gr-1', 'sale',      daysAgo(1), -0.2, 'POS sale · Ham + Cheese Toastie'),
      mv('m-gr-2', 'stocktake', daysAgo(2),  0,   'Counted 0.5 kg vs theoretical 0.9'),
      mv('m-gr-3', 'delivery',  daysAgo(5),  1.5, 'GRN #4780 · The Cheese Board'),
    ],
  },

  // ─── Spoilage — Product ─────────────────────────────────────────────
  {
    id: 'ing-coconut-milk',
    unitPrice: 1.80,
    name: 'Coconut Milk',
    variant: 'Aroy-D 400ml tin',
    type: 'product',
    category: 'Pantry',
    linkedRecipeCount: 4,
    stockUnit: 'units',
    alternateUnits: ['cases'],
    unitConversions: { cases: 24 },
    currentStock: 22,
    parLevel: 12,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 0.4,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 22.3,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-cm-1', 'sale',      daysAgo(1), -1,  'POS sale · Coconut Latte'),
      mv('m-cm-2', 'delivery',  daysAgo(2),  12, 'GRN #4815 · Bidvest (over-ordered)'),
      mv('m-cm-3', 'sale',      daysAgo(3), -2,  'POS sale · mixed beverages'),
    ],
  },
  {
    id: 'ing-cream',
    unitPrice: 2.40,
    name: 'Whipping Cream',
    variant: 'Lancewood 1L',
    type: 'product',
    category: 'Dairy',
    linkedRecipeCount: 6,
    stockUnit: 'L',
    alternateUnits: ['mL'],
    currentStock: 10,
    parLevel: 6,
    parConfirmed: true,
    stockDataAgeDays: 3,
    salesVelocity7d: 0.6,
    supplierId: 'sup-cheese',
    supplierName: 'The Cheese Board',
    supplierLeadTimeDays: 2,
    posDataAvailable: true,
    theoreticalStock: 10.4,
    confidenceScore: 'medium',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-wc-1', 'sale',      daysAgo(1), -0.6, 'POS sale · cake slices'),
      mv('m-wc-2', 'delivery',  daysAgo(3),  6,   'GRN #4805 · The Cheese Board'),
      mv('m-wc-3', 'waste',     daysAgo(7), -0.4, 'Past use-by'),
    ],
  },

  // ─── Overstock — Product ────────────────────────────────────────────
  {
    id: 'ing-tomato-paste',
    unitPrice: 3.20,
    name: 'Tomato Paste',
    variant: 'Rhodes 410g tin',
    type: 'product',
    category: 'Pantry',
    linkedRecipeCount: 4,
    stockUnit: 'units',
    alternateUnits: ['cases'],
    unitConversions: { cases: 24 },
    currentStock: 14,
    parLevel: 8,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 1.6,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 14.2,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-tp-1', 'sale',     daysAgo(1), -2, 'POS sale · pasta dishes'),
      mv('m-tp-2', 'delivery', daysAgo(2), 12, 'GRN #4812 · Bidvest'),
    ],
  },

  // ─── Stale data — Product ───────────────────────────────────────────
  {
    id: 'ing-vanilla',
    unitPrice: 0.85,
    name: 'Vanilla Extract',
    variant: 'Nielsen-Massey 100ml',
    type: 'product',
    category: 'Pantry',
    linkedRecipeCount: 5,
    stockUnit: 'units',
    alternateUnits: ['mL'],
    unitConversions: { mL: 0.01 },
    currentStock: 4,
    parLevel: 3,
    parConfirmed: true,
    stockDataAgeDays: 11,
    salesVelocity7d: 0.2,
    supplierId: 'sup-cpu',
    supplierName: 'CPU — Central Kitchen',
    supplierLeadTimeDays: 1,
    posDataAvailable: false,
    theoreticalStock: null,
    confidenceScore: 'low',
    confidenceFactors: {
      stocktake: 'stale', pos: 'unavailable', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-vn-1', 'stocktake', daysAgo(11), 0, 'Last stocktake — counted 4 units'),
      mv('m-vn-2', 'delivery',  daysAgo(20), 2, 'GRN #4720 · CPU'),
    ],
  },

  // ─── Healthy — Master product ───────────────────────────────────────
  // Master products span suppliers — same physical thing, different
  // unit costs / SKUs. Stock value here aggregates across the master.
  {
    id: 'mp-olive-oil',
    unitPrice: 6.50,
    name: 'Olive Oil',
    variant: 'Master · across suppliers',
    type: 'master-product',
    category: 'Pantry',
    linkedRecipeCount: 11,
    stockUnit: 'L',
    alternateUnits: ['mL'],
    currentStock: 12,
    parLevel: 10,
    parConfirmed: true,
    stockDataAgeDays: 2,
    salesVelocity7d: 0.9,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest (primary)',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 12.4,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-oo-1', 'sale',     daysAgo(1), -0.8, 'POS sale · across dishes'),
      mv('m-oo-2', 'delivery', daysAgo(3),  5,   'GRN #4825 · Bidvest'),
    ],
  },
  {
    id: 'ing-flour',
    unitPrice: 1.20,
    name: 'Bread Flour',
    variant: 'Eureka Mills 12.5kg',
    type: 'product',
    category: 'Bakery',
    linkedRecipeCount: 9,
    stockUnit: 'kg',
    alternateUnits: ['g', 'bags'],
    unitConversions: { bags: 12.5 },
    currentStock: 20,
    parLevel: 25,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 1.4,
    supplierId: 'sup-cpu',
    supplierName: 'CPU — Central Kitchen',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 20.5,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-fl-1', 'production-out', daysAgo(1), -3,   'Used in croissant dough'),
      mv('m-fl-2', 'delivery',       daysAgo(2),  12.5,'GRN #4818 · CPU'),
    ],
  },

  // ─── Healthy — Sub-recipe ───────────────────────────────────────────
  // A prepped component made in-house. "On-hand" is the prepped
  // quantity; consumed by parent recipes, replenished by a production
  // run. No supplier.
  {
    id: 'sr-pesto-base',
    unitPrice: 4.50,
    name: 'Pesto base',
    variant: 'House sub-recipe',
    type: 'sub-recipe',
    category: 'Prepared',
    linkedRecipeCount: 4,
    stockUnit: 'kg',
    alternateUnits: ['g', 'portions'],
    unitConversions: { portions: 0.05 },
    currentStock: 0.8,
    parLevel: 1.2,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 0.25,
    supplierId: 'sup-cpu',
    supplierName: '(in-house)',
    supplierLeadTimeDays: 0,
    posDataAvailable: false,
    theoreticalStock: 0.85,
    confidenceScore: 'medium',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'unavailable', par: 'confirmed', variance: 'moderate',
    },
    movements: [
      mv('m-pb-1', 'production-out', hoursAgo(5), -0.15, 'Used in Pesto Pasta × 6'),
      mv('m-pb-2', 'production-in',  daysAgo(1),   1.0,  'Prep batch · 1.0 kg made'),
      mv('m-pb-3', 'production-out', daysAgo(2),  -0.3,  'Used in Pesto Pasta × 12'),
    ],
  },

  // ─── Healthy — Recipe ───────────────────────────────────────────────
  // A finished dish ready to sell. "On-hand" is units assembled and
  // sitting in the chill cabinet.
  {
    id: 'rc-chicken-avo',
    unitPrice: 2.20,
    name: 'Chicken Avo Sandwich',
    variant: 'House recipe',
    type: 'recipe',
    category: 'Prepared',
    linkedRecipeCount: 0,
    stockUnit: 'units',
    alternateUnits: ['portions'],
    unitConversions: { portions: 1 },
    currentStock: 14,
    parLevel: 18,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 3.2,
    supplierId: 'sup-cpu',
    supplierName: '(made on-site)',
    supplierLeadTimeDays: 0,
    posDataAvailable: true,
    theoreticalStock: 14.5,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-ca-1', 'sale',          hoursAgo(2), -2, 'POS sale × 2'),
      mv('m-ca-2', 'sale',          hoursAgo(5), -4, 'POS sale · lunch rush'),
      mv('m-ca-3', 'production-in', hoursAgo(8), 20, 'Production run · 20 units made'),
      mv('m-ca-4', 'waste',         daysAgo(1),  -1, 'End-of-day waste'),
    ],
  },

  // ─── Healthy — Product ──────────────────────────────────────────────
  {
    id: 'ing-avocado',
    unitPrice: 0.60,
    name: 'Avocados',
    variant: 'Hass medium',
    type: 'product',
    category: 'Produce',
    linkedRecipeCount: 6,
    stockUnit: 'units',
    alternateUnits: ['trays'],
    unitConversions: { trays: 25 },
    currentStock: 24,
    parLevel: 30,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 5,
    supplierId: 'sup-freshearth',
    supplierName: 'Fresh Earth Produce',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 25,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-av-1', 'sale',     hoursAgo(3), -3,  'POS sale · avo toast'),
      mv('m-av-2', 'sale',     daysAgo(1),  -5,  'POS sale · across dishes'),
      mv('m-av-3', 'delivery', daysAgo(1),   20, 'GRN #4823 · Fresh Earth'),
    ],
  },

  // ─── Master products — multi-supplier pack types ────────────────────
  // These exercise the supplier-variant count layout: one master row
  // that breaks into per-supplier sub-rows, each holding its own
  // packaging. Covers the four cases the count surface handles:
  //   1. Different packaging per supplier (Avocado: tray of 18 + loose,
  //      bag of 12 + loose).
  //   2. Nested pack labels the numeric factor can't express cleanly
  //      (Coffee Cup Lids: box of 10 sleeves, sleeve of 50).
  //   3. Identical packaging across suppliers — count once
  //      (Mozzarella: "same packaging — counting for all").
  //   4. No countable unit configured yet (Vanilla Ice Cream).
  {
    id: 'mp-avocado',
    unitPrice: 0.60,
    name: 'Avocado',
    variant: 'Master · across suppliers',
    type: 'master-product',
    category: 'Produce',
    linkedRecipeCount: 6,
    stockUnit: 'each',
    alternateUnits: [],
    supplierVariants: [
      { id: 'v-freshearth', label: 'Fresh Earth Produce', units: ['tray', 'each'], conv: { tray: 18 } },
      { id: 'v-barakat',    label: 'Barakat Quality Plus', units: ['bag', 'each'],  conv: { bag: 12 } },
    ],
    currentStock: 56,
    parLevel: 60,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 8,
    supplierId: 'sup-freshearth',
    supplierName: '2 suppliers',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 58,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-mpav-1', 'sale',     hoursAgo(2), -6,  'POS sale · avo toast'),
      mv('m-mpav-2', 'delivery', daysAgo(1),   36, 'GRN #4830 · Fresh Earth (2 trays)'),
      mv('m-mpav-3', 'delivery', daysAgo(1),   24, 'GRN #4831 · Barakat (2 bags)'),
    ],
  },
  {
    id: 'mp-cup-lids',
    unitPrice: 0.04,
    name: 'Coffee Cup Lids (12oz)',
    variant: 'Master · across suppliers',
    type: 'master-product',
    category: 'Packaging',
    linkedRecipeCount: 0,
    stockUnit: 'each',
    alternateUnits: [],
    supplierVariants: [
      {
        id: 'v-bunzl',
        label: 'Bunzl Catering Supplies',
        units: ['box', 'sleeve', 'each'],
        conv: { box: 500, sleeve: 50 },
        packLabels: { box: '10sl', sleeve: '50' },
      },
      {
        id: 'v-alaccad',
        label: 'Al Accad Department Stores',
        units: ['bag', 'each'],
        conv: { bag: 200 },
        packLabels: { bag: '200' },
      },
    ],
    currentStock: 0,
    parLevel: 1000,
    parConfirmed: true,
    stockDataAgeDays: 3,
    salesVelocity7d: 120,
    supplierId: 'sup-bunzl',
    supplierName: '2 suppliers',
    supplierLeadTimeDays: 3,
    posDataAvailable: true,
    theoreticalStock: 0,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'aging', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-mplid-1', 'sale',     daysAgo(1),  -250, 'Usage · service'),
      mv('m-mplid-2', 'delivery', daysAgo(4),   500, 'GRN #4812 · Bunzl (1 box)'),
    ],
  },
  {
    id: 'mp-mozzarella',
    unitPrice: 12.50,
    name: 'Mozzarella',
    variant: 'Master · across suppliers',
    type: 'master-product',
    category: 'Dairy',
    linkedRecipeCount: 8,
    stockUnit: 'kg',
    alternateUnits: ['g', 'block'],
    unitConversions: { block: 1 },
    sharedPackaging: true,
    packNote: 'Same packaging — counting for all',
    currentStock: 5,
    parLevel: 6,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 0.6,
    supplierId: 'sup-lake-district',
    supplierName: '3 suppliers · same pack',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 5.3,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-mpmoz-1', 'production-out', hoursAgo(4), -0.5, 'Used · caprese + pizza'),
      mv('m-mpmoz-2', 'delivery',       daysAgo(1),   3,   'GRN #4829 · Lake District'),
    ],
  },
  {
    id: 'mp-vanilla-ice-cream',
    unitPrice: 0.006,
    name: 'Vanilla Ice Cream',
    variant: 'Master · across suppliers',
    type: 'master-product',
    category: 'Dairy',
    linkedRecipeCount: 2,
    stockUnit: 'g',
    alternateUnits: [],
    noCountingUnit: true,
    packNote: 'Add an alt UOM in supplier settings',
    currentStock: 250,
    parLevel: 2000,
    parConfirmed: false,
    stockDataAgeDays: 4,
    salesVelocity7d: 80,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 300,
    confidenceScore: 'low',
    confidenceFactors: {
      stocktake: 'aging', pos: 'active', par: 'not_set', variance: 'moderate',
    },
    movements: [
      mv('m-mpice-1', 'sale',     daysAgo(1),  -500, 'Usage · desserts'),
      mv('m-mpice-2', 'delivery', daysAgo(4),   1000, 'GRN #4810 · Bidvest'),
    ],
  },
];

// ─── Estate snapshot ──────────────────────────────────────────────────────────
// One snapshot per site in ACTIVE_SITES. Item counts are curated to
// make each tile tell a different story so the grid reads as more than
// a uniform wall.

// Each site = its hand-curated edge cases (already telling specific
// stories — stockouts, spoilage, variance, master-product spread)
// + the shared 36-item catalogue, tuned to that site's character via
// the stock multiplier + stocktake age:
//   • Espresso (hub kitchen)     — fresh counts, normal volume
//   • King's Cross (commuter)    — slimmer stock, regular cadence
//   • Heathrow (airport)         — higher volume, fresh counts
//   • Islington (standalone)     — modest stock, counts going stale
const ESPRESSO_ITEMS: StockItem[] = [
  ...STOCK_ITEMS,
  ...expandTemplates('fe', 1.0, 1, 'high'),
];

const KINGS_CROSS_ITEMS: StockItem[] = [
  // High-volume commuter spoke — short on a couple of fast movers,
  // healthy on most things.
  {
    id: 'ing-kx-oatmilk',
    unitPrice: 2.50,
    name: 'Oat Milk',
    variant: 'Califa Farms 1L',
    type: 'product',
    category: 'Dairy',
    linkedRecipeCount: 7,
    stockUnit: 'L',
    alternateUnits: ['mL', 'units'],
    unitConversions: { units: 1 },
    currentStock: 1,
    parLevel: 14,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 2.2,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 1.2,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-kx-oat-1', 'sale',     hoursAgo(1), -1.2, 'POS sale · morning rush'),
      mv('m-kx-oat-2', 'delivery', daysAgo(1),   6,   'GRN #4824 · Bidvest'),
    ],
  },
  {
    id: 'ing-kx-doughnuts',
    unitPrice: 0.85,
    name: 'Doughnuts',
    variant: 'Assorted glazed 6-pack',
    type: 'product',
    category: 'Bakery',
    linkedRecipeCount: 1,
    stockUnit: 'units',
    alternateUnits: ['boxes'],
    unitConversions: { boxes: 6 },
    currentStock: 0,
    parLevel: 24,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 4,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 0.5,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-kx-do-1', 'sale',     hoursAgo(2), -5, 'POS sale · commuter rush'),
      mv('m-kx-do-2', 'delivery', daysAgo(1),   18, 'GRN #4826 · Bidvest'),
    ],
  },
  {
    id: 'ing-kx-spinach',
    unitPrice: 6.00,
    name: 'Baby Spinach',
    variant: 'Loose 200g bag',
    type: 'product',
    category: 'Produce',
    linkedRecipeCount: 5,
    stockUnit: 'kg',
    alternateUnits: ['g'],
    currentStock: 0.3,
    parLevel: 2,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 0.4,
    supplierId: 'sup-freshearth',
    supplierName: 'Fresh Earth Produce',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 0.45,
    confidenceScore: 'medium',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'moderate',
    },
    movements: [
      mv('m-kx-sp-1', 'sale',     hoursAgo(4), -0.15, 'POS sale · salad bowls'),
      mv('m-kx-sp-2', 'delivery', daysAgo(1),   1,    'GRN #4827 · Fresh Earth'),
    ],
  },
  {
    id: 'ing-kx-evoo',
    unitPrice: 6.50,
    name: 'Extra Virgin Olive Oil',
    variant: 'Organic 5L',
    type: 'product',
    category: 'Pantry',
    linkedRecipeCount: 11,
    stockUnit: 'L',
    alternateUnits: ['mL'],
    currentStock: 5,
    parLevel: 6,
    parConfirmed: true,
    stockDataAgeDays: 2,
    salesVelocity7d: 0.4,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 5.2,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-kx-ev-1', 'sale',     daysAgo(1), -0.3, 'POS sale · across dishes'),
      mv('m-kx-ev-2', 'delivery', daysAgo(7),  5,   'GRN #4760 · Bidvest'),
    ],
  },
  ...expandTemplates('kx', 0.7, 2, 'high'),
];

const HEATHROW_ITEMS: StockItem[] = [
  // Airport hybrid — long-haul flight closures left them sitting on
  // sandwich ingredients past peak. Spoilage + variance story.
  {
    id: 'ing-hr-chicken',
    unitPrice: 8.50,
    name: 'Chicken Breast',
    variant: 'Free-range portion',
    type: 'product',
    category: 'Meat',
    linkedRecipeCount: 8,
    stockUnit: 'kg',
    alternateUnits: ['g', 'units'],
    unitConversions: { units: 0.2 },
    currentStock: 18,
    parLevel: 10,
    parConfirmed: true,
    stockDataAgeDays: 2,
    salesVelocity7d: 0.6,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 18.5,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-hr-ck-1', 'delivery', daysAgo(1), 15, 'GRN #4828 · Bidvest (flight cancellations)'),
      mv('m-hr-ck-2', 'sale',     daysAgo(2), -0.4, 'POS sale · chicken wraps'),
    ],
  },
  {
    id: 'ing-hr-avocado',
    unitPrice: 0.60,
    name: 'Avocados',
    variant: 'Hass medium',
    type: 'product',
    category: 'Produce',
    linkedRecipeCount: 6,
    stockUnit: 'units',
    alternateUnits: ['trays'],
    unitConversions: { trays: 25 },
    currentStock: 8,
    parLevel: 40,
    parConfirmed: true,
    stockDataAgeDays: 3,
    salesVelocity7d: 4,
    supplierId: 'sup-freshearth',
    supplierName: 'Fresh Earth Produce',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 14,
    confidenceScore: 'low',
    confidenceFactors: {
      stocktake: 'aging', pos: 'active', par: 'confirmed', variance: 'high',
    },
    movements: [
      mv('m-hr-av-1', 'stocktake', daysAgo(3), -6, 'Counted 8 vs theoretical 14 — investigate'),
      mv('m-hr-av-2', 'sale',      daysAgo(3), -4, 'POS sale · avo toast'),
    ],
  },
  {
    id: 'ing-hr-tomato',
    unitPrice: 3.20,
    name: 'Tomato Paste',
    variant: 'Rhodes 410g tin',
    type: 'product',
    category: 'Pantry',
    linkedRecipeCount: 4,
    stockUnit: 'units',
    alternateUnits: ['cases'],
    unitConversions: { cases: 24 },
    currentStock: 16,
    parLevel: 8,
    parConfirmed: true,
    stockDataAgeDays: 1,
    salesVelocity7d: 1.2,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest',
    supplierLeadTimeDays: 1,
    posDataAvailable: true,
    theoreticalStock: 16.2,
    confidenceScore: 'high',
    confidenceFactors: {
      stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-hr-tp-1', 'sale',     daysAgo(1), -1.4, 'POS sale · pasta dishes'),
      mv('m-hr-tp-2', 'delivery', daysAgo(2),  12,  'GRN #4814 · Bidvest'),
    ],
  },
  ...expandTemplates('hr', 1.4, 1, 'high'),
];

const ISLINGTON_ITEMS: StockItem[] = [
  // Standalone — well-run, only thing showing is a stale-stocktake
  // flag because the manager hasn't counted in a fortnight.
  {
    id: 'ing-is-flour',
    unitPrice: 1.20,
    name: 'Bread Flour',
    variant: 'Eureka Mills 12.5kg',
    type: 'product',
    category: 'Bakery',
    linkedRecipeCount: 9,
    stockUnit: 'kg',
    alternateUnits: ['g', 'bags'],
    unitConversions: { bags: 12.5 },
    currentStock: 18,
    parLevel: 25,
    parConfirmed: true,
    stockDataAgeDays: 12,
    salesVelocity7d: 1.5,
    supplierId: 'sup-cpu',
    supplierName: 'CPU — Central Kitchen',
    supplierLeadTimeDays: 1,
    posDataAvailable: false,
    theoreticalStock: null,
    confidenceScore: 'low',
    confidenceFactors: {
      stocktake: 'stale', pos: 'unavailable', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-is-fl-1', 'stocktake', daysAgo(12), 0, 'Last stocktake — counted 18 kg'),
      mv('m-is-fl-2', 'delivery',  daysAgo(15), 12.5, 'GRN #4700 · CPU'),
    ],
  },
  {
    id: 'ing-is-butter',
    unitPrice: 6.20,
    name: 'Butter',
    variant: 'Président 500g block',
    type: 'product',
    category: 'Dairy',
    linkedRecipeCount: 7,
    stockUnit: 'kg',
    alternateUnits: ['g'],
    currentStock: 3,
    parLevel: 4,
    parConfirmed: true,
    stockDataAgeDays: 12,
    salesVelocity7d: 0.3,
    supplierId: 'sup-cpu',
    supplierName: 'CPU — Central Kitchen',
    supplierLeadTimeDays: 1,
    posDataAvailable: false,
    theoreticalStock: null,
    confidenceScore: 'low',
    confidenceFactors: {
      stocktake: 'stale', pos: 'unavailable', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-is-bt-1', 'stocktake', daysAgo(12), 0, 'Last stocktake'),
      mv('m-is-bt-2', 'delivery',  daysAgo(15), 2.5, 'GRN #4702 · CPU'),
    ],
  },
  {
    id: 'ing-is-evoo',
    unitPrice: 6.50,
    name: 'Extra Virgin Olive Oil',
    variant: 'Organic 5L',
    type: 'product',
    category: 'Pantry',
    linkedRecipeCount: 11,
    stockUnit: 'L',
    alternateUnits: ['mL'],
    currentStock: 6,
    parLevel: 8,
    parConfirmed: true,
    stockDataAgeDays: 12,
    salesVelocity7d: 0.4,
    supplierId: 'sup-bidvest',
    supplierName: 'Bidvest',
    supplierLeadTimeDays: 1,
    posDataAvailable: false,
    theoreticalStock: null,
    confidenceScore: 'low',
    confidenceFactors: {
      stocktake: 'stale', pos: 'unavailable', par: 'confirmed', variance: 'stable',
    },
    movements: [
      mv('m-is-ev-1', 'stocktake', daysAgo(12), 0, 'Last stocktake'),
    ],
  },
  ...expandTemplates('is', 0.8, 12, 'medium'),
];

// Stocktake history per site. Each site's story:
//   • Fitzroy Espresso — hub kitchen on a weekly cadence, recent counts
//     all clean, a needs-review entry from when the GM caught a spinach
//     shrinkage two weeks back.
//   • King's Cross — high-volume spoke that only does section counts
//     because they don't have time for a full one; bar + bakery dominate.
//   • Heathrow — hybrid airport site with the worst variance story
//     in the estate, multiple needs-review entries.
//   • Islington — standalone site that's behind; last full count
//     was a fortnight ago, manager hasn't run one since.

// Derive a stable movement count from the record's id + itemsCounted.
// Real movement counts would come from the GRN/POS feeds; for the
// prototype we want a number that reads as plausible (3..9× items
// counted is a reasonable band for a mid-cadence venue) without
// shifting between renders. A simple FNV-style hash on the id gives
// us a stable per-record factor so each row keeps its own number.
function deriveMovementCount(id: string, itemsCounted: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  const factor = 3 + (Math.abs(h) % 7);
  return itemsCounted * factor;
}

function stocktake(
  id: string,
  date: string,
  counterName: string,
  scope: StocktakeRecord['scope'],
  itemsCounted: number,
  variancesFound: number,
  status: StocktakeRecord['status'],
  extras: Partial<Pick<StocktakeRecord, 'sectionName' | 'netVarianceValue' | 'lines'>> = {},
): StocktakeRecord {
  return {
    id,
    date,
    counterName,
    scope,
    itemsCounted,
    variancesFound,
    movementCount: deriveMovementCount(id, itemsCounted),
    status,
    ...extras,
  };
}

// ─── Espresso · Produce-fridge variance lines ────────────────────────────────
// Sam Adeyemi's 11-day-old Produce fridge section count came back with
// five lines that didn't match the system's theoretical. Captured here
// as `StocktakeLine`s so the review-and-submit surface can render the
// full counted breakdown + counter notes for each. The remaining 23
// lines reconciled cleanly and are summarised in the review header
// (28 counted = 23 clean + 5 variance), so we don't seed them
// individually — saves a wall of redundant fixtures and matches how
// the real product would surface the page ("look at what needs a
// decision, not at what's already settled").
//
// Variance $ totals: −$12.60 + −$7.80 + −$1.80 + −$6.60 + −$12.60 ≈ −$41
// of straight cost, plus an additional −$11 of cream rolled into the
// produce fridge that didn't get its own line in the summary headline
// — matches the −$52 netVarianceValue on the stocktake record without
// requiring a 6th variance row.
const ESPRESSO_PRODUCE_REVIEW_LINES: StocktakeLine[] = [
  {
    id: 'st-fe-3-l1',
    itemId: 'fe-cherry-toms',
    itemName: 'Cherry Tomatoes',
    itemVariant: 'Punnet 250g',
    category: 'Produce',
    stockUnit: 'kg',
    unitPrice: 4.20,
    // 4 punnets (1.0 kg) + 0.5 kg loose = 1.5 kg rolled up
    counts: { kg: 0.5, punnets: 4 },
    countedQty: 1.5,
    theoreticalAtCount: 4.0,
    note: 'Three overripe punnets binned Monday — no waste log entry was raised at the time.',
  },
  {
    id: 'st-fe-3-l2',
    itemId: 'fe-berries',
    itemName: 'Mixed Berries',
    itemVariant: 'Punnet 250g',
    category: 'Produce',
    stockUnit: 'kg',
    unitPrice: 6.50,
    // 2 punnets = 0.5 kg
    counts: { punnets: 2 },
    countedQty: 0.5,
    theoreticalAtCount: 2.0,
    note: 'Only what was in the chiller — back-up punnets not where they normally live. Possibly transferred to the bakery prep bench.',
  },
  {
    id: 'st-fe-3-l3',
    itemId: 'ing-spinach',
    itemName: 'Baby Spinach',
    itemVariant: 'Loose 200g bag',
    category: 'Produce',
    stockUnit: 'kg',
    unitPrice: 6.00,
    counts: { kg: 0.3 },
    countedQty: 0.3,
    theoreticalAtCount: 0.6,
    note: 'Two bags trimmed for salad prep today — bagged trim is in the waste bin but not logged.',
  },
  {
    id: 'st-fe-3-l4',
    itemId: 'ing-avocado',
    itemName: 'Avocados',
    itemVariant: 'Hass medium',
    category: 'Produce',
    stockUnit: 'units',
    unitPrice: 0.60,
    counts: { units: 12 },
    countedQty: 12,
    theoreticalAtCount: 25,
    note: 'Counted 12 firm + 2 soft (left in tray); the soft two probably need writing off. Worth checking POS for an avo-toast spike.',
  },
  {
    id: 'st-fe-3-l5',
    itemId: 'ing-gruyere',
    itemName: 'Gruyère',
    itemVariant: 'Le Gruyère AOP 500g',
    category: 'Dairy',
    stockUnit: 'kg',
    unitPrice: 14.00,
    counts: { kg: 0 },
    countedQty: 0,
    theoreticalAtCount: 0.9,
    note: 'Block missing from the cheese tray. Last service it appeared on was Sunday brunch — chef is checking with the AM team.',
  },
];

const ESPRESSO_HISTORY: StocktakeRecord[] = [
  stocktake('st-fe-1', daysAgo(1),  'Priya Naidoo', 'Full count',    142, 4,  'completed',
    { netVarianceValue: -38 }),
  stocktake('st-fe-2', daysAgo(8),  'Priya Naidoo', 'Full count',    140, 3,  'completed',
    { netVarianceValue: -12 }),
  stocktake('st-fe-3', daysAgo(11), 'Sam Adeyemi',  'Section count',  28, 5,  'needs-review',
    {
      sectionName: 'Produce fridge',
      netVarianceValue: -52,
      lines: ESPRESSO_PRODUCE_REVIEW_LINES,
    }),
  stocktake('st-fe-4', daysAgo(15), 'Priya Naidoo', 'Full count',    138, 2,  'completed',
    { netVarianceValue: -8 }),
];

const KINGS_CROSS_HISTORY: StocktakeRecord[] = [
  stocktake('st-kx-1', daysAgo(2),  'Jordan Lee',   'Section count',  18, 1,  'completed',
    { sectionName: 'Bar', netVarianceValue: -6 }),
  stocktake('st-kx-2', daysAgo(4),  'Jordan Lee',   'Section count',  24, 3,  'completed',
    { sectionName: 'Bakery cabinet', netVarianceValue: -22 }),
  stocktake('st-kx-3', daysAgo(9),  'Jordan Lee',   'Spot count',      4, 0,  'completed',
    { sectionName: 'Oat milk only' }),
  stocktake('st-kx-4', daysAgo(14), 'Reese Okafor', 'Full count',    122, 6,  'completed',
    { netVarianceValue: -47 }),
];

const HEATHROW_HISTORY: StocktakeRecord[] = [
  stocktake('st-hr-1', hoursAgo(4), 'Tom Iyer',     'Section count',  16, 4,  'in-progress',
    { sectionName: 'Chiller — meat/dairy' }),
  stocktake('st-hr-2', daysAgo(3),  'Tom Iyer',     'Full count',    134, 9,  'needs-review',
    { netVarianceValue: -184 }),
  stocktake('st-hr-3', daysAgo(7),  'Maya Chen',    'Section count',  22, 6,  'needs-review',
    { sectionName: 'Produce', netVarianceValue: -78 }),
  stocktake('st-hr-4', daysAgo(10), 'Tom Iyer',     'Full count',    133, 5,  'completed',
    { netVarianceValue: -41 }),
  stocktake('st-hr-5', daysAgo(17), 'Maya Chen',    'Full count',    130, 3,  'completed',
    { netVarianceValue: -19 }),
];

const ISLINGTON_HISTORY: StocktakeRecord[] = [
  stocktake('st-is-1', daysAgo(12), 'Casey Park',   'Full count',     96, 2,  'completed',
    { netVarianceValue: -14 }),
  stocktake('st-is-2', daysAgo(26), 'Casey Park',   'Full count',     94, 4,  'completed',
    { netVarianceValue: -28 }),
  stocktake('st-is-3', daysAgo(40), 'Casey Park',   'Full count',     93, 3,  'completed',
    { netVarianceValue: -22 }),
];

// Item groups are user-defined slicings of the catalogue ("the things
// I care about today"). To give every site a useful starting point
// without the operator having to build groups from scratch, we seed
// two derived defaults per site:
//
//   • High-value items — the top N items by `unitPrice` (descending),
//     where N defaults to 10. This is the bucket that drives the most
//     $-variance, so it's worth a quick count even when nothing's
//     formally flagged.
//   • Perishables — every item in a short-shelf-life category (dairy,
//     produce, seafood, meat, prepared). These walk first and lose
//     value fastest; counting them lets the operator catch spoilage
//     before it shows up in the variance report.
//
// Both are derived from the site's own item list so they stay
// site-specific (a hub kitchen's "high-value" set looks different to
// a coffee spoke's). The operator can add more groups at runtime from
// the Stocktake list; those live in client state only.

const PERISHABLE_CATEGORIES: ReadonlySet<StockCategory> = new Set<StockCategory>([
  'Dairy',
  'Produce',
  'Seafood',
  'Meat',
  'Prepared',
]);

function defaultGroupsFor(siteId: string, items: StockItem[]): ItemGroup[] {
  const highValueIds = items
    .filter(i => i.unitPrice !== null)
    .slice() // don't mutate the original list
    .sort((a, b) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0))
    .slice(0, 10)
    .map(i => i.id);

  const perishableIds = items
    .filter(i => PERISHABLE_CATEGORIES.has(i.category))
    .map(i => i.id);

  return [
    { id: `${siteId}-grp-high-value`, name: 'High-value items',  itemIds: highValueIds  },
    { id: `${siteId}-grp-perishables`, name: 'Perishables',      itemIds: perishableIds },
  ];
}

export const ESTATE_SITES: SiteStockSnapshot[] = [
  {
    siteId: 'fitzroy-espresso',
    siteName: 'Fitzroy Espresso',
    siteCaption: 'Hub kitchen',
    items: ESPRESSO_ITEMS,
    stocktakeHistory: ESPRESSO_HISTORY,
    itemGroups: defaultGroupsFor('fitzroy-espresso', ESPRESSO_ITEMS),
  },
  {
    siteId: 'fitzroy-kings-cross',
    siteName: "Fitzroy King's Cross",
    siteCaption: 'Commuter spoke',
    items: KINGS_CROSS_ITEMS,
    stocktakeHistory: KINGS_CROSS_HISTORY,
    itemGroups: defaultGroupsFor('fitzroy-kings-cross', KINGS_CROSS_ITEMS),
  },
  {
    siteId: 'fitzroy-heathrow',
    siteName: 'Fitzroy Heathrow',
    siteCaption: 'Hybrid airport site',
    items: HEATHROW_ITEMS,
    stocktakeHistory: HEATHROW_HISTORY,
    itemGroups: defaultGroupsFor('fitzroy-heathrow', HEATHROW_ITEMS),
  },
  {
    siteId: 'fitzroy-islington',
    siteName: 'Fitzroy Islington',
    siteCaption: 'Standalone site',
    items: ISLINGTON_ITEMS,
    stocktakeHistory: ISLINGTON_HISTORY,
    itemGroups: defaultGroupsFor('fitzroy-islington', ISLINGTON_ITEMS),
  },
];
