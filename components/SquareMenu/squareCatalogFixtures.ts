/**
 * Fitzroy Espresso's Square menu, as Edify sees it on 19 Nov 2026.
 *
 * Seeded so every till status shows on first load:
 *   Up to date        Flat white, House red, Coca-Cola, Smirnoff, Avocado toast
 *   Ready to publish  Latte (Edify raised the Large price), Blueberry muffin (taken off)
 *   Changed in Square Cappuccino (renamed), Americano (price), Croissant (deleted)
 *   Not on the till   Mocha (no till category yet)
 *   Can't publish     Iced latte (Syrups on the Large only)
 *   On the till only  Pumpkin spice latte, Staff coffee
 * plus Hazelnut, added to the Syrups group in Square.
 */

import type { SquareGroupChange, SquareOnlyItem, TillFields, TillItem } from './tillItems';

export const SQUARE_CATEGORIES = [
  'Coffee', 'Tea', 'Bakery', 'Breakfast', 'Lunch', 'Soft drinks', 'Wine', 'Spirits', 'Kids',
];

export const SQUARE_TAXES = ['Standard rate 20%', 'Zero rate 0%'];

/** Square locations and the Edify site each one maps to. */
export const SQUARE_LOCATIONS: { id: string; name: string; site: string }[] = [
  { id: 'sq-loc-fitzroy', name: 'Fitzroy St', site: 'Fitzroy Espresso' },
  { id: 'sq-loc-brixton', name: 'Brixton', site: 'Brixton Outpost' },
  { id: 'sq-loc-shoreditch', name: 'Shoreditch', site: 'Shoreditch Roast' },
  { id: 'sq-loc-soho', name: 'Soho', site: 'Soho Annex' },
];

const COFFEE_SIZES = ['Small (8oz)', 'Medium (12oz)', 'Large (16oz)'];

function fields(over: Partial<TillFields> & Pick<TillFields, 'name' | 'sizes' | 'prices'>): TillFields {
  return {
    kitchenName: '',
    category: '',
    groups: [],
    sites: [],
    vat: 'Standard rate 20%',
    description: '',
    photo: false,
    ...over,
  };
}

function settled(f: TillFields): Pick<TillItem, 'current' | 'published' | 'inSquare'> {
  const copy = () => JSON.parse(JSON.stringify(f)) as TillFields;
  return { current: copy(), published: copy(), inSquare: copy() };
}

const base = { laterKeys: [], overwriteKeys: [] };

// ── Till items ──────────────────────────────────────────────────────────────

const flatWhite = fields({
  name: 'Flat white',
  kitchenName: 'FW',
  category: 'Coffee',
  sizes: COFFEE_SIZES,
  prices: { 'Small (8oz)': 3.6, 'Medium (12oz)': 4.0, 'Large (16oz)': 4.4 },
  groups: ['mg-alt-milks', 'mg-syrups'],
  description: 'Double ristretto with silky steamed milk.',
  photo: true,
});

const latteBefore = fields({
  name: 'Latte',
  kitchenName: 'LAT',
  category: 'Coffee',
  sizes: COFFEE_SIZES,
  prices: { 'Small (8oz)': 3.8, 'Medium (12oz)': 4.2, 'Large (16oz)': 4.6 },
  groups: ['mg-alt-milks', 'mg-syrups'],
  photo: true,
});

const cappuccinoBefore = fields({
  name: 'Cappuccino',
  kitchenName: 'CAP',
  category: 'Coffee',
  sizes: COFFEE_SIZES,
  prices: { 'Small (8oz)': 3.6, 'Medium (12oz)': 4.0, 'Large (16oz)': 4.4 },
  groups: ['mg-alt-milks'],
  photo: true,
});

const americanoBefore = fields({
  name: 'Americano',
  kitchenName: 'AME',
  category: 'Coffee',
  sizes: ['Regular'],
  prices: { Regular: 3.2 },
  groups: ['mg-alt-milks'],
});

const croissant = fields({
  name: 'Croissant',
  category: 'Bakery',
  sizes: ['Regular'],
  prices: { Regular: 3.2 },
  vat: 'Zero rate 0%',
});

export const SEED_TILL_ITEMS: TillItem[] = [
  {
    ...base,
    id: 'ti-flat-white',
    source: { kind: 'recipe', recipeId: 'rec-flat-white' },
    posItemId: 'mi-flat-white',
    ...settled(flatWhite),
    sitePrices: { 'Large (16oz)': { 'Soho Annex': 4.6 } },
    sizeCosts: { 'Small (8oz)': 0.72, 'Medium (12oz)': 0.84, 'Large (16oz)': 0.98 },
    publishedByEdify: true,
  },
  {
    ...base,
    id: 'ti-latte',
    source: { kind: 'recipe', recipeId: 'rec-latte' },
    posItemId: 'mi-latte',
    published: latteBefore,
    inSquare: JSON.parse(JSON.stringify(latteBefore)),
    current: { ...JSON.parse(JSON.stringify(latteBefore)), prices: { 'Small (8oz)': 3.8, 'Medium (12oz)': 4.2, 'Large (16oz)': 4.8 } },
    sizeCosts: { 'Small (8oz)': 0.7, 'Medium (12oz)': 0.82, 'Large (16oz)': 1.02 },
    publishedByEdify: true,
  },
  {
    ...base,
    id: 'ti-cappuccino',
    source: { kind: 'recipe', recipeId: 'rec-cappuccino' },
    posItemId: 'mi-cappuccino',
    published: cappuccinoBefore,
    current: JSON.parse(JSON.stringify(cappuccinoBefore)),
    inSquare: { ...JSON.parse(JSON.stringify(cappuccinoBefore)), name: 'Cappo' },
    sizeCosts: { 'Small (8oz)': 0.7, 'Medium (12oz)': 0.81, 'Large (16oz)': 0.98 },
    squareChangedAt: '19 Nov, 08:42',
    squareChangedBy: 'Jess at Brixton',
  },
  {
    ...base,
    id: 'ti-americano',
    source: { kind: 'recipe', recipeId: 'rec-americano' },
    posItemId: 'mi-americano',
    published: americanoBefore,
    current: JSON.parse(JSON.stringify(americanoBefore)),
    inSquare: { ...JSON.parse(JSON.stringify(americanoBefore)), prices: { Regular: 3.4 } },
    sizeCosts: { Regular: 0.45 },
    squareChangedAt: '18 Nov, 17:05',
    squareChangedBy: 'Tom at Fitzroy St',
  },
  {
    ...base,
    id: 'ti-croissant',
    source: { kind: 'recipe', recipeId: 'rec-croissant' },
    posItemId: 'mi-croissant',
    ...settled(croissant),
    sizeCosts: { Regular: 0.95 },
    deletedInSquare: { at: '18 Nov, 21:10', by: 'Sam at Soho' },
    regularTypeInSquare: true,
  },
  {
    ...base,
    id: 'ti-mocha',
    source: { kind: 'recipe', recipeId: 'rec-mocha' },
    posItemId: 'mi-mocha',
    current: fields({
      name: 'Mocha',
      sizes: ['Regular', 'Large'],
      prices: { Regular: 4.4, Large: 4.8 },
      groups: ['mg-alt-milks'],
    }),
    sizeCosts: { Regular: 0.95, Large: 1.18 },
  },
  {
    ...base,
    id: 'ti-iced-latte',
    source: { kind: 'recipe', recipeId: 'rec-iced-latte' },
    posItemId: 'mi-iced-latte',
    current: fields({
      name: 'Iced latte',
      category: 'Coffee',
      sizes: ['Regular', 'Large'],
      prices: { Regular: 4.2, Large: 4.7 },
      groups: ['mg-alt-milks'],
    }),
    sizeGroups: { Regular: ['mg-alt-milks'], Large: ['mg-alt-milks', 'mg-syrups'] },
    sizeCosts: { Regular: 0.88, Large: 1.1 },
  },
  {
    ...base,
    id: 'ti-house-red',
    source: { kind: 'product', productId: 'prd-house-red-75cl' },
    posItemId: 'mi-house-red',
    ...settled(fields({
      name: 'House red',
      category: 'Wine',
      sizes: ['175ml', '250ml', 'Bottle'],
      prices: { '175ml': 6.5, '250ml': 8.9, Bottle: 24 },
      description: 'Soft, juicy Garnacha.',
    })),
    amounts: {
      '175ml': { value: 175, unit: 'ml' },
      '250ml': { value: 250, unit: 'ml' },
      Bottle: { value: 750, unit: 'ml' },
    },
    sizeCosts: { '175ml': 1.33, '250ml': 1.9, Bottle: 5.7 },
  },
  {
    ...base,
    id: 'ti-coca-cola',
    source: { kind: 'product', productId: 'prd-coca-cola-330' },
    posItemId: 'mi-coca-cola',
    ...settled(fields({
      name: 'Coca-Cola',
      category: 'Soft drinks',
      sizes: ['Can'],
      prices: { Can: 2.5 },
      photo: true,
    })),
    amounts: { Can: { value: 1, unit: 'can' } },
    sizeCosts: { Can: 0.75 },
    soldOutAt: ['Soho Annex'],
  },
  {
    ...base,
    id: 'ti-smirnoff',
    source: { kind: 'recipe', recipeId: 'rec-smirnoff' },
    posItemId: 'mi-smirnoff',
    ...settled(fields({
      name: 'Smirnoff vodka',
      category: 'Spirits',
      sizes: ['25ml', '50ml'],
      prices: { '25ml': 4.5, '50ml': 6.5 },
      groups: ['mg-mixer'],
    })),
    sizeCosts: { '25ml': 0.62, '50ml': 1.24 },
  },
  {
    ...base,
    id: 'ti-avocado-toast',
    source: { kind: 'recipe', recipeId: 'rec-avocado-toast' },
    posItemId: 'mi-avocado-toast',
    ...settled(fields({
      name: 'Avocado toast',
      kitchenName: 'AVO TST',
      category: 'Breakfast',
      sizes: ['Regular'],
      prices: { Regular: 8.5 },
      description: 'Smashed avocado, chilli and lime on sourdough.',
      photo: true,
    })),
    sizeCosts: { Regular: 2.04 },
    publishedByEdify: true,
  },
  {
    ...base,
    id: 'ti-blueberry-muffin',
    source: { kind: 'recipe', recipeId: 'rec-blueberry-muffin' },
    posItemId: 'mi-blueberry-muffin',
    ...settled(fields({
      name: 'Blueberry muffin',
      category: 'Bakery',
      sizes: ['Regular'],
      prices: { Regular: 3.0 },
      vat: 'Zero rate 0%',
    })),
    sizeCosts: { Regular: 0.8 },
    takeOff: true,
  },
];

export const SEED_SQUARE_ONLY: SquareOnlyItem[] = [
  {
    id: 'sq-pumpkin-spice',
    name: 'Pumpkin spice latte',
    category: 'Coffee',
    sizes: ['Regular', 'Large'],
    prices: { Regular: 4.5, Large: 4.9 },
    createdAt: '17 Nov, 11:30',
    createdBy: 'Jess at Brixton',
  },
  {
    id: 'sq-staff-coffee',
    name: 'Staff coffee',
    category: 'Coffee',
    sizes: ['Regular'],
    prices: { Regular: null },
    createdAt: '2 Oct, 07:15',
    createdBy: 'Tom at Fitzroy St',
  },
];

export const SEED_GROUP_CHANGES: SquareGroupChange[] = [
  {
    id: 'gc-hazelnut',
    groupId: 'mg-syrups',
    optionName: 'Hazelnut',
    priceDelta: 0.5,
    at: '19 Nov, 09:15',
    by: 'Jess at Brixton',
  },
];

/** Modifier groups already on the till when the demo opens. */
export const SEED_PUBLISHED_GROUP_IDS = ['mg-alt-milks', 'mg-syrups', 'mg-mixer'];

/**
 * Option prices a Square location sets differently from the option's own
 * price. Edify holds one price per option, so a group with any of these
 * either keeps them in Square or charges one price everywhere.
 */
export type GroupSitePrices = {
  keepInSquare: boolean;
  /** Option id → Square location name → price. Only locations that differ. */
  prices: Record<string, Record<string, number>>;
};

export const SEED_GROUP_SITE_PRICES: Record<string, GroupSitePrices> = {
  'mg-alt-milks': { keepInSquare: true, prices: { 'mg-alt-milks-oat': { Soho: 0.5 } } },
};

/**
 * Options a GM has switched off on one size of a recipe (Isaac's per-recipe
 * `enabled` flag). Recipe id → size → option ids. Square offers every option
 * on every size of an item, so the till still shows these.
 */
export const RECIPE_OPTIONS_OFF: Record<string, Record<string, string[]>> = {
  'rec-latte': { 'Large (16oz)': ['mg-alt-milks-oat'] },
};

// ── First link ──────────────────────────────────────────────────────────────
//
// What Edify proposes the first time it reads the Square catalogue. Square
// has no sizes on half the drinks (Smirnoff is two buttons) and a few items
// with no Edify recipe at all.

export type FirstLinkProposal = {
  id: string;
  band: 'ready' | 'call' | 'new';
  kind: 'item' | 'group';
  /** What Square has now, as staff see it on the till. */
  squareLabel: string;
  squareDetail: string;
  /** What Edify proposes. */
  proposal: string;
  /** Choices for the "Needs your call" band. The first is the suggestion. */
  choices?: { id: string; label: string }[];
  /** Square set this up as a regular item, so it can't carry allergens. */
  regularType?: boolean;
  /** The till item this becomes once linked. */
  tillItemId?: string;
};

export const FIRST_LINK_PROPOSALS: FirstLinkProposal[] = [
  { id: 'fl-flat-white', tillItemId: 'ti-flat-white', band: 'ready', kind: 'item', squareLabel: 'Flat white', squareDetail: '3 sizes, £3.60 to £4.40', proposal: 'Flat white recipe, sizes Small, Medium and Large' },
  { id: 'fl-latte', tillItemId: 'ti-latte', band: 'ready', kind: 'item', squareLabel: 'Latte', squareDetail: '3 sizes, £3.80 to £4.60', proposal: 'Latte recipe, sizes Small, Medium and Large' },
  { id: 'fl-cappuccino', tillItemId: 'ti-cappuccino', band: 'ready', kind: 'item', squareLabel: 'Cappuccino', squareDetail: '3 sizes, £3.60 to £4.40', proposal: 'Cappuccino recipe, sizes Small, Medium and Large' },
  { id: 'fl-americano', tillItemId: 'ti-americano', band: 'ready', kind: 'item', squareLabel: 'Americano', squareDetail: '1 size, £3.20', proposal: 'Americano recipe' },
  { id: 'fl-house-red', tillItemId: 'ti-house-red', band: 'ready', kind: 'item', squareLabel: 'House red', squareDetail: '175ml, 250ml, Bottle', proposal: 'House Red 75cl product, poured as 175ml, 250ml and a bottle' },
  { id: 'fl-coca-cola', tillItemId: 'ti-coca-cola', band: 'ready', kind: 'item', squareLabel: 'Coca-Cola', squareDetail: '1 size, £2.50', proposal: 'Coca-Cola 330ml product, one can' },
  { id: 'fl-avocado-toast', tillItemId: 'ti-avocado-toast', band: 'ready', kind: 'item', squareLabel: 'Avocado toast', squareDetail: '1 size, £8.50', proposal: 'Avocado toast recipe' },
  { id: 'fl-muffin', tillItemId: 'ti-blueberry-muffin', band: 'ready', kind: 'item', squareLabel: 'Blueberry muffin', squareDetail: '1 size, £3.00', proposal: 'Blueberry muffin recipe' },
  { id: 'fl-croissant', tillItemId: 'ti-croissant', band: 'ready', kind: 'item', squareLabel: 'Croissant', squareDetail: '1 size, £3.20', proposal: 'Croissant recipe', regularType: true },
  {
    id: 'fl-alt-milks',
    band: 'call',
    kind: 'group',
    squareLabel: 'Milk (modifier set)',
    squareDetail: 'Whole, Oat +£0.40 (Soho +£0.50), Skimmed',
    proposal: 'Alt milks group. Soho charges more for oat than your other sites, and Edify holds one price per option.',
    choices: [
      { id: 'keep', label: "Keep each site's price in Square" },
      { id: 'one-price', label: 'Charge +£0.40 at every site' },
    ],
  },
  { id: 'fl-syrups', band: 'ready', kind: 'group', squareLabel: 'Syrups (modifier set)', squareDetail: 'Vanilla +£0.50, Caramel +£0.50', proposal: 'Syrups group' },
  { id: 'fl-mixer', band: 'ready', kind: 'group', squareLabel: 'Mixers (modifier set)', squareDetail: 'Coke, Lemonade, Tonic', proposal: 'Mixer group' },
  {
    id: 'fl-smirnoff',
    tillItemId: 'ti-smirnoff',
    band: 'call',
    kind: 'item',
    squareLabel: 'Smirnoff 25ml and Smirnoff 50ml',
    squareDetail: 'Two separate buttons',
    proposal: 'One Smirnoff vodka item with two sizes, 25ml and 50ml. Sales history stays with each size.',
    choices: [
      { id: 'combine', label: 'Make one item with two sizes' },
      { id: 'separate', label: 'Keep two separate buttons' },
    ],
  },
  {
    id: 'fl-hot-choc',
    band: 'call',
    kind: 'item',
    squareLabel: 'Hot choc',
    squareDetail: '1 size, £3.90',
    proposal: 'Closest recipe is Mocha, but Mocha has coffee in it. Probably a different drink.',
    choices: [
      { id: 'leave', label: 'Leave it on the till only' },
      { id: 'mocha', label: 'Link it to Mocha' },
    ],
  },
  { id: 'fl-pumpkin', band: 'new', kind: 'item', squareLabel: 'Pumpkin spice latte', squareDetail: '2 sizes, £4.50 to £4.90', proposal: 'No recipe yet. Stays on the till. Create the recipe when you want costs and stock.' },
  { id: 'fl-staff', band: 'new', kind: 'item', squareLabel: 'Staff coffee', squareDetail: 'Price at the till', proposal: 'No recipe yet. Stays on the till.' },
];
