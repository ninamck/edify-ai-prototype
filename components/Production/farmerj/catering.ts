/**
 * Catering orders. Farmer J sells catering in two box sizes and a handful
 * of feasts (the ProMap workbook's CATERING sheet):
 *
 *   Fieldtray X4   serves 4. A base is 600 g, a protein or side 400 g.
 *   Fieldtray X6   serves 6. A base is 900 g, a protein or side 600 g.
 *   Feasts         a fixed set of X6 boxes sold as one line: Chicken,
 *                  Veggie and Vegan Feast for 10 to 12, Forkin' Huge Feast
 *                  for 25 to 30. The kitchen sees the boxes, not the feast.
 *   Extras         sauces, cookies, bakes, juices and lemonades sold with
 *                  the order. Front of house packs them; nothing to cook.
 *
 * X4 is also the till's "Fam Of 4" category, so a walk-in family box and a
 * catering X4 are the same thing to the kitchen. Orders arrive through
 * Corporate (direct), CityPantry and Ordit; the channel is on the order so
 * the second make line knows whose label goes on the box.
 *
 * The orders below are invented, sized as office lunches. Customers and
 * references are placeholders.
 */

import { addDays, FJ_DEMO_TODAY } from './calendar';
import { PRODUCT_BY_ID } from './recipes';
import type { SalesChannel } from './salesDay';

export type CateringFormat = 'x4' | 'x6';

export const CATERING_FORMATS: Record<CateringFormat, { label: string; plural: string; serves: number; baseGrams: number; otherGrams: number }> = {
  x4: { label: 'X4 box', plural: 'X4 boxes', serves: 4, baseGrams: 600, otherGrams: 400 },
  x6: { label: 'X6 box', plural: 'X6 boxes', serves: 6, baseGrams: 900, otherGrams: 600 },
};

export type CateringChannel = Extract<SalesChannel, 'corporate' | 'citypantry' | 'ordit'>;

export const CATERING_CHANNEL_LABELS: Record<CateringChannel, string> = {
  corporate: 'Corporate',
  citypantry: 'CityPantry',
  ordit: 'Ordit',
};

export type CateringLine = { productId: string; format: CateringFormat; qty: number };

export type FeastId = 'chicken-feast' | 'veggie-feast' | 'vegan-feast' | 'huge-feast';

export type Feast = { id: FeastId; name: string; serves: string; boxes: CateringLine[] };

/** What each feast is made of, in X6 boxes. Our reading of the menu; Jana edits. */
export const FEASTS: Record<FeastId, Feast> = {
  'chicken-feast': {
    id: 'chicken-feast', name: 'Chicken Feast', serves: '10 to 12',
    boxes: [
      { productId: 'harissa', format: 'x6', qty: 1 },
      { productId: 'amba', format: 'x6', qty: 1 },
      { productId: 'rice', format: 'x6', qty: 2 },
      { productId: 'broccoli', format: 'x6', qty: 1 },
      { productId: 'kale-slaw', format: 'x6', qty: 1 },
      { productId: 'chickpea-pickles', format: 'x6', qty: 1 },
    ],
  },
  'veggie-feast': {
    id: 'veggie-feast', name: 'Veggie Feast', serves: '10 to 12',
    boxes: [
      { productId: 'cauliflower', format: 'x6', qty: 1 },
      { productId: 'mac-cheese', format: 'x6', qty: 1 },
      { productId: 'grains', format: 'x6', qty: 2 },
      { productId: 'broccoli', format: 'x6', qty: 1 },
      { productId: 'feta-caesar', format: 'x6', qty: 1 },
      { productId: 'iow-tomato', format: 'x6', qty: 1 },
    ],
  },
  'vegan-feast': {
    id: 'vegan-feast', name: 'Vegan Feast', serves: '10 to 12',
    boxes: [
      { productId: 'tofu', format: 'x6', qty: 2 },
      { productId: 'rice', format: 'x6', qty: 2 },
      { productId: 'sweet-potato', format: 'x6', qty: 1 },
      { productId: 'kale-slaw', format: 'x6', qty: 1 },
      { productId: 'chickpea-pickles', format: 'x6', qty: 1 },
    ],
  },
  'huge-feast': {
    id: 'huge-feast', name: "Forkin' Huge Feast", serves: '25 to 30',
    boxes: [
      { productId: 'harissa', format: 'x6', qty: 2 },
      { productId: 'amba', format: 'x6', qty: 1 },
      { productId: 'salmon', format: 'x6', qty: 1 },
      { productId: 'tofu', format: 'x6', qty: 1 },
      { productId: 'rice', format: 'x6', qty: 3 },
      { productId: 'grains', format: 'x6', qty: 2 },
      { productId: 'broccoli', format: 'x6', qty: 2 },
      { productId: 'sweet-potato', format: 'x6', qty: 1 },
      { productId: 'kale-slaw', format: 'x6', qty: 2 },
      { productId: 'chickpea-pickles', format: 'x6', qty: 1 },
    ],
  },
};

export type CateringOrder = {
  id: string;
  shopId: string;
  date: string;
  customer: string;
  /** Collection or delivery time, HH:MM. */
  time: string;
  reference: string;
  channel: CateringChannel;
  /** Boxes ordered directly. */
  lines: CateringLine[];
  /** Feasts ordered; expanded into boxes by `orderLines`. */
  feasts?: { id: FeastId; qty: number }[];
  /** Front-of-house extras packed with the order: sauces, cookies, juices. */
  extras?: string[];
  note?: string;
};

const wed = FJ_DEMO_TODAY;

export const CATERING_ORDERS: CateringOrder[] = [
  {
    id: 'cat-bloomberg-wed',
    shopId: 'fj-marylebone',
    date: wed,
    customer: 'Bloomberg, 3rd floor',
    time: '12:15',
    reference: 'CP-884471',
    channel: 'citypantry',
    lines: [
      { productId: 'amba', format: 'x6', qty: 4 },
      { productId: 'rice', format: 'x6', qty: 4 },
      { productId: 'kale-slaw', format: 'x6', qty: 2 },
      { productId: 'broccoli', format: 'x6', qty: 2 },
    ],
    extras: ['Sauces for 30', 'Cookies for 15'],
    note: 'Repeat weekly order.',
  },
  {
    id: 'cat-hines-thu',
    shopId: 'fj-marylebone',
    date: addDays(wed, 1),
    customer: 'Hines',
    time: '12:00',
    reference: 'FJ-C-4478',
    channel: 'corporate',
    lines: [],
    feasts: [{ id: 'chicken-feast', qty: 2 }],
    extras: ['Sauces for 12', 'Juices for 6'],
  },
  {
    id: 'cat-kings-thu',
    shopId: 'fj-marylebone',
    date: addDays(wed, 1),
    customer: "King's College, Strand",
    time: '13:00',
    reference: 'OR-20931',
    channel: 'ordit',
    lines: [
      { productId: 'harissa', format: 'x4', qty: 4 },
      { productId: 'tofu', format: 'x4', qty: 2 },
      { productId: 'rice', format: 'x4', qty: 6 },
      { productId: 'feta-caesar', format: 'x4', qty: 3 },
    ],
    extras: ['Lemonades for 6'],
  },
  {
    id: 'cat-imbiba-fri',
    shopId: 'fj-marylebone',
    date: addDays(wed, 2),
    customer: 'Imbiba',
    time: '12:30',
    reference: 'CP-884520',
    channel: 'citypantry',
    lines: [
      { productId: 'salmon', format: 'x6', qty: 2 },
      { productId: 'amba', format: 'x6', qty: 2 },
      { productId: 'rice', format: 'x6', qty: 4 },
      { productId: 'kale-slaw', format: 'x6', qty: 2 },
    ],
    extras: ['Sauces for 12', 'Bakes for 15'],
  },
  {
    id: 'cat-gwr-wed',
    shopId: 'fj-paddington',
    date: wed,
    customer: 'GWR, Paddington offices',
    time: '12:00',
    reference: 'FJ-C-4469',
    channel: 'corporate',
    lines: [],
    feasts: [{ id: 'huge-feast', qty: 1 }, { id: 'vegan-feast', qty: 1 }],
    extras: ['Sauces for 30', 'Cookies for 15', 'Juices for 6'],
  },
];

export function cateringFor(shopId: string, date: string): CateringOrder[] {
  return CATERING_ORDERS.filter(o => o.shopId === shopId && o.date === date);
}

export function feastLabel(f: { id: FeastId; qty: number }): string {
  const feast = FEASTS[f.id];
  return `${f.qty} × ${feast.name} (${feast.serves})`;
}

/**
 * Every box in an order, feasts expanded, merged by product and format.
 * This is what the kitchen packs and what the cascade adds to the plan.
 */
export function orderLines(order: CateringOrder): CateringLine[] {
  const merged = new Map<string, CateringLine>();
  const push = (l: CateringLine, times = 1) => {
    const k = `${l.productId}|${l.format}`;
    const cur = merged.get(k);
    if (cur) cur.qty += l.qty * times;
    else merged.set(k, { ...l, qty: l.qty * times });
  };
  for (const l of order.lines) push(l);
  for (const f of order.feasts ?? []) for (const b of FEASTS[f.id].boxes) push(b, f.qty);
  return [...merged.values()];
}

export function lineGrams(l: CateringLine): number {
  const f = CATERING_FORMATS[l.format];
  const isBase = PRODUCT_BY_ID[l.productId]?.group === 'bases';
  return l.qty * (isBase ? f.baseGrams : f.otherGrams);
}

export function lineLabel(l: CateringLine): string {
  const f = CATERING_FORMATS[l.format];
  return `${l.qty} ${l.qty === 1 ? f.label : f.plural}`;
}

/** Grams per product across the given orders. */
export function cateringGrams(orders: CateringOrder[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of orders) {
    for (const l of orderLines(o)) out[l.productId] = (out[l.productId] ?? 0) + lineGrams(l);
  }
  return out;
}

export function orderGramsFor(order: CateringOrder, productId: string): number {
  return orderLines(order).filter(l => l.productId === productId).reduce((n, l) => n + lineGrams(l), 0);
}

export function orderGrams(order: CateringOrder): number {
  return orderLines(order).reduce((n, l) => n + lineGrams(l), 0);
}

/** Boxes in an order, all products. */
export function orderBoxCount(order: CateringOrder): number {
  return orderLines(order).reduce((n, l) => n + l.qty, 0);
}

/** Boxes across orders for one product, as "4 X6 boxes + 6 X4 boxes". */
export function boxesLabel(orders: CateringOrder[], productId: string): string {
  const byFormat = new Map<CateringFormat, number>();
  for (const o of orders) for (const l of orderLines(o)) if (l.productId === productId) byFormat.set(l.format, (byFormat.get(l.format) ?? 0) + l.qty);
  return [...byFormat.entries()].map(([f, qty]) => lineLabel({ productId, format: f, qty })).join(' + ');
}

/** Boxes in an order, all products: "12 X6 boxes". */
export function orderBoxesLabel(order: CateringOrder): string {
  const byFormat = new Map<CateringFormat, number>();
  for (const l of orderLines(order)) byFormat.set(l.format, (byFormat.get(l.format) ?? 0) + l.qty);
  return [...byFormat.entries()].map(([f, qty]) => lineLabel({ productId: '', format: f, qty })).join(' + ');
}

/** Boxes per format across orders, for packaging. */
export function boxesByFormat(orders: CateringOrder[]): Record<CateringFormat, number> {
  const out: Record<CateringFormat, number> = { x4: 0, x6: 0 };
  for (const o of orders) for (const l of orderLines(o)) out[l.format] += l.qty;
  return out;
}
