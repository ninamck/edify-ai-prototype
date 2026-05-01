import { parseCsv } from '@/lib/csv';
import type { Column, DataSource } from './types';
import { toNumber } from './types';

export type NdcpDivisionRow = {
  location: string;
  name: string;
  dm: string;
  invoice_date: string;
  division_code: number | null;
  division_description: string;
  amount: number | null;
  invoice_count: number | null;
};

export const NDCP_DIVISION_COLUMNS: Column[] = [
  { key: 'location', header: 'Location', type: 'string', defaultVisible: true, width: 100, pinned: 'left' },
  { key: 'name', header: 'Name', type: 'string', defaultVisible: true, width: 220 },
  { key: 'dm', header: 'DM', type: 'string', defaultVisible: true, width: 160 },
  { key: 'invoice_date', header: 'Invoice date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'division_code', header: 'Division #', type: 'integer', width: 100 },
  { key: 'division_description', header: 'Division', type: 'string', defaultVisible: true, width: 200 },
  { key: 'amount', header: 'Amount', type: 'currency', defaultVisible: true, width: 130 },
  { key: 'invoice_count', header: 'Invoices', type: 'integer', defaultVisible: true, width: 100 },
];

function coerce(raw: Record<string, string>): NdcpDivisionRow {
  return {
    location: raw.location ?? '',
    name: raw.name ?? '',
    dm: raw.dm ?? '',
    invoice_date: raw.invoice_date ?? '',
    division_code: toNumber(raw.division_code),
    division_description: raw.division_description ?? '',
    amount: toNumber(raw.amount),
    invoice_count: toNumber(raw.invoice_count),
  };
}

let cache: Promise<NdcpDivisionRow[]> | null = null;

export function loadNdcpDivisions(): Promise<NdcpDivisionRow[]> {
  if (!cache) {
    cache = fetch('/data/rpt_ndcp_daily_divisions_by_site.csv')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load rpt_ndcp_daily_divisions_by_site.csv: ${res.status}`);
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

export const ndcpDivisionsSource: DataSource<NdcpDivisionRow> = {
  id: 'ndcpDivisions',
  label: 'Daily Cost Per Location & NDCP Division',
  description: 'Daily NDCP invoice amounts and counts per store, broken out by division.',
  load: loadNdcpDivisions,
  columns: NDCP_DIVISION_COLUMNS,
  joinKey: { site: 'location', date: 'invoice_date' },
};
