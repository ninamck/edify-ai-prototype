import { isMultiCurrencyDemo } from '@/lib/demoConfig';
import { addDays, isoDate, parseIsoDate } from './format';
import type {
  BasketFixtures, BasketLine, BasketOrder, CatalogueProduct, DemandChange, ForecastTile, SupplierSummary,
} from './types';

export const SITE_NAME = 'Fitzroy Espresso';
export const APPROVAL_LIMIT = 200;

/** Typical use by weekday, Sunday first. Fridays and Saturdays run busiest. */
const WEEKDAY_SHAPE = [1.1, 0.8, 0.85, 0.9, 1, 1.3, 1.5];

const QUARTER_HOUR = 15 * 60 * 1000;

function clockFrom(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** A cut-off clock time relative to now, so the demo always has one urgent and one passed. */
function relativeClock(now: Date, offsetMs: number, round: 'up' | 'down'): string {
  const shifted = now.getTime() + offsetMs;
  const rounded = round === 'up'
    ? Math.ceil(shifted / QUARTER_HOUR) * QUARTER_HOUR
    : Math.floor(shifted / QUARTER_HOUR) * QUARTER_HOUR;
  const date = new Date(rounded);
  if (isoDate(date) !== isoDate(now)) return round === 'up' ? '23:45' : '00:15';
  return clockFrom(date);
}

export function cutOffFor(supplier: SupplierSummary, deliveryDate: string): Date {
  const [hours, minutes] = supplier.cutOffTime.split(':').map(Number);
  const date = parseIsoDate(addDays(deliveryDate, -supplier.leadTimeDays));
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function deliversOn(supplier: SupplierSummary, date: string): boolean {
  const weekday = parseIsoDate(date).getDay();
  return supplier.deliveryDays.includes(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday]);
}

/** The supplier's next delivery dates from today, with their cut-offs. */
export function deliveryOptions(supplier: SupplierSummary, today: string, count = 6) {
  const options: { date: string; cutOffAt: Date }[] = [];
  for (let offset = 0; options.length < count && offset < 28; offset += 1) {
    const date = addDays(today, offset);
    if (offset < supplier.leadTimeDays || !deliversOn(supplier, date)) continue;
    options.push({ date, cutOffAt: cutOffFor(supplier, date) });
  }
  return options;
}

/** First choice is the earliest delivery; if its cut-off has passed, move to the next. */
function pickDelivery(supplier: SupplierSummary, today: string, now: Date) {
  const options = deliveryOptions(supplier, today, 8);
  const first = options[0];
  const open = options.find((option) => option.cutOffAt.getTime() > now.getTime()) ?? first;
  return {
    deliveryDate: open.date,
    cutOffAt: open.cutOffAt,
    movedFrom: open.date !== first.date ? first.date : undefined,
  };
}

function expectedUse(today: string, through: string, daily: number, demand: DemandChange | null) {
  const days = [];
  for (let date = today; date <= through; date = addDays(date, 1)) {
    const usual = daily * WEEKDAY_SHAPE[parseIsoDate(date).getDay()];
    const quantity = demand && demand.date === date ? usual * (demand.percent / 100) : usual;
    days.push({ date, quantity: Math.round(quantity * 100) / 100, usual: Math.round(usual * 100) / 100 });
  }
  return days;
}

function lastFour(today: string, quantities: number[]) {
  return quantities.map((quantity, index) => ({ date: addDays(today, -7 * (quantities.length - index)), quantity }));
}

type LineSpec = Omit<BasketLine, 'id' | 'forecast' | 'lastOrders' | 'incoming' | 'overdue' | 'stockAsOf' | 'stockSource' | 'stockWeak'> & {
  daily: number;
  last: number[];
  incoming?: { inDays: number; quantity: number; orderedDaysAgo: number }[];
  overdue?: { daysAgo: number; quantity: number; orderedDaysAgo: number }[];
  stockWeak?: boolean;
  stockSource?: 'live' | 'stocktake';
  stockDaysOld?: number;
  startQuantity?: number;
};

export type FixtureLine = BasketLine & { startQuantity: number };

function buildLine(spec: LineSpec, ctx: { today: string; now: Date; coverEnd: string; demand: DemandChange | null }): FixtureLine {
  const { daily, last, incoming = [], overdue = [], stockDaysOld = 0, startQuantity, ...rest } = spec;
  const stockAsOf = new Date(ctx.now);
  if (stockDaysOld > 0) stockAsOf.setDate(stockAsOf.getDate() - stockDaysOld);
  else stockAsOf.setMinutes(stockAsOf.getMinutes() - 12);
  return {
    ...rest,
    id: `line-${spec.productId}`,
    stockWeak: spec.stockWeak ?? false,
    stockSource: spec.stockSource ?? 'live',
    stockAsOf: stockAsOf.toISOString(),
    forecast: expectedUse(ctx.today, ctx.coverEnd, daily, ctx.demand),
    lastOrders: lastFour(ctx.today, last),
    incoming: incoming.map((d) => ({ date: addDays(ctx.today, d.inDays), quantity: d.quantity, orderedOn: addDays(ctx.today, -d.orderedDaysAgo) })),
    overdue: overdue.map((d) => ({ date: addDays(ctx.today, -d.daysAgo), quantity: d.quantity, orderedOn: addDays(ctx.today, -d.orderedDaysAgo) })),
    startQuantity: startQuantity ?? spec.suggested,
  };
}

const ALL_DAYS_BUT_SUNDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function suppliersFor(now: Date): SupplierSummary[] {
  const suppliers: SupplierSummary[] = [
    {
      id: 'sup-cheese', name: 'The Cheese Board', currency: 'GBP', minimum: 120,
      categories: ['Cheese', 'Dairy'], deliveryDays: ALL_DAYS_BUT_SUNDAY,
      cutOffTime: relativeClock(now, 2 * 60 * 60 * 1000, 'up'), leadTimeDays: 2,
    },
    {
      id: 'sup-bidvest', name: 'Bidvest', currency: 'GBP', minimum: 220,
      categories: ['Dry goods', 'Chilled', 'Frozen'], deliveryDays: ALL_DAYS_BUT_SUNDAY,
      cutOffTime: '23:00', leadTimeDays: 1,
    },
    {
      id: 'sup-cpu', name: 'CPU Central Kitchen', currency: 'GBP', minimum: 0,
      categories: ['Bakery', 'Dairy', 'Prep'], deliveryDays: ALL_DAYS_BUT_SUNDAY,
      cutOffTime: relativeClock(now, -60 * 60 * 1000, 'down'), leadTimeDays: 1,
    },
    {
      id: 'sup-freshearth', name: 'Fresh Earth Produce', currency: 'GBP', minimum: 60,
      categories: ['Fruit and veg', 'Herbs'], deliveryDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      cutOffTime: '18:00', leadTimeDays: 1,
    },
    {
      id: 'sup-risebakery', name: 'Rise Bakery', currency: 'GBP', minimum: 0,
      categories: ['Pastries', 'Bread'], deliveryDays: ['Sun', ...ALL_DAYS_BUT_SUNDAY],
      cutOffTime: '20:00', leadTimeDays: 1,
    },
  ];
  if (isMultiCurrencyDemo) {
    suppliers.push({
      id: 'sup-secondcup-central', name: 'Second Cup Central Supply (Canada)', currency: 'CAD', minimum: 250,
      categories: ['Coffee', 'Syrups', 'Packaging'], deliveryDays: ['Mon'],
      cutOffTime: '17:00', leadTimeDays: 10,
    });
  }
  return suppliers;
}

const CATALOGUE: CatalogueProduct[] = [
  { productId: 'chicken', supplierId: 'sup-bidvest', name: 'Chicken Breast', orderUnit: 'bag', orderUnitPlural: 'bags', packSize: 5, stockUnit: 'kg', unitPrice: 38.5 },
  { productId: 'evoo', supplierId: 'sup-bidvest', name: 'Extra Virgin Olive Oil', orderUnit: 'bottle', orderUnitPlural: 'bottles', packSize: 5, stockUnit: 'l', unitPrice: 34.8 },
  { productId: 'tomato-paste', supplierId: 'sup-bidvest', name: 'Tomato Paste', orderUnit: 'case', orderUnitPlural: 'cases', packSize: 12, stockUnit: 'tins', unitPrice: 14.4 },
  { productId: 'doughnuts', supplierId: 'sup-bidvest', name: 'Doughnuts', orderUnit: 'box', orderUnitPlural: 'boxes', packSize: 12, stockUnit: 'units', unitPrice: 16.8 },
  { productId: 'oat-milk', supplierId: 'sup-bidvest', name: 'Oat Milk', orderUnit: 'case', orderUnitPlural: 'cases', packSize: 6, stockUnit: 'l', unitPrice: 13.2 },
  { productId: 'coconut-milk', supplierId: 'sup-bidvest', name: 'Coconut Milk', orderUnit: 'case', orderUnitPlural: 'cases', packSize: 12, stockUnit: 'tins', unitPrice: 15.6 },
  { productId: 'smoked-salmon', supplierId: 'sup-bidvest', name: 'Smoked Salmon', orderUnit: 'pack', orderUnitPlural: 'packs', packSize: 1, stockUnit: 'kg', unitPrice: 24.9 },
  { productId: 'bread-flour', supplierId: 'sup-cpu', name: 'Bread Flour', orderUnit: 'bag', orderUnitPlural: 'bags', packSize: 12.5, stockUnit: 'kg', unitPrice: 14.6 },
  { productId: 'butter', supplierId: 'sup-cpu', name: 'Butter', orderUnit: 'case', orderUnitPlural: 'cases', packSize: 5, stockUnit: 'kg', unitPrice: 42.5 },
  { productId: 'vanilla', supplierId: 'sup-cpu', name: 'Vanilla Extract', orderUnit: 'bottle', orderUnitPlural: 'bottles', packSize: 1, stockUnit: 'bottles', unitPrice: 11.2 },
  { productId: 'gruyere', supplierId: 'sup-cheese', name: 'Gruyère', orderUnit: 'piece', orderUnitPlural: 'pieces', packSize: 0.5, stockUnit: 'kg', unitPrice: 9.8 },
  { productId: 'cream', supplierId: 'sup-cheese', name: 'Whipping Cream', orderUnit: 'case', orderUnitPlural: 'cases', packSize: 6, stockUnit: 'l', unitPrice: 16.2 },
  { productId: 'cheddar', supplierId: 'sup-cheese', name: 'Mature Cheddar', orderUnit: 'block', orderUnitPlural: 'blocks', packSize: 2.5, stockUnit: 'kg', unitPrice: 27.5 },
  { productId: 'avocados', supplierId: 'sup-freshearth', name: 'Avocados', orderUnit: 'tray', orderUnitPlural: 'trays', packSize: 10, stockUnit: 'units', unitPrice: 9.5 },
  { productId: 'spinach', supplierId: 'sup-freshearth', name: 'Baby Spinach', orderUnit: 'box', orderUnitPlural: 'boxes', packSize: 1, stockUnit: 'kg', unitPrice: 6.8 },
  { productId: 'lemons', supplierId: 'sup-freshearth', name: 'Lemons', orderUnit: 'net', orderUnitPlural: 'nets', packSize: 20, stockUnit: 'units', unitPrice: 5.4 },
  { productId: 'basil', supplierId: 'sup-freshearth', name: 'Fresh Basil', orderUnit: 'pot', orderUnitPlural: 'pots', packSize: 1, stockUnit: 'pots', unitPrice: 1.95 },
  { productId: 'rocket', supplierId: 'sup-freshearth', name: 'Wild Rocket', orderUnit: 'box', orderUnitPlural: 'boxes', packSize: 1, stockUnit: 'kg', unitPrice: 7.2 },
  { productId: 'sourdough', supplierId: 'sup-freshearth', name: 'Sourdough Loaf', orderUnit: 'pack', orderUnitPlural: 'packs', packSize: 4, stockUnit: 'loaves', unitPrice: 12.8 },
  { productId: 'croissants', supplierId: 'sup-risebakery', name: 'Croissants', orderUnit: 'box', orderUnitPlural: 'boxes', packSize: 12, stockUnit: 'units', unitPrice: 14.4 },
  { productId: 'pain-au-chocolat', supplierId: 'sup-risebakery', name: 'Pain au Chocolat', orderUnit: 'box', orderUnitPlural: 'boxes', packSize: 8, stockUnit: 'units', unitPrice: 11.6 },
  { productId: 'cinnamon-scrolls', supplierId: 'sup-risebakery', name: 'Cinnamon Scrolls', orderUnit: 'box', orderUnitPlural: 'boxes', packSize: 6, stockUnit: 'units', unitPrice: 9.9 },
  { productId: 'almond-danish', supplierId: 'sup-risebakery', name: 'Almond Danishes', orderUnit: 'box', orderUnitPlural: 'boxes', packSize: 6, stockUnit: 'units', unitPrice: 10.8 },
  ...(isMultiCurrencyDemo
    ? ([
        { productId: 'espresso', supplierId: 'sup-secondcup-central', name: 'Espresso Forte Whole Bean', orderUnit: 'bag', orderUnitPlural: 'bags', packSize: 1, stockUnit: 'kg', unitPrice: 28 },
        { productId: 'sc-vanilla', supplierId: 'sup-secondcup-central', name: 'Second Cup Vanilla Syrup', orderUnit: 'bottle', orderUnitPlural: 'bottles', packSize: 1, stockUnit: 'l', unitPrice: 10.5 },
      ] satisfies CatalogueProduct[])
    : []),
];

function product(id: string) {
  const found = CATALOGUE.find((item) => item.productId === id);
  if (!found) throw new Error(`Unknown product ${id}`);
  return found;
}

export type FixtureOrder = Omit<BasketOrder, 'lines'> & { lines: FixtureLine[] };
export type Fixtures = Omit<BasketFixtures, 'orders'> & { orders: FixtureOrder[] };

export function buildFixtures(now: Date): Fixtures {
  const today = isoDate(now);
  const suppliers = suppliersFor(now);
  const demandChange: DemandChange = { name: 'Charlotte Street market', date: addDays(today, 2), percent: 150 };

  const order = (
    supplierId: string,
    specs: LineSpec[],
    extra: Partial<BasketOrder> = {},
  ): FixtureOrder => {
    const supplier = suppliers.find((s) => s.id === supplierId)!;
    const delivery = pickDelivery(supplier, today, now);
    const ctx = { today, now, coverEnd: addDays(delivery.deliveryDate, 5), demand: demandChange };
    return {
      id: `ord-${supplierId}`,
      supplierId,
      supplierName: supplier.name,
      currency: supplier.currency,
      minimum: supplier.minimum,
      ...delivery,
      ...extra,
      lines: specs.map((spec) => buildLine(spec, ctx)),
    };
  };

  const orders = [
    order('sup-cheese', [
      { ...product('gruyere'), suggested: 4, onHand: 0.5, daily: 0.35, last: [3, 4, 4, 3] },
      { ...product('cream'), suggested: 2, onHand: 6, daily: 2.4, last: [2, 2, 2, 1], stockWeak: true, stockSource: 'stocktake', stockDaysOld: 9 },
      { ...product('cheddar'), suggested: 1, onHand: 1.1, daily: 0.45, last: [1, 1, 1, 1] },
    ]),
    order('sup-bidvest', [
      { ...product('chicken'), suggested: 2, onHand: 3.5, daily: 2.2, last: [2, 2, 1, 2], overdue: [{ daysAgo: 1, quantity: 5, orderedDaysAgo: 4 }] },
      { ...product('evoo'), suggested: 1, onHand: 2, daily: 0.9, last: [1, 1, 1, 1], priceUp: 25 },
      { ...product('tomato-paste'), suggested: 4, onHand: 3, daily: 4.5, last: [1, 1, 1, 1] },
      { ...product('doughnuts'), suggested: 2, onHand: null, daily: 9, last: [2, 1, 2, 2] },
      { ...product('oat-milk'), suggested: 1, onHand: 9, daily: 1.6, last: [1, 0, 1, 1], forMinimum: true },
      { ...product('coconut-milk'), suggested: 0, startQuantity: 1, onHand: 4, daily: 0.8, last: [0, 1, 0, 0], addedByYou: true, lastChangedBy: 'Sam Okafor' },
      { ...product('smoked-salmon'), suggested: 1, onHand: 1.2, daily: 0.3, last: [1, 0, 1, 0], startsRemoved: true, recentRemovals: { removed: 2, of: 4 } },
    ], { dateEstimated: false }),
    order('sup-cpu', [
      { ...product('bread-flour'), suggested: 2, onHand: 8, daily: 5, last: [2, 2, 3, 2], incoming: [{ inDays: 1, quantity: 12.5, orderedDaysAgo: 2 }] },
      { ...product('butter'), suggested: 2, onHand: 1, daily: 1.1, last: [1, 1, 2, 1], rule: { name: 'Extra butter before weekends', from: 1, to: 2, setBy: 'Alex Morgan' } },
      { ...product('vanilla'), suggested: 1, onHand: 1, daily: 0.12, last: [1, 0, 0, 1] },
    ]),
    ...(isMultiCurrencyDemo
      ? [order('sup-secondcup-central', [
          { ...product('espresso'), suggested: 6, onHand: 4, daily: 1.2, last: [6, 5, 6, 6] },
          { ...product('sc-vanilla'), suggested: 4, onHand: 2, daily: 0.5, last: [4, 4, 3, 4] },
        ], { dateEstimated: true })]
      : []),
  ];

  for (const o of orders) {
    const total = o.lines.reduce((sum, l) => sum + (l.startsRemoved ? 0 : l.startQuantity * l.unitPrice), 0);
    o.needsApproval = o.currency === 'GBP' && total > APPROVAL_LIMIT;
  }

  const amounts = [1240, 1180, 1620, 1410, 1980, 2210];
  const changes = [1, -3, 38, 4, 2, -1];
  const forecast: ForecastTile[] = amounts.map((amount, index) => ({
    date: addDays(today, index),
    amount,
    change: changes[index],
  }));

  return {
    today,
    siteName: SITE_NAME,
    orders,
    forecast,
    demandChange,
    catalogue: CATALOGUE,
    suppliers,
  };
}

export function newOrderFor(supplier: SupplierSummary, today: string, now: Date): BasketOrder {
  const options = deliveryOptions(supplier, today, 8);
  const open = options.find((option) => option.cutOffAt.getTime() > now.getTime());
  return {
    id: `ord-manual-${supplier.id}`,
    supplierId: supplier.id,
    supplierName: supplier.name,
    currency: supplier.currency,
    minimum: supplier.minimum,
    deliveryDate: open?.date ?? null,
    cutOffAt: open?.cutOffAt ?? null,
    dateEstimated: true,
    builtByYou: true,
    lines: [],
  };
}

export function lineFromProduct(item: CatalogueProduct, today: string, now: Date): BasketLine {
  const stockAsOf = new Date(now);
  return {
    id: `line-added-${item.productId}`,
    productId: item.productId,
    name: item.name,
    orderUnit: item.orderUnit,
    orderUnitPlural: item.orderUnitPlural,
    packSize: item.packSize,
    stockUnit: item.stockUnit,
    unitPrice: item.unitPrice,
    suggested: 0,
    onHand: null,
    stockWeak: false,
    stockSource: 'live',
    stockAsOf: stockAsOf.toISOString(),
    forecast: [],
    incoming: [],
    overdue: [],
    lastOrders: lastFour(today, [0, 0, 0, 0]),
    addedByYou: true,
  };
}
