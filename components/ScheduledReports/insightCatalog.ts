/**
 * Catalogue of every insight a report can contain, grouped by the view
 * it lives on. Used by the schedule-report drawer so a report isn't
 * limited to the view it was opened from — a digest can mix the in-shift
 * dashboard, the estate view and any of the starter templates.
 *
 * Titles are literals (not imports from the view components) to keep
 * this file dependency-free: the views import TileActions, which imports
 * the drawer, which imports this catalogue.
 */

export type InsightGroup = {
  id: string;
  label: string;
  insights: string[];
};

export const INSIGHT_CATALOG: InsightGroup[] = [
  {
    id: 'shift',
    label: 'Dashboard · In shift',
    insights: [
      'Sales v staff v forecast · hour by hour',
      'Weather · now vs forecast',
      'Waste watch',
      'Deliveries',
      'Checklist compliance',
    ],
  },
  {
    id: 'estate',
    label: 'Dashboard · Estate',
    insights: [
      'Net sales — estate (£k / day)',
      'Gross profit % by site',
      'Wastage value by category',
      'COGS variance vs theoretical',
      'Labour vs sales — by site',
    ],
  },
  {
    id: 'daily',
    label: 'Templates · Daily',
    insights: [
      'Sales · yesterday',
      'GP% flash · yesterday',
      'Waste logged · yesterday',
      'Exceptions queue',
      'Anomaly flags',
    ],
  },
  {
    id: 'weekly',
    label: 'Templates · Weekly flash',
    insights: [
      'Site league · sales and GP',
      'Waste as % of sales · by site',
      'Purchasing spend as % of sales · by site',
      'Spend vs trailing 4-week average',
      'Top 5 price movers',
      'Compliance strip',
    ],
  },
  {
    id: 'period',
    label: 'Templates · Period end',
    insights: [
      'GP bridge · theoretical to actual',
      'Data confidence',
      'COGS variance · site × category',
      'Menu profitability · margin vs volume',
      'Stock holding · value and days of cover',
      'Dead and slow-moving stock',
      'Supplier inflation impact',
      'CPU transfer reconciliation',
      'Trend · four periods',
    ],
  },
];

/** Site scopes a report can render for. Matches the estate mock data. */
export const SITE_OPTIONS = [
  'All sites (estate view)',
  'Riverside',
  'Fitzroy',
  'Kings X',
  'Canary',
  'City Centre',
  'Shoreditch',
];

/** Relative data windows — always resolved at send time, never fixed. */
export const DATA_WINDOW_OPTIONS = [
  'Today so far, as of send time',
  'Yesterday, as of send date',
  'Last complete week as of send date',
  'Last 4 complete weeks as of send date',
  'Last complete period as of send date',
];
