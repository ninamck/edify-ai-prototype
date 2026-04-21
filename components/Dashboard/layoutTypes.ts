import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';

export type WidgetWidth = 'full' | 'half';

export interface DashboardLayoutEntry {
  id: string;
  visible: boolean;
  /** Controls how many grid columns the widget spans. Defaults to 'full' for older entries. */
  width?: WidgetWidth;
}

export const PINNED_PREFIX = 'pinned:';

export function pinnedId(chartId: AnalyticsChartId): string {
  return `${PINNED_PREFIX}${chartId}`;
}

export function isPinnedId(id: string): id is `pinned:${AnalyticsChartId}` {
  return id.startsWith(PINNED_PREFIX);
}

export function pinnedChartIdOf(id: string): AnalyticsChartId | null {
  return isPinnedId(id) ? (id.slice(PINNED_PREFIX.length) as AnalyticsChartId) : null;
}

/** Charts that are small enough to look good at half width. */
const HALF_WIDTH_CHART_IDS: Set<AnalyticsChartId> = new Set([
  'eatin',
  'waste-kpi',
  'labour',
  'labour-pct',
  'growth',
  'sales',
  'hour',
  'cogs',
  'daypart',
  'labour-day-radial',
  'lfl',
  'produced-sold',
  'labour-hours',
  'waste-category-treemap',
  'oos-pareto',
]);

/**
 * Charts whose shape doesn't benefit from going full-width — a pie chart at
 * full width leaves a lot of empty card space. These are locked to half.
 */
const HALF_ONLY_CHART_IDS: Set<AnalyticsChartId> = new Set([
  'eatin',
  'waste-kpi',
  'labour-day-radial',
]);

export function isHalfOnlyChart(chartId: AnalyticsChartId): boolean {
  return HALF_ONLY_CHART_IDS.has(chartId);
}

export function widthOf(entry: DashboardLayoutEntry): WidgetWidth {
  const pinned = pinnedChartIdOf(entry.id);
  if (pinned && isHalfOnlyChart(pinned)) return 'half';
  return entry.width ?? 'full';
}

/** Default width for a newly pinned chart. Charts with dense data (heatmap, trend, etc.) stay full. */
export function defaultWidthForChart(chartId: AnalyticsChartId): WidgetWidth {
  return HALF_WIDTH_CHART_IDS.has(chartId) ? 'half' : 'full';
}

export const MANAGER_DEFAULT_LAYOUT: DashboardLayoutEntry[] = [
  { id: 'shift-kpi', visible: true, width: 'full' },
  { id: 'hourly-combo', visible: true, width: 'full' },
  { id: 'weather', visible: true, width: 'full' },
  { id: 'checklist-compliance', visible: true, width: 'full' },
  { id: 'waste', visible: true, width: 'half' },
  { id: 'deliveries', visible: true, width: 'half' },
];

export const ESTATE_DEFAULT_LAYOUT: DashboardLayoutEntry[] = [
  { id: 'date-filter', visible: true, width: 'full' },
  { id: 'kpi-grid', visible: true, width: 'full' },
  { id: 'sales-trend', visible: true, width: 'full' },
  { id: 'checklist-compliance', visible: true, width: 'full' },
  { id: 'site-gp', visible: true, width: 'half' },
  { id: 'wastage', visible: true, width: 'half' },
  { id: 'cogs-variance', visible: true, width: 'half' },
  { id: 'labour-vs-sales', visible: true, width: 'half' },
];
