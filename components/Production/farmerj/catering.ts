/**
 * Catering orders for the demo. In Jana's workbook each order is one
 * column so a cancellation is one deletion; the day plan keeps that shape.
 *
 * Real Farmer J catering platform and how cancellations arrive: open
 * question for Ed. These orders are invented, sized as office lunches.
 */

import { addDays, FJ_DEMO_TODAY } from './calendar';

export type CateringLine = { productId: string; portions: number; gramsEach: number };

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
      { productId: 'amba', portions: 40, gramsEach: 200 },
      { productId: 'rice', portions: 40, gramsEach: 200 },
      { productId: 'kale-slaw', portions: 40, gramsEach: 100 },
      { productId: 'broccoli', portions: 40, gramsEach: 100 },
    ],
    note: 'Buffet boxes. Repeat weekly order.',
  },
  {
    id: 'cat-hines-thu',
    shopId: 'fj-marylebone',
    date: addDays(wed, 1),
    customer: 'Hines',
    time: '12:00',
    reference: 'FJ-C-4478',
    lines: [
      { productId: 'amba', portions: 40, gramsEach: 200 },
      { productId: 'grains', portions: 40, gramsEach: 200 },
      { productId: 'chickpea-pickles', portions: 40, gramsEach: 100 },
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
      { productId: 'harissa', portions: 25, gramsEach: 200 },
      { productId: 'tofu', portions: 15, gramsEach: 200 },
      { productId: 'rice', portions: 40, gramsEach: 200 },
      { productId: 'feta-caesar', portions: 40, gramsEach: 100 },
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
      { productId: 'amba', portions: 20, gramsEach: 200 },
      { productId: 'salmon', portions: 20, gramsEach: 200 },
      { productId: 'rice', portions: 40, gramsEach: 200 },
      { productId: 'kale-slaw', portions: 40, gramsEach: 100 },
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
      { productId: 'harissa', portions: 60, gramsEach: 200 },
      { productId: 'rice', portions: 60, gramsEach: 200 },
      { productId: 'broccoli', portions: 60, gramsEach: 100 },
    ],
  },
];

export function cateringFor(shopId: string, date: string): CateringOrder[] {
  return CATERING_ORDERS.filter(o => o.shopId === shopId && o.date === date);
}

/** Grams per product across the given orders. */
export function cateringGrams(orders: CateringOrder[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of orders) {
    for (const l of o.lines) out[l.productId] = (out[l.productId] ?? 0) + l.portions * l.gramsEach;
  }
  return out;
}

export function orderGramsFor(order: CateringOrder, productId: string): number {
  return order.lines.filter(l => l.productId === productId).reduce((n, l) => n + l.portions * l.gramsEach, 0);
}

export function orderPortions(order: CateringOrder): number {
  const mains = order.lines.filter(l => l.gramsEach >= 200);
  return Math.max(...mains.map(l => l.portions), 0);
}
