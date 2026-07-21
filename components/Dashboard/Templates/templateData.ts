/**
 * Mock data for the three starter dashboard templates.
 *
 * Same fictional estate as the rest of the internal prototype (Fitzroy
 * Espresso + five sister sites). Numbers are internally consistent —
 * the weekly league rolls up to the period figures, one site is missing
 * its stocktake everywhere that matters, and the GP bridge reconciles:
 * theoretical − waste − unexplained = actual.
 */

// ─── Daily · single site (Fitzroy), yesterday's trade ────────────────────────

export const DAILY_SITE = 'Fitzroy';
export const DAILY_DATE_LABEL = 'Monday 20 Jul';

export type DailySparkPoint = { d: string; sales: number; forecast: number };

/** Last 14 trading days, most recent last (yesterday). */
export const DAILY_SALES_14D: DailySparkPoint[] = [
  { d: '7 Jul', sales: 6120, forecast: 6200 },
  { d: '8 Jul', sales: 6480, forecast: 6350 },
  { d: '9 Jul', sales: 6310, forecast: 6400 },
  { d: '10 Jul', sales: 6890, forecast: 6600 },
  { d: '11 Jul', sales: 7420, forecast: 7100 },
  { d: '12 Jul', sales: 6950, forecast: 7200 },
  { d: '13 Jul', sales: 6780, forecast: 6500 },
  { d: '14 Jul', sales: 6240, forecast: 6300 },
  { d: '15 Jul', sales: 6590, forecast: 6450 },
  { d: '16 Jul', sales: 6420, forecast: 6500 },
  { d: '17 Jul', sales: 7010, forecast: 6700 },
  { d: '18 Jul', sales: 7580, forecast: 7250 },
  { d: '19 Jul', sales: 7130, forecast: 7300 },
  { d: '20 Jul', sales: 6940, forecast: 6600 },
];

export const DAILY_YESTERDAY = {
  sales: 6940,
  forecast: 6600,
  sameDayLastWeek: 6780,
};

export const DAILY_THEO_GP = {
  pct: 68.1,
  vsLastWeekPp: -0.4,
  posMappedPct: 94, // share of yesterday's POS sales with a recipe mapping
};

export const DAILY_WASTE = {
  loggedValue: 86,
  pctOfSales: 1.2,
  targetPct: 1.5,
};

/**
 * Item-level waste for yesterday, in the shape the product's Waste watch
 * card uses: each item against its typical for the same weekday, with a
 * short action hint on anomalies only.
 */
export type DailyWasteItem = {
  product: string;
  unitsYesterday: number;
  unitsTypical: number;
  spendYesterday: number;
  spendTypical: number;
  flag?: string;
};

export const DAILY_WASTE_ITEMS: DailyWasteItem[] = [
  { product: 'Whole milk (steaming jugs)', unitsYesterday: 4, unitsTypical: 3, spendYesterday: 24, spendTypical: 18 },
  { product: 'Butter croissants', unitsYesterday: 6, unitsTypical: 4, spendYesterday: 18, spendTypical: 12, flag: 'Cut the late-afternoon bake by four' },
  { product: 'Avocado', unitsYesterday: 4, unitsTypical: 2, spendYesterday: 14, spendTypical: 7, flag: 'Check prep portioning' },
  { product: 'Ham & cheese baguette', unitsYesterday: 2, unitsTypical: 2, spendYesterday: 12, spendTypical: 12 },
  { product: 'Carrot cake slice', unitsYesterday: 2, unitsTypical: 2, spendYesterday: 9, spendTypical: 9 },
  { product: 'Fruit cup', unitsYesterday: 2, unitsTypical: 2, spendYesterday: 9, spendTypical: 10 },
];

export type DailyException = {
  label: string;
  count: number;
  detail: string;
  href: string;
};

export const DAILY_EXCEPTIONS: DailyException[] = [
  { label: 'Unmatched invoices', count: 3, detail: 'Brakes ×2, Direct Seafoods ×1', href: '/invoices' },
  { label: 'Un-receipted GRNs', count: 2, detail: 'Fri delivery not booked in', href: '/receive' },
  { label: 'Items below par', count: 5, detail: 'Oat milk, cups 12oz, espresso beans…', href: '/stock' },
  { label: 'POs due today', count: 4, detail: 'Brakes 7am · La Boulangerie 8am', href: '/purchase-orders' },
];

export type DailyAnomaly = {
  headline: string;
  detail: string;
  kind: 'price' | 'usage';
};

export const DAILY_ANOMALIES: DailyAnomaly[] = [
  {
    kind: 'price',
    headline: 'Oat milk up 8.4% on yesterday\u2019s Brakes invoice',
    detail: '£1.42 → £1.54 per litre. Third rise this quarter; annualised impact ~£1,120 across the estate.',
  },
  {
    kind: 'usage',
    headline: 'Mozzarella usage 22% above what sales imply',
    detail: 'POS sold 41 items using mozzarella; depletion suggests ~50 portions. Check prep over-portioning or un-logged waste.',
  },
  {
    kind: 'price',
    headline: 'Espresso beans invoiced at contract price again',
    detail: 'Last week\u2019s +5% variance has reverted — the supplier corrected the pricing error you flagged.',
  },
];

// ─── Weekly flash · all six sites, last week ─────────────────────────────────

export const WEEK_LABEL = 'W/C 13 Jul';

export type WeeklySiteRow = {
  site: string;
  sales: number;
  vsLwPct: number;
  vsForecastPct: number;
  theoGpPct: number;
  /** Weekly stocktake completed → actual GP is computable. */
  stocktakeDone: boolean;
  actualGpPct: number | null;
  wastePctOfSales: number;
  spendPctOfSales: number;
  /** Purchasing spend vs the site's own trailing 4-week average. */
  spendVsTrailing4wkPct: number;
};

export const WEEKLY_SITES: WeeklySiteRow[] = [
  { site: 'Riverside', sales: 52400, vsLwPct: 4.8, vsForecastPct: 2.9, theoGpPct: 70.2, stocktakeDone: true, actualGpPct: 68.9, wastePctOfSales: 1.1, spendPctOfSales: 29.4, spendVsTrailing4wkPct: 1.2 },
  { site: 'Fitzroy', sales: 48100, vsLwPct: 3.1, vsForecastPct: 1.4, theoGpPct: 69.4, stocktakeDone: true, actualGpPct: 68.1, wastePctOfSales: 1.3, spendPctOfSales: 30.1, spendVsTrailing4wkPct: 0.6 },
  { site: 'Kings X', sales: 44700, vsLwPct: 2.2, vsForecastPct: -0.6, theoGpPct: 68.9, stocktakeDone: true, actualGpPct: 67.2, wastePctOfSales: 1.6, spendPctOfSales: 30.8, spendVsTrailing4wkPct: 2.1 },
  { site: 'Canary', sales: 41900, vsLwPct: -0.8, vsForecastPct: -1.9, theoGpPct: 67.8, stocktakeDone: true, actualGpPct: 65.4, wastePctOfSales: 2.4, spendPctOfSales: 32.6, spendVsTrailing4wkPct: 6.8 },
  { site: 'City Centre', sales: 39600, vsLwPct: 1.4, vsForecastPct: 0.2, theoGpPct: 66.1, stocktakeDone: true, actualGpPct: 64.9, wastePctOfSales: 1.9, spendPctOfSales: 31.9, spendVsTrailing4wkPct: 1.8 },
  { site: 'Shoreditch', sales: 36200, vsLwPct: -2.6, vsForecastPct: -3.4, theoGpPct: 65.3, stocktakeDone: false, actualGpPct: null, wastePctOfSales: 2.8, spendPctOfSales: 33.4, spendVsTrailing4wkPct: 5.2 },
];

export const WEEKLY_COMPLIANCE = {
  invoicesMatchedPct: 91,
  offCataloguePos: 6,
  stocktakesDone: 5,
  stocktakesDue: 6,
  wasteLoggingDays: 38, // site-days with at least one waste log, of 42
  wasteLoggingDaysDue: 42,
};

/**
 * Top price movers — depends on line-level invoice price capture, which is
 * not yet confirmed. Shipped as a designed locked state, not approximated.
 */
export const PRICE_MOVERS_DEPENDENCY = 'line-level invoice prices';

// ─── Period end · estate, P7 (4 weeks) ───────────────────────────────────────

export const PERIOD_LABEL = 'P7 · 22 Jun – 19 Jul';

/** GP bridge, £k. theoretical − waste − unexplained = actual. */
export const GP_BRIDGE = {
  theoreticalGp: 412.8,
  waste: 7.4,
  unexplained: 10.6,
  actualGp: 394.8,
  sales: 601.2,
};

export type BridgeDrillItem = { item: string; value: number; note: string };

export const BRIDGE_DRILL: Record<'theoretical' | 'waste' | 'unexplained' | 'actual', BridgeDrillItem[]> = {
  theoretical: [
    { item: 'Espresso drinks', value: 168.4, note: '40.8% of theoretical GP · recipe margin 74%' },
    { item: 'Brewed coffee', value: 71.2, note: 'recipe margin 79%' },
    { item: 'Bakery', value: 62.9, note: 'recipe margin 61%' },
    { item: 'Sandwiches & food', value: 58.6, note: 'recipe margin 55%' },
    { item: 'Frappes & iced', value: 51.7, note: 'recipe margin 68%' },
  ],
  waste: [
    { item: 'Dairy & milk', value: 2.6, note: 'steaming-jug waste dominates · logged daily' },
    { item: 'Bakery', value: 2.1, note: 'end-of-day counts · consistent across sites' },
    { item: 'Produce', value: 1.6, note: 'avocado and salad prep' },
    { item: 'Coffee & dry', value: 0.7, note: 'dialling-in shots' },
    { item: 'Other', value: 0.4, note: '' },
  ],
  unexplained: [
    { item: 'Mozzarella', value: 2.4, note: 'usage 19% above sales-implied across the period' },
    { item: 'Oat milk', value: 1.9, note: 'part price movement, part over-portioning' },
    { item: 'Chicken (cooked)', value: 1.7, note: 'yield on cooking not captured — investigate' },
    { item: 'Espresso beans', value: 1.2, note: 'supplier price error weeks 1–2, since corrected' },
    { item: 'All other items', value: 3.4, note: 'no single item over £0.9k' },
  ],
  actual: [
    { item: 'Opening stock', value: 84.2, note: 'P6 closing counts' },
    { item: 'Purchases', value: 189.1, note: '96% matched to invoices' },
    { item: 'Closing stock', value: 86.9, note: '5 of 6 sites counted · Shoreditch estimated' },
  ],
};

export type CogsVarianceRow = {
  site: string;
  category: string;
  theoreticalK: number;
  actualK: number;
};

export const COGS_VARIANCE: CogsVarianceRow[] = [
  { site: 'Canary', category: 'Dairy', theoreticalK: 8.1, actualK: 9.3 },
  { site: 'Canary', category: 'Produce', theoreticalK: 4.2, actualK: 4.9 },
  { site: 'Shoreditch', category: 'Bakery', theoreticalK: 5.6, actualK: 6.2 },
  { site: 'Kings X', category: 'Dairy', theoreticalK: 7.8, actualK: 8.3 },
  { site: 'City Centre', category: 'Coffee', theoreticalK: 9.4, actualK: 9.8 },
  { site: 'Fitzroy', category: 'Produce', theoreticalK: 3.9, actualK: 4.1 },
  { site: 'Riverside', category: 'Coffee', theoreticalK: 9.9, actualK: 9.8 },
];

export const DATA_CONFIDENCE = {
  stocktakesDone: 5,
  stocktakesDue: 6,
  stocktakeMissingSite: 'Shoreditch',
  posMappedPct: 94,
  invoicesMatchedPct: 91,
  stocktakeAdjustmentPctOfCogs: 0.8,
};

export type MenuItemPoint = {
  item: string;
  marginPct: number;
  units: number;
  flag?: 'star' | 'delist';
};

export const MENU_PROFITABILITY: MenuItemPoint[] = [
  { item: 'Flat white', marginPct: 76, units: 19280, flag: 'star' },
  { item: 'Latte', marginPct: 74, units: 17240, flag: 'star' },
  { item: 'Americano', marginPct: 81, units: 12960, flag: 'star' },
  { item: 'Cappuccino', marginPct: 73, units: 14640 },
  { item: 'Iced latte', marginPct: 69, units: 7840 },
  { item: 'Maple latte', marginPct: 64, units: 9640 },
  { item: 'Butter croissant', marginPct: 58, units: 8720 },
  { item: 'Chai latte', marginPct: 61, units: 5000 },
  { item: 'Hot chocolate', marginPct: 57, units: 6760 },
  { item: 'Blueberry muffin', marginPct: 52, units: 5880 },
  { item: 'Halloumi wrap', marginPct: 48, units: 2140 },
  { item: 'Vegan brownie', marginPct: 41, units: 1320, flag: 'delist' },
  { item: 'Kombucha (retail)', marginPct: 34, units: 890, flag: 'delist' },
  { item: 'Matcha ceremonial', marginPct: 38, units: 640, flag: 'delist' },
];

export type StockHoldingRow = {
  site: string;
  valueK: number;
  daysCover: number;
};

export const STOCK_HOLDING: StockHoldingRow[] = [
  { site: 'Riverside', valueK: 16.8, daysCover: 9.2 },
  { site: 'Fitzroy', valueK: 15.1, daysCover: 8.7 },
  { site: 'Kings X', valueK: 14.4, daysCover: 9.8 },
  { site: 'Canary', valueK: 15.9, daysCover: 11.6 },
  { site: 'City Centre', valueK: 12.3, daysCover: 8.9 },
  { site: 'Shoreditch', valueK: 12.4, daysCover: 12.4 },
];

export type DeadStockRow = {
  item: string;
  site: string;
  value: number;
  lastUsed: string;
};

export const DEAD_STOCK: DeadStockRow[] = [
  { item: 'Pumpkin spice syrup ×9', site: 'Canary', value: 132, lastUsed: 'P4 (seasonal)' },
  { item: 'Gluten-free wraps ×48', site: 'Shoreditch', value: 96, lastUsed: 'P5' },
  { item: 'Decaf beans 3kg', site: 'City Centre', value: 84, lastUsed: 'P6' },
  { item: 'Oat cookie mix ×4', site: 'Kings X', value: 61, lastUsed: 'P5' },
  { item: 'Xmas cups sleeve ×300', site: 'Riverside', value: 54, lastUsed: 'P2 (seasonal)' },
];

export const DEAD_STOCK_TOTAL = DEAD_STOCK.reduce((s, r) => s + r.value, 0);

export type CpuTransferRow = {
  route: string;
  sentK: number;
  receivedK: number;
};

export const CPU_TRANSFERS: CpuTransferRow[] = [
  { route: 'CPU → Fitzroy', sentK: 12.4, receivedK: 12.4 },
  { route: 'CPU → Riverside', sentK: 13.1, receivedK: 13.1 },
  { route: 'CPU → Kings X', sentK: 11.2, receivedK: 10.9 },
  { route: 'CPU → Canary', sentK: 10.8, receivedK: 10.8 },
  { route: 'CPU → City Centre', sentK: 9.6, receivedK: 9.6 },
  { route: 'CPU → Shoreditch', sentK: 8.9, receivedK: 8.4 },
];

export type PeriodTrendPoint = {
  period: string;
  gpPct: number;
  wastePct: number;
  unexplainedPct: number; // as % of sales
};

export const PERIOD_TREND: PeriodTrendPoint[] = [
  { period: 'P4', gpPct: 64.6, wastePct: 1.9, unexplainedPct: 2.9 },
  { period: 'P5', gpPct: 65.0, wastePct: 1.7, unexplainedPct: 2.4 },
  { period: 'P6', gpPct: 65.2, wastePct: 1.5, unexplainedPct: 2.1 },
  { period: 'P7', gpPct: 65.7, wastePct: 1.2, unexplainedPct: 1.8 },
];

export const SUPPLIER_INFLATION_DEPENDENCY = 'line-level invoice prices + point-in-time WAC';
export const BUDGET_DEPENDENCY = 'budget CSV importer';

// ─── Line-level invoice prices (live once invoice matching ships) ────────────
//
// These datasets back the previously-locked tiles for customers with invoice
// matching: weekly top price movers, period supplier inflation, and the
// price-variance step in the GP bridge. All three share one dependency, so
// they go live together. Numbers reconcile: supplier price effects sum to
// the bridge's price-variance step, and the unexplained bucket shrinks by
// the same amount — price movement moves out of it, it doesn't disappear.

export type PriceMoverRow = {
  item: string;
  supplier: string;
  oldPrice: string;
  newPrice: string;
  changePct: number;
  /** £ impact on last week's purchasing at actual volumes. */
  weeklyImpact: number;
};

export const PRICE_MOVERS: PriceMoverRow[] = [
  { item: 'Oat milk 1L', supplier: 'Brakes', oldPrice: '£1.42', newPrice: '£1.54', changePct: 8.5, weeklyImpact: 48 },
  { item: 'Espresso beans 6kg', supplier: 'Union Roasters', oldPrice: '£58.20', newPrice: '£61.10', changePct: 5.0, weeklyImpact: 41 },
  { item: 'Mozzarella 1kg', supplier: 'Freshways', oldPrice: '£6.80', newPrice: '£7.20', changePct: 5.9, weeklyImpact: 34 },
  { item: 'Avocado (box of 16)', supplier: 'Produce Direct', oldPrice: '£11.40', newPrice: '£12.30', changePct: 7.9, weeklyImpact: 29 },
  { item: 'Chicken breast 2.5kg', supplier: 'Brakes', oldPrice: '£18.90', newPrice: '£17.95', changePct: -5.0, weeklyImpact: -22 },
];

export type SupplierInflationRow = {
  supplier: string;
  spendK: number;
  /** Change in spend caused by unit-price movement alone (£k, this period). */
  priceEffectK: number;
  /** Change in spend caused by buying more/less or a different mix (£k). */
  volumeMixK: number;
};

export const SUPPLIER_INFLATION: SupplierInflationRow[] = [
  { supplier: 'Brakes', spendK: 64.2, priceEffectK: 1.4, volumeMixK: 2.1 },
  { supplier: 'Freshways', spendK: 38.6, priceEffectK: 0.9, volumeMixK: 0.4 },
  { supplier: 'Union Roasters', spendK: 41.8, priceEffectK: 0.6, volumeMixK: 1.2 },
  { supplier: 'Produce Direct', spendK: 22.4, priceEffectK: 0.4, volumeMixK: -0.3 },
  { supplier: 'La Boulangerie', spendK: 18.1, priceEffectK: -0.2, volumeMixK: 0.5 },
];

export const SUPPLIER_PRICE_EFFECT_TOTAL_K = SUPPLIER_INFLATION.reduce(
  (s, r) => s + r.priceEffectK,
  0,
);

/**
 * Bridge upgrade one: the price-variance step. Equals the supplier price
 * effects above (3.1k); the unexplained bucket gives up exactly that amount.
 * theoretical − price − waste − unexplained(live) = actual, unchanged ends.
 */
export const GP_BRIDGE_PRICE_VARIANCE_K = 3.1;
export const GP_BRIDGE_UNEXPLAINED_LIVE_K = GP_BRIDGE.unexplained - GP_BRIDGE_PRICE_VARIANCE_K; // 7.5

export const BRIDGE_DRILL_PRICE: BridgeDrillItem[] = [
  { item: 'Brakes', value: 1.4, note: 'oat milk +8.5% and dry goods uplift · chicken price cut partially offsets' },
  { item: 'Freshways', value: 0.9, note: 'dairy contract reprice from wk 2' },
  { item: 'Union Roasters', value: 0.6, note: 'invoice error wks 1–2, since corrected — credit lands in P8' },
  { item: 'Produce Direct', value: 0.4, note: 'avocado spot-market movement' },
  { item: 'La Boulangerie', value: -0.2, note: 'volume-tier discount kicked in' },
];

/** Unexplained drill once price movement is measured out of the bucket. */
export const BRIDGE_DRILL_UNEXPLAINED_LIVE: BridgeDrillItem[] = [
  { item: 'Mozzarella', value: 2.4, note: 'usage 19% above sales-implied — portioning or un-logged waste' },
  { item: 'Chicken (cooked)', value: 1.7, note: 'yield on cooking not captured — investigate' },
  { item: 'Bakery counts', value: 0.9, note: 'end-of-day counts drift vs deliveries at two sites' },
  { item: 'Oat milk', value: 0.8, note: 'over-portioning only — the price element now sits in price variance' },
  { item: 'All other items', value: 1.7, note: 'no single item over £0.6k' },
];
