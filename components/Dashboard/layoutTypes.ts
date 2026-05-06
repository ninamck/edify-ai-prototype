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
  // Pilot dashboard half-width defaults
  'net-sales-yesterday',
  'top-sellers-yesterday',
  'discounts-voids-refunds',
  'waste-top5-yesterday',
  'gross-margin-products',
  'ingredient-price-changes',
]);

/**
 * Charts whose shape doesn't benefit from going full-width — a pie chart at
 * full width leaves a lot of empty card space. These are locked to half.
 */
const HALF_ONLY_CHART_IDS: Set<AnalyticsChartId> = new Set([
  'eatin',
  'waste-kpi',
  'labour-day-radial',
  // KPI tile is too sparse at full width.
  'net-sales-yesterday',
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

/**
 * Default layout for the Pilot persona. The user picked these 9 questions
 * during the dashboard personalisation flow, so they auto-pin when the Pilot
 * role is selected. Half/full widths follow the per-chart defaults — small
 * KPIs and top-N bar charts go half-width, anything time-series or list-
 * shaped goes full width.
 */
export const PILOT_DEFAULT_LAYOUT: DashboardLayoutEntry[] = [
  { id: pinnedId('net-sales-yesterday'),     visible: true, width: 'half' },
  { id: pinnedId('top-sellers-yesterday'),   visible: true, width: 'half' },
  { id: pinnedId('hourly-sales-labour'),     visible: true, width: 'full' },
  { id: pinnedId('discounts-voids-refunds'), visible: true, width: 'half' },
  { id: pinnedId('waste-top5-yesterday'),    visible: true, width: 'half' },
  { id: pinnedId('deliveries-by-supplier'),  visible: true, width: 'full' },
  { id: pinnedId('delivery-issues'),         visible: true, width: 'full' },
  { id: pinnedId('gross-margin-products'),   visible: true, width: 'half' },
  { id: pinnedId('ingredient-price-changes'),visible: true, width: 'half' },
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
