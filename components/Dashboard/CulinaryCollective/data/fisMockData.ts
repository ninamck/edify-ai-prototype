// Hand-extracted snapshot from FIS_FLASH.xlsx (Flat Iron Square -- week ending
// 17 May). Numbers are kept in full pounds so the recreation matches the
// spreadsheet cell-for-cell. This is a demo snapshot, not a calc engine --
// totals/percentages were carried over verbatim rather than recomputed.

// Re-export the shared KpiCard contract so the overview tab can pull all of
// its types from one place.
export type { Kpi } from '@/components/Dashboard/data/estateMockData';

// ---------------------------------------------------------------------------
// Headline KPIs (top of SALES SUMMARY sheet)
// ---------------------------------------------------------------------------

export const FIS_HEADLINE = {
  weekEnding: '17-May',
  weekEndingLong: 'Week ending 17 May 2026',
  monthLabel: 'May',
  lastWeekSales: 108412,
  lastWeekSalesShort: '\u00a3108k',
  lastWeekVsBud: -1198,
  lastWeekVsBudShort: '-\u00a31k',
  lastWeekVsBudPct: -0.011,
  monthToDate: 241349,
  monthToDateShort: '\u00a3241k',
  fullMonthBudget: 498677,
  fullMonthBudgetShort: '\u00a3499k',
  toGo: 257328,
  toGoShort: '\u00a3257k',
  weekGpPct: 0.767,
  monthGpPct: 0.763,
  weekWagePct: 0.175,
  monthWagePct: 0.191,
};

// ---------------------------------------------------------------------------
// Heatmap vs last year -- summarised version (figures in thousands of pounds)
// from SALES SUMMARY rows 7-19. Used both on the dashboard heatmap and on
// the Flash report "Sales summary" block.
// ---------------------------------------------------------------------------

export type HeatmapWeekRow = {
  weekEnding: string;
  priorYear: number;
  /** Variance per day vs prior year, in the same units as priorYear/thisYear. */
  daily: [number, number, number, number, number, number, number];
  totalVar: number;
  thisYear: number;
  pctVar: number;
};

/** SALES SUMMARY heatmap (in thousands). */
export const FIS_HEATMAP_VS_LY_K: HeatmapWeekRow[] = [
  { weekEnding: '22-Feb-26', priorYear: 58.6, daily: [-0.2, 0.3, -5.5, 6.0, -1.2, -0.7, -0.7], totalVar: -2.1, thisYear: 56.5, pctVar: -0.04 },
  { weekEnding: '1-Mar-26', priorYear: 46.4, daily: [-1.5, 0.2, 3.7, -0.7, -1.6, 2.3, 0.0], totalVar: 2.4, thisYear: 48.7, pctVar: 0.05 },
  { weekEnding: '8-Mar-26', priorYear: 81.0, daily: [-0.5, -7.5, 2.2, -0.7, -1.3, -8.2, -5.4], totalVar: -21.4, thisYear: 59.6, pctVar: -0.26 },
  { weekEnding: '15-Mar-26', priorYear: 70.2, daily: [-0.8, -0.2, -2.6, 3.8, -0.3, 6.7, -14.8], totalVar: -8.3, thisYear: 61.9, pctVar: -0.12 },
  { weekEnding: '22-Mar-26', priorYear: 53.9, daily: [0.0, 2.5, 4.3, 0.6, -1.2, 5.4, 6.1], totalVar: 17.7, thisYear: 71.6, pctVar: 0.33 },
  { weekEnding: '29-Mar-26', priorYear: 53.1, daily: [0.0, -1.3, -3.0, 2.4, -1.2, 4.1, -2.1], totalVar: -1.1, thisYear: 52.1, pctVar: -0.02 },
  { weekEnding: '5-Apr-26', priorYear: 97.0, daily: [-1.4, 1.6, -2.7, -1.6, -6.8, -14.1, -6.2], totalVar: -31.2, thisYear: 65.8, pctVar: -0.32 },
  { weekEnding: '12-Apr-26', priorYear: 97.4, daily: [1.2, -4.5, 5.0, -6.6, -7.2, -5.6, 0.5], totalVar: -17.3, thisYear: 80.1, pctVar: -0.18 },
  { weekEnding: '19-Apr-26', priorYear: 78.7, daily: [-0.9, 2.4, -7.4, -5.2, -2.4, 7.4, 5.1], totalVar: -1.0, thisYear: 77.8, pctVar: -0.01 },
  { weekEnding: '26-Apr-26', priorYear: 98.7, daily: [-2.2, -2.1, 0.1, -2.3, -5.1, 1.9, -3.8], totalVar: -13.6, thisYear: 85.1, pctVar: -0.14 },
  { weekEnding: '3-May-26', priorYear: 130.0, daily: [-2.5, -8.8, -7.4, -2.5, -3.0, -4.0, 11.5], totalVar: -16.7, thisYear: 113.3, pctVar: -0.13 },
  { weekEnding: '10-May-26', priorYear: 88.3, daily: [-0.6, 0.3, -2.4, -1.7, -6.0, -1.9, -4.3], totalVar: -16.7, thisYear: 71.6, pctVar: -0.19 },
  { weekEnding: '17-May-26', priorYear: 101.4, daily: [-1.4, -4.9, -6.1, 29.8, -0.4, -7.4, -2.7], totalVar: 7.0, thisYear: 108.4, pctVar: 0.07 },
];

export const FIS_HEATMAP_AVG_K: HeatmapWeekRow = {
  weekEnding: '13 Week Average',
  priorYear: 81.1,
  daily: [-0.8, -1.7, -1.7, 1.6, -2.9, -1.1, -1.3],
  totalVar: -7.9,
  thisYear: 73.3,
  pctVar: -0.10,
};

// ---------------------------------------------------------------------------
// 13-week sales chart -- Actual / Budget / Last Year (thousands).
// SALES SUMMARY rows 41-53.
// ---------------------------------------------------------------------------

export type WeeklySalesPoint = {
  /** "-8", "-7" ... "Last Week" ... "+1", "+2" */
  label: string;
  weekEnding: string;
  actual: number | null;
  budget: number;
  lastYear: number;
};

export const FIS_13_WEEK_SALES: WeeklySalesPoint[] = [
  { label: '-8', weekEnding: '22-Mar', actual: 71.6, budget: 65.0, lastYear: 53.9 },
  { label: '-7', weekEnding: '29-Mar', actual: 52.1, budget: 65.0, lastYear: 53.1 },
  { label: '-6', weekEnding: '5-Apr', actual: 65.8, budget: 99.1, lastYear: 97.0 },
  { label: '-5', weekEnding: '12-Apr', actual: 80.1, budget: 104.8, lastYear: 97.4 },
  { label: '-4', weekEnding: '19-Apr', actual: 77.8, budget: 104.8, lastYear: 78.7 },
  { label: '-3', weekEnding: '26-Apr', actual: 85.1, budget: 104.8, lastYear: 98.7 },
  { label: '-2', weekEnding: '3-May', actual: 113.3, budget: 109.2, lastYear: 130.0 },
  { label: '-1', weekEnding: '10-May', actual: 71.6, budget: 109.6, lastYear: 88.3 },
  { label: 'Last Week', weekEnding: '17-May', actual: 108.4, budget: 109.6, lastYear: 101.4 },
  { label: '+1', weekEnding: '24-May', actual: null, budget: 109.6, lastYear: 104.7 },
  { label: '+2', weekEnding: '31-May', actual: null, budget: 109.6, lastYear: 97.3 },
  { label: '+3', weekEnding: '7-Jun', actual: null, budget: 119.2, lastYear: 85.4 },
  { label: '+4', weekEnding: '14-Jun', actual: null, budget: 119.2, lastYear: 97.5 },
];

// ---------------------------------------------------------------------------
// Flash P&L (FLASH P&L sheet, rows 6-57). Each row carries:
//   - label / indent (drives display)
//   - kind: 'section' | 'data' | 'pct' | 'total' | 'spacer'
//   - week: this-week Actual/Budget/VsBud/Var%
//   - mtd: month-to-date Actual/Budget/VsBud/Var%
//   - fullMonth: full-month Budget for the month
// Costs are negative numbers (matches the spreadsheet sign convention).
// ---------------------------------------------------------------------------

export type FlashPnLKind = 'section' | 'data' | 'pct' | 'total' | 'spacer';

/** Three-cell column block (Actual / Budget / Vs Bud / Var %) used for both
 *  the weekly and MTD halves of the Flash P&L. */
export type WeekValueColumn = {
  actual: number | null;
  budget: number | null;
  /** Actual − Budget. */
  vsBud: number | null;
  /** Variance % as decimal. */
  pct: number | null;
};

export type FlashPnLRow = {
  label: string;
  kind: FlashPnLKind;
  /** 0 = top level. 1 = sub-line under a section. */
  indent?: 0 | 1 | 2;
  /** Mark a row as bold even if it isn't a section/total. */
  emphasised?: boolean;
  week: WeekValueColumn;
  mtd: WeekValueColumn;
  fullMonthBudget: number | null;
};

const empty: WeekValueColumn = { actual: null, budget: null, vsBud: null, pct: null };

export const FIS_FLASH_PNL: FlashPnLRow[] = [
  { label: 'Revenue', kind: 'section', week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Bar Sales', kind: 'data', indent: 1,
    week: { actual: 92651, budget: 89700, vsBud: 2951, pct: 0.033 },
    mtd: { actual: 205522, budget: 228600, vsBud: -23078, pct: -0.101 },
    fullMonthBudget: 408000,
  },
  {
    label: 'Food Sales', kind: 'data', indent: 1,
    week: { actual: 17917, budget: 23300, vsBud: -5383, pct: -0.231 },
    mtd: { actual: 40868, budget: 59500, vsBud: -18632, pct: -0.313 },
    fullMonthBudget: 106100,
  },
  {
    label: 'No Sales Category', kind: 'data', indent: 1,
    week: { actual: 470, budget: null, vsBud: 470, pct: null },
    mtd: { actual: 1541, budget: null, vsBud: 1541, pct: null },
    fullMonthBudget: null,
  },
  {
    label: 'Discounts at POS', kind: 'data', indent: 1,
    week: { actual: -2627, budget: -3390, vsBud: 763, pct: -0.225 },
    mtd: { actual: -6582, budget: -8643, vsBud: 2061, pct: -0.238 },
    fullMonthBudget: -15423,
  },
  { label: 'Admission & Ticket Sales', kind: 'data', indent: 1, week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Total Revenue', kind: 'total',
    week: { actual: 108412, budget: 109610, vsBud: -1198, pct: -0.011 },
    mtd: { actual: 241349, budget: 279457, vsBud: -38108, pct: -0.136 },
    fullMonthBudget: 498677,
  },
  { label: 'spacer-1', kind: 'spacer', week: empty, mtd: empty, fullMonthBudget: null },
  { label: 'Cost of Sales', kind: 'section', week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Bar COS', kind: 'data', indent: 1,
    week: { actual: -19962, budget: -21080, vsBud: 1118, pct: -0.053 },
    mtd: { actual: -46010, budget: -53721, vsBud: 7711, pct: -0.144 },
    fullMonthBudget: -95880,
  },
  {
    label: 'Food COS', kind: 'data', indent: 1,
    week: { actual: -5266, budget: -6291, vsBud: 1025, pct: -0.163 },
    mtd: { actual: -11103, budget: -16065, vsBud: 4962, pct: -0.309 },
    fullMonthBudget: -28647,
  },
  {
    label: 'Other COS (s/b Nil)', kind: 'data', indent: 1,
    week: { actual: -2, budget: null, vsBud: null, pct: null },
    mtd: { actual: -56, budget: null, vsBud: null, pct: null },
    fullMonthBudget: null,
  },
  {
    label: 'Total Cost of Sales', kind: 'total',
    week: { actual: -25230, budget: -27371, vsBud: 2143, pct: -0.078 },
    mtd: { actual: -57168, budget: -69786, vsBud: 12673, pct: -0.182 },
    fullMonthBudget: -124527,
  },
  {
    label: 'Vs Revenue', kind: 'pct', indent: 1,
    week: { actual: -0.233, budget: -0.250, vsBud: 0.017, pct: null },
    mtd: { actual: -0.237, budget: -0.250, vsBud: 0.013, pct: null },
    fullMonthBudget: -0.250,
  },
  { label: 'spacer-2', kind: 'spacer', week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Gross Profit', kind: 'total', emphasised: true,
    week: { actual: 83182, budget: 82240, vsBud: 943, pct: 0.011 },
    mtd: { actual: 184181, budget: 209671, vsBud: -25490, pct: -0.122 },
    fullMonthBudget: 374150,
  },
  {
    label: 'Vs Revenue', kind: 'pct', indent: 1,
    week: { actual: 0.767, budget: 0.750, vsBud: 0.017, pct: null },
    mtd: { actual: 0.763, budget: 0.750, vsBud: 0.013, pct: null },
    fullMonthBudget: 0.750,
  },
  { label: 'spacer-3', kind: 'spacer', week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Bar GP %', kind: 'pct', indent: 1,
    week: { actual: 0.785, budget: 0.765, vsBud: 0.020, pct: null },
    mtd: { actual: 0.776, budget: 0.765, vsBud: 0.011, pct: null },
    fullMonthBudget: 0.765,
  },
  {
    label: 'Food GP %', kind: 'pct', indent: 1,
    week: { actual: 0.706, budget: 0.730, vsBud: -0.024, pct: null },
    mtd: { actual: 0.728, budget: 0.730, vsBud: -0.002, pct: null },
    fullMonthBudget: 0.730,
  },
  { label: 'spacer-4', kind: 'spacer', week: empty, mtd: empty, fullMonthBudget: null },
  { label: 'Indirects', kind: 'section', week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Security', kind: 'data', indent: 1,
    week: { actual: -1944, budget: -3000, vsBud: 1056, pct: -0.352 },
    mtd: { actual: -5508, budget: -7286, vsBud: 1777, pct: -0.244 },
    fullMonthBudget: -13286,
  },
  { label: 'AV', kind: 'data', indent: 1, week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Programming', kind: 'data', indent: 1,
    week: { actual: -1404, budget: -1200, vsBud: -204, pct: 0.170 },
    mtd: { actual: -4008, budget: -2914, vsBud: -1094, pct: 0.375 },
    fullMonthBudget: -5314,
  },
  {
    label: 'Cleaning', kind: 'data', indent: 1,
    week: { actual: -846, budget: -846, vsBud: 0, pct: null },
    mtd: { actual: -2055, budget: -2055, vsBud: 0, pct: null },
    fullMonthBudget: -3747,
  },
  {
    label: 'Total Indirect Costs', kind: 'total',
    week: { actual: -4194, budget: -5046, vsBud: 852, pct: -0.169 },
    mtd: { actual: -11571, budget: -12255, vsBud: 684, pct: -0.056 },
    fullMonthBudget: -22347,
  },
  {
    label: 'Vs Revenue', kind: 'pct', indent: 1,
    week: { actual: -0.039, budget: -0.046, vsBud: 0.007, pct: null },
    mtd: { actual: -0.048, budget: -0.044, vsBud: -0.004, pct: null },
    fullMonthBudget: -0.045,
  },
  { label: 'spacer-5', kind: 'spacer', week: empty, mtd: empty, fullMonthBudget: null },
  { label: 'Wages & Salaries', kind: 'section', week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Bar Wages', kind: 'data', indent: 1,
    week: { actual: -8067, budget: -7245, vsBud: -822, pct: 0.113 },
    mtd: { actual: -19159, budget: -17594, vsBud: -1565, pct: 0.089 },
    fullMonthBudget: -32084,
  },
  {
    label: 'Kiosk Wages', kind: 'data', indent: 1,
    week: { actual: -3826, budget: -4957, vsBud: 1131, pct: -0.228 },
    mtd: { actual: -9665, budget: -12038, vsBud: 2373, pct: -0.197 },
    fullMonthBudget: -21952,
  },
  {
    label: 'Wages -- Holiday Accrual', kind: 'data', indent: 1,
    week: { actual: -1435, budget: -1473, vsBud: 37, pct: -0.025 },
    mtd: { actual: -3479, budget: -3577, vsBud: 97, pct: -0.027 },
    fullMonthBudget: -6522,
  },
  {
    label: 'Wages -- Employer Pension', kind: 'data', indent: 1,
    week: { actual: -238, budget: -244, vsBud: 6, pct: -0.025 },
    mtd: { actual: -576, budget: -593, vsBud: 16, pct: -0.027 },
    fullMonthBudget: -1081,
  },
  {
    label: 'Wages -- Employer Taxes', kind: 'data', indent: 1,
    week: { actual: -1546, budget: -1586, vsBud: 40, pct: -0.025 },
    mtd: { actual: -3747, budget: -3852, vsBud: 105, pct: -0.027 },
    fullMonthBudget: -7025,
  },
  {
    label: 'Total Variable Wages', kind: 'total',
    week: { actual: -15112, budget: -15505, vsBud: 392, pct: -0.025 },
    mtd: { actual: -36628, budget: -37654, vsBud: 1026, pct: -0.027 },
    fullMonthBudget: -68663,
  },
  {
    label: 'Vs Revenue', kind: 'pct', indent: 1,
    week: { actual: -0.139, budget: -0.141, vsBud: 0.002, pct: null },
    mtd: { actual: -0.152, budget: -0.135, vsBud: -0.017, pct: null },
    fullMonthBudget: -0.138,
  },
  { label: 'spacer-6', kind: 'spacer', week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Bar Wage %', kind: 'pct', indent: 1,
    week: { actual: -0.111, budget: -0.103, vsBud: -0.008, pct: null },
    mtd: { actual: -0.118, budget: -0.098, vsBud: -0.021, pct: null },
    fullMonthBudget: -0.100,
  },
  {
    label: 'Kiosk Wage %', kind: 'pct', indent: 1,
    week: { actual: -0.271, budget: -0.270, vsBud: -0.001, pct: null },
    mtd: { actual: -0.301, budget: -0.257, vsBud: -0.043, pct: null },
    fullMonthBudget: -0.263,
  },
  { label: 'spacer-7', kind: 'spacer', week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Salaries -- Monthly', kind: 'data', indent: 1,
    week: { actual: -3327, budget: -5382, vsBud: 2055, pct: -0.382 },
    mtd: { actual: -8080, budget: -13070, vsBud: 4990, pct: -0.382 },
    fullMonthBudget: -23833,
  },
  {
    label: 'Employers Pension -- Monthly', kind: 'data', indent: 1,
    week: { actual: -100, budget: -161, vsBud: 62, pct: -0.382 },
    mtd: { actual: -242, budget: -392, vsBud: 150, pct: -0.382 },
    fullMonthBudget: -715,
  },
  {
    label: 'Employers Taxes -- Monthly', kind: 'data', indent: 1,
    week: { actual: -459, budget: -743, vsBud: 284, pct: -0.382 },
    mtd: { actual: -1115, budget: -1804, vsBud: 689, pct: -0.382 },
    fullMonthBudget: -3289,
  },
  {
    label: 'Total Fixed Wages', kind: 'total',
    week: { actual: -3886, budget: -6286, vsBud: 2400, pct: -0.382 },
    mtd: { actual: -9437, budget: -15266, vsBud: 5829, pct: -0.382 },
    fullMonthBudget: -27837,
  },
  {
    label: 'Vs Revenue', kind: 'pct', indent: 1,
    week: { actual: -0.036, budget: -0.057, vsBud: 0.022, pct: null },
    mtd: { actual: -0.039, budget: -0.055, vsBud: 0.016, pct: null },
    fullMonthBudget: -0.056,
  },
  { label: 'spacer-8', kind: 'spacer', week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Total Wages & Salaries', kind: 'total',
    week: { actual: -18998, budget: -21790, vsBud: 2792, pct: -0.128 },
    mtd: { actual: -46065, budget: -52920, vsBud: 6855, pct: -0.130 },
    fullMonthBudget: -96500,
  },
  {
    label: 'Vs Revenue', kind: 'pct', indent: 1,
    week: { actual: -0.175, budget: -0.199, vsBud: 0.024, pct: null },
    mtd: { actual: -0.191, budget: -0.189, vsBud: -0.001, pct: null },
    fullMonthBudget: -0.194,
  },
  { label: 'spacer-9', kind: 'spacer', week: empty, mtd: empty, fullMonthBudget: null },
  {
    label: 'Contribution to Overheads', kind: 'total', emphasised: true,
    week: { actual: 59990, budget: 55403, vsBud: 4587, pct: 0.083 },
    mtd: { actual: 126545, budget: 144497, vsBud: -17952, pct: -0.124 },
    fullMonthBudget: 255303,
  },
  {
    label: 'Vs Revenue', kind: 'pct', indent: 1,
    week: { actual: 0.553, budget: 0.505, vsBud: 0.048, pct: null },
    mtd: { actual: 0.524, budget: 0.517, vsBud: 0.007, pct: null },
    fullMonthBudget: 0.512,
  },
];

// ---------------------------------------------------------------------------
// Daily detail (WEEK sheet) -- Mon..Sun for the week ending 17-May, plus the
// week total + share of revenue and the May MTD total + share. Entries with
// `null` cells reflect days with no trade in the spreadsheet.
// ---------------------------------------------------------------------------

export type DailyRow = {
  label: string;
  /** Mon..Sun. */
  daily: (number | null)[];
  weekTotal: number | null;
  /** % of week revenue, as decimal. Null where it doesn't apply. */
  weekShare: number | null;
  mtdTotal: number | null;
  mtdShare: number | null;
};

export const FIS_WEEK_DAYS = ['11-May', '12-May', '13-May', '14-May', '15-May', '16-May', '17-May'] as const;
export const FIS_WEEK_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const FIS_WEEK_REVENUE_BY_OUTLET: DailyRow[] = [
  { label: 'Bar', daily: [null, 4296, 6133, 43214, 9270, 25426, 1685], weekTotal: 90024, weekShare: 0.830, mtdTotal: 198996, mtdShare: 0.825 },
  { label: 'Flock', daily: [null, 248, 343, 1931, 2000, 1249, 174], weekTotal: 5944, weekShare: 0.055, mtdTotal: 13858, mtdShare: 0.057 },
  { label: 'Opa', daily: [null, 578, 427, 1385, 2177, 1450, 256], weekTotal: 6274, weekShare: 0.058, mtdTotal: 15066, mtdShare: 0.062 },
  { label: 'Dough', daily: [null, 435, 724, 1193, 2185, 1163, null], weekTotal: 5700, weekShare: 0.053, mtdTotal: 11889, mtdShare: 0.049 },
  { label: 'No Category', daily: [null, null, 63, null, 22, 386, null], weekTotal: 470, weekShare: 0.004, mtdTotal: 1541, mtdShare: 0.006 },
  { label: 'Total', daily: [null, 5557, 7689, 47723, 15654, 29674, 2115], weekTotal: 108412, weekShare: 1.0, mtdTotal: 241349, mtdShare: 1.0 },
];

export const FIS_WEEK_REVENUE_VS_LY: DailyRow[] = [
  { label: 'Last Year', daily: [1363, 10451, 13760, 17875, 16063, 37047, 4822], weekTotal: 101383, weekShare: null, mtdTotal: 274957, mtdShare: null },
  { label: 'Vs LY', daily: [-1363, -4894, -6072, 29848, -409, -7372, -2707], weekTotal: 7029, weekShare: null, mtdTotal: -33608, mtdShare: null },
  { label: 'Growth %', daily: [-1.0, -0.468, -0.441, 1.670, -0.025, -0.199, -0.561], weekTotal: 0.069, weekShare: null, mtdTotal: -0.122, mtdShare: null },
];

export const FIS_WEEK_REVENUE_BY_CATEGORY: DailyRow[] = [
  { label: 'Beer', daily: [null, 2791, 3217, 20571, 5932, 13307, 1160], weekTotal: 46978, weekShare: 0.433, mtdTotal: 108461, mtdShare: 0.449 },
  { label: 'Spirits', daily: [null, 313, 599, 8931, 914, 5708, 133], weekTotal: 16598, weekShare: 0.153, mtdTotal: 33298, mtdShare: 0.138 },
  { label: 'Cocktails', daily: [null, 540, 1154, 5679, 2450, 2705, 242], weekTotal: 12770, weekShare: 0.118, mtdTotal: 32530, mtdShare: 0.135 },
  { label: 'Wine', daily: [null, 561, 1417, 7756, 1112, 2348, 99], weekTotal: 13294, weekShare: 0.123, mtdTotal: 25344, mtdShare: 0.105 },
  { label: 'Non Alcoholic', daily: [null, 246, 224, 744, 264, 440, 100], weekTotal: 2017, weekShare: 0.019, mtdTotal: 4891, mtdShare: 0.020 },
  { label: 'Min Spend Shortfall', daily: [null, null, null, null, null, 994, null], weekTotal: 994, weekShare: 0.009, mtdTotal: 998, mtdShare: 0.004 },
  { label: 'Dough', daily: [null, 435, 724, 1193, 2185, 1163, null], weekTotal: 5700, weekShare: 0.053, mtdTotal: 11924, mtdShare: 0.049 },
  { label: 'Flock', daily: [null, 248, 343, 1931, 2000, 1249, 174], weekTotal: 5944, weekShare: 0.055, mtdTotal: 13878, mtdShare: 0.058 },
  { label: 'Opa', daily: [null, 578, 427, 1385, 2177, 1450, 256], weekTotal: 6274, weekShare: 0.058, mtdTotal: 15066, mtdShare: 0.062 },
  { label: 'No Category', daily: [null, null, 63, null, 22, 386, null], weekTotal: 470, weekShare: 0.004, mtdTotal: 1541, mtdShare: 0.006 },
  { label: 'Discounts', daily: [null, -155, -479, -466, -1402, -75, -49], weekTotal: -2627, weekShare: -0.024, mtdTotal: -6582, mtdShare: -0.027 },
  { label: 'Total', daily: [null, 5557, 7689, 47723, 15654, 29674, 2115], weekTotal: 108412, weekShare: 1.0, mtdTotal: 241349, mtdShare: 1.0 },
];

export const FIS_WEEK_ORDERS: DailyRow[] = [
  { label: 'Quick Service \u00a3', daily: [null, 4220, 7462, 43582, 13430, 21640, 2009], weekTotal: 92342, weekShare: 0.710, mtdTotal: 207259, mtdShare: 0.716 },
  { label: 'Table Service \u00a3', daily: [null, 2449, 1765, 13683, 5355, 13968, 528], weekTotal: 37748, weekShare: 0.290, mtdTotal: 82354, mtdShare: 0.284 },
  { label: 'Total Gross Revenue', daily: [null, 6669, 9226, 57265, 18785, 35608, 2538], weekTotal: 130090, weekShare: 1.0, mtdTotal: 289612, mtdShare: 1.0 },
  { label: 'Quick Service orders', daily: [null, 305, 373, 1343, 579, 1303, 136], weekTotal: 4039, weekShare: 0.806, mtdTotal: 10679, mtdShare: 0.777 },
  { label: 'Table Service orders', daily: [null, 134, 68, 100, 179, 452, 37], weekTotal: 970, weekShare: 0.194, mtdTotal: 3057, mtdShare: 0.223 },
  { label: 'Total Orders', daily: [null, 439, 441, 1443, 758, 1755, 173], weekTotal: 5009, weekShare: 1.0, mtdTotal: 13736, mtdShare: 1.0 },
];

export const FIS_WEEK_AOV: DailyRow[] = [
  { label: 'Quick Service AOV', daily: [null, 13.8, 20.0, 32.5, 23.2, 16.6, 14.8], weekTotal: 22.9, weekShare: null, mtdTotal: 19.4, mtdShare: null },
  { label: 'Table Service AOV', daily: [null, 18.3, 26.0, 136.8, 29.9, 30.9, 14.3], weekTotal: 38.9, weekShare: null, mtdTotal: 26.9, mtdShare: null },
  { label: 'Total AOV', daily: [null, 15.2, 20.9, 39.7, 24.8, 20.3, 14.7], weekTotal: 26.0, weekShare: null, mtdTotal: 21.1, mtdShare: null },
];

export const FIS_WEEK_SECURITY_AND_PROGRAMMING: DailyRow[] = [
  { label: 'Security Hours', daily: [null, null, 12, 21, 20, 40, null], weekTotal: 93, weekShare: null, mtdTotal: 262, mtdShare: null },
  { label: 'Security Cost', daily: [null, null, 251, 433, 410, 850, null], weekTotal: 1944, weekShare: 0.018, mtdTotal: 5508, mtdShare: 0.023 },
  { label: 'Programming', daily: [null, 204, 300, 300, 300, 300, null], weekTotal: 1404, weekShare: null, mtdTotal: 4008, mtdShare: null },
];

export const FIS_WEEK_WAGE_HOURS_BY_DEPT: DailyRow[] = [
  { label: 'Bar', daily: [4, 55, 80, 181, 106, 178, 24], weekTotal: 629, weekShare: 0.723, mtdTotal: 1497, mtdShare: 0.712 },
  { label: 'Flock', daily: [4, 11, 18, 11, 11, 21, 9], weekTotal: 84, weekShare: 0.096, mtdTotal: 208, mtdShare: 0.099 },
  { label: 'Opa', daily: [null, 16, 10, 26, 19, 19, 9], weekTotal: 99, weekShare: 0.114, mtdTotal: 237, mtdShare: 0.113 },
  { label: 'Dough', daily: [null, 11, 11, 20, 16, null, null], weekTotal: 58, weekShare: 0.067, mtdTotal: 160, mtdShare: 0.076 },
  { label: 'Total', daily: [8, 93, 120, 239, 151, 218, 42], weekTotal: 871, weekShare: 1.0, mtdTotal: 2102, mtdShare: 1.0 },
];

export const FIS_WEEK_REVENUE_PER_LABOUR_HOUR: DailyRow[] = [
  { label: 'Bar', daily: [null, 78.3, 76.3, 238.2, 87.6, 142.6, 70.2], weekTotal: 143.1, weekShare: null, mtdTotal: 132.9, mtdShare: null },
  { label: 'Flock', daily: [null, 22.9, 19.4, 175.0, 190.4, 60.6, 18.9], weekTotal: 70.9, weekShare: null, mtdTotal: 66.5, mtdShare: null },
  { label: 'Opa', daily: [null, 35.2, 41.2, 52.5, 117.7, 76.5, 29.5], weekTotal: 63.2, weekShare: null, mtdTotal: 63.5, mtdShare: null },
  { label: 'Dough', daily: [null, 40.4, 63.7, 59.9, 134.2, null, null], weekTotal: 97.7, weekShare: null, mtdTotal: 74.4, mtdShare: null },
  { label: 'Total', daily: [null, 59.8, 64.2, 199.9, 103.6, 136.2, 50.5], weekTotal: 124.5, weekShare: null, mtdTotal: 114.8, mtdShare: null },
];

export const FIS_WEEK_WAGE_COST: DailyRow[] = [
  { label: 'Bar', daily: [56, 698, 1042, 2324, 1358, 2285, 305], weekTotal: 8067, weekShare: null, mtdTotal: 19159, mtdShare: null },
  { label: 'Flock', daily: [56, 151, 258, 155, 179, 280, 129], weekTotal: 1207, weekShare: null, mtdTotal: 2997, mtdShare: null },
  { label: 'Opa', daily: [null, 250, 166, 421, 272, 298, 148], weekTotal: 1555, weekShare: null, mtdTotal: 3717, mtdShare: null },
  { label: 'Dough', daily: [null, 183, 222, 366, 293, null, null], weekTotal: 1064, weekShare: null, mtdTotal: 2951, mtdShare: null },
  { label: 'Total', daily: [112, 1283, 1687, 3265, 2102, 2863, 581], weekTotal: 11893, weekShare: null, mtdTotal: 28825, mtdShare: null },
  { label: 'Holiday', daily: [13, 155, 204, 394, 254, 346, 70], weekTotal: 1435, weekShare: null, mtdTotal: 3479, mtdShare: null },
  { label: 'Pension', daily: [2, 26, 34, 65, 42, 57, 12], weekTotal: 238, weekShare: null, mtdTotal: 576, mtdShare: null },
  { label: 'Employer Taxes', daily: [15, 167, 219, 424, 273, 372, 76], weekTotal: 1546, weekShare: null, mtdTotal: 3747, mtdShare: null },
  { label: 'Baked Variable', daily: [142, 1630, 2144, 4149, 2671, 3638, 739], weekTotal: 15112, weekShare: null, mtdTotal: 36628, mtdShare: null },
  { label: 'Vs Revenue', daily: [null, 0.293, 0.279, 0.087, 0.171, 0.123, 0.349], weekTotal: 0.139, weekShare: null, mtdTotal: 0.152, mtdShare: null },
];

// ---------------------------------------------------------------------------
// TRENDS sheet -- 13-week revenue by outlet (full pounds).
// Rows 5-10 of TRENDS sheet.
// ---------------------------------------------------------------------------

export const FIS_TRENDS_WEEKS = [
  '22-Feb', '1-Mar', '8-Mar', '15-Mar', '22-Mar', '29-Mar',
  '5-Apr', '12-Apr', '19-Apr', '26-Apr', '3-May', '10-May', '17-May',
] as const;

export type TrendOutletSeries = {
  outlet: string;
  values: number[];
};

export const FIS_TRENDS_REVENUE_BY_OUTLET: TrendOutletSeries[] = [
  { outlet: 'Bar', values: [47878, 37598, 49818, 48341, 57423, 42691, 53151, 64406, 62704, 68545, 91882, 59102, 90024] },
  { outlet: 'Flock', values: [2807, 3633, 2832, 4547, 4434, 2718, 4032, 5193, 5137, 5427, 7159, 4156, 5944] },
  { outlet: 'Opa', values: [3038, 3630, 3963, 4984, 5222, 3611, 5012, 6206, 5906, 6497, 7326, 4653, 6274] },
  { outlet: 'Dough', values: [2599, 2832, 2715, 3992, 4154, 2817, 3351, 4151, 3741, 4311, 6095, 3090, 5700] },
  { outlet: 'Other', values: [174, 1021, 261, 43, 322, 220, 260, 152, 267, 306, 841, 558, 470] },
  { outlet: 'Total', values: [56497, 48714, 59589, 61907, 71555, 52057, 65806, 80107, 77755, 85086, 113303, 71559, 108412] },
];

// ---------------------------------------------------------------------------
// HEATMAPS sheet -- six variance grids (All, Bar, Flock, Opa, Dough, Other).
// 13 rows x 7 days each. Variance is `thisYear - priorYear` per day.
// Numbers are in full pounds.
// ---------------------------------------------------------------------------

export type OutletHeatmapRow = {
  weekEnding: string;
  priorYear: number;
  daily: [number, number, number, number, number, number, number];
  totalVar: number;
  thisYear: number;
  pctVar: number;
};

export type OutletHeatmap = {
  outlet: string;
  rows: OutletHeatmapRow[];
};

export const FIS_HEATMAPS: OutletHeatmap[] = [
  {
    outlet: 'All',
    rows: [
      { weekEnding: '22-Feb', priorYear: 58642, daily: [-206, 282, -5527, 5985, -1231, -711, -738], totalVar: -2145, thisYear: 56497, pctVar: -0.04 },
      { weekEnding: '1-Mar', priorYear: 46355, daily: [-1538, 245, 3698, -692, -1621, 2262, 6], totalVar: 2359, thisYear: 48714, pctVar: 0.05 },
      { weekEnding: '8-Mar', priorYear: 80964, daily: [-488, -7529, 2211, -651, -1268, -8246, -5405], totalVar: -21375, thisYear: 59589, pctVar: -0.26 },
      { weekEnding: '15-Mar', priorYear: 70219, daily: [-837, -210, -2633, 3764, -297, 6743, -14842], totalVar: -8311, thisYear: 61907, pctVar: -0.12 },
      { weekEnding: '22-Mar', priorYear: 53891, daily: [0, 2454, 4280, 555, -1195, 5421, 6148], totalVar: 17664, thisYear: 71555, pctVar: 0.33 },
      { weekEnding: '29-Mar', priorYear: 53107, daily: [0, -1312, -2974, 2407, -1177, 4073, -2066], totalVar: -1050, thisYear: 52057, pctVar: -0.02 },
      { weekEnding: '5-Apr', priorYear: 97023, daily: [-1419, 1617, -2717, -1588, -6798, -14080, -6232], totalVar: -31217, thisYear: 65806, pctVar: -0.32 },
      { weekEnding: '12-Apr', priorYear: 97385, daily: [1177, -4518, 4972, -6598, -7228, -5564, 480], totalVar: -17277, thisYear: 80107, pctVar: -0.18 },
      { weekEnding: '19-Apr', priorYear: 78730, daily: [-867, 2407, -7386, -5180, -2389, 7385, 5054], totalVar: -975, thisYear: 77755, pctVar: -0.01 },
      { weekEnding: '26-Apr', priorYear: 98722, daily: [-2195, -2096, 58, -2343, -5110, 1879, -3829], totalVar: -13636, thisYear: 85086, pctVar: -0.14 },
      { weekEnding: '3-May', priorYear: 129990, daily: [-2544, -8760, -7425, -2473, -2979, -3983, 11476], totalVar: -16687, thisYear: 113303, pctVar: -0.13 },
      { weekEnding: '10-May', priorYear: 88253, daily: [-619, 273, -2419, -1671, -6040, -1869, -4347], totalVar: -16694, thisYear: 71559, pctVar: -0.19 },
      { weekEnding: '17-May', priorYear: 101383, daily: [-1363, -4894, -6072, 29848, -409, -7372, -2707], totalVar: 7029, thisYear: 108412, pctVar: 0.07 },
    ],
  },
  {
    outlet: 'Bar',
    rows: [
      { weekEnding: '22-Feb', priorYear: 47297, daily: [-133, 364, -4425, 6339, -700, -588, -276], totalVar: 581, thisYear: 47878, pctVar: 0.01 },
      { weekEnding: '1-Mar', priorYear: 33775, daily: [-1104, -300, 3233, 186, -970, 2498, 278], totalVar: 3823, thisYear: 37598, pctVar: 0.11 },
      { weekEnding: '8-Mar', priorYear: 61740, daily: [-217, -6485, 2629, 1624, 77, -5317, -4233], totalVar: -11922, thisYear: 49818, pctVar: -0.19 },
      { weekEnding: '15-Mar', priorYear: 52972, daily: [-263, 486, -972, 1934, 64, 7145, -13024], totalVar: -4631, thisYear: 48341, pctVar: -0.09 },
      { weekEnding: '22-Mar', priorYear: 43401, daily: [0, 2469, 3719, -759, -1067, 5084, 4576], totalVar: 14022, thisYear: 57423, pctVar: 0.32 },
      { weekEnding: '29-Mar', priorYear: 43643, daily: [0, -991, -2175, 514, -702, 3896, -1494], totalVar: -952, thisYear: 42691, pctVar: -0.02 },
      { weekEnding: '5-Apr', priorYear: 77859, daily: [-1297, 1053, -1633, 24, -6439, -11661, -4757], totalVar: -24708, thisYear: 53151, pctVar: -0.32 },
      { weekEnding: '12-Apr', priorYear: 80387, daily: [452, -3205, 3841, -6739, -5738, -5148, 556], totalVar: -15981, thisYear: 64406, pctVar: -0.20 },
      { weekEnding: '19-Apr', priorYear: 60929, daily: [-576, 1702, -6333, -4090, -961, 7899, 4134], totalVar: 1775, thisYear: 62704, pctVar: 0.03 },
      { weekEnding: '26-Apr', priorYear: 78216, daily: [-863, -1390, -209, -957, -5405, 895, -1743], totalVar: -9671, thisYear: 68545, pctVar: -0.12 },
      { weekEnding: '3-May', priorYear: 103199, daily: [-2221, -8325, -6166, -2090, -3023, -744, 11252], totalVar: -11317, thisYear: 91882, pctVar: -0.11 },
      { weekEnding: '10-May', priorYear: 68235, daily: [-356, 432, -2065, 565, -4258, -665, -2784], totalVar: -9132, thisYear: 59102, pctVar: -0.13 },
      { weekEnding: '17-May', priorYear: 79772, daily: [-1098, -2908, -3930, 28567, -2954, -6005, -1420], totalVar: 10252, thisYear: 90024, pctVar: 0.13 },
    ],
  },
  {
    outlet: 'Flock',
    rows: [
      { weekEnding: '22-Feb', priorYear: 3753, daily: [-42, -27, -471, -279, -332, 205, 0], totalVar: -946, thisYear: 2807, pctVar: -0.25 },
      { weekEnding: '1-Mar', priorYear: 4110, daily: [-199, 0, 83, -136, -261, -80, 116], totalVar: -477, thisYear: 3633, pctVar: -0.12 },
      { weekEnding: '8-Mar', priorYear: 6112, daily: [-77, -559, -57, -480, -454, -1123, -531], totalVar: -3280, thisYear: 2832, pctVar: -0.54 },
      { weekEnding: '15-Mar', priorYear: 6919, daily: [-142, -229, -1411, 686, 48, -623, -701], totalVar: -2372, thisYear: 4547, pctVar: -0.34 },
      { weekEnding: '22-Mar', priorYear: 4025, daily: [0, -479, 180, 331, -203, -8, 588], totalVar: 409, thisYear: 4434, pctVar: 0.10 },
      { weekEnding: '29-Mar', priorYear: 2573, daily: [0, -146, -450, 681, -115, 182, -9], totalVar: 145, thisYear: 2718, pctVar: 0.06 },
      { weekEnding: '5-Apr', priorYear: 4891, daily: [-123, 259, 68, -130, -28, -906, 0], totalVar: -859, thisYear: 4032, pctVar: -0.18 },
      { weekEnding: '12-Apr', priorYear: 3627, daily: [209, 7, 738, 303, -278, 405, 182], totalVar: 1566, thisYear: 5193, pctVar: 0.43 },
      { weekEnding: '19-Apr', priorYear: 4825, daily: [0, 788, -299, 87, -423, -115, 275], totalVar: 312, thisYear: 5137, pctVar: 0.06 },
      { weekEnding: '26-Apr', priorYear: 5608, daily: [-365, -187, 115, -170, -243, 724, -57], totalVar: -181, thisYear: 5427, pctVar: -0.03 },
      { weekEnding: '3-May', priorYear: 7761, daily: [1, 175, -40, -7, -227, -542, 37], totalVar: -602, thisYear: 7159, pctVar: -0.08 },
      { weekEnding: '10-May', priorYear: 6270, daily: [-2, -71, 203, -695, -860, -458, -230], totalVar: -2113, thisYear: 4156, pctVar: -0.34 },
      { weekEnding: '17-May', priorYear: 6625, daily: [0, -809, -790, 1184, 988, -882, -372], totalVar: -681, thisYear: 5944, pctVar: -0.10 },
    ],
  },
  {
    outlet: 'Opa',
    rows: [
      { weekEnding: '22-Feb', priorYear: 3400, daily: [-18, 17, -266, -170, -24, 117, -16], totalVar: -362, thisYear: 3038, pctVar: -0.11 },
      { weekEnding: '1-Mar', priorYear: 4771, daily: [-111, 324, 199, -459, -852, -63, -178], totalVar: -1141, thisYear: 3630, pctVar: -0.24 },
      { weekEnding: '8-Mar', priorYear: 7628, daily: [-145, -309, -219, -1114, -512, -1262, -103], totalVar: -3665, thisYear: 3963, pctVar: -0.48 },
      { weekEnding: '15-Mar', priorYear: 5161, daily: [-277, -300, -155, 783, -287, 568, -509], totalVar: -177, thisYear: 4984, pctVar: -0.03 },
      { weekEnding: '22-Mar', priorYear: 6466, daily: [0, -210, -106, -143, -623, -661, 499], totalVar: -1244, thisYear: 5222, pctVar: -0.19 },
      { weekEnding: '29-Mar', priorYear: 3505, daily: [0, 43, -265, 786, -41, -153, -264], totalVar: 106, thisYear: 3611, pctVar: 0.03 },
      { weekEnding: '5-Apr', priorYear: 7404, daily: [0, 287, -485, -642, 183, -983, -752], totalVar: -2392, thisYear: 5012, pctVar: -0.32 },
      { weekEnding: '12-Apr', priorYear: 6664, daily: [0, -870, 469, 136, -326, -69, 200], totalVar: -458, thisYear: 6206, pctVar: -0.07 },
      { weekEnding: '19-Apr', priorYear: 5485, daily: [0, 133, -43, -518, -543, 351, 1040], totalVar: 421, thisYear: 5906, pctVar: 0.08 },
      { weekEnding: '26-Apr', priorYear: 5813, daily: [-475, -150, 265, 42, 509, 1686, -1195], totalVar: 684, thisYear: 6497, pctVar: 0.12 },
      { weekEnding: '3-May', priorYear: 7934, daily: [0, -172, -225, 176, 586, -1066, 93], totalVar: -608, thisYear: 7326, pctVar: -0.08 },
      { weekEnding: '10-May', priorYear: 4929, daily: [-41, 325, 348, -279, -332, -202, -94], totalVar: -276, thisYear: 4653, pctVar: -0.06 },
      { weekEnding: '17-May', priorYear: 5393, daily: [0, -100, -706, 476, 952, 523, -263], totalVar: 881, thisYear: 6274, pctVar: 0.16 },
    ],
  },
  {
    outlet: 'Dough',
    rows: [
      { weekEnding: '22-Feb', priorYear: 2980, daily: [-13, -113, -370, 95, -142, 284, -121], totalVar: -380, thisYear: 2599, pctVar: -0.13 },
      { weekEnding: '1-Mar', priorYear: 3591, daily: [-116, 201, 143, -327, -225, -223, -211], totalVar: -759, thisYear: 2832, pctVar: -0.21 },
      { weekEnding: '8-Mar', priorYear: 5484, daily: [-48, -270, -185, -728, -434, -565, -538], totalVar: -2769, thisYear: 2715, pctVar: -0.50 },
      { weekEnding: '15-Mar', priorYear: 5167, daily: [-155, -188, -116, 361, -121, -347, -608], totalVar: -1175, thisYear: 3992, pctVar: -0.23 },
      { weekEnding: '22-Mar', priorYear: 0, daily: [0, 649, 450, 985, 633, 953, 485], totalVar: 4154, thisYear: 4154, pctVar: 0 },
      { weekEnding: '29-Mar', priorYear: 3387, daily: [0, -230, -84, 414, -439, 68, -299], totalVar: -570, thisYear: 2817, pctVar: -0.17 },
      { weekEnding: '5-Apr', priorYear: 5785, daily: [0, 215, -433, -829, -323, -432, -633], totalVar: -2435, thisYear: 3351, pctVar: -0.42 },
      { weekEnding: '12-Apr', priorYear: 5091, daily: [505, -220, 228, -100, -693, -359, -300], totalVar: -940, thisYear: 4151, pctVar: -0.18 },
      { weekEnding: '19-Apr', priorYear: 5576, daily: [-291, -127, -596, -666, 163, -86, -234], totalVar: -1835, thisYear: 3741, pctVar: -0.33 },
      { weekEnding: '26-Apr', priorYear: 5685, daily: [-321, -46, 83, -650, 228, -386, -282], totalVar: -1374, thisYear: 4311, pctVar: -0.24 },
      { weekEnding: '3-May', priorYear: 7041, daily: [-324, -55, -256, -191, 164, -634, 349], totalVar: -946, thisYear: 6095, pctVar: -0.13 },
      { weekEnding: '10-May', priorYear: 5082, daily: [-110, -59, -353, -614, -123, -159, -573], totalVar: -1992, thisYear: 3090, pctVar: -0.39 },
      { weekEnding: '17-May', priorYear: 5731, daily: [-266, -385, -56, -46, 1310, -296, -294], totalVar: -32, thisYear: 5700, pctVar: -0.01 },
    ],
  },
  {
    outlet: 'Other',
    rows: [
      { weekEnding: '22-Feb', priorYear: 1212, daily: [0, 41, 6, 0, -32, -728, -324], totalVar: -1038, thisYear: 174, pctVar: -0.86 },
      { weekEnding: '1-Mar', priorYear: 109, daily: [-8, 21, 40, 43, 686, 130, 0], totalVar: 913, thisYear: 1021, pctVar: 8.39 },
      { weekEnding: '8-Mar', priorYear: 0, daily: [0, 95, 43, 47, 54, 22, 0], totalVar: 261, thisYear: 261, pctVar: 0 },
      { weekEnding: '15-Mar', priorYear: 0, daily: [0, 22, 22, 0, 0, 0, 0], totalVar: 43, thisYear: 43, pctVar: 0 },
      { weekEnding: '22-Mar', priorYear: 0, daily: [0, 25, 38, 141, 65, 54, 0], totalVar: 322, thisYear: 322, pctVar: 0 },
      { weekEnding: '29-Mar', priorYear: 0, daily: [0, 11, 0, 11, 119, 79, 0], totalVar: 220, thisYear: 220, pctVar: 0 },
      { weekEnding: '5-Apr', priorYear: 1083, daily: [0, -197, -235, -10, -191, -98, -91], totalVar: -823, thisYear: 260, pctVar: -0.76 },
      { weekEnding: '12-Apr', priorYear: 1616, daily: [11, -232, -303, -198, -193, -393, -157], totalVar: -1464, thisYear: 152, pctVar: -0.91 },
      { weekEnding: '19-Apr', priorYear: 1915, daily: [0, -89, -115, 7, -625, -665, -161], totalVar: -1648, thisYear: 267, pctVar: -0.86 },
      { weekEnding: '26-Apr', priorYear: 3399, daily: [-171, -324, -197, -609, -200, -1041, -552], totalVar: -3093, thisYear: 306, pctVar: -0.91 },
      { weekEnding: '3-May', priorYear: 4055, daily: [0, -383, -739, -361, -479, -997, -255], totalVar: -3214, thisYear: 841, pctVar: -0.79 },
      { weekEnding: '10-May', priorYear: 3738, daily: [-109, -354, -551, -648, -467, -385, -666], totalVar: -3180, thisYear: 558, pctVar: -0.85 },
      { weekEnding: '17-May', priorYear: 3861, daily: [0, -692, -590, -333, -705, -713, -358], totalVar: -3391, thisYear: 470, pctVar: -0.88 },
    ],
  },
];



