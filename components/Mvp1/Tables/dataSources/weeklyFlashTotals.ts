import { parseCsv } from '@/lib/csv';
import type { Column, DataSource } from './types';
import { toNumber } from './types';

export type WeeklyFlashTotalsRow = {
  week_number: number | null;
  week_start_date: string;
  week_end_date: string;
  ec_total: number | null;
  non_ec_total: number | null;
  overall_total: number | null;
};

export const WEEKLY_FLASH_TOTALS_COLUMNS: Column[] = [
  { key: 'week_number', header: 'Week No.', type: 'integer', defaultVisible: true, width: 90 },
  { key: 'week_start_date', header: 'Start Date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'week_end_date', header: 'End Date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'ec_total', header: 'EC total', type: 'currency', defaultVisible: true, width: 140 },
  { key: 'non_ec_total', header: 'Non-EC total', type: 'currency', defaultVisible: true, width: 150 },
  { key: 'overall_total', header: 'Overall total', type: 'currency', defaultVisible: true, width: 150 },
];

function coerce(raw: Record<string, string>): WeeklyFlashTotalsRow {
  return {
    week_number: toNumber(raw.week_number),
    week_start_date: raw.week_start_date ?? '',
    week_end_date: raw.week_end_date ?? '',
    ec_total: toNumber(raw.ec_total),
    non_ec_total: toNumber(raw.non_ec_total),
    overall_total: toNumber(raw.overall_total),
  };
}

let cache: Promise<WeeklyFlashTotalsRow[]> | null = null;

export function loadWeeklyFlashTotals(): Promise<WeeklyFlashTotalsRow[]> {
  if (!cache) {
    cache = fetch('/data/rpt_weekly_flash_report_totals.csv')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load rpt_weekly_flash_report_totals.csv: ${res.status}`);
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

export const weeklyFlashTotalsSource: DataSource<WeeklyFlashTotalsRow> = {
  id: 'weeklyFlashTotals',
  label: 'Weekly P&L Totals',
  description: 'Chain-wide weekly totals — EC, non-EC and overall sales by week.',
  load: loadWeeklyFlashTotals,
  columns: WEEKLY_FLASH_TOTALS_COLUMNS,
  joinKey: { date: 'week_start_date' },
};
