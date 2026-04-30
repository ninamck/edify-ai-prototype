import { parseCsv } from '@/lib/csv';
import type { Column, DataSource } from './types';
import { toNumber } from './types';

export type FlashReportRow = {
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
  food_supply_cost: number | null;
  food_supply_cost_sales_pct: number | null;
  labor_hours: number | null;
  labor_earnings: number | null;
  labor_sales_pct: number | null;
  total_royalty: number | null;
  royalty_sales_pct: number | null;
  customer_count: number | null;
  customer_count_ly_pct: number | null;
  average_ticket: number | null;
  average_ticket_ly_pct: number | null;
  store_margin: number | null;
  store_margin_sales_pct: number | null;
};

export const FLASH_REPORT_COLUMNS: Column[] = [
  { key: 'location', header: 'Location', type: 'string', width: 90 },
  { key: 'name', header: 'Store', type: 'string', defaultVisible: true, width: 220 },
  { key: 'dm', header: 'DM', type: 'string', defaultVisible: true, width: 160 },
  { key: 'year', header: 'Year', type: 'integer', width: 80 },
  { key: 'week_number', header: 'Week No.', type: 'integer', width: 90 },
  { key: 'week_start_date', header: 'Start Date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'week_end_date', header: 'End Date', type: 'date', width: 120 },
  { key: 'dd_sales', header: 'DD sales', type: 'currency', width: 120 },
  { key: 'dd_ly_pct', header: 'DD LY %', type: 'percent', width: 100 },
  { key: 'br_sales', header: 'BR sales', type: 'currency', width: 120 },
  { key: 'br_ly_pct', header: 'BR LY %', type: 'percent', width: 100 },
  { key: 'total_sales', header: 'Total sales', type: 'currency', defaultVisible: true, width: 130 },
  { key: 'total_sales_ly', header: 'Total sales LY', type: 'currency', width: 140 },
  { key: 'total_sales_ly_pct', header: 'Total LY %', type: 'percent', width: 110 },
  { key: 'food_supply_cost', header: 'Food cost', type: 'currency', width: 120 },
  {
    key: 'food_supply_cost_sales_pct',
    header: 'Food cost %',
    type: 'percent',
    defaultVisible: true,
    width: 120,
  },
  { key: 'labor_hours', header: 'Labor hours', type: 'number', width: 120 },
  { key: 'labor_earnings', header: 'Labor $', type: 'currency', width: 120 },
  { key: 'labor_sales_pct', header: 'Labor %', type: 'percent', defaultVisible: true, width: 110 },
  { key: 'total_royalty', header: 'Royalty', type: 'currency', width: 110 },
  { key: 'royalty_sales_pct', header: 'Royalty %', type: 'percent', width: 110 },
  { key: 'customer_count', header: 'Customers', type: 'integer', defaultVisible: true, width: 120 },
  { key: 'customer_count_ly_pct', header: 'Customers LY %', type: 'percent', width: 140 },
  { key: 'average_ticket', header: 'Avg ticket', type: 'currency', defaultVisible: true, width: 120 },
  { key: 'average_ticket_ly_pct', header: 'Avg ticket LY %', type: 'percent', width: 140 },
  { key: 'store_margin', header: 'Store margin', type: 'currency', defaultVisible: true, width: 130 },
  {
    key: 'store_margin_sales_pct',
    header: 'Margin %',
    type: 'percent',
    defaultVisible: true,
    width: 110,
  },
];

function coerce(raw: Record<string, string>): FlashReportRow {
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
    food_supply_cost: toNumber(raw.food_supply_cost),
    food_supply_cost_sales_pct: toNumber(raw.food_supply_cost_sales_pct),
    labor_hours: toNumber(raw.labor_hours),
    labor_earnings: toNumber(raw.labor_earnings),
    labor_sales_pct: toNumber(raw.labor_sales_pct),
    total_royalty: toNumber(raw.total_royalty),
    royalty_sales_pct: toNumber(raw.royalty_sales_pct),
    customer_count: toNumber(raw.customer_count),
    customer_count_ly_pct: toNumber(raw.customer_count_ly_pct),
    average_ticket: toNumber(raw.average_ticket),
    average_ticket_ly_pct: toNumber(raw.average_ticket_ly_pct),
    store_margin: toNumber(raw.store_margin),
    store_margin_sales_pct: toNumber(raw.store_margin_sales_pct),
  };
}

let cache: Promise<FlashReportRow[]> | null = null;

export function loadFlashReport(): Promise<FlashReportRow[]> {
  if (!cache) {
    cache = fetch('/data/flash_report.csv')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load flash_report.csv: ${res.status}`);
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

export const flashReportSource: DataSource<FlashReportRow> = {
  id: 'flashReport',
  label: 'Flash report',
  description: 'Weekly per-store performance snapshot (sales, food cost, labour, margin).',
  load: loadFlashReport,
  columns: FLASH_REPORT_COLUMNS,
  joinKey: { site: 'location', date: 'week_start_date' },
};
