/**
 * Suppliers area — types + seed fixtures.
 *
 * Three entities:
 *   - Supplier        a vendor (CHAGEE Tea Supply Co., Fresh Dairy Direct…)
 *   - Product         a SKU sold by exactly one supplier
 *   - MasterProduct   a normalised cross-supplier item that aggregates SKUs
 *
 * For this single-client demo build the seed data describes the CHAGEE UK
 * flagship tea house: loose-leaf teas, fresh milk, bubble-tea toppings,
 * syrups/purées and sealed cups — one SKU per tea master, mapped to the
 * right supplier, mirroring the CHAGEE_INGREDIENTS in
 * components/Production/chageeFixtures.ts.
 */
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
  'CHAGEE — Flagship',
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
  minimumOrderValue?: number;
  deliveryDays?: DayOfWeek[];
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

export const CURRENCY = '£';
export const formatPrice = (amount: number) =>
  `${CURRENCY}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ────────────────────────────────────────────────────────────────────────────
// Seed data

const ALL_CHAGEE_SITES = [...ALL_SITES];

export const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-chagee-tea',
    name: 'CHAGEE Tea Supply Co.',
    shortCode: 'CHAGEE Tea',
    categories: ['Beverage', 'Pantry'],
    sites: ALL_CHAGEE_SITES,
    status: 'Available',
    email: 'orders@chageeteasupply.com',
    phone: '+44 20 7946 0110',
    cutOffTime: '15:00',
    leadTimeDays: 3,
    minimumOrderValue: 250,
    deliveryDays: ['Mon', 'Thu'],
  },
  {
    id: 'sup-fresh-dairy',
    name: 'Fresh Dairy Direct',
    shortCode: 'Fresh Dairy',
    categories: ['Dairy'],
    sites: ALL_CHAGEE_SITES,
    status: 'Available',
    email: 'orders@freshdairydirect.co.uk',
    phone: '+44 20 7946 0122',
    cutOffTime: '06:00',
    leadTimeDays: 0,
    minimumOrderValue: 60,
    deliveryDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  {
    id: 'sup-bubble-toppings',
    name: 'Bubble Toppings Ltd',
    shortCode: 'Bubble Toppings',
    categories: ['Pantry'],
    sites: ALL_CHAGEE_SITES,
    status: 'Available',
    email: 'sales@bubbletoppings.co.uk',
    phone: '+44 20 7946 0134',
    cutOffTime: '14:00',
    leadTimeDays: 2,
    minimumOrderValue: 120,
    deliveryDays: ['Tue', 'Fri'],
  },
  {
    id: 'sup-monin',
    name: 'Monin Syrups UK',
    shortCode: 'Monin',
    categories: ['Pantry', 'Produce'],
    sites: ALL_CHAGEE_SITES,
    status: 'Available',
    email: 'trade@monin.co.uk',
    phone: '+44 20 7946 0146',
    cutOffTime: '13:00',
    leadTimeDays: 3,
    minimumOrderValue: 150,
    deliveryDays: ['Wed'],
  },
  {
    id: 'sup-packaging-solutions',
    name: 'Packaging Solutions Ltd',
    shortCode: 'Packaging Solutions',
    categories: ['Packaging'],
    sites: ALL_CHAGEE_SITES,
    status: 'Available',
    email: 'orders@packagingsolutions.co.uk',
    phone: '+44 20 7946 0158',
    cutOffTime: '12:00',
    leadTimeDays: 5,
    minimumOrderValue: 200,
    deliveryDays: ['Mon'],
  },
];

/** Shorthand for seeding a single calculated WAC (per master `unit`) at
 *  the flagship site, so recipe costing has a real per-unit cost to
 *  derive ingredient line costs from. Other sites stay "estimated". */
const wacAt = (wac: number, onHandQty = 20): Record<string, MasterSiteCost> => ({
  'CHAGEE — Flagship': { wac, onHandQty, lastCalculated: '24 Mar 2026' },
});

export const SEED_MASTER_PRODUCTS: MasterProduct[] = [
  // ── Loose-leaf teas (from CHAGEE Tea Supply Co.) ──────────────────────
  // Align 1:1 with the CHAGEE_INGREDIENTS tea leaves in
  // components/Production/chageeFixtures.ts.
  { id: 'mp-jasmine-green-leaf', name: 'Jasmine green tea leaf',                 category: 'Beverage', unit: '1kg bag', slug: 'jasmine-green-leaf', productClass: 'Beverage', status: 'Available', defaultProductId: 'prd-jasmine-green-leaf', siteCosts: wacAt(42.00, 12) },
  { id: 'mp-orchid-oolong-leaf', name: 'Orchid oolong (Bai Ya Qi Lan) leaf',     category: 'Beverage', unit: '1kg bag', slug: 'orchid-oolong-leaf', productClass: 'Beverage', status: 'Available', defaultProductId: 'prd-orchid-oolong-leaf', siteCosts: wacAt(58.00, 8) },
  { id: 'mp-roasted-oolong-leaf', name: 'Roasted oolong leaf',                   category: 'Beverage', unit: '1kg bag', slug: 'roasted-oolong-leaf', productClass: 'Beverage', status: 'Available', defaultProductId: 'prd-roasted-oolong-leaf', siteCosts: wacAt(50.00, 8) },
  { id: 'mp-bold-black-leaf', name: 'Bold black tea leaf',                       category: 'Beverage', unit: '1kg bag', slug: 'bold-black-leaf', productClass: 'Beverage', status: 'Available', defaultProductId: 'prd-bold-black-leaf', siteCosts: wacAt(38.00, 10) },
  { id: 'mp-aged-puer-leaf', name: "Aged pu'er leaf",                            category: 'Beverage', unit: '1kg bag', slug: 'aged-puer-leaf', productClass: 'Beverage', status: 'Available', defaultProductId: 'prd-aged-puer-leaf', siteCosts: wacAt(72.00, 5) },
  // ── Dairy (from Fresh Dairy Direct) ───────────────────────────────────
  { id: 'mp-whole-milk-2l', name: 'Fresh whole milk (2L)',                       category: 'Dairy', unit: '2L bottle', slug: 'whole-milk-2l', productClass: 'Beverage', status: 'Available', defaultProductId: 'prd-whole-milk-2l', siteCosts: wacAt(1.60, 40) },
  // ── Toppings (from Bubble Toppings Ltd) ───────────────────────────────
  { id: 'mp-tapioca-pearls', name: 'Tapioca pearls (dry)',                       category: 'Pantry', unit: '3kg bag', slug: 'tapioca-pearls', productClass: 'Food', status: 'Available', defaultProductId: 'prd-tapioca-pearls', siteCosts: wacAt(14.00, 20) },
  { id: 'mp-adzuki-red-beans', name: 'Adzuki red beans',                         category: 'Pantry', unit: '5kg bag', slug: 'adzuki-red-beans', productClass: 'Food', status: 'Available', defaultProductId: 'prd-adzuki-red-beans', siteCosts: wacAt(18.00, 8) },
  { id: 'mp-grass-jelly-powder', name: 'Grass jelly powder',                     category: 'Pantry', unit: '1kg tub', slug: 'grass-jelly-powder', productClass: 'Food', status: 'Available', defaultProductId: 'prd-grass-jelly-powder', siteCosts: wacAt(11.00, 6) },
  // ── Syrups & purées (from Monin Syrups UK) ────────────────────────────
  { id: 'mp-brown-sugar-syrup', name: 'Brown sugar syrup',                       category: 'Pantry', unit: '2L bottle', slug: 'brown-sugar-syrup', productClass: 'Food', status: 'Available', defaultProductId: 'prd-brown-sugar-syrup', siteCosts: wacAt(9.50, 15) },
  { id: 'mp-peach-puree', name: 'Peach purée',                                   category: 'Produce', unit: '1L bottle', slug: 'peach-puree', productClass: 'Food', status: 'Available', defaultProductId: 'prd-peach-puree', siteCosts: wacAt(7.20, 10) },
  { id: 'mp-ruby-grapefruit', name: 'Ruby grapefruit',                           category: 'Produce', unit: '5kg case', slug: 'ruby-grapefruit', productClass: 'Food', status: 'Available', defaultProductId: 'prd-ruby-grapefruit', siteCosts: wacAt(16.00, 6) },
  { id: 'mp-lychee-puree', name: 'Lychee purée',                                 category: 'Produce', unit: '1L bottle', slug: 'lychee-puree', productClass: 'Food', status: 'Available', defaultProductId: 'prd-lychee-puree', siteCosts: wacAt(8.40, 8) },
  // ── Packaging (from Packaging Solutions Ltd) ──────────────────────────
  { id: 'mp-sealed-cup-500', name: 'Sealed cup + lid (500ml)',                   category: 'Packaging', unit: 'pack of 1000', slug: 'sealed-cup-500', productClass: 'Non-food', status: 'Available', defaultProductId: 'prd-sealed-cup-500', siteCosts: wacAt(65.00, 4) },
];

const blankNutrition: Nutrition = {};
const noAllergens: Allergen[] = [];

function p(over: Partial<Product> & { id: string; name: string; supplierCode: string }): Product {
  return {
    supplierId: 'sup-chagee-tea',
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
    sites: ALL_CHAGEE_SITES,
    status: 'Available',
    flag: null,
    ...over,
  };
}

export const SEED_PRODUCTS: Product[] = [
  // ── Loose-leaf teas (CHAGEE Tea Supply Co.) ───────────────────────────
  p({
    id: 'prd-jasmine-green-leaf',
    name: 'Jasmine Green Tea Leaf 1kg',
    supplierCode: 'CT-JAS-1KG',
    supplierId: 'sup-chagee-tea',
    masterProductId: 'mp-jasmine-green-leaf',
    productClass: 'Beverage',
    category: 'Beverage',
    packType: 'Pack',
    packQty: 10,
    packCost: 420.00,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
  }),
  p({
    id: 'prd-orchid-oolong-leaf',
    name: 'Orchid Oolong (Bai Ya Qi Lan) Leaf 1kg',
    supplierCode: 'CT-OOL-1KG',
    supplierId: 'sup-chagee-tea',
    masterProductId: 'mp-orchid-oolong-leaf',
    productClass: 'Beverage',
    category: 'Beverage',
    packType: 'Pack',
    packQty: 10,
    packCost: 580.00,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
  }),
  p({
    id: 'prd-roasted-oolong-leaf',
    name: 'Roasted Oolong Leaf 1kg',
    supplierCode: 'CT-ROL-1KG',
    supplierId: 'sup-chagee-tea',
    masterProductId: 'mp-roasted-oolong-leaf',
    productClass: 'Beverage',
    category: 'Beverage',
    packType: 'Pack',
    packQty: 10,
    packCost: 500.00,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
  }),
  p({
    id: 'prd-bold-black-leaf',
    name: 'Bold Black Tea Leaf 1kg',
    supplierCode: 'CT-BLK-1KG',
    supplierId: 'sup-chagee-tea',
    masterProductId: 'mp-bold-black-leaf',
    productClass: 'Beverage',
    category: 'Beverage',
    packType: 'Pack',
    packQty: 10,
    packCost: 380.00,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
  }),
  p({
    id: 'prd-aged-puer-leaf',
    name: "Aged Pu'er Leaf 1kg",
    supplierCode: 'CT-PUE-1KG',
    supplierId: 'sup-chagee-tea',
    masterProductId: 'mp-aged-puer-leaf',
    productClass: 'Beverage',
    category: 'Beverage',
    packType: 'Pack',
    packQty: 5,
    packCost: 360.00,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
  }),
  // ── Fresh milk (Fresh Dairy Direct) ───────────────────────────────────
  p({
    id: 'prd-whole-milk-2l',
    name: 'Fresh Whole Milk 2L',
    supplierCode: 'FD-WM-2L',
    supplierId: 'sup-fresh-dairy',
    masterProductId: 'mp-whole-milk-2l',
    productClass: 'Beverage',
    category: 'Dairy',
    packType: 'Pack',
    packQty: 6,
    packCost: 9.60,
    singleUnitType: 'L',
    singleUnitVolumeOrWeight: 2,
    unitOfMeasure: 'L',
    taxRatePct: 0,
    allergensContains: ['Dairy'],
    nutrition: { energyKcal: 65, fat: 3.6, saturates: 2.3, carbs: 4.7, totalSugar: 4.7, protein: 3.3, salt: 0.1 },
  }),
  // ── Toppings (Bubble Toppings Ltd) ────────────────────────────────────
  p({
    id: 'prd-tapioca-pearls',
    name: 'Tapioca Pearls (dry) 3kg',
    supplierCode: 'BT-TAP-3KG',
    supplierId: 'sup-bubble-toppings',
    masterProductId: 'mp-tapioca-pearls',
    productClass: 'Food',
    category: 'Pantry',
    packType: 'Pack',
    packQty: 4,
    packCost: 56.00,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 3,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
  }),
  p({
    id: 'prd-adzuki-red-beans',
    name: 'Adzuki Red Beans 5kg',
    supplierCode: 'BT-ADZ-5KG',
    supplierId: 'sup-bubble-toppings',
    masterProductId: 'mp-adzuki-red-beans',
    productClass: 'Food',
    category: 'Pantry',
    packType: 'Pack',
    packQty: 4,
    packCost: 72.00,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 5,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
  }),
  p({
    id: 'prd-grass-jelly-powder',
    name: 'Grass Jelly Powder 1kg',
    supplierCode: 'BT-GJP-1KG',
    supplierId: 'sup-bubble-toppings',
    masterProductId: 'mp-grass-jelly-powder',
    productClass: 'Food',
    category: 'Pantry',
    packType: 'Pack',
    packQty: 6,
    packCost: 66.00,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
  }),
  // ── Syrups & purées (Monin Syrups UK) ─────────────────────────────────
  p({
    id: 'prd-brown-sugar-syrup',
    name: 'Brown Sugar Syrup 2L',
    supplierCode: 'MN-BSS-2L',
    supplierId: 'sup-monin',
    masterProductId: 'mp-brown-sugar-syrup',
    productClass: 'Food',
    category: 'Pantry',
    packType: 'Pack',
    packQty: 6,
    packCost: 57.00,
    singleUnitType: 'L',
    singleUnitVolumeOrWeight: 2,
    unitOfMeasure: 'L',
  }),
  p({
    id: 'prd-peach-puree',
    name: 'Peach Purée 1L',
    supplierCode: 'MN-PCH-1L',
    supplierId: 'sup-monin',
    masterProductId: 'mp-peach-puree',
    productClass: 'Food',
    category: 'Produce',
    packType: 'Pack',
    packQty: 6,
    packCost: 43.20,
    singleUnitType: 'L',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'L',
  }),
  p({
    id: 'prd-ruby-grapefruit',
    name: 'Ruby Grapefruit 5kg case',
    supplierCode: 'MN-GRF-5KG',
    supplierId: 'sup-monin',
    masterProductId: 'mp-ruby-grapefruit',
    productClass: 'Food',
    category: 'Produce',
    packType: 'Pack',
    packQty: 1,
    packCost: 16.00,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 5,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
  }),
  p({
    id: 'prd-lychee-puree',
    name: 'Lychee Purée 1L',
    supplierCode: 'MN-LYC-1L',
    supplierId: 'sup-monin',
    masterProductId: 'mp-lychee-puree',
    productClass: 'Food',
    category: 'Produce',
    packType: 'Pack',
    packQty: 6,
    packCost: 50.40,
    singleUnitType: 'L',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'L',
  }),
  // ── Packaging (Packaging Solutions Ltd) ───────────────────────────────
  p({
    id: 'prd-sealed-cup-500',
    name: 'Sealed Cup + Lid 500ml',
    supplierCode: 'PS-CUP-500',
    supplierId: 'sup-packaging-solutions',
    masterProductId: 'mp-sealed-cup-500',
    productClass: 'Non-food',
    category: 'Packaging',
    packType: 'Pack',
    packQty: 1,
    packCost: 65.00,
    singleUnitType: 'Each',
    singleUnitVolumeOrWeight: 1000,
    unitOfMeasure: 'each',
    excludeFromCogs: true,
  }),
];
