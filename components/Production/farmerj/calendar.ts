/**
 * Farmer J demo calendar. The real Marylebone trading day was Wednesday
 * 16 April 2025. The demo replays it as Wednesday 16 September 2026 so the
 * dates on screen read as "this week" to Ed and Jana.
 *
 * Planning rhythm (from the calls): managers plan twice a week. Monday
 * afternoon sets Wednesday to Sunday; Friday sets Monday to Wednesday.
 * Wednesday appears in both, so Friday's number for Wednesday is a first
 * draft that Monday confirms. Every day is reviewed the morning of.
 */

import {
  DEEP_CLEAN_DAY,
  productionDaysFor,
  SHELF_LIFE_GROUPS,
  WEEKDAY_LABELS,
  type ShelfLifeGroupId,
  type Weekday,
} from './recipes';
import { getShop } from './shops';

export const FJ_DEMO_TODAY = '2026-09-16';

export function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** Monday = 0 … Sunday = 6. */
export function weekdayOf(iso: string): Weekday {
  return ((toDate(iso).getUTCDay() + 6) % 7) as Weekday;
}

export function weekdayLabel(iso: string): string {
  return WEEKDAY_LABELS[weekdayOf(iso)];
}

const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function longDay(iso: string): string {
  return LONG_DAYS[weekdayOf(iso)];
}

/** "Wed 16 Sep" */
export function shortDate(iso: string): string {
  const d = toDate(iso);
  return `${WEEKDAY_LABELS[weekdayOf(iso)]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Wednesday 16 September" */
export function longDate(iso: string): string {
  const d = toDate(iso);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${LONG_DAYS[weekdayOf(iso)]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

export function isShopOpen(shopId: string, iso: string): boolean {
  const shop = getShop(shopId);
  if (!shop) return true;
  const wd = weekdayOf(iso);
  return shop.weekend || wd < 5;
}

// ─────────────────────────────────────────────────────────────────────────────
// Planning windows
// ─────────────────────────────────────────────────────────────────────────────

export type PlanningWindow = {
  /** The day the plan is set. */
  setOn: string;
  /** First and last day it covers. */
  from: string;
  to: string;
  days: string[];
  label: string;
};

/** The window a given day belongs to. */
export function planningWindowFor(iso: string): PlanningWindow {
  const wd = weekdayOf(iso);
  if (wd <= 1) {
    // Monday or Tuesday: set on the Friday before, covers Mon to Wed.
    const monday = addDays(iso, -wd);
    const friday = addDays(monday, -3);
    const days = [0, 1, 2].map(n => addDays(monday, n));
    return { setOn: friday, from: days[0], to: days[2], days, label: `Set ${shortDate(friday)}, covers Monday to Wednesday` };
  }
  // Wednesday to Sunday: set on the Monday of the same week.
  const monday = addDays(iso, -wd);
  const days = [2, 3, 4, 5, 6].map(n => addDays(monday, n));
  return {
    setOn: monday,
    from: days[0],
    to: days[4],
    days,
    label: `Set ${shortDate(monday)}, covers Wednesday to Sunday`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference days and anomalies
// ─────────────────────────────────────────────────────────────────────────────

export type Anomaly = { date: string; reason: string; /** Sales that day as a share of normal. */ factor: number };

/**
 * Days the manager would exclude when averaging. The protest Saturday is
 * the demo's example (Jana named protests and Ramadan on the calls).
 */
export const ANOMALIES: Anomaly[] = [
  { date: '2026-09-12', reason: 'Protest closed Marylebone High Street from 11:00', factor: 0.55 },
  { date: '2026-08-31', reason: 'Bank holiday Monday', factor: 0.45 },
];

export function anomalyOn(iso: string): Anomaly | undefined {
  return ANOMALIES.find(a => a.date === iso);
}

export type ReferenceDay = { date: string; anomaly?: Anomaly; included: boolean };

/** The last `count` same-weekday trading days before `iso`. Anomalies are
 *  returned but marked excluded so the UI can show them amber with a reason. */
export function referenceDaysFor(iso: string, count = 4): ReferenceDay[] {
  const out: ReferenceDay[] = [];
  let d = addDays(iso, -7);
  while (out.length < count) {
    const anomaly = anomalyOn(d);
    out.push({ date: d, anomaly, included: !anomaly });
    d = addDays(d, -7);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shelf-life calendar
// ─────────────────────────────────────────────────────────────────────────────

export function isProductionDay(shopId: string, group: ShelfLifeGroupId, iso: string): boolean {
  const wd = weekdayOf(iso);
  if (group !== 'daily' && wd === DEEP_CLEAN_DAY) return false;
  if (!isShopOpen(shopId, iso)) return false;
  return productionDaysFor(shopId, group).includes(wd);
}

/** The make-on day for something needed on `neededOn`: the latest
 *  production day for that group on or before the day, within shelf life. */
export function makeOnDayFor(shopId: string, group: ShelfLifeGroupId, neededOn: string): string {
  const life = SHELF_LIFE_GROUPS[group].days;
  for (let back = 0; back < life; back++) {
    const d = addDays(neededOn, -back);
    if (isProductionDay(shopId, group, d)) return d;
  }
  // Nothing in range (e.g. a weekend-closed shop): fall back to the day itself.
  return neededOn;
}

/** The days a batch made on `madeOn` covers: from that day until the day
 *  before the next production day, capped at shelf life. */
export function daysCoveredFrom(shopId: string, group: ShelfLifeGroupId, madeOn: string): string[] {
  const life = SHELF_LIFE_GROUPS[group].days;
  const days = [madeOn];
  for (let n = 1; n < life; n++) {
    const d = addDays(madeOn, n);
    if (isProductionDay(shopId, group, d)) break;
    days.push(d);
  }
  return days;
}

export function isDeepCleanDay(iso: string): boolean {
  return weekdayOf(iso) === DEEP_CLEAN_DAY;
}

export function isWeekend(iso: string): boolean {
  return weekdayOf(iso) >= 5;
}
