/**
 * Shared formatters for the Activity surface. Keeps the diff /
 * blast-radius renderers from reinventing the same "render a £
 * value" / "render a percentage delta" plumbing.
 */

export function formatScalar(
  value: unknown,
  opts: { unit?: string; kind?: 'number' | 'currency' | 'text' | 'boolean' | 'array' } = {},
): string {
  if (value === null || value === undefined) return '—';
  if (opts.kind === 'boolean' || typeof value === 'boolean') {
    return value ? 'On' : 'Off';
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (opts.kind === 'currency') {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) return String(value);
    return `£${n.toFixed(2)}`;
  }
  if (opts.kind === 'number') {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) return String(value);
    // Strip trailing zeros for readability (4.0 → "4", 4.5 → "4.5").
    const rounded = +n.toFixed(2);
    return opts.unit ? `${rounded}\u202F${opts.unit}` : String(rounded);
  }
  if (typeof value === 'string') {
    return opts.unit ? `${value}\u202F${opts.unit}` : value;
  }
  return String(value);
}

export function formatDelta(
  before: number,
  after: number,
  opts: { unit?: string } = {},
): { label: string; positive: boolean; zero: boolean } {
  const delta = +(after - before).toFixed(2);
  const positive = delta > 0;
  const zero = Math.abs(delta) < 0.005;
  const sign = positive ? '+' : delta < 0 ? '−' : '';
  const magnitude = Math.abs(delta);
  const display = `${sign}${magnitude}${opts.unit ? `\u202F${opts.unit}` : ''}`;
  return { label: zero ? '—' : display, positive, zero };
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Coarse-grained day bucket used by the Activity page header to group
 *  rows under day separators (Today / Yesterday / 26 May). */
export function dayBucketLabel(ts: number, now: number = Date.now()): string {
  const start = (n: number) => {
    const d = new Date(n);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const dayMs = 24 * 60 * 60 * 1000;
  const startToday = start(now);
  const startTs = start(ts);
  if (startTs === startToday) return 'Today';
  if (startTs === startToday - dayMs) return 'Yesterday';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(ts));
}
