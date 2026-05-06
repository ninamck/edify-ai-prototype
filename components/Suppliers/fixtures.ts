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
 * The 12 sites used by the Agility supplier in the source screenshots. Real
 * estates would pull this from the org store; for the prototype we keep a
 * single shared list so the multi-select pill UX has something to work with.
 */
export const ALL_SITES: string[] = [
  'DXB CONCA PRET A MANGER',
  'DXB CONCD PRET A MANGER',
  'PRET A MANGER BAY AVENUE',
  'PRET A MANGER DIFC',
  'PRET A MANGER INDEX MALL',
  'PRET AVIATION COLLEGE C LOBBY',
  'PRET CATERING',
  'PRET DIC 24',
  'PRET EMAAR SQUARE',
  'PRET HUB KITCHEN',
  'PRET HUB STORE',
  'PRET ONE ZABEEL',
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

export type MasterProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  /** Canonical UoM the master product is described in (e.g. "1L", "500g"). */
  unit: string;
  /** Comma-free slug used as a stable lookup, e.g. 'whole-milk-1l'. */
  slug: string;
};

export const CURRENCY = 'DH';
export const formatPrice = (amount: number) =>
  `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY}`;

// ────────────────────────────────────────────────────────────────────────────
// Seed data

const ALL_AGILITY_SITES = [...ALL_SITES];

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
];

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
  { id: 'mp-whole-milk-1l', name: 'Whole Milk 1L', category: 'Dairy', unit: '1L carton', slug: 'whole-milk-1l' },
  { id: 'mp-skim-milk-1l', name: 'Skim Milk 1L', category: 'Dairy', unit: '1L carton', slug: 'skim-milk-1l' },
  { id: 'mp-oat-milk-1l', name: 'Oat Milk 1L', category: 'Dairy', unit: '1L carton', slug: 'oat-milk-1l' },
  { id: 'mp-tomato-sauce', name: 'Tomato Sauce 500ml', category: 'Pantry', unit: '500ml jar', slug: 'tomato-sauce' },
  { id: 'mp-bagel', name: 'Sourdough Bagel', category: 'Bakery', unit: 'each', slug: 'bagel' },
  { id: 'mp-espresso-blend', name: 'Espresso Blend Beans', category: 'Beverage', unit: '1kg bag', slug: 'espresso-blend' },
  { id: 'mp-smirnoff-vodka', name: 'Smirnoff Vodka 70cl', category: 'Beverage', unit: '70cl bottle', slug: 'smirnoff-vodka' },
  { id: 'mp-grey-goose-vodka', name: 'Grey Goose Vodka 70cl', category: 'Beverage', unit: '70cl bottle', slug: 'grey-goose-vodka' },
  { id: 'mp-tanqueray-gin', name: 'Tanqueray Gin 70cl', category: 'Beverage', unit: '70cl bottle', slug: 'tanqueray-gin' },
  { id: 'mp-coke', name: 'Coca-Cola 200ml mixer', category: 'Beverage', unit: '200ml can', slug: 'coke' },
  { id: 'mp-lemonade', name: 'Lemonade 200ml mixer', category: 'Beverage', unit: '200ml can', slug: 'lemonade' },
  { id: 'mp-tonic', name: 'Tonic Water 200ml', category: 'Beverage', unit: '200ml can', slug: 'tonic' },
  { id: 'mp-savvy-b', name: 'Marlborough Sauvignon Blanc', category: 'Beverage', unit: '750ml bottle', slug: 'savvy-b' },
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
    madeAtSite: 'PRET HUB KITCHEN',
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
    madeAtSite: 'PRET HUB KITCHEN',
    supplierCode: 'CPU-BAG-1',
    supplierId: 'sup-cpu',
    masterProductId: 'mp-bagel',
    productClass: 'Food',
    category: 'Bakery',
    packQty: 12,
    packCost: 14.40,
    singleUnitType: 'Each',
  }),
];
