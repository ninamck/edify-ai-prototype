'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Plus, Trash2, X, Play, ListChecks, Database } from 'lucide-react';
import {
  ALL_SOURCE_IDS,
  DATA_SOURCES,
  type Column,
  type DataSourceId,
} from './dataSources';
import {
  runQuery,
  type AggKind,
  type ColumnSpec,
  type FieldRef,
  type Filter,
  type FilterOp,
  type JoinSpec,
  type SortSpec,
  type TableQuery,
} from './query';
import DataTable from './DataTable';

type Props = {
  open: boolean;
  initialQuery?: TableQuery;
  initialTitle?: string;
  onClose: () => void;
  onSave: (next: { title?: string; query: TableQuery }) => void;
};

type DraftFilter = Filter & { id: string };
type DraftAgg = { id: string; key: string; agg: AggKind; header: string };
type DraftSort = SortSpec & { id: string };

const FILTER_OPS: { op: FilterOp; label: string }[] = [
  { op: 'equals', label: '=' },
  { op: 'not_equals', label: '≠' },
  { op: 'contains', label: 'contains' },
  { op: 'gt', label: '>' },
  { op: 'gte', label: '≥' },
  { op: 'lt', label: '<' },
  { op: 'lte', label: '≤' },
];

const AGG_OPS: AggKind[] = ['sum', 'avg', 'count', 'min', 'max'];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function getSourceColumns(sourceId: DataSourceId): Column[] {
  return DATA_SOURCES[sourceId].columns;
}

function getNumericColumns(sourceIds: DataSourceId[]): { source: DataSourceId; column: Column }[] {
  const out: { source: DataSourceId; column: Column }[] = [];
  for (const s of sourceIds) {
    for (const c of getSourceColumns(s)) {
      if (c.type === 'number' || c.type === 'currency' || c.type === 'integer' || c.type === 'percent') {
        out.push({ source: s, column: c });
      }
    }
  }
  return out;
}

function getAllAvailableFields(sourceIds: DataSourceId[]): { source: DataSourceId; column: Column }[] {
  return sourceIds.flatMap((s) =>
    getSourceColumns(s).map((column) => ({ source: s, column })),
  );
}

function inferJoinKey(left: DataSourceId, right: DataSourceId): JoinSpec | null {
  const lJK = DATA_SOURCES[left].joinKey;
  const rJK = DATA_SOURCES[right].joinKey;
  if (!lJK || !rJK) return null;
  const on: JoinSpec['on'] = [];
  if (lJK.site && rJK.site) on.push({ leftKey: lJK.site, rightKey: rJK.site });
  if (lJK.date && rJK.date) on.push({ leftKey: lJK.date, rightKey: rJK.date });
  if (on.length === 0) return null;
  return { rightSource: right, on };
}

export default function TableBuilderModal({
  open,
  initialQuery,
  initialTitle,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState(initialTitle ?? '');
  const [sourceIds, setSourceIds] = useState<DataSourceId[]>(
    initialQuery?.sources ?? ['sales'],
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => initialColumnKeys(initialQuery));
  const [filters, setFilters] = useState<DraftFilter[]>(initialFilters(initialQuery));
  const [groupBy, setGroupBy] = useState<Set<string>>(() => initialGroupBy(initialQuery));
  const [aggs, setAggs] = useState<DraftAgg[]>(initialAggs(initialQuery));
  const [sorts, setSorts] = useState<DraftSort[]>(initialSorts(initialQuery));
  const [limit, setLimit] = useState<string>(initialQuery?.limit ? String(initialQuery.limit) : '');

  const [previewColumns, setPreviewColumns] = useState<Column[] | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Reset state when modal opens with a fresh initialQuery.
  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle ?? '');
    setSourceIds(initialQuery?.sources ?? ['sales']);
    setSelectedKeys(initialColumnKeys(initialQuery));
    setFilters(initialFilters(initialQuery));
    setGroupBy(initialGroupBy(initialQuery));
    setAggs(initialAggs(initialQuery));
    setSorts(initialSorts(initialQuery));
    setLimit(initialQuery?.limit ? String(initialQuery.limit) : '');
    setPreviewColumns(null);
    setPreviewRows(null);
    setPreviewError(null);
  }, [open, initialQuery, initialTitle]);

  const availableFields = useMemo(() => getAllAvailableFields(sourceIds), [sourceIds]);
  const numericFields = useMemo(() => getNumericColumns(sourceIds), [sourceIds]);

  const groupByActive = groupBy.size > 0;

  // Inferred joins between consecutive sources, displayed read-only for now.
  const joins: JoinSpec[] = useMemo(() => {
    if (sourceIds.length < 2) return [];
    const out: JoinSpec[] = [];
    for (let i = 1; i < sourceIds.length; i++) {
      const join = inferJoinKey(sourceIds[i - 1], sourceIds[i]);
      if (join) out.push(join);
    }
    return out;
  }, [sourceIds]);

  function buildQuery(): TableQuery {
    const fieldColumns: ColumnSpec[] = Array.from(selectedKeys).map((qualified) => {
      const [source, key] = qualified.split('.') as [DataSourceId, string];
      const meta = DATA_SOURCES[source]?.columns.find((c) => c.key === key);
      return {
        kind: 'field',
        field: { source, key },
        header: meta?.header,
        type: meta?.type,
        width: meta?.width,
      };
    });

    let columns: ColumnSpec[];
    if (groupByActive) {
      const groupCols: ColumnSpec[] = Array.from(groupBy).map((qualified) => {
        const [source, key] = qualified.split('.') as [DataSourceId, string];
        const meta = DATA_SOURCES[source]?.columns.find((c) => c.key === key);
        return {
          kind: 'field',
          field: { source, key },
          header: meta?.header,
          type: meta?.type,
          width: meta?.width,
        };
      });
      const aggCols: ColumnSpec[] = aggs
        .filter((a) => a.key && a.header.trim())
        .map((a) => {
          const [source, key] = a.key.split('.') as [DataSourceId, string];
          const meta = DATA_SOURCES[source]?.columns.find((c) => c.key === key);
          return {
            kind: 'agg',
            agg: a.agg,
            field: { source, key },
            header: a.header.trim(),
            type: meta?.type,
            width: meta?.width,
          };
        });
      columns = [...groupCols, ...aggCols];
    } else {
      columns = fieldColumns;
    }

    return {
      sources: sourceIds,
      joins: joins.length > 0 ? joins : undefined,
      columns: columns.length > 0 ? columns : undefined,
      filters:
        filters.length > 0
          ? filters.map((f) => ({ field: f.field, op: f.op, value: f.value }))
          : undefined,
      groupBy: groupByActive
        ? Array.from(groupBy).map((qualified) => {
            const [source, key] = qualified.split('.') as [DataSourceId, string];
            return { source, key };
          })
        : undefined,
      sort:
        sorts.length > 0 ? sorts.map((s) => ({ key: s.key, dir: s.dir })) : undefined,
      limit: limit.trim() ? Math.max(0, parseInt(limit, 10) || 0) : undefined,
    };
  }

  async function handlePreview() {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const result = await runQuery(buildQuery());
      setPreviewColumns(result.columns);
      setPreviewRows(result.rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to run query';
      setPreviewError(msg);
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleSave() {
    onSave({ title: title.trim() || undefined, query: buildQuery() });
    onClose();
  }

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={dialog}>
        <header style={dialogHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={16} strokeWidth={2.2} color="var(--color-text-muted)" />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled table"
              style={titleInput}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={iconButton}
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        </header>

        <div style={dialogBody}>
          <Section title="1. Sources" hint="Pick one or more. Joining adds shared rows on site + date.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALL_SOURCE_IDS.map((id) => {
                const checked = sourceIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSourceIds((prev) => {
                        if (prev.includes(id)) {
                          return prev.length > 1 ? prev.filter((p) => p !== id) : prev;
                        }
                        return [...prev, id];
                      });
                      // When removing a source, prune dependent state.
                      setSelectedKeys((prev) => {
                        const next = new Set(prev);
                        for (const k of prev) {
                          if (k.startsWith(`${id}.`) && checked) next.delete(k);
                        }
                        return next;
                      });
                    }}
                    style={chip(checked)}
                  >
                    {DATA_SOURCES[id].label}
                  </button>
                );
              })}
            </div>
            {joins.length > 0 && (
              <div style={joinHintBox}>
                {joins.map((j, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Joining{' '}
                    <strong>{DATA_SOURCES[sourceIds[i]].label}</strong> ↔{' '}
                    <strong>{DATA_SOURCES[j.rightSource].label}</strong> on{' '}
                    {j.on.map((p) => `${p.leftKey} = ${p.rightKey}`).join(', ')}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="2. Columns"
            hint={
              groupByActive
                ? 'Group-by is active. Columns are determined by the group fields and aggregations below.'
                : 'Pick the fields to display. If you skip this, all default-visible columns are shown.'
            }
          >
            {groupByActive ? (
              <div style={mutedBox}>Set in section 4 (group-by + aggregations).</div>
            ) : (
              <div style={columnGrid}>
                {availableFields.map(({ source, column }) => {
                  const qualified = `${source}.${column.key}`;
                  const checked = selectedKeys.has(qualified);
                  return (
                    <label key={qualified} style={columnRow}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedKeys((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(qualified);
                            else next.delete(qualified);
                            return next;
                          });
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{column.header}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: 'var(--color-text-muted)',
                          marginLeft: 'auto',
                        }}
                      >
                        {DATA_SOURCES[source].label} · {column.type}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="3. Filters" hint="Drop rows that don't match.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filters.map((f) => (
                <FilterRow
                  key={f.id}
                  filter={f}
                  fields={availableFields}
                  onChange={(next) =>
                    setFilters((prev) => prev.map((p) => (p.id === f.id ? { ...next, id: f.id } : p)))
                  }
                  onRemove={() => setFilters((prev) => prev.filter((p) => p.id !== f.id))}
                />
              ))}
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => [
                    ...prev,
                    {
                      id: uid('flt'),
                      field: { source: sourceIds[0], key: availableFields[0]?.column.key ?? '' },
                      op: 'equals',
                      value: '',
                    },
                  ])
                }
                style={smallAddButton}
              >
                <Plus size={12} strokeWidth={2.4} />
                Add filter
              </button>
            </div>
          </Section>

          <Section
            title="4. Group by + aggregations"
            hint="Optional. Select the fields to group on, then pick what to aggregate."
          >
            <div style={columnGrid}>
              {availableFields.map(({ source, column }) => {
                const qualified = `${source}.${column.key}`;
                const checked = groupBy.has(qualified);
                return (
                  <label key={qualified} style={columnRow}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setGroupBy((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(qualified);
                          else next.delete(qualified);
                          return next;
                        });
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{column.header}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: 'var(--color-text-muted)',
                        marginLeft: 'auto',
                      }}
                    >
                      {DATA_SOURCES[source].label}
                    </span>
                  </label>
                );
              })}
            </div>

            {groupByActive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Aggregations
                </div>
                {aggs.map((a) => (
                  <AggRow
                    key={a.id}
                    agg={a}
                    fields={numericFields}
                    onChange={(next) =>
                      setAggs((prev) => prev.map((p) => (p.id === a.id ? { ...next, id: a.id } : p)))
                    }
                    onRemove={() => setAggs((prev) => prev.filter((p) => p.id !== a.id))}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const first = numericFields[0];
                    if (!first) return;
                    setAggs((prev) => [
                      ...prev,
                      {
                        id: uid('agg'),
                        key: `${first.source}.${first.column.key}`,
                        agg: 'sum',
                        header: `Sum of ${first.column.header}`,
                      },
                    ]);
                  }}
                  style={smallAddButton}
                >
                  <Plus size={12} strokeWidth={2.4} />
                  Add aggregation
                </button>
              </div>
            )}
          </Section>

          <Section title="5. Sort + limit" hint="Optional.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sorts.map((s) => (
                <SortRow
                  key={s.id}
                  sort={s}
                  fields={availableFields}
                  groupByActive={groupByActive}
                  aggs={aggs}
                  onChange={(next) =>
                    setSorts((prev) => prev.map((p) => (p.id === s.id ? { ...next, id: s.id } : p)))
                  }
                  onRemove={() => setSorts((prev) => prev.filter((p) => p.id !== s.id))}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  const first = availableFields[0];
                  if (!first) return;
                  setSorts((prev) => [
                    ...prev,
                    { id: uid('sort'), key: `${first.source}.${first.column.key}`, dir: 'desc' },
                  ]);
                }}
                style={smallAddButton}
              >
                <Plus size={12} strokeWidth={2.4} />
                Add sort
              </button>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                }}
              >
                Limit rows
                <input
                  type="number"
                  min={0}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="No limit"
                  style={{ ...textInput, width: 100 }}
                />
              </label>
            </div>
          </Section>

          <Section title="Preview">
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewLoading}
                style={primaryButton}
              >
                <Play size={12} strokeWidth={2.4} />
                {previewLoading ? 'Running…' : 'Run preview'}
              </button>
            </div>
            {previewError && (
              <div style={errorBox}>{previewError}</div>
            )}
            {previewColumns && previewRows && !previewError && (
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                <DataTable
                  columns={previewColumns}
                  data={previewRows}
                  loading={false}
                  error={null}
                />
              </div>
            )}
          </Section>
        </div>

        <footer style={dialogFooter}>
          <button type="button" onClick={onClose} style={ghostButton}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} style={primaryButton}>
            <ListChecks size={12} strokeWidth={2.4} />
            Save table
          </button>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
        {hint && (
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function FilterRow({
  filter,
  fields,
  onChange,
  onRemove,
}: {
  filter: DraftFilter;
  fields: { source: DataSourceId; column: Column }[];
  onChange: (next: Filter) => void;
  onRemove: () => void;
}) {
  const qualified = `${filter.field.source ?? fields[0]?.source}.${filter.field.key}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select
        value={qualified}
        onChange={(e) => {
          const [source, key] = e.target.value.split('.') as [DataSourceId, string];
          onChange({ ...filter, field: { source, key } });
        }}
        style={selectInput}
      >
        {fields.map(({ source, column }) => {
          const k = `${source}.${column.key}`;
          return (
            <option key={k} value={k}>
              {DATA_SOURCES[source].label} · {column.header}
            </option>
          );
        })}
      </select>
      <select
        value={filter.op}
        onChange={(e) => onChange({ ...filter, op: e.target.value as FilterOp })}
        style={{ ...selectInput, width: 120 }}
      >
        {FILTER_OPS.map((o) => (
          <option key={o.op} value={o.op}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={filter.value as string}
        onChange={(e) => {
          const raw = e.target.value;
          // Best-effort numeric coercion when the field is numeric-ish.
          const meta = fields.find((f) => `${f.source}.${f.column.key}` === qualified)?.column;
          const numericTypes = ['number', 'currency', 'integer', 'percent'];
          const numeric = meta && numericTypes.includes(meta.type) && raw.trim() !== '';
          onChange({ ...filter, value: numeric ? Number(raw) : raw });
        }}
        placeholder="value"
        style={{ ...textInput, flex: 1, minWidth: 80 }}
      />
      <button type="button" onClick={onRemove} style={iconButton} aria-label="Remove filter">
        <Trash2 size={12} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function AggRow({
  agg,
  fields,
  onChange,
  onRemove,
}: {
  agg: DraftAgg;
  fields: { source: DataSourceId; column: Column }[];
  onChange: (next: DraftAgg) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select
        value={agg.agg}
        onChange={(e) => onChange({ ...agg, agg: e.target.value as AggKind })}
        style={{ ...selectInput, width: 100 }}
      >
        {AGG_OPS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <select
        value={agg.key}
        onChange={(e) => {
          const [source, key] = e.target.value.split('.') as [DataSourceId, string];
          const meta = DATA_SOURCES[source]?.columns.find((c) => c.key === key);
          const newHeader =
            agg.header.startsWith('Sum of ') ||
            agg.header.startsWith('Avg of ') ||
            agg.header.startsWith('Count of ') ||
            agg.header.startsWith('Min of ') ||
            agg.header.startsWith('Max of ') ||
            agg.header === ''
              ? `${capitalize(agg.agg)} of ${meta?.header ?? key}`
              : agg.header;
          onChange({ ...agg, key: e.target.value, header: newHeader });
        }}
        style={selectInput}
      >
        {fields.map(({ source, column }) => {
          const k = `${source}.${column.key}`;
          return (
            <option key={k} value={k}>
              {DATA_SOURCES[source].label} · {column.header}
            </option>
          );
        })}
      </select>
      <input
        type="text"
        value={agg.header}
        onChange={(e) => onChange({ ...agg, header: e.target.value })}
        placeholder="Column header"
        style={{ ...textInput, flex: 1, minWidth: 100 }}
      />
      <button type="button" onClick={onRemove} style={iconButton} aria-label="Remove aggregation">
        <Trash2 size={12} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function SortRow({
  sort,
  fields,
  groupByActive,
  aggs,
  onChange,
  onRemove,
}: {
  sort: DraftSort;
  fields: { source: DataSourceId; column: Column }[];
  groupByActive: boolean;
  aggs: DraftAgg[];
  onChange: (next: SortSpec) => void;
  onRemove: () => void;
}) {
  // When grouping is active, sort options should match the projected output:
  // group fields + aggregation headers.
  const options = groupByActive
    ? [
        ...fields.map(({ source, column }) => ({
          value: `${source}.${column.key}`,
          label: `${DATA_SOURCES[source].label} · ${column.header}`,
        })),
        ...aggs.map((a) => ({ value: a.header, label: a.header })),
      ]
    : fields.map(({ source, column }) => ({
        value: `${source}.${column.key}`,
        label: `${DATA_SOURCES[source].label} · ${column.header}`,
      }));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select
        value={sort.key}
        onChange={(e) => onChange({ ...sort, key: e.target.value })}
        style={selectInput}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={sort.dir}
        onChange={(e) => onChange({ ...sort, dir: e.target.value as 'asc' | 'desc' })}
        style={{ ...selectInput, width: 110 }}
      >
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>
      <button type="button" onClick={onRemove} style={iconButton} aria-label="Remove sort">
        <Trash2 size={12} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// State init helpers (used both on mount and when initialQuery changes)
// ---------------------------------------------------------------------------

function initialColumnKeys(query?: TableQuery): Set<string> {
  if (!query?.columns) return new Set();
  const out = new Set<string>();
  for (const col of query.columns) {
    if (col.kind !== 'field') continue;
    const ref = col.field as FieldRef;
    if (!ref.source) continue;
    out.add(`${ref.source}.${ref.key}`);
  }
  return out;
}

function initialFilters(query?: TableQuery): DraftFilter[] {
  if (!query?.filters) return [];
  return query.filters.map((f) => ({ ...f, id: uid('flt') }));
}

function initialGroupBy(query?: TableQuery): Set<string> {
  if (!query?.groupBy) return new Set();
  const out = new Set<string>();
  for (const g of query.groupBy) {
    if (!g.source) continue;
    out.add(`${g.source}.${g.key}`);
  }
  return out;
}

function initialAggs(query?: TableQuery): DraftAgg[] {
  if (!query?.columns) return [];
  return query.columns
    .filter((c): c is Extract<ColumnSpec, { kind: 'agg' }> => c.kind === 'agg')
    .map((c) => ({
      id: uid('agg'),
      key: `${c.field.source ?? ''}.${c.field.key}`,
      agg: c.agg,
      header: c.header,
    }));
}

function initialSorts(query?: TableQuery): DraftSort[] {
  if (!query?.sort) return [];
  return query.sort.map((s) => ({ ...s, id: uid('sort') }));
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 500,
  background: 'rgba(20, 16, 12, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const dialog: CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  width: '100%',
  maxWidth: 880,
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(20,16,12,0.25)',
  fontFamily: 'var(--font-primary)',
};

const dialogHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 16px',
  borderBottom: '1px solid var(--color-border-subtle)',
};

const dialogBody: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '16px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 22,
};

const dialogFooter: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 16px',
  borderTop: '1px solid var(--color-border-subtle)',
  background: 'var(--color-bg-surface)',
};

const titleInput: CSSProperties = {
  all: 'unset',
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  flex: 1,
  minWidth: 200,
};

const iconButton: CSSProperties = {
  all: 'unset',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: 6,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  cursor: 'pointer',
  color: 'var(--color-text-muted)',
};

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 8,
  border: '1px solid var(--color-accent-active)',
  background: 'var(--color-accent-active)',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  fontSize: 12,
  fontWeight: 700,
};

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  fontSize: 12,
  fontWeight: 600,
};

const smallAddButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  alignSelf: 'flex-start',
  padding: '5px 10px',
  borderRadius: 100,
  border: '1px dashed var(--color-border-subtle)',
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  fontSize: 11,
  fontWeight: 600,
};

function chip(active: boolean): CSSProperties {
  return {
    all: 'unset',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: 999,
    border: active ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
    background: active ? 'var(--color-accent-active)' : '#fff',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    fontFamily: 'var(--font-primary)',
    fontSize: 12,
    fontWeight: 600,
  };
}

const columnGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 4,
};

const columnRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 6,
  background: 'var(--color-bg-surface)',
  cursor: 'pointer',
};

const selectInput: CSSProperties = {
  fontFamily: 'var(--font-primary)',
  fontSize: 12,
  padding: '5px 8px',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 6,
  background: '#fff',
  color: 'var(--color-text-primary)',
};

const textInput: CSSProperties = {
  fontFamily: 'var(--font-primary)',
  fontSize: 12,
  padding: '5px 8px',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 6,
  background: '#fff',
  color: 'var(--color-text-primary)',
  outline: 'none',
};

const mutedBox: CSSProperties = {
  padding: '8px 10px',
  background: 'var(--color-bg-surface)',
  border: '1px dashed var(--color-border-subtle)',
  borderRadius: 8,
  fontSize: 11,
  color: 'var(--color-text-muted)',
};

const joinHintBox: CSSProperties = {
  padding: '8px 10px',
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const errorBox: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  background: '#FFF1F0',
  color: '#A21D1D',
  border: '1px solid #FBC1B7',
  fontSize: 12,
};
