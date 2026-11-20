/** Units that mean "one of the thing", so "3 croissants" reads better
 *  than "3 units Croissants". */
const COUNT_UNITS = new Set(['units', 'unit', 'each', 'ea', 'portions', 'portion', 'pieces', 'piece']);

export function isCountUnit(unit: string): boolean {
  return COUNT_UNITS.has(unit.toLowerCase());
}

/** Round for people: no trailing zeros, at most 2 decimal places. */
export function fmtQty(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function itemPhrase(qty: number, unit: string, name: string): string {
  return isCountUnit(unit) ? `${fmtQty(qty)} ${name}` : `${fmtQty(qty)} ${unit} ${name}`;
}

/** The end of the trading day, when Waiting for you items expire. The
 *  prototype treats that as midnight; real sites close at different
 *  times, which is an open question in the handover. */
export function endOfTradingDay(now: Date): string {
  const d = new Date(now);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
}

export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoDay(dt);
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function dayLabel(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
