// Flat-row reshapes of the FIS spreadsheet so we can drive the same Dunkin-style
// DataTable component the MVP1 demo uses. Each export is a `{ columns, rows }`
// pair: `columns` matches the shared Column descriptor contract, and `rows` is
// an array of plain objects keyed by `column.key`.
//
// Notes:
//  - Currency columns render as £ via the `currency: 'GBP'` Column field added
//    in `Mvp1/Tables/dataSources/types.ts`.
//  - DataTable's `percent` formatter multiplies cell values into a `${v}%`
//    string with no scaling, so decimals from the spreadsheet (e.g. 0.011)
//    are pre-multiplied to 1.1 here.
//  - The week-ending field is normalised to ISO `YYYY-MM-DD` so the date
//    filter / sort works out of the box.

import type { Column } from '@/components/Mvp1/Tables/dataSources/types';
import {
  FIS_FLASH_PNL,
  FIS_HEATMAPS,
  FIS_TRENDS_REVENUE_BY_OUTLET,
  FIS_TRENDS_WEEKS,
  FIS_WEEK_AOV,
  FIS_WEEK_DAY_LABELS,
  FIS_WEEK_DAYS,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "22-Feb" → "2026-02-22". Trailing "-26" is optional. */
const ISO_WEEK_ENDINGS: Record<string, string> = {
  '22-Feb': '2026-02-22',
  '1-Mar': '2026-03-01',
  '8-Mar': '2026-03-08',
  '15-Mar': '2026-03-15',
  '22-Mar': '2026-03-22',
  '29-Mar': '2026-03-29',
  '5-Apr': '2026-04-05',
  '12-Apr': '2026-04-12',
  '19-Apr': '2026-04-19',
  '26-Apr': '2026-04-26',
  '3-May': '2026-05-03',
  '10-May': '2026-05-10',
  '17-May': '2026-05-17',
};

function toIsoWeekEnding(label: string): string {
  const stripped = label.replace(/-2[56]$/, '');
  return ISO_WEEK_ENDINGS[stripped] ?? label;
}

/** Decimal → percent value the DataTable percent formatter expects. */
function pct(decimal: number | null | undefined): number | null {
  if (decimal === null || decimal === undefined || !Number.isFinite(decimal)) return null;
  return Math.round(decimal * 10000) / 100;
}

// ---------------------------------------------------------------------------
// 1. Weekly heatmap (variance vs last year) -- 6 outlets × 13 weeks = 78 rows
// ---------------------------------------------------------------------------

export type FisHeatmapTableRow = {
  outlet: string;
  week_ending: string;
  prior_year: number;
  mon_var: number;
  tue_var: number;
  wed_var: number;
  thu_var: number;
  fri_var: number;
  sat_var: number;
  sun_var: number;
  total_var: number;
  this_year: number;
  var_pct: number;
};

export const FIS_HEATMAP_TABLE_COLUMNS: Column[] = [
  { key: 'outlet', header: 'Outlet', type: 'string', width: 90, pinned: 'left', defaultVisible: true },
  { key: 'week_ending', header: 'Week ending', type: 'date', width: 130, defaultVisible: true },
  { key: 'prior_year', header: 'Prior year', type: 'currency', currency: 'GBP', width: 130, defaultVisible: true },
  { key: 'mon_var', header: 'Mon var', type: 'currency', currency: 'GBP', width: 110 },
  { key: 'tue_var', header: 'Tue var', type: 'currency', currency: 'GBP', width: 110 },
  { key: 'wed_var', header: 'Wed var', type: 'currency', currency: 'GBP', width: 110 },
  { key: 'thu_var', header: 'Thu var', type: 'currency', currency: 'GBP', width: 110 },
  { key: 'fri_var', header: 'Fri var', type: 'currency', currency: 'GBP', width: 110 },
  { key: 'sat_var', header: 'Sat var', type: 'currency', currency: 'GBP', width: 110 },
  { key: 'sun_var', header: 'Sun var', type: 'currency', currency: 'GBP', width: 110 },
  { key: 'total_var', header: 'Total var', type: 'currency', currency: 'GBP', width: 130, defaultVisible: true },
  { key: 'this_year', header: 'This year', type: 'currency', currency: 'GBP', width: 130, defaultVisible: true },
  { key: 'var_pct', header: 'Var %', type: 'percent', width: 100, defaultVisible: true },
];

export const FIS_HEATMAP_TABLE_ROWS: FisHeatmapTableRow[] = FIS_HEATMAPS.flatMap((map) =>
  map.rows.map(
    (r): FisHeatmapTableRow => ({
      outlet: map.outlet,
      week_ending: toIsoWeekEnding(r.weekEnding),
      prior_year: r.priorYear,
      mon_var: r.daily[0],
      tue_var: r.daily[1],
      wed_var: r.daily[2],
      thu_var: r.daily[3],
      fri_var: r.daily[4],
      sat_var: r.daily[5],
      sun_var: r.daily[6],
      total_var: r.totalVar,
      this_year: r.thisYear,
      var_pct: pct(r.pctVar) ?? 0,
    }),
  ),
);

// ---------------------------------------------------------------------------
// 2. Flash P&L -- one row per data/total/pct line item
// ---------------------------------------------------------------------------

export type FisFlashPnLTableRow = {
  section: string;
  line: string;
  kind: 'data' | 'total' | 'pct';
  week_actual: number | null;
  week_budget: number | null;
  week_vs_bud: number | null;
  week_pct: number | null;
  mtd_actual: number | null;
  mtd_budget: number | null;
  mtd_vs_bud: number | null;
  mtd_pct: number | null;
  full_month_budget: number | null;
};

export const FIS_FLASH_PNL_TABLE_COLUMNS: Column[] = [
  { key: 'section', header: 'Section', type: 'string', width: 150, pinned: 'left', defaultVisible: true },
  { key: 'line', header: 'Line', type: 'string', width: 220, defaultVisible: true },
  { key: 'kind', header: 'Type', type: 'string', width: 80 },
  { key: 'week_actual', header: 'Wk Actual', type: 'currency', currency: 'GBP', width: 130, defaultVisible: true },
  { key: 'week_budget', header: 'Wk Budget', type: 'currency', currency: 'GBP', width: 130, defaultVisible: true },
  { key: 'week_vs_bud', header: 'Wk vs Bud', type: 'currency', currency: 'GBP', width: 130, defaultVisible: true },
  { key: 'week_pct', header: 'Wk Var %', type: 'percent', width: 110, defaultVisible: true },
  { key: 'mtd_actual', header: 'MTD Actual', type: 'currency', currency: 'GBP', width: 130, defaultVisible: true },
  { key: 'mtd_budget', header: 'MTD Budget', type: 'currency', currency: 'GBP', width: 130 },
  { key: 'mtd_vs_bud', header: 'MTD vs Bud', type: 'currency', currency: 'GBP', width: 130, defaultVisible: true },
  { key: 'mtd_pct', header: 'MTD Var %', type: 'percent', width: 110, defaultVisible: true },
  { key: 'full_month_budget', header: 'Full Mo. Budget', type: 'currency', currency: 'GBP', width: 140 },
];

function flattenPnL(): FisFlashPnLTableRow[] {
  const out: FisFlashPnLTableRow[] = [];
  let currentSection = 'Top-line';
  for (const row of FIS_FLASH_PNL as FlashPnLRow[]) {
    if (row.kind === 'spacer') continue;
    if (row.kind === 'section') {
      currentSection = row.label;
      continue;
    }
    // pct rows (e.g. "Vs Revenue") need their decimals scaled for percent
    // formatting; data/total rows just pass currency values through.
    const isPctRow = row.kind === 'pct';
    out.push({
      section: currentSection,
      line: row.label,
      kind: row.kind,
      week_actual: isPctRow ? pct(row.week.actual) : row.week.actual,
      week_budget: isPctRow ? pct(row.week.budget) : row.week.budget,
      week_vs_bud: isPctRow ? pct(row.week.vsBud) : row.week.vsBud,
      week_pct: pct(row.week.pct),
      mtd_actual: isPctRow ? pct(row.mtd.actual) : row.mtd.actual,
      mtd_budget: isPctRow ? pct(row.mtd.budget) : row.mtd.budget,
      mtd_vs_bud: isPctRow ? pct(row.mtd.vsBud) : row.mtd.vsBud,
      mtd_pct: pct(row.mtd.pct),
      full_month_budget: isPctRow ? pct(row.fullMonthBudget) : row.fullMonthBudget,
    });
  }
  return out;
}

export const FIS_FLASH_PNL_TABLE_ROWS = flattenPnL();

// Override the column types for pct rows: these are mostly "Vs Revenue"
// reference lines whose Wk/MTD/Full-month columns are themselves percentages.
// Rather than juggling a per-row column type (which the DataTable doesn't
// support), the columns are marked currency by default and the FlashReport
// renders pct rows using a separate filtered table.
//
// `flattenPnL` already pre-scales pct rows so they look right when the user
// switches the table's currency-typed column to a percent column override --
// but to keep this simple and avoid type juggling, we expose two derived
// arrays: data/total rows in currency and pct rows in percent.

export const FIS_FLASH_PNL_VALUE_ROWS = FIS_FLASH_PNL_TABLE_ROWS.filter(
  (r) => r.kind !== 'pct',
);

export const FIS_FLASH_PNL_RATIO_ROWS = FIS_FLASH_PNL_TABLE_ROWS.filter(
  (r) => r.kind === 'pct',
);

export const FIS_FLASH_PNL_VALUE_COLUMNS: Column[] = FIS_FLASH_PNL_TABLE_COLUMNS.filter(
  (c) => c.key !== 'kind',
);

export const FIS_FLASH_PNL_RATIO_COLUMNS: Column[] = [
  { key: 'section', header: 'Section', type: 'string', width: 150, pinned: 'left', defaultVisible: true },
  { key: 'line', header: 'Ratio', type: 'string', width: 200, defaultVisible: true },
  { key: 'week_actual', header: 'Wk Actual %', type: 'percent', width: 120, defaultVisible: true },
  { key: 'week_budget', header: 'Wk Budget %', type: 'percent', width: 120, defaultVisible: true },
  { key: 'week_vs_bud', header: 'Wk vs Bud (pp)', type: 'percent', width: 130, defaultVisible: true },
  { key: 'mtd_actual', header: 'MTD Actual %', type: 'percent', width: 120, defaultVisible: true },
  { key: 'mtd_budget', header: 'MTD Budget %', type: 'percent', width: 120, defaultVisible: true },
  { key: 'mtd_vs_bud', header: 'MTD vs Bud (pp)', type: 'percent', width: 130, defaultVisible: true },
  { key: 'full_month_budget', header: 'Full Mo. Budget %', type: 'percent', width: 140, defaultVisible: true },
];

// ---------------------------------------------------------------------------
// 3. Daily detail tables (Mon..Sun + Week total + Week share + MTD total + MTD share)
// ---------------------------------------------------------------------------

export type FisDailyTableRow = {
  line: string;
  mon: number | null;
  tue: number | null;
  wed: number | null;
  thu: number | null;
  fri: number | null;
  sat: number | null;
  sun: number | null;
  week_total: number | null;
  week_share: number | null;
  mtd_total: number | null;
  mtd_share: number | null;
};

const DAY_LABELS_LONG = FIS_WEEK_DAY_LABELS.map((d, i) => `${d} ${FIS_WEEK_DAYS[i]}`);

function dailyColumns(opts: {
  labelHeader: string;
  numericType?: 'currency' | 'number' | 'integer';
  showShares?: boolean;
}): Column[] {
  const numericType = opts.numericType ?? 'currency';
  const cols: Column[] = [
    { key: 'line', header: opts.labelHeader, type: 'string', width: 170, pinned: 'left', defaultVisible: true },
  ];
  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  dayKeys.forEach((k, i) => {
    cols.push({
      key: k,
      header: DAY_LABELS_LONG[i],
      type: numericType,
      currency: numericType === 'currency' ? 'GBP' : undefined,
      width: 110,
      defaultVisible: true,
    });
  });
  cols.push({
    key: 'week_total',
    header: 'Week total',
    type: numericType,
    currency: numericType === 'currency' ? 'GBP' : undefined,
    width: 130,
    defaultVisible: true,
  });
  if (opts.showShares !== false) {
    cols.push({
      key: 'week_share',
      header: 'Wk %',
      type: 'percent',
      width: 90,
      defaultVisible: true,
    });
  }
  cols.push({
    key: 'mtd_total',
    header: 'MTD total',
    type: numericType,
    currency: numericType === 'currency' ? 'GBP' : undefined,
    width: 130,
    defaultVisible: true,
  });
  if (opts.showShares !== false) {
    cols.push({
      key: 'mtd_share',
      header: 'MTD %',
      type: 'percent',
      width: 90,
      defaultVisible: true,
    });
  }
  return cols;
}

function flattenDaily(rows: DailyRow[]): FisDailyTableRow[] {
  return rows.map((r) => ({
    line: r.label,
    mon: r.daily[0] ?? null,
    tue: r.daily[1] ?? null,
    wed: r.daily[2] ?? null,
    thu: r.daily[3] ?? null,
    fri: r.daily[4] ?? null,
    sat: r.daily[5] ?? null,
    sun: r.daily[6] ?? null,
    week_total: r.weekTotal,
    week_share: pct(r.weekShare),
    mtd_total: r.mtdTotal,
    mtd_share: pct(r.mtdShare),
  }));
}

export const FIS_REVENUE_BY_OUTLET_COLUMNS = dailyColumns({
  labelHeader: 'Outlet',
  numericType: 'currency',
});
export const FIS_REVENUE_BY_OUTLET_ROWS = flattenDaily(FIS_WEEK_REVENUE_BY_OUTLET);

export const FIS_REVENUE_BY_CATEGORY_COLUMNS = dailyColumns({
  labelHeader: 'Category',
  numericType: 'currency',
});
export const FIS_REVENUE_BY_CATEGORY_ROWS = flattenDaily(FIS_WEEK_REVENUE_BY_CATEGORY);

export const FIS_REVENUE_VS_LY_COLUMNS: Column[] = (() => {
  const base = dailyColumns({ labelHeader: 'Metric', numericType: 'currency', showShares: false });
  // The "Growth %" row stores decimals as a percent ratio, so override the
  // numeric columns to render as currency by default and let the user switch
  // visibility -- alternative would be a parallel percent table, but a single
  // table with currency columns matches the spreadsheet formatting closely.
  return base;
})();
export const FIS_REVENUE_VS_LY_ROWS = flattenDaily(FIS_WEEK_REVENUE_VS_LY);

export const FIS_ORDERS_COLUMNS: Column[] = dailyColumns({
  labelHeader: 'Metric',
  numericType: 'integer',
});
export const FIS_ORDERS_ROWS = flattenDaily(FIS_WEEK_ORDERS);

export const FIS_AOV_COLUMNS: Column[] = dailyColumns({
  labelHeader: 'Service',
  numericType: 'currency',
  showShares: false,
});
export const FIS_AOV_ROWS = flattenDaily(FIS_WEEK_AOV);

export const FIS_SECURITY_AND_PROGRAMMING_COLUMNS = dailyColumns({
  labelHeader: 'Line',
  numericType: 'integer',
  showShares: false,
});
export const FIS_SECURITY_AND_PROGRAMMING_ROWS = flattenDaily(
  FIS_WEEK_SECURITY_AND_PROGRAMMING,
);

export const FIS_WAGE_HOURS_COLUMNS = dailyColumns({
  labelHeader: 'Department',
  numericType: 'integer',
});
export const FIS_WAGE_HOURS_ROWS = flattenDaily(FIS_WEEK_WAGE_HOURS_BY_DEPT);

export const FIS_REVENUE_PER_LABOUR_HOUR_COLUMNS = dailyColumns({
  labelHeader: 'Department',
  numericType: 'currency',
  showShares: false,
});
export const FIS_REVENUE_PER_LABOUR_HOUR_ROWS = flattenDaily(FIS_WEEK_REVENUE_PER_LABOUR_HOUR);

export const FIS_WAGE_COST_COLUMNS = dailyColumns({
  labelHeader: 'Department',
  numericType: 'currency',
  showShares: false,
});
export const FIS_WAGE_COST_ROWS = flattenDaily(FIS_WEEK_WAGE_COST);

// ---------------------------------------------------------------------------
// 4. 13-week revenue by outlet (TRENDS sheet) -- 13 rows, one per week
// ---------------------------------------------------------------------------

export type FisTrendTableRow = {
  week_ending: string;
  bar: number;
  flock: number;
  opa: number;
  dough: number;
  other: number;
  total: number;
};

export const FIS_TREND_TABLE_COLUMNS: Column[] = [
  { key: 'week_ending', header: 'Week ending', type: 'date', width: 130, pinned: 'left', defaultVisible: true },
  { key: 'bar', header: 'Bar', type: 'currency', currency: 'GBP', width: 120, defaultVisible: true },
  { key: 'flock', header: 'Flock', type: 'currency', currency: 'GBP', width: 110, defaultVisible: true },
  { key: 'opa', header: 'Opa', type: 'currency', currency: 'GBP', width: 110, defaultVisible: true },
  { key: 'dough', header: 'Dough', type: 'currency', currency: 'GBP', width: 110, defaultVisible: true },
  { key: 'other', header: 'Other', type: 'currency', currency: 'GBP', width: 110, defaultVisible: true },
  { key: 'total', header: 'Total', type: 'currency', currency: 'GBP', width: 140, defaultVisible: true },
];

function buildTrendRows(): FisTrendTableRow[] {
  const get = (outlet: string, idx: number) =>
    FIS_TRENDS_REVENUE_BY_OUTLET.find((s) => s.outlet === outlet)?.values[idx] ?? 0;
  return FIS_TRENDS_WEEKS.map((w, i) => ({
    week_ending: toIsoWeekEnding(w),
    bar: get('Bar', i),
    flock: get('Flock', i),
    opa: get('Opa', i),
    dough: get('Dough', i),
    other: get('Other', i),
    total: get('Total', i),
  }));
}

export const FIS_TREND_TABLE_ROWS = buildTrendRows();
