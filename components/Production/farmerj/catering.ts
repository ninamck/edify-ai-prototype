/**
 * Catering orders for the demo. Orders arrive in the formats the till
 * already sells: a 100 g side, a 200 g main, a 400 g buffet box, a 600 g
 * family box. Each format carries its gramme weight, so an order of boxes
 * becomes grams for the cascade and gastronorms for the second make line.
 *
 * Real Farmer J catering platform, formats and how cancellations arrive:
 * open question for Ed. These orders are invented, sized as office lunches.
 */

import { addDays, FJ_DEMO_TODAY } from './calendar';

export type CateringFormat = 'main' | 'side' | 'buffet' | 'family';

export const CATERING_FORMATS: Record<CateringFormat, { label: string; plural: string; grams: number }> = {
  main: { label: 'main', plural: 'mains', grams: 200 },
  side: { label: 'side', plural: 'sides', grams: 100 },
  buffet: { label: 'buffet box', plural: 'buffet boxes', grams: 400 },
  family: { label: 'family box', plural: 'family boxes', grams: 600 },
};

export type CateringLine = { productId: string; format: CateringFormat; qty: number };

export type CateringOrder = {
  id: string;
  shopId: string;
  date: string;
  customer: string;
  /** Collection or delivery time, HH:MM. */
  time: string;
  reference: string;
  lines: CateringLine[];
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
    reference: 'FJ-C-4471',
    lines: [
      { productId: 'amba', format: 'buffet', qty: 20 },
      { productId: 'rice', format: 'buffet', qty: 20 },
      { productId: 'kale-slaw', format: 'buffet', qty: 10 },
      { productId: 'broccoli', format: 'buffet', qty: 10 },
    ],
    note: 'Repeat weekly order.',
  },
  {
    id: 'cat-hines-thu',
    shopId: 'fj-marylebone',
    date: addDays(wed, 1),
    customer: 'Hines',
    time: '12:00',
    reference: 'FJ-C-4478',
    lines: [
      { productId: 'amba', format: 'buffet', qty: 20 },
      { productId: 'grains', format: 'buffet', qty: 20 },
      { productId: 'chickpea-pickles', format: 'buffet', qty: 10 },
    ],
  },
  {
    id: 'cat-kings-thu',
    shopId: 'fj-marylebone',
    date: addDays(wed, 1),
    customer: "King's College, Strand",
    time: '13:00',
    reference: 'FJ-C-4480',
    lines: [
      { productId: 'harissa', format: 'family', qty: 8 },
      { productId: 'tofu', format: 'family', qty: 5 },
      { productId: 'rice', format: 'family', qty: 13 },
      { productId: 'feta-caesar', format: 'buffet', qty: 10 },
    ],
  },
  {
    id: 'cat-imbiba-fri',
    shopId: 'fj-marylebone',
    date: addDays(wed, 2),
    customer: 'Imbiba',
    time: '12:30',
    reference: 'FJ-C-4491',
    lines: [
      { productId: 'amba', format: 'buffet', qty: 10 },
      { productId: 'salmon', format: 'buffet', qty: 10 },
      { productId: 'rice', format: 'buffet', qty: 20 },
      { productId: 'kale-slaw', format: 'buffet', qty: 10 },
    ],
  },
  {
    id: 'cat-gwr-wed',
    shopId: 'fj-paddington',
    date: wed,
    customer: 'GWR, Paddington offices',
    time: '12:00',
    reference: 'FJ-C-4469',
    lines: [
      { productId: 'harissa', format: 'buffet', qty: 30 },
      { productId: 'rice', format: 'buffet', qty: 30 },
      { productId: 'broccoli', format: 'buffet', qty: 15 },
    ],
  },
];

export function cateringFor(shopId: string, date: string): CateringOrder[] {
  return CATERING_ORDERS.filter(o => o.shopId === shopId && o.date === date);
}

export function lineGrams(l: CateringLine): number {
  return l.qty * CATERING_FORMATS[l.format].grams;
}

export function lineLabel(l: CateringLine): string {
  const f = CATERING_FORMATS[l.format];
  return `${l.qty} ${l.qty === 1 ? f.label : f.plural}`;
}

/** Grams per product across the given orders. */
export function cateringGrams(orders: CateringOrder[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of orders) {
    for (const l of o.lines) out[l.productId] = (out[l.productId] ?? 0) + lineGrams(l);
  }
  return out;
}

export function orderGramsFor(order: CateringOrder, productId: string): number {
  return order.lines.filter(l => l.productId === productId).reduce((n, l) => n + lineGrams(l), 0);
}

export function orderGrams(order: CateringOrder): number {
  return order.lines.reduce((n, l) => n + lineGrams(l), 0);
}

/** Boxes across orders for one product, as "20 buffet boxes + 13 family boxes". */
export function boxesLabel(orders: CateringOrder[], productId: string): string {
  const byFormat = new Map<CateringFormat, number>();
  for (const o of orders) for (const l of o.lines) if (l.productId === productId) byFormat.set(l.format, (byFormat.get(l.format) ?? 0) + l.qty);
  return [...byFormat.entries()].map(([f, qty]) => lineLabel({ productId, format: f, qty })).join(' + ');
}

/** Boxes in an order, all products: "60 buffet boxes". */
export function orderBoxesLabel(order: CateringOrder): string {
  const byFormat = new Map<CateringFormat, number>();
  for (const l of order.lines) byFormat.set(l.format, (byFormat.get(l.format) ?? 0) + l.qty);
  return [...byFormat.entries()].map(([f, qty]) => lineLabel({ productId: '', format: f, qty })).join(' + ');
}
