/**
 * Sales → demand for Farmer J.
 *
 * One real day (Marylebone, lunch, 16 April 2025) is the seed. Every other
 * shop-day in the demo is modelled from it: weekday pattern, shop size,
 * breakfast and evening trade where the shop has them, a little noise, and
 * the anomalies in `calendar.ts`. Every modelled figure carries
 * `modelled: true` so the dashboard can say so.
 */

import { MARYLEBONE_SALES_DAY, type SalesChannel, type SalesRow } from './salesDay';
import { BREAKFAST_MIX, PRODUCT_BY_ID, PRODUCTS, TRAY_CATEGORIES, tillYields } from './recipes';
import { anomalyOn, FJ_DEMO_TODAY, isShopOpen, weekdayOf } from './calendar';
import { FJ_DEFAULT_SHOP_ID, getShop } from './shops';

import { ALL_CHANNELS, DELIVERY_CHANNELS, PLATFORM_CHANNELS } from './lines';

export { CHANNEL_LABELS, DELIVERY_CHANNELS, PLATFORM_CHANNELS } from './lines';

/**
 * How a modelled shop's second-line trade splits between Deliveroo, Click &
 * Collect and the catering platforms. The ProMap workbook's takings sheet
 * has CityPantry at 4 to 6% of a City shop's day and Ordit at 2 to 3% on
 * the days it lands; Corporate is the odd direct office order. Marylebone's
 * real day is 100% Deliveroo and Click & Collect, so the platforms are
 * carved out of its Deliveroo share when a shop-day is modelled.
 */
const PLATFORM_SPLIT: Partial<Record<SalesChannel, number>> = { citypantry: 0.2, ordit: 0.1, corporate: 0.04 };

/** Pounds taken on the channels the second make line packs. */
export function secondLineNet(d: { netByChannel: Record<SalesChannel, number> }): number {
  let n = 0;
  for (const ch of DELIVERY_CHANNELS) n += d.netByChannel[ch] ?? 0;
  return n;
}

export type DayPart = 'breakfast' | 'lunch' | 'dinner';

export function dayPartOfHour(hour: number): DayPart {
  if (hour < 11) return 'breakfast';
  if (hour < 17) return 'lunch';
  return 'dinner';
}

export type ProductDemand = {
  productId: string;
  grams: number;
  /** Portions sold, whatever the format. */
  portions: number;
  /** Pounds taken on till lines where this product is the headline (a
   *  tray, a bowl, an extra). Bases and sides ride on the tray at £0. */
  net: number;
  /** Grams by sales channel. The plan splits these across the shop's lines. */
  byChannel: Record<SalesChannel, number>;
  byHour: Record<number, number>;
};

export type ComponentDemand = { componentId: string; grams: number; portions: number };

export type DayDemand = {
  shopId: string;
  date: string;
  modelled: boolean;
  products: Record<string, ProductDemand>;
  /** Sauces and toppings sold directly (Green Tahini, pickles). */
  components: Record<string, ComponentDemand>;
  net: number;
  items: number;
  trays: number;
  netByHour: Record<number, number>;
  itemsByHour: Record<number, number>;
  traysByHour: Record<number, Record<SalesChannel, number>>;
  netByDayPart: Record<DayPart, number>;
  netByChannel: Record<SalesChannel, number>;
};

const emptyChannels = (): Record<SalesChannel, number> => Object.fromEntries(ALL_CHANNELS.map(c => [c, 0])) as Record<SalesChannel, number>;

/**
 * Move a slice of a modelled Deliveroo figure onto the catering platforms.
 * City shops (no weekend) carry the platforms; the West End shops see
 * little of it. Deterministic per shop-day so the split is stable.
 */
function carvePlatforms(byCh: Record<SalesChannel, number>, shopId: string, date: string, city: boolean): void {
  const pool = byCh.deliveroo;
  if (pool <= 0) return;
  const scale = city ? 1 : 0.35;
  let moved = 0;
  for (const ch of PLATFORM_CHANNELS) {
    const share = (PLATFORM_SPLIT[ch] ?? 0) * scale * noise(`${shopId}|${date}|${ch}`, 0.5);
    const g = pool * share;
    byCh[ch] += g;
    moved += g;
  }
  byCh.deliveroo = pool - moved;
}

function emptyDemand(shopId: string, date: string, modelled: boolean): DayDemand {
  return {
    shopId, date, modelled,
    products: {}, components: {},
    net: 0, items: 0, trays: 0,
    netByHour: {}, itemsByHour: {}, traysByHour: {},
    netByDayPart: { breakfast: 0, lunch: 0, dinner: 0 },
    netByChannel: emptyChannels(),
  };
}

function productDemandFor(d: DayDemand, id: string): ProductDemand {
  return (d.products[id] ??= { productId: id, grams: 0, portions: 0, net: 0, byChannel: emptyChannels(), byHour: {} });
}

/** Turn till rows into grams of finished product and direct component demand. */
export function demandFromRows(rows: SalesRow[], shopId: string, date: string, modelled = false): DayDemand {
  const d = emptyDemand(shopId, date, modelled);
  for (const r of rows) {
    d.net += r.net;
    d.items += r.items;
    d.netByHour[r.hour] = (d.netByHour[r.hour] ?? 0) + r.net;
    d.itemsByHour[r.hour] = (d.itemsByHour[r.hour] ?? 0) + r.items;
    d.netByDayPart[dayPartOfHour(r.hour)] += r.net;
    d.netByChannel[r.channel] += r.net;
    if (TRAY_CATEGORIES.has(r.category)) {
      d.trays += r.items;
      const h = (d.traysByHour[r.hour] ??= emptyChannels());
      h[r.channel] += r.items;
    }
    const yields = tillYields(r.category, r.name);
    yields.forEach((y, i) => {
      const grams = y.grams * r.items;
      if (y.kind === 'product') {
        const p = productDemandFor(d, y.ref);
        p.grams += grams;
        p.portions += r.items;
        if (i === 0) p.net += r.net;
        p.byChannel[r.channel] += grams;
        p.byHour[r.hour] = (p.byHour[r.hour] ?? 0) + grams;
      } else {
        const c = (d.components[y.ref] ??= { componentId: y.ref, grams: 0, portions: 0 });
        c.grams += grams;
        c.portions += r.items;
      }
    });
  }
  d.net = round2(d.net);
  return d;
}

/** The one real day, as demand. */
export const MARYLEBONE_REAL_DAY: DayDemand = demandFromRows(MARYLEBONE_SALES_DAY, FJ_DEFAULT_SHOP_ID, FJ_DEMO_TODAY, false);

// ─────────────────────────────────────────────────────────────────────────────
// Modelled history
// ─────────────────────────────────────────────────────────────────────────────

/** Weekday pattern relative to a Wednesday, from our read of London lunch trade. */
const DOW_FACTOR = [0.92, 0.98, 1.0, 1.02, 0.9, 0.7, 0.6];

/** Deterministic wobble in [1 - spread, 1 + spread]. */
function noise(seed: string, spread: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const unit = ((h >>> 0) % 10000) / 10000;
  return 1 - spread + unit * 2 * spread;
}

/** Marylebone's real second-line share, used to rescale other shops. */
const MARYLEBONE_DELIVERY_SHARE = 0.11;

/**
 * The scale factor for a shop-day against the real Marylebone lunch.
 * Zero when the shop is closed.
 */
export function dayFactor(shopId: string, date: string): number {
  const shop = getShop(shopId);
  if (!shop || !isShopOpen(shopId, date)) return 0;
  const wd = weekdayOf(date);
  const anomaly = anomalyOn(date);
  return shop.sizeFactor * DOW_FACTOR[wd] * noise(`${shopId}|${date}`, 0.07) * (anomaly?.factor ?? 1);
}

/** Breakfast hours and evening hours modelled on top of the lunch export. */
const BREAKFAST_CURVE: Record<number, number> = { 7: 0.15, 8: 0.35, 9: 0.3, 10: 0.2 };
const DINNER_CURVE: Record<number, number> = { 17: 0.2, 18: 0.35, 19: 0.3, 20: 0.15 };

/**
 * Demand for any shop on any date. Marylebone on the demo day is the real
 * export. Everything else is the real day scaled, with breakfast and
 * dinner added where the shop trades then.
 */
export function daySales(shopId: string, date: string): DayDemand {
  const shop = getShop(shopId);
  if (shopId === FJ_DEFAULT_SHOP_ID && date === FJ_DEMO_TODAY) return MARYLEBONE_REAL_DAY;
  const factor = dayFactor(shopId, date);
  const out = emptyDemand(shopId, date, true);
  if (!shop || factor === 0) return out;

  const base = MARYLEBONE_REAL_DAY;
  // Delivery share: rescale the second-line channels so the shop's own
  // share comes through without changing the total.
  const secondScale = shop.deliveryShare / MARYLEBONE_DELIVERY_SHARE;
  const mainScale = (1 - shop.deliveryShare) / (1 - MARYLEBONE_DELIVERY_SHARE);
  const channelScale = (ch: SalesChannel) => (DELIVERY_CHANNELS.has(ch) ? secondScale : mainScale);

  const closesAt = Number(shop.closesAt.slice(0, 2));
  const dinnerShare = closesAt >= 20 ? 0.22 : closesAt >= 19 ? 0.12 : 0;
  const breakfastShare = shop.breakfast ? shop.breakfastShare : 0;
  // Lunch is the export. Breakfast and dinner are shares of the whole day,
  // so lunch = (1 - breakfast - dinner) of the day.
  const lunchShare = 1 - breakfastShare - dinnerShare;
  const dayNet = (base.net * factor) / lunchShare;

  for (const [id, p] of Object.entries(base.products)) {
    const pn = noise(`${shopId}|${date}|${id}`, 0.12);
    const q = productDemandFor(out, id);
    for (const ch of Object.keys(p.byChannel) as SalesChannel[]) {
      const g = p.byChannel[ch] * factor * pn * channelScale(ch);
      q.byChannel[ch] = g;
      q.grams += g;
    }
    q.portions = Math.round(p.portions * factor * pn);
    q.net = p.net * factor * pn;
    for (const [h, g] of Object.entries(p.byHour)) q.byHour[Number(h)] = g * factor * pn;
    // Dinner: a smaller second sitting on the same mix, main line only
    // for hot food (delivery still runs).
    if (dinnerShare > 0) {
      const dinnerG = q.grams * (dinnerShare / lunchShare);
      q.grams += dinnerG;
      q.byChannel.instore += dinnerG * (1 - shop.deliveryShare);
      q.byChannel.deliveroo += dinnerG * shop.deliveryShare;
      q.portions += Math.round(q.portions * (dinnerShare / lunchShare));
      q.net += q.net * (dinnerShare / lunchShare);
      for (const [h, w] of Object.entries(DINNER_CURVE)) q.byHour[Number(h)] = (q.byHour[Number(h)] ?? 0) + dinnerG * w;
    }
    carvePlatforms(q.byChannel, shopId, date, !shop.weekend);
  }
  for (const [id, c] of Object.entries(base.components)) {
    out.components[id] = { componentId: id, grams: c.grams * factor, portions: Math.round(c.portions * factor) };
  }

  // Breakfast: the breakfast menu as shares of a breakfast bill, all in
  // store (the platforms and Deliveroo do not carry breakfast).
  if (breakfastShare > 0) {
    const bfNet = dayNet * breakfastShare;
    for (const m of BREAKFAST_MIX) {
      const p = PRODUCT_BY_ID[m.productId];
      if (!p) continue;
      const portions = Math.round(((bfNet * m.share) / m.price) * noise(`${shopId}|${date}|${m.productId}`, 0.15));
      if (portions <= 0) continue;
      const gramsEach = (p.batch.fullG * (1 - p.yieldLossPct / 100)) / p.unitsPerBatch;
      const q = productDemandFor(out, m.productId);
      q.portions = portions;
      q.net = portions * m.price;
      q.grams = portions * gramsEach;
      q.byChannel.instore = q.grams;
      for (const [h, w] of Object.entries(BREAKFAST_CURVE)) q.byHour[Number(h)] = q.grams * w;
    }
    for (const [h, w] of Object.entries(BREAKFAST_CURVE)) {
      out.netByHour[Number(h)] = (out.netByHour[Number(h)] ?? 0) + bfNet * w;
      out.itemsByHour[Number(h)] = Math.round(bfNet * w / 3.1);
    }
    out.netByDayPart.breakfast = bfNet;
  }

  // Lunch totals from the export, scaled.
  for (const [h, n] of Object.entries(base.netByHour)) out.netByHour[Number(h)] = (out.netByHour[Number(h)] ?? 0) + n * factor;
  for (const [h, n] of Object.entries(base.itemsByHour)) out.itemsByHour[Number(h)] = (out.itemsByHour[Number(h)] ?? 0) + Math.round(n * factor);
  for (const [h, byCh] of Object.entries(base.traysByHour)) {
    const t = (out.traysByHour[Number(h)] ??= emptyChannels());
    for (const ch of Object.keys(byCh) as SalesChannel[]) t[ch] = Math.round(byCh[ch] * factor * channelScale(ch));
  }
  out.netByDayPart.lunch = base.net * factor;

  // Dinner totals.
  if (dinnerShare > 0) {
    const dinnerNet = dayNet * dinnerShare;
    for (const [h, w] of Object.entries(DINNER_CURVE)) {
      out.netByHour[Number(h)] = (out.netByHour[Number(h)] ?? 0) + dinnerNet * w;
      out.itemsByHour[Number(h)] = Math.round(dinnerNet * w / 2.2);
      const t = (out.traysByHour[Number(h)] ??= emptyChannels());
      const trays = Math.round((base.trays * factor * (dinnerShare / lunchShare)) * w);
      t.instore += Math.round(trays * (1 - shop.deliveryShare));
      t.deliveroo += Math.round(trays * shop.deliveryShare);
    }
    out.netByDayPart.dinner = dinnerNet;
  }

  for (const ch of Object.keys(base.netByChannel) as SalesChannel[]) {
    out.netByChannel[ch] = base.netByChannel[ch] * factor * channelScale(ch);
  }
  carvePlatforms(out.netByChannel, shopId, date, !shop.weekend);
  for (const t of Object.values(out.traysByHour)) carvePlatforms(t, shopId, date, !shop.weekend);
  // Breakfast is all in store; dinner splits like lunch does.
  out.netByChannel.instore += out.netByDayPart.breakfast;
  out.netByChannel.instore += out.netByDayPart.dinner * (1 - shop.deliveryShare);
  out.netByChannel.deliveroo += out.netByDayPart.dinner * shop.deliveryShare;
  out.net = round2(Object.values(out.netByDayPart).reduce((a, b) => a + b, 0));
  out.items = Object.values(out.itemsByHour).reduce((a, b) => a + b, 0);
  out.trays = Object.values(out.traysByHour).reduce((a, t) => a + Object.values(t).reduce((x, y) => x + y, 0), 0);
  return out;
}

/**
 * Average demand across reference days, per product and direct component.
 * Used by the day plan: "Drafted from the last four Wednesdays".
 */
export function averageDemand(shopId: string, dates: string[]): DayDemand {
  const out = emptyDemand(shopId, dates[0] ?? FJ_DEMO_TODAY, true);
  if (dates.length === 0) return out;
  const n = dates.length;
  for (const date of dates) {
    const d = daySales(shopId, date);
    for (const [id, p] of Object.entries(d.products)) {
      const q = productDemandFor(out, id);
      q.grams += p.grams / n;
      q.portions += p.portions / n;
      q.net += p.net / n;
      for (const ch of Object.keys(p.byChannel) as SalesChannel[]) q.byChannel[ch] += p.byChannel[ch] / n;
      for (const [h, g] of Object.entries(p.byHour)) q.byHour[Number(h)] = (q.byHour[Number(h)] ?? 0) + g / n;
    }
    for (const [id, c] of Object.entries(d.components)) {
      const q = (out.components[id] ??= { componentId: id, grams: 0, portions: 0 });
      q.grams += c.grams / n;
      q.portions += c.portions / n;
    }
    out.net += d.net / n;
    out.items += d.items / n;
    out.trays += d.trays / n;
    for (const part of Object.keys(d.netByDayPart) as DayPart[]) out.netByDayPart[part] += d.netByDayPart[part] / n;
    for (const ch of Object.keys(d.netByChannel) as SalesChannel[]) out.netByChannel[ch] += d.netByChannel[ch] / n;
    for (const [h, v] of Object.entries(d.netByHour)) out.netByHour[Number(h)] = (out.netByHour[Number(h)] ?? 0) + v / n;
    for (const [h, v] of Object.entries(d.itemsByHour)) out.itemsByHour[Number(h)] = (out.itemsByHour[Number(h)] ?? 0) + v / n;
    for (const [h, byCh] of Object.entries(d.traysByHour)) {
      const t = (out.traysByHour[Number(h)] ??= emptyChannels());
      for (const ch of Object.keys(byCh) as SalesChannel[]) t[ch] += byCh[ch] / n;
    }
  }
  out.net = round2(out.net);
  return out;
}

/**
 * What the front-of-house manager owns and the kitchen does not: cookies,
 * cold drinks, toppings. Scaled from the real day for the shop and date so
 * the "tomorrow" card reads in real quantities.
 */
export type FohReminder = { id: string; label: string; detail: string };

export function fohReminders(shopId: string, date: string): FohReminder[] {
  const factor = shopId === FJ_DEFAULT_SHOP_ID && date === FJ_DEMO_TODAY ? 1 : dayFactor(shopId, date);
  if (factor === 0) return [];
  let cookies = 0;
  let coldDrinks = 0;
  let cakes = 0;
  let pickledCucumber = 0;
  let pickledOnion = 0;
  for (const r of MARYLEBONE_SALES_DAY) {
    if (r.category === 'Snacks/Impluse' && /Cookie/.test(r.name)) cookies += r.items;
    else if (r.category === 'Snacks/Impluse' && /Cupcake|Brownie|Banana Bread|Flapjack/.test(r.name)) cakes += r.items;
    else if (r.category === 'Cold Drinks') coldDrinks += r.items;
    else if ((r.category === 'FT Extras' || r.category === 'Toppings') && r.name === 'Pickled Cucumber') pickledCucumber += r.items;
    else if (r.category === 'FT Extras' && r.name === 'Pickled Onion') pickledOnion += r.items;
  }
  const scale = (n: number, up = 1.1) => Math.ceil((n * factor * up) / 6) * 6;
  const out: FohReminder[] = [
    { id: 'cookies', label: `Defrost ${scale(cookies)} cookies tonight`, detail: `${Math.round(cookies * factor)} sold on a day like tomorrow. Chocolate chip first, then matcha.` },
    { id: 'drinks', label: `${scale(coldDrinks, 1.15)} cold drinks on the shelf`, detail: 'Fridge fill before open. Kombucha and sparkling run out first.' },
    { id: 'cakes', label: `${scale(cakes)} cakes and brownies out`, detail: 'From the ambient delivery. Cupcakes go on the top shelf.' },
  ];
  if (pickledCucumber + pickledOnion > 0) {
    out.push({
      id: 'toppings',
      label: 'One tub each of pickled cucumber and pickled onion at the till',
      detail: `${Math.round((pickledCucumber + pickledOnion) * factor)} topping portions on a day like tomorrow. The basement preps the tubs; front of house puts them out.`,
    });
  }
  return out;
}

/** Product ids that actually sold on a day, in day-plan group order. */
export function productsSold(d: DayDemand): string[] {
  return PRODUCTS.filter(p => (d.products[p.id]?.grams ?? 0) > 0).map(p => p.id);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
