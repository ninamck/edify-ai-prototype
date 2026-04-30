'use client';

import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Filter,
  Search,
} from 'lucide-react';
import { formatCell, type Column, type ColumnType } from './dataSources';

type Row = Record<string, unknown>;

type Props<TRow extends Row> = {
  columns: Column[];
  data: TRow[];
  loading?: boolean;
  error?: string | null;
  rightSlot?: ReactNode;
  header?: ReactNode;
};

const numberRangeFilter: FilterFn<Row> = (row, columnId, value) => {
  const v = row.getValue<number | null>(columnId);
  if (v === null || v === undefined || !Number.isFinite(v as number)) return false;
  const [min, max] = value as [number | null, number | null];
  if (min !== null && (v as number) < min) return false;
  if (max !== null && (v as number) > max) return false;
  return true;
};

const dateRangeFilter: FilterFn<Row> = (row, columnId, value) => {
  const v = row.getValue<string>(columnId) ?? '';
  const [from, to] = value as [string, string];
  if (from && v < from) return false;
  if (to && v > to) return false;
  return true;
};

const stringContainsFilter: FilterFn<Row> = (row, columnId, value) => {
  const v = row.getValue<string>(columnId) ?? '';
  return String(v).toLowerCase().includes(String(value).toLowerCase());
};

const FILTER_FNS = {
  numberRange: numberRangeFilter,
  dateRange: dateRangeFilter,
  stringContains: stringContainsFilter,
};

function pickFilterFn(type: ColumnType): keyof typeof FILTER_FNS {
  if (type === 'date') return 'dateRange';
  if (type === 'string') return 'stringContains';
  return 'numberRange';
}

function isEmptyFilter(type: ColumnType, raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  if (type === 'string') return String(raw).trim() === '';
  if (type === 'date') {
    const [from, to] = raw as [string, string];
    return !from && !to;
  }
  const [min, max] = raw as [number | null, number | null];
  return min === null && max === null;
}

export default function DataTable<TRow extends Row>({
  columns,
  data,
  loading,
  error,
  rightSlot,
  header,
}: Props<TRow>) {
  const initialVisibility = useMemo<VisibilityState>(() => {
    const map: VisibilityState = {};
    for (const col of columns) {
      map[col.key as string] = !!col.defaultVisible;
    }
    return map;
  }, [columns]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialVisibility);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [filterPopover, setFilterPopover] = useState<{
    columnId: string;
    rect: { top: number; left: number; bottom: number; right: number };
  } | null>(null);
  const columnsBtnRef = useRef<HTMLButtonElement | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (columnsBtnRef.current?.contains(t) || columnsMenuRef.current?.contains(t)) return;
      setColumnsMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setColumnsMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [columnsMenuOpen]);

  useEffect(() => {
    if (!filterPopover) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (filterPopoverRef.current?.contains(t)) return;
      const trigger = document.querySelector(
        `[data-filter-trigger="${filterPopover!.columnId}"]`,
      );
      if (trigger?.contains(t)) return;
      setFilterPopover(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFilterPopover(null);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [filterPopover]);

  const tableColumns = useMemo<ColumnDef<TRow>[]>(() => {
    return columns.map((col) => {
      const key = col.key as string;
      const def: ColumnDef<TRow> = {
        id: key,
        // Using accessorFn (not accessorKey) so keys with dots/spaces work as
        // literal property lookups instead of nested paths.
        accessorFn: (row: TRow) => (row as Record<string, unknown>)[key],
        header: col.header,
        size: col.width ?? 130,
        filterFn: pickFilterFn(col.type) as ColumnDef<TRow>['filterFn'],
        cell: (info) => formatCell(info.getValue(), col.type),
        sortingFn: col.type === 'string' || col.type === 'date' ? 'alphanumeric' : 'basic',
        sortUndefined: 'last',
      };
      return def;
    });
  }, [columns]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: (row, _columnId, value) => {
      const search = String(value).toLowerCase();
      if (!search) return true;
      return columns.some((col) => {
        const raw = row.original[col.key as string];
        if (raw === null || raw === undefined) return false;
        return String(raw).toLowerCase().includes(search);
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const colByKey = useMemo(() => {
    const map = new Map<string, Column>();
    for (const c of columns) map.set(c.key as string, c);
    return map;
  }, [columns]);

  const totalRows = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min(totalRows, (pageIndex + 1) * pageSize);
  const visibleColumnCount = table.getVisibleLeafColumns().length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: 'var(--font-primary)',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
      }}
    >
      {header && (
        <div
          style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#fff',
          }}
        >
          {header}
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 12px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-surface)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220 }}>
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              flex: 1,
              maxWidth: 320,
            }}
          >
            <Search
              size={13}
              strokeWidth={2.2}
              color="var(--color-text-muted)"
              style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search rows…"
              style={{
                width: '100%',
                padding: '7px 10px 7px 30px',
                fontSize: 12,
                fontFamily: 'var(--font-primary)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 8,
                background: '#fff',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {totalRows.toLocaleString()} rows
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {rightSlot}
          <div style={{ position: 'relative' }}>
            <button
              ref={columnsBtnRef}
              type="button"
              onClick={() => setColumnsMenuOpen((v) => !v)}
              style={pillButton(columnsMenuOpen)}
            >
              <Columns3 size={12} strokeWidth={2.2} color="var(--color-text-muted)" />
              <span>Columns ({visibleColumnCount}/{columns.length})</span>
            </button>
            {columnsMenuOpen && (
              <div
                ref={columnsMenuRef}
                role="menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 200,
                  width: 240,
                  maxHeight: 360,
                  overflowY: 'auto',
                  background: '#fff',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(58,48,40,0.12), 0 0 0 1px rgba(58,48,40,0.04)',
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 8px 6px',
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Show columns
                  </span>
                  <button
                    type="button"
                    onClick={() => table.resetColumnVisibility()}
                    style={{
                      all: 'unset',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--color-accent-active)',
                      cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                </div>
                {table.getAllLeafColumns().map((column) => {
                  const meta = colByKey.get(column.id);
                  return (
                    <label
                      key={column.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        color: 'var(--color-text-secondary)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLLabelElement).style.background = 'var(--color-bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLLabelElement).style.background = 'transparent';
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                      />
                      <span>{meta?.header ?? column.id}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflow: 'auto', maxHeight: 560, position: 'relative' }}>
        {loading ? (
          <div style={emptyState}>Loading data…</div>
        ) : error ? (
          <div style={{ ...emptyState, color: 'var(--color-accent-error, #b14b3b)' }}>
            {error}
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              minWidth: '100%',
              borderCollapse: 'separate',
              borderSpacing: 0,
              fontSize: 12,
              fontFamily: 'var(--font-primary)',
            }}
          >
            <thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: '#fff',
              }}
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const meta = colByKey.get(header.column.id);
                    const isSorted = header.column.getIsSorted();
                    const align = meta && meta.type !== 'string' && meta.type !== 'date' ? 'right' : 'left';
                    const filterValue = header.column.getFilterValue();
                    const hasFilter = filterValue !== undefined && filterValue !== '';
                    const isFilterOpen = filterPopover?.columnId === header.column.id;
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          isSorted === 'asc'
                            ? 'ascending'
                            : isSorted === 'desc'
                              ? 'descending'
                              : 'none'
                        }
                        style={{
                          width: header.getSize(),
                          minWidth: header.getSize(),
                          padding: 0,
                          background: 'var(--color-bg-surface)',
                          borderBottom: '1px solid var(--color-border-subtle)',
                          textAlign: align,
                          verticalAlign: 'middle',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
                            gap: 2,
                            padding: '4px 6px 4px 10px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            style={{
                              all: 'unset',
                              flex: 1,
                              minWidth: 0,
                              boxSizing: 'border-box',
                              padding: '4px 0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
                              gap: 6,
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: '0.02em',
                              color: 'var(--color-text-secondary)',
                              textTransform: 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </span>
                            <SortIndicator direction={isSorted} />
                          </button>
                          <button
                            type="button"
                            data-filter-trigger={header.column.id}
                            aria-label={hasFilter ? 'Edit filter' : 'Filter column'}
                            aria-haspopup="dialog"
                            aria-expanded={isFilterOpen}
                            title={hasFilter ? 'Edit filter' : 'Filter column'}
                            onClick={(e) => {
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              setFilterPopover((prev) =>
                                prev?.columnId === header.column.id
                                  ? null
                                  : {
                                      columnId: header.column.id,
                                      rect: {
                                        top: rect.top,
                                        bottom: rect.bottom,
                                        left: rect.left,
                                        right: rect.right,
                                      },
                                    },
                              );
                            }}
                            style={{
                              all: 'unset',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 22,
                              height: 22,
                              borderRadius: 4,
                              cursor: 'pointer',
                              color: hasFilter ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
                              background: hasFilter || isFilterOpen ? 'rgba(34,68,68,0.08)' : 'transparent',
                              flexShrink: 0,
                              position: 'relative',
                            }}
                            onMouseEnter={(e) => {
                              if (!hasFilter && !isFilterOpen) {
                                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!hasFilter && !isFilterOpen) {
                                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                              }
                            }}
                          >
                            <Filter
                              size={11}
                              strokeWidth={hasFilter ? 2.6 : 2.2}
                              fill={hasFilter ? 'currentColor' : 'none'}
                            />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnCount} style={emptyState}>
                    No rows match your filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      background: idx % 2 === 0 ? '#fff' : 'rgba(58,48,40,0.018)',
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = colByKey.get(cell.column.id);
                      const align = meta && meta.type !== 'string' && meta.type !== 'date' ? 'right' : 'left';
                      return (
                        <td
                          key={cell.id}
                          style={{
                            padding: '7px 10px',
                            borderBottom: '1px solid var(--color-border-faint, rgba(58,48,40,0.06))',
                            color: 'var(--color-text-primary)',
                            textAlign: align,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: cell.column.getSize(),
                            fontVariantNumeric: align === 'right' ? 'tabular-nums' : 'normal',
                          }}
                          title={String(cell.getValue() ?? '')}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderTop: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-surface)',
          fontSize: 11,
          color: 'var(--color-text-muted)',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            style={{
              fontFamily: 'var(--font-primary)',
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 6px',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 6,
              background: '#fff',
              color: 'var(--color-text-secondary)',
            }}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>
            {start.toLocaleString()}–{end.toLocaleString()} of {totalRows.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            style={iconButton(!table.getCanPreviousPage())}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            style={iconButton(!table.getCanNextPage())}
            aria-label="Next page"
          >
            <ChevronRight size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {filterPopover &&
        (() => {
          const column = table.getColumn(filterPopover.columnId);
          const meta = colByKey.get(filterPopover.columnId);
          if (!column || !meta) return null;
          return (
            <FilterPopover
              ref={filterPopoverRef}
              anchor={filterPopover.rect}
              header={meta.header}
              type={meta.type}
              value={column.getFilterValue()}
              onChange={(v) => column.setFilterValue(v)}
              onClear={() => column.setFilterValue(undefined)}
              onClose={() => setFilterPopover(null)}
            />
          );
        })()}
    </div>
  );
}

function SortIndicator({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') {
    return <ArrowUp size={11} strokeWidth={2.4} color="var(--color-text-secondary)" />;
  }
  if (direction === 'desc') {
    return <ArrowDown size={11} strokeWidth={2.4} color="var(--color-text-secondary)" />;
  }
  return <ArrowUpDown size={11} strokeWidth={2.0} color="var(--color-text-muted)" />;
}

type FilterPopoverProps = {
  anchor: { top: number; bottom: number; left: number; right: number };
  header: string;
  type: ColumnType;
  value: unknown;
  onChange: (v: unknown) => void;
  onClear: () => void;
  onClose: () => void;
};

const FilterPopover = forwardRef<HTMLDivElement, FilterPopoverProps>(function FilterPopover(
  { anchor, header, type, value, onChange, onClear, onClose },
  ref,
) {
  const POPOVER_WIDTH = 240;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const left = Math.max(8, Math.min(anchor.left, viewportWidth - POPOVER_WIDTH - 8));
  const top = anchor.bottom + 6;

  const inputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    fontSize: 12,
    fontFamily: 'var(--font-primary)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 6,
    background: '#fff',
    color: 'var(--color-text-primary)',
    outline: 'none',
  };

  const hasValue = !isEmptyFilter(type, value);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Filter ${header}`}
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 400,
        width: POPOVER_WIDTH,
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        boxShadow: '0 10px 32px rgba(58,48,40,0.14), 0 0 0 1px rgba(58,48,40,0.04)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        fontFamily: 'var(--font-primary)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          Filter · {header}
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasValue}
          style={{
            all: 'unset',
            fontSize: 11,
            fontWeight: 600,
            color: hasValue ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
            cursor: hasValue ? 'pointer' : 'not-allowed',
            opacity: hasValue ? 1 : 0.5,
          }}
        >
          Clear
        </button>
      </div>

      {type === 'string' && (
        <input
          autoFocus
          type="text"
          placeholder={`Contains…`}
          value={(value as string) ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? undefined : v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onClose();
          }}
          style={inputStyle}
        />
      )}

      {type === 'date' &&
        (() => {
          const [from, to] = (value as [string, string]) ?? ['', ''];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DateRangeRow
                label="From"
                value={from ?? ''}
                onChange={(v) => {
                  const next: [string, string] = [v, to ?? ''];
                  onChange(isEmptyFilter(type, next) ? undefined : next);
                }}
                inputStyle={inputStyle}
              />
              <DateRangeRow
                label="To"
                value={to ?? ''}
                onChange={(v) => {
                  const next: [string, string] = [from ?? '', v];
                  onChange(isEmptyFilter(type, next) ? undefined : next);
                }}
                inputStyle={inputStyle}
              />
            </div>
          );
        })()}

      {type !== 'string' && type !== 'date' && (() => {
        const [min, max] = (value as [number | null, number | null]) ?? [null, null];
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              autoFocus
              type="number"
              placeholder="min"
              value={min === null ? '' : min}
              onChange={(e) => {
                const v = e.target.value === '' ? null : Number(e.target.value);
                const next: [number | null, number | null] = [v, max];
                onChange(isEmptyFilter(type, next) ? undefined : next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onClose();
              }}
              style={inputStyle}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>to</span>
            <input
              type="number"
              placeholder="max"
              value={max === null ? '' : max}
              onChange={(e) => {
                const v = e.target.value === '' ? null : Number(e.target.value);
                const next: [number | null, number | null] = [min, v];
                onChange(isEmptyFilter(type, next) ? undefined : next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onClose();
              }}
              style={inputStyle}
            />
          </div>
        );
      })()}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            all: 'unset',
            padding: '6px 12px',
            borderRadius: 6,
            background: 'var(--color-accent-active)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
});

function DateRangeRow({
  label,
  value,
  onChange,
  inputStyle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputStyle: CSSProperties;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          width: 36,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

function pillButton(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 100,
    border: '1px solid var(--color-border-subtle)',
    background: active ? 'rgba(34,68,68,0.06)' : '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--font-primary)',
    fontSize: 11,
    fontWeight: 600,
    color: active ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
  };
}

function iconButton(disabled: boolean): CSSProperties {
  return {
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: 6,
    border: '1px solid var(--color-border-subtle)',
    background: disabled ? 'transparent' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
    opacity: disabled ? 0.5 : 1,
  };
}

const emptyState: CSSProperties = {
  padding: 28,
  textAlign: 'center',
  color: 'var(--color-text-muted)',
  fontSize: 12,
};
