import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';

export interface DashboardLayoutEntry {
  id: string;
  visible: boolean;
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

export const MANAGER_DEFAULT_LAYOUT: DashboardLayoutEntry[] = [
  { id: 'shift-kpi', visible: true },
  { id: 'hourly-combo', visible: true },
  { id: 'weather', visible: true },
  { id: 'checklist-compliance', visible: true },
  { id: 'waste', visible: true },
  { id: 'deliveries', visible: true },
];

export const ESTATE_DEFAULT_LAYOUT: DashboardLayoutEntry[] = [
  { id: 'date-filter', visible: true },
  { id: 'kpi-grid', visible: true },
  { id: 'sales-trend', visible: true },
  { id: 'checklist-compliance', visible: true },
  { id: 'site-gp', visible: true },
  { id: 'wastage', visible: true },
  { id: 'cogs-variance', visible: true },
  { id: 'labour-vs-sales', visible: true },
];
