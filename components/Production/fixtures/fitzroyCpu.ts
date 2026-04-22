import type {
  Bench,
  CapabilityTag,
  DemandLine,
  DispatchManifest,
  Grn,
  MadeOutput,
  PcrCheck,
  PickListLine,
  Product,
  ProductionRun,
  Range,
  SalesTick,
  Site,
  SiteClassificationRule,
  Supplier,
  SupplierProduct,
  Tier,
} from '../productionStore';

// Scenario: Fitzroy Espresso expands with a central production unit
// (Fitzroy Kitchen, Collingwood) that bakes, preps, and dispatches to
// four coffee-shop spokes. Seeded data covers "today" (2026-04-22, a
// Wednesday) for the Demand Dashboard + Planner screens.

export const TODAY = '2026-04-22';
const iso = (time: string) => `${TODAY}T${time}:00+11:00`;

// ---------- Sites ----------

const SITES: Site[] = [
  {
    id: 'site-cpu',
    name: 'Fitzroy Kitchen',
    address: '32 Easey St, Collingwood VIC',
    kind: 'hub',
    classification: 'high',
    tierAssignments: {},
  },
  {
    id: 'site-fitzroy',
    name: 'Fitzroy Espresso',
    address: '210 Brunswick St, Fitzroy VIC',
    kind: 'spoke',
    classification: 'high',
    tierAssignments: {
      monday: 'tier-weekday-full',
      tuesday: 'tier-weekday-full',
      wednesday: 'tier-weekday-full',
      thursday: 'tier-weekday-full',
      friday: 'tier-weekday-full',
      saturday: 'tier-weekend-brunch',
      sunday: 'tier-weekend-brunch',
    },
  },
  {
    id: 'site-carlton',
    name: 'Carlton Espresso',
    address: '118 Lygon St, Carlton VIC',
    kind: 'spoke',
    classification: 'medium',
    tierAssignments: {
      monday: 'tier-weekday-full',
      tuesday: 'tier-weekday-full',
      wednesday: 'tier-weekday-full',
      thursday: 'tier-weekday-full',
      friday: 'tier-weekday-full',
      saturday: 'tier-weekend-brunch',
      sunday: 'tier-weekend-brunch',
    },
  },
  {
    id: 'site-richmond',
    name: 'Richmond Espresso',
    address: '401 Swan St, Richmond VIC',
    kind: 'spoke',
    classification: 'medium',
    tierAssignments: {
      monday: 'tier-weekday-light',
      tuesday: 'tier-weekday-light',
      wednesday: 'tier-weekday-light',
      thursday: 'tier-weekday-full',
      friday: 'tier-weekday-full',
      saturday: 'tier-weekend-brunch',
      sunday: 'tier-weekend-brunch',
    },
  },
  {
    id: 'site-sthyarra',
    name: 'South Yarra Espresso',
    address: '506 Chapel St, South Yarra VIC',
    kind: 'spoke',
    classification: 'low',
    tierAssignments: {
      monday: 'tier-weekday-light',
      tuesday: 'tier-weekday-light',
      wednesday: 'tier-weekday-light',
      thursday: 'tier-weekday-light',
      friday: 'tier-weekday-full',
      saturday: 'tier-weekend-brunch',
      sunday: 'tier-weekend-brunch',
    },
  },
];

// ---------- Capability tags ----------

const CAPABILITY_TAGS: CapabilityTag[] = [
  { id: 'cap-cold-prep', name: 'Cold prep', description: 'Cold sandwich builds, salads, cold-brew dilution.' },
  { id: 'cap-bake', name: 'Bake', description: 'Oven work — muffins, traybakes, croissants, friands.' },
  { id: 'cap-assembly', name: 'Assembly', description: 'Wrapping, stickering, portioning, pot-filling.' },
  { id: 'cap-hot-line', name: 'Hot line', description: 'Hot food prep — toasties, savoury bakes.' },
  { id: 'cap-wash-down', name: 'Wash-down', description: 'Bench clean between capability changes.' },
];

// ---------- Benches (all at the CPU for now) ----------

const BENCHES: Bench[] = [
  {
    id: 'bench-cold-prep',
    name: 'Cold Prep Bench',
    siteId: 'site-cpu',
    capabilityTagIds: ['cap-cold-prep', 'cap-assembly'],
    capacityPerHour: 48,
    activeHours: { start: '04:00', end: '12:00' },
  },
  {
    id: 'bench-bake',
    name: 'Bake Oven',
    siteId: 'site-cpu',
    capabilityTagIds: ['cap-bake'],
    capacityPerHour: 96,
    activeHours: { start: '03:30', end: '11:00' },
  },
  {
    id: 'bench-assembly',
    name: 'Assembly Line',
    siteId: 'site-cpu',
    capabilityTagIds: ['cap-assembly', 'cap-cold-prep'],
    capacityPerHour: 72,
    activeHours: { start: '05:00', end: '13:00' },
  },
  {
    id: 'bench-hot',
    name: 'Hot Line',
    siteId: 'site-cpu',
    capabilityTagIds: ['cap-hot-line'],
    capacityPerHour: 36,
    activeHours: { start: '05:30', end: '11:30' },
  },
];

// ---------- Suppliers ----------

const SUPPLIERS: Supplier[] = [
  { id: 'sup-spp', name: 'SPP Organics', leadTimeDays: 2 },
  { id: 'sup-fitzroy-dairy', name: 'Fitzroy Dairy Co.', leadTimeDays: 1 },
  { id: 'sup-schulz', name: 'Schulz Organic', leadTimeDays: 2 },
  { id: 'sup-koko', name: 'KOKO Dairy Free', leadTimeDays: 3 },
  { id: 'sup-greenpark', name: 'Green Park Eggs', leadTimeDays: 2 },
  { id: 'sup-sanpell', name: 'San Pellegrino', leadTimeDays: 5 },
  { id: 'sup-mountaingoat', name: 'Mountain Goat Kombucha', leadTimeDays: 3 },
  { id: 'sup-noisette', name: 'Noisette Bakehouse', leadTimeDays: 1 },
  { id: 'sup-redrock', name: 'Red Rock Deli', leadTimeDays: 4 },
  { id: 'sup-koalacola', name: 'Coca-Cola Amatil', leadTimeDays: 4 },
];

// ---------- Supplier products (ingredients + stocked items) ----------

const SUPPLIER_PRODUCTS: SupplierProduct[] = [
  // Ingredients — not exposed as Products directly, used by recipes.
  { id: 'spp-flour', supplierId: 'sup-spp', name: 'Organic plain flour 25kg', pack: '25kg sack', unitCost: 48.0, onHand: 4, parLevel: 3, temperatureZone: 'ambient' },
  { id: 'spp-sugar', supplierId: 'sup-spp', name: 'Raw caster sugar 25kg', pack: '25kg sack', unitCost: 52.0, onHand: 3, parLevel: 2, temperatureZone: 'ambient' },
  { id: 'spp-cocoa', supplierId: 'sup-spp', name: 'Dark cocoa powder 1kg', pack: '1kg pouch', unitCost: 18.5, onHand: 6, parLevel: 4, temperatureZone: 'ambient' },
  { id: 'fd-milk', supplierId: 'sup-fitzroy-dairy', name: 'Whole milk 2L', pack: '2L bottle', unitCost: 3.2, onHand: 32, parLevel: 20, temperatureZone: 'chilled' },
  { id: 'schulz-buttermilk', supplierId: 'sup-schulz', name: 'Schulz buttermilk 1L', pack: '1L bottle', unitCost: 5.4, onHand: 12, parLevel: 8, temperatureZone: 'chilled' },
  { id: 'koko-oat', supplierId: 'sup-koko', name: 'KOKO oat milk 1L', pack: '1L carton', unitCost: 3.6, onHand: 48, parLevel: 30, temperatureZone: 'ambient' },
  { id: 'gp-eggs', supplierId: 'sup-greenpark', name: 'Free-range eggs tray of 30', pack: '30 eggs', unitCost: 16.8, onHand: 6, parLevel: 4, temperatureZone: 'ambient' },

  // Stocked products — these DO surface as Products on the ordering screen.
  { id: 'sp-sanpell-250', supplierId: 'sup-sanpell', name: 'San Pellegrino 250ml case', pack: '24 x 250ml', unitCost: 42.0, onHand: 5, parLevel: 3, temperatureZone: 'ambient' },
  { id: 'sp-sanpell-750', supplierId: 'sup-sanpell', name: 'San Pellegrino 750ml case', pack: '12 x 750ml', unitCost: 36.0, onHand: 3, parLevel: 2, temperatureZone: 'ambient' },
  { id: 'sp-mountaingoat-ginger', supplierId: 'sup-mountaingoat', name: 'Ginger kombucha 330ml case', pack: '12 x 330ml', unitCost: 54.0, onHand: 4, parLevel: 3, temperatureZone: 'chilled' },
  { id: 'sp-mountaingoat-passion', supplierId: 'sup-mountaingoat', name: 'Passionfruit kombucha 330ml case', pack: '12 x 330ml', unitCost: 54.0, onHand: 3, parLevel: 3, temperatureZone: 'chilled' },
  { id: 'sp-noisette-cookie', supplierId: 'sup-noisette', name: 'Choc-chip cookie (wrapped)', pack: 'each', unitCost: 1.4, onHand: 60, parLevel: 40, temperatureZone: 'ambient' },
  { id: 'sp-noisette-brownie', supplierId: 'sup-noisette', name: 'Salted caramel brownie (wrapped)', pack: 'each', unitCost: 1.8, onHand: 48, parLevel: 30, temperatureZone: 'ambient' },
  { id: 'sp-redrock-salt', supplierId: 'sup-redrock', name: 'Red Rock sea salt chips 45g', pack: '12 x 45g', unitCost: 14.4, onHand: 10, parLevel: 6, temperatureZone: 'ambient' },
  { id: 'sp-redrock-sweet', supplierId: 'sup-redrock', name: 'Red Rock honey soy chicken 45g', pack: '12 x 45g', unitCost: 14.4, onHand: 8, parLevel: 6, temperatureZone: 'ambient' },
  { id: 'sp-cola-330', supplierId: 'sup-koalacola', name: 'Coca-Cola 330ml case', pack: '24 x 330ml', unitCost: 28.8, onHand: 6, parLevel: 4, temperatureZone: 'ambient' },
  { id: 'sp-cola-diet', supplierId: 'sup-koalacola', name: 'Diet Coke 330ml case', pack: '24 x 330ml', unitCost: 28.8, onHand: 5, parLevel: 4, temperatureZone: 'ambient' },
  { id: 'sp-still-water', supplierId: 'sup-koalacola', name: 'Still water 600ml case', pack: '24 x 600ml', unitCost: 24.0, onHand: 9, parLevel: 6, temperatureZone: 'ambient' },
  { id: 'sp-yoghurt-plain', supplierId: 'sup-schulz', name: 'Natural yoghurt 500g', pack: '500g tub', unitCost: 5.4, onHand: 18, parLevel: 12, temperatureZone: 'chilled' },
];

// ---------- Products (8 made + 12 stocked) ----------

const PRODUCTS: Product[] = [
  // Made products — wraps recipes built at the CPU.
  { id: 'prd-banana-muffin', name: 'Banana walnut muffin', type: 'made', recipeId: 'rec-banana-muffin', price: 5.2, priorityFlag: false, allergens: ['gluten', 'egg', 'dairy', 'nut'], category: 'Bakery' },
  { id: 'prd-blueberry-muffin', name: 'Blueberry muffin', type: 'made', recipeId: 'rec-blueberry-muffin', price: 5.0, priorityFlag: false, allergens: ['gluten', 'egg', 'dairy'], category: 'Bakery' },
  { id: 'prd-almond-friand', name: 'Almond friand', type: 'made', recipeId: 'rec-almond-friand', price: 4.8, priorityFlag: false, allergens: ['gluten', 'egg', 'dairy', 'nut'], category: 'Bakery' },
  { id: 'prd-choc-traybake', name: 'Chocolate fudge traybake', type: 'made', recipeId: 'rec-choc-traybake', price: 6.2, priorityFlag: false, allergens: ['gluten', 'egg', 'dairy'], category: 'Bakery' },
  { id: 'prd-ham-croissant', name: 'Ham & cheese croissant', type: 'made', recipeId: 'rec-ham-croissant', price: 7.8, priorityFlag: true, allergens: ['gluten', 'egg', 'dairy'], category: 'Savoury' },
  { id: 'prd-chicken-pesto', name: 'Chicken pesto sandwich', type: 'made', recipeId: 'rec-chicken-pesto', price: 11.5, priorityFlag: true, allergens: ['gluten', 'egg', 'dairy', 'nut'], category: 'Savoury' },
  { id: 'prd-vegan-slaw', name: 'Vegan slaw wrap', type: 'made', recipeId: 'rec-vegan-slaw', price: 10.8, priorityFlag: true, allergens: ['gluten', 'soy'], category: 'Savoury' },
  { id: 'prd-coldbrew-tub', name: 'Cold brew tub (5L)', type: 'made', recipeId: 'rec-coldbrew-tub', price: 48.0, priorityFlag: false, allergens: [], category: 'Beverage base' },

  // Stocked products — wrap Supplier Products.
  { id: 'prd-sanpell-250', name: 'San Pellegrino 250ml', type: 'stocked', supplierProductId: 'sp-sanpell-250', price: 4.5, priorityFlag: false, allergens: [], category: 'Drinks' },
  { id: 'prd-sanpell-750', name: 'San Pellegrino 750ml', type: 'stocked', supplierProductId: 'sp-sanpell-750', price: 8.5, priorityFlag: false, allergens: [], category: 'Drinks' },
  { id: 'prd-kombucha-ginger', name: 'Ginger kombucha', type: 'stocked', supplierProductId: 'sp-mountaingoat-ginger', price: 7.5, priorityFlag: false, allergens: [], category: 'Drinks' },
  { id: 'prd-kombucha-passion', name: 'Passionfruit kombucha', type: 'stocked', supplierProductId: 'sp-mountaingoat-passion', price: 7.5, priorityFlag: false, allergens: [], category: 'Drinks' },
  { id: 'prd-cookie', name: 'Choc-chip cookie', type: 'stocked', supplierProductId: 'sp-noisette-cookie', price: 3.8, priorityFlag: false, allergens: ['gluten', 'egg', 'dairy'], category: 'Snacks' },
  { id: 'prd-brownie', name: 'Salted caramel brownie', type: 'stocked', supplierProductId: 'sp-noisette-brownie', price: 4.8, priorityFlag: false, allergens: ['gluten', 'egg', 'dairy'], category: 'Snacks' },
  { id: 'prd-chips-salt', name: 'Sea salt chips 45g', type: 'stocked', supplierProductId: 'sp-redrock-salt', price: 3.2, priorityFlag: false, allergens: [], category: 'Snacks' },
  { id: 'prd-chips-chicken', name: 'Honey soy chicken chips 45g', type: 'stocked', supplierProductId: 'sp-redrock-sweet', price: 3.2, priorityFlag: false, allergens: ['soy'], category: 'Snacks' },
  { id: 'prd-cola', name: 'Coca-Cola 330ml', type: 'stocked', supplierProductId: 'sp-cola-330', price: 4.0, priorityFlag: false, allergens: [], category: 'Drinks' },
  { id: 'prd-cola-diet', name: 'Diet Coke 330ml', type: 'stocked', supplierProductId: 'sp-cola-diet', price: 4.0, priorityFlag: false, allergens: [], category: 'Drinks' },
  { id: 'prd-still-water', name: 'Still water 600ml', type: 'stocked', supplierProductId: 'sp-still-water', price: 3.8, priorityFlag: false, allergens: [], category: 'Drinks' },
  { id: 'prd-yoghurt-pot', name: 'Natural yoghurt pot', type: 'stocked', supplierProductId: 'sp-yoghurt-plain', price: 5.2, priorityFlag: true, allergens: ['dairy'], category: 'Breakfast' },
];

// ---------- Ranges, Tiers ----------

const RANGES: Range[] = [
  { id: 'range-core', name: 'Fitzroy Core', description: 'Everyday range across the estate.' },
];

const TIERS: Tier[] = [
  {
    id: 'tier-weekday-full',
    rangeId: 'range-core',
    name: 'Weekday Full',
    productIds: [
      'prd-banana-muffin', 'prd-blueberry-muffin', 'prd-almond-friand', 'prd-choc-traybake',
      'prd-ham-croissant', 'prd-chicken-pesto', 'prd-vegan-slaw', 'prd-coldbrew-tub',
      'prd-sanpell-250', 'prd-kombucha-ginger', 'prd-kombucha-passion',
      'prd-cookie', 'prd-brownie', 'prd-chips-salt', 'prd-chips-chicken',
      'prd-cola', 'prd-cola-diet', 'prd-still-water', 'prd-yoghurt-pot',
    ],
  },
  {
    id: 'tier-weekday-light',
    rangeId: 'range-core',
    name: 'Weekday Light',
    productIds: [
      'prd-banana-muffin', 'prd-blueberry-muffin', 'prd-choc-traybake',
      'prd-ham-croissant', 'prd-chicken-pesto',
      'prd-sanpell-250', 'prd-kombucha-ginger',
      'prd-cookie', 'prd-chips-salt',
      'prd-cola', 'prd-still-water', 'prd-yoghurt-pot',
    ],
  },
  {
    id: 'tier-weekend-brunch',
    rangeId: 'range-core',
    name: 'Weekend Brunch',
    productIds: [
      'prd-banana-muffin', 'prd-blueberry-muffin', 'prd-almond-friand', 'prd-choc-traybake',
      'prd-ham-croissant', 'prd-chicken-pesto', 'prd-vegan-slaw', 'prd-coldbrew-tub',
      'prd-sanpell-250', 'prd-sanpell-750', 'prd-kombucha-ginger', 'prd-kombucha-passion',
      'prd-cookie', 'prd-brownie',
      'prd-cola', 'prd-still-water',
    ],
  },
];

// ---------- Classification rules ----------

const CLASSIFICATION_RULES: SiteClassificationRule[] = [
  {
    level: 'very_low',
    closingRangeSize: 6,
    selectionWindows: {
      opening: { coreCount: 6, byTime: '06:30' },
      morning: { coreCount: 8, byTime: '09:30' },
      full: { coreCount: 10, byTime: '11:30' },
      closing: { coreCount: 12, byTime: '17:00' },
    },
  },
  {
    level: 'low',
    closingRangeSize: 10,
    selectionWindows: {
      opening: { coreCount: 8, byTime: '06:30' },
      morning: { coreCount: 12, byTime: '09:30' },
      full: { coreCount: 14, byTime: '11:30' },
      closing: { coreCount: 16, byTime: '17:00' },
    },
  },
  {
    level: 'medium',
    closingRangeSize: 14,
    selectionWindows: {
      opening: { coreCount: 10, byTime: '06:30' },
      morning: { coreCount: 14, byTime: '09:30' },
      full: { coreCount: 18, byTime: '11:30' },
      closing: { coreCount: 20, byTime: '17:00' },
    },
  },
  {
    level: 'high',
    closingRangeSize: 18,
    selectionWindows: {
      opening: { coreCount: 12, byTime: '06:30' },
      morning: { coreCount: 18, byTime: '09:30' },
      full: { coreCount: 22, byTime: '11:30' },
      closing: { coreCount: 24, byTime: '17:00' },
    },
  },
];

// ---------- Demand for "today" ----------

const DEMAND_LINES: DemandLine[] = [
  // Fitzroy Espresso has NOT placed today's order yet — Demo A starts with the
  // Store GM at Fitzroy Espresso submitting their order, then flipping to hub.
  // Richmond has spoke orders already in.
  { id: 'dem-8', productId: 'prd-banana-muffin', source: 'spoke_order', siteId: 'site-carlton', quantity: 12, requiredByDateTime: iso('07:30') },
  { id: 'dem-9', productId: 'prd-ham-croissant', source: 'spoke_order', siteId: 'site-carlton', quantity: 14, requiredByDateTime: iso('07:30') },
  { id: 'dem-10', productId: 'prd-vegan-slaw', source: 'spoke_order', siteId: 'site-carlton', quantity: 10, requiredByDateTime: iso('10:30') },
  { id: 'dem-11', productId: 'prd-yoghurt-pot', source: 'spoke_order', siteId: 'site-carlton', quantity: 10, requiredByDateTime: iso('07:30') },

  // Richmond Espresso — medium, forecast-only (GM hasn't placed order yet).
  { id: 'dem-12', productId: 'prd-banana-muffin', source: 'forecast', siteId: 'site-richmond', quantity: 10, requiredByDateTime: iso('08:00') },
  { id: 'dem-13', productId: 'prd-chicken-pesto', source: 'forecast', siteId: 'site-richmond', quantity: 12, requiredByDateTime: iso('10:30') },
  { id: 'dem-14', productId: 'prd-choc-traybake', source: 'forecast', siteId: 'site-richmond', quantity: 6, requiredByDateTime: iso('08:00') },

  // South Yarra Espresso — low classification, spoke order + catering.
  { id: 'dem-15', productId: 'prd-banana-muffin', source: 'spoke_order', siteId: 'site-sthyarra', quantity: 8, requiredByDateTime: iso('08:00') },
  { id: 'dem-16', productId: 'prd-chicken-pesto', source: 'catering', siteId: 'site-sthyarra', quantity: 24, requiredByDateTime: iso('11:30'), notes: 'Agency lunch drop — 12pm hard deadline' },
];

// Quinn's suggested spoke-order quantities. Keyed by site + product. Used by
// the Spoke Ordering screen to pre-fill numbers and show a short justification.
export interface OrderSuggestion {
  qty: number;
  justification?: string;
}

export const QUINN_ORDER_SUGGESTIONS: Record<string, Record<string, OrderSuggestion>> = {
  'site-fitzroy': {
    'prd-banana-muffin':    { qty: 18, justification: '+2 vs last Wed — sunny forecast' },
    'prd-blueberry-muffin': { qty: 14, justification: 'steady 4-week average' },
    'prd-almond-friand':    { qty: 8 },
    'prd-choc-traybake':    { qty: 12, justification: '+2 vs last Wed — event at Cicciolina' },
    'prd-ham-croissant':    { qty: 20, justification: 'priority · breakfast rush' },
    'prd-chicken-pesto':    { qty: 16, justification: 'lunch bump from office week' },
    'prd-vegan-slaw':       { qty: 8 },
    'prd-coldbrew-tub':     { qty: 2, justification: '24°C forecast — cold-brew day' },
    'prd-yoghurt-pot':      { qty: 15, justification: 'priority · consistent demand' },
    'prd-sanpell-250':      { qty: 12 },
    'prd-kombucha-ginger':  { qty: 8, justification: 'trending up 3 weeks' },
    'prd-cookie':           { qty: 24 },
    'prd-brownie':          { qty: 12 },
    'prd-chips-salt':       { qty: 10 },
    'prd-cola':             { qty: 8 },
    'prd-still-water':      { qty: 12 },
  },
  'site-carlton': {
    'prd-banana-muffin':    { qty: 12, justification: 'priority · steady demand' },
    'prd-ham-croissant':    { qty: 14, justification: 'priority · breakfast rush' },
    'prd-vegan-slaw':       { qty: 10 },
    'prd-yoghurt-pot':      { qty: 10, justification: 'priority' },
  },
  'site-richmond': {
    'prd-banana-muffin':    { qty: 10 },
    'prd-chicken-pesto':    { qty: 12 },
    'prd-choc-traybake':    { qty: 6 },
  },
  'site-sthyarra': {
    'prd-banana-muffin':    { qty: 8 },
    'prd-chips-salt':       { qty: 6 },
    'prd-cookie':           { qty: 10 },
  },
};

// Cut-off time for today's spoke orders — enforced by the Ordering screen.
export const SPOKE_ORDER_CUTOFF = iso('14:00');

// ---------- Pre-drafted production runs ----------

const PRODUCTION_RUNS: ProductionRun[] = [
  {
    id: 'run-p1',
    name: 'P1 · Bake + bakery priority',
    runType: 'fixed',
    timeHorizon: 'advance',
    scheduledDate: TODAY,
    scheduledStart: '04:30',
    scheduledEnd: '06:15',
    siteId: 'site-cpu',
    status: 'draft',
    benchAssignments: [],
    // Bakery demand from spokes other than Fitzroy Espresso (which hasn't
    // ordered yet — that comes in during Demo A).
    linkedDemandLineIds: ['dem-8', 'dem-12', 'dem-14', 'dem-15'],
  },
  {
    id: 'run-p2',
    name: 'P2 · Sandwiches & wraps',
    runType: 'variable',
    timeHorizon: 'planned',
    scheduledDate: TODAY,
    scheduledStart: '09:00',
    scheduledEnd: '10:30',
    siteId: 'site-cpu',
    status: 'draft',
    benchAssignments: [],
    linkedDemandLineIds: ['dem-9', 'dem-10', 'dem-13', 'dem-16'],
  },
];

// ---------- Initial state factory (used for reset too) ----------

export interface ProductionState {
  sites: Site[];
  capabilityTags: CapabilityTag[];
  benches: Bench[];
  suppliers: Supplier[];
  supplierProducts: SupplierProduct[];
  products: Product[];
  ranges: Range[];
  tiers: Tier[];
  classificationRules: SiteClassificationRule[];
  demandLines: DemandLine[];
  productionRuns: ProductionRun[];
  pickListLines: PickListLine[];
  madeOutputs: MadeOutput[];
  pcrChecks: PcrCheck[];
  dispatchManifests: DispatchManifest[];
  grns: Grn[];
  salesActuals: SalesTick[];
}

export function initialProductionState(): ProductionState {
  return {
    sites: SITES.map(s => ({ ...s, tierAssignments: { ...s.tierAssignments } })),
    capabilityTags: CAPABILITY_TAGS.map(t => ({ ...t })),
    benches: BENCHES.map(b => ({ ...b, capabilityTagIds: [...b.capabilityTagIds], activeHours: { ...b.activeHours } })),
    suppliers: SUPPLIERS.map(s => ({ ...s })),
    supplierProducts: SUPPLIER_PRODUCTS.map(sp => ({ ...sp })),
    products: PRODUCTS.map(p => ({ ...p, allergens: [...p.allergens] })),
    ranges: RANGES.map(r => ({ ...r })),
    tiers: TIERS.map(t => ({ ...t, productIds: [...t.productIds] })),
    classificationRules: CLASSIFICATION_RULES.map(c => ({ ...c, selectionWindows: { ...c.selectionWindows } })),
    demandLines: DEMAND_LINES.map(d => ({ ...d })),
    productionRuns: PRODUCTION_RUNS.map(r => ({
      ...r,
      benchAssignments: r.benchAssignments.map(a => ({ ...a })),
      linkedDemandLineIds: [...r.linkedDemandLineIds],
    })),
    pickListLines: [],
    madeOutputs: [],
    pcrChecks: [],
    dispatchManifests: [],
    grns: [],
    salesActuals: [],
  };
}

export const DEFAULT_HUB_ID = 'site-cpu';
export const DEFAULT_SPOKE_ID = 'site-fitzroy';
