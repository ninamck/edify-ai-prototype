/**
 * Farmer J versions of the three starter templates.
 *
 * Sales come from the same demand model the Farmer J Sales tab and the day
 * plans use, so the daily, weekly and period figures agree with the rest of
 * the demo: Marylebone's real till day scaled to 19 shops and back through
 * the calendar. Everything the model does not carry (GP, waste value, stock
 * cover, supplier prices) is demo-modelled and deterministic, and shaped by
 * what Farmer J actually buys: marinated chicken bags from the butcher,
 * salmon from the fish supplier, produce, chilled, dry goods.
 *
 * Farmer J has no central kitchen, so the period-end CPU tile is dropped.
 */

import { addDays, FJ_DEMO_TODAY, isShopOpen, longDate, shortDate } from '@/components/Production/farmerj/calendar';
import { dayTotals } from '@/components/Production/farmerj/dashboardData';
import { PRODUCT_BY_ID } from '@/components/Production/farmerj/recipes';
import { daySales } from '@/components/Production/farmerj/sales';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS, getShop, type Shop } from '@/components/Production/farmerj/shops';
import type {
  BridgeDrillItem,
  CogsVarianceRow,
  DailyData,
  DailyException,
  DailySparkPoint,
  DailyWasteItem,
  DeadStockRow,
  MenuItemPoint,
  PeriodData,
  PriceMoverRow,
  StockHoldingRow,
  SupplierInflationRow,
  WeeklyData,
  WeeklySiteRow,
} from './templateData';

// ─── Calendar ────────────────────────────────────────────────────────────────

/** Demo today is Wednesday 16 Sep 2026, so yesterday is a Tuesday. */
const YESTERDAY = addDays(FJ_DEMO_TODAY, -1);
/** Last complete trading week: Monday 7 to Sunday 13 September. */
const WEEK_START = addDays(FJ_DEMO_TODAY, -9);
/** Four-week period P6 closed on that Sunday: 17 August to 13 September. */
const PERIOD_START = addDays(WEEK_START, -21);
const PERIOD_DAYS = 28;

const SHOP_COUNT = FJ_SHOPS.length;
const ALL_SHOPS_LABEL = `All ${SHOP_COUNT} shops`;

/** The shop the estate is still onboarding: no count this week, stock estimated. */
const MISSING_COUNT_SHOP = 'Hammersmith';

/** Food cost as a share of net sales across the estate. */
const COGS_SHARE = 0.294;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function shopsFor(scope: string): Shop[] {
  if (scope === FJ_ALL_SHOPS_ID) return FJ_SHOPS;
  const shop = getShop(scope);
  return shop ? [shop] : FJ_SHOPS;
}

function scopeName(scope: string): string {
  return scope === FJ_ALL_SHOPS_ID ? ALL_SHOPS_LABEL : getShop(scope)?.name ?? ALL_SHOPS_LABEL;
}

/** Net sales for a shop over a run of days; closed days contribute nothing. */
function rangeNet(shopId: string, from: string, days: number): number {
  let n = 0;
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (isShopOpen(shopId, date)) n += daySales(shopId, date).net;
  }
  return n;
}

function pounds(n: number): string {
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}

function poundsK(n: number): string {
  return n >= 1000 ? `£${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : pounds(n);
}

// ─── Daily · the active shop (or every shop), yesterday ──────────────────────

const dailyCache = new Map<string, DailyData>();

export function farmerJDaily(scope: string): DailyData {
  const cached = dailyCache.get(scope);
  if (cached) return cached;

  const shops = shopsFor(scope);
  const ids = shops.map((s) => s.id);
  const site = scopeName(scope);

  const sales14d: DailySparkPoint[] = [];
  for (let n = 13; n >= 0; n--) {
    const date = addDays(YESTERDAY, -n);
    const t = dayTotals(scope, date);
    sales14d.push({ d: shortDate(date), sales: Math.round(t.net), forecast: Math.round(t.avgNet) });
  }

  const y = dayTotals(scope, YESTERDAY);
  const lastWeek = ids.reduce((s, id) => s + (isShopOpen(id, addDays(YESTERDAY, -7)) ? daySales(id, addDays(YESTERDAY, -7)).net : 0), 0);
  const yesterday = { sales: Math.round(y.net), forecast: Math.round(y.avgNet), sameDayLastWeek: Math.round(lastWeek) };

  const theoGp = {
    pct: round1(70.4 + seeded(`${scope}|gp`) * 1.2),
    vsLastWeekPp: round1(-0.6 + seeded(`${scope}|gp-lw`) * 0.9),
    posMappedPct: 97,
  };

  // Waste is a handful of lines at close: chicken left in the cast irons,
  // dressed salad past its hold time. Scaled by the scope's size against a
  // single lunch shop.
  const scale = Math.max(1, y.net / 6000);
  const line = (
    product: string,
    unitsYesterday: number,
    unitsTypical: number,
    spendYesterday: number,
    spendTypical: number,
    flag?: string,
  ): DailyWasteItem => ({
    product,
    unitsYesterday: Math.max(1, Math.round(unitsYesterday * scale)),
    unitsTypical: Math.max(1, Math.round(unitsTypical * scale)),
    spendYesterday: Math.round(spendYesterday * scale),
    spendTypical: Math.round(spendTypical * scale),
    flag,
  });
  const wasteItems: DailyWasteItem[] = [
    line('Harissa chicken (close)', 6, 4, 14, 9, 'Drop the last afternoon bag to a half'),
    line('Amba chicken (close)', 4, 4, 9, 9),
    line('Spring feta Caesar', 5, 3, 6, 4, 'Dress a half batch after 2pm'),
    line('Ponzu sesame broccoli', 3, 3, 4, 4),
    line('Mac & cheese', 3, 2, 5, 3),
    line('Farmers rice', 2, 2, 5, 5),
  ];
  const loggedValue = wasteItems.reduce((s, r) => s + r.spendYesterday, 0);
  const waste = {
    loggedValue,
    pctOfSales: round1((loggedValue / Math.max(1, y.net)) * 100),
    targetPct: 1.5,
  };

  const n = shops.length;
  const many = n > 1;
  const exceptions: DailyException[] = [
    {
      label: 'Unmatched invoices',
      count: many ? Math.round(n * 0.37) : 1,
      detail: many ? 'Butcher ×4, Fresh produce ×2, Fish ×1' : 'Butcher ×1, Monday chicken bags',
      href: '/invoices',
    },
    {
      label: 'Un-receipted GRNs',
      count: many ? 3 : 1,
      detail: many ? 'Monday Chilled deliveries not booked in at three shops' : 'Monday Chilled delivery not booked in',
      href: '/receive',
    },
    {
      label: 'Items below par',
      count: many ? Math.round(n * 0.8) : 3,
      detail: 'Amba bags, feta, 12oz lids…',
      href: '/stock',
    },
    {
      label: 'POs due today',
      count: many ? n * 2 : 2,
      detail: many ? 'Fresh produce 6am · Butcher 7am, every shop' : 'Fresh produce 6am · Butcher 7am',
      href: '/purchase-orders',
    },
  ];

  const harissaPortions = ids.reduce((s, id) => s + (isShopOpen(id, YESTERDAY) ? daySales(id, YESTERDAY).products['harissa']?.portions ?? 0 : 0), 0);
  // The same rise the weekly flash lists, so the two views quote one figure.
  const chickenWeekly = farmerJWeekly().priceMovers.filter((m) => m.supplier === 'Butcher').reduce((s, m) => s + m.weeklyImpact, 0);
  const chickenBagsPerWeek = Math.round(chickenWeekly / 0.8);
  const anomalies = [
    {
      kind: 'price' as const,
      headline: 'Marinated chicken bags up 4.7% on Monday\u2019s Butcher invoice',
      detail: `£17.00 → £17.80 a 2 kg bag, amba and harissa alike. Second rise since June; at ${chickenBagsPerWeek.toLocaleString('en-GB')} bags a week that is ~${poundsK(chickenWeekly * 52)} annualised across ${SHOP_COUNT} shops.`,
    },
    {
      kind: 'usage' as const,
      headline: 'Harissa chicken usage 14% above what trays imply',
      detail: `The till sold ${Math.round(harissaPortions).toLocaleString('en-GB')} harissa portions yesterday; cast irons plated suggest ~${Math.round(harissaPortions * 1.14).toLocaleString('en-GB')}. Check the portion spoon or un-logged close waste.`,
    },
    {
      kind: 'price' as const,
      headline: 'Gotcha salmon back at contract price',
      detail: 'Last week\u2019s +5% on the Fish invoice has reverted; the credit lands on Friday\u2019s statement.',
    },
  ];

  const data: DailyData = {
    site,
    dateLabel: longDate(YESTERDAY).replace(' September', ' Sep'),
    sales14d,
    yesterday,
    theoGp,
    waste,
    wasteItems,
    exceptions,
    anomalies,
  };
  dailyCache.set(scope, data);
  return data;
}

// ─── Weekly · every shop, last complete week ─────────────────────────────────

type EstateWeek = { rows: WeeklySiteRow[]; total: number };

let weeklyCache: EstateWeek | null = null;

function estateWeekly(): EstateWeek {
  if (weeklyCache) return weeklyCache;
  const rows: WeeklySiteRow[] = FJ_SHOPS.map((shop) => {
    const sales = rangeNet(shop.id, WEEK_START, 7);
    const lastWeek = rangeNet(shop.id, addDays(WEEK_START, -7), 7);
    let trailing = 0;
    for (let w = 1; w <= 4; w++) trailing += rangeNet(shop.id, addDays(WEEK_START, -7 * w), 7);
    const forecast = trailing / 4;
    const r = (k: string) => seeded(`${shop.id}|${k}`);
    const theoGpPct = round1(69.2 + r('gp') * 2.8);
    const stocktakeDone = shop.name !== MISSING_COUNT_SHOP;
    const actualGpPct = stocktakeDone ? round1(theoGpPct - (1.0 + r('gap') * 1.6)) : null;
    let wastePctOfSales = round1(0.9 + r('waste') * 1.4);
    let spendVsTrailing4wkPct = round1(-2 + r('drift') * 5);
    // Two shops are drifting: the Canary Wharf flagship on spend, Russell
    // Square (the highest delivery share) on waste and spend both.
    if (shop.name === 'Canada Place') spendVsTrailing4wkPct = 6.4;
    if (shop.name === 'Russell Square') { spendVsTrailing4wkPct = 5.6; wastePctOfSales = 2.7; }
    if (shop.name === MISSING_COUNT_SHOP) wastePctOfSales = 2.4;
    const spendPctOfSales = round1(28.4 + r('spend') * 3.2 + wastePctOfSales * 0.5);
    return {
      site: shop.name,
      sales: Math.round(sales),
      vsLwPct: round1((sales / lastWeek - 1) * 100),
      vsForecastPct: round1((sales / forecast - 1) * 100),
      theoGpPct,
      stocktakeDone,
      actualGpPct,
      wastePctOfSales,
      spendPctOfSales,
      spendVsTrailing4wkPct,
    };
  }).sort((a, b) => b.sales - a.sales);
  weeklyCache = { rows, total: rows.reduce((s, r) => s + r.sales, 0) };
  return weeklyCache;
}

/** Price movers scale with the estate: impact per £100k of weekly sales. */
const PRICE_MOVER_RATES: Array<Omit<PriceMoverRow, 'weeklyImpact'> & { perHundredK: number }> = [
  { item: 'Amba chicken, marinated 2 kg', supplier: 'Butcher', oldPrice: '£17.00', newPrice: '£17.80', changePct: 4.7, perHundredK: 160 },
  { item: 'Harissa chicken, marinated 2 kg', supplier: 'Butcher', oldPrice: '£17.00', newPrice: '£17.80', changePct: 4.7, perHundredK: 154 },
  { item: 'Gotcha salmon, marinated 2 kg', supplier: 'Fish', oldPrice: '£32.00', newPrice: '£33.60', changePct: 5.0, perHundredK: 58 },
  { item: 'Avocado, box of 20', supplier: 'Fresh produce', oldPrice: '£22.00', newPrice: '£24.20', changePct: 10.0, perHundredK: 35 },
  { item: 'Short brown rice 5 kg', supplier: 'Dry goods', oldPrice: '£11.00', newPrice: '£10.45', changePct: -5.0, perHundredK: -27 },
];

let weeklyDataCache: WeeklyData | null = null;

export function farmerJWeekly(): WeeklyData {
  if (weeklyDataCache) return weeklyDataCache;
  const { rows, total } = estateWeekly();
  const priceMovers: PriceMoverRow[] = PRICE_MOVER_RATES.map(({ perHundredK, ...m }) => ({
    ...m,
    weeklyImpact: Math.round((perHundredK * total) / 100_000),
  }));
  const creep = priceMovers.reduce((s, m) => s + m.weeklyImpact, 0);
  const chickenAnnual = (priceMovers[0].weeklyImpact + priceMovers[1].weeklyImpact) * 52;

  const openDays = FJ_SHOPS.reduce((s, shop) => s + (shop.weekend ? 7 : 5), 0);
  const drifting = rows.filter((r) => r.spendVsTrailing4wkPct > 5).map((r) => r.site);

  weeklyDataCache = {
    weekLabel: `W/C ${shortDate(WEEK_START).slice(4)}`,
    scopeLabel: ALL_SHOPS_LABEL,
    siteNoun: 'Shop',
    sites: rows,
    compliance: {
      invoicesMatchedPct: 93,
      offCataloguePos: 4,
      stocktakesDone: SHOP_COUNT - 1,
      stocktakesDue: SHOP_COUNT,
      wasteLoggingDays: openDays - 6,
      wasteLoggingDaysDue: openDays,
    },
    priceMovers,
    copy: {
      leagueFooter: `vs LW reads against W/C ${shortDate(addDays(WEEK_START, -7)).slice(4)}, which had the bank holiday Monday in it: that is why the Monday-to-Friday City shops show +10% or more. ${MISSING_COUNT_SHOP} didn't count this week, so no actual-GP claim is made for it. The flag stays until the count is done.`,
      driftFooter: `${drifting.join(' and ')} are both >5% above their own baseline. That's the drift signal, before any budget exists.`,
      priceMoversFooter: `Net ${pounds(creep)}/week of price creep across the five. The chicken bag rise alone is ~${poundsK(chickenAnnual)} annualised across ${SHOP_COUNT} shops: one supplier conversation.`,
      stocktakeDetail: `${MISSING_COUNT_SHOP} outstanding, so its actual GP is blank above`,
    },
  };
  return weeklyDataCache;
}

// ─── Period end · every shop, P6 ─────────────────────────────────────────────

/** Theoretical margin per menu item. Bases ride on the tray at £0, so they are not plotted. */
const ITEM_MARGINS: Record<string, number> = {
  harissa: 72, amba: 71, salmon: 63, steak: 64, tofu: 77,
  'mac-cheese': 64, broccoli: 74, cauliflower: 76, 'sweet-potato': 78, 'parmesan-potatoes': 70,
  'kale-slaw': 69, 'chickpea-pickles': 75, 'iow-tomato': 62, 'feta-caesar': 66,
  'pot-shak': 73, 'pot-green-eggs': 71, 'toast-avo': 61, 'bacon-egg-roll': 67, porridge: 83, 'overnight-oats': 78, 'coconut-chia': 69,
};

let periodCache: PeriodData | null = null;

export function farmerJPeriod(): PeriodData {
  if (periodCache) return periodCache;

  // Sales and portions for the period, shop by shop.
  const shopSales = new Map<string, number>();
  const portions = new Map<string, number>();
  let sales = 0;
  for (const shop of FJ_SHOPS) {
    let n = 0;
    for (let i = 0; i < PERIOD_DAYS; i++) {
      const date = addDays(PERIOD_START, i);
      if (!isShopOpen(shop.id, date)) continue;
      const d = daySales(shop.id, date);
      n += d.net;
      for (const p of Object.values(d.products)) portions.set(p.productId, (portions.get(p.productId) ?? 0) + p.portions);
    }
    shopSales.set(shop.id, n);
    sales += n;
  }
  const salesK = sales / 1000;

  // The bridge, in £k. theoretical − waste − unexplained = actual.
  const theoreticalGp = round1(salesK * 0.706);
  const waste = round1(salesK * 0.013);
  const unexplained = round1(salesK * 0.017);
  const actualGp = round1(theoreticalGp - waste - unexplained);
  const gpBridge = { theoreticalGp, waste, unexplained, actualGp, sales: round1(salesK) };

  // Supplier price effects sum to the bridge's price-variance step.
  const supplierInflation: SupplierInflationRow[] = [
    { supplier: 'Butcher', spendK: round1(salesK * COGS_SHARE * 0.33), priceEffectK: round1(salesK * 0.0042), volumeMixK: round1(salesK * 0.0019) },
    { supplier: 'Fresh produce', spendK: round1(salesK * COGS_SHARE * 0.21), priceEffectK: round1(salesK * 0.0018), volumeMixK: round1(salesK * 0.0004) },
    { supplier: 'Fish', spendK: round1(salesK * COGS_SHARE * 0.09), priceEffectK: round1(salesK * 0.0014), volumeMixK: round1(salesK * -0.0003) },
    { supplier: 'Chilled', spendK: round1(salesK * COGS_SHARE * 0.13), priceEffectK: round1(salesK * 0.0008), volumeMixK: round1(salesK * 0.0006) },
    { supplier: 'Dry goods', spendK: round1(salesK * COGS_SHARE * 0.14), priceEffectK: round1(salesK * -0.0006), volumeMixK: round1(salesK * 0.0009) },
    { supplier: 'Packaging Environmental', spendK: round1(salesK * COGS_SHARE * 0.06), priceEffectK: round1(salesK * 0.0004), volumeMixK: round1(salesK * 0.0011) },
    { supplier: 'Med Cuisine', spendK: round1(salesK * COGS_SHARE * 0.04), priceEffectK: round1(salesK * 0.0003), volumeMixK: round1(salesK * 0.0001) },
  ];
  const priceVarianceK = round1(supplierInflation.reduce((s, r) => s + r.priceEffectK, 0));
  const unexplainedLive = round1(unexplained - priceVarianceK);

  const share = (total: number, pct: number) => round1(total * pct);
  const bridgeDrill: PeriodData['bridgeDrill'] = {
    theoretical: [
      { item: 'Proteins', value: share(theoreticalGp, 0.41), note: '41% of theoretical GP · harissa and amba chicken carry it · recipe margin 72%' },
      { item: 'Hot sides', value: share(theoreticalGp, 0.17), note: 'recipe margin 73%' },
      { item: 'Bases', value: share(theoreticalGp, 0.14), note: 'rice, grains, greens · recipe margin 81%' },
      { item: 'Salads', value: share(theoreticalGp, 0.13), note: 'recipe margin 68%' },
      { item: 'Breakfast', value: share(theoreticalGp, 0.09), note: `${FJ_SHOPS.filter((s) => s.breakfast).length} breakfast shops · recipe margin 70%` },
      { item: 'Drinks and extras', value: share(theoreticalGp, 0.06), note: 'cookies, cold drinks, toppings' },
    ],
    waste: [
      { item: 'Proteins', value: share(waste, 0.34), note: 'chicken left in the cast irons at close · logged daily' },
      { item: 'Salads', value: share(waste, 0.26), note: 'dressed salads past their hold time' },
      { item: 'Hot sides', value: share(waste, 0.18), note: 'mac & cheese and broccoli at close' },
      { item: 'Bases', value: share(waste, 0.12), note: 'rice cooked for a lunch that did not come' },
      { item: 'Breakfast', value: share(waste, 0.1), note: 'pots and poached eggs, breakfast shops only' },
    ],
    unexplained: [
      { item: 'Harissa chicken', value: share(unexplained, 0.26), note: 'usage 14% above tray-implied across the period' },
      { item: 'Amba chicken', value: share(unexplained, 0.22), note: 'yield on cooking not captured · investigate' },
      { item: 'Gotcha salmon', value: share(unexplained, 0.12), note: 'part price movement, part portioning' },
      { item: 'Feta', value: share(unexplained, 0.08), note: 'Caesar portions running heavy' },
      { item: 'Avocado', value: share(unexplained, 0.07), note: 'spot-market price plus ripeness waste not logged' },
      { item: 'All other items', value: share(unexplained, 0.25), note: 'no single item over £2k' },
    ],
    actual: [
      { item: 'Opening stock', value: round1(salesK * COGS_SHARE * (4.8 / PERIOD_DAYS)), note: 'P5 closing counts' },
      { item: 'Purchases', value: round1(salesK * COGS_SHARE * (1 + 0.15 / PERIOD_DAYS)), note: '93% matched to invoices' },
      { item: 'Closing stock', value: round1(salesK * COGS_SHARE * (4.95 / PERIOD_DAYS)), note: `${SHOP_COUNT - 1} of ${SHOP_COUNT} shops counted · ${MISSING_COUNT_SHOP} estimated` },
    ],
  };
  const bridgeDrillPrice: BridgeDrillItem[] = [
    { item: 'Butcher', value: supplierInflation[0].priceEffectK, note: 'marinated chicken bags +4.7% from week 2 · both lines' },
    { item: 'Fresh produce', value: supplierInflation[1].priceEffectK, note: 'avocado spot-market movement · tomatoes end of season' },
    { item: 'Fish', value: supplierInflation[2].priceEffectK, note: 'salmon +5% weeks 3 and 4, since reverted · credit lands in P7' },
    { item: 'Chilled', value: supplierInflation[3].priceEffectK, note: 'feta contract reprice' },
    { item: 'Dry goods', value: supplierInflation[4].priceEffectK, note: 'rice volume-tier discount kicked in' },
  ];
  const bridgeDrillUnexplainedLive: BridgeDrillItem[] = [
    { item: 'Harissa chicken', value: share(unexplainedLive, 0.32), note: 'usage 14% above tray-implied · portioning or un-logged close waste' },
    { item: 'Amba chicken', value: share(unexplainedLive, 0.27), note: 'yield on cooking not captured · investigate' },
    { item: 'Salad counts', value: share(unexplainedLive, 0.14), note: 'close counts drift against deliveries at three shops' },
    { item: 'Feta', value: share(unexplainedLive, 0.09), note: 'portioning only · the price element now sits in price variance' },
    { item: 'All other items', value: share(unexplainedLive, 0.18), note: 'no single item over £1k' },
  ];

  // COGS variance, shop × category, in £k for the period.
  const cogsRow = (name: string, category: string, categoryShare: number, variancePct: number): CogsVarianceRow => {
    const shop = FJ_SHOPS.find((s) => s.name === name)!;
    const theoreticalK = round1(((shopSales.get(shop.id) ?? 0) / 1000) * COGS_SHARE * categoryShare);
    return { site: name, category, theoreticalK, actualK: round1(theoreticalK * (1 + variancePct / 100)) };
  };
  const cogsVariance: CogsVarianceRow[] = [
    cogsRow('Canada Place', 'Proteins', 0.45, 6.2),
    cogsRow('Russell Square', 'Fresh produce', 0.21, 9.1),
    cogsRow(MISSING_COUNT_SHOP, 'Proteins', 0.45, 5.0),
    cogsRow('Leadenhall Street', 'Chilled', 0.13, 4.2),
    cogsRow('Piccadilly', 'Proteins', 0.45, 2.4),
    cogsRow('Marylebone', 'Fresh produce', 0.21, 1.6),
    cogsRow('Paddington', 'Dry goods', 0.14, -1.4),
  ];

  const dataConfidence = {
    stocktakesDone: SHOP_COUNT - 1,
    stocktakesDue: SHOP_COUNT,
    stocktakeMissingSite: MISSING_COUNT_SHOP,
    posMappedPct: 97,
    invoicesMatchedPct: 93,
    stocktakeAdjustmentPctOfCogs: 0.7,
  };

  // Menu profitability: portions from the model, margins from the recipe book.
  // Breakfast only trades in the breakfast shops, so its volumes are ranked
  // against each other, not against an all-day protein.
  const plotted = Object.entries(ITEM_MARGINS)
    .map(([id, marginPct]) => ({
      id,
      item: PRODUCT_BY_ID[id]?.name ?? id,
      breakfast: PRODUCT_BY_ID[id]?.group === 'breakfast',
      marginPct,
      units: Math.round(portions.get(id) ?? 0),
    }))
    .filter((m) => m.units > 0)
    .sort((a, b) => b.units - a.units);
  const rankWithin = (breakfast: boolean) => plotted.filter((m) => m.breakfast === breakfast);
  const menuProfitability: MenuItemPoint[] = plotted.map((m) => {
    const family = rankWithin(m.breakfast);
    const rank = family.indexOf(m);
    const third = Math.ceil(family.length / 3);
    let flag: MenuItemPoint['flag'];
    if (m.marginPct >= 70 && rank < third) flag = 'star';
    if (m.marginPct < 63 && rank >= family.length - third) flag = 'delist';
    return { item: m.item, marginPct: m.marginPct, units: m.units, flag };
  });

  // Stock holding: fresh food, so cover is days not weeks. One shop is sitting on dry goods.
  const stockHolding: StockHoldingRow[] = FJ_SHOPS.map((shop) => {
    const cogsPerDay = ((shopSales.get(shop.id) ?? 0) * COGS_SHARE) / PERIOD_DAYS;
    let daysCover = round1(4.2 + seeded(`${shop.id}|cover`) * 2.4);
    if (shop.name === 'Russell Square') daysCover = 10.6;
    return { site: shop.name, valueK: round1((cogsPerDay * daysCover) / 1000), daysCover };
  }).sort((a, b) => b.valueK - a.valueK);

  const deadStock: DeadStockRow[] = [
    { item: 'Breakfast pots ×400', site: "St Paul's", value: 52, lastUsed: 'P3 (breakfast trial)' },
    { item: 'Cashew butter 1 kg ×4', site: 'Piccadilly', value: 60, lastUsed: 'P5' },
    { item: 'Harissa with rose petals 5 kg', site: 'Russell Square', value: 45, lastUsed: 'P5' },
    { item: 'Amba spice 500 g ×3', site: 'Holborn', value: 36, lastUsed: 'P4' },
    { item: 'Coconut milk tins ×24', site: MISSING_COUNT_SHOP, value: 34, lastUsed: 'P5 (chia trial)' },
  ];
  const deadStockTotal = deadStock.reduce((s, r) => s + r.value, 0);

  const actualGpPct = (actualGp / salesK) * 100;
  const periodTrend = [
    { period: 'P3', gpPct: round1(actualGpPct - 0.9), wastePct: 1.6, unexplainedPct: 2.3 },
    { period: 'P4', gpPct: round1(actualGpPct - 0.6), wastePct: 1.5, unexplainedPct: 2.1 },
    { period: 'P5', gpPct: round1(actualGpPct - 0.3), wastePct: 1.4, unexplainedPct: 1.9 },
    { period: 'P6', gpPct: round1(actualGpPct), wastePct: 1.3, unexplainedPct: 1.7 },
  ];
  const trendDrop = round1(periodTrend[0].unexplainedPct - periodTrend[3].unexplainedPct);

  const periodEnd = addDays(PERIOD_START, PERIOD_DAYS - 1);
  periodCache = {
    periodLabel: `P6 · ${shortDate(PERIOD_START).slice(4)} to ${shortDate(periodEnd).slice(4)}`,
    scopeTitle: ALL_SHOPS_LABEL,
    scopeLabel: ALL_SHOPS_LABEL,
    siteNoun: 'Shop',
    gpBridge,
    bridgeDrill,
    bridgeDrillPrice,
    bridgeDrillUnexplainedLive,
    priceVarianceK,
    cogsVariance,
    dataConfidence,
    menuProfitability,
    unitNoun: 'Portions',
    stockHolding,
    deadStock,
    cpuTransfers: null,
    supplierInflation,
    periodTrend,
    copy: {
      deadStockFooter: `£${deadStockTotal} at risk. Trial stock dominates: move the St Paul's breakfast pots to a breakfast shop before they are written off.`,
      supplierFooter: 'Butcher carries half of it through the marinated chicken bags; the Dry goods rice reprice is the only deflation.',
      cpuFooter: '',
      trendNote: `down ${trendDrop.toFixed(1)}pp in three periods`,
    },
  };
  return periodCache;
}
