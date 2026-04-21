export type RecipeCategory = 'Coffee' | 'Tea' | 'Pastry' | 'Food' | 'Wine' | 'Spirits' | 'Kids';
export type RecipeStatus = 'Active' | 'Draft' | 'Archived';
export type RecipeFlag =
  | { type: 'cost-drift'; label: string }
  | { type: 'missing-prod'; label: string }
  | { type: 'missing-size'; label: string }
  | null;

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

export const FITZROY_RECIPES: Recipe[] = [
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
