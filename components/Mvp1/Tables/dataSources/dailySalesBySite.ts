import { parseCsv } from '@/lib/csv';
import type { Column, DataSource } from './types';
import { toNumber } from './types';

export type DailySalesBySiteRow = {
  location: string;
  name: string;
  dm: string;
  business_date: string;
  dd_sales: number | null;
  br_sales: number | null;
  total_sales: number | null;
  check_count: number | null;
};

export const DAILY_SALES_BY_SITE_COLUMNS: Column[] = [
  { key: 'location', header: 'Location', type: 'string', defaultVisible: true, width: 100, pinned: 'left' },
  { key: 'name', header: 'Store', type: 'string', defaultVisible: true, width: 220 },
  { key: 'dm', header: 'DM', type: 'string', defaultVisible: true, width: 160 },
  { key: 'business_date', header: 'Date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'dd_sales', header: 'DD sales', type: 'currency', defaultVisible: true, width: 120 },
  { key: 'br_sales', header: 'BR sales', type: 'currency', defaultVisible: true, width: 120 },
  { key: 'total_sales', header: 'Total sales', type: 'currency', defaultVisible: true, width: 130 },
  { key: 'check_count', header: 'Checks', type: 'integer', defaultVisible: true, width: 100 },
];

function coerce(raw: Record<string, string>): DailySalesBySiteRow {
  return {
    location: raw.location ?? '',
    name: raw.name ?? '',
    dm: raw.dm ?? '',
    business_date: raw.business_date ?? '',
    dd_sales: toNumber(raw.dd_sales),
    br_sales: toNumber(raw.br_sales),
    total_sales: toNumber(raw.total_sales),
    check_count: toNumber(raw.check_count),
  };
}

let cache: Promise<DailySalesBySiteRow[]> | null = null;

export function loadDailySalesBySite(): Promise<DailySalesBySiteRow[]> {
  if (!cache) {
    cache = fetch('/data/rpt_daily_sales_by_site.csv')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load rpt_daily_sales_by_site.csv: ${res.status}`);
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

export const dailySalesBySiteSource: DataSource<DailySalesBySiteRow> = {
  id: 'dailySalesBySite',
  label: 'Daily Sales By Location',
  description:
    'Daily sales totals per store — Dunkin Donuts and Baskin Robbins splits, total sales and check count.',
  load: loadDailySalesBySite,
  columns: DAILY_SALES_BY_SITE_COLUMNS,
  joinKey: { site: 'location', date: 'business_date' },
};
