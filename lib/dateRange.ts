/**
 * Canonical date-range model.
 *
 * Everything time-related in the product resolves through here: the global
 * picker, dashboard cadences, chart windows and scheduled reports. Before
 * this module a range was either prose welded into a chart title
 * ("Revenue trend — last 12 weeks") or a symbolic token nobody resolved.
 *
 * Two ideas carry the whole model:
 *
 *   1. A range is a *token*, not a pair of dates. `{ kind: 'last_week' }`
 *      re-resolves against today every time it is read, which is what makes
 *      a dashboard auto-refreshing. Only `custom` carries absolute dates,
 *      and that is precisely what makes it a frozen snapshot.
 *
 *   2. Resolution is pure and anchored. `resolveDateRange` takes the "today"
 *      it should resolve against, so demos, tests and boundary-crossing
 *      previews all work without mutating the clock.
 *
 * The business runs on a 4-week trading calendar, not calendar months, so
 * periods are first-class here rather than bolted on.
 */

// ── Primitives ──────────────────────────────────────────────────────────────

/** Natural x-axis bucket for a range. Ordered coarsest-last. */
export type Grain = 'hour' | 'day' | 'week' | 'period' | 'month';

export const GRAIN_ORDER: Grain[] = ['hour', 'day', 'week', 'period', 'month'];

/** Tokens that need no parameters, so they can be offered as plain presets. */
export type SimpleRangeKind =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_period'
  | 'last_period'
  | 'last_4_weeks'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year';

/**
 * Rolling windows of arbitrary length. Not offered in the preset list — they
 * exist so a chart can state its own native window ("last 12 weeks") as a
 * token that still re-resolves, rather than as frozen dates.
 */
export type ParametricRangeKind = 'last_n_days' | 'last_n_weeks';

export type DateRangeKind = SimpleRangeKind | ParametricRangeKind | 'custom';

export type DateRange =
  | { kind: SimpleRangeKind }
  | { kind: 'last_n_days'; n: number }
  | { kind: 'last_n_weeks'; n: number }
  | { kind: 'custom'; start: string; end: string };

/**
 * How a resolved range should be kept up to date.
 *
 *   live     — the window includes today, so figures are still accruing.
 *   boundary — closed relative window. It cannot change until the next
 *              boundary rolls, so polling it is pure waste.
 *   static   — absolute dates. Never re-resolves.
 */
export type RefreshPolicy =
  | { mode: 'live'; rollsAt: Grain }
  | { mode: 'boundary'; rollsAt: Grain }
  | { mode: 'static' };

/**
 * Hospitality figures restate: voids, comps and late transactions settle for
 * a few days after trade. A window whose end falls inside that tail is
 * provisional, and tiles should say so rather than implying a final number.
 */
export type Settlement = 'provisional' | 'settled';

export type ResolvedRange = {
  /** Inclusive ISO yyyy-mm-dd bounds. */
  start: string;
  end: string;
  /** Natural bucket for charting this span. */
  grain: Grain;
  /** How many `grain` buckets the span covers. */
  buckets: number;
  /** Relative phrase, e.g. "Last week". Absolute for custom ranges. */
  label: string;
  /** Always the concrete dates, e.g. "13–19 Jul". */
  absoluteLabel: string;
  /** True when the window includes today and is therefore still accruing. */
  openEnded: boolean;
  refresh: RefreshPolicy;
  settlement: Settlement;
};

// ── Configuration ───────────────────────────────────────────────────────────

/** Monday. The codebase's calendars are all Monday-first; so is the trade week. */
export const WEEK_STARTS_ON_MONDAY = true;

const PERIOD_LENGTH_DAYS = 28;
const PERIODS_PER_YEAR = 13;

/**
 * Trading-calendar anchor. P7 of FY2026 closed Sunday 19 Jul 2026, which is
 * the same close `Templates/TemplatesDashboard.tsx` mocks. Every other period
 * is derived from here as a 28-day block, so the calendar never needs a table.
 *
 * A real 13-period calendar inserts a 53rd week every five or six years to
 * stay aligned with the solar year; this derives a clean 364-day year, which
 * is accurate across the demo window but would drift over a decade.
 */
const PERIOD_ANCHOR_END = '2026-07-19';
const PERIOD_ANCHOR_NUMBER = 7;
const PERIOD_ANCHOR_FY = 2026;

/** Days after trade during which figures may still be restated. */
const RESTATEMENT_DAYS = 3;

// ── Date helpers (UTC, ISO yyyy-mm-dd) ──────────────────────────────────────

export function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  return toIso(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days)),
  );
}

export function addMonths(iso: string, months: number): string {
  const d = parseIso(iso);
  return toIso(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate())),
  );
}

export function compareIso(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

export function daysBetween(from: string, to: string): number {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / ms);
}

/** Inclusive day count, so a single day is 1 rather than 0. */
export function dayCount(start: string, end: string): number {
  return Math.max(1, daysBetween(start, end) + 1);
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const d = parseIso(iso);
  const shift = (d.getUTCDay() + 6) % 7; // Mon = 0
  return addDays(iso, -shift);
}

export function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6);
}

export function startOfMonth(iso: string): string {
  const d = parseIso(iso);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

export function endOfMonth(iso: string): string {
  const d = parseIso(iso);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

export function startOfYear(iso: string): string {
  return `${parseIso(iso).getUTCFullYear()}-01-01`;
}

export function endOfYear(iso: string): string {
  return `${parseIso(iso).getUTCFullYear()}-12-31`;
}

/** Today as an ISO day, in UTC terms. */
export function todayIso(): string {
  const now = new Date();
  return toIso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

// ── Trading calendar ────────────────────────────────────────────────────────

export type TradingPeriod = {
  fiscalYear: number;
  /** 1–13. */
  number: number;
  start: string;
  end: string;
  /** "P8" */
  code: string;
  /** "P8 · 20 Jul – 16 Aug" */
  label: string;
};

/** First day of the fiscal year containing the anchor period. */
const FY_ANCHOR_START = addDays(
  addDays(PERIOD_ANCHOR_END, -(PERIOD_LENGTH_DAYS - 1)),
  -(PERIOD_ANCHOR_NUMBER - 1) * PERIOD_LENGTH_DAYS,
);

/** Positive modulo — `%` alone returns negatives for dates before the anchor. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** The trading period containing `iso`. */
export function tradingPeriodFor(iso: string): TradingPeriod {
  const index = Math.floor(daysBetween(FY_ANCHOR_START, iso) / PERIOD_LENGTH_DAYS);
  return tradingPeriodByIndex(index);
}

/** Period `n` blocks from the fiscal-year anchor; negative reaches backwards. */
export function tradingPeriodByIndex(index: number): TradingPeriod {
  const start = addDays(FY_ANCHOR_START, index * PERIOD_LENGTH_DAYS);
  const end = addDays(start, PERIOD_LENGTH_DAYS - 1);
  const number = mod(index, PERIODS_PER_YEAR) + 1;
  const fiscalYear = PERIOD_ANCHOR_FY + Math.floor(index / PERIODS_PER_YEAR);
  const code = `P${number}`;
  return {
    fiscalYear,
    number,
    start,
    end,
    code,
    label: `${code} · ${formatRange(start, end)}`,
  };
}

export function tradingPeriodIndexFor(iso: string): number {
  return Math.floor(daysBetween(FY_ANCHOR_START, iso) / PERIOD_LENGTH_DAYS);
}

// ── Resolution ──────────────────────────────────────────────────────────────

export type ResolveOptions = {
  /** The "today" to resolve against. Defaults to the real current day. */
  anchor?: string;
};

/**
 * Turn a range token into concrete dates plus everything derived from them.
 * Pure: same token and anchor always give the same answer.
 */
export function resolveDateRange(
  range: DateRange,
  opts: ResolveOptions = {},
): ResolvedRange {
  const anchor = opts.anchor ?? todayIso();
  const { start, end, label, rollsAt } = bounds(range, anchor);

  const openEnded = compareIso(end, anchor) >= 0;
  const grain = naturalGrain(start, end);
  const buckets = bucketCount(start, end, grain);

  const refresh: RefreshPolicy =
    range.kind === 'custom'
      ? { mode: 'static' }
      : openEnded
        ? { mode: 'live', rollsAt }
        : { mode: 'boundary', rollsAt };

  // Provisional while any day in the window is still inside the restatement
  // tail. A closed trading period is settled regardless, since the close is
  // the point at which figures are finalised.
  const settledBefore = addDays(anchor, -RESTATEMENT_DAYS);
  const settlement: Settlement =
    compareIso(end, settledBefore) < 0 ? 'settled' : 'provisional';

  return {
    start,
    end,
    grain,
    buckets,
    label,
    absoluteLabel: formatRange(start, end),
    openEnded,
    refresh,
    settlement,
  };
}

type Bounds = { start: string; end: string; label: string; rollsAt: Grain };

function bounds(range: DateRange, anchor: string): Bounds {
  switch (range.kind) {
    case 'today':
      return { start: anchor, end: anchor, label: 'Today', rollsAt: 'day' };

    case 'yesterday': {
      const d = addDays(anchor, -1);
      return { start: d, end: d, label: 'Yesterday', rollsAt: 'day' };
    }

    case 'this_week':
      return {
        start: startOfWeek(anchor),
        end: endOfWeek(anchor),
        label: 'This week',
        rollsAt: 'week',
      };

    case 'last_week': {
      const start = addDays(startOfWeek(anchor), -7);
      return { start, end: addDays(start, 6), label: 'Last week', rollsAt: 'week' };
    }

    case 'this_period': {
      const p = tradingPeriodFor(anchor);
      return {
        start: p.start,
        end: p.end,
        label: `This period (${p.code})`,
        rollsAt: 'period',
      };
    }

    case 'last_period': {
      const p = tradingPeriodByIndex(tradingPeriodIndexFor(anchor) - 1);
      return {
        start: p.start,
        end: p.end,
        label: `Last period (${p.code})`,
        rollsAt: 'period',
      };
    }

    case 'last_4_weeks': {
      // Rolling, and deliberately distinct from `this_period`: four complete
      // weeks ending last Sunday. Conflating the two is a classic reporting
      // error, so they never share bounds.
      const end = addDays(startOfWeek(anchor), -1);
      return {
        start: addDays(end, -27),
        end,
        label: 'Last 4 weeks',
        rollsAt: 'week',
      };
    }

    case 'this_month':
      return {
        start: startOfMonth(anchor),
        end: endOfMonth(anchor),
        label: 'This month',
        rollsAt: 'month',
      };

    case 'last_month': {
      const inPrev = addMonths(startOfMonth(anchor), -1);
      return {
        start: startOfMonth(inPrev),
        end: endOfMonth(inPrev),
        label: 'Last month',
        rollsAt: 'month',
      };
    }

    case 'this_year':
      return {
        start: startOfYear(anchor),
        end: endOfYear(anchor),
        label: 'This year',
        rollsAt: 'month',
      };

    case 'last_year': {
      const y = parseIso(anchor).getUTCFullYear() - 1;
      return {
        start: `${y}-01-01`,
        end: `${y}-12-31`,
        label: 'Last year',
        rollsAt: 'month',
      };
    }

    case 'last_n_days': {
      // Ends yesterday: a rolling window that included today would move
      // under the reader every hour.
      const end = addDays(anchor, -1);
      return {
        start: addDays(end, -(Math.max(1, range.n) - 1)),
        end,
        label: `Last ${range.n} days`,
        rollsAt: 'day',
      };
    }

    case 'last_n_weeks': {
      const end = addDays(startOfWeek(anchor), -1);
      return {
        start: addDays(end, -(Math.max(1, range.n) * 7 - 1)),
        end,
        label: `Last ${range.n} weeks`,
        rollsAt: 'week',
      };
    }

    case 'custom': {
      const [start, end] =
        compareIso(range.start, range.end) <= 0
          ? [range.start, range.end]
          : [range.end, range.start];
      return { start, end, label: formatRange(start, end), rollsAt: 'day' };
    }
  }

  // Unreachable for a well-typed token, but range tokens get persisted onto
  // dashboards and localStorage outlives deployments. An unrecognised token
  // from an older build should degrade to a sensible window rather than
  // throw and take the whole shell down.
  return bounds(FALLBACK_RANGE, anchor);
}

const FALLBACK_RANGE: DateRange = { kind: 'this_week' };

const SIMPLE_KINDS = new Set<string>([
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_period',
  'last_period',
  'last_4_weeks',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
]);

/**
 * Coerce loosely-typed input (persisted JSON, URL params) into a valid range.
 * Use at every hydration boundary.
 */
export function normaliseRange(input: unknown): DateRange {
  if (!input || typeof input !== 'object') return FALLBACK_RANGE;
  const kind = (input as { kind?: unknown }).kind;
  if (typeof kind !== 'string') return FALLBACK_RANGE;

  if (SIMPLE_KINDS.has(kind)) return { kind: kind as SimpleRangeKind };

  if (kind === 'custom') {
    const { start, end } = input as { start?: unknown; end?: unknown };
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (typeof start !== 'string' || !iso.test(start)) return FALLBACK_RANGE;
    if (typeof end !== 'string' || !iso.test(end)) return FALLBACK_RANGE;
    return { kind: 'custom', start, end };
  }

  if (kind === 'last_n_days' || kind === 'last_n_weeks') {
    const n = (input as { n?: unknown }).n;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 1) return FALLBACK_RANGE;
    return { kind, n: Math.floor(n) };
  }

  return FALLBACK_RANGE;
}

// ── Grain ───────────────────────────────────────────────────────────────────

/**
 * The bucket a span is naturally charted in. A single day is read by hour;
 * a fortnight by day; a quarter by week; a year by period.
 */
export function naturalGrain(start: string, end: string): Grain {
  const days = dayCount(start, end);
  if (days <= 1) return 'hour';
  if (days <= 14) return 'day';
  if (days <= 13 * 7) return 'week';
  return 'period';
}

export function bucketCount(start: string, end: string, grain: Grain): number {
  const days = dayCount(start, end);
  switch (grain) {
    case 'hour':
      return days * 24;
    case 'day':
      return days;
    case 'week':
      return Math.max(1, Math.ceil(days / 7));
    case 'period':
      return Math.max(1, Math.ceil(days / PERIOD_LENGTH_DAYS));
    case 'month':
      return Math.max(1, Math.round(days / 30.44));
  }
}

/** Days spanned by one bucket of `grain`. Used to widen a range to a minimum. */
export function grainLengthDays(grain: Grain): number {
  switch (grain) {
    case 'hour':
      return 1;
    case 'day':
      return 1;
    case 'week':
      return 7;
    case 'period':
      return PERIOD_LENGTH_DAYS;
    case 'month':
      return 30;
  }
}

// ── Comparison periods ──────────────────────────────────────────────────────

export type ComparisonKind = 'none' | 'prior' | 'same_last_year';

export type ResolvedComparison = {
  start: string;
  end: string;
  /** "vs prior week" */
  label: string;
};

/**
 * The comparison a range implies. A week compares to the week before, a
 * period to the period before. Seasonality matters in hospitality, so
 * "same span last year" is always available as an override.
 */
export function defaultComparison(range: DateRange): ComparisonKind {
  return range.kind === 'custom' ? 'none' : 'prior';
}

export function resolveComparison(
  resolved: ResolvedRange,
  kind: ComparisonKind,
  range?: DateRange,
): ResolvedComparison | null {
  if (kind === 'none') return null;

  if (kind === 'same_last_year') {
    // 364 days rather than a calendar year, so the comparison lands on the
    // same weekdays. Trading comparisons are worthless if a Saturday is
    // measured against a Tuesday.
    return {
      start: addDays(resolved.start, -364),
      end: addDays(resolved.end, -364),
      label: `vs same ${priorNoun(range, resolved)} last year`,
    };
  }

  const span = dayCount(resolved.start, resolved.end);
  const end = addDays(resolved.start, -1);
  return {
    start: addDays(end, -(span - 1)),
    end,
    label: `vs prior ${priorNoun(range, resolved)}`,
  };
}

function priorNoun(range: DateRange | undefined, resolved: ResolvedRange): string {
  switch (range?.kind) {
    case 'today':
    case 'yesterday':
      return 'day';
    case 'this_week':
    case 'last_week':
      return 'week';
    case 'this_period':
    case 'last_period':
      return 'period';
    case 'this_month':
    case 'last_month':
      return 'month';
    case 'this_year':
    case 'last_year':
      return 'year';
    case 'last_n_weeks':
      return `${range.n} weeks`;
    case 'last_n_days':
      return `${range.n} days`;
    default:
      return `${dayCount(resolved.start, resolved.end)} days`;
  }
}

// ── Formatting ──────────────────────────────────────────────────────────────

export function formatDay(iso: string): string {
  return parseIso(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** "13–19 Jul", "28 Jun – 5 Jul", "19 Jul 2025 – 3 Jan 2026". */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDay(start);
  const s = parseIso(start);
  const e = parseIso(end);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();

  if (sameYear && s.getUTCMonth() === e.getUTCMonth()) {
    const month = e.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
    return `${s.getUTCDate()}–${e.getUTCDate()} ${month}`;
  }
  if (sameYear) return `${formatDay(start)} – ${formatDay(end)}`;

  const withYear = (d: Date) =>
    d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  return `${withYear(s)} – ${withYear(e)}`;
}

// ── Presets ─────────────────────────────────────────────────────────────────

export type PresetGroup = {
  heading: string;
  options: { kind: SimpleRangeKind; label: string }[];
};

/**
 * Trading-period-first, because the business closes on 4-week periods rather
 * than calendar months. Calendar ranges stay available in a second group for
 * anyone reconciling against a statutory month.
 */
export const PRESET_GROUPS: PresetGroup[] = [
  {
    heading: 'Recent',
    options: [
      { kind: 'today', label: 'Today' },
      { kind: 'yesterday', label: 'Yesterday' },
      { kind: 'this_week', label: 'This week' },
      { kind: 'last_week', label: 'Last week' },
    ],
  },
  {
    heading: 'Trading periods',
    options: [
      { kind: 'this_period', label: 'This period' },
      { kind: 'last_period', label: 'Last period' },
      { kind: 'last_4_weeks', label: 'Last 4 weeks' },
    ],
  },
  {
    heading: 'Calendar',
    options: [
      { kind: 'this_month', label: 'This month' },
      { kind: 'last_month', label: 'Last month' },
      { kind: 'this_year', label: 'This year' },
      { kind: 'last_year', label: 'Last year' },
    ],
  },
];

export function rangesEqual(a: DateRange, b: DateRange): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'custom' && b.kind === 'custom') {
    return a.start === b.start && a.end === b.end;
  }
  if ('n' in a && 'n' in b) return a.n === b.n;
  return true;
}
