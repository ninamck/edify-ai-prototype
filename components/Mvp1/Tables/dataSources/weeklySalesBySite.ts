import { parseCsv } from '@/lib/csv';
import type { Column, DataSource } from './types';
import { toNumber } from './types';

export type WeeklySalesBySiteRow = {
  location: string;
  name: string;
  dm: string;
  year: number | null;
  week_number: number | null;
  week_start_date: string;
  week_end_date: string;
  dd_sales: number | null;
  dd_ly_pct: number | null;
  br_sales: number | null;
  br_ly_pct: number | null;
  total_sales: number | null;
  total_sales_ly: number | null;
  total_sales_ly_pct: number | null;
  customer_count: number | null;
  customer_count_ly_pct: number | null;
  average_ticket: number | null;
  average_ticket_ly_pct: number | null;
};

export const WEEKLY_SALES_BY_SITE_COLUMNS: Column[] = [
  { key: 'location', header: 'Location', type: 'string', width: 90, pinned: 'left' },
  { key: 'name', header: 'Store', type: 'string', defaultVisible: true, width: 220 },
  { key: 'dm', header: 'DM', type: 'string', defaultVisible: true, width: 160 },
  { key: 'year', header: 'Year', type: 'integer', width: 80 },
  { key: 'week_number', header: 'Week No.', type: 'integer', width: 90 },
  { key: 'week_start_date', header: 'Start Date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'week_end_date', header: 'End Date', type: 'date', width: 120 },
  { key: 'dd_sales', header: 'DD sales', type: 'currency', defaultVisible: true, width: 120 },
  { key: 'dd_ly_pct', header: 'DD LY %', type: 'percent', width: 100 },
  { key: 'br_sales', header: 'BR sales', type: 'currency', width: 120 },
  { key: 'br_ly_pct', header: 'BR LY %', type: 'percent', width: 100 },
  { key: 'total_sales', header: 'Total sales', type: 'currency', defaultVisible: true, width: 130 },
  { key: 'total_sales_ly', header: 'Total sales LY', type: 'currency', width: 140 },
  { key: 'total_sales_ly_pct', header: 'Total LY %', type: 'percent', defaultVisible: true, width: 110 },
  { key: 'customer_count', header: 'Customers', type: 'integer', defaultVisible: true, width: 120 },
  { key: 'customer_count_ly_pct', header: 'Customers LY %', type: 'percent', width: 140 },
  { key: 'average_ticket', header: 'Avg ticket', type: 'currency', defaultVisible: true, width: 120 },
  { key: 'average_ticket_ly_pct', header: 'Avg ticket LY %', type: 'percent', width: 140 },
];

function coerce(raw: Record<string, string>): WeeklySalesBySiteRow {
  return {
    location: raw.location ?? '',
    name: raw.name ?? '',
    dm: raw.dm ?? '',
    year: toNumber(raw.year),
    week_number: toNumber(raw.week_number),
    week_start_date: raw.week_start_date ?? '',
    week_end_date: raw.week_end_date ?? '',
    dd_sales: toNumber(raw.dd_sales),
    dd_ly_pct: toNumber(raw.dd_ly_pct),
    br_sales: toNumber(raw.br_sales),
    br_ly_pct: toNumber(raw.br_ly_pct),
    total_sales: toNumber(raw.total_sales),
    total_sales_ly: toNumber(raw.total_sales_ly),
    total_sales_ly_pct: toNumber(raw.total_sales_ly_pct),
    customer_count: toNumber(raw.customer_count),
    customer_count_ly_pct: toNumber(raw.customer_count_ly_pct),
    average_ticket: toNumber(raw.average_ticket),
    average_ticket_ly_pct: toNumber(raw.average_ticket_ly_pct),
  };
}

let cache: Promise<WeeklySalesBySiteRow[]> | null = null;

export function loadWeeklySalesBySite(): Promise<WeeklySalesBySiteRow[]> {
  if (!cache) {
    cache = fetch('/data/rpt_weekly_sales_by_site.csv')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load rpt_weekly_sales_by_site.csv: ${res.status}`);
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

export const weeklySalesBySiteSource: DataSource<WeeklySalesBySiteRow> = {
  id: 'weeklySalesBySite',
  label: 'Weekly Sales',
  description: 'Per-store weekly sales breakdown — DD, BR, totals, customer count and avg ticket vs last year.',
  load: loadWeeklySalesBySite,
  columns: WEEKLY_SALES_BY_SITE_COLUMNS,
  joinKey: { site: 'location', date: 'week_start_date' },
};
