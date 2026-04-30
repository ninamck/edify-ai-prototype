export type ColumnType = 'string' | 'number' | 'currency' | 'percent' | 'date' | 'integer';

export type Column = {
  key: string;
  header: string;
  type: ColumnType;
  defaultVisible?: boolean;
  width?: number;
  /** When 'left', the column stays glued to the left edge while other columns
   *  scroll horizontally beneath it. The DataTable handles z-index, opaque
   *  cell backgrounds, and a right divider automatically. */
  pinned?: 'left';
};

export type DataSourceId =
  | 'flashReport'
  | 'sales'
  | 'waste'
  | 'labour'
  | 'weeklyFlashTotals'
  | 'weeklySalesBySite'
  | 'foodSupplyCosts'
  | 'ndcpDivisions'
  | 'dailySalesByProductFamily'
  | 'weeklyLaborCosts'
  | 'dailySalesBySite'
  | 'dailyOperationsBySite';

export type DataSource<TRow extends Record<string, unknown> = Record<string, unknown>> = {
  id: DataSourceId;
  label: string;
  description?: string;
  load: () => Promise<TRow[]>;
  columns: Column[];
  // Suggested join keys when this source is mixed with others. Currently the
  // prototype only does inner joins and pairs left/right keys explicitly in the
  // query, but advertising the canonical key helps the query builder.
  joinKey?: { site?: string; date?: string };
};

export function formatCell(value: unknown, type: ColumnType): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'string' || type === 'date') return String(value);
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (type === 'integer') return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (type === 'currency') {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
  }
  if (type === 'percent') {
    return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function toNumber(v: string | undefined): number | null {
  if (v === undefined || v === null) return null;
  const trimmed = v.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
