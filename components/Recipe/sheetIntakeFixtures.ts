/**
 * Costing-sheet intake fixtures.
 *
 * Represents the result of parsing a user-uploaded Excel/CSV (fake filename
 * fitzroy-brunch-costing.xlsx). Renders in the B1→B3 flow (drop + column
 * mapping + 3-recipe preview), then the batch Quinn run and summary reuse
 * the same /intake/pos/run + /intake/pos/done pages via ?source=sheet.
 */

export type ParsedIngredient = {
  name: string;
  qty: number;
  uom: string;
  supplier: string;
  unitCostP: number; // pence per unit
  matched: boolean;  // did Quinn link to the existing library
  note?: string;
};

export type ParsedRecipe = {
  id: string;
  name: string;
  category: 'Food' | 'Pastry' | 'Coffee' | 'Wine' | 'Spirits' | 'Tea' | 'Kids';
  yieldQty: number;
  yieldUom: string;
  sourceRow: number;
  ingredients: ParsedIngredient[];
};

export type SheetOutcome = { tone: 'ok' | 'warn'; note: string };

export type SheetIntakeData = {
  filename: string;
  totalRows: number;
  totalRecipes: number;
  siteName: string;
  columnMapping: {
    key: 'name' | 'category' | 'ingredient' | 'qty' | 'uom' | 'cost' | 'yield';
    label: string;
    guessed: string; // "Col B: Recipe"
  }[];
  samplePreview: {
    cols: string[];                  // header row from the sheet
    rows: (string | number)[][];     // first 8 raw rows (for the mapping preview)
  };
  recipes: ParsedRecipe[];
  outcomes: Record<string, SheetOutcome>;
};

export const FITZROY_SHEET_INTAKE: SheetIntakeData = {
  filename: 'fitzroy-brunch-costing.xlsx',
  totalRows: 82,
  totalRecipes: 10,
  siteName: 'Fitzroy Espresso',

  columnMapping: [
    { key: 'name',       label: 'Recipe name',      guessed: 'Col B: Recipe' },
    { key: 'category',   label: 'Category',         guessed: 'Col C: Category' },
    { key: 'ingredient', label: 'Ingredient',       guessed: 'Col D: Ingredient' },
    { key: 'qty',        label: 'Quantity',         guessed: 'Col E: Qty' },
    { key: 'uom',        label: 'Unit (UoM)',       guessed: 'Col F: UoM' },
    { key: 'cost',       label: 'Unit cost (opt.)', guessed: 'Col G: Unit cost' },
    { key: 'yield',      label: 'Yield',            guessed: 'Col H: Serves' },
  ],

  samplePreview: {
    cols: ['#', 'Recipe', 'Category', 'Ingredient', 'Qty', 'UoM', 'Unit cost', 'Serves'],
    rows: [
      [1, 'Eggs Benedict', 'Food', 'Poached egg',      2,   'unit', 0.25, 1],
      [1, 'Eggs Benedict', 'Food', 'Toasted muffin',   1,   'unit', 0.45, 1],
      [1, 'Eggs Benedict', 'Food', 'Streaky bacon',    40,  'g',    0.012, 1],
      [1, 'Eggs Benedict', 'Food', 'Hollandaise',      30,  'ml',   0.02, 1],
      [2, 'Shakshuka',     'Food', 'Tomato',           150, 'g',    0.004, 1],
      [2, 'Shakshuka',     'Food', 'Bell pepper',      50,  'g',    0.006, 1],
      [2, 'Shakshuka',     'Food', 'Onion',            30,  'g',    0.002, 1],
      [2, 'Shakshuka',     'Food', 'Egg',              2,   'unit', 0.25, 1],
    ],
  },

  recipes: [
    {
      id: 'sr-eggs-benedict',
      name: 'Eggs Benedict',
      category: 'Food',
      yieldQty: 1,
      yieldUom: 'serving',
      sourceRow: 1,
      ingredients: [
        { name: 'Poached egg',    qty: 2,  uom: 'unit', supplier: 'Fresh Earth Produce', unitCostP: 25,  matched: true },
        { name: 'Toasted muffin', qty: 1,  uom: 'unit', supplier: 'Rise Bakery',         unitCostP: 45,  matched: true },
        { name: 'Streaky bacon',  qty: 40, uom: 'g',    supplier: 'Fresh Earth Produce', unitCostP: 1.2, matched: true },
        { name: 'Hollandaise',    qty: 30, uom: 'ml',   supplier: 'In-house',            unitCostP: 2.0, matched: false, note: 'new ingredient' },
      ],
    },
    {
      id: 'sr-shakshuka',
      name: 'Shakshuka',
      category: 'Food',
      yieldQty: 1,
      yieldUom: 'serving',
      sourceRow: 9,
      ingredients: [
        { name: 'Tomato',       qty: 150, uom: 'g',    supplier: 'Fresh Earth Produce', unitCostP: 0.4, matched: true },
        { name: 'Bell pepper',  qty: 50,  uom: 'g',    supplier: 'Fresh Earth Produce', unitCostP: 0.6, matched: true },
        { name: 'Onion',        qty: 30,  uom: 'g',    supplier: 'Fresh Earth Produce', unitCostP: 0.2, matched: true },
        { name: 'Egg',          qty: 2,   uom: 'unit', supplier: 'Fresh Earth Produce', unitCostP: 25,  matched: true },
        { name: 'Cumin',        qty: 2,   uom: 'g',    supplier: 'Bidvest',             unitCostP: 2,   matched: true },
        { name: 'Paprika',      qty: 2,   uom: 'g',    supplier: 'Bidvest',             unitCostP: 2,   matched: true },
      ],
    },
    {
      id: 'sr-french-toast',
      name: 'French toast',
      category: 'Food',
      yieldQty: 1,
      yieldUom: 'serving',
      sourceRow: 15,
      ingredients: [
        { name: 'Brioche slice',   qty: 2,  uom: 'slice', supplier: 'Rise Bakery',         unitCostP: 40, matched: true },
        { name: 'Egg',             qty: 1,  uom: 'unit',  supplier: 'Fresh Earth Produce', unitCostP: 25, matched: true },
        { name: 'Whole milk',      qty: 50, uom: 'ml',    supplier: 'Fresh Earth Produce', unitCostP: 0.42, matched: true },
        { name: 'Cinnamon',        qty: 1,  uom: 'g',     supplier: 'Bidvest',             unitCostP: 5, matched: true },
        { name: 'Vanilla extract', qty: 2,  uom: 'ml',    supplier: 'Bidvest',             unitCostP: 15, matched: true },
      ],
    },
    {
      id: 'sr-buttermilk-pancakes',
      name: 'Buttermilk pancakes',
      category: 'Food',
      yieldQty: 1,
      yieldUom: 'serving',
      sourceRow: 21,
      ingredients: [
        { name: 'Pancake batter', qty: 80, uom: 'g',    supplier: 'Bidvest',             unitCostP: 1,   matched: true },
        { name: 'Egg',            qty: 1,  uom: 'unit', supplier: 'Fresh Earth Produce', unitCostP: 25,  matched: true },
        { name: 'Whole milk',     qty: 80, uom: 'ml',   supplier: 'Fresh Earth Produce', unitCostP: 0.42, matched: true },
        { name: 'Butter',         qty: 10, uom: 'g',    supplier: 'Fresh Earth Produce', unitCostP: 1.5, matched: true },
        { name: 'Maple syrup',    qty: 20, uom: 'ml',   supplier: 'Bidvest',             unitCostP: 6,   matched: true },
      ],
    },
    {
      id: 'sr-breakfast-burrito',
      name: 'Breakfast burrito',
      category: 'Food',
      yieldQty: 1,
      yieldUom: 'serving',
      sourceRow: 27,
      ingredients: [
        { name: 'Flour tortilla', qty: 1,  uom: 'unit', supplier: 'Rise Bakery',         unitCostP: 30, matched: true },
        { name: 'Scrambled egg',  qty: 2,  uom: 'unit', supplier: 'Fresh Earth Produce', unitCostP: 25, matched: true },
        { name: 'Chorizo',        qty: 30, uom: 'g',    supplier: 'Fresh Earth Produce', unitCostP: 2.5, matched: false, note: 'new ingredient — link?' },
        { name: 'Black beans',    qty: 40, uom: 'g',    supplier: 'Bidvest',             unitCostP: 0.8, matched: true },
        { name: 'Cheddar',        qty: 30, uom: 'g',    supplier: 'The Cheese Board',    unitCostP: 1.8, matched: true },
        { name: 'Salsa',          qty: 20, uom: 'ml',   supplier: 'Bidvest',             unitCostP: 1.2, matched: true },
      ],
    },
    {
      id: 'sr-granola-bowl',
      name: 'Granola bowl',
      category: 'Food',
      yieldQty: 1,
      yieldUom: 'serving',
      sourceRow: 34,
      ingredients: [
        { name: 'House granola',  qty: 60,  uom: 'g', supplier: 'In-house',            unitCostP: 1.2, matched: true },
        { name: 'Greek yoghurt',  qty: 150, uom: 'g', supplier: 'Fresh Earth Produce', unitCostP: 0.8, matched: true },
        { name: 'Mixed berries',  qty: 50,  uom: 'g', supplier: 'Fresh Earth Produce', unitCostP: 3,   matched: true },
        { name: 'Honey',          qty: 10,  uom: 'ml', supplier: 'Bidvest',            unitCostP: 4,   matched: true },
      ],
    },
    {
      id: 'sr-huevos-rancheros',
      name: 'Huevos rancheros',
      category: 'Food',
      yieldQty: 1,
      yieldUom: 'serving',
      sourceRow: 40,
      ingredients: [
        { name: 'Corn tortilla',   qty: 2,  uom: 'unit', supplier: 'Rise Bakery',         unitCostP: 20, matched: true },
        { name: 'Fried egg',       qty: 2,  uom: 'unit', supplier: 'Fresh Earth Produce', unitCostP: 25, matched: true },
        { name: 'Black beans',     qty: 50, uom: 'g',    supplier: 'Bidvest',             unitCostP: 0.8, matched: true },
        { name: 'Ranchero sauce',  qty: 60, uom: 'ml',   supplier: 'In-house',            unitCostP: 1.8, matched: false, note: 'new ingredient' },
        { name: 'Coriander',       qty: 3,  uom: 'g',    supplier: 'Fresh Earth Produce', unitCostP: 4,   matched: true },
      ],
    },
    {
      id: 'sr-salmon-scramble',
      name: 'Smoked salmon scramble',
      category: 'Food',
      yieldQty: 1,
      yieldUom: 'serving',
      sourceRow: 46,
      ingredients: [
        { name: 'Scrambled egg',  qty: 3,  uom: 'unit',  supplier: 'Fresh Earth Produce', unitCostP: 25, matched: true },
        { name: 'Smoked salmon',  qty: 50, uom: 'g',     supplier: 'Fresh Earth Produce', unitCostP: 4.8, matched: true },
        { name: 'Chive',          qty: 2,  uom: 'g',     supplier: 'Fresh Earth Produce', unitCostP: 4,  matched: true },
        { name: 'Sourdough',      qty: 2,  uom: 'slice', supplier: 'Rise Bakery',         unitCostP: 20, matched: true },
        { name: 'Butter',         qty: 10, uom: 'g',     supplier: 'Fresh Earth Produce', unitCostP: 1.5, matched: true },
      ],
    },
    {
      id: 'sr-banana-pancakes',
      name: 'Banana pancakes',
      category: 'Food',
      yieldQty: 1,
      yieldUom: 'serving',
      sourceRow: 52,
      ingredients: [
        { name: 'Pancake batter', qty: 80, uom: 'g',    supplier: 'Bidvest',             unitCostP: 1,   matched: true },
        { name: 'Banana',         qty: 1,  uom: 'unit', supplier: 'Fresh Earth Produce', unitCostP: 35,  matched: true },
        { name: 'Whole milk',     qty: 60, uom: 'ml',   supplier: 'Fresh Earth Produce', unitCostP: 0.42, matched: true },
        { name: 'Butter',         qty: 5,  uom: 'g',    supplier: 'Fresh Earth Produce', unitCostP: 1.5, matched: true },
        { name: 'Maple syrup',    qty: 20, uom: 'ml',   supplier: 'Bidvest',             unitCostP: 6,   matched: true },
      ],
    },
    {
      id: 'sr-full-english',
      name: 'Full English breakfast',
      category: 'Food',
      yieldQty: 1,
      yieldUom: 'serving',
      sourceRow: 58,
      ingredients: [
        { name: 'Cumberland sausage', qty: 2,  uom: 'unit',  supplier: 'Fresh Earth Produce', unitCostP: 110, matched: true },
        { name: 'Streaky bacon',      qty: 60, uom: 'g',     supplier: 'Fresh Earth Produce', unitCostP: 1.2, matched: true },
        { name: 'Baked beans',        qty: 80, uom: 'g',     supplier: 'Bidvest',             unitCostP: 0.6, matched: true },
        { name: 'Hash brown',         qty: 2,  uom: 'unit',  supplier: 'Fresh Earth Produce', unitCostP: 40,  matched: true },
        { name: 'Grilled tomato',     qty: 1,  uom: 'unit',  supplier: 'Fresh Earth Produce', unitCostP: 30,  matched: true },
        { name: 'Mushroom',           qty: 40, uom: 'g',     supplier: 'Fresh Earth Produce', unitCostP: 1.2, matched: true },
        { name: 'Fried egg',          qty: 2,  uom: 'unit',  supplier: 'Fresh Earth Produce', unitCostP: 25,  matched: true },
        { name: 'Sourdough',          qty: 1,  uom: 'slice', supplier: 'Rise Bakery',         unitCostP: 20,  matched: true },
      ],
    },
  ],

  // Per-recipe run outcomes for the batch Quinn UI.
  outcomes: {
    'sr-eggs-benedict':       { tone: 'warn', note: '"Hollandaise" new ingredient — set as In-house' },
    'sr-shakshuka':           { tone: 'ok',   note: 'all clean' },
    'sr-french-toast':        { tone: 'ok',   note: 'all clean' },
    'sr-buttermilk-pancakes': { tone: 'ok',   note: 'all clean' },
    'sr-breakfast-burrito':   { tone: 'warn', note: '"Chorizo" not in library — linked to Fresh Earth' },
    'sr-granola-bowl':        { tone: 'ok',   note: 'all clean' },
    'sr-huevos-rancheros':    { tone: 'warn', note: '"Ranchero sauce" new — saved as In-house' },
    'sr-salmon-scramble':     { tone: 'ok',   note: 'all clean' },
    'sr-banana-pancakes':     { tone: 'ok',   note: 'all clean' },
    'sr-full-english':        { tone: 'ok',   note: 'cost looks plausible vs £14.50 menu price' },
  },
};
