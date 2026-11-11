import type { BasketLine, BasketOrder } from './types';
import { formatShortDate, plural, trimNumber, weekdayShort } from './format';

export function orderFigure(quantity: number, line: Pick<BasketLine, 'orderUnit' | 'orderUnitPlural'>): string {
  return `${trimNumber(quantity)} ${quantity === 1 ? line.orderUnit : line.orderUnitPlural}`;
}

const SINGULAR_UNITS: Record<string, string> = { tins: 'tin', units: 'unit', bottles: 'bottle', pots: 'pot', loaves: 'loaf' };

export function stockFigure(quantity: number, line: Pick<BasketLine, 'stockUnit'>): string {
  const unit = quantity === 1 ? SINGULAR_UNITS[line.stockUnit] ?? line.stockUnit : line.stockUnit;
  return `${trimNumber(quantity)} ${unit}`;
}

/** True when the stock unit says the same thing as the order unit, e.g. bottles. */
export function sameUnits(line: Pick<BasketLine, 'packSize' | 'stockUnit' | 'orderUnitPlural'>): boolean {
  return line.packSize === 1 && line.stockUnit === line.orderUnitPlural;
}

/** Average of the past orders that ordered something. */
export function usualOrder(line: BasketLine): number | null {
  const placed = line.lastOrders.filter((o) => o.quantity > 0);
  if (placed.length === 0) return null;
  return placed.reduce((sum, o) => sum + o.quantity, 0) / placed.length;
}

export function stockKnown(line: BasketLine): boolean {
  return line.onHand !== null && !line.stockWeak;
}

/** The day stock hits zero before this order arrives, if it does. */
export function runsOutOn(line: BasketLine, deliveryDate: string | null): string | null {
  if (!stockKnown(line) || !deliveryDate) return null;
  let stock = line.onHand ?? 0;
  for (const day of line.forecast) {
    if (day.date >= deliveryDate) break;
    stock += line.incoming.filter((d) => d.date === day.date).reduce((s, d) => s + d.quantity, 0);
    stock -= day.quantity;
    if (stock < 0) return day.date;
  }
  return null;
}

/** When the user orders less than Edify suggested, the first day the site runs short. */
export function shortFrom(line: BasketLine, quantity: number, deliveryDate: string | null): string | null {
  if (!deliveryDate || quantity >= line.suggested || line.forecast.length === 0) return null;
  let stock = line.onHand ?? 0;
  for (const day of line.forecast) {
    stock += line.incoming.filter((d) => d.date === day.date).reduce((s, d) => s + d.quantity, 0);
    if (day.date === deliveryDate) stock += quantity * line.packSize;
    stock -= day.quantity;
    if (stock < 0 && day.date >= deliveryDate) return day.date;
  }
  return null;
}

export type LineStatus =
  | { kind: 'strong'; text: string }
  | { kind: 'badge'; text: string }
  | { kind: 'quiet'; text: string };

/** One status per line, most important first. */
export function lineStatus(line: BasketLine, quantity: number, deliveryDate: string | null, today: string): LineStatus | null {
  const usual = usualOrder(line);
  if (usual && !line.forMinimum && quantity >= usual * 3) {
    return { kind: 'strong', text: `${trimNumber(quantity / usual)}× usual order` };
  }
  if (line.priceUp) return { kind: 'strong', text: `Price up ${line.priceUp}%` };
  if (line.overdue.length > 0) {
    const missing = line.overdue.reduce((s, d) => s + d.quantity, 0);
    return { kind: 'strong', text: `${stockFigure(missing, line)} not arrived` };
  }
  const runsOut = runsOutOn(line, deliveryDate);
  if (runsOut) return { kind: 'badge', text: runsOut === today ? 'Runs out today' : `Runs out ${weekdayShort(runsOut)}` };
  if (!stockKnown(line) && !line.addedByYou) return { kind: 'strong', text: 'Stock unknown' };
  if (line.incoming.length > 0) {
    const next = line.incoming[0];
    return { kind: 'quiet', text: `${stockFigure(next.quantity, line)} arriving ${weekdayShort(next.date)}` };
  }
  return null;
}

/** Ask why when the quantity moves by half the suggestion or more. */
export function editDirection(line: BasketLine, quantity: number): 'raised' | 'lowered' | null {
  if (line.addedByYou || line.suggested <= 0) return null;
  const diff = quantity - line.suggested;
  if (Math.abs(diff) < line.suggested / 2) return null;
  return diff > 0 ? 'raised' : 'lowered';
}

export const REASONS = {
  removed: ['Not this time', 'Have stock already', 'Wrong supplier', "Don't need it anymore"],
  raised: ['Busy day or event', 'Need more from now on', 'Stock is lower than it shows', 'Covering waste or breakage'],
  lowered: ['Quiet day', 'Have stock already', 'Need less from now on'],
} as const;

export const REASON_PROMPTS = {
  removed: 'Why remove it?',
  raised: 'Why more? Choose any that apply.',
  lowered: 'Why less? Choose any that apply.',
} as const;

export function needOverWindow(line: BasketLine): number {
  return line.forecast.reduce((sum, day) => sum + day.quantity, 0);
}

export function lastOrdersText(line: BasketLine): string {
  if (line.lastOrders.every((o) => o.quantity === 0)) return 'None';
  return line.lastOrders.map((o) => trimNumber(o.quantity)).join(' · ');
}

export function deliveryNote(order: Pick<BasketOrder, 'movedFrom'>): string | null {
  if (!order.movedFrom) return null;
  return `Moved from ${formatShortDate(order.movedFrom)}: its cut-off has passed.`;
}

export function linesLabel(count: number): string {
  return `${count} ${plural(count, 'line', 'lines')}`;
}
