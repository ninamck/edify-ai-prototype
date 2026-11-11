import { BASE_CURRENCY, convert, currencySymbol, type CurrencyCode } from '@/lib/currency';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local calendar date as "YYYY-MM-DD". */
export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

/** "Fri 13 Nov" */
export function formatShortDate(value: string): string {
  const date = parseIsoDate(value);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "Fri, 13 Nov 2026" */
export function formatLongDate(value: string): string {
  const date = parseIsoDate(value);
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function weekdayShort(value: string): string {
  return WEEKDAYS[parseIsoDate(value).getDay()];
}

export function weekdayLong(value: string): string {
  return WEEKDAYS_LONG[parseIsoDate(value).getDay()];
}

/** "Thu 12" for the per-day bars. */
export function formatDayLabel(value: string, today: string): string {
  if (value === today) return 'Today';
  const date = parseIsoDate(value);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}

/** "Today", "Tomorrow", then the weekday name. */
export function relativeDayName(value: string, today: string): string {
  const diff = daysBetween(today, value);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return weekdayLong(value);
}

/** "2pm", "5:34pm", "midnight" */
function formatClock(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (hours === 0 && minutes === 0) return 'midnight';
  if (hours === 12 && minutes === 0) return 'midday';
  const suffix = hours < 12 ? 'am' : 'pm';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${hour12}${suffix}` : `${hour12}:${String(minutes).padStart(2, '0')}${suffix}`;
}

/** "5:34pm today", "2pm tomorrow", "2pm Fri" */
export function formatCutOffLabel(cutOffAt: Date, now: Date): string {
  const clock = formatClock(cutOffAt);
  const diff = daysBetween(isoDate(now), isoDate(cutOffAt));
  if (clock === 'midnight' && diff === 1) return 'midnight tonight';
  if (diff === 0) return `${clock} today`;
  if (diff === 1) return `${clock} tomorrow`;
  if (diff === -1) return `${clock} yesterday`;
  return `${clock} ${WEEKDAYS[cutOffAt.getDay()]}`;
}

export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

const URGENT_MS = 4 * 60 * 60 * 1000;

export type CutOffUrgency = 'passed' | 'urgent' | 'normal';

export function cutOffUrgency(cutOffAt: Date, now: Date): CutOffUrgency {
  const diff = cutOffAt.getTime() - now.getTime();
  if (diff <= 0) return 'passed';
  if (diff <= URGENT_MS) return 'urgent';
  return 'normal';
}

/** "£ 140.60", "£ 47", "CA$ 392". Whole amounts drop the pence. */
export function formatMoney(amount: number, currency: CurrencyCode = BASE_CURRENCY): string {
  const rounded = Math.round(amount * 100) / 100;
  const whole = Number.isInteger(rounded);
  const figure = rounded.toLocaleString('en-GB', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol(currency)} ${figure}`;
}

/** Rounded to whole pounds, for the forecast tiles: "£ 690". */
export function formatMoneyRounded(amount: number): string {
  return `£ ${Math.round(amount).toLocaleString('en-GB')}`;
}

/** Supplier-currency amount with the base equivalent for foreign suppliers. */
export function formatSupplierMoney(amount: number, currency: CurrencyCode): string {
  if (currency === BASE_CURRENCY) return formatMoney(amount);
  return `${formatMoney(amount, currency)} (${formatMoney(convert(amount, currency, BASE_CURRENCY))})`;
}

export function toBase(amount: number, currency: CurrencyCode): number {
  return convert(amount, currency, BASE_CURRENCY);
}

/** Trim to at most one decimal place: 0.6, 12.5, 4. */
export function trimNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** "−12%" with a true minus sign. */
export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}%`;
  if (rounded < 0) return `\u2212${Math.abs(rounded)}%`;
  return '0%';
}
