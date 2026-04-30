import { parseCsv } from '@/lib/csv';
import type { Column, DataSource } from './types';
import { toNumber } from './types';

export type DailyOperationsBySiteRow = {
  location: string;
  business_date: string;
  net_sales_total: number | null;
  item_discount_total: number | null;
  subtotal_discount_total: number | null;
  service_total: number | null;
  non_revenue_service_total: number | null;
  return_count: number | null;
  return_total: number | null;
  credit_total: number | null;
  change_in_grand_total: number | null;
  non_taxable_sales_total: number | null;
  taxable_sales_total: number | null;
  tax_exempt_sales_total: number | null;
  tax_collected_total: number | null;
  check_count: number | null;
  void_total: number | null;
  void_count: number | null;
  error_correction_total: number | null;
  error_correction_count: number | null;
  transaction_cancel_total: number | null;
  transaction_cancel_count: number | null;
  carryover_total: number | null;
  carryover_count: number | null;
  check_open_total: number | null;
  check_open_count: number | null;
  check_closed_total: number | null;
  check_closed_count: number | null;
  no_sales_count: number | null;
};

export const DAILY_OPERATIONS_BY_SITE_COLUMNS: Column[] = [
  { key: 'location', header: 'Location', type: 'string', defaultVisible: true, width: 100, pinned: 'left' },
  { key: 'business_date', header: 'Date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'net_sales_total', header: 'Net sales', type: 'currency', defaultVisible: true, width: 130 },
  { key: 'check_count', header: 'Checks', type: 'integer', defaultVisible: true, width: 100 },
  { key: 'item_discount_total', header: 'Item discounts', type: 'currency', defaultVisible: true, width: 140 },
  { key: 'subtotal_discount_total', header: 'Subtotal discounts', type: 'currency', width: 160 },
  { key: 'return_count', header: 'Returns (#)', type: 'integer', defaultVisible: true, width: 110 },
  { key: 'return_total', header: 'Returns ($)', type: 'currency', defaultVisible: true, width: 120 },
  { key: 'void_count', header: 'Voids (#)', type: 'integer', defaultVisible: true, width: 100 },
  { key: 'void_total', header: 'Voids ($)', type: 'currency', defaultVisible: true, width: 120 },
  { key: 'error_correction_count', header: 'Error corr. (#)', type: 'integer', width: 130 },
  { key: 'error_correction_total', header: 'Error corr. ($)', type: 'currency', width: 140 },
  { key: 'transaction_cancel_count', header: 'Cancels (#)', type: 'integer', width: 110 },
  { key: 'transaction_cancel_total', header: 'Cancels ($)', type: 'currency', width: 120 },
  { key: 'no_sales_count', header: 'No-sales', type: 'integer', defaultVisible: true, width: 100 },
  { key: 'service_total', header: 'Service', type: 'currency', width: 110 },
  { key: 'non_revenue_service_total', header: 'Non-rev service', type: 'currency', width: 140 },
  { key: 'credit_total', header: 'Credit', type: 'currency', width: 110 },
  { key: 'change_in_grand_total', header: 'Change in grand', type: 'currency', width: 140 },
  { key: 'non_taxable_sales_total', header: 'Non-taxable', type: 'currency', width: 130 },
  { key: 'taxable_sales_total', header: 'Taxable', type: 'currency', width: 120 },
  { key: 'tax_exempt_sales_total', header: 'Tax exempt', type: 'currency', width: 130 },
  { key: 'tax_collected_total', header: 'Tax collected', type: 'currency', width: 130 },
  { key: 'carryover_total', header: 'Carryover ($)', type: 'currency', width: 130 },
  { key: 'carryover_count', header: 'Carryover (#)', type: 'integer', width: 130 },
  { key: 'check_open_total', header: 'Open ($)', type: 'currency', width: 110 },
  { key: 'check_open_count', header: 'Open (#)', type: 'integer', width: 100 },
  { key: 'check_closed_total', header: 'Closed ($)', type: 'currency', width: 110 },
  { key: 'check_closed_count', header: 'Closed (#)', type: 'integer', width: 100 },
];

function coerce(raw: Record<string, string>): DailyOperationsBySiteRow {
  return {
    location: raw.location ?? '',
    business_date: raw.business_date ?? '',
    net_sales_total: toNumber(raw.net_sales_total),
    item_discount_total: toNumber(raw.item_discount_total),
    subtotal_discount_total: toNumber(raw.subtotal_discount_total),
    service_total: toNumber(raw.service_total),
    non_revenue_service_total: toNumber(raw.non_revenue_service_total),
    return_count: toNumber(raw.return_count),
    return_total: toNumber(raw.return_total),
    credit_total: toNumber(raw.credit_total),
    change_in_grand_total: toNumber(raw.change_in_grand_total),
    non_taxable_sales_total: toNumber(raw.non_taxable_sales_total),
    taxable_sales_total: toNumber(raw.taxable_sales_total),
    tax_exempt_sales_total: toNumber(raw.tax_exempt_sales_total),
    tax_collected_total: toNumber(raw.tax_collected_total),
    check_count: toNumber(raw.check_count),
    void_total: toNumber(raw.void_total),
    void_count: toNumber(raw.void_count),
    error_correction_total: toNumber(raw.error_correction_total),
    error_correction_count: toNumber(raw.error_correction_count),
    transaction_cancel_total: toNumber(raw.transaction_cancel_total),
    transaction_cancel_count: toNumber(raw.transaction_cancel_count),
    carryover_total: toNumber(raw.carryover_total),
    carryover_count: toNumber(raw.carryover_count),
    check_open_total: toNumber(raw.check_open_total),
    check_open_count: toNumber(raw.check_open_count),
    check_closed_total: toNumber(raw.check_closed_total),
    check_closed_count: toNumber(raw.check_closed_count),
    no_sales_count: toNumber(raw.no_sales_count),
  };
}

let cache: Promise<DailyOperationsBySiteRow[]> | null = null;

export function loadDailyOperationsBySite(): Promise<DailyOperationsBySiteRow[]> {
  if (!cache) {
    cache = fetch('/data/rpt_daily_operations_by_site.csv')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load rpt_daily_operations_by_site.csv: ${res.status}`);
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

export const dailyOperationsBySiteSource: DataSource<DailyOperationsBySiteRow> = {
  id: 'dailyOperationsBySite',
  label: 'Operations Daily Totals',
  description:
    'Daily POS operations totals per store — net sales, discounts, voids, returns, cancels and check open/close balances.',
  load: loadDailyOperationsBySite,
  columns: DAILY_OPERATIONS_BY_SITE_COLUMNS,
  joinKey: { site: 'location', date: 'business_date' },
};
