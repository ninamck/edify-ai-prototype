import {
  DATA_SOURCES,
  type Column,
  type ColumnType,
  type DataSource,
  type DataSourceId,
} from './dataSources';

export type AggKind = 'sum' | 'avg' | 'count' | 'min' | 'max';

export type FieldRef = {
  // Optional source qualifier when the same key exists in multiple sources.
  source?: DataSourceId;
  key: string;
};

export type FilterOp =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in';

export type Filter = {
  field: FieldRef;
  op: FilterOp;
  value: unknown;
};

export type FieldColumnSpec = {
  kind: 'field';
  field: FieldRef;
  header?: string;
  // Override formatting type if needed; otherwise inherited from source.
  type?: ColumnType;
  width?: number;
};

export type AggColumnSpec = {
  kind: 'agg';
  agg: AggKind;
  field: FieldRef;
  header: string;
  type?: ColumnType;
  width?: number;
};

export type ColumnSpec = FieldColumnSpec | AggColumnSpec;

export type JoinSpec = {
  // Implicit "left" is the previous source in the query's `sources` list, so
  // we only need the right source and the column pairs that are equal.
  rightSource: DataSourceId;
  on: Array<{ leftKey: string; rightKey: string }>;
};

export type SortSpec = { key: string; dir: 'asc' | 'desc' };

export type TableQuery = {
  sources: DataSourceId[];
  // Per-source row filters applied before joining (recommended for perf when
  // the source data is large).
  prefilter?: Partial<Record<DataSourceId, Filter[]>>;
  joins?: JoinSpec[];
  // Column projections. If omitted, all columns from the first source are
  // returned (visibility defaults preserved).
  columns?: ColumnSpec[];
  filters?: Filter[];
  groupBy?: FieldRef[];
  sort?: SortSpec[];
  limit?: number;
};

export type RunQueryResult = {
  columns: Column[];
  rows: Record<string, unknown>[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fieldToOutKey(field: FieldRef): string {
  return field.source ? `${field.source}.${field.key}` : field.key;
}

function getColumnMeta(field: FieldRef): Column | null {
  // When source is qualified, look it up there. Otherwise, fall back to the
  // first source whose schema contains the key.
  if (field.source) {
    const src = DATA_SOURCES[field.source];
    return src.columns.find((c) => c.key === field.key) ?? null;
  }
  for (const id of Object.keys(DATA_SOURCES) as DataSourceId[]) {
    const found = DATA_SOURCES[id].columns.find((c) => c.key === field.key);
    if (found) return found;
  }
  return null;
}

function readField(row: Record<string, unknown>, field: FieldRef): unknown {
  const qualified = fieldToOutKey(field);
  if (qualified in row) return row[qualified];
  return row[field.key];
}

function applyFilter(row: Record<string, unknown>, filter: Filter): boolean {
  const v = readField(row, filter.field);
  switch (filter.op) {
    case 'equals':
      return v === filter.value;
    case 'not_equals':
      return v !== filter.value;
    case 'contains':
      return String(v ?? '').toLowerCase().includes(String(filter.value ?? '').toLowerCase());
    case 'gt':
      return typeof v === 'number' && typeof filter.value === 'number' && v > filter.value;
    case 'gte':
      return typeof v === 'number' && typeof filter.value === 'number' && v >= filter.value;
    case 'lt':
      return typeof v === 'number' && typeof filter.value === 'number' && v < filter.value;
    case 'lte':
      return typeof v === 'number' && typeof filter.value === 'number' && v <= filter.value;
    case 'between': {
      const [min, max] = filter.value as [number | string | null, number | string | null];
      if (min != null && (v as number | string) < min) return false;
      if (max != null && (v as number | string) > max) return false;
      return true;
    }
    case 'in': {
      const list = filter.value as unknown[];
      return Array.isArray(list) && list.includes(v);
    }
    default:
      return true;
  }
}

function qualifyRow(
  row: Record<string, unknown>,
  source: DataSource,
): Record<string, unknown> {
  // Produce a row whose keys are both bare and `<source>.<key>` qualified, so
  // downstream code can address columns either way after a join.
  const out: Record<string, unknown> = { ...row };
  for (const k of Object.keys(row)) {
    out[`${source.id}.${k}`] = row[k];
  }
  return out;
}

function joinRows(
  left: Record<string, unknown>[],
  right: Record<string, unknown>[],
  rightSource: DataSource,
  on: Array<{ leftKey: string; rightKey: string }>,
): Record<string, unknown>[] {
  // Inner join. Build an index over `right` by the composite key and probe
  // from `left`.
  const index = new Map<string, Record<string, unknown>[]>();
  for (const r of right) {
    const key = on.map((p) => String(r[p.rightKey] ?? r[`${rightSource.id}.${p.rightKey}`] ?? '')).join('|');
    const bucket = index.get(key);
    if (bucket) bucket.push(r);
    else index.set(key, [r]);
  }
  const out: Record<string, unknown>[] = [];
  for (const l of left) {
    const key = on.map((p) => String(l[p.leftKey] ?? '')).join('|');
    const matches = index.get(key);
    if (!matches) continue;
    for (const m of matches) {
      // Right-source-qualified keys win on collision; the left side's bare
      // keys are preserved.
      out.push({ ...l, ...m });
    }
  }
  return out;
}

function applyAggregation(
  rows: Record<string, unknown>[],
  groupBy: FieldRef[],
  columns: ColumnSpec[],
): Record<string, unknown>[] {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = groupBy.map((g) => String(readField(row, g) ?? '')).join('||');
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const out: Record<string, unknown>[] = [];
  for (const bucket of groups.values()) {
    const first = bucket[0];
    const result: Record<string, unknown> = {};
    for (const g of groupBy) {
      result[fieldToOutKey(g)] = readField(first, g);
    }
    for (const col of columns) {
      if (col.kind === 'field') {
        // Pass-through fields in a group take the first row's value (caller
        // shouldn't ask for a field outside the group keys, but tolerate it).
        if (!groupBy.some((g) => fieldToOutKey(g) === fieldToOutKey(col.field))) {
          result[fieldToOutKey(col.field)] = readField(first, col.field);
        }
        continue;
      }
      const values = bucket
        .map((r) => readField(r, col.field))
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      let agg: number | null = null;
      switch (col.agg) {
        case 'count':
          agg = bucket.length;
          break;
        case 'sum':
          agg = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          agg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
          break;
        case 'min':
          agg = values.length ? Math.min(...values) : null;
          break;
        case 'max':
          agg = values.length ? Math.max(...values) : null;
          break;
      }
      result[col.header] = agg;
    }
    out.push(result);
  }
  return out;
}

function projectColumns(
  rows: Record<string, unknown>[],
  columns: ColumnSpec[],
  isAggregated: boolean,
): { columns: Column[]; rows: Record<string, unknown>[] } {
  const outCols: Column[] = columns.map((c) => {
    if (c.kind === 'agg') {
      const meta = getColumnMeta(c.field);
      return {
        key: c.header,
        header: c.header,
        type: c.type ?? meta?.type ?? 'number',
        defaultVisible: true,
        width: c.width ?? meta?.width,
      };
    }
    const meta = getColumnMeta(c.field);
    const outKey = fieldToOutKey(c.field);
    return {
      key: outKey,
      header: c.header ?? meta?.header ?? outKey,
      type: c.type ?? meta?.type ?? 'string',
      defaultVisible: meta?.defaultVisible ?? true,
      width: c.width ?? meta?.width,
    };
  });

  const outRows = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const outCol = outCols[i];
      if (col.kind === 'agg') {
        out[outCol.key] = row[col.header] ?? null;
      } else {
        out[outCol.key] = readField(row, col.field);
      }
    }
    return out;
  });

  void isAggregated;
  return { columns: outCols, rows: outRows };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runQuery(query: TableQuery): Promise<RunQueryResult> {
  if (query.sources.length === 0) {
    return { columns: [], rows: [] };
  }

  // 1. Load + prefilter each source.
  const sourceRowsById = new Map<DataSourceId, Record<string, unknown>[]>();
  for (const id of query.sources) {
    const src = DATA_SOURCES[id];
    const raw = (await src.load()) as Record<string, unknown>[];
    const filters = query.prefilter?.[id] ?? [];
    const filtered = filters.length
      ? raw.filter((r) => filters.every((f) => applyFilter(r, { ...f, field: { ...f.field, source: id } })))
      : raw;
    sourceRowsById.set(id, filtered.map((r) => qualifyRow(r, src)));
  }

  // 2. Join sources in declaration order. The first source forms the base; each
  //    subsequent join uses the previous accumulator as "left".
  let acc = sourceRowsById.get(query.sources[0]) ?? [];
  if (query.joins && query.joins.length > 0) {
    for (const join of query.joins) {
      const right = sourceRowsById.get(join.rightSource);
      if (!right) continue;
      const rightSrc = DATA_SOURCES[join.rightSource];
      acc = joinRows(acc, right, rightSrc, join.on);
    }
  }

  // 3. Post-join filters.
  if (query.filters && query.filters.length > 0) {
    acc = acc.filter((row) => query.filters!.every((f) => applyFilter(row, f)));
  }

  // 4. Group + aggregate, or just project.
  const defaultColumns: ColumnSpec[] = (() => {
    if (query.columns && query.columns.length > 0) return query.columns;
    const firstSrc = DATA_SOURCES[query.sources[0]];
    return firstSrc.columns.map((c) => ({
      kind: 'field' as const,
      field: { source: firstSrc.id, key: c.key },
      header: c.header,
      type: c.type,
      width: c.width,
    }));
  })();

  let projected: { columns: Column[]; rows: Record<string, unknown>[] };
  if (query.groupBy && query.groupBy.length > 0) {
    const aggregated = applyAggregation(acc, query.groupBy, defaultColumns);
    projected = projectColumns(aggregated, defaultColumns, true);
  } else {
    projected = projectColumns(acc, defaultColumns, false);
  }

  // 5. Sort.
  if (query.sort && query.sort.length > 0) {
    const sortSpecs = query.sort;
    projected.rows.sort((a, b) => {
      for (const s of sortSpecs) {
        const av = a[s.key];
        const bv = b[s.key];
        if (av === bv) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp =
          typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv));
        return s.dir === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  // 6. Limit.
  if (typeof query.limit === 'number' && query.limit >= 0) {
    projected.rows = projected.rows.slice(0, query.limit);
  }

  // Preserve original visibility defaults from the first source for projected
  // field columns (so users see the same default columns as the legacy view).
  return projected;
}

// ---------------------------------------------------------------------------
// Convenience builders for callers that want a "the whole source" query.
// ---------------------------------------------------------------------------

export function fullSourceQuery(sourceId: DataSourceId): TableQuery {
  return { sources: [sourceId] };
}
