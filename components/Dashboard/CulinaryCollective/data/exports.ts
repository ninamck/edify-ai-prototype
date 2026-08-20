/**
 * CSV-export section definitions for the Culinary Collective demo.
 *
 * Each section is a flat (headers, rows) tuple matching the `CsvSection`
 * contract from `lib/csvExport.ts`. The Download menu in the toolbar picks
 * its options from these arrays — one set for the Dashboard tab, one for
 * the Flash tab.
 *
 * The data here is the same hand-extracted snapshot used by the on-screen
 * components, just reshaped to a row-and-column form. Numbers stay in their
 * raw spreadsheet units (full pounds, decimals for percentages) so the CSV
 * is friendly to downstream pivot tables.
 */

import type { CsvSection } from '@/lib/csvExport';
import {
  FIS_13_WEEK_SALES,
  FIS_FLASH_PNL,
  FIS_HEADLINE,
  FIS_HEATMAPS,
  FIS_TRENDS_REVENUE_BY_OUTLET,
  FIS_TRENDS_WEEKS,
  FIS_WEEK_AOV,
  FIS_WEEK_DAYS,
  FIS_WEEK_DAY_LABELS,
  FIS_WEEK_ORDERS,
  FIS_WEEK_REVENUE_BY_CATEGORY,
  FIS_WEEK_REVENUE_BY_OUTLET,
  FIS_WEEK_REVENUE_PER_LABOUR_HOUR,
  FIS_WEEK_REVENUE_VS_LY,
  FIS_WEEK_SECURITY_AND_PROGRAMMING,
  FIS_WEEK_WAGE_COST,
  FIS_WEEK_WAGE_HOURS_BY_DEPT,
  type DailyRow,
  type FlashPnLRow,
} from './fisMockData';
import {
  FIS_BAR_INVENTORY,
  FIS_TRENDS_COGS_MOVEMENTS,
  FIS_TRENDS_GP_DETAIL,
  FIS_TRENDS_INDIRECTS,
  FIS_TRENDS_REVENUE_BY_CATEGORY,
  FIS_TRENDS_REVENUE_TO_PNL,
  FIS_TRENDS_WAGE_COST,
  FIS_YOY_SALES_BY_OUTLET,
  type FisTrendRow,
} from './fisExtendedMockData';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_HEADERS = FIS_WEEK_DAY_LABELS.map((d, i) => `${d} (${FIS_WEEK_DAYS[i]})`);

function dailyRowToCsvRow(r: DailyRow, section?: string): (string | number | null)[] {
  const base: (string | number | null)[] = [];
  if (section !== undefined) base.push(section);
  base.push(r.label, ...r.daily, r.weekTotal, r.weekShare, r.mtdTotal, r.mtdShare);
  return base;
}

function dailySection(
  label: string,
  slug: string,
  rows: DailyRow[],
  unit: string,
  /** Optional sub-group label per row, mirroring the spreadsheet's
   *  section structure. When present, exposes a `Group` column so the CSV
   *  reader can pivot/filter by group. */
  sections?: string[],
): CsvSection {
  const headers = sections
    ? ['Group', 'Line', ...DAY_HEADERS, 'Week total', 'Week share', 'MTD total', 'MTD share']
    : ['Line', ...DAY_HEADERS, 'Week total', 'Week share', 'MTD total', 'MTD share'];
  return {
    label,
    filenameSlug: slug,
    note: `Week ending ${FIS_HEADLINE.weekEnding} · ${unit}`,
    headers,
    rows: rows.map((r, i) => dailyRowToCsvRow(r, sections?.[i])),
  };
}

const REVENUE_BY_CATEGORY_SECTIONS = [
  'Drinks', 'Drinks', 'Drinks', 'Drinks', 'Drinks',
  'Other',
  'Food', 'Food', 'Food',
  'Other',
  'Adjustments',
  'Total',
];

const ORDERS_SECTIONS = [
  'Revenue ($)', 'Revenue ($)', 'Revenue ($)',
  'Orders (count)', 'Orders (count)', 'Orders (count)',
];

const SECURITY_AND_PROGRAMMING_SECTIONS = ['Security', 'Security', 'Programming'];

const WAGE_COST_SECTIONS = [
  'Outlet wages', 'Outlet wages', 'Outlet wages', 'Outlet wages',
  'Total wages',
  'On-costs', 'On-costs', 'On-costs',
  'Total loaded',
  'Ratio',
];

// ---------------------------------------------------------------------------
// Shared sections (used by both tabs)
// ---------------------------------------------------------------------------

const HEADLINE_SECTION: CsvSection = {
  label: 'Headline KPIs',
  filenameSlug: 'headline-kpis',
  note: FIS_HEADLINE.weekEndingLong,
  headers: ['Metric', 'Value', 'Unit'],
  rows: [
    ['Last week sales', FIS_HEADLINE.lastWeekSales, '$'],
    ['Last week vs Budget', FIS_HEADLINE.lastWeekVsBud, '$'],
    ['Last week vs Budget %', FIS_HEADLINE.lastWeekVsBudPct, 'decimal'],
    ['Month to date', FIS_HEADLINE.monthToDate, '$'],
    ['Full month budget', FIS_HEADLINE.fullMonthBudget, '$'],
    ['To go', FIS_HEADLINE.toGo, '$'],
    ['Week GP %', FIS_HEADLINE.weekGpPct, 'decimal'],
    ['Month GP %', FIS_HEADLINE.monthGpPct, 'decimal'],
    ['Week wage %', FIS_HEADLINE.weekWagePct, 'decimal'],
    ['Month wage %', FIS_HEADLINE.monthWagePct, 'decimal'],
  ],
};

const THIRTEEN_WEEK_SALES_SECTION: CsvSection = {
  label: '13-week sales',
  filenameSlug: '13-week-sales',
  note: 'Actual / Budget / Last Year · $k',
  headers: ['Label', 'Week ending', 'Actual ($k)', 'Budget ($k)', 'Last Year ($k)'],
  rows: FIS_13_WEEK_SALES.map((w) => [w.label, w.weekEnding, w.actual, w.budget, w.lastYear]),
};

const REVENUE_BY_OUTLET_TREND_SECTION: CsvSection = {
  label: 'Revenue by outlet (13-week trend)',
  filenameSlug: 'revenue-by-outlet-trend',
  note: '$ per week, full pounds',
  headers: ['Week ending', ...FIS_TRENDS_REVENUE_BY_OUTLET.map((s) => s.outlet)],
  rows: FIS_TRENDS_WEEKS.map((week, idx) => [
    week,
    ...FIS_TRENDS_REVENUE_BY_OUTLET.map((s) => s.values[idx]),
  ]),
};

// ---------------------------------------------------------------------------
// Dashboard tab sections
// ---------------------------------------------------------------------------

function dashboardKpiSection(): CsvSection {
  // The KPI cards on the Dashboard tab carry derived strings (e.g. "+1.7pp
  // vs target") that don't have machine-friendly equivalents. Export the
  // underlying headline numbers so Excel pivots work, and let users open
  // the headline section to see the raw deltas in numeric form.
  return {
    ...HEADLINE_SECTION,
    label: 'Dashboard KPIs',
    filenameSlug: 'dashboard-kpis',
  };
}

const REVENUE_MIX_LAST_WEEK_SECTION: CsvSection = (() => {
  const lastWeekIdx = FIS_TRENDS_WEEKS.length - 1;
  const total =
    FIS_TRENDS_REVENUE_BY_OUTLET.find((s) => s.outlet === 'Total')?.values[lastWeekIdx] ?? 1;
  const rows: (string | number)[][] = ['Bar', 'Flock', 'Opa', 'Dough', 'Other'].map((outlet) => {
    const value = FIS_TRENDS_REVENUE_BY_OUTLET.find((s) => s.outlet === outlet)?.values[lastWeekIdx] ?? 0;
    const share = value / total;
    return [outlet, value, share];
  });
  return {
    label: 'Revenue mix · last week',
    filenameSlug: 'revenue-mix-last-week',
    note: `Week ending ${FIS_HEADLINE.weekEnding}`,
    headers: ['Outlet', 'Revenue ($)', 'Share (decimal)'],
    rows,
  };
})();

const GP_BY_LINE_SECTION: CsvSection = {
  label: 'Gross profit % · by line',
  filenameSlug: 'gp-pct-by-line',
  note: `Week ending ${FIS_HEADLINE.weekEnding} · Actual vs Budget (% of revenue)`,
  headers: ['Line', 'Actual %', 'Budget %'],
  rows: [
    ['Bar', 78.5, 76.5],
    ['Food', 70.6, 73.0],
  ],
};

const WAGE_BY_LINE_SECTION: CsvSection = {
  label: 'Wages % · by line',
  filenameSlug: 'wages-pct-by-line',
  note: `Week ending ${FIS_HEADLINE.weekEnding} · Actual vs Budget (% of revenue)`,
  headers: ['Line', 'Actual %', 'Budget %'],
  rows: [
    ['Bar', 11.1, 10.3],
    ['Kiosk', 27.1, 27.0],
  ],
};

export const DASHBOARD_EXPORT_SECTIONS: CsvSection[] = [
  dashboardKpiSection(),
  THIRTEEN_WEEK_SALES_SECTION,
  REVENUE_MIX_LAST_WEEK_SECTION,
  GP_BY_LINE_SECTION,
  WAGE_BY_LINE_SECTION,
  REVENUE_BY_OUTLET_TREND_SECTION,
];

// ---------------------------------------------------------------------------
// Flash tab sections
// ---------------------------------------------------------------------------

const FLASH_PNL_SECTION: CsvSection = (() => {
  // Walk the structured P&L preserving its section grouping, but dropping
  // pure spacer rows. Section header rows are kept (with empty value cells)
  // so the file mirrors what's on screen.
  const rows: (string | number | null)[][] = [];
  let currentSection = 'Top-line';
  for (const r of FIS_FLASH_PNL as FlashPnLRow[]) {
    if (r.kind === 'spacer') continue;
    if (r.kind === 'section') {
      currentSection = r.label;
      rows.push([currentSection, r.label, r.kind, null, null, null, null, null, null, null, null, null]);
      continue;
    }
    rows.push([
      currentSection,
      r.label,
      r.kind,
      r.week.actual,
      r.week.budget,
      r.week.vsBud,
      r.week.pct,
      r.mtd.actual,
      r.mtd.budget,
      r.mtd.vsBud,
      r.mtd.pct,
      r.fullMonthBudget,
    ]);
  }
  return {
    label: 'Flash P&L',
    filenameSlug: 'flash-pnl',
    note: `Week ending ${FIS_HEADLINE.weekEnding} · ${FIS_HEADLINE.monthLabel} MTD · costs are negative; pct rows store decimals`,
    headers: [
      'Section',
      'Line',
      'Kind',
      'Wk Actual',
      'Wk Budget',
      'Wk vs Bud',
      'Wk Var %',
      'MTD Actual',
      'MTD Budget',
      'MTD vs Bud',
      'MTD Var %',
      'Full Month Budget',
    ],
    rows,
  };
})();

const REVENUE_BY_OUTLET_DAILY_SECTION = dailySection(
  'Revenue by outlet · daily',
  'revenue-by-outlet-daily',
  FIS_WEEK_REVENUE_BY_OUTLET,
  '$ per day',
);
const REVENUE_VS_LY_DAILY_SECTION = dailySection(
  'Revenue vs Last Year · daily',
  'revenue-vs-ly-daily',
  FIS_WEEK_REVENUE_VS_LY,
  '$ per day; Growth % stores decimals',
);
const REVENUE_BY_CATEGORY_DAILY_SECTION = dailySection(
  'Revenue by category · daily',
  'revenue-by-category-daily',
  FIS_WEEK_REVENUE_BY_CATEGORY,
  '$ per day',
  REVENUE_BY_CATEGORY_SECTIONS,
);
const ORDERS_SECTION = dailySection(
  'Service mix & orders',
  'service-mix-orders',
  FIS_WEEK_ORDERS,
  'Quick service vs table service',
  ORDERS_SECTIONS,
);
const AOV_SECTION = dailySection(
  'AOV',
  'aov',
  FIS_WEEK_AOV,
  'Average order value ($)',
);
const SECURITY_PROGRAMMING_SECTION = dailySection(
  'Security & programming',
  'security-programming',
  FIS_WEEK_SECURITY_AND_PROGRAMMING,
  'Hours and $ per day',
  SECURITY_AND_PROGRAMMING_SECTIONS,
);
const WAGE_HOURS_SECTION = dailySection(
  'Wage hours by department',
  'wage-hours-by-dept',
  FIS_WEEK_WAGE_HOURS_BY_DEPT,
  'Hours per day',
);
const REVENUE_PER_LABOUR_HOUR_SECTION = dailySection(
  'Revenue per labour hour',
  'revenue-per-labour-hour',
  FIS_WEEK_REVENUE_PER_LABOUR_HOUR,
  '$ per labour hour',
);
const WAGE_COST_SECTION = dailySection(
  'Wage cost & on-costs',
  'wage-cost',
  FIS_WEEK_WAGE_COST,
  '$ per day; Vs Revenue stores decimals',
  WAGE_COST_SECTIONS,
);

// ---------------------------------------------------------------------------
// Additional TRENDS sheet sections + YOY SALES + COGS - NORY
// ---------------------------------------------------------------------------

function trendSection(
  label: string,
  slug: string,
  note: string,
  rows: FisTrendRow[],
): CsvSection {
  return {
    label,
    filenameSlug: slug,
    note,
    headers: ['Group', 'Line', ...FIS_TRENDS_WEEKS],
    rows: rows.map((r) => [r.group ?? '', r.label, ...r.values]),
  };
}

const TRENDS_REVENUE_BY_CATEGORY_SECTION = trendSection(
  'Trends · revenue by category',
  'trends-revenue-by-category',
  '$ per week (rolling 13)',
  FIS_TRENDS_REVENUE_BY_CATEGORY,
);
const TRENDS_REVENUE_TO_PNL_SECTION = trendSection(
  'Trends · revenue to P&L',
  'trends-revenue-to-pnl',
  '$ per week; % Var stores decimals (rolling 13)',
  FIS_TRENDS_REVENUE_TO_PNL,
);
const TRENDS_COGS_MOVEMENTS_SECTION = trendSection(
  'Trends · cost of sales movements',
  'trends-cogs-movements',
  '$ per week; Vs Revenue stores decimals',
  FIS_TRENDS_COGS_MOVEMENTS,
);
const TRENDS_GP_DETAIL_SECTION = trendSection(
  'Trends · GP detail (Bar & Food)',
  'trends-gp-detail',
  'Theoretical/actual COGS in $; GP %, COS % store decimals',
  FIS_TRENDS_GP_DETAIL,
);
const TRENDS_INDIRECTS_SECTION = trendSection(
  'Trends · indirects & security',
  'trends-indirects',
  'Hours, $, decimals depending on row',
  FIS_TRENDS_INDIRECTS,
);
const TRENDS_WAGE_COST_SECTION = trendSection(
  'Trends · wage cost',
  'trends-wage-cost',
  '$ per week; Vs Revenue stores decimals',
  FIS_TRENDS_WAGE_COST,
);
const YOY_SALES_BY_OUTLET_SECTION = trendSection(
  'Year-on-year sales by outlet',
  'yoy-sales-by-outlet',
  '$ for TY/LY/Growth $; Growth % stores decimals',
  FIS_YOY_SALES_BY_OUTLET,
);

const BAR_INVENTORY_SECTION: CsvSection = {
  label: 'Bar inventory & COGS (Nory)',
  filenameSlug: 'bar-inventory-nory',
  note: '$ per week · 13-week rolling window',
  headers: [
    'Week ending',
    'Opening stock',
    'Vs last week',
    'Deliveries',
    'Transfers',
    'Closing stock',
    'COGS',
    'Actual food',
    'Actual beverage',
    'S/B nil',
    'Theoretical food',
    'Theoretical beverage',
    'Food sales',
  ],
  rows: FIS_BAR_INVENTORY.map((r) => [
    r.weekEnding,
    r.opening,
    r.vsLastWeek,
    r.deliveries,
    r.transfers,
    r.closing,
    r.cogs,
    r.actualFood,
    r.actualBeverage,
    r.sbNil,
    r.theoFood,
    r.bevTheo,
    r.foodSales,
  ]),
};

const HEATMAP_FLAT_SECTION: CsvSection = {
  label: 'Variance vs Last Year (heatmap)',
  filenameSlug: 'variance-vs-ly-heatmap',
  note: '$ daily variance vs prior year; decimals for var %',
  headers: [
    'Outlet',
    'Week ending',
    'Prior year',
    'Mon var',
    'Tue var',
    'Wed var',
    'Thu var',
    'Fri var',
    'Sat var',
    'Sun var',
    'Total var',
    'This year',
    'Var %',
  ],
  rows: FIS_HEATMAPS.flatMap((map) =>
    map.rows.map((r) => [
      map.outlet,
      r.weekEnding,
      r.priorYear,
      ...r.daily,
      r.totalVar,
      r.thisYear,
      r.pctVar,
    ]),
  ),
};

export const FLASH_EXPORT_SECTIONS: CsvSection[] = [
  HEADLINE_SECTION,
  THIRTEEN_WEEK_SALES_SECTION,
  FLASH_PNL_SECTION,
  REVENUE_BY_OUTLET_DAILY_SECTION,
  REVENUE_VS_LY_DAILY_SECTION,
  REVENUE_BY_CATEGORY_DAILY_SECTION,
  ORDERS_SECTION,
  AOV_SECTION,
  SECURITY_PROGRAMMING_SECTION,
  WAGE_HOURS_SECTION,
  REVENUE_PER_LABOUR_HOUR_SECTION,
  WAGE_COST_SECTION,
  REVENUE_BY_OUTLET_TREND_SECTION,
  TRENDS_REVENUE_BY_CATEGORY_SECTION,
  TRENDS_REVENUE_TO_PNL_SECTION,
  TRENDS_COGS_MOVEMENTS_SECTION,
  TRENDS_GP_DETAIL_SECTION,
  TRENDS_INDIRECTS_SECTION,
  TRENDS_WAGE_COST_SECTION,
  YOY_SALES_BY_OUTLET_SECTION,
  BAR_INVENTORY_SECTION,
  HEATMAP_FLAT_SECTION,
];
