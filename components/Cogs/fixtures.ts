/**
 * COGS demo fixtures — a single self-producing site ("Pret Hub Kitchen")
 * over one stocktake period. Mirrors the shape of the real Edify COGS
 * dashboard (Single Site COGs + COGs Variance), but with a coherent,
 * non-zero story so the theoretical-vs-actual gauges and the AI insight
 * narratives have something meaningful to explain.
 *
 * Currency is GBP ($). All money values are pre-rounded; percentages are
 * derived so the table footers always reconcile.
 */

export const COGS_SITE_NAME = 'Pret Hub Kitchen';

export const COGS_PERIOD = {
  openingLabel: 'Dec 31, 2025',
  closingLabel: 'Jan 07, 2026',
} as const;

export type ProductClass = 'Beverage' | 'Food' | 'General' | 'Other' | 'Unassigned';

/** Raw, hand-authored inputs for one product class over the period. The
 *  Actual COGS and the percentage columns are derived from these so the
 *  breakdown table and its totals footer always tie out. */
export type CogsClassInput = {
  id: string;
  productClass: ProductClass;
  openingStock: number;
  purchases: number;
  transfersIn: number;
  transfersOut: number;
  waste: number;
  closingStock: number;
  /** Net sales attributed to this class. `Unassigned` has none — that is
   *  itself a discrepancy the insights call out (spend with no menu map). */
  sales: number;
  /** Theoretical (recipe-costed) food-cost % target for this class. */
  theoreticalPct: number;
};

export type CogsClassRow = CogsClassInput & {
  /** Actual COGS = opening + purchases + transfers in − transfers out − closing. */
  actualCogs: number;
  /** Actual COGS as a % of class sales (null when the class has no sales). */
  actualPct: number | null;
  /** Gross margin % = 100 − actual %. */
  grossMarginPct: number | null;
  /** Theoretical COGS in $ = sales × theoretical %. */
  theoreticalCogs: number;
};

const CLASS_INPUTS: CogsClassInput[] = [
  {
    id: 'beverage',
    productClass: 'Beverage',
    openingStock: 2400.0,
    purchases: 3600.0,
    transfersIn: 0,
    transfersOut: 0,
    waste: 70.0,
    closingStock: 2250.0,
    sales: 15000.0,
    theoreticalPct: 21.5,
  },
  {
    id: 'food',
    productClass: 'Food',
    openingStock: 9800.0,
    purchases: 9700.0,
    transfersIn: 200.0,
    transfersOut: 750.0,
    waste: 190.0,
    closingStock: 9500.0,
    sales: 30000.0,
    theoreticalPct: 28.0,
  },
  {
    id: 'general',
    productClass: 'General',
    openingStock: 850.0,
    purchases: 780.0,
    transfersIn: 0,
    transfersOut: 50.0,
    waste: 12.0,
    closingStock: 780.0,
    sales: 5000.0,
    theoreticalPct: 15.0,
  },
  {
    id: 'other',
    productClass: 'Other',
    openingStock: 190.0,
    purchases: 75.0,
    transfersIn: 0,
    transfersOut: 0,
    waste: 6.0,
    closingStock: 175.0,
    sales: 1000.0,
    theoreticalPct: 8.0,
  },
  {
    id: 'unassigned',
    productClass: 'Unassigned',
    openingStock: 0,
    purchases: 140.0,
    transfersIn: 0,
    transfersOut: 0,
    waste: 0,
    closingStock: 30.0,
    sales: 0,
    theoreticalPct: 0,
  },
];

function deriveClassRow(input: CogsClassInput): CogsClassRow {
  const actualCogs =
    input.openingStock +
    input.purchases +
    input.transfersIn -
    input.transfersOut -
    input.closingStock;
  const actualPct = input.sales > 0 ? (actualCogs / input.sales) * 100 : null;
  const grossMarginPct = actualPct === null ? null : 100 - actualPct;
  const theoreticalCogs = (input.sales * input.theoreticalPct) / 100;
  return { ...input, actualCogs, actualPct, grossMarginPct, theoreticalCogs };
}

export const COGS_CLASS_ROWS: CogsClassRow[] = CLASS_INPUTS.map(deriveClassRow);

export type CogsClassTotals = {
  openingStock: number;
  purchases: number;
  transfersIn: number;
  transfersOut: number;
  waste: number;
  closingStock: number;
  sales: number;
  actualCogs: number;
  theoreticalCogs: number;
  actualPct: number;
  theoreticalPct: number;
  grossMarginPct: number;
};

function sum(pick: (r: CogsClassRow) => number): number {
  return COGS_CLASS_ROWS.reduce((acc, r) => acc + pick(r), 0);
}

export const COGS_CLASS_TOTALS: CogsClassTotals = (() => {
  const sales = sum((r) => r.sales);
  const actualCogs = sum((r) => r.actualCogs);
  const theoreticalCogs = sum((r) => r.theoreticalCogs);
  const actualPct = sales > 0 ? (actualCogs / sales) * 100 : 0;
  const theoreticalPct = sales > 0 ? (theoreticalCogs / sales) * 100 : 0;
  return {
    openingStock: sum((r) => r.openingStock),
    purchases: sum((r) => r.purchases),
    transfersIn: sum((r) => r.transfersIn),
    transfersOut: sum((r) => r.transfersOut),
    waste: sum((r) => r.waste),
    closingStock: sum((r) => r.closingStock),
    sales,
    actualCogs,
    theoreticalCogs,
    actualPct,
    theoreticalPct,
    grossMarginPct: 100 - actualPct,
  };
})();

/** Header KPIs + the Actual-vs-Theoretical summary block. */
export const COGS_SUMMARY = {
  totalNetSales: COGS_CLASS_TOTALS.sales,
  actualCogs: COGS_CLASS_TOTALS.actualCogs,
  theoreticalCogs: COGS_CLASS_TOTALS.theoreticalCogs,
  actualPct: COGS_CLASS_TOTALS.actualPct,
  theoreticalPct: COGS_CLASS_TOTALS.theoreticalPct,
  actualGrossMarginPct: 100 - COGS_CLASS_TOTALS.actualPct,
  theoreticalGrossMarginPct: 100 - COGS_CLASS_TOTALS.theoreticalPct,
  /** Variance in percentage points (positive = unfavourable, costing more). */
  variancePp: COGS_CLASS_TOTALS.actualPct - COGS_CLASS_TOTALS.theoreticalPct,
  /** Variance in $ (positive = unfavourable). */
  varianceCost: COGS_CLASS_TOTALS.actualCogs - COGS_CLASS_TOTALS.theoreticalCogs,
  openingStock: COGS_CLASS_TOTALS.openingStock,
  purchases: COGS_CLASS_TOTALS.purchases,
  transfersNet: COGS_CLASS_TOTALS.transfersIn - COGS_CLASS_TOTALS.transfersOut,
  closingStock: COGS_CLASS_TOTALS.closingStock,
} as const;

// ── COGS VARIANCE (product level) ──────────────────────────────────────
// One row per master product. Values are authored explicitly (rather than
// derived) so every column matches the kind of messy, real-world figure
// the live product surfaces — short deliveries, uncosted recipes, bar
// shrinkage, spoilage, over-portioning, staff food not rung in, etc.
// `insightId` links high-variance rows to a scripted Edify narrative in
// insights.ts.

export type CogsVarianceRow = {
  id: string;
  name: string;
  productClass: ProductClass;
  packType: string;
  unitCost: number;
  openingStock: number;
  purchases: number;
  /** Net transfer in/out for the period (+ in, − out). */
  transfer: number;
  waste: number;
  closingStock: number;
  stockValue: number;
  actualUsage: number;
  actualCost: number;
  theoUsage: number;
  theoCost: number;
  varQty: number;
  varCost: number;
  /** Variance % = varCost / actualCost (matches the live product). */
  varPct: number;
  insightId?: string;
};

export const COGS_VARIANCE_ROWS: CogsVarianceRow[] = [
  {
    id: 'apple-green-julienne',
    name: 'Apple Green Julienne',
    productClass: 'Food',
    packType: 'Pack',
    unitCost: 3.25,
    openingStock: 0,
    purchases: 50,
    transfer: 0,
    waste: 0,
    closingStock: 34,
    stockValue: 110.5,
    actualUsage: 16,
    actualCost: 52.0,
    theoUsage: 17,
    theoCost: 55.25,
    varQty: -1,
    varCost: -3.25,
    varPct: -6.3,
  },
  {
    id: 'smoked-salmon',
    name: 'Smoked Salmon Sliced',
    productClass: 'Food',
    packType: 'Pack',
    unitCost: 22.0,
    openingStock: 6,
    purchases: 38,
    transfer: 0,
    waste: 1,
    closingStock: 8,
    stockValue: 176.0,
    actualUsage: 35,
    actualCost: 770.0,
    theoUsage: 28,
    theoCost: 616.0,
    varQty: 7,
    varCost: 154.0,
    varPct: 25.0,
    insightId: 'smoked-salmon',
  },
  {
    id: 'house-red-wine',
    name: 'House Red Wine 75cl',
    productClass: 'Beverage',
    packType: 'Bottle',
    unitCost: 6.5,
    openingStock: 24,
    purchases: 60,
    transfer: 0,
    waste: 2,
    closingStock: 22,
    stockValue: 143.0,
    actualUsage: 60,
    actualCost: 390.0,
    theoUsage: 48,
    theoCost: 312.0,
    varQty: 12,
    varCost: 78.0,
    varPct: 25.0,
    insightId: 'house-red-wine',
  },
  {
    id: 'sourdough-loaf',
    name: 'Sourdough Loaf',
    productClass: 'Food',
    packType: 'Each',
    unitCost: 1.6,
    openingStock: 40,
    purchases: 220,
    transfer: 0,
    waste: 5,
    closingStock: 75,
    stockValue: 120.0,
    actualUsage: 180,
    actualCost: 288.0,
    theoUsage: 155,
    theoCost: 248.0,
    varQty: 25,
    varCost: 40.0,
    varPct: 16.1,
    insightId: 'sourdough-loaf',
  },
  {
    id: 'avocado',
    name: 'Avocado',
    productClass: 'Food',
    packType: 'Kilogram',
    unitCost: 4.2,
    openingStock: 18,
    purchases: 130,
    transfer: 0,
    waste: 2,
    closingStock: 18,
    stockValue: 75.6,
    actualUsage: 128,
    actualCost: 537.6,
    theoUsage: 52,
    theoCost: 218.4,
    varQty: 76,
    varCost: 319.2,
    varPct: 59.4,
    insightId: 'avocado',
  },
  {
    id: 'avocado-cheese-croissant',
    name: 'Avocado and Cheese hot croissant',
    productClass: 'Food',
    packType: 'Each',
    unitCost: 1.95,
    openingStock: 0,
    purchases: 30,
    transfer: 0,
    waste: 0,
    closingStock: 6,
    stockValue: 11.7,
    actualUsage: 24,
    actualCost: 46.8,
    theoUsage: 28,
    theoCost: 54.6,
    varQty: -4,
    varCost: -7.8,
    varPct: -16.7,
  },
  {
    id: 'bagel-vegan-multigrain',
    name: 'Bagel Vegan Multi Grain 60g',
    productClass: 'Food',
    packType: 'Each',
    unitCost: 0.45,
    openingStock: 240,
    purchases: 350,
    transfer: 0,
    waste: 0,
    closingStock: 180,
    stockValue: 81.0,
    actualUsage: 410,
    actualCost: 184.5,
    theoUsage: 360,
    theoCost: 162.0,
    varQty: 50,
    varCost: 22.5,
    varPct: 12.2,
    insightId: 'bagel-vegan',
  },
  {
    id: 'baguette-selection-platter',
    name: 'Baguette Selection Platter',
    productClass: 'Food',
    packType: 'Each',
    unitCost: 12.5,
    openingStock: 0,
    purchases: 0,
    transfer: -1,
    waste: 0,
    closingStock: 0,
    stockValue: 0,
    actualUsage: -1,
    actualCost: -12.5,
    theoUsage: 0,
    theoCost: 0,
    varQty: -1,
    varCost: -12.5,
    varPct: -100,
  },
  {
    id: 'banana',
    name: 'Banana',
    productClass: 'Food',
    packType: 'Kilogram',
    unitCost: 1.1,
    openingStock: 10,
    purchases: 42,
    transfer: -1.2,
    waste: 1.8,
    closingStock: 20,
    stockValue: 22.0,
    actualUsage: 29,
    actualCost: 31.9,
    theoUsage: 33,
    theoCost: 36.3,
    varQty: -4,
    varCost: -4.4,
    varPct: -13.8,
  },
  {
    id: 'basil-leaves-sanitized',
    name: 'Basil Leaves Sanitized',
    productClass: 'Food',
    packType: 'Pack',
    unitCost: 3.1,
    openingStock: 6,
    purchases: 30,
    transfer: 0,
    waste: 4,
    closingStock: 7,
    stockValue: 21.7,
    actualUsage: 25,
    actualCost: 77.5,
    theoUsage: 19,
    theoCost: 58.9,
    varQty: 6,
    varCost: 18.6,
    varPct: 31.6,
    insightId: 'basil-leaves',
  },
  {
    id: 'beans-red-kidney',
    name: 'Beans Red Kidney',
    productClass: 'Food',
    packType: 'Jar',
    unitCost: 1.2,
    openingStock: 18,
    purchases: 60,
    transfer: 0,
    waste: 0,
    closingStock: 46,
    stockValue: 55.2,
    actualUsage: 32,
    actualCost: 38.4,
    theoUsage: 26,
    theoCost: 31.2,
    varQty: 6,
    varCost: 7.2,
    varPct: 18.8,
    insightId: 'beans-red-kidney',
  },
  {
    id: 'whole-milk',
    name: 'Whole Milk 1L',
    productClass: 'Beverage',
    packType: 'Each',
    unitCost: 0.95,
    openingStock: 80,
    purchases: 300,
    transfer: -20,
    waste: 8,
    closingStock: 70,
    stockValue: 66.5,
    actualUsage: 282,
    actualCost: 267.9,
    theoUsage: 255,
    theoCost: 242.25,
    varQty: 27,
    varCost: 25.65,
    varPct: 9.6,
    insightId: 'whole-milk',
  },
  {
    id: 'oat-milk',
    name: 'Oat Milk Barista 1L',
    productClass: 'Beverage',
    packType: 'Each',
    unitCost: 1.4,
    openingStock: 50,
    purchases: 150,
    transfer: 0,
    waste: 4,
    closingStock: 36,
    stockValue: 50.4,
    actualUsage: 160,
    actualCost: 224.0,
    theoUsage: 130,
    theoCost: 182.0,
    varQty: 30,
    varCost: 42.0,
    varPct: 18.8,
    insightId: 'oat-milk',
  },
  {
    id: 'arabica-beans',
    name: 'Arabica Coffee Beans 1kg',
    productClass: 'Beverage',
    packType: 'Kilogram',
    unitCost: 14,
    openingStock: 6,
    purchases: 22,
    transfer: -2,
    waste: 0,
    closingStock: 8,
    stockValue: 112.0,
    actualUsage: 18,
    actualCost: 252.0,
    theoUsage: 17.5,
    theoCost: 245.0,
    varQty: 0.5,
    varCost: 7.0,
    varPct: 2.8,
  },
  {
    id: 'chicken-breast',
    name: 'Chicken Breast Fillet',
    productClass: 'Food',
    packType: 'Kilogram',
    unitCost: 6.5,
    openingStock: 10,
    purchases: 120,
    transfer: -6,
    waste: 2,
    closingStock: 12,
    stockValue: 78.0,
    actualUsage: 110,
    actualCost: 715.0,
    theoUsage: 92,
    theoCost: 598.0,
    varQty: 18,
    varCost: 117.0,
    varPct: 16.4,
    insightId: 'chicken-breast',
  },
  {
    id: 'cheddar-block',
    name: 'Mature Cheddar Block 2kg',
    productClass: 'Food',
    packType: 'Each',
    unitCost: 17,
    openingStock: 14,
    purchases: 36,
    transfer: 0,
    waste: 1,
    closingStock: 11,
    stockValue: 187.0,
    actualUsage: 38,
    actualCost: 646.0,
    theoUsage: 37,
    theoCost: 629.0,
    varQty: 1,
    varCost: 17.0,
    varPct: 2.6,
  },
  {
    id: 'takeaway-cup-12oz',
    name: 'Takeaway Cup 12oz (sleeve)',
    productClass: 'General',
    packType: 'Sleeve',
    unitCost: 4.5,
    openingStock: 40,
    purchases: 120,
    transfer: -8,
    waste: 0,
    closingStock: 34,
    stockValue: 153.0,
    actualUsage: 118,
    actualCost: 531.0,
    theoUsage: 121,
    theoCost: 544.5,
    varQty: -3,
    varCost: -13.5,
    varPct: -2.5,
  },
  {
    id: 'cleaning-spray',
    name: 'Surface Cleaner 5L',
    productClass: 'Other',
    packType: 'Each',
    unitCost: 7.5,
    openingStock: 6,
    purchases: 8,
    transfer: 0,
    waste: 0,
    closingStock: 5,
    stockValue: 37.5,
    actualUsage: 9,
    actualCost: 67.5,
    theoUsage: 8,
    theoCost: 60.0,
    varQty: 1,
    varCost: 7.5,
    varPct: 11.1,
  },
];
