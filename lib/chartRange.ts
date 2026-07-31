/**
 * Chart range capability + tile binding.
 *
 * Ask Edify builds a chart against whatever window the question implied
 * ("what were sales last week?"). Dashboards carry a window of their own.
 * This module decides what happens when the two disagree.
 *
 * The load-bearing idea is that charts are not interchangeable under a
 * range change. They fall into three kinds:
 *
 *   polymorphic — the range is a filter. "Total sales by site" is happy over
 *                 a day, a week or a period, so it inherits the dashboard's
 *                 window.
 *   defining    — the range *is* the chart. "Revenue trend — last 12 weeks"
 *                 or "This week v same week last year" carry a span, and
 *                 often a comparison, as part of their meaning. Re-cutting
 *                 them to "yesterday" produces a single bar and a lie, so
 *                 they keep their native window and say so.
 *   static      — no window applies at all. "Delivery issues · open" is a
 *                 current-state list, not a measurement of a period.
 *
 * Polymorphic charts still can't take *any* range: a day-of-week radial
 * needs seven days, an hour-of-day profile needs a full day. Each chart
 * declares the fewest buckets at which it still says something, and
 * inheritance widens to that floor rather than rendering nonsense — with a
 * visible note, because a tile quietly showing a different window from the
 * dashboard header is worse than one that admits it.
 */

import {
  addDays,
  bucketCount,
  dayCount,
  grainLengthDays,
  resolveDateRange,
  type DateRange,
  type Grain,
  type ResolvedRange,
} from '@/lib/dateRange';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';

// ── Capability ──────────────────────────────────────────────────────────────

export type RangeBehaviour = 'polymorphic' | 'defining' | 'static';

export type ChartCapability = {
  /** The title with the time window stripped out. */
  metric: string;
  /** Bucket the chart plots along its time axis. */
  grain: Grain;
  /** Fewest `grain` buckets at which the chart still means something. */
  minBuckets: number;
  behaviour: RangeBehaviour;
  /** The window the chart was authored against. */
  nativeRange: DateRange;
};

const day = (metric: string, nativeRange: DateRange): ChartCapability => ({
  metric,
  grain: 'day',
  minBuckets: 1,
  behaviour: 'polymorphic',
  nativeRange,
});

/**
 * Not every chart id needs an entry — anything missing falls back to a
 * permissive default, so the Dunkin CSV charts and any future ids keep
 * working untouched.
 */
export const CHART_CAPABILITY: Partial<Record<AnalyticsChartId, ChartCapability>> = {
  // ── Sales ────────────────────────────────────────────────────────────────
  sales: day('Total sales by site', { kind: 'last_week' }),
  'sales-by-day': {
    metric: 'Total sales by day',
    grain: 'day',
    minBuckets: 7,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'last_week' },
  },
  hour: {
    metric: 'Revenue by hour · weekday average',
    grain: 'hour',
    minBuckets: 24,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'last_4_weeks' },
  },
  trend: {
    metric: 'Revenue trend',
    grain: 'week',
    minBuckets: 6,
    behaviour: 'defining',
    nativeRange: { kind: 'last_n_weeks', n: 12 },
  },
  growth: {
    metric: 'Month-on-month growth by site',
    grain: 'month',
    minBuckets: 2,
    behaviour: 'defining',
    nativeRange: { kind: 'this_month' },
  },
  lfl: {
    // The window belongs in the derived suffix, never in the metric, or the
    // title states it twice.
    metric: 'Like-for-like revenue v last year',
    grain: 'day',
    minBuckets: 7,
    behaviour: 'defining',
    nativeRange: { kind: 'this_week' },
  },
  eatin: day('Sales split · eat-in v takeaway v delivery', { kind: 'this_week' }),
  daypart: day('Revenue by daypart · per site', { kind: 'this_week' }),
  'net-sales-yesterday': day('Net sales', { kind: 'yesterday' }),
  'top-sellers-yesterday': day('Top selling items', { kind: 'yesterday' }),
  'discounts-voids-refunds': day('Discounts, voids & refunds', { kind: 'yesterday' }),
  'gross-margin-products': day('Highest gross margin products', { kind: 'yesterday' }),

  // ── Labour ───────────────────────────────────────────────────────────────
  labour: day('Revenue per labour hour by site', { kind: 'this_week' }),
  'labour-hours': day('Actual vs scheduled labour hours', { kind: 'this_week' }),
  'labour-pct': {
    metric: 'Labour % of sales · vs target',
    grain: 'day',
    minBuckets: 7,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'this_month' },
  },
  'labour-day-radial': {
    metric: 'Labour cost % by day of week',
    grain: 'day',
    minBuckets: 7,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'last_4_weeks' },
  },
  'hourly-sales-labour': {
    metric: 'Sales by hour · vs labour',
    grain: 'hour',
    minBuckets: 24,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'yesterday' },
  },

  // ── Cost of goods ────────────────────────────────────────────────────────
  cogs: {
    metric: 'COGS variance vs budget by site',
    grain: 'week',
    minBuckets: 4,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'last_n_weeks', n: 8 },
  },
  'cogs-pct': {
    metric: 'COGS % of revenue · by site',
    grain: 'day',
    minBuckets: 7,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'this_month' },
  },
  'cogs-top-ingredients': {
    metric: 'Top 5 ingredients by cost',
    grain: 'day',
    minBuckets: 7,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'this_month' },
  },
  'low-gross-margin-items': {
    metric: 'Lowest gross margin menu items',
    grain: 'day',
    minBuckets: 7,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'this_month' },
  },
  'ingredient-price-changes': {
    metric: 'Top ingredient price changes',
    grain: 'month',
    minBuckets: 2,
    behaviour: 'defining',
    nativeRange: { kind: 'this_month' },
  },

  // ── Waste ────────────────────────────────────────────────────────────────
  'waste-kpi': day('Total waste · estate', { kind: 'this_week' }),
  'waste-top5-yesterday': day('Top 5 wasted items', { kind: 'yesterday' }),
  'waste-category-treemap': day('Waste by category · nested', { kind: 'this_week' }),
  'waste-top10': {
    metric: 'Top 10 most wasted items · network',
    grain: 'day',
    minBuckets: 7,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'last_n_days', n: 30 },
  },
  'waste-heatmap': {
    metric: 'Waste heatmap · day × hour',
    grain: 'week',
    minBuckets: 2,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'last_4_weeks' },
  },
  'waste-trend-stacked': {
    metric: 'Waste trend by reason',
    grain: 'week',
    minBuckets: 6,
    behaviour: 'defining',
    nativeRange: { kind: 'last_n_weeks', n: 12 },
  },

  // ── Production & availability ────────────────────────────────────────────
  'produced-sold': day('Produced v sold', { kind: 'yesterday' }),
  'oos-pareto': {
    metric: 'Out-of-stock Pareto · items driving stockouts',
    grain: 'day',
    minBuckets: 7,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'last_n_days', n: 30 },
  },
  'prod-avail-scatter': {
    metric: 'Production adherence × availability failures',
    grain: 'day',
    minBuckets: 7,
    behaviour: 'polymorphic',
    nativeRange: { kind: 'last_n_days', n: 30 },
  },

  // ── Suppliers ────────────────────────────────────────────────────────────
  'deliveries-by-supplier': {
    // Plots the day alongside week-to-date, so both windows are intrinsic and
    // neither can be swapped for the dashboard's.
    metric: 'Deliveries by supplier',
    grain: 'day',
    minBuckets: 1,
    behaviour: 'defining',
    nativeRange: { kind: 'yesterday' },
  },
  'delivery-issues': {
    metric: 'Delivery issues · open',
    grain: 'day',
    minBuckets: 1,
    behaviour: 'static',
    nativeRange: { kind: 'yesterday' },
  },
};

const DEFAULT_CAPABILITY: ChartCapability = {
  metric: '',
  grain: 'day',
  minBuckets: 1,
  behaviour: 'polymorphic',
  nativeRange: { kind: 'this_week' },
};

export function capabilityFor(chartId: string): ChartCapability {
  return CHART_CAPABILITY[chartId as AnalyticsChartId] ?? DEFAULT_CAPABILITY;
}

// ── Binding ─────────────────────────────────────────────────────────────────

/**
 * How one placement of a chart gets its window.
 *
 *   inherit — follows the dashboard, clamped to what the chart can take.
 *   fixed   — frozen absolute dates. Deliberately out of step; a snapshot.
 *   own     — its own rolling token, independent of the dashboard.
 */
export type RangeBinding =
  | { mode: 'inherit' }
  | { mode: 'fixed'; start: string; end: string }
  | { mode: 'own'; range: DateRange };

export const INHERIT: RangeBinding = { mode: 'inherit' };

export type TileAdjustment =
  | 'none'
  | 'widened'
  | 'defining'
  | 'static'
  | 'pinned'
  | 'own';

export type TileRange = {
  resolved: ResolvedRange;
  adjustment: TileAdjustment;
  /** Set whenever the tile's window differs from the dashboard's. */
  note: string | null;
};

/**
 * Work out the window a single tile should actually render.
 *
 * `dashboardRange` is undefined on surfaces that have no range of their own
 * (chat, for instance), in which case every chart falls back to its native
 * window.
 */
export function resolveTileRange({
  chartId,
  binding = INHERIT,
  dashboardRange,
  anchor,
}: {
  chartId: string;
  binding?: RangeBinding;
  dashboardRange?: DateRange;
  anchor?: string;
}): TileRange {
  const cap = capabilityFor(chartId);
  const opts = { anchor };

  if (binding.mode === 'fixed') {
    return {
      resolved: resolveDateRange(
        { kind: 'custom', start: binding.start, end: binding.end },
        opts,
      ),
      adjustment: 'pinned',
      note: 'Pinned to a fixed range — ignores the dashboard date.',
    };
  }

  if (binding.mode === 'own') {
    return {
      resolved: resolveDateRange(binding.range, opts),
      adjustment: 'own',
      note: 'Uses its own date range.',
    };
  }

  if (cap.behaviour === 'static') {
    return {
      resolved: resolveDateRange(cap.nativeRange, opts),
      adjustment: 'static',
      note: 'Shows current state — not filtered by the dashboard date.',
    };
  }

  // Nothing to inherit from: chat and other range-less surfaces.
  if (!dashboardRange) {
    return {
      resolved: resolveDateRange(cap.nativeRange, opts),
      adjustment: 'none',
      note: null,
    };
  }

  if (cap.behaviour === 'defining') {
    const resolved = resolveDateRange(cap.nativeRange, opts);
    return {
      resolved,
      adjustment: 'defining',
      note: `Always ${resolved.label.toLowerCase()} — the range is part of this chart.`,
    };
  }

  const target = resolveDateRange(dashboardRange, opts);
  const buckets = bucketCount(target.start, target.end, cap.grain);
  if (buckets >= cap.minBuckets) {
    return { resolved: target, adjustment: 'none', note: null };
  }

  // Too narrow to be readable — widen to the chart's floor, ending where the
  // dashboard's window ends so the two still line up at the right-hand edge.
  const needed = cap.minBuckets * grainLengthDays(cap.grain);
  const start = addDays(target.end, -(needed - 1));
  const widened = resolveDateRange({ kind: 'custom', start, end: target.end }, opts);

  return {
    resolved: {
      ...widened,
      // It still rolls with the dashboard, so it is not a static window
      // despite being expressed as concrete dates.
      refresh: target.refresh,
      label: `Last ${cap.minBuckets} ${pluralGrain(cap.grain, cap.minBuckets)}`,
    },
    adjustment: 'widened',
    note: `Needs at least ${cap.minBuckets} ${pluralGrain(
      cap.grain,
      cap.minBuckets,
    )} — showing a wider range than the dashboard.`,
  };
}

function pluralGrain(grain: Grain, n: number): string {
  return n === 1 ? grain : `${grain}s`;
}

// ── Naming ──────────────────────────────────────────────────────────────────

/**
 * Build a tile's title from its metric and its resolved window.
 *
 * The window only appears when it is worth saying. A tile that simply
 * inherits the dashboard's range needs no suffix — the dashboard header
 * already states it, and repeating "last week" across eight tiles is noise.
 * A tile that is *out of step* always says so, because that is exactly when
 * the reader would otherwise be misled.
 */
export function deriveTileTitle({
  chartId,
  tile,
  fallbackLabel,
  override,
  onDashboard = true,
}: {
  chartId: string;
  tile: TileRange;
  /** Used when the chart has no capability entry yet. */
  fallbackLabel?: string;
  /** A title the user typed. Always wins. */
  override?: string;
  /** False on surfaces with no range of their own, such as chat. */
  onDashboard?: boolean;
}): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;

  const cap = capabilityFor(chartId);
  const metric = cap.metric || fallbackLabel || 'Chart';

  switch (tile.adjustment) {
    case 'static':
      return metric;
    case 'pinned':
      return `${metric} · ${tile.resolved.absoluteLabel}`;
    case 'none':
      // On a dashboard the header carries the range; off it, spell it out.
      return onDashboard ? metric : `${metric} · ${tile.resolved.label.toLowerCase()}`;
    default:
      return `${metric} · ${tile.resolved.label.toLowerCase()}`;
  }
}

/** Whether a tile's window disagrees with the dashboard's, and so needs a badge. */
export function isOutOfStep(tile: TileRange): boolean {
  return tile.adjustment !== 'none';
}

// ── Refresh ─────────────────────────────────────────────────────────────────

export type RefreshPlan = {
  /** Poll interval in ms, or null when polling would be pointless. */
  pollMs: number | null;
  /** Plain-English cadence for the tile's tooltip. */
  description: string;
};

/**
 * Cadence is derived from the window rather than configured separately —
 * two knobs would only ever disagree.
 *
 * An open-ended window is still accruing, so it is worth re-reading. A
 * closed relative window cannot change until its boundary rolls, so polling
 * it burns requests for a guaranteed-identical answer. Absolute windows
 * never move at all, though they can still be restated while provisional.
 */
export function refreshPlan(resolved: ResolvedRange): RefreshPlan {
  const { refresh, settlement } = resolved;

  if (refresh.mode === 'live') {
    const pollMs = refresh.rollsAt === 'hour' || refresh.rollsAt === 'day'
      ? 5 * 60_000
      : 15 * 60_000;
    return {
      pollMs,
      description: 'Still trading — refreshes through the day.',
    };
  }

  if (refresh.mode === 'boundary') {
    return {
      pollMs: settlement === 'provisional' ? 30 * 60_000 : null,
      description:
        settlement === 'provisional'
          ? 'Closed, but figures may still be restated.'
          : `Fixed window — rolls at the next ${refresh.rollsAt}.`,
    };
  }

  return {
    pollMs: settlement === 'provisional' ? 30 * 60_000 : null,
    description:
      settlement === 'provisional'
        ? 'Snapshot — figures may still be restated.'
        : 'Snapshot — will not change.',
  };
}

/** "as at 14:32" — the vintage of the figures, which matters while provisional. */
export function vintageLabel(at: Date = new Date()): string {
  return `as at ${at.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export { dayCount };
