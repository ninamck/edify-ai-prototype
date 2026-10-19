// The product form's option lists, copied from the product page
// (edify/web-v2/src/features/products/product-options.ts) so the delivery
// setup sheet asks for products the same way. Ids are the stored values.

export type SelectOption = { id: string; label: string };

/** Stored ids whose display label differs (including the stored "Cannister" spelling). */
export const UNIT_LABEL: Record<string, string> = {
  Cannister: 'Canister',
  G: 'Gram (G)',
  Kg: 'Kilogram (Kg)',
  L: 'Litre (L)',
  ML: 'Millilitre (ML)',
  Oz: 'Ounce (Oz)',
  Lb: 'Pound (Lb)',
};

/** Pack type: the outer container the supplier ships. */
export const PACK_TYPE_OPTIONS: SelectOption[] = [
  'Bag', 'Basket', 'Bottle', 'Box', 'Bunch', 'Can', 'Cannister', 'Carafe', 'Carton', 'Case', 'Container', 'Crate',
  'Cylinder', 'Dozen', 'Each', 'Firkin', 'G', 'Head', 'Item', 'Jar', 'Jug', 'Keg', 'Kg', 'L', 'Loaf', 'ML', 'Oz',
  'Pack', 'Packet', 'Pallet', 'Pot', 'Pouch', 'Lb', 'Punnet', 'Quart', 'Roll', 'Sachet', 'Sack', 'Sheet', 'Sleeve',
  'Tin', 'Tray', 'Tub', 'Tube',
].map(id => ({ id, label: UNIT_LABEL[id] ?? id }));

/** Single unit type: what one item inside the pack is. */
export const SINGLE_UNIT_TYPE_OPTIONS: SelectOption[] = [
  'Bag', 'Basket', 'Bottle', 'Box', 'Bunch', 'Can', 'Carafe', 'Carton', 'Cannister', 'Case', 'Cylinder', 'Container',
  'Crate', 'Each', 'Firkin', 'G', 'Head', 'Item', 'Jar', 'Jug', 'Keg', 'Kg', 'L', 'Lb', 'Loaf', 'ML', 'Oz', 'Pack',
  'Packet', 'Piece', 'Pitcher', 'Pot', 'Portion', 'Punnet', 'Pouch', 'Quart', 'Roll', 'Sack', 'Sachet', 'Sheet',
  'Sleeve', 'Slice', 'Tray', 'Tub', 'Tin', 'Tube',
].map(id => ({ id, label: UNIT_LABEL[id] ?? id }));

export const ALTERNATIVE_UNIT_TYPE_OPTIONS: SelectOption[] = [{ id: '', label: 'None' }, ...SINGLE_UNIT_TYPE_OPTIONS];

/** Unit of measure: used for recipe sizing and unit conversions. */
export const UNIT_OF_MEASURE_OPTIONS: SelectOption[] = [
  { id: 'EACH', label: 'Each' },
  { id: 'GRAM', label: 'Gram (g)' },
  { id: 'KILOGRAM', label: 'Kilogram (kg)' },
  { id: 'LITRE', label: 'Litre (l)' },
  { id: 'MILLILITRE', label: 'Millilitre (ml)' },
  { id: 'GALLON', label: 'Gallon US' },
  { id: 'GALLON_UK', label: 'Gallon UK' },
  { id: 'FLUID_OUNCE', label: 'Fluid Ounce US' },
  { id: 'FLUID_OUNCE_UK', label: 'Fluid Ounce UK' },
  { id: 'PINT', label: 'Pint UK' },
  { id: 'PINT_US', label: 'Pint US' },
  { id: 'OUNCE', label: 'Ounce' },
  { id: 'POUND', label: 'Pound' },
  { id: 'CENTILITRE', label: 'Centilitre (cl)' },
  { id: 'QUART', label: 'Quart US' },
  { id: 'QUART_UK', label: 'Quart UK' },
  { id: 'N/A', label: 'N/A' },
];

/** Short form for sentences: "125g", "1L". */
export const UOM_SHORT: Record<string, string> = {
  GRAM: 'g',
  KILOGRAM: 'kg',
  LITRE: 'L',
  MILLILITRE: 'ml',
  CENTILITRE: 'cl',
  OUNCE: 'oz',
  POUND: 'lb',
  PINT: ' pint',
};

export const STATUS_OPTIONS = [
  { id: 'ACTIVE', label: 'Available' },
  { id: 'SUSPENDED', label: 'Unavailable' },
] as const;
export type ProductStatus = (typeof STATUS_OPTIONS)[number]['id'];

/** The company's tags, as on the product page. */
export const TAG_OPTIONS = ['S&S', 'Weigh Up', 'Preparation', 'Baking', 'Forecastable'];

/** The 14 declarable allergens. */
export const ALLERGEN_OPTIONS = [
  'Celery', 'Cereals containing gluten', 'Crustaceans', 'Dairy', 'Eggs', 'Fish', 'Lupin', 'Molluscs', 'Mustard', 'Nuts',
  'Peanuts', 'Sesame Seeds', 'Soya', 'Sulphites',
];

/** Nutritional information per 100 g. */
export const NUTRITION_KEYS: { key: string; label: string }[] = [
  { key: 'Energy(kj)', label: 'Energy (kJ)' },
  { key: 'Energy(kcal)', label: 'Energy (kcal)' },
  { key: 'Fat(g)', label: 'Fat (g)' },
  { key: 'Saturates(g)', label: 'Saturates (g)' },
  { key: 'Carbohydrates(g)', label: 'Carbohydrates (g)' },
  { key: 'Total sugars(g)', label: 'Total sugars (g)' },
  { key: 'Protein(g)', label: 'Protein (g)' },
  { key: 'Salt(g)', label: 'Salt (g)' },
  { key: 'Fibre(g)', label: 'Fibre (g)' },
];

export function unitTypeLabel(id: string): string {
  return UNIT_LABEL[id] ?? id;
}
