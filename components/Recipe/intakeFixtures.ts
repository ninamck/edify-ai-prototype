export type POSSource = 'Square' | 'Toast' | 'Lightspeed';

export type MatchStatus =
  | 'all-matched'
  | 'one-ambiguous'
  | 'needs-info'
  | 'new-ingredient'
  | 'no-modifiers';

export type MenuItemDraft = {
  id: string;
  name: string;
  category: 'Coffee' | 'Tea' | 'Pastry' | 'Food' | 'Wine' | 'Spirits' | 'Kids';
  ingredientCount: number;
  matchStatus: MatchStatus;
  note?: string;
  modifierGroups?: string[];
};

export type POSPattern = {
  id: string;
  name: string;
  type: 'Substitute' | 'Scale' | 'Add';
  options: { label: string; rule: string }[];
  usedOnCount: number;
  substitutes?: string;
  affectedItems: string[];
};

export type POSIntakeData = {
  source: POSSource;
  siteName: string;
  menuItemsTotal: number;
  menuItemsWithModifiers: number;
  menuItemsWithSalesData: number;
  patterns: POSPattern[];
  menuItems: MenuItemDraft[];
  additionalItemsCount: number;
};

export const FITZROY_POS_INTAKE: POSIntakeData = {
  source: 'Square',
  siteName: 'Fitzroy Espresso',
  menuItemsTotal: 124,
  menuItemsWithModifiers: 87,
  menuItemsWithSalesData: 64,

  patterns: [
    {
      id: 'pattern-alt-milks',
      name: 'Alt milks',
      type: 'Substitute',
      substitutes: 'Whole milk',
      options: [
        { label: 'Oat milk',    rule: 'substitute Whole milk with Oatly @ 1:1' },
        { label: 'Almond milk', rule: 'substitute Whole milk with Alpro Almond @ 1:1' },
        { label: 'Soy milk',    rule: 'substitute Whole milk with Alpro Soy @ 1:1' },
      ],
      usedOnCount: 14,
      affectedItems: [
        'Americano', 'Cappuccino', 'Flat white', 'Latte', 'Mocha',
        'Flat white decaf', 'Iced latte', 'Americano iced', 'Chai latte',
        'Matcha latte', 'Mocha iced', 'Cortado', 'Macchiato', 'Piccolo',
      ],
    },
    {
      id: 'pattern-pour-size',
      name: 'Pour size',
      type: 'Scale',
      options: [
        { label: '25ml', rule: '1× base recipe' },
        { label: '50ml', rule: '2× base recipe' },
      ],
      usedOnCount: 22,
      affectedItems: [
        'Smirnoff vodka', 'Grey Goose vodka', 'Tanqueray gin', 'Bombay Sapphire',
        'Hendrick\u2019s gin', 'Jameson whiskey', 'Glenfiddich 12', 'Laphroaig 10',
        'Havana Club rum', 'Bacardi rum', 'Jose Cuervo', 'Patrón Silver',
      ],
    },
    {
      id: 'pattern-cup-sizes',
      name: 'Cup sizes',
      type: 'Scale',
      options: [
        { label: 'Small',   rule: '0.75× base recipe' },
        { label: 'Regular', rule: '1× base recipe' },
        { label: 'Large',   rule: '1.5× base recipe' },
      ],
      usedOnCount: 8,
      affectedItems: [
        'English breakfast', 'Earl Grey', 'Green tea', 'Peppermint tea',
        'Hot chocolate', 'Chai latte', 'Matcha latte', 'Babyccino',
      ],
    },
  ],

  menuItems: [
    { id: 'mi-flat-white',      name: 'Flat white',          category: 'Coffee',  ingredientCount: 2, matchStatus: 'all-matched',    modifierGroups: ['Alt milks', 'Cup sizes'] },
    { id: 'mi-cappuccino',      name: 'Cappuccino',          category: 'Coffee',  ingredientCount: 2, matchStatus: 'all-matched',    modifierGroups: ['Alt milks', 'Cup sizes'] },
    { id: 'mi-latte',           name: 'Latte',               category: 'Coffee',  ingredientCount: 2, matchStatus: 'one-ambiguous',  note: 'Two "Whole milk" entries in your library — merge?', modifierGroups: ['Alt milks', 'Cup sizes'] },
    { id: 'mi-americano',       name: 'Americano',           category: 'Coffee',  ingredientCount: 2, matchStatus: 'all-matched',    modifierGroups: ['Alt milks'] },
    { id: 'mi-mocha',           name: 'Mocha',               category: 'Coffee',  ingredientCount: 4, matchStatus: 'all-matched',    modifierGroups: ['Alt milks', 'Cup sizes'] },
    { id: 'mi-cortado',         name: 'Cortado',             category: 'Coffee',  ingredientCount: 2, matchStatus: 'all-matched',    modifierGroups: ['Alt milks'] },
    { id: 'mi-macchiato',       name: 'Macchiato',           category: 'Coffee',  ingredientCount: 2, matchStatus: 'all-matched',    modifierGroups: ['Alt milks'] },
    { id: 'mi-iced-latte',      name: 'Iced latte',          category: 'Coffee',  ingredientCount: 3, matchStatus: 'all-matched',    modifierGroups: ['Alt milks'] },
    { id: 'mi-english-breakfast', name: 'English breakfast', category: 'Tea',     ingredientCount: 2, matchStatus: 'all-matched',    modifierGroups: ['Cup sizes'] },
    { id: 'mi-earl-grey',       name: 'Earl Grey',           category: 'Tea',     ingredientCount: 2, matchStatus: 'all-matched',    modifierGroups: ['Cup sizes'] },
    { id: 'mi-green-tea',       name: 'Green tea',           category: 'Tea',     ingredientCount: 2, matchStatus: 'all-matched',    modifierGroups: ['Cup sizes'] },
    { id: 'mi-blueberry-muffin',name: 'Blueberry muffin',    category: 'Pastry',  ingredientCount: 0, matchStatus: 'new-ingredient', note: '"Blueberry muffin" on Rise Bakery invoice — link as ingredient?' },
    { id: 'mi-croissant',       name: 'Croissant',           category: 'Pastry',  ingredientCount: 1, matchStatus: 'all-matched' },
    { id: 'mi-almond-croissant',name: 'Almond croissant',    category: 'Pastry',  ingredientCount: 1, matchStatus: 'all-matched' },
    { id: 'mi-smirnoff',        name: 'Smirnoff vodka',      category: 'Spirits', ingredientCount: 1, matchStatus: 'all-matched',    modifierGroups: ['Pour size'] },
    { id: 'mi-tanqueray',       name: 'Tanqueray gin',       category: 'Spirits', ingredientCount: 1, matchStatus: 'all-matched',    modifierGroups: ['Pour size'] },
    { id: 'mi-savvy-b',         name: 'Savvy B',             category: 'Wine',    ingredientCount: 1, matchStatus: 'needs-info',     note: 'needs a size modifier — glass vs bottle' },
    { id: 'mi-house-red',       name: 'House red',           category: 'Wine',    ingredientCount: 1, matchStatus: 'all-matched' },
    { id: 'mi-avocado-toast',   name: 'Avocado toast',       category: 'Food',    ingredientCount: 5, matchStatus: 'all-matched' },
    { id: 'mi-salmon-bagel',    name: 'Smoked salmon bagel', category: 'Food',    ingredientCount: 5, matchStatus: 'all-matched' },
    { id: 'mi-babyccino',       name: 'Kids babyccino',      category: 'Kids',    ingredientCount: 1, matchStatus: 'no-modifiers' },
  ],

  additionalItemsCount: 103,
};

export function matchStatusLabel(status: MatchStatus, ingredientCount: number): string {
  switch (status) {
    case 'all-matched':    return `${ingredientCount} ing · all matched`;
    case 'one-ambiguous':  return `${ingredientCount} ing · 1 ambiguous`;
    case 'needs-info':     return 'needs size info';
    case 'new-ingredient': return 'new ingredient — link?';
    case 'no-modifiers':   return 'no modifiers';
  }
}

export function matchStatusVariant(status: MatchStatus): 'success' | 'warning' | 'default' {
  switch (status) {
    case 'all-matched':    return 'success';
    case 'one-ambiguous':
    case 'needs-info':
    case 'new-ingredient': return 'warning';
    case 'no-modifiers':   return 'default';
  }
}
