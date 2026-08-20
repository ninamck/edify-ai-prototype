/**
 * Suppliers area — types + seed fixtures.
 *
 * Three entities:
 *   - Supplier        a vendor (Agility, Almarai, Bidvest…)
 *   - Product         a SKU sold by exactly one supplier
 *   - MasterProduct   a normalised cross-supplier item that aggregates SKUs
 *
 * Seed data is shaped to mirror the screenshots from the legacy admin so the
 * prototype can demo the same kinds of records (Agility carries 355 products
 * across 12 sites, Apple Fizz, Aluminium Foil Roll, etc.).
 */
import { isMultiCurrencyDemo } from '@/lib/demoConfig';
import type { CurrencyCode } from '@/lib/currency';

export type SupplierStatus = 'Available' | 'Unavailable' | 'Pending';
export type ProductClass = 'General' | 'Food' | 'Beverage' | 'Non-food';
export type ProductCategory =
  | 'Other'
  | 'Beverage'
  | 'Packaging'
  | 'Cleaning'
  | 'Dairy'
  | 'Bakery'
  | 'Produce'
  | 'Meat'
  | 'Seafood'
  | 'Pantry';

export type DayOfWeek =
  | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type Allergen =
  | 'Mustard' | 'Peanuts' | 'Crustaceans' | 'Fish' | 'Nuts'
  | 'Cereals containing gluten' | 'Molluscs'
  | 'Sesame Seeds' | 'Celery' | 'Lupin' | 'Soya' | 'Sulphites'
  | 'Eggs' | 'Dairy';

export const ALL_ALLERGENS: Allergen[] = [
  'Mustard', 'Peanuts', 'Crustaceans', 'Fish', 'Nuts',
  'Cereals containing gluten', 'Molluscs',
  'Sesame Seeds', 'Celery', 'Lupin', 'Soya', 'Sulphites',
  'Eggs', 'Dairy',
];

export const ALL_CATEGORIES: ProductCategory[] = [
  'Other', 'Beverage', 'Packaging', 'Cleaning',
  'Dairy', 'Bakery', 'Produce', 'Meat', 'Seafood', 'Pantry',
];

export const ALL_CLASSES: ProductClass[] = ['General', 'Food', 'Beverage', 'Non-food'];

/**
 * The sites the prototype actually runs on — the "Fitzroy" personas from the
 * top-bar site switcher (see components/ActiveSite/ActiveSiteContext.tsx) and
 * the production site picker. Kept in sync here so supplier/product/master site
 * pickers and the master-product cost table show the same estate the rest of
 * the app does (the receiving flow delivers against these names too).
 */
export const ALL_SITES: string[] = [
  'Fitzroy Espresso',
  "Fitzroy King's Cross",
  'Fitzroy Shoreditch',
  'Fitzroy Notting Hill',
  'Fitzroy Heathrow',
  'Fitzroy Gatwick',
  'Fitzroy Islington',
];

export type Supplier = {
  id: string;
  name: string;
  shortCode?: string;
  categories: ProductCategory[];
  sites: string[];
  status: SupplierStatus;
  email?: string;
  phone?: string;
  cutOffTime?: string;
  leadTimeDays?: number;
  /** In the supplier's transaction `currency`. */
  minimumOrderValue?: number;
  deliveryDays?: DayOfWeek[];
  /**
   * Transaction currency the supplier bills in (Supy-style per-supplier
   * currency, not per-account). Absent = the base/reporting currency (GBP).
   * Product packCosts for this supplier are held in this currency.
   */
  currency?: CurrencyCode;
  /**
   * Optional contracted FX rate into the base currency, overriding the daily
   * auto rate (e.g. a negotiated forward rate with the franchisor).
   * null/absent = use the daily rate.
   */
  fxContractRate?: number | null;
};

export type Nutrition = Partial<{
  energyKj: number;
  energyKcal: number;
  fat: number;
  saturates: number;
  carbs: number;
  totalSugar: number;
  protein: number;
  salt: number;
  fibre: number;
}>;

export type AltUom = { type: string; numberOfUnits: number };

/**
 * A Product is anything with SKU identity that can be bought, made,
 * counted, transferred or ordered. It has a `source`:
 *   - `supplier`  the company buys this from a vendor (carries `supplierId`)
 *   - `made`      the company produces this in-house (carries `recipeId`,
 *                 and optionally `madeAtSite` if a specific site/CPU
 *                 originates it; sister stores can then "buy" it from
 *                 the CPU the same way they buy supplier products)
 *
 * Both kinds can roll up into the same `MasterProduct`, which is the
 * cross-source normalisation. e.g. "Tomato sauce" Master can have
 * Bidvest's bottled sauce AND the CPU-made sauce both linked to it.
 */
export type ProductSource = 'supplier' | 'made';

export type Product = {
  id: string;
  name: string;
  /** What kind of Product this is. Defaults to 'supplier' for back-compat. */
  source?: ProductSource;
  /** Required when source === 'supplier'. */
  supplierId: string;
  /** Set when source === 'made' — the recipe that produces this Product. */
  recipeId?: string;
  /** Optional: site / CPU that originates a made Product. */
  madeAtSite?: string;
  /** Optional link to the cross-source reference SKU. */
  masterProductId?: string;
  supplierCode: string;
  productClass: ProductClass;
  category: ProductCategory;
  tags: string[];
  packType: 'Pack' | 'Single';
  packQty: number;
  /** When packType is 'Pack' allows split pack ordering. */
  allowSplitPack?: boolean;
  /** Force ordering by pack quantity multiples. */
  forceMultiples?: boolean;
  packCost: number;
  taxRatePct: number;
  singleUnitType: 'Each' | 'kg' | 'L' | 'g' | 'ml';
  singleUnitVolumeOrWeight?: number;
  unitOfMeasure?: string;
  excludeFromCogs?: boolean;
  useActualUseForTheoreticalCogs?: boolean;
  altUoms: AltUom[];
  allergensContains: Allergen[];
  allergensTraces: Allergen[];
  nutrition: Nutrition;
  sites: string[];
  status: SupplierStatus;
  /** When set, "needs attention" pill appears in the list. */
  flag?: { label: string } | null;
};

/**
 * Per-site weighted-average cost for a master product. Held in the master's
 * reference `unit` (e.g. cost per single egg). A site that has never received
 * a real purchase is simply absent from the `siteCosts` map and treated as
 * "Estimated (no purchases)" in the UI.
 */
export type MasterSiteCost = {
  /** Weighted-average cost per master `unit`, in GBP. */
  wac: number;
  /** Quantity on hand (in master `unit`s) used to weight the next delivery. */
  onHandQty: number;
  /** 'estimated' until a real purchase lands; otherwise a date / GRN string. */
  lastCalculated: 'estimated' | string;
};

export type MasterProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  /** Canonical UoM the master product is described in (e.g. "1L", "500g"). */
  unit: string;
  /** Comma-free slug used as a stable lookup, e.g. 'whole-milk-1l'. */
  slug: string;
  /** Optional product class shown in the master detail Basic Information. */
  productClass?: ProductClass;
  /** Lifecycle status surfaced on the master detail page. */
  status?: SupplierStatus;
  /** Per-site weighted-average cost, keyed by site name. Absent sites are
   *  treated as "estimated (no purchases)". Updated on delivery. */
  siteCosts?: Record<string, MasterSiteCost>;
  /** Linked supplier Product chosen as the default for ordering. */
  defaultProductId?: string;
};

/**
 * Quantity-weighted average WAC across the sites that have a recorded cost.
 * Returns null when no site has a real cost yet (so the UI can show a dash /
 * "estimated" rather than 0). Falls back to a simple mean if on-hand
 * quantities are all zero but WACs exist.
 */
export function masterCompanyAvg(m: MasterProduct): number | null {
  const entries = Object.values(m.siteCosts ?? {});
  if (entries.length === 0) return null;
  let totalQty = 0;
  let weighted = 0;
  for (const c of entries) {
    if (c.onHandQty > 0) {
      totalQty += c.onHandQty;
      weighted += c.onHandQty * c.wac;
    }
  }
  if (totalQty > 0) return weighted / totalQty;
  return entries.reduce((s, c) => s + c.wac, 0) / entries.length;
}

export const CURRENCY = '$';
export const formatPrice = (amount: number) =>
  `${CURRENCY}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ────────────────────────────────────────────────────────────────────────────
// Seed data

const ALL_AGILITY_SITES = [...ALL_SITES];

/**
 * Second Cup's Canadian supply base — the franchisor's central supply chain
 * that every international franchise orders from. Bills in CAD; the store
 * reports in GBP. Only present on the multi-currency demo build.
 */
const SECOND_CUP_SUPPLIER: Supplier = {
  id: 'sup-secondcup-central',
  name: 'Second Cup Central Supply (Canada)',
  shortCode: 'SC Central',
  categories: ['Beverage', 'Pantry', 'Packaging'],
  sites: ALL_SITES,
  status: 'Available',
  email: 'franchise.orders@secondcup.com',
  phone: '+1 905 362 1818',
  cutOffTime: '17:00',
  leadTimeDays: 10,
  minimumOrderValue: 1500, // CAD
  deliveryDays: ['Mon'],
  currency: 'CAD',
  fxContractRate: null,
};

export const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-agility',
    name: 'Agility',
    shortCode: 'Agility',
    categories: ['Other', 'Packaging', 'Cleaning', 'Beverage', 'Pantry'],
    sites: ALL_AGILITY_SITES,
    status: 'Available',
    email: 'orders@agility.ae',
    phone: '+971 4 555 0100',
    cutOffTime: '15:00',
    leadTimeDays: 2,
    minimumOrderValue: 250,
    deliveryDays: ['Mon', 'Wed', 'Fri'],
  },
  {
    id: 'sup-alaccad',
    name: 'AL ACCAD DEPARTMENT STORES',
    shortCode: 'AL ACCAD',
    categories: ['Other'],
    sites: ALL_AGILITY_SITES.slice(0, 14),
    status: 'Available',
    email: 'b2b@alaccad.ae',
    cutOffTime: '12:00',
    leadTimeDays: 3,
  },
  {
    id: 'sup-almajal',
    name: 'Al Majal Company LLC',
    categories: ['Cleaning'],
    sites: ALL_AGILITY_SITES.slice(0, 2),
    status: 'Available',
    cutOffTime: '14:00',
    leadTimeDays: 1,
  },
  {
    id: 'sup-almarai',
    name: 'ALMARAI EMIRATES COMPANY LLC',
    shortCode: 'Almarai',
    categories: ['Dairy'],
    sites: ALL_AGILITY_SITES.slice(0, 3),
    status: 'Available',
    cutOffTime: '06:00',
    leadTimeDays: 0,
    deliveryDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  {
    id: 'sup-alsalem',
    name: 'AL SALEM TRADING ENTERPRISES LLC',
    categories: ['Pantry'],
    sites: [],
    status: 'Pending',
    cutOffTime: '16:00',
    leadTimeDays: 5,
  },
  {
    id: 'sup-avanieco',
    name: 'AVANI ECO MIDDLE EAST FZ LLC',
    categories: ['Packaging'],
    sites: ALL_AGILITY_SITES,
    status: 'Available',
    cutOffTime: '13:00',
    leadTimeDays: 2,
  },
  // Plant-based dairy supplier — added so the product-swap wizard
  // has a credible existing-supplier path for the canonical oat-milk
  // demo (operator picks Oatly UAE from the typeahead rather than
  // typing it as a new supplier). Carries no products in the seed —
  // adding the first SKU is exactly what the wizard demos.
  {
    id: 'sup-oatly',
    name: 'OATLY UAE TRADING LLC',
    shortCode: 'Oatly UAE',
    categories: ['Dairy', 'Beverage'],
    sites: ALL_AGILITY_SITES.slice(0, 6),
    status: 'Available',
    email: 'orders@oatly.ae',
    phone: '+971 4 555 0218',
    cutOffTime: '11:00',
    leadTimeDays: 2,
    minimumOrderValue: 180,
    deliveryDays: ['Mon', 'Wed', 'Fri'],
  },
  {
    id: 'sup-bakemart',
    name: 'BAKEMART LLC',
    categories: ['Bakery'],
    sites: ALL_AGILITY_SITES.slice(0, 9),
    status: 'Available',
    cutOffTime: '04:00',
    leadTimeDays: 0,
    deliveryDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  {
    id: 'sup-baklawa',
    name: 'Baklawa Made Better',
    categories: ['Bakery'],
    sites: ALL_AGILITY_SITES.slice(0, 2),
    status: 'Available',
    cutOffTime: '08:00',
    leadTimeDays: 1,
  },
  {
    id: 'sup-barakat',
    name: 'BARAKAT QUALITY PLUS',
    categories: ['Produce', 'Beverage'],
    sites: ALL_AGILITY_SITES,
    status: 'Available',
    cutOffTime: '05:00',
    leadTimeDays: 0,
    deliveryDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  {
    id: 'sup-cpu',
    name: 'PRET HUB KITCHEN (CPU)',
    shortCode: 'CPU',
    categories: ['Bakery', 'Pantry', 'Other'],
    sites: ALL_AGILITY_SITES.slice(1),
    status: 'Available',
    cutOffTime: '20:00',
    leadTimeDays: 1,
    deliveryDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  {
    id: 'sup-barrick',
    name: 'BARRICK GENERAL TRADING LLC',
    categories: ['Other', 'Pantry'],
    sites: ALL_AGILITY_SITES.slice(0, 13),
    status: 'Available',
    cutOffTime: '15:30',
    leadTimeDays: 2,
  },
  // Meat suppliers used by the chat-driven "import product from sheet"
  // demo. Two pre-existing suppliers carry the Bacon master so the
  // sheet-import flow has something to anchor "matched to your existing
  // Bacon master · already has 2 suppliers" against.
  {
    id: 'sup-meatworks',
    name: 'Meatworks London',
    shortCode: 'Meatworks',
    categories: ['Meat'],
    sites: ALL_AGILITY_SITES.slice(0, 5),
    status: 'Available',
    email: 'orders@meatworks.london',
    phone: '+44 20 7946 0218',
    cutOffTime: '16:00',
    leadTimeDays: 1,
    deliveryDays: ['Tue', 'Thu', 'Sat'],
  },
  {
    id: 'sup-borough-butchery',
    name: 'Borough Butchery Co.',
    shortCode: 'Borough',
    categories: ['Meat'],
    sites: ALL_AGILITY_SITES.slice(0, 4),
    status: 'Available',
    email: 'trade@boroughbutchery.co.uk',
    cutOffTime: '15:00',
    leadTimeDays: 2,
    deliveryDays: ['Mon', 'Wed', 'Fri'],
  },
  // Second Cup build only: the CAD-billing franchisor supply base.
  ...(isMultiCurrencyDemo ? [SECOND_CUP_SUPPLIER] : []),
];

/** Shorthand for seeding a single calculated WAC (per master `unit`) at
 *  the flagship site, so recipe costing has a real per-unit cost to
 *  derive ingredient line costs from. Other sites stay "estimated". */
const wacAt = (wac: number, onHandQty = 20): Record<string, MasterSiteCost> => ({
  'Fitzroy Heathrow': { wac, onHandQty, lastCalculated: '24 Mar 2026' },
});

export const SEED_MASTER_PRODUCTS: MasterProduct[] = [
  { id: 'mp-foil-45', name: 'Aluminium Foil Roll 45cm', category: 'Other', unit: '150m roll', slug: 'foil-45' },
  { id: 'mp-apple-fizz', name: 'Apple Fizz', category: 'Beverage', unit: '330ml can', slug: 'apple-fizz' },
  { id: 'mp-allergy-sticker', name: 'Allergy Sticker', category: 'Other', unit: 'roll of 1000', slug: 'allergy-sticker' },
  { id: 'mp-chef-label-amber', name: 'Chef Label Amber', category: 'Other', unit: 'roll of 1000', slug: 'chef-amber' },
  { id: 'mp-chef-label-black', name: 'Chef Label Black', category: 'Other', unit: 'roll of 1000', slug: 'chef-black' },
  { id: 'mp-chef-label-red', name: 'Chef Label Red', category: 'Other', unit: 'roll of 1000', slug: 'chef-red' },
  { id: 'mp-bag-brownie', name: 'Bag Brownie', category: 'Packaging', unit: 'pack of 250', slug: 'bag-brownie' },
  { id: 'mp-bag-garbage-110', name: 'Bag Garbage Black 110x120cm', category: 'Cleaning', unit: 'pack of 50', slug: 'bag-garbage-110' },
  { id: 'mp-paper-carrier-large', name: 'Paper Carrier Bag — Large', category: 'Packaging', unit: 'pack of 250', slug: 'paper-carrier-large' },
  // Takeaway cup sizes — used by the Coffee size modifier group's
  // "Large" option to demonstrate Replace-on-packaging (the cup
  // physically swaps when the customer picks a large coffee).
  { id: 'mp-cup-takeaway-8oz',  name: 'Takeaway Cup 8oz',  category: 'Packaging', unit: 'pack of 1000', slug: 'cup-takeaway-8oz', siteCosts: wacAt(80.00, 3) },
  { id: 'mp-cup-takeaway-12oz', name: 'Takeaway Cup 12oz', category: 'Packaging', unit: 'pack of 1000', slug: 'cup-takeaway-12oz', siteCosts: wacAt(100.00, 3) },
  { id: 'mp-cup-takeaway-16oz', name: 'Takeaway Cup 16oz', category: 'Packaging', unit: 'pack of 1000', slug: 'cup-takeaway-16oz', siteCosts: wacAt(120.00, 2) },
  { id: 'mp-cup-lid',           name: 'Takeaway Cup Lid',  category: 'Packaging', unit: 'pack of 1000', slug: 'cup-lid', siteCosts: wacAt(30.00, 5) },
  { id: 'mp-whole-milk-1l', name: 'Whole Milk 1L', category: 'Dairy', unit: '1L carton', slug: 'whole-milk-1l', siteCosts: wacAt(2.20, 40) },
  { id: 'mp-skim-milk-1l', name: 'Skim Milk 1L', category: 'Dairy', unit: '1L carton', slug: 'skim-milk-1l', siteCosts: wacAt(2.00, 18) },
  { id: 'mp-oat-milk-1l', name: 'Oat Milk 1L', category: 'Dairy', unit: '1L carton', slug: 'oat-milk-1l', siteCosts: wacAt(3.00, 24) },
  { id: 'mp-tomato-sauce', name: 'Tomato Sauce 500ml', category: 'Pantry', unit: '500ml jar', slug: 'tomato-sauce' },
  { id: 'mp-bagel', name: 'Sourdough Bagel', category: 'Bakery', unit: 'each', slug: 'bagel', siteCosts: wacAt(0.55, 30) },
  { id: 'mp-espresso-blend', name: 'Espresso Blend Beans', category: 'Beverage', unit: '1kg bag', slug: 'espresso-blend', siteCosts: wacAt(25.00, 8) },
  { id: 'mp-smirnoff-vodka', name: 'Smirnoff Vodka 70cl', category: 'Beverage', unit: '70cl bottle', slug: 'smirnoff-vodka' },
  { id: 'mp-grey-goose-vodka', name: 'Grey Goose Vodka 70cl', category: 'Beverage', unit: '70cl bottle', slug: 'grey-goose-vodka' },
  { id: 'mp-tanqueray-gin', name: 'Tanqueray Gin 70cl', category: 'Beverage', unit: '70cl bottle', slug: 'tanqueray-gin' },
  { id: 'mp-coke', name: 'Coca-Cola 200ml mixer', category: 'Beverage', unit: '200ml can', slug: 'coke' },
  { id: 'mp-lemonade', name: 'Lemonade 200ml mixer', category: 'Beverage', unit: '200ml can', slug: 'lemonade' },
  { id: 'mp-tonic', name: 'Tonic Water 200ml', category: 'Beverage', unit: '200ml can', slug: 'tonic' },
  // Whole / finished drinks sold as-is on the POS (not mixers, not
  // recipe-built). These are the targets a whole-drink POS button matches
  // to so sales deplete the bottled/canned stock directly.
  { id: 'mp-sparkling-water-500', name: 'Sparkling Water 500ml', category: 'Beverage', unit: '500ml bottle', slug: 'sparkling-water-500', productClass: 'Beverage', status: 'Available' },
  { id: 'mp-still-water-500', name: 'Still Water 500ml', category: 'Beverage', unit: '500ml bottle', slug: 'still-water-500', productClass: 'Beverage', status: 'Available' },
  { id: 'mp-coca-cola-330', name: 'Coca-Cola 330ml', category: 'Beverage', unit: '330ml can', slug: 'coca-cola-330', productClass: 'Beverage', status: 'Available' },
  { id: 'mp-diet-coke-330', name: 'Diet Coke 330ml', category: 'Beverage', unit: '330ml can', slug: 'diet-coke-330', productClass: 'Beverage', status: 'Available' },
  { id: 'mp-orange-juice-250', name: 'Orange Juice 250ml', category: 'Beverage', unit: '250ml bottle', slug: 'orange-juice-250', productClass: 'Beverage', status: 'Available' },
  { id: 'mp-savvy-b', name: 'Marlborough Sauvignon Blanc', category: 'Beverage', unit: '750ml bottle', slug: 'savvy-b' },
  // Eggs master — reference unit is a single egg so SKUs of different pack
  // sizes (15pk, 30pk, …) blend into one weighted-average cost. One site
  // ('Fitzroy Heathrow') already has a real WAC; every other site shows
  // "Estimated" until a delivery lands there. The receiving flow's
  // alternative-product demo records a new SKU + WAC against the PO's site
  // ('Fitzroy Espresso'), flipping that row from estimated to calculated.
  {
    id: 'mp-eggs',
    name: 'Free Range Eggs',
    category: 'Produce',
    unit: 'egg',
    slug: 'free-range-eggs',
    productClass: 'Food',
    status: 'Available',
    defaultProductId: 'prd-barakat-eggs-15',
    siteCosts: {
      'Fitzroy Heathrow': { wac: 0.55, onHandQty: 150, lastCalculated: '24 Mar 2026' },
    },
  },
  // Bacon master — anchor for the chat-driven "import product from
  // sheet" demo. Two existing supplier products are linked below
  // (Meatworks London + Borough Butchery Co.) so when the user
  // uploads a third supplier's sheet via paperclip, the wizard can
  // say "matched to your existing Bacon master · already has 2
  // suppliers" rather than asking the user where it belongs.
  {
    id: 'mp-bacon',
    name: 'Bacon',
    category: 'Meat',
    unit: '1kg pack',
    slug: 'bacon',
    productClass: 'Food',
    status: 'Available',
    defaultProductId: 'prd-meatworks-bacon-1kg',
    siteCosts: wacAt(8.50, 6),
  },
  // ── Raspberry White Chocolate Pancakes (rec-rwc-pancakes) ──────────────
  // Masters referenced by the recipe's ingredientsV2 rows and by the
  // breakfast-side modifier groups in components/Modifiers/fixtures.ts.
  // Eggs (mp-eggs) and bacon (mp-bacon) above are reused as-is.
  { id: 'mp-pancake-batter', name: 'Buttermilk Pancake Batter', category: 'Bakery', unit: '5kg tub', slug: 'pancake-batter', productClass: 'Food', status: 'Available', siteCosts: wacAt(20.00, 4) },
  { id: 'mp-streusel-crumble', name: 'Streusel Crumble', category: 'Bakery', unit: '1kg tub', slug: 'streusel-crumble', productClass: 'Food', status: 'Available', siteCosts: wacAt(8.00, 6) },
  { id: 'mp-white-choc-chips', name: 'White Chocolate Chips', category: 'Pantry', unit: '1kg bag', slug: 'white-choc-chips', productClass: 'Food', status: 'Available', siteCosts: wacAt(12.00, 5) },
  { id: 'mp-raspberry-coulis', name: 'Raspberry Coulis (house-made)', category: 'Pantry', unit: '1L tub', slug: 'raspberry-coulis', productClass: 'Food', status: 'Available', siteCosts: wacAt(12.00, 3) },
  { id: 'mp-whipping-cream', name: 'Whipping Cream 1L', category: 'Dairy', unit: '1L carton', slug: 'whipping-cream', productClass: 'Food', status: 'Available', siteCosts: wacAt(5.00, 10) },
  { id: 'mp-fresh-mint', name: 'Fresh Mint', category: 'Produce', unit: '100g bunch', slug: 'fresh-mint', productClass: 'Food', status: 'Available', siteCosts: wacAt(6.50, 8) },
  { id: 'mp-sausage-patty', name: 'Breakfast Sausage Patties', category: 'Meat', unit: 'pack of 24', slug: 'sausage-patty', productClass: 'Food', status: 'Available', siteCosts: wacAt(10.80, 4) },
  { id: 'mp-andouille-sausage', name: 'Andouille Sausage', category: 'Meat', unit: '1kg pack', slug: 'andouille-sausage', productClass: 'Food', status: 'Available', siteCosts: wacAt(11.00, 5) },
  { id: 'mp-ham-sliced', name: 'Ham (sliced)', category: 'Meat', unit: '1kg pack', slug: 'ham-sliced', productClass: 'Food', status: 'Available', siteCosts: wacAt(9.00, 5) },
  { id: 'mp-chicken-sausage', name: 'Chicken Sausage', category: 'Meat', unit: '1kg pack', slug: 'chicken-sausage', productClass: 'Food', status: 'Available', siteCosts: wacAt(10.00, 5) },
  // ── Second Cup Central Supply (Canada) — multi-currency demo only ─────
  // WACs are in GBP (the base currency): CAD packCost × locked receipt rate.
  ...(isMultiCurrencyDemo
    ? ([
        { id: 'mp-espresso-forte', name: 'Espresso Forte whole bean',           category: 'Beverage', unit: '1kg bag', slug: 'espresso-forte', productClass: 'Beverage', status: 'Available', defaultProductId: 'prd-espresso-forte', siteCosts: wacAt(16.24, 14) },
        { id: 'mp-paradiso-medium', name: 'Paradiso medium roast (filter)',     category: 'Beverage', unit: '1kg bag', slug: 'paradiso-medium', productClass: 'Beverage', status: 'Available', defaultProductId: 'prd-paradiso-medium', siteCosts: wacAt(13.34, 10) },
        { id: 'mp-sc-vanilla-syrup', name: 'Second Cup vanilla syrup',          category: 'Pantry', unit: '1L bottle', slug: 'sc-vanilla-syrup', productClass: 'Food', status: 'Available', defaultProductId: 'prd-sc-vanilla-syrup', siteCosts: wacAt(6.09, 12) },
        { id: 'mp-sc-hot-cup-12', name: 'Branded hot cup + lid (12oz)',         category: 'Packaging', unit: 'pack of 1000', slug: 'sc-hot-cup-12', productClass: 'Non-food', status: 'Available', defaultProductId: 'prd-sc-hot-cup-12', siteCosts: wacAt(55.10, 5) },
      ] satisfies MasterProduct[])
    : []),
];

const blankNutrition: Nutrition = {};
const noAllergens: Allergen[] = [];

function p(over: Partial<Product> & { id: string; name: string; supplierCode: string }): Product {
  return {
    supplierId: 'sup-agility',
    productClass: 'General',
    category: 'Other',
    tags: [],
    packType: 'Pack',
    packQty: 1,
    packCost: 0,
    taxRatePct: 5,
    singleUnitType: 'Each',
    altUoms: [],
    allergensContains: noAllergens,
    allergensTraces: noAllergens,
    nutrition: blankNutrition,
    sites: ALL_AGILITY_SITES,
    status: 'Available',
    flag: null,
    ...over,
  };
}

export const SEED_PRODUCTS: Product[] = [
  p({
    id: 'prd-foil-45-150',
    name: 'Aluminium Foil Roll 45cmx150m',
    supplierCode: 'B068',
    masterProductId: 'mp-foil-45',
    packQty: 6,
    packCost: 225.00,
    excludeFromCogs: true,
  }),
  p({
    id: 'prd-apple-fizz-2019',
    name: 'Apple Fizz 2019',
    supplierCode: 'B112',
    masterProductId: 'mp-apple-fizz',
    productClass: 'Beverage',
    category: 'Beverage',
    packQty: 24,
    packCost: 105.39,
    singleUnitType: 'Each',
    singleUnitVolumeOrWeight: 0.33,
    unitOfMeasure: 'L',
  }),
  // ── Whole / finished drinks ─────────────────────────────────────────
  // Bottled water and canned soft drinks sold as-is. Tagged 'whole-drink'
  // so they read clearly as sellable finished products. They flow into the
  // POS item-matching candidate pool (MatchPicker + Sync & match) like any
  // other product, giving whole-drink POS buttons something to link to.
  p({
    id: 'prd-sparkling-water-500',
    name: 'Sparkling Water 500ml',
    supplierCode: 'B210',
    masterProductId: 'mp-sparkling-water-500',
    productClass: 'Beverage',
    category: 'Beverage',
    tags: ['whole-drink'],
    packQty: 24,
    packCost: 14.40,
    singleUnitType: 'Each',
    singleUnitVolumeOrWeight: 0.5,
    unitOfMeasure: 'L',
  }),
  p({
    id: 'prd-still-water-500',
    name: 'Still Water 500ml',
    supplierCode: 'B211',
    masterProductId: 'mp-still-water-500',
    productClass: 'Beverage',
    category: 'Beverage',
    tags: ['whole-drink'],
    packQty: 24,
    packCost: 12.00,
    singleUnitType: 'Each',
    singleUnitVolumeOrWeight: 0.5,
    unitOfMeasure: 'L',
  }),
  p({
    id: 'prd-coca-cola-330',
    name: 'Coca-Cola 330ml',
    supplierCode: 'B212',
    masterProductId: 'mp-coca-cola-330',
    productClass: 'Beverage',
    category: 'Beverage',
    tags: ['whole-drink'],
    packQty: 24,
    packCost: 18.00,
    singleUnitType: 'Each',
    singleUnitVolumeOrWeight: 0.33,
    unitOfMeasure: 'L',
  }),
  p({
    id: 'prd-diet-coke-330',
    name: 'Diet Coke 330ml',
    supplierCode: 'B213',
    masterProductId: 'mp-diet-coke-330',
    productClass: 'Beverage',
    category: 'Beverage',
    tags: ['whole-drink'],
    packQty: 24,
    packCost: 18.00,
    singleUnitType: 'Each',
    singleUnitVolumeOrWeight: 0.33,
    unitOfMeasure: 'L',
  }),
  p({
    id: 'prd-orange-juice-250',
    name: 'Orange Juice 250ml',
    supplierCode: 'B214',
    masterProductId: 'mp-orange-juice-250',
    productClass: 'Beverage',
    category: 'Beverage',
    tags: ['whole-drink'],
    packQty: 12,
    packCost: 15.00,
    singleUnitType: 'Each',
    singleUnitVolumeOrWeight: 0.25,
    unitOfMeasure: 'L',
  }),
  p({
    id: 'prd-arabic-allergy-sticker',
    name: 'Arabic Allergy Sticker',
    supplierCode: 'A001',
    masterProductId: 'mp-allergy-sticker',
    packQty: 1000,
    packCost: 19.02,
    singleUnitType: 'Each',
  }),
  p({
    id: 'prd-arabic-chef-amber',
    name: 'Arabic Label Amber Chefs At Work',
    supplierCode: 'A105',
    masterProductId: 'mp-chef-label-amber',
    packQty: 10,
    singleUnitVolumeOrWeight: 1000,
    unitOfMeasure: 'each',
    packCost: 150.78,
  }),
  p({
    id: 'prd-arabic-chef-black',
    name: 'Arabic Label Black Chef At Work',
    supplierCode: 'A106',
    masterProductId: 'mp-chef-label-black',
    packQty: 1000,
    packCost: 26.00,
  }),
  p({
    id: 'prd-arabic-chef-red',
    name: 'Arabic Label Red Chefs At Work',
    supplierCode: 'A107',
    masterProductId: 'mp-chef-label-red',
    packQty: 10,
    singleUnitVolumeOrWeight: 1000,
    unitOfMeasure: 'each',
    packCost: 150.78,
  }),
  p({
    id: 'prd-bag-brownie',
    name: 'Bag Brownie',
    supplierCode: 'P201',
    masterProductId: 'mp-bag-brownie',
    category: 'Packaging',
    packQty: 1,
    singleUnitVolumeOrWeight: 250,
    unitOfMeasure: 'each',
    packCost: 61.98,
  }),
  p({
    id: 'prd-bag-garbage-110',
    name: 'Bag Garbage Black 110x120cm',
    supplierCode: 'C314',
    masterProductId: 'mp-bag-garbage-110',
    category: 'Cleaning',
    packQty: 1,
    packCost: 100.00,
    sites: ALL_AGILITY_SITES.slice(0, 13),
  }),
  p({
    id: 'prd-bag-paper-large',
    name: 'Bag Large Paper Carrier',
    supplierCode: 'P208',
    masterProductId: 'mp-paper-carrier-large',
    category: 'Packaging',
    packQty: 250,
    packCost: 111.95,
  }),
  // A second supplier carrying a comparable SKU so master-product comparison
  // has something to render.
  p({
    id: 'prd-almarai-whole-milk',
    name: 'Almarai Full Cream Milk 1L',
    supplierCode: 'AM-FC-1L',
    supplierId: 'sup-almarai',
    masterProductId: 'mp-whole-milk-1l',
    productClass: 'Beverage',
    category: 'Dairy',
    packQty: 12,
    packCost: 84.00,
    singleUnitType: 'L',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'L',
    allergensContains: ['Dairy'],
    nutrition: { energyKcal: 65, fat: 3.6, saturates: 2.3, carbs: 4.7, totalSugar: 4.7, protein: 3.3, salt: 0.1 },
  }),
  p({
    id: 'prd-barakat-whole-milk',
    name: 'Whole Milk 1L (Barakat)',
    supplierCode: 'BK-MILK-1L',
    supplierId: 'sup-barakat',
    masterProductId: 'mp-whole-milk-1l',
    productClass: 'Beverage',
    category: 'Dairy',
    packQty: 12,
    packCost: 92.40,
    singleUnitType: 'L',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'L',
    allergensContains: ['Dairy'],
    flag: { label: 'Cost +8% vs Almarai' },
  }),
  // Eggs SKUs linked to the mp-eggs master. The 30pk is intentionally NOT
  // seeded — that's the alternative the supplier "sends" in the receiving
  // demo, which the user creates on the fly.
  p({
    id: 'prd-barakat-eggs-15',
    name: 'Free Range Eggs 15pk',
    supplierCode: 'BK-EGG-15',
    supplierId: 'sup-barakat',
    masterProductId: 'mp-eggs',
    productClass: 'Food',
    category: 'Produce',
    packType: 'Pack',
    packQty: 15,
    packCost: 8.00,
    singleUnitType: 'Each',
    allergensContains: ['Eggs'],
  }),
  p({
    id: 'prd-agility-eggs-10',
    name: 'Free Range Eggs 10pk',
    supplierCode: 'EGG-10',
    supplierId: 'sup-agility',
    masterProductId: 'mp-eggs',
    productClass: 'Food',
    category: 'Produce',
    packType: 'Pack',
    packQty: 10,
    packCost: 5.80,
    singleUnitType: 'Each',
    allergensContains: ['Eggs'],
  }),
  p({
    id: 'prd-almarai-skim-milk',
    name: 'Almarai Skimmed Milk 1L',
    supplierCode: 'AM-SK-1L',
    supplierId: 'sup-almarai',
    masterProductId: 'mp-skim-milk-1l',
    productClass: 'Beverage',
    category: 'Dairy',
    packQty: 12,
    packCost: 80.40,
    singleUnitType: 'L',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'L',
    allergensContains: ['Dairy'],
  }),
  // Two pre-existing Bacon supplier products that link to the
  // `mp-bacon` master. The chat-driven sheet-import flow adds a 3rd.
  p({
    id: 'prd-meatworks-bacon-1kg',
    name: 'Meatworks Streaky Bacon 1kg',
    supplierCode: 'MW-BAC-STK-1KG',
    supplierId: 'sup-meatworks',
    masterProductId: 'mp-bacon',
    productClass: 'Food',
    category: 'Meat',
    packType: 'Pack',
    packQty: 6,
    packCost: 32.40,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
    allergensContains: ['Sulphites'],
    sites: ALL_AGILITY_SITES.slice(0, 5),
  }),
  p({
    id: 'prd-borough-bacon-1kg',
    name: 'Borough Smoked Bacon Lardons 1kg',
    supplierCode: 'BB-LARD-1KG',
    supplierId: 'sup-borough-butchery',
    masterProductId: 'mp-bacon',
    productClass: 'Food',
    category: 'Meat',
    packType: 'Pack',
    packQty: 8,
    packCost: 51.20,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
    allergensContains: ['Sulphites'],
    sites: ALL_AGILITY_SITES.slice(0, 4),
  }),
  // ── In-house / CPU-made Products ───────────────────────────────────────────
  // These are produced from recipes, then dispatched to spoke stores. From a
  // spoke's perspective they look like any other Product in the catalogue —
  // they can be ordered, counted, used as recipe ingredients. The `source`
  // field is what distinguishes them.
  p({
    id: 'prd-cpu-tomato-sauce',
    name: 'House Tomato Sauce 500ml (CPU)',
    source: 'made',
    recipeId: 'rec-cpu-tomato-sauce',
    madeAtSite: 'Fitzroy Espresso',
    supplierCode: 'CPU-TS-500',
    supplierId: 'sup-cpu',
    masterProductId: 'mp-tomato-sauce',
    productClass: 'Food',
    category: 'Pantry',
    packQty: 1,
    packCost: 8.50,
    singleUnitType: 'ml',
    singleUnitVolumeOrWeight: 500,
    unitOfMeasure: 'ml',
  }),
  p({
    id: 'prd-cpu-bagel',
    name: 'Sourdough Bagel (CPU bake)',
    source: 'made',
    recipeId: 'rec-cpu-bagel',
    madeAtSite: 'Fitzroy Espresso',
    supplierCode: 'CPU-BAG-1',
    supplierId: 'sup-cpu',
    masterProductId: 'mp-bagel',
    productClass: 'Food',
    category: 'Bakery',
    packQty: 12,
    packCost: 14.40,
    singleUnitType: 'Each',
  }),
  // ── Second Cup Central Supply (Canada) — multi-currency demo only ──────
  // packCost is in the supplier's currency (CAD); UI converts to GBP for
  // dual display using the daily rate (or the rate locked at receipt).
  ...(isMultiCurrencyDemo
    ? [
        p({
          id: 'prd-espresso-forte',
          name: 'Espresso Forte Whole Bean 1kg',
          supplierCode: 'SC-ESP-1KG',
          supplierId: 'sup-secondcup-central',
          masterProductId: 'mp-espresso-forte',
          productClass: 'Beverage',
          category: 'Beverage',
          packType: 'Pack',
          packQty: 6,
          packCost: 168.0, // CAD
          singleUnitType: 'kg',
          singleUnitVolumeOrWeight: 1,
          unitOfMeasure: 'kg',
          taxRatePct: 0,
        }),
        p({
          id: 'prd-paradiso-medium',
          name: 'Paradiso Medium Roast (Filter) 1kg',
          supplierCode: 'SC-PAR-1KG',
          supplierId: 'sup-secondcup-central',
          masterProductId: 'mp-paradiso-medium',
          productClass: 'Beverage',
          category: 'Beverage',
          packType: 'Pack',
          packQty: 6,
          packCost: 138.0, // CAD
          singleUnitType: 'kg',
          singleUnitVolumeOrWeight: 1,
          unitOfMeasure: 'kg',
          taxRatePct: 0,
        }),
        p({
          id: 'prd-sc-vanilla-syrup',
          name: 'Second Cup Vanilla Syrup 1L',
          supplierCode: 'SC-VAN-1L',
          supplierId: 'sup-secondcup-central',
          masterProductId: 'mp-sc-vanilla-syrup',
          productClass: 'Food',
          category: 'Pantry',
          packType: 'Pack',
          packQty: 6,
          packCost: 63.0, // CAD
          singleUnitType: 'L',
          singleUnitVolumeOrWeight: 1,
          unitOfMeasure: 'L',
        }),
        p({
          id: 'prd-sc-hot-cup-12',
          name: 'Branded Hot Cup + Lid 12oz',
          supplierCode: 'SC-CUP-12OZ',
          supplierId: 'sup-secondcup-central',
          masterProductId: 'mp-sc-hot-cup-12',
          productClass: 'Non-food',
          category: 'Packaging',
          packType: 'Pack',
          packQty: 1,
          packCost: 95.0, // CAD
          singleUnitType: 'Each',
          singleUnitVolumeOrWeight: 1000,
          unitOfMeasure: 'each',
          excludeFromCogs: true,
        }),
      ]
    : []),
];
