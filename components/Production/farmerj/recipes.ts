/**
 * Farmer J recipe tree. Finished products at the top in the unit the
 * kitchen thinks in (cast irons, salad gastronorms, pots), everything below
 * derived: kits, cooked components, dressings and preps, down to supplier
 * packs.
 *
 * Sources, and how much to trust each row (`provenance`):
 *  - 'pdf'      Recipe_ProductionDevelopment.pdf and the HTC cards Jana
 *               sent. Quantities are hers.
 *  - 'calls'    Said on the 2025 calls (yield percentages, shelf-life
 *               groups, cast iron sizes).
 *  - 'invented' Made up for the demo where Farmer J has not given us the
 *               recipe (kale slaw, coconut chia, the tofu bowl weights,
 *               the simple sides). Every invented row is flagged in the UI
 *               and in the handover so Jana can correct it.
 *
 * Vocabulary rule for anything user-facing built on this file: cast iron,
 * batch, half batch, gastronorm, section, make-on day. Never min, max,
 * multiple, bench, increment or mode.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shelf life groups and production days
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Jana's colour groups. `days` is how many days a batch covers including
 * the day it is made ("today+3" = 4 days). Production days per group are
 * in `DEFAULT_PRODUCTION_DAYS` and can be overridden per shop.
 */
export type ShelfLifeGroupId = 'daily' | 'green3' | 'blue4' | 'coconut2' | 'weekly';

export type ShelfLifeGroup = {
  id: ShelfLifeGroupId;
  label: string;
  /** Days covered including the make-on day. */
  days: number;
  colour: string;
  description: string;
};

export const SHELF_LIFE_GROUPS: Record<ShelfLifeGroupId, ShelfLifeGroup> = {
  daily: {
    id: 'daily',
    label: 'Daily',
    days: 1,
    colour: '#1f2937',
    description: 'Made on the day it is used, or the day before when the recipe says so.',
  },
  green3: {
    id: 'green3',
    label: 'Make ahead, 3 days',
    days: 4,
    colour: '#2f855a',
    description: 'Today plus three. Most dressings and Loose Miso.',
  },
  blue4: {
    id: 'blue4',
    label: 'Make ahead, 4 days',
    days: 5,
    colour: '#2b6cb0',
    description: 'Today plus four. Tahini dressings and pickled preps.',
  },
  coconut2: {
    id: 'coconut2',
    label: 'Coconut, 2 days',
    days: 3,
    colour: '#c05621',
    description: 'Today plus two. Anything with coconut milk.',
  },
  weekly: {
    id: 'weekly',
    label: 'Weekly',
    days: 7,
    colour: '#6b7280',
    description: 'Dry mixes made once a week for the whole week.',
  },
};

/** 0 = Monday … 6 = Sunday, matching how the kitchen reads a week. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * Default make-on days by group. Thursday is deep clean and never a
 * make-ahead day. No complex prep at weekends (no manager on site).
 * Together the defaults cover every day of the week with nothing beyond
 * five days.
 */
export const DEFAULT_PRODUCTION_DAYS: Record<ShelfLifeGroupId, Weekday[]> = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  green3: [0, 2, 4],
  blue4: [0, 4],
  coconut2: [0, 2, 4],
  weekly: [0],
};

export const DEEP_CLEAN_DAY: Weekday = 3;

/** Per-shop overrides. Marylebone runs its green dressings Tuesday and
 *  Friday so the demo shows a site difference the moment you switch shop. */
export const SHOP_PRODUCTION_DAY_OVERRIDES: Record<string, Partial<Record<ShelfLifeGroupId, Weekday[]>>> = {
  'fj-marylebone': { green3: [1, 4] },
};

export function productionDaysFor(shopId: string, group: ShelfLifeGroupId): Weekday[] {
  return SHOP_PRODUCTION_DAY_OVERRIDES[shopId]?.[group] ?? DEFAULT_PRODUCTION_DAYS[group];
}

// ─────────────────────────────────────────────────────────────────────────────
// Containers and production units
// ─────────────────────────────────────────────────────────────────────────────

export type ContainerId =
  | 'round-cast-iron'
  | 'rect-cast-iron'
  | 'salad-gn'
  | 'gn-1-1-20'
  | 'gn-1-2'
  | 'blue-box'
  | 'gn-1-6-10'
  | 'squeezy-bottle'
  | 'breakfast-pot'
  | 'oven-tray';

export type Container = {
  id: ContainerId;
  name: string;
  /** Working fill in grams (or millilitres for bottles). */
  fillG: number;
  note?: string;
};

export const CONTAINERS: Record<ContainerId, Container> = {
  // Line containers are named by size only, never by shape or material
  // (Nina, 2 Sep 2026). The methods show four fill sizes; the kitchen's own
  // names for them are a Setup setting.
  'round-cast-iron': { id: 'round-cast-iron', name: 'Extra-large container', fillG: 2400, note: 'Round cast iron. Rice and grains on the main line. About 2400 g (Rice Service HTC).' },
  'rect-cast-iron': { id: 'rect-cast-iron', name: 'Medium container', fillG: 1200, note: 'Rectangular cast iron. Proteins and hot sides on the main line. One bag of chicken cooked fills one.' },
  'salad-gn': { id: 'salad-gn', name: 'Large container', fillG: 1800, note: 'Salad tray on the line. Holds a half batch.' },
  'gn-1-1-20': { id: 'gn-1-1-20', name: 'GN 1:1, 20 cm', fillG: 6000, note: 'Prep container for dressings and vegetable prep.' },
  'gn-1-2': { id: 'gn-1-2', name: 'Small container', fillG: 600, note: 'Second make line gastronorm. Holds half a rectangular cast iron of anything hot.' },
  'blue-box': { id: 'blue-box', name: 'Blue shari box', fillG: 17000, note: 'One rice cooker fills one blue box.' },
  'gn-1-6-10': { id: 'gn-1-6-10', name: 'GN 1:6, 10 cm (10 litre)', fillG: 7140, note: 'Rice kit container, stored ambient with the lid on.' },
  'squeezy-bottle': { id: 'squeezy-bottle', name: 'Squeezy bottle', fillG: 500, note: 'Lemon juice and oil for seasoning cast irons. Bottle size is a setting.' },
  'breakfast-pot': { id: 'breakfast-pot', name: 'Breakfast pot', fillG: 150, note: 'Coconut chia and overnight oats.' },
  'oven-tray': { id: 'oven-tray', name: 'Gastronorm oven tray', fillG: 2000, note: 'One bag of chicken per tray. Oven holds six trays.' },
};

/** Equipment limits that shape timing. Stated as facts about kit, never
 *  as batch multiples. */
export const EQUIPMENT_LIMITS = {
  ovenTrays: 6,
  riceCookerKitsAtOnce: 1,
  foodProcessorFillFraction: 0.5,
  chickpeaTinsMixedAtOnce: 4,
};

// ─────────────────────────────────────────────────────────────────────────────
// Ingredients (bought in)
// ─────────────────────────────────────────────────────────────────────────────

export type Ingredient = {
  id: string;
  name: string;
  supplier: string;
  pack: { size: number; unit: 'g' | 'ml'; label: string };
  frozen?: boolean;
  /** Fresh daily delivery; never carried. */
  daily?: boolean;
  /** Rough cost per kg in pounds, for waste and COGS in the dashboard. */
  costPerKg: number;
  note?: string;
};

export const INGREDIENTS: Record<string, Ingredient> = {
  'brown-rice': { id: 'brown-rice', name: 'Short brown rice', supplier: 'Dry goods', pack: { size: 5000, unit: 'g', label: '5 kg bag' }, costPerKg: 2.2 },
  'sea-salt': { id: 'sea-salt', name: 'Sea salt', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 1.5 },
  'black-pepper': { id: 'black-pepper', name: 'Black pepper, coarse', supplier: 'Dry goods', pack: { size: 500, unit: 'g', label: '500 g' }, costPerKg: 18 },
  'oil-blend': { id: 'oil-blend', name: 'Oil blend, 5 litre', supplier: 'Dry goods', pack: { size: 5000, unit: 'ml', label: '5 L' }, costPerKg: 2.4 },
  'veg-oil': { id: 'veg-oil', name: 'Vegetable oil', supplier: 'Dry goods', pack: { size: 5000, unit: 'ml', label: '5 L' }, costPerKg: 2.0 },
  'olive-oil': { id: 'olive-oil', name: 'Olive oil, 5 litre', supplier: 'Dry goods', pack: { size: 5000, unit: 'ml', label: '5 L' }, costPerKg: 6.5 },
  'sesame-oil': { id: 'sesame-oil', name: 'Sesame oil', supplier: 'Dry goods', pack: { size: 1000, unit: 'ml', label: '1 L' }, costPerKg: 9 },
  'lemon-juice': { id: 'lemon-juice', name: 'Lemon juice (frozen)', supplier: 'Frozen', pack: { size: 750, unit: 'ml', label: '750 ml bottle' }, frozen: true, costPerKg: 4.5, note: 'Comes frozen. Thaw the night before a dressing day.' },
  'freekeh': { id: 'freekeh', name: 'Freekeh', supplier: 'Dry goods', pack: { size: 5000, unit: 'g', label: '5 kg' }, costPerKg: 4.8 },
  'bulgur': { id: 'bulgur', name: 'Bulgur wheat', supplier: 'Dry goods', pack: { size: 5000, unit: 'g', label: '5 kg' }, costPerKg: 2.6 },
  'crispy-onion': { id: 'crispy-onion', name: 'Crispy onion', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 7 },
  'zaatar': { id: 'zaatar', name: "Za'atar", supplier: 'Dry goods', pack: { size: 500, unit: 'g', label: '500 g' }, costPerKg: 22 },
  'cauliflower-sauce': { id: 'cauliflower-sauce', name: 'Cauliflower sauce (H&B)', supplier: 'H&B', pack: { size: 2000, unit: 'g', label: '2 kg tub' }, costPerKg: 6 },
  'amba-bag': { id: 'amba-bag', name: 'Amba chicken, marinated bag', supplier: 'Butcher', pack: { size: 2000, unit: 'g', label: '2 kg bag' }, costPerKg: 8.5, note: 'One bag is one oven tray and one cast iron.' },
  'harissa-bag': { id: 'harissa-bag', name: 'Harissa chicken, marinated bag', supplier: 'Butcher', pack: { size: 2000, unit: 'g', label: '2 kg bag' }, costPerKg: 8.5 },
  'amba-marinade': { id: 'amba-marinade', name: 'Amba marinade', supplier: 'Med Cuisine', pack: { size: 2000, unit: 'g', label: '2 kg' }, costPerKg: 7 },
  'date-syrup': { id: 'date-syrup', name: 'Date syrup', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 8 },
  'amba-spice': { id: 'amba-spice', name: 'Amba spice (Med Cuisine)', supplier: 'Med Cuisine', pack: { size: 500, unit: 'g', label: '500 g' }, costPerKg: 24 },
  'garlic': { id: 'garlic', name: 'Garlic, peeled', supplier: 'Fresh produce', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 9 },
  'shifka-can': { id: 'shifka-can', name: 'Shifka hot pepper, pickled (can)', supplier: 'Med Cuisine', pack: { size: 8400, unit: 'g', label: '8.4 kg can' }, costPerKg: 3.2, note: 'Supplier changes the pack size occasionally. Editable.' },
  'parsley': { id: 'parsley', name: 'Parsley, washed', supplier: 'Fresh produce', pack: { size: 500, unit: 'g', label: '500 g bag' }, daily: true, costPerKg: 9 },
  'tahini': { id: 'tahini', name: 'Tahini, raw', supplier: 'Dry goods', pack: { size: 5000, unit: 'g', label: '5 kg' }, costPerKg: 7.5 },
  'harissa-paste': { id: 'harissa-paste', name: 'Harissa with rose petals, 5 kg', supplier: 'Dry goods', pack: { size: 5000, unit: 'g', label: '5 kg' }, costPerKg: 9 },
  'broccoli': { id: 'broccoli', name: 'Broccoli florets', supplier: 'Fresh produce', pack: { size: 5000, unit: 'g', label: '5 kg' }, costPerKg: 3.5 },
  'black-sesame': { id: 'black-sesame', name: 'Black sesame seeds', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 12 },
  'white-sesame': { id: 'white-sesame', name: 'White sesame seeds', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 8 },
  'soy-sauce': { id: 'soy-sauce', name: 'Soya sauce', supplier: 'Dry goods', pack: { size: 1900, unit: 'ml', label: '1.9 L' }, costPerKg: 4 },
  'maple-syrup': { id: 'maple-syrup', name: 'Maple syrup', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 14 },
  'chickpeas-tin': { id: 'chickpeas-tin', name: 'Chickpeas (tin)', supplier: 'Dry goods', pack: { size: 1500, unit: 'g', label: '1.5 kg tin' }, costPerKg: 2.2 },
  'white-cabbage': { id: 'white-cabbage', name: 'White cabbage, shredded', supplier: 'Fresh produce', pack: { size: 2000, unit: 'g', label: '2 kg bag' }, costPerKg: 2.5 },
  'cucumber': { id: 'cucumber', name: 'Cucumber, whole', supplier: 'Fresh produce', pack: { size: 5000, unit: 'g', label: '5 kg box' }, costPerKg: 2.2 },
  'green-pepper': { id: 'green-pepper', name: 'Green pepper, whole', supplier: 'Fresh produce', pack: { size: 5000, unit: 'g', label: '5 kg box' }, costPerKg: 3.2 },
  'red-onion-tub': { id: 'red-onion-tub', name: 'Red pickled onion (tub)', supplier: 'Med Cuisine', pack: { size: 1000, unit: 'g', label: '1 kg tub' }, costPerKg: 5 },
  'pickled-cucumber-can': { id: 'pickled-cucumber-can', name: 'Pickled cucumber, Middle Eastern (can)', supplier: 'Med Cuisine', pack: { size: 1700, unit: 'g', label: '1.7 kg can' }, costPerKg: 3.8 },
  'sumac': { id: 'sumac', name: 'Sumac', supplier: 'Dry goods', pack: { size: 500, unit: 'g', label: '500 g' }, costPerKg: 20 },
  'cumin': { id: 'cumin', name: 'Cumin, ground', supplier: 'Dry goods', pack: { size: 500, unit: 'g', label: '500 g' }, costPerKg: 16 },
  'hispi': { id: 'hispi', name: 'Hispi cabbage', supplier: 'Fresh produce', pack: { size: 3000, unit: 'g', label: '3 kg bag' }, costPerKg: 2.4 },
  'aubergine': { id: 'aubergine', name: 'Aubergine', supplier: 'Fresh produce', pack: { size: 5000, unit: 'g', label: '5 kg box' }, costPerKg: 3.0 },
  'tofu': { id: 'tofu', name: 'Firm tofu', supplier: 'Chilled', pack: { size: 1000, unit: 'g', label: '1 kg block' }, costPerKg: 5.5 },
  'miso': { id: 'miso', name: 'White miso', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 9 },
  'mirin': { id: 'mirin', name: 'Mirin', supplier: 'Dry goods', pack: { size: 1000, unit: 'ml', label: '1 L' }, costPerKg: 6 },
  'rice-vinegar': { id: 'rice-vinegar', name: 'Rice vinegar', supplier: 'Dry goods', pack: { size: 1000, unit: 'ml', label: '1 L' }, costPerKg: 4 },
  'smoked-chilli-paste': { id: 'smoked-chilli-paste', name: 'Smoked chilli paste', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 11 },
  'coconut-milk': { id: 'coconut-milk', name: 'Coconut milk', supplier: 'Dry goods', pack: { size: 400, unit: 'ml', label: '400 ml tin' }, costPerKg: 3.5 },
  'lime-juice': { id: 'lime-juice', name: 'Lime juice', supplier: 'Chilled', pack: { size: 1000, unit: 'ml', label: '1 L' }, costPerKg: 5 },
  'sugar': { id: 'sugar', name: 'Caster sugar', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 1.4 },
  'kale': { id: 'kale', name: 'Kale', supplier: 'Fresh produce', pack: { size: 2000, unit: 'g', label: '2 kg bag' }, costPerKg: 4.5 },
  'red-cabbage': { id: 'red-cabbage', name: 'Red cabbage, shredded', supplier: 'Fresh produce', pack: { size: 2000, unit: 'g', label: '2 kg bag' }, costPerKg: 2.6 },
  'carrot': { id: 'carrot', name: 'Carrot, julienne', supplier: 'Fresh produce', pack: { size: 2000, unit: 'g', label: '2 kg bag' }, costPerKg: 2.2 },
  'cashews': { id: 'cashews', name: 'Cashews, roasted', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 13 },
  'spring-onion': { id: 'spring-onion', name: 'Spring onion', supplier: 'Fresh produce', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 5 },
  'cashew-butter': { id: 'cashew-butter', name: 'Cashew butter', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 15 },
  'chia': { id: 'chia', name: 'Chia seeds', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 9 },
  'vanilla': { id: 'vanilla', name: 'Vanilla extract', supplier: 'Dry goods', pack: { size: 250, unit: 'ml', label: '250 ml' }, costPerKg: 60 },
  'salmon-bag': { id: 'salmon-bag', name: 'Gotcha salmon, marinated', supplier: 'Fish', pack: { size: 2000, unit: 'g', label: '2 kg bag' }, costPerKg: 16 },
  'steak-bag': { id: 'steak-bag', name: 'Steak, marinated', supplier: 'Butcher', pack: { size: 2000, unit: 'g', label: '2 kg bag' }, costPerKg: 14 },
  'cauliflower': { id: 'cauliflower', name: 'Cauliflower florets', supplier: 'Fresh produce', pack: { size: 5000, unit: 'g', label: '5 kg' }, costPerKg: 3.0 },
  'sweet-potato': { id: 'sweet-potato', name: 'Sweet potato, diced', supplier: 'Fresh produce', pack: { size: 5000, unit: 'g', label: '5 kg' }, costPerKg: 2.4 },
  'mac-cheese-tray': { id: 'mac-cheese-tray', name: 'Mac & cheese (prepared tray)', supplier: 'Chilled', pack: { size: 3000, unit: 'g', label: '3 kg tray' }, costPerKg: 5.5 },
  'baby-potatoes': { id: 'baby-potatoes', name: 'Baby potatoes', supplier: 'Fresh produce', pack: { size: 5000, unit: 'g', label: '5 kg' }, costPerKg: 1.8 },
  'parmesan': { id: 'parmesan', name: 'Grated Italian hard cheese', supplier: 'Chilled', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 14 },
  'iow-tomatoes': { id: 'iow-tomatoes', name: 'Isle of Wight tomatoes', supplier: 'Fresh produce', pack: { size: 3000, unit: 'g', label: '3 kg' }, costPerKg: 6 },
  'feta': { id: 'feta', name: 'Feta', supplier: 'Chilled', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 9 },
  'romaine': { id: 'romaine', name: 'Romaine, chopped', supplier: 'Fresh produce', pack: { size: 2000, unit: 'g', label: '2 kg bag' }, costPerKg: 4 },
  'dijon': { id: 'dijon', name: 'Dijon mustard', supplier: 'Dry goods', pack: { size: 1000, unit: 'g', label: '1 kg' }, costPerKg: 6 },
  'mayonnaise': { id: 'mayonnaise', name: 'Mayonnaise', supplier: 'Dry goods', pack: { size: 5000, unit: 'g', label: '5 kg' }, costPerKg: 3.5 },
  'spinach': { id: 'spinach', name: 'Baby spinach, washed', supplier: 'Fresh produce', pack: { size: 1000, unit: 'g', label: '1 kg bag' }, costPerKg: 7 },
  'water': { id: 'water', name: 'Water', supplier: 'Tap', pack: { size: 1000, unit: 'ml', label: 'tap' }, costPerKg: 0 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Components (everything below a finished product)
// ─────────────────────────────────────────────────────────────────────────────

export type Provenance = 'pdf' | 'calls' | 'invented';

export type Section = 'hot' | 'salads' | 'prep' | 'second';

export type ComponentKind = 'kit' | 'cooked' | 'dressing' | 'prep' | 'mix';

/** One input line, per FULL batch, in grams of the referenced component
 *  or ingredient (net, as the recipe needs it). */
export type LineItem = { ref: string; grams: number };

export type Component = {
  id: string;
  name: string;
  kind: ComponentKind;
  shelfLife: ShelfLifeGroupId;
  /**
   * Loss between what goes in and what comes out, as a percentage of
   * input. 40 means 2000 g in gives 1200 g out. Editable by Jana.
   */
  yieldLossPct: number;
  yieldNote?: string;
  /** Net output of one full batch, and a half if the recipe has one. */
  batch: { fullG: number; halfG?: number; label?: string };
  inputs: LineItem[];
  /**
   * When it is made relative to the day it is used.
   *  on-day      Same day, in the kitchen's flow.
   *  day-before  Must be made the day before (cooling, washing and cutting).
   *  scheduled   On the shelf-life group's production days.
   */
  when: 'on-day' | 'day-before' | 'scheduled';
  section: Section;
  container?: ContainerId;
  /** How many of `container` one full batch fills. */
  containersPerBatch?: number;
  equipment?: string[];
  cook?: { programme: string; minutes: number | [number, number]; coreTempC?: number };
  restMinutes?: number;
  /**
   * How the prep list rounds this component.
   *  'batch' Whole and half batches (kits, cooked items).
   *  'kilo'  Whole kilos on the 1 to 18 kg dressing matrix.
   *  'pack'  Whole supplier packs: you open the can, you prep the can.
   *  'exact' The grams needed, no rounding (per-kg vegetable prep).
   */
  roundTo: 'batch' | 'kilo' | 'pack' | 'exact';
  /** Survives to tomorrow if counted at close. */
  carryable: boolean;
  /** How long it may sit once made, when shorter than its group (hot hold). */
  holdMinutes?: number;
  htcCode?: string;
  steps?: string[];
  provenance: Provenance;
  note?: string;
};

export const COMPONENTS: Record<string, Component> = {
  // ── Rice ────────────────────────────────────────────────────────────────
  'rice-kit': {
    id: 'rice-kit', name: 'Rice kit', kind: 'kit', shelfLife: 'weekly', yieldLossPct: 0,
    batch: { fullG: 7140, halfG: 3570 },
    inputs: [{ ref: 'brown-rice', grams: 7000 }, { ref: 'sea-salt', grams: 140 }],
    when: 'on-day', section: 'prep', container: 'gn-1-6-10', containersPerBatch: 1,
    equipment: ['Scale', 'Disposable gloves', 'GN 1:6, 10 cm', '10 litre container and lid'],
    roundTo: 'batch', carryable: true, htcCode: 'WINML-26112024v1',
    steps: ['Weigh 7000 g brown rice (half: 3500 g)', 'Add 140 g sea salt (half: 70 g)', 'Close with the lid and store ambient', 'Apply product label'],
    provenance: 'pdf',
    note: 'Half kits exist so off-peak and the second make line can cook less and waste less.',
  },
  'rice-cooked': {
    id: 'rice-cooked', name: "Farmers' Rice, cooked", kind: 'cooked', shelfLife: 'daily', yieldLossPct: 0,
    batch: { fullG: 17000, halfG: 8500, label: 'one rice cooker' },
    inputs: [{ ref: 'rice-kit', grams: 7140 }, { ref: 'water', grams: 11000 }],
    when: 'on-day', section: 'hot', container: 'blue-box', containersPerBatch: 1,
    equipment: ['Rice cooker', 'Scale', 'Slotted spoon', 'Blue box'],
    cook: { programme: 'Rice cooker', minutes: [50, 60] }, restMinutes: 20,
    roundTo: 'batch', carryable: true, htcCode: 'WINML-26112024v1',
    steps: ['Spray the rice cooker pot with oil', 'Tip in one kit (7140 g; half 3570 g)', 'Add 11000 g cold water (half 6300 g)', 'Lid on, push the button. Red light is cooking, orange is keeping warm', 'Cook 50 to 60 min, rest 20 min', 'Transfer to the blue box, lid on, label immediately'],
    provenance: 'pdf',
    note: 'Cooked weight is our estimate: 7 kg raw brown rice and 11 kg water gives about 17 kg after evaporation. Jana to confirm.',
  },

  // ── Grains ──────────────────────────────────────────────────────────────
  'salt-pepper-mix': {
    id: 'salt-pepper-mix', name: 'Salt & pepper mix', kind: 'mix', shelfLife: 'weekly', yieldLossPct: 0,
    batch: { fullG: 1040 },
    inputs: [{ ref: 'sea-salt', grams: 1000 }, { ref: 'black-pepper', grams: 40 }],
    when: 'scheduled', section: 'prep', roundTo: 'kilo', carryable: true, provenance: 'pdf',
    note: 'Once a week for the whole week, from the planned production.',
  },
  'grains-kit': {
    id: 'grains-kit', name: 'Grains kit', kind: 'kit', shelfLife: 'weekly', yieldLossPct: 0,
    batch: { fullG: 3420 },
    inputs: [{ ref: 'freekeh', grams: 1500 }, { ref: 'bulgur', grams: 1500 }, { ref: 'crispy-onion', grams: 300 }, { ref: 'zaatar', grams: 45 }, { ref: 'salt-pepper-mix', grams: 75 }],
    when: 'on-day', section: 'prep', roundTo: 'batch', carryable: true, provenance: 'pdf',
    note: 'One size only: grains cook in smaller quantities per go.',
  },
  'grains-cooked': {
    id: 'grains-cooked', name: "Farmers' Grains, cooked", kind: 'cooked', shelfLife: 'daily', yieldLossPct: 0,
    batch: { fullG: 7500, label: 'one rice cooker' },
    inputs: [{ ref: 'grains-kit', grams: 3420 }, { ref: 'water', grams: 4500 }],
    when: 'on-day', section: 'hot', container: 'blue-box', containersPerBatch: 1,
    cook: { programme: 'Rice cooker', minutes: 40 }, restMinutes: 15,
    roundTo: 'batch', carryable: true, provenance: 'pdf',
    note: 'Cooked weight estimated from kit plus water less evaporation.',
  },
  'cauli-grains-dressing': {
    id: 'cauli-grains-dressing', name: 'Cauliflower & grains dressing', kind: 'dressing', shelfLife: 'green3', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [{ ref: 'cauliflower-sauce', grams: 492 }, { ref: 'veg-oil', grams: 197 }, { ref: 'sea-salt', grams: 15 }, { ref: 'water', grams: 296 }],
    when: 'scheduled', section: 'prep', container: 'gn-1-1-20', roundTo: 'kilo', carryable: true, provenance: 'pdf',
  },

  // ── Chicken ─────────────────────────────────────────────────────────────
  'amba-cooked': {
    id: 'amba-cooked', name: 'Amba chicken, cooked', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 40,
    batch: { fullG: 1200, label: 'one bag, one tray' },
    inputs: [{ ref: 'amba-bag', grams: 2000 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 1,
    equipment: ['Oven', 'Tongs', 'Oven gloves', 'Temperature probe'],
    cook: { programme: 'Chicken Program', minutes: [12, 14], coreTempC: 78 }, restMinutes: 5,
    roundTo: 'batch', carryable: true, holdMinutes: 120, htcCode: 'SUML-11062024v1',
    steps: ['Preheat the oven', 'One bag per tray, skin side down, not overlapping', 'Maximum 6 trays in the oven at once', 'Chicken Program, 12 to 14 min. Do not interrupt', 'Probe every batch: core 78°C minimum, or extend and test again', 'Whole thighs to the Duke unit (2 hours) or slice for service'],
    provenance: 'pdf',
    note: '40% yield loss in cooking: 2000 g raw gives about 1200 g cooked.',
  },
  'harissa-cooked': {
    id: 'harissa-cooked', name: 'Harissa chicken, cooked', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 40,
    batch: { fullG: 1200, label: 'one bag, one tray' },
    inputs: [{ ref: 'harissa-bag', grams: 2000 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 1,
    equipment: ['Oven', 'Tongs', 'Oven gloves', 'Temperature probe'],
    cook: { programme: 'Chicken Program', minutes: [12, 14], coreTempC: 78 }, restMinutes: 5,
    roundTo: 'batch', carryable: true, holdMinutes: 120, htcCode: 'SUML-11062024v1',
    provenance: 'pdf',
  },
  'amba-dressing': {
    id: 'amba-dressing', name: 'Amba dressing', kind: 'dressing', shelfLife: 'green3', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [{ ref: 'amba-marinade', grams: 667 }, { ref: 'oil-blend', grams: 167 }, { ref: 'lemon-juice', grams: 100 }, { ref: 'date-syrup', grams: 33 }, { ref: 'amba-spice', grams: 33 }],
    when: 'scheduled', section: 'prep', container: 'gn-1-1-20', roundTo: 'kilo', carryable: true, provenance: 'pdf',
    note: 'Lemon juice comes frozen: thaw the night before.',
  },
  'green-shifka-tahini': {
    id: 'green-shifka-tahini', name: 'Green Shifka tahini dressing', kind: 'dressing', shelfLife: 'green3', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [
      { ref: 'sea-salt', grams: 4 }, { ref: 'garlic', grams: 5 }, { ref: 'shifka-prep', grams: 45 }, { ref: 'parsley-prep', grams: 45 },
      { ref: 'lemon-juice', grams: 45 }, { ref: 'olive-oil', grams: 45 }, { ref: 'shifka-water', grams: 135 }, { ref: 'water', grams: 225 }, { ref: 'tahini', grams: 451 },
    ],
    when: 'scheduled', section: 'prep', container: 'gn-1-1-20',
    equipment: ['Food processor (fill no more than halfway)', 'Scale', 'GN 1:1, 20 cm'],
    roundTo: 'kilo', carryable: true, htcCode: 'SPRML-18032025v1',
    steps: ['Blend everything except the tahini', 'Add the raw tahini after the first blend', 'Blend smooth, container, label'],
    provenance: 'pdf',
    note: 'Also sold as the Green Tahini sauce on the till, so sauce sales add demand.',
  },
  'harissa-dressing': {
    id: 'harissa-dressing', name: 'Harissa dressing', kind: 'dressing', shelfLife: 'blue4', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [{ ref: 'veg-oil', grams: 306 }, { ref: 'harissa-paste', grams: 542 }, { ref: 'lemon-juice', grams: 127 }, { ref: 'sea-salt', grams: 25 }],
    when: 'scheduled', section: 'prep', container: 'gn-1-1-20', roundTo: 'kilo', carryable: true, provenance: 'pdf',
  },
  'shifka-prep': {
    id: 'shifka-prep', name: 'Shifka hot pepper prep', kind: 'prep', shelfLife: 'blue4', yieldLossPct: 68,
    batch: { fullG: 2688, label: 'one can' },
    inputs: [{ ref: 'shifka-can', grams: 8400 }],
    when: 'scheduled', section: 'prep', container: 'gn-1-1-20',
    equipment: ['Food processor', 'Colander', 'GN 1:1, 20 cm'],
    roundTo: 'pack', carryable: true, htcCode: 'Shifka Hot Pepper Prep NEW',
    steps: ['Decant the can', 'Remove stalks, squeeze out the liquid, keep the liquid (Shifka water)', 'Chop in the food processor, bowl no more than half full'],
    provenance: 'pdf',
    note: '68% loss from can to chopped pepper. The liquid is kept as Shifka water for the dressing.',
  },
  'shifka-water': {
    id: 'shifka-water', name: 'Shifka water (from the can)', kind: 'prep', shelfLife: 'blue4', yieldLossPct: 0,
    batch: { fullG: 2000, label: 'from one can' },
    inputs: [],
    when: 'scheduled', section: 'prep', roundTo: 'pack', carryable: true, provenance: 'pdf',
    note: 'By-product of Shifka prep. Not ordered separately.',
  },
  'parsley-prep': {
    id: 'parsley-prep', name: 'Parsley, chopped', kind: 'prep', shelfLife: 'daily', yieldLossPct: 50,
    batch: { fullG: 250, label: 'one bag' },
    inputs: [{ ref: 'parsley', grams: 500 }],
    when: 'on-day', section: 'prep',
    equipment: ['Knife', 'Board', 'GN 1:1, 20 cm'],
    roundTo: 'pack', carryable: false, provenance: 'pdf',
    note: 'Delivered fresh daily. One 500 g bag gives 250 g chopped. Shared by Amba, Harissa, Chickpea + Pickles and the Green Shifka dressing.',
  },

  // ── Broccoli ────────────────────────────────────────────────────────────
  'sesame-mix': {
    id: 'sesame-mix', name: 'Sesame seed mix 50/50', kind: 'mix', shelfLife: 'weekly', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [{ ref: 'black-sesame', grams: 500 }, { ref: 'white-sesame', grams: 500 }],
    when: 'scheduled', section: 'prep', roundTo: 'kilo', carryable: true, provenance: 'pdf',
  },
  'sesame-garlic-oil': {
    id: 'sesame-garlic-oil', name: 'Sesame garlic oil dressing', kind: 'dressing', shelfLife: 'blue4', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [{ ref: 'oil-blend', grams: 901 }, { ref: 'sesame-oil', grams: 90 }, { ref: 'garlic', grams: 9 }],
    when: 'scheduled', section: 'prep', roundTo: 'kilo', carryable: true, provenance: 'pdf',
  },
  'broccoli-roasted': {
    id: 'broccoli-roasted', name: 'Broccoli, roasted', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 20,
    batch: { fullG: 2150 },
    inputs: [{ ref: 'broccoli', grams: 2500 }, { ref: 'sesame-garlic-oil', grams: 150 }, { ref: 'sea-salt', grams: 12 }, { ref: 'sesame-mix', grams: 28 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 2,
    cook: { programme: 'Lunch Program', minutes: 9 },
    roundTo: 'batch', carryable: true, provenance: 'pdf',
  },
  'ponzu-dressing': {
    id: 'ponzu-dressing', name: 'Lemon soy ponzu dressing', kind: 'dressing', shelfLife: 'blue4', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [{ ref: 'lemon-juice', grams: 363 }, { ref: 'soy-sauce', grams: 546 }, { ref: 'maple-syrup', grams: 91 }],
    when: 'scheduled', section: 'prep', roundTo: 'kilo', carryable: true, provenance: 'pdf',
  },

  // ── Chickpea + Pickles ──────────────────────────────────────────────────
  'zaatar-chickpeas': {
    id: 'zaatar-chickpeas', name: "Za'atar chickpeas", kind: 'cooked', shelfLife: 'daily', yieldLossPct: 21,
    batch: { fullG: 1290, label: 'one tin' },
    inputs: [{ ref: 'chickpeas-tin', grams: 1500 }, { ref: 'zaatar', grams: 35 }, { ref: 'sea-salt', grams: 11 }, { ref: 'veg-oil', grams: 91 }],
    when: 'day-before', section: 'prep', container: 'gn-1-1-20',
    cook: { programme: 'Lunch Program', minutes: 12 },
    roundTo: 'batch', carryable: true, provenance: 'pdf',
    note: 'Made the day before so they cool. Weekend-closed shops do this Sunday or first thing.',
  },
  'cucumber-prep': {
    id: 'cucumber-prep', name: 'Cucumber prep', kind: 'prep', shelfLife: 'daily', yieldLossPct: 40,
    batch: { fullG: 600, label: 'per kg gross' },
    inputs: [{ ref: 'cucumber', grams: 1000 }],
    when: 'day-before', section: 'prep', equipment: ['Food processor (slicing)', 'Scale'],
    roundTo: 'exact', carryable: true, provenance: 'pdf',
    note: 'Weigh, wash and pre-cut the day before; slice on the day. Gross weight is what the team is told.',
  },
  'green-pepper-prep': {
    id: 'green-pepper-prep', name: 'Green pepper prep', kind: 'prep', shelfLife: 'daily', yieldLossPct: 25,
    batch: { fullG: 750, label: 'per kg gross' },
    inputs: [{ ref: 'green-pepper', grams: 1000 }],
    when: 'day-before', section: 'prep', equipment: ['Food processor (slicing)', 'Scale'],
    roundTo: 'exact', carryable: true, provenance: 'pdf',
  },
  'red-onion-prep': {
    id: 'red-onion-prep', name: 'Red pickled onion, decanted', kind: 'prep', shelfLife: 'blue4', yieldLossPct: 50,
    batch: { fullG: 500, label: 'one tub' },
    inputs: [{ ref: 'red-onion-tub', grams: 1000 }],
    when: 'scheduled', section: 'prep', roundTo: 'pack', carryable: true, provenance: 'pdf',
    note: 'Also a Fieldtray topping.',
  },
  'pickled-cucumber-prep': {
    id: 'pickled-cucumber-prep', name: 'Pickled cucumber, sliced', kind: 'prep', shelfLife: 'blue4', yieldLossPct: 12,
    batch: { fullG: 1496, label: 'one can' },
    inputs: [{ ref: 'pickled-cucumber-can', grams: 1700 }],
    when: 'scheduled', section: 'prep', equipment: ['Food processor (slicing)'],
    roundTo: 'pack', carryable: true, htcCode: 'Pickled Cucumber Prep NEW', provenance: 'pdf',
    note: 'Also a Fieldtray topping.',
  },
  'chickpea-kit': {
    id: 'chickpea-kit', name: 'Chickpea + Pickles kit', kind: 'kit', shelfLife: 'daily', yieldLossPct: 0,
    batch: { fullG: 3490, halfG: 1745 },
    inputs: [
      { ref: 'zaatar-chickpeas', grams: 1000 }, { ref: 'white-cabbage', grams: 600 }, { ref: 'cucumber-prep', grams: 400 }, { ref: 'green-pepper-prep', grams: 800 },
      { ref: 'red-onion-prep', grams: 200 }, { ref: 'pickled-cucumber-prep', grams: 300 }, { ref: 'shifka-prep', grams: 150 }, { ref: 'parsley-prep', grams: 40 },
    ],
    when: 'on-day', section: 'salads', container: 'gn-1-1-20',
    roundTo: 'batch', carryable: true, holdMinutes: 720, htcCode: 'Chickpea + Pickles', provenance: 'pdf',
    note: 'Undressed kit holds 12 hours. Dressed salad holds 2 hours.',
  },
  'lemon-tahini': {
    id: 'lemon-tahini', name: 'Lemon tahini dressing', kind: 'dressing', shelfLife: 'blue4', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [{ ref: 'cumin', grams: 5 }, { ref: 'sea-salt', grams: 24 }, { ref: 'garlic', grams: 2 }, { ref: 'lemon-juice', grams: 174 }, { ref: 'water', grams: 262 }, { ref: 'olive-oil', grams: 291 }, { ref: 'tahini', grams: 242 }],
    when: 'scheduled', section: 'prep', container: 'gn-1-1-20', roundTo: 'kilo', carryable: true, htcCode: 'SPRML-18032025v1', provenance: 'pdf',
  },

  // ── Smoked Chilli Miso Tofu bowl ────────────────────────────────────────
  'loose-miso-dressing': {
    id: 'loose-miso-dressing', name: 'Loose Miso dressing', kind: 'dressing', shelfLife: 'green3', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [{ ref: 'miso', grams: 400 }, { ref: 'mirin', grams: 200 }, { ref: 'rice-vinegar', grams: 100 }, { ref: 'sesame-oil', grams: 100 }, { ref: 'water', grams: 200 }],
    when: 'scheduled', section: 'prep', container: 'gn-1-1-20', roundTo: 'kilo', carryable: true, provenance: 'invented',
    note: 'Recipe card was image-only. Quantities invented for the demo.',
  },
  'loose-miso-hispi': {
    id: 'loose-miso-hispi', name: 'Loose Miso hispi', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 25,
    batch: { fullG: 2625, label: 'one 3 kg bag, 3 trays' },
    inputs: [{ ref: 'hispi', grams: 3000 }, { ref: 'loose-miso-dressing', grams: 500 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 3,
    equipment: ['GN 1:1, 20 cm', 'Orange ladle', 'Baking paper', 'Disposable gloves'],
    cook: { programme: 'Lunch Program', minutes: 7 },
    roundTo: 'batch', carryable: true, htcCode: 'WINML-26112024v1',
    steps: ['One 3 kg bag of hispi into the GN 1:1', 'Two orange ladles of Loose Miso dressing, mix until coated', 'Three lined trays, spread evenly (1 batch = 3 trays)', 'Lunch Program, 7 min. Cook immediately', 'Cool, portion, refrigerate'],
    provenance: 'pdf',
    yieldNote: 'Jana: four 3 kg bags plus 500 g dressing, minus 25 percent, divided by 500 g portions gives kits.',
    note: 'Shared by the tofu bowl and the Sesame Cabbage base.',
  },
  'loose-miso-aubergine': {
    id: 'loose-miso-aubergine', name: 'Loose Miso aubergine', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 30,
    batch: { fullG: 2380 },
    inputs: [{ ref: 'aubergine', grams: 3000 }, { ref: 'loose-miso-dressing', grams: 400 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 3,
    cook: { programme: 'Lunch Program', minutes: 12 },
    roundTo: 'batch', carryable: true, provenance: 'invented',
    note: 'Recipe card was image-only. Quantities invented; loss set at 30%.',
  },
  'coconut-chilli-dressing': {
    id: 'coconut-chilli-dressing', name: 'Smoked chilli coconut dressing', kind: 'dressing', shelfLife: 'coconut2', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [{ ref: 'coconut-milk', grams: 600 }, { ref: 'smoked-chilli-paste', grams: 150 }, { ref: 'lime-juice', grams: 100 }, { ref: 'sugar', grams: 50 }, { ref: 'sea-salt', grams: 10 }, { ref: 'water', grams: 90 }],
    when: 'scheduled', section: 'prep', container: 'gn-1-1-20', roundTo: 'kilo', carryable: true, provenance: 'invented',
    note: 'Coconut milk puts it on the two-day calendar.',
  },
  'tofu-baked': {
    id: 'tofu-baked', name: 'Smoked chilli miso tofu, baked', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 15,
    batch: { fullG: 1870 },
    inputs: [{ ref: 'tofu', grams: 2000 }, { ref: 'smoked-chilli-paste', grams: 100 }, { ref: 'miso', grams: 100 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 2,
    cook: { programme: 'Lunch Program', minutes: 14 },
    roundTo: 'batch', carryable: true, provenance: 'invented',
  },

  // ── Cashew Kale Miso Slaw (invented) ────────────────────────────────────
  'kale-prep': {
    id: 'kale-prep', name: 'Kale, stripped and washed', kind: 'prep', shelfLife: 'daily', yieldLossPct: 30,
    batch: { fullG: 1050, label: 'per 1.5 kg gross' },
    inputs: [{ ref: 'kale', grams: 1500 }],
    when: 'day-before', section: 'prep', roundTo: 'exact', carryable: true, provenance: 'invented',
    yieldNote: 'Seasonal. Jana: kale changes in April. Set 30% now; she edits it.',
  },
  'cashew-miso-dressing': {
    id: 'cashew-miso-dressing', name: 'Cashew miso dressing', kind: 'dressing', shelfLife: 'green3', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [{ ref: 'cashew-butter', grams: 300 }, { ref: 'miso', grams: 150 }, { ref: 'rice-vinegar', grams: 150 }, { ref: 'maple-syrup', grams: 100 }, { ref: 'water', grams: 250 }, { ref: 'veg-oil', grams: 50 }],
    when: 'scheduled', section: 'prep', container: 'gn-1-1-20', roundTo: 'kilo', carryable: true, provenance: 'invented',
  },
  'kale-slaw-kit': {
    id: 'kale-slaw-kit', name: 'Kale slaw kit', kind: 'kit', shelfLife: 'daily', yieldLossPct: 0,
    batch: { fullG: 2450, halfG: 1225 },
    inputs: [{ ref: 'kale-prep', grams: 1050 }, { ref: 'red-cabbage', grams: 600 }, { ref: 'carrot', grams: 400 }, { ref: 'cashews', grams: 300 }, { ref: 'spring-onion', grams: 100 }],
    when: 'on-day', section: 'salads', container: 'gn-1-1-20', roundTo: 'batch', carryable: true, holdMinutes: 720, provenance: 'invented',
  },

  // ── Breakfast (invented) ────────────────────────────────────────────────
  'coconut-chia': {
    id: 'coconut-chia', name: 'Coconut chia', kind: 'cooked', shelfLife: 'coconut2', yieldLossPct: 0,
    batch: { fullG: 2030, label: 'about 13 pots' },
    inputs: [{ ref: 'coconut-milk', grams: 1600 }, { ref: 'chia', grams: 300 }, { ref: 'maple-syrup', grams: 120 }, { ref: 'vanilla', grams: 10 }],
    when: 'scheduled', section: 'prep', container: 'breakfast-pot', containersPerBatch: 13,
    roundTo: 'batch', carryable: true, provenance: 'invented',
    note: 'Made Monday for Tuesday and Wednesday. Coconut milk puts it on the two-day calendar.',
  },

  // ── Simple sides and proteins (bought in or one-step) ───────────────────
  'salmon-cooked': {
    id: 'salmon-cooked', name: 'Gotcha salmon, cooked', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 25,
    batch: { fullG: 1500, label: 'one bag, one tray' }, inputs: [{ ref: 'salmon-bag', grams: 2000 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 1,
    cook: { programme: 'Fish Program', minutes: 10, coreTempC: 63 }, roundTo: 'batch', carryable: false, holdMinutes: 60, provenance: 'invented',
  },
  'steak-cooked': {
    id: 'steak-cooked', name: 'Steak, cooked and sliced', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 25,
    batch: { fullG: 1500, label: 'one bag' }, inputs: [{ ref: 'steak-bag', grams: 2000 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 1,
    cook: { programme: 'Grill', minutes: 8 }, roundTo: 'batch', carryable: true, holdMinutes: 60, provenance: 'invented',
  },
  'cauliflower-roasted': {
    id: 'cauliflower-roasted', name: 'Cauliflower, roasted', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 24,
    batch: { fullG: 1900 }, inputs: [{ ref: 'cauliflower', grams: 2500 }, { ref: 'veg-oil', grams: 60 }, { ref: 'sea-salt', grams: 12 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 2,
    cook: { programme: 'Lunch Program', minutes: 12 }, roundTo: 'batch', carryable: true, provenance: 'invented',
  },
  'sweet-potato-roasted': {
    id: 'sweet-potato-roasted', name: 'Sweet potato, roasted', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 24,
    batch: { fullG: 1900 }, inputs: [{ ref: 'sweet-potato', grams: 2500 }, { ref: 'veg-oil', grams: 60 }, { ref: 'sea-salt', grams: 12 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 2,
    cook: { programme: 'Lunch Program', minutes: 14 }, roundTo: 'batch', carryable: true, provenance: 'invented',
  },
  'mac-cheese-baked': {
    id: 'mac-cheese-baked', name: 'Mac & cheese, baked', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 0,
    batch: { fullG: 3000, label: 'one tray' }, inputs: [{ ref: 'mac-cheese-tray', grams: 3000 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 1,
    cook: { programme: 'Lunch Program', minutes: 18 }, roundTo: 'batch', carryable: false, holdMinutes: 90, provenance: 'invented',
  },
  'parmesan-potatoes': {
    id: 'parmesan-potatoes', name: 'Parmesan potatoes, roasted', kind: 'cooked', shelfLife: 'daily', yieldLossPct: 15,
    batch: { fullG: 2200 }, inputs: [{ ref: 'baby-potatoes', grams: 2500 }, { ref: 'parmesan', grams: 120 }, { ref: 'veg-oil', grams: 60 }],
    when: 'on-day', section: 'hot', container: 'oven-tray', containersPerBatch: 2,
    cook: { programme: 'Lunch Program', minutes: 18 }, roundTo: 'batch', carryable: true, provenance: 'invented',
  },
  'caesar-dressing': {
    id: 'caesar-dressing', name: 'Caesar dressing', kind: 'dressing', shelfLife: 'green3', yieldLossPct: 0,
    batch: { fullG: 1000 },
    inputs: [{ ref: 'sea-salt', grams: 35 }, { ref: 'black-pepper', grams: 5 }, { ref: 'garlic', grams: 15 }, { ref: 'dijon', grams: 70 }, { ref: 'parmesan', grams: 100 }, { ref: 'mayonnaise', grams: 175 }, { ref: 'lemon-juice', grams: 150 }, { ref: 'olive-oil', grams: 250 }, { ref: 'veg-oil', grams: 200 }],
    when: 'scheduled', section: 'prep', container: 'gn-1-1-20', roundTo: 'kilo', carryable: true, htcCode: 'SPRML-18032025v1', provenance: 'pdf',
  },
  'feta-caesar-kit': {
    id: 'feta-caesar-kit', name: 'Spring feta Caesar kit', kind: 'kit', shelfLife: 'daily', yieldLossPct: 0,
    batch: { fullG: 2400, halfG: 1200 },
    inputs: [{ ref: 'romaine', grams: 1600 }, { ref: 'feta', grams: 400 }, { ref: 'cucumber-prep', grams: 400 }],
    when: 'on-day', section: 'salads', roundTo: 'batch', carryable: true, holdMinutes: 720, provenance: 'invented',
  },
  'iow-tomato-kit': {
    id: 'iow-tomato-kit', name: 'IOW tomato salad kit', kind: 'kit', shelfLife: 'daily', yieldLossPct: 5,
    batch: { fullG: 2280, halfG: 1140 },
    inputs: [{ ref: 'iow-tomatoes', grams: 2000 }, { ref: 'red-onion-prep', grams: 200 }, { ref: 'olive-oil', grams: 100 }, { ref: 'sea-salt', grams: 10 }],
    when: 'on-day', section: 'salads', roundTo: 'batch', carryable: false, holdMinutes: 240, provenance: 'invented',
  },
  'sesame-cabbage-kit': {
    id: 'sesame-cabbage-kit', name: 'Sesame cabbage kit', kind: 'kit', shelfLife: 'daily', yieldLossPct: 0,
    batch: { fullG: 2300, halfG: 1150 },
    inputs: [{ ref: 'hispi', grams: 1500 }, { ref: 'loose-miso-hispi', grams: 600 }, { ref: 'sesame-garlic-oil', grams: 150 }, { ref: 'sesame-mix', grams: 50 }],
    when: 'on-day', section: 'salads', roundTo: 'batch', carryable: true, holdMinutes: 720, provenance: 'invented',
    note: 'Assumed to share the Loose Miso hispi with the tofu bowl. Jana to confirm which dish shares it.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Finished products (the only rows on the day plan)
// ─────────────────────────────────────────────────────────────────────────────

export type ProductGroup = 'breakfast' | 'bases' | 'proteins' | 'hot-sides' | 'salads';

export const PRODUCT_GROUP_LABELS: Record<ProductGroup, string> = {
  breakfast: 'Breakfast',
  bases: 'Bases',
  proteins: 'Proteins',
  'hot-sides': 'Hot sides',
  salads: 'Salads',
};

export type FinishedProduct = {
  id: string;
  name: string;
  group: ProductGroup;
  /** Main-line service unit: what one "1" on the day plan means. */
  unit: ContainerId;
  /**
   * How many main-line units one full batch fills. Rice: one cooker fills
   * about 7 cast irons. Chicken: one bag is one cast iron. Salads: a
   * gastronorm holds a half batch, so 2 per batch.
   */
  unitsPerBatch: number;
  /**
   * The second make line plates into gastronorms. For hot items a
   * gastronorm holds half a cast iron (0.5). For salads it is the same
   * gastronorm as the main line (1).
   */
  secondLineFraction: number;
  /**
   * What one full batch of the finished product is made from, in grams,
   * and how much it yields net. For rice a batch is one cooker (about 7
   * cast irons); for chicken a batch is one bag (one cast iron).
   */
  batch: { fullG: number; halfG?: number };
  recipe: LineItem[];
  /** Loss on assembly (dressed salads lose a little). */
  yieldLossPct: number;
  /** How long it holds on the line once plated or dressed. */
  holdMinutes: number;
  /** True when the kitchen can make a half (off-peak, evenings, second line). */
  halfBatch: boolean;
  /** Which component is the "cooked thing" the close counts, if any. */
  countedAs?: string;
  section: Section;
  provenance: Provenance;
  note?: string;
};

export const PRODUCTS: FinishedProduct[] = [
  // Breakfast
  {
    id: 'coconut-chia', name: 'Coconut chia', group: 'breakfast', unit: 'breakfast-pot',
    unitsPerBatch: 13, secondLineFraction: 1,
    batch: { fullG: 2030 }, recipe: [{ ref: 'coconut-chia', grams: 2030 }], yieldLossPct: 0,
    holdMinutes: 2880, halfBatch: false, countedAs: 'coconut-chia', section: 'prep', provenance: 'invented',
    note: 'Breakfast shops only. Made Monday for Tuesday and Wednesday.',
  },
  // Bases
  {
    id: 'rice', name: "Farmers' Rice", group: 'bases', unit: 'round-cast-iron',
    unitsPerBatch: 7, secondLineFraction: 0.5,
    batch: { fullG: 17000, halfG: 8500 },
    recipe: [{ ref: 'rice-cooked', grams: 17000 }, { ref: 'lemon-juice', grams: 683 }, { ref: 'oil-blend', grams: 585 }],
    yieldLossPct: 0, holdMinutes: 60, halfBatch: true, countedAs: 'rice-cooked', section: 'hot', provenance: 'pdf',
    note: 'One batch is one rice cooker, about 7 cast irons. Each cast iron is seasoned with about 90 g lemon juice and 100 g oil from squeezy bottles.',
  },
  {
    id: 'grains', name: "Farmers' Grains", group: 'bases', unit: 'round-cast-iron',
    unitsPerBatch: 3, secondLineFraction: 0.5,
    batch: { fullG: 7500 },
    recipe: [{ ref: 'grains-cooked', grams: 7500 }, { ref: 'cauli-grains-dressing', grams: 660 }],
    yieldLossPct: 0, holdMinutes: 60, halfBatch: false, countedAs: 'grains-cooked', section: 'hot', provenance: 'pdf',
    note: 'One batch is about 3 cast irons. Each cast iron takes about 210 g cauliflower and grains dressing.',
  },
  {
    id: 'sesame-cabbage', name: 'Sesame cabbage', group: 'bases', unit: 'salad-gn',
    unitsPerBatch: 2, secondLineFraction: 1,
    batch: { fullG: 2300, halfG: 1150 }, recipe: [{ ref: 'sesame-cabbage-kit', grams: 2300 }],
    yieldLossPct: 0, holdMinutes: 720, halfBatch: true, countedAs: 'sesame-cabbage-kit', section: 'salads', provenance: 'invented',
  },
  {
    id: 'spinach', name: 'Spinach', group: 'bases', unit: 'salad-gn',
    unitsPerBatch: 2, secondLineFraction: 1,
    batch: { fullG: 2000 }, recipe: [{ ref: 'spinach', grams: 2000 }],
    yieldLossPct: 0, holdMinutes: 720, halfBatch: false, section: 'salads', provenance: 'invented',
    note: 'Bought in washed. No prep, just open and fill.',
  },
  // Proteins
  {
    id: 'amba', name: 'Amba chicken', group: 'proteins', unit: 'rect-cast-iron',
    unitsPerBatch: 1, secondLineFraction: 0.5,
    batch: { fullG: 1425 },
    recipe: [{ ref: 'amba-cooked', grams: 1200 }, { ref: 'amba-dressing', grams: 120 }, { ref: 'green-shifka-tahini', grams: 100 }, { ref: 'parsley-prep', grams: 5 }],
    yieldLossPct: 0, holdMinutes: 30, halfBatch: false, countedAs: 'amba-cooked', section: 'hot', provenance: 'pdf',
    note: 'One bag, one tray, one cast iron. Dressed with Amba dressing and Green Shifka tahini, finished with parsley.',
  },
  {
    id: 'harissa', name: 'Harissa chicken', group: 'proteins', unit: 'rect-cast-iron',
    unitsPerBatch: 1, secondLineFraction: 0.5,
    batch: { fullG: 1290 },
    recipe: [{ ref: 'harissa-cooked', grams: 1200 }, { ref: 'harissa-dressing', grams: 80 }, { ref: 'parsley-prep', grams: 10 }],
    yieldLossPct: 0, holdMinutes: 30, halfBatch: false, countedAs: 'harissa-cooked', section: 'hot', provenance: 'pdf',
  },
  {
    id: 'salmon', name: 'Gotcha salmon', group: 'proteins', unit: 'rect-cast-iron',
    unitsPerBatch: 1, secondLineFraction: 0.5,
    batch: { fullG: 1500 }, recipe: [{ ref: 'salmon-cooked', grams: 1500 }],
    yieldLossPct: 0, holdMinutes: 60, halfBatch: false, countedAs: 'salmon-cooked', section: 'hot', provenance: 'invented',
  },
  {
    id: 'steak', name: 'Steak', group: 'proteins', unit: 'rect-cast-iron',
    unitsPerBatch: 1, secondLineFraction: 0.5,
    batch: { fullG: 1500 }, recipe: [{ ref: 'steak-cooked', grams: 1500 }],
    yieldLossPct: 0, holdMinutes: 60, halfBatch: false, countedAs: 'steak-cooked', section: 'hot', provenance: 'invented',
  },
  {
    id: 'tofu', name: 'Smoked chilli miso tofu', group: 'proteins', unit: 'rect-cast-iron',
    unitsPerBatch: 1, secondLineFraction: 0.5,
    batch: { fullG: 1200 },
    recipe: [{ ref: 'tofu-baked', grams: 600 }, { ref: 'loose-miso-hispi', grams: 250 }, { ref: 'loose-miso-aubergine', grams: 250 }, { ref: 'coconut-chilli-dressing', grams: 60 }, { ref: 'loose-miso-dressing', grams: 40 }],
    yieldLossPct: 0, holdMinutes: 30, halfBatch: false, countedAs: 'tofu-baked', section: 'hot', provenance: 'invented',
    note: 'Cast iron make-up invented. The hispi and aubergine preps are from the cards; the tofu card was image-only.',
  },
  // Hot sides
  {
    id: 'broccoli', name: 'Ponzu sesame broccoli', group: 'hot-sides', unit: 'rect-cast-iron',
    unitsPerBatch: 1, secondLineFraction: 0.5,
    batch: { fullG: 1290 },
    recipe: [{ ref: 'broccoli-roasted', grams: 1200 }, { ref: 'ponzu-dressing', grams: 90 }],
    yieldLossPct: 0, holdMinutes: 60, halfBatch: false, countedAs: 'broccoli-roasted', section: 'hot', provenance: 'pdf',
  },
  {
    id: 'cauliflower', name: 'Cauliflower', group: 'hot-sides', unit: 'rect-cast-iron',
    unitsPerBatch: 1, secondLineFraction: 0.5,
    batch: { fullG: 1200 }, recipe: [{ ref: 'cauliflower-roasted', grams: 1200 }],
    yieldLossPct: 0, holdMinutes: 60, halfBatch: false, countedAs: 'cauliflower-roasted', section: 'hot', provenance: 'invented',
  },
  {
    id: 'sweet-potato', name: 'Sweet potato', group: 'hot-sides', unit: 'rect-cast-iron',
    unitsPerBatch: 1, secondLineFraction: 0.5,
    batch: { fullG: 1200 }, recipe: [{ ref: 'sweet-potato-roasted', grams: 1200 }],
    yieldLossPct: 0, holdMinutes: 60, halfBatch: false, countedAs: 'sweet-potato-roasted', section: 'hot', provenance: 'invented',
  },
  {
    id: 'mac-cheese', name: 'Mac & cheese', group: 'hot-sides', unit: 'rect-cast-iron',
    unitsPerBatch: 1, secondLineFraction: 0.5,
    batch: { fullG: 1200 }, recipe: [{ ref: 'mac-cheese-baked', grams: 1200 }],
    yieldLossPct: 0, holdMinutes: 90, halfBatch: false, countedAs: 'mac-cheese-baked', section: 'hot', provenance: 'invented',
  },
  {
    id: 'parmesan-potatoes', name: 'Parmesan potatoes', group: 'hot-sides', unit: 'rect-cast-iron',
    unitsPerBatch: 1, secondLineFraction: 0.5,
    batch: { fullG: 1200 }, recipe: [{ ref: 'parmesan-potatoes', grams: 1200 }],
    yieldLossPct: 0, holdMinutes: 60, halfBatch: false, countedAs: 'parmesan-potatoes', section: 'hot', provenance: 'invented',
  },
  // Salads
  {
    id: 'chickpea-pickles', name: 'Chickpea + Pickles', group: 'salads', unit: 'salad-gn',
    unitsPerBatch: 2, secondLineFraction: 1,
    batch: { fullG: 3600, halfG: 1800 },
    recipe: [{ ref: 'chickpea-kit', grams: 3490 }, { ref: 'lemon-tahini', grams: 500 }, { ref: 'parsley-prep', grams: 10 }, { ref: 'sumac', grams: 4 }],
    yieldLossPct: 10, holdMinutes: 120, halfBatch: true, countedAs: 'chickpea-kit', section: 'salads', provenance: 'pdf',
    note: 'Dressed salad holds 2 hours; the undressed kit holds 12. Plan in half batches through the afternoon.',
  },
  {
    id: 'kale-slaw', name: 'Cashew kale miso slaw', group: 'salads', unit: 'salad-gn',
    unitsPerBatch: 2, secondLineFraction: 1,
    batch: { fullG: 2850, halfG: 1425 },
    recipe: [{ ref: 'kale-slaw-kit', grams: 2450 }, { ref: 'cashew-miso-dressing', grams: 400 }],
    yieldLossPct: 0, holdMinutes: 120, halfBatch: true, countedAs: 'kale-slaw-kit', section: 'salads', provenance: 'invented',
    note: 'Invented for the demo. Real recipe needed from Jana.',
  },
  {
    id: 'iow-tomato', name: 'IOW tomato', group: 'salads', unit: 'salad-gn',
    unitsPerBatch: 2, secondLineFraction: 1,
    batch: { fullG: 2280, halfG: 1140 }, recipe: [{ ref: 'iow-tomato-kit', grams: 2280 }],
    yieldLossPct: 0, holdMinutes: 240, halfBatch: true, countedAs: 'iow-tomato-kit', section: 'salads', provenance: 'invented',
  },
  {
    id: 'feta-caesar', name: 'Spring feta Caesar', group: 'salads', unit: 'salad-gn',
    unitsPerBatch: 2, secondLineFraction: 1,
    batch: { fullG: 2700, halfG: 1350 },
    recipe: [{ ref: 'feta-caesar-kit', grams: 2400 }, { ref: 'caesar-dressing', grams: 300 }],
    yieldLossPct: 0, holdMinutes: 120, halfBatch: true, countedAs: 'feta-caesar-kit', section: 'salads', provenance: 'invented',
  },
];

export const PRODUCT_BY_ID: Record<string, FinishedProduct> = Object.fromEntries(
  PRODUCTS.map(p => [p.id, p]),
);

export function getProduct(id: string): FinishedProduct | undefined {
  return PRODUCT_BY_ID[id];
}

export function getComponent(id: string): Component | undefined {
  return COMPONENTS[id];
}

export function getIngredient(id: string): Ingredient | undefined {
  return INGREDIENTS[id];
}

// ─────────────────────────────────────────────────────────────────────────────
// Till codes → grammes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How a till line turns into grams of finished product (or, for sauces and
 * toppings, grams of a component directly). This is the "sales × grammes ÷
 * batch size gives batches" rule from the calls, made explicit per format.
 *
 * Gramme weights per format are from the calls (side 100 g, main 200 g,
 * buffet 400 g, family 600 g; protein 100 g on a tray, 70 g in a bowl).
 * Base weight on a tray (150 g) and bowl base (120 g) are our estimates.
 * Set trays are our reading of the menu. All editable in Setup.
 */
export type TillYield = { ref: string; grams: number; kind: 'product' | 'component' };

export const PORTION_GRAMS = {
  trayProtein: 100,
  bowlProtein: 70,
  trayBase: 150,
  bowlBase: 120,
  side: 100,
  extraMain: 100,
  extraSide: 100,
  hotSideAsMain: 150,
  familyBase: 600,
  familySide: 400,
  sauce: 30,
  topping: 25,
} as const;

/** Till names → product ids. Covers every spelling in the export. */
const NAME_TO_PRODUCT: Record<string, string> = {
  'Rice': 'rice',
  'Brown Rice': 'rice',
  "Farmer's Grains": 'grains',
  'Sesame Cabbage': 'sesame-cabbage',
  'Spinach': 'spinach',
  'Amba Chicken': 'amba',
  'Harissa Chicken': 'harissa',
  'Salmon': 'salmon',
  'Gotcha Salmon': 'salmon',
  'Steak': 'steak',
  'Tofu': 'tofu',
  'Broccoli': 'broccoli',
  'Cauliflower': 'cauliflower',
  'Sweet Potato': 'sweet-potato',
  'Mac & Cheese': 'mac-cheese',
  'Parmesan Potatoes': 'parmesan-potatoes',
  'Chickpea + Pickles': 'chickpea-pickles',
  'Cashew Kale Miso Slaw': 'kale-slaw',
  'IOW Tomato': 'iow-tomato',
  'IOW Tomatoes': 'iow-tomato',
  'Spring Feta Caesar': 'feta-caesar',
};

const HOT_SIDE_IDS = new Set(['broccoli', 'cauliflower', 'sweet-potato', 'mac-cheese', 'parmesan-potatoes']);

function productFor(name: string): string | undefined {
  return NAME_TO_PRODUCT[name.trim()];
}

/** Set trays: our reading of what is in each. Editable in Setup. */
const SET_TRAYS: Record<string, TillYield[]> = {
  'The Amba': [
    { ref: 'amba', grams: PORTION_GRAMS.trayProtein, kind: 'product' },
    { ref: 'rice', grams: PORTION_GRAMS.trayBase, kind: 'product' },
    { ref: 'chickpea-pickles', grams: PORTION_GRAMS.side, kind: 'product' },
    { ref: 'kale-slaw', grams: PORTION_GRAMS.side, kind: 'product' },
  ],
  "J`s Classic": [
    { ref: 'harissa', grams: PORTION_GRAMS.trayProtein, kind: 'product' },
    { ref: 'rice', grams: PORTION_GRAMS.trayBase, kind: 'product' },
    { ref: 'broccoli', grams: PORTION_GRAMS.side, kind: 'product' },
    { ref: 'sweet-potato', grams: PORTION_GRAMS.side, kind: 'product' },
  ],
  "Butcher`s Cut": [
    { ref: 'steak', grams: PORTION_GRAMS.trayProtein, kind: 'product' },
    { ref: 'grains', grams: PORTION_GRAMS.trayBase, kind: 'product' },
    { ref: 'parmesan-potatoes', grams: PORTION_GRAMS.side, kind: 'product' },
    { ref: 'iow-tomato', grams: PORTION_GRAMS.side, kind: 'product' },
  ],
  "Farmer`s Catch": [
    { ref: 'salmon', grams: PORTION_GRAMS.trayProtein, kind: 'product' },
    { ref: 'rice', grams: PORTION_GRAMS.trayBase, kind: 'product' },
    { ref: 'broccoli', grams: PORTION_GRAMS.side, kind: 'product' },
    { ref: 'sesame-cabbage', grams: PORTION_GRAMS.side, kind: 'product' },
  ],
  'Where My Vegans At?': [
    { ref: 'tofu', grams: PORTION_GRAMS.trayProtein, kind: 'product' },
    { ref: 'grains', grams: PORTION_GRAMS.trayBase, kind: 'product' },
    { ref: 'kale-slaw', grams: PORTION_GRAMS.side, kind: 'product' },
    { ref: 'chickpea-pickles', grams: PORTION_GRAMS.side, kind: 'product' },
  ],
};

/**
 * Map one till line (category + name) to what it consumes. Returns an
 * empty array for drinks, snacks and anything the kitchen does not make.
 */
export function tillYields(category: string, name: string): TillYield[] {
  const n = name.trim();
  switch (category) {
    case 'FT Grains': {
      const id = productFor(n);
      return id ? [{ ref: id, grams: PORTION_GRAMS.trayBase, kind: 'product' }] : [];
    }
    case 'FT Sides': {
      const id = productFor(n);
      return id ? [{ ref: id, grams: PORTION_GRAMS.side, kind: 'product' }] : [];
    }
    case 'Field Trays': {
      const id = productFor(n.replace(/ Fieldtray Main$/, ''));
      if (!id) return [];
      // A hot side sold as the main is a bigger portion. Base and sides
      // arrive as their own FT Grains / FT Sides rows.
      return [{ ref: id, grams: HOT_SIDE_IDS.has(id) ? PORTION_GRAMS.hotSideAsMain : PORTION_GRAMS.trayProtein, kind: 'product' }];
    }
    case 'Fieldbowls': {
      const id = productFor(n.replace(/^The /, '').replace(/ Bowl$/, '').replace(/^Amba$/, 'Amba Chicken').replace(/^Harissa$/, 'Harissa Chicken'));
      if (!id) return [];
      // Bowls do not produce FT Grains rows, so the base is counted here.
      // Assumed rice; Jana to confirm bowl builds.
      return [
        { ref: id, grams: PORTION_GRAMS.bowlProtein, kind: 'product' },
        { ref: 'rice', grams: PORTION_GRAMS.bowlBase, kind: 'product' },
      ];
    }
    case 'Individual Portion': {
      const isMain = / Extra Main$/.test(n);
      const id = productFor(n.replace(/ Extra (Main|Side)$/, ''));
      return id ? [{ ref: id, grams: isMain ? PORTION_GRAMS.extraMain : PORTION_GRAMS.extraSide, kind: 'product' }] : [];
    }
    case 'Set Fieldtrays':
      return SET_TRAYS[n] ?? [];
    case 'Fam Of 4': {
      const id = productFor(n.replace(/ X4$/, ''));
      if (!id) return [];
      return [{ ref: id, grams: id === 'rice' || id === 'grains' ? PORTION_GRAMS.familyBase : PORTION_GRAMS.familySide, kind: 'product' }];
    }
    case 'FT Sauces':
      return n === 'Green Tahini' ? [{ ref: 'green-shifka-tahini', grams: PORTION_GRAMS.sauce, kind: 'component' }] : [];
    case 'FT Extras':
    case 'Toppings':
      if (n === 'Pickled Cucumber') return [{ ref: 'pickled-cucumber-prep', grams: PORTION_GRAMS.topping, kind: 'component' }];
      if (n === 'Pickled Onion') return [{ ref: 'red-onion-prep', grams: PORTION_GRAMS.topping, kind: 'component' }];
      return [];
    default:
      return [];
  }
}

/** Categories that count as "trays" for the dashboard. */
export const TRAY_CATEGORIES = new Set(['Field Trays', 'Fieldbowls', 'Set Fieldtrays', 'Fam Of 4']);
