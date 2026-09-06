// Dummy data for the "Across all sites" section of the in-shift dashboard.
// It only renders when the sidebar site switcher is on "All sites"; a single
// site never sees these tiles because every one of them compares sites,
// suppliers or recipes across the estate.
//
// Estate = the 12 Fitzroy Espresso cafés in `permissions/sites.ts`. Weekly
// net sales run about £340k across the estate (roughly £28k a site), so the
// figures below are sized to that: about £4k a day per café, food and drink
// cost around 30% of net sales, waste around 2.5% of net sales.
//
// "This month" is September 2026 month to date (1–6 Sept). Where a chart
// compares to last month it compares like for like: 1–6 August, not the
// whole of August. "This week" is Mon 31 Aug – Sun 6 Sept, the range on
// the dashboard date pill.

import { ALL_SITES } from '@/components/Dashboard/permissions/sites';

// ── 1. Spend by supplier, this month vs last ──────────────────────────────
// Source: GRN (goods received note) value, ex VAT, matched to supplier.
// Not PO value: what actually arrived, priced at the invoice line.
// Top 8 suppliers by this-month spend; the long tail is left off rather
// than rolled into "Other" because the question is "who am I spending
// more with", and an Other bar can't answer that.

export type SupplierSpendPoint = {
  supplier: string;
  category: string;
  /** £k received 1–6 Sept. */
  thisMonth: number;
  /** £k received 1–6 Aug (same number of trading days). */
  lastMonth: number;
};

export const SUPPLIER_SPEND: SupplierSpendPoint[] = [
  { supplier: 'Bidfood', category: 'Broadline grocery', thisMonth: 21.4, lastMonth: 19.8 },
  { supplier: 'Union Hand-Roasted', category: 'Coffee', thisMonth: 14.8, lastMonth: 12.6 },
  { supplier: 'Arla Foods', category: 'Dairy', thisMonth: 11.2, lastMonth: 10.1 },
  { supplier: 'Freshview Produce', category: 'Fruit & veg', thisMonth: 9.6, lastMonth: 8.2 },
  { supplier: 'Paul Rhodes Bakery', category: 'Bakery', thisMonth: 8.1, lastMonth: 8.4 },
  { supplier: 'Meatworks London', category: 'Meat', thisMonth: 6.9, lastMonth: 6.1 },
  { supplier: 'Oatly', category: 'Alt milk', thisMonth: 4.3, lastMonth: 4.4 },
  { supplier: 'Vegware', category: 'Packaging', thisMonth: 3.7, lastMonth: 3.9 },
];

// ── 2. Biggest ingredient price rises, 90 days ───────────────────────────
// Source: supplier catalogue price history. "90 days ago" is the invoice
// price on the last GRN before 8 June 2026; "now" is the latest GRN price.
// Ranked by % rise. `monthlyImpact` is the extra £ the estate pays each
// month at current volumes (volume × (now − before)), so a small % rise on
// milk can matter more than a big % rise on a slow line.

export type PriceRisePoint = {
  ingredient: string;
  supplier: string;
  unit: string;
  before: number;
  now: number;
  /** % rise, one decimal. */
  risePct: number;
  /** Units bought per month across the estate. */
  monthlyVolume: number;
  /** Extra £ per month at current volume. */
  monthlyImpact: number;
};

function priceRise(
  ingredient: string,
  supplier: string,
  unit: string,
  before: number,
  now: number,
  monthlyVolume: number,
): PriceRisePoint {
  return {
    ingredient,
    supplier,
    unit,
    before,
    now,
    risePct: Math.round(((now - before) / before) * 1000) / 10,
    monthlyVolume,
    monthlyImpact: Math.round((now - before) * monthlyVolume),
  };
}

export const PRICE_RISES: PriceRisePoint[] = [
  priceRise('Avocado, Hass', 'Freshview Produce', 'box of 16', 18.4, 22.6, 140),
  priceRise('Free range eggs', 'Freshview Produce', 'tray of 30', 5.9, 6.95, 1900),
  priceRise('House espresso beans', 'Union Hand-Roasted', '1kg', 21.5, 24.8, 1650),
  priceRise('Whole milk', 'Arla Foods', '2L', 1.62, 1.84, 9800),
  priceRise('Chicken breast', 'Meatworks London', 'kg', 7.2, 8.05, 820),
  priceRise('Butter, unsalted', 'Arla Foods', '250g', 2.1, 2.34, 2300),
  priceRise('Oat drink, barista', 'Oatly', '1L', 1.38, 1.5, 6400),
  priceRise('Sourdough flour', 'Bidfood', '16kg', 19.8, 21.2, 210),
].sort((a, b) => b.risePct - a.risePct);

// ── 3. Recipe cost drift past target GP ───────────────────────────────────
// GP % = (net selling price − recipe cost) ÷ net selling price, where net
// price is the menu price ex VAT and recipe cost is re-priced at the
// latest supplier price for every ingredient (yield-adjusted). Each recipe
// carries a target GP set when it was costed. A recipe appears here when
// actual GP has fallen below target; `gapPp` is percentage points below
// target. Worst first. This is the chart that turns price rises (chart 2)
// into a menu decision: re-price, re-spec, or accept.

export type RecipeDriftPoint = {
  recipe: string;
  /** Menu price inc VAT, £. */
  menuPrice: number;
  /** Recipe cost at latest supplier prices, £. */
  costNow: number;
  /** Recipe cost when the target was set, £. */
  costAtTarget: number;
  targetGp: number;
  actualGp: number;
  /** Percentage points below target. */
  gapPp: number;
  /** The ingredient driving most of the drift. */
  driver: string;
};

const VAT = 1.2;

function recipeDrift(
  recipe: string,
  menuPrice: number,
  costAtTarget: number,
  costNow: number,
  targetGp: number,
  driver: string,
): RecipeDriftPoint {
  const net = menuPrice / VAT;
  const actualGp = Math.round(((net - costNow) / net) * 1000) / 10;
  return {
    recipe,
    menuPrice,
    costNow,
    costAtTarget,
    targetGp,
    actualGp,
    gapPp: Math.round((targetGp - actualGp) * 10) / 10,
    driver,
  };
}

export const RECIPE_DRIFT: RecipeDriftPoint[] = [
  recipeDrift('Avocado & poached egg on sourdough', 9.5, 2.22, 2.9, 72, 'Avocado +22.8%'),
  recipeDrift('Chicken Caesar wrap', 7.95, 1.99, 2.38, 70, 'Chicken breast +11.8%'),
  recipeDrift('Flat white, regular', 3.6, 0.6, 0.71, 80, 'Espresso beans +15.3%'),
  recipeDrift('Oat latte, regular', 3.9, 0.72, 0.82, 78, 'Oat drink +8.7%'),
  recipeDrift('Bacon roll', 5.5, 1.38, 1.5, 70, 'Smoked bacon +6.2%'),
  recipeDrift('Granola, yoghurt & berries', 6.25, 1.35, 1.47, 74, 'Berries +9.1%'),
  recipeDrift('Almond croissant', 3.75, 0.78, 0.83, 75, 'Butter +11.4%'),
  recipeDrift('Halloumi & harissa flatbread', 8.5, 2.13, 2.21, 70, 'Halloumi +4.9%'),
]
  .filter((r) => r.gapPp > 0)
  .sort((a, b) => b.gapPp - a.gapPp);

// ── 4. Waste £ by site and reason ─────────────────────────────────────────
// Source: waste log entries, valued at recipe cost (not menu price), month
// to date. Five reasons, fixed list so sites can be compared:
//   Spoilage         went off before use (fridge failure, over-ordering)
//   Over-production  made on the bench, not sold, binned at close
//   Prep error       dropped, burnt, wrong spec
//   Comps & remakes  given away or re-made after a complaint
//   End of day       unsold display items binned at close (pastries, salads)
// Sites in estate order. Stacked so the total is the bar length and the
// mix is the colour.

export const WASTE_REASONS = [
  'Spoilage',
  'Over-production',
  'Prep error',
  'Comps & remakes',
  'End of day',
] as const;

export type WasteReason = (typeof WASTE_REASONS)[number];

export type SiteWastePoint = { site: string } & Record<WasteReason, number>;

const WASTE_BY_SITE_RAW: Record<string, [number, number, number, number, number]> = {
  soho: [62, 48, 31, 24, 88],
  borough: [54, 39, 22, 18, 71],
  fitzroy: [41, 72, 19, 15, 64], // hub kitchen: over-production is the bench
  shoreditch: [88, 44, 36, 29, 93],
  'kings-cross': [47, 51, 25, 20, 79],
  canary: [39, 33, 18, 14, 112], // office site: bank holiday Monday left display unsold
  riverside: [58, 41, 27, 22, 66],
  city: [44, 37, 21, 17, 74],
  camden: [96, 58, 42, 31, 84], // fridge fault 3 Sept
  greenwich: [51, 36, 24, 19, 62],
  brixton: [43, 40, 20, 16, 58],
  richmond: [49, 35, 23, 18, 61],
};

export const WASTE_BY_SITE: SiteWastePoint[] = ALL_SITES.map((s) => {
  const [spoilage, overProduction, prepError, comps, endOfDay] = WASTE_BY_SITE_RAW[s.id];
  return {
    site: s.name,
    Spoilage: spoilage,
    'Over-production': overProduction,
    'Prep error': prepError,
    'Comps & remakes': comps,
    'End of day': endOfDay,
  };
});

export function wasteTotal(p: SiteWastePoint): number {
  return WASTE_REASONS.reduce((sum, r) => sum + p[r], 0);
}

// ── 5. Stocktake hygiene, days since last count per site ─────────────────
// Source: stocktake submissions. Policy is a full count every 7 days
// (Sunday close). Under 7 days is on policy; 8–14 is a missed week;
// over 14 means the variance and usage figures for that site (charts 7
// and the GP KPI) are running on stale counts and should not be trusted.
// "Today" is Sunday 6 Sept, so a site that counted last Sunday reads 7.

export const STOCKTAKE_POLICY_DAYS = 7;
export const STOCKTAKE_STALE_DAYS = 14;

export type StocktakeHygienePoint = {
  site: string;
  daysSince: number;
  lastCounted: string;
  countedBy: string;
};

const STOCKTAKE_RAW: Record<string, [number, string]> = {
  soho: [2, 'Priya M'],
  borough: [3, 'Tom H'],
  fitzroy: [1, 'Ana R'],
  shoreditch: [6, 'Jordan K'],
  'kings-cross': [9, 'Sam O'],
  canary: [5, 'Leah W'],
  riverside: [13, 'Marco D'],
  city: [4, 'Chloe B'],
  camden: [19, 'Dev P'],
  greenwich: [8, 'Rosa F'],
  brixton: [2, 'Kwame A'],
  richmond: [27, 'Ellie S'],
};

function daysAgoLabel(days: number): string {
  const d = new Date(2026, 8, 6); // Sun 6 Sept 2026
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export const STOCKTAKE_HYGIENE: StocktakeHygienePoint[] = ALL_SITES.map((s) => {
  const [daysSince, countedBy] = STOCKTAKE_RAW[s.id];
  return { site: s.name, daysSince, lastCounted: daysAgoLabel(daysSince), countedBy };
}).sort((a, b) => b.daysSince - a.daysSince);

// ── 6. Forecast vs actual sales by site (POS) ────────────────────────────
// Source: POS net sales (ex VAT, after discounts and refunds) per site for
// Mon 31 Aug – Sun 6 Sept, against the forecast Edify set on the Friday
// before. Mon 31 Aug was the summer bank holiday, which is why the office
// sites (Canary Wharf, City Centre) came in under and the Sunday-trade
// sites (Richmond, Greenwich) held up. Variance % = (actual − forecast) ÷
// forecast; within ±3% is noise, beyond that is a forecasting or trading
// story worth a look.

export type ForecastActualPoint = {
  site: string;
  /** £k, this week. */
  forecast: number;
  actual: number;
  variancePct: number;
};

const FORECAST_ACTUAL_RAW: Record<string, [number, number]> = {
  soho: [29.8, 31.2],
  borough: [28.9, 27.4],
  fitzroy: [32.1, 33.6],
  shoreditch: [26.4, 24.8],
  'kings-cross': [27.6, 29.1],
  canary: [25.9, 22.3],
  riverside: [25.8, 26.7],
  city: [24.3, 21.9],
  camden: [27.2, 28.4],
  greenwich: [23.1, 23.5],
  brixton: [24.0, 25.2],
  richmond: [23.5, 24.4],
};

export const FORECAST_VS_ACTUAL: ForecastActualPoint[] = ALL_SITES.map((s) => {
  const [forecast, actual] = FORECAST_ACTUAL_RAW[s.id];
  return {
    site: s.name,
    forecast,
    actual,
    variancePct: Math.round(((actual - forecast) / forecast) * 1000) / 10,
  };
});

// ── 7. Theoretical vs actual usage, top 10 items by £ gap ────────────────
// Theoretical usage = POS units sold × recipe quantity per unit, summed
// across every recipe that uses the item. Actual usage = opening stock +
// deliveries − closing stock, from the stocktakes (so it is only as good
// as chart 5 says the counts are). Gap = actual − theoretical, valued at
// the current unit cost. A positive gap is stock that left the building
// without being sold: over-portioning, unlogged waste, or theft. Month to
// date, estate total, ten biggest gaps by £.

export type UsageGapPoint = {
  item: string;
  unit: string;
  theoretical: number;
  actual: number;
  unitCost: number;
  /** £ value of (actual − theoretical). */
  gapValue: number;
  /** Gap as % of theoretical. */
  gapPct: number;
};

function usageGap(
  item: string,
  unit: string,
  theoretical: number,
  actual: number,
  unitCost: number,
): UsageGapPoint {
  const gap = actual - theoretical;
  return {
    item,
    unit,
    theoretical,
    actual,
    unitCost,
    gapValue: Math.round(gap * unitCost),
    gapPct: Math.round((gap / theoretical) * 1000) / 10,
  };
}

export const USAGE_GAPS: UsageGapPoint[] = [
  usageGap('House espresso beans', 'kg', 412, 448, 24.8),
  usageGap('Whole milk', 'L', 7120, 7690, 0.92),
  usageGap('Oat drink, barista', 'L', 3980, 4270, 1.5),
  usageGap('Avocado, Hass', 'each', 2240, 2510, 1.41),
  usageGap('Chicken breast', 'kg', 296, 338, 8.05),
  usageGap('Free range eggs', 'each', 12400, 13300, 0.23),
  usageGap('Smoked bacon', 'kg', 184, 203, 10.5),
  usageGap('Sourdough loaf', 'each', 1640, 1730, 1.9),
  usageGap('Butter, unsalted', 'kg', 212, 231, 9.36),
  usageGap('Halloumi', 'kg', 96, 108, 10.9),
].sort((a, b) => b.gapValue - a.gapValue);

// ── 8. Menu contribution, volume vs GP per item (POS) ────────────────────
// Classic menu engineering. Each dot is a menu item this week across the
// estate: x = units sold (POS), y = GP % at current recipe cost, dot size =
// GP £ contributed (units × GP per unit). The quadrant lines sit at the
// median volume and median GP % of the items shown, so the four corners
// read:
//   top right     Stars          sell well, earn well: protect and promote
//   bottom right  Plough horses  sell well, thin margin: re-price or re-spec
//   top left      Puzzles        earn well, don't sell: move on the menu
//   bottom left   Dogs           neither: drop or rework
// Twelve items shown, the ones that make up most of estate sales.

export type MenuItemPoint = {
  item: string;
  units: number;
  gpPct: number;
  /** £ GP contributed this week. */
  gpValue: number;
};

export const MENU_ITEMS: MenuItemPoint[] = [
  { item: 'Flat white', units: 9840, gpPct: 76.2, gpValue: 22400 },
  { item: 'Latte', units: 7210, gpPct: 75.8, gpValue: 16900 },
  { item: 'Americano', units: 6120, gpPct: 84.1, gpValue: 13900 },
  { item: 'Oat latte', units: 4380, gpPct: 74.9, gpValue: 10600 },
  { item: 'Bacon roll', units: 2960, gpPct: 67.4, gpValue: 9100 },
  { item: 'Almond croissant', units: 2410, gpPct: 73.6, gpValue: 5500 },
  { item: 'Avocado & egg sourdough', units: 1840, gpPct: 63.4, gpValue: 9200 },
  { item: 'Chicken Caesar wrap', units: 1520, gpPct: 64.1, gpValue: 6500 },
  { item: 'Iced matcha', units: 1120, gpPct: 70.4, gpValue: 3100 },
  { item: 'Granola, yoghurt & berries', units: 980, gpPct: 72.6, gpValue: 3700 },
  { item: 'Halloumi & harissa flatbread', units: 760, gpPct: 68.9, gpValue: 3700 },
  { item: 'Soup of the day', units: 540, gpPct: 66.2, gpValue: 1600 },
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export const MENU_MEDIAN_UNITS = median(MENU_ITEMS.map((m) => m.units));
export const MENU_MEDIAN_GP = median(MENU_ITEMS.map((m) => m.gpPct));

export type MenuQuadrant = 'Star' | 'Plough horse' | 'Puzzle' | 'Dog';

export function menuQuadrant(p: MenuItemPoint): MenuQuadrant {
  const highVolume = p.units >= MENU_MEDIAN_UNITS;
  const highGp = p.gpPct >= MENU_MEDIAN_GP;
  if (highVolume && highGp) return 'Star';
  if (highVolume) return 'Plough horse';
  if (highGp) return 'Puzzle';
  return 'Dog';
}
