import { parseCsv } from '@/lib/csv';
import type { Column, DataSource } from './types';
import { toNumber } from './types';

export type DailySalesByProductFamilyRow = {
  location: string;
  name: string;
  dm: string;
  business_date: string;
  family_group_name: string;
  major_group_name: string;
  brand: string;
  gross_sales: number | null;
  net_sales: number | null;
  qty: number | null;
  discounts: number | null;
  transaction_count: number | null;
};

export const DAILY_SALES_BY_PRODUCT_FAMILY_COLUMNS: Column[] = [
  { key: 'location', header: 'Location', type: 'string', defaultVisible: true, width: 100 },
  { key: 'name', header: 'Store', type: 'string', defaultVisible: true, width: 220 },
  { key: 'dm', header: 'DM', type: 'string', width: 160 },
  { key: 'business_date', header: 'Date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'major_group_name', header: 'Major group', type: 'string', defaultVisible: true, width: 150 },
  { key: 'family_group_name', header: 'Product family', type: 'string', defaultVisible: true, width: 180 },
  { key: 'brand', header: 'Brand', type: 'string', defaultVisible: true, width: 90 },
  { key: 'gross_sales', header: 'Gross sales', type: 'currency', defaultVisible: true, width: 130 },
  { key: 'net_sales', header: 'Net sales', type: 'currency', defaultVisible: true, width: 130 },
  { key: 'qty', header: 'Qty', type: 'integer', defaultVisible: true, width: 90 },
  { key: 'discounts', header: 'Discounts', type: 'currency', width: 120 },
  { key: 'transaction_count', header: 'Transactions', type: 'integer', defaultVisible: true, width: 130 },
];

function coerce(raw: Record<string, string>): DailySalesByProductFamilyRow {
  return {
    location: raw.location ?? '',
    name: raw.name ?? '',
    dm: raw.dm ?? '',
    business_date: raw.business_date ?? '',
    family_group_name: raw.family_group_name ?? '',
    major_group_name: raw.major_group_name ?? '',
    brand: raw.brand ?? '',
    gross_sales: toNumber(raw.gross_sales),
    net_sales: toNumber(raw.net_sales),
    qty: toNumber(raw.qty),
    discounts: toNumber(raw.discounts),
    transaction_count: toNumber(raw.transaction_count),
  };
}

let cache: Promise<DailySalesByProductFamilyRow[]> | null = null;

export function loadDailySalesByProductFamily(): Promise<DailySalesByProductFamilyRow[]> {
  if (!cache) {
    cache = fetch('/data/rpt_daily_sales_by_product_family.csv')
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            `Failed to load rpt_daily_sales_by_product_family.csv: ${res.status}`,
          );
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

export const dailySalesByProductFamilySource: DataSource<DailySalesByProductFamilyRow> = {
  id: 'dailySalesByProductFamily',
  label: 'Daily Sales By Location & Product Family',
  description:
    'Daily sales by store and product family — gross/net sales, quantity, discounts and transaction count.',
  load: loadDailySalesByProductFamily,
  columns: DAILY_SALES_BY_PRODUCT_FAMILY_COLUMNS,
  joinKey: { site: 'location', date: 'business_date' },
};
