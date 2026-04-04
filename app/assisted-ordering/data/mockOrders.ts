import type { Supplier, Ingredient, SupplierProduct, SuggestedOrder } from '../types';

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const SUPPLIERS: Supplier[] = [
  {
    id: 'sup-bidvest',
    name: 'Bidvest',
    cutOffTime: '14:00',
    leadTimeDays: 1,
    minimumOrderValue: 350,
    deliveryDays: ['Tuesday', 'Thursday'],
    email: 'orders@bidvest.co.za',
    deliveryDate: 'Thu 10 Apr',
    sendTime: '13:30',
  },
  {
    id: 'sup-cpu',
    name: 'CPU — Central Kitchen',
    cutOffTime: '16:00',
    leadTimeDays: 1,
    minimumOrderValue: 0,
    deliveryDays: ['Monday', 'Wednesday', 'Friday'],
    email: 'orders@cpu.co.za',
    deliveryDate: 'Mon 7 Apr',
    sendTime: '15:30',
  },
  {
    id: 'sup-cheese',
    name: 'The Cheese Board',
    cutOffTime: '10:00',
    leadTimeDays: 2,
    minimumOrderValue: 200,
    deliveryDays: ['Wednesday'],
    email: 'hello@cheeseboard.co.za',
    deliveryDate: 'Wed 9 Apr',
    sendTime: '09:30',
  },
];

// ─── Ingredients ─────────────────────────────────────────────────────────────

export const INGREDIENTS: Ingredient[] = [
  {
    id: 'ing-oatmilk',
    name: 'Oat Milk',
    variant: 'Califa Farms 1L',
    stockUnit: 'L',
    currentStock: 2,
    stockDataAgeDays: 1,
    parLevel: 10,
    parConfirmed: true,
  },
  {
    id: 'ing-evoo',
    name: 'Extra Virgin Olive Oil',
    variant: 'Organic 5L',
    stockUnit: 'L',
    currentStock: 1,
    stockDataAgeDays: 2,
    parLevel: 8,
    parConfirmed: true,
  },
  {
    id: 'ing-chicken',
    name: 'Chicken Breast',
    variant: 'Free-range portion',
    stockUnit: 'kg',
    currentStock: 3.5,
    stockDataAgeDays: 5,
    parLevel: 12,
    parConfirmed: false,
  },
  {
    id: 'ing-tomato-paste',
    name: 'Tomato Paste',
    variant: 'Rhodes 410g tin',
    stockUnit: 'units',
    currentStock: 3,
    stockDataAgeDays: 1,
    parLevel: 8,
    parConfirmed: true,
  },
  {
    id: 'ing-flour',
    name: 'Bread Flour',
    variant: 'Eureka Mills 12.5kg',
    stockUnit: 'kg',
    currentStock: 8,
    stockDataAgeDays: 1,
    parLevel: 25,
    parConfirmed: true,
  },
  {
    id: 'ing-butter',
    name: 'Butter',
    variant: 'Président 500g block',
    stockUnit: 'kg',
    currentStock: 1,
    stockDataAgeDays: 3,
    parLevel: 4,
    parConfirmed: true,
  },
  {
    id: 'ing-gruyere',
    name: 'Gruyère',
    variant: 'Le Gruyère AOP 500g',
    stockUnit: 'kg',
    currentStock: 0.5,
    stockDataAgeDays: 2,
    parLevel: 3,
    parConfirmed: false,
  },
  {
    id: 'ing-cream',
    name: 'Whipping Cream',
    variant: 'Lancewood 1L',
    stockUnit: 'L',
    currentStock: 2,
    stockDataAgeDays: 9,
    parLevel: 6,
    parConfirmed: true,
  },
];

// ─── Supplier Products ────────────────────────────────────────────────────────

export const SUPPLIER_PRODUCTS: SupplierProduct[] = [
  // Bidvest products
  { ingredientId: 'ing-oatmilk', supplierId: 'sup-bidvest', isPrimary: true, unitName: 'case of 6', unitSize: 6, unitCost: 48, available: true },
  { ingredientId: 'ing-evoo', supplierId: 'sup-bidvest', isPrimary: true, unitName: '5L bottle', unitSize: 5, unitCost: 89, available: true },
  { ingredientId: 'ing-chicken', supplierId: 'sup-bidvest', isPrimary: true, unitName: '5kg bag', unitSize: 5, unitCost: 175, available: true },
  { ingredientId: 'ing-tomato-paste', supplierId: 'sup-bidvest', isPrimary: true, unitName: 'case of 12', unitSize: 12, unitCost: 54, available: true },
  // CPU products
  { ingredientId: 'ing-flour', supplierId: 'sup-cpu', isPrimary: true, unitName: '12.5kg bag', unitSize: 12.5, unitCost: 92, available: true },
  { ingredientId: 'ing-butter', supplierId: 'sup-cpu', isPrimary: true, unitName: '10 × 500g', unitSize: 5, unitCost: 185, available: true },
  // Cheese Board products
  { ingredientId: 'ing-gruyere', supplierId: 'sup-cheese', isPrimary: true, unitName: '500g piece', unitSize: 0.5, unitCost: 78, available: true },
  { ingredientId: 'ing-cream', supplierId: 'sup-cheese', isPrimary: true, unitName: 'case of 6 × 1L', unitSize: 6, unitCost: 96, available: true },
];

// ─── Suggested Orders ─────────────────────────────────────────────────────────

export const SUGGESTED_ORDERS: SuggestedOrder[] = [
  {
    id: 'ord-bidvest',
    supplierId: 'sup-bidvest',
    state: 'draft',
    deliveryDate: 'Thu 10 Apr',
    sendTime: '13:30',
    lines: [
      {
        id: 'line-oatmilk',
        orderId: 'ord-bidvest',
        ingredientId: 'ing-oatmilk',
        supplierId: 'sup-bidvest',
        suggestedQty: 2,
        suggestedPar: 10,
        currentStockAtSuggestion: 2,
        stockDataAgeDays: 1,
        posDataAvailable: true,
        salesVelocity7d: 1.2,
        salesVelocity14d: 1.1,
        confidenceScore: 'high',
        confidenceFactors: { stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable' },
        movAutoAdded: false,
        userAction: null,
        finalQty: null,
        dismissReason: null,
        movWarnShown: false,
      },
      {
        id: 'line-evoo',
        orderId: 'ord-bidvest',
        ingredientId: 'ing-evoo',
        supplierId: 'sup-bidvest',
        suggestedQty: 2,
        suggestedPar: 8,
        currentStockAtSuggestion: 1,
        stockDataAgeDays: 2,
        posDataAvailable: true,
        salesVelocity7d: 0.8,
        salesVelocity14d: 1.0,
        confidenceScore: 'high',
        confidenceFactors: { stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable' },
        movAutoAdded: false,
        userAction: null,
        finalQty: null,
        dismissReason: null,
        movWarnShown: false,
      },
      {
        id: 'line-chicken',
        orderId: 'ord-bidvest',
        ingredientId: 'ing-chicken',
        supplierId: 'sup-bidvest',
        suggestedQty: 2,
        suggestedPar: 12,
        currentStockAtSuggestion: 3.5,
        stockDataAgeDays: 5,
        posDataAvailable: false,
        salesVelocity7d: null,
        salesVelocity14d: null,
        confidenceScore: 'medium',
        confidenceFactors: { stocktake: 'aging', pos: 'unavailable', par: 'suggested', variance: 'stable' },
        movAutoAdded: false,
        userAction: null,
        finalQty: null,
        dismissReason: null,
        movWarnShown: false,
      },
      {
        id: 'line-tomato-paste',
        orderId: 'ord-bidvest',
        ingredientId: 'ing-tomato-paste',
        supplierId: 'sup-bidvest',
        suggestedQty: 1,
        suggestedPar: 8,
        currentStockAtSuggestion: 3,
        stockDataAgeDays: 1,
        posDataAvailable: true,
        salesVelocity7d: 0.4,
        salesVelocity14d: 0.5,
        confidenceScore: 'medium',
        confidenceFactors: { stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'moderate' },
        movAutoAdded: true,
        userAction: null,
        finalQty: null,
        dismissReason: null,
        movWarnShown: true,
      },
    ],
  },
  {
    id: 'ord-cpu',
    supplierId: 'sup-cpu',
    state: 'draft',
    deliveryDate: 'Mon 7 Apr',
    sendTime: '15:30',
    lines: [
      {
        id: 'line-flour',
        orderId: 'ord-cpu',
        ingredientId: 'ing-flour',
        supplierId: 'sup-cpu',
        suggestedQty: 2,
        suggestedPar: 25,
        currentStockAtSuggestion: 8,
        stockDataAgeDays: 1,
        posDataAvailable: true,
        salesVelocity7d: 2.5,
        salesVelocity14d: 2.2,
        confidenceScore: 'high',
        confidenceFactors: { stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable' },
        movAutoAdded: false,
        userAction: null,
        finalQty: null,
        dismissReason: null,
        movWarnShown: false,
      },
      {
        id: 'line-butter',
        orderId: 'ord-cpu',
        ingredientId: 'ing-butter',
        supplierId: 'sup-cpu',
        suggestedQty: 1,
        suggestedPar: 4,
        currentStockAtSuggestion: 1,
        stockDataAgeDays: 3,
        posDataAvailable: true,
        salesVelocity7d: 0.3,
        salesVelocity14d: 0.35,
        confidenceScore: 'medium',
        confidenceFactors: { stocktake: 'fresh', pos: 'active', par: 'confirmed', variance: 'stable' },
        movAutoAdded: false,
        userAction: null,
        finalQty: null,
        dismissReason: null,
        movWarnShown: false,
      },
    ],
  },
  {
    id: 'ord-cheese',
    supplierId: 'sup-cheese',
    state: 'draft',
    deliveryDate: 'Wed 9 Apr',
    sendTime: '09:30',
    lines: [
      {
        id: 'line-gruyere',
        orderId: 'ord-cheese',
        ingredientId: 'ing-gruyere',
        supplierId: 'sup-cheese',
        suggestedQty: 5,
        suggestedPar: 3,
        currentStockAtSuggestion: 0.5,
        stockDataAgeDays: 2,
        posDataAvailable: true,
        salesVelocity7d: 0.25,
        salesVelocity14d: 0.2,
        confidenceScore: 'medium',
        confidenceFactors: { stocktake: 'fresh', pos: 'active', par: 'suggested', variance: 'stable' },
        movAutoAdded: false,
        userAction: null,
        finalQty: null,
        dismissReason: null,
        movWarnShown: false,
      },
      {
        id: 'line-cream',
        orderId: 'ord-cheese',
        ingredientId: 'ing-cream',
        supplierId: 'sup-cheese',
        suggestedQty: 1,
        suggestedPar: 6,
        currentStockAtSuggestion: 2,
        stockDataAgeDays: 9,
        posDataAvailable: true,
        salesVelocity7d: 0.5,
        salesVelocity14d: 0.6,
        confidenceScore: 'low',
        confidenceFactors: { stocktake: 'stale', pos: 'active', par: 'confirmed', variance: 'stable' },
        movAutoAdded: false,
        userAction: null,
        finalQty: null,
        dismissReason: null,
        movWarnShown: false,
      },
    ],
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getSupplier(id: string): Supplier {
  const s = SUPPLIERS.find((s) => s.id === id);
  if (!s) throw new Error(`Supplier ${id} not found`);
  return s;
}

export function getIngredient(id: string): Ingredient {
  const i = INGREDIENTS.find((i) => i.id === id);
  if (!i) throw new Error(`Ingredient ${id} not found`);
  return i;
}

export function getProduct(ingredientId: string, supplierId: string): SupplierProduct {
  const p = SUPPLIER_PRODUCTS.find(
    (p) => p.ingredientId === ingredientId && p.supplierId === supplierId,
  );
  if (!p) throw new Error(`Product ${ingredientId}/${supplierId} not found`);
  return p;
}

// Near-cutoff: treat Cheese Board as urgent (cutoff at 09:30 — would already be past in a real app,
// here we mark it as urgent for demo purposes to show the urgency UI)
export function isUrgent(supplier: Supplier): boolean {
  return supplier.id === 'sup-cheese';
}
