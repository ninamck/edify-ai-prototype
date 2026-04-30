import { parseCsv } from '@/lib/csv';
import type { Column, DataSource } from './types';
import { toNumber } from './types';

export type WeeklyLaborCostsRow = {
  location: string;
  dm: string;
  adp_payroll_year: number | null;
  adp_week_number: number | null;
  year: number | null;
  week_number: number | null;
  pay_period_end_date: string;
  associate_id: string;
  employee_name: string;
  regular_hours_total: number | null;
  regular_earnings_total: number | null;
  overtime_hours_total: number | null;
  overtime_earnings_total: number | null;
  other_hours_total: number | null;
  other_earnings_total: number | null;
  total_hours: number | null;
  gross_pay: number | null;
};

export const WEEKLY_LABOR_COSTS_COLUMNS: Column[] = [
  { key: 'location', header: 'Location', type: 'string', defaultVisible: true, width: 100, pinned: 'left' },
  { key: 'dm', header: 'DM', type: 'string', defaultVisible: true, width: 160 },
  { key: 'pay_period_end_date', header: 'Period end', type: 'date', defaultVisible: true, width: 130 },
  { key: 'week_number', header: 'Week No.', type: 'integer', defaultVisible: true, width: 90 },
  { key: 'year', header: 'Year', type: 'integer', width: 80 },
  { key: 'adp_week_number', header: 'ADP week', type: 'integer', width: 100 },
  { key: 'adp_payroll_year', header: 'ADP year', type: 'integer', width: 100 },
  { key: 'employee_name', header: 'Employee', type: 'string', defaultVisible: true, width: 200 },
  { key: 'associate_id', header: 'Associate ID', type: 'string', width: 170 },
  { key: 'regular_hours_total', header: 'Reg hrs', type: 'number', defaultVisible: true, width: 100 },
  { key: 'regular_earnings_total', header: 'Reg $', type: 'currency', defaultVisible: true, width: 110 },
  { key: 'overtime_hours_total', header: 'OT hrs', type: 'number', defaultVisible: true, width: 100 },
  { key: 'overtime_earnings_total', header: 'OT $', type: 'currency', defaultVisible: true, width: 110 },
  { key: 'other_hours_total', header: 'Other hrs', type: 'number', width: 110 },
  { key: 'other_earnings_total', header: 'Other $', type: 'currency', width: 110 },
  { key: 'total_hours', header: 'Total hrs', type: 'number', defaultVisible: true, width: 110 },
  { key: 'gross_pay', header: 'Gross pay', type: 'currency', defaultVisible: true, width: 120 },
];

function coerce(raw: Record<string, string>): WeeklyLaborCostsRow {
  return {
    location: raw.location ?? '',
    dm: raw.dm ?? '',
    adp_payroll_year: toNumber(raw.adp_payroll_year),
    adp_week_number: toNumber(raw.adp_week_number),
    year: toNumber(raw.year),
    week_number: toNumber(raw.week_number),
    pay_period_end_date: raw.pay_period_end_date ?? '',
    associate_id: raw.associate_id ?? '',
    employee_name: raw.employee_name ?? '',
    regular_hours_total: toNumber(raw.regular_hours_total),
    regular_earnings_total: toNumber(raw.regular_earnings_total),
    overtime_hours_total: toNumber(raw.overtime_hours_total),
    overtime_earnings_total: toNumber(raw.overtime_earnings_total),
    other_hours_total: toNumber(raw.other_hours_total),
    other_earnings_total: toNumber(raw.other_earnings_total),
    total_hours: toNumber(raw.total_hours),
    gross_pay: toNumber(raw.gross_pay),
  };
}

let cache: Promise<WeeklyLaborCostsRow[]> | null = null;

export function loadWeeklyLaborCosts(): Promise<WeeklyLaborCostsRow[]> {
  if (!cache) {
    cache = fetch('/data/rpt_weekly_labor_costs_by_site.csv')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load rpt_weekly_labor_costs_by_site.csv: ${res.status}`);
        }
        return res.text();
      })
      .then((text) => parseCsv(text).map(coerce))
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

export const weeklyLaborCostsSource: DataSource<WeeklyLaborCostsRow> = {
  id: 'weeklyLaborCosts',
  label: 'Labor Costs',
  description:
    'Weekly per-employee labor — regular, overtime and other hours plus earnings, with totals and gross pay.',
  load: loadWeeklyLaborCosts,
  columns: WEEKLY_LABOR_COSTS_COLUMNS,
  joinKey: { site: 'location', date: 'pay_period_end_date' },
};
