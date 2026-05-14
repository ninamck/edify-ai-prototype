'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Filter,
  Pencil,
  X,
} from 'lucide-react';
import type { StockItem, StockStatus, StockItemType, StockCategory } from './status';
import {
  STATUS_CONFIG,
  STOCK_TYPE_CONFIG,
  STOCK_CATEGORIES,
  formatDaysCover,
  formatStock,
  formatStocktakeAge,
  getDaysCover,
  getStockStatus,
} from './status';

interface Props {
  items: StockItem[];
  onItemSelect: (item: StockItem) => void;
  onItemEdit: (id: string, patch: { currentStock?: number; stockUnit?: string }) => void;
}

type SortColumn =
  | 'name'
  | 'type'
  | 'category'
  | 'status'
  | 'currentStock'
  | 'parLevel'
  | 'daysCover'
  | 'linkedRecipeCount'
  | 'stockDataAgeDays';

type SortDir = 'asc' | 'desc';

interface SortState {
  column: SortColumn;
  dir: SortDir;
}

const STATUS_FILTER_OPTIONS: Array<{ value: StockStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'stockout', label: STATUS_CONFIG.stockout.label },
  { value: 'variance', label: STATUS_CONFIG.variance.label },
  { value: 'spoilage', label: STATUS_CONFIG.spoilage.label },
  { value: 'overstock', label: STATUS_CONFIG.overstock.label },
  { value: 'stale', label: STATUS_CONFIG.stale.label },
  { value: 'healthy', label: STATUS_CONFIG.healthy.label },
];

const TYPE_FILTER_OPTIONS: Array<{ value: StockItemType | 'all'; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'product', label: 'Product' },
  { value: 'master-product', label: 'Master product' },
  { value: 'recipe', label: 'Recipe' },
  { value: 'sub-recipe', label: 'Sub-recipe' },
];

// ─── Sort comparators ─────────────────────────────────────────────────────────
// Single classifier per column. Null/missing values sink to the bottom
// regardless of sort direction so the operator never gets a screen
// dominated by "—" rows.

function compareRows(
  a: StockItem,
  b: StockItem,
  column: SortColumn,
  dir: SortDir,
): number {
  const mul = dir === 'asc' ? 1 : -1;

  function nullableNumber(av: number | null, bv: number | null): number {
    if (av === null && bv === null) return 0;
    if (av === null) return 1; // sink nulls regardless of direction
    if (bv === null) return -1;
    return (av - bv) * mul;
  }

  switch (column) {
    case 'name':
      return a.name.localeCompare(b.name) * mul;
    case 'type':
      return STOCK_TYPE_CONFIG[a.type].label.localeCompare(
        STOCK_TYPE_CONFIG[b.type].label,
      ) * mul;
    case 'category':
      return a.category.localeCompare(b.category) * mul;
    case 'status': {
      const sa = STATUS_CONFIG[getStockStatus(a)].severity;
      const sb = STATUS_CONFIG[getStockStatus(b)].severity;
      return (sa - sb) * mul;
    }
    case 'currentStock':
      return (a.currentStock - b.currentStock) * mul;
    case 'parLevel':
      return nullableNumber(a.parLevel, b.parLevel);
    case 'daysCover':
      return nullableNumber(getDaysCover(a), getDaysCover(b));
    case 'linkedRecipeCount':
      return (a.linkedRecipeCount - b.linkedRecipeCount) * mul;
    case 'stockDataAgeDays':
      return (a.stockDataAgeDays - b.stockDataAgeDays) * mul;
  }
}

// The legacy table view — kept for lookup, demoted from the page's
// front door. Now carries the full column set, with sortable headers,
// click-to-edit value/unit cells, and a row click that hands off to
// the parent's item drawer.

// Top-level filter that sits above the table as a segmented pill,
// matching the All/Completed/Needs review pattern used on the
// Stocktake list. These are *quick filters* — common slicings that
// don't fit naturally as a column-level filter:
//
//   • below-min   — items where current stock < par level (par must
//                   be set; items without par are excluded).
//   • above-min   — par-set items at or above par.
//   • high-value  — top 10 items by unit price at this site, matching
//                   the seeded "High-value items" group definition.
//   • perishables — Dairy / Produce / Seafood / Meat / Prepared,
//                   matching the seeded "Perishables" group.
//
// All other filters (column popovers, search) layer on top.
type QuickFilter =
  | 'all'
  | 'below-min'
  | 'above-min'
  | 'high-value'
  | 'perishables';

const QUICK_FILTER_OPTIONS: Array<{ value: QuickFilter; label: string }> = [
  { value: 'all',         label: 'All' },
  { value: 'below-min',   label: 'Below Min' },
  { value: 'above-min',   label: 'Above Min' },
  { value: 'high-value',  label: 'High Value Items' },
  { value: 'perishables', label: 'Perishables' },
];

const PERISHABLE_CATEGORIES: ReadonlySet<StockCategory> = new Set<StockCategory>([
  'Dairy',
  'Produce',
  'Seafood',
  'Meat',
  'Prepared',
]);

const HIGH_VALUE_TOP_N = 10;

export default function AllItemsTable({ items, onItemSelect, onItemEdit }: Props) {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<StockItemType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<StockCategory | 'all'>('all');
  const [sort, setSort] = useState<SortState>({ column: 'name', dir: 'asc' });

  // Pre-compute the set of "high value" item ids — top N by unitPrice
  // (descending), null-priced items excluded. Memoised on `items` so
  // we don't re-sort on every keystroke in the column filters.
  const highValueIds = useMemo(() => {
    return new Set(
      items
        .filter(i => i.unitPrice !== null)
        .slice()
        .sort((a, b) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0))
        .slice(0, HIGH_VALUE_TOP_N)
        .map(i => i.id),
    );
  }, [items]);

  function passesQuickFilter(item: StockItem): boolean {
    switch (quickFilter) {
      case 'all':         return true;
      case 'below-min':   return item.parLevel !== null && item.currentStock < item.parLevel;
      case 'above-min':   return item.parLevel !== null && item.currentStock >= item.parLevel;
      case 'high-value':  return highValueIds.has(item.id);
      case 'perishables': return PERISHABLE_CATEGORIES.has(item.category);
    }
  }

  const rows = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const filtered = items
      .map(item => ({ item, status: getStockStatus(item) }))
      .filter(({ item, status }) => {
        if (!passesQuickFilter(item)) return false;
        if (statusFilter !== 'all' && status !== statusFilter) return false;
        if (typeFilter !== 'all' && item.type !== typeFilter) return false;
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (!lower) return true;
        return (
          item.name.toLowerCase().includes(lower) ||
          item.variant.toLowerCase().includes(lower) ||
          item.supplierName.toLowerCase().includes(lower) ||
          item.category.toLowerCase().includes(lower)
        );
      });
    filtered.sort((a, b) => compareRows(a.item, b.item, sort.column, sort.dir));
    return filtered;
    // passesQuickFilter is stable per (quickFilter, highValueIds) — both
    // are already in the deps, so no closure-capture issue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, statusFilter, typeFilter, categoryFilter, sort, quickFilter, highValueIds]);

  function toggleSort(column: SortColumn) {
    setSort(prev =>
      prev.column === column
        ? { column, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { column, dir: 'asc' },
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Single-shot stylesheet for the row hover state. Doing this in
          CSS removes one `onMouseEnter` + one `onMouseLeave` closure
          per row plus the imperative style writes they triggered, which
          on a 50-item site is ~100 listeners and a layout-thrashing
          inline-style mutation per pointer move. */}
      <style>{`
        .stock-row { transition: background 0.1s ease; }
        .stock-row:hover { background: var(--color-bg-hover); }
      `}</style>
      {/* Quick filter strip — segmented pill matching the
          All/Completed/Needs review pattern on the Stocktake list.
          Lives outside the table card so it reads as a top-level
          control rather than another column-level filter. */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          background: 'var(--color-bg-hover)',
          borderRadius: 100,
          padding: 3,
          width: 'fit-content',
          maxWidth: '100%',
          overflowX: 'auto',
        }}
      >
        {QUICK_FILTER_OPTIONS.map(opt => {
          const active = quickFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setQuickFilter(opt.value)}
              style={{
                padding: '6px 14px',
                borderRadius: 100,
                border: 'none',
                fontFamily: 'var(--font-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: active
                  ? 'var(--color-accent-active)'
                  : 'transparent',
                color: active ? '#fff' : 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          // overflowX: 'auto' only on narrow viewports — the explicit
          // column widths below are sized to fit the page's usable
          // width on desktop without a scrollbar.
          overflow: 'auto',
          background: '#fff',
        }}
      >
        <table
          style={{
            width: '100%',
            // table-layout: fixed lets us pin each column to a
            // deliberate width via the <col> widths below, so chip
            // cells don't bleed wider than their badge and the table
            // fits the page without horizontal scroll on desktop.
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            fontFamily: 'var(--font-primary)',
            fontSize: '13px',
          }}
        >
          {/* Per-column widths. Sized so every header label plus its
              filter funnel fit on one line, and chip-bearing cells
              (Type / Status) leave room for the widest chip without
              overflowing. Sum sits comfortably under the page
              container's usable width (1144px on a 1200px shell). */}
          <colgroup>
            <col style={{ width: 195 }} /> {/* Item */}
            <col style={{ width: 120 }} /> {/* Type */}
            <col style={{ width: 115 }} /> {/* Category */}
            <col style={{ width: 150 }} /> {/* Status */}
            <col style={{ width: 130 }} /> {/* On hand (value + unit) */}
            <col style={{ width: 60 }}  /> {/* Par */}
            <col style={{ width: 100 }} /> {/* Days cover */}
            <col style={{ width: 75 }}  /> {/* Recipes */}
            <col style={{ width: 92 }}  /> {/* Stocktake */}
            <col style={{ width: 90 }}  /> {/* Supplier */}
          </colgroup>
          <thead>
            {/* Single header row — each column header bundles its own
                sort handle (click the label) and, where applicable, a
                filter trigger (small funnel icon) that opens a
                popover with the filter for that column. The dedicated
                filter row that used to sit underneath is gone; this
                keeps the table density tight and stops the filter
                controls from competing with the data. */}
            <tr
              style={{
                background: 'var(--color-bg-hover)',
                color: 'var(--color-text-secondary)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <ColumnHeader
                label="Item"
                align="left"
                sortColumn="name"
                sort={sort}
                onSort={toggleSort}
                hasActiveFilter={query.trim() !== ''}
                renderFilter={() => (
                  <SearchFilterPopover
                    value={query}
                    onChange={setQuery}
                    onClear={() => setQuery('')}
                  />
                )}
              />
              <ColumnHeader
                label="Type"
                align="left"
                sortColumn="type"
                sort={sort}
                onSort={toggleSort}
                hasActiveFilter={typeFilter !== 'all'}
                renderFilter={() => (
                  <SelectFilterPopover
                    title="Type"
                    value={typeFilter}
                    onChange={v => setTypeFilter(v as StockItemType | 'all')}
                    options={TYPE_FILTER_OPTIONS}
                  />
                )}
              />
              <ColumnHeader
                label="Category"
                align="left"
                sortColumn="category"
                sort={sort}
                onSort={toggleSort}
                hasActiveFilter={categoryFilter !== 'all'}
                renderFilter={() => (
                  <SelectFilterPopover
                    title="Category"
                    value={categoryFilter}
                    onChange={v => setCategoryFilter(v as StockCategory | 'all')}
                    options={[
                      { value: 'all', label: 'All categories' },
                      ...STOCK_CATEGORIES.map(c => ({ value: c, label: c })),
                    ]}
                  />
                )}
              />
              <ColumnHeader
                label="Status"
                align="left"
                sortColumn="status"
                sort={sort}
                onSort={toggleSort}
                hasActiveFilter={statusFilter !== 'all'}
                renderFilter={() => (
                  <SelectFilterPopover
                    title="Status"
                    value={statusFilter}
                    onChange={v => setStatusFilter(v as StockStatus | 'all')}
                    options={STATUS_FILTER_OPTIONS}
                  />
                )}
              />
              <ColumnHeader
                label="On hand"
                align="right"
                sortColumn="currentStock"
                sort={sort}
                onSort={toggleSort}
              />
              <ColumnHeader
                label="Par"
                align="right"
                sortColumn="parLevel"
                sort={sort}
                onSort={toggleSort}
              />
              <ColumnHeader
                label="Days cover"
                align="right"
                sortColumn="daysCover"
                sort={sort}
                onSort={toggleSort}
              />
              <ColumnHeader
                label="Recipes"
                align="right"
                sortColumn="linkedRecipeCount"
                sort={sort}
                onSort={toggleSort}
              />
              <ColumnHeader
                label="Stocktake"
                align="left"
                sortColumn="stockDataAgeDays"
                sort={sort}
                onSort={toggleSort}
              />
              <Th align="left">Supplier</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  No items match the current filters.
                </td>
              </tr>
            )}
            {rows.map(({ item, status }) => {
              const statusConfig = STATUS_CONFIG[status];
              const typeConfig = STOCK_TYPE_CONFIG[item.type];
              const daysCover = getDaysCover(item);
              return (
                <tr
                  key={item.id}
                  className="stock-row"
                  onClick={() => onItemSelect(item)}
                  style={{
                    borderTop: '1px solid var(--color-border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  <Td>
                    <div
                      style={{
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--color-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={item.variant}
                    >
                      {item.variant}
                    </div>
                  </Td>
                  <Td>
                    <Chip
                      bg={typeConfig.chipBg}
                      fg={typeConfig.chipText}
                      border={typeConfig.chipBorder}
                    >
                      {typeConfig.label}
                    </Chip>
                  </Td>
                  <Td truncate title={item.category}>{item.category}</Td>
                  <Td>
                    <Chip
                      bg={statusConfig.chipBg}
                      fg={statusConfig.chipText}
                      border={statusConfig.chipBorder}
                    >
                      {statusConfig.label}
                    </Chip>
                  </Td>
                  {/* Combined value + unit cell. The number and the
                      unit are each independently editable, but they
                      sit on one line so the column reads as a normal
                      "on hand" measurement at a glance. */}
                  <Td align="right">
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        justifyContent: 'flex-end',
                      }}
                    >
                      <EditableNumberCell
                        value={item.currentStock}
                        unit={item.stockUnit}
                        onSave={next => onItemEdit(item.id, { currentStock: next })}
                      />
                      <EditableUnitCell
                        value={item.stockUnit}
                        options={[item.stockUnit, ...item.alternateUnits.filter(u => u !== item.stockUnit)]}
                        onSave={next => onItemEdit(item.id, { stockUnit: next })}
                      />
                    </span>
                  </Td>
                  <Td align="right">
                    {item.parLevel !== null
                      ? formatStock(item.parLevel, item.stockUnit)
                      : '—'}
                  </Td>
                  <Td align="right">{formatDaysCover(daysCover)}</Td>
                  <Td align="right">{item.linkedRecipeCount}</Td>
                  <Td truncate>{formatStocktakeAge(item.stockDataAgeDays)}</Td>
                  <Td truncate title={item.supplierName}>{item.supplierName}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Header cells ─────────────────────────────────────────────────────────────

function Th({
  children,
  align = 'left',
  ...rest
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  'aria-label'?: string;
}) {
  return (
    <th
      aria-label={rest['aria-label']}
      style={{
        textAlign: align,
        padding: '8px 10px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

// ─── Column header ──────────────────────────────────────────────────────────
// One component for every header cell that does anything interactive:
//
//   • Sort handle on the label (click to toggle asc → desc → asc).
//   • Optional filter trigger (funnel icon) that opens a popover with
//     that column's filter UI. When the column has a non-default
//     filter value, the trigger paints with the accent fill so the
//     active filter is visible at a glance.
//
// The popover closes on outside-click and Escape. It anchors below
// the trigger; for right-aligned columns the popover hugs the right
// edge of the wrapper so it stays inside the viewport.
function ColumnHeader({
  label,
  align,
  sortColumn,
  sort,
  onSort,
  renderFilter,
  hasActiveFilter,
}: {
  label: string;
  align: 'left' | 'right';
  sortColumn?: SortColumn;
  sort?: SortState;
  onSort?: (c: SortColumn) => void;
  renderFilter?: () => React.ReactNode;
  hasActiveFilter?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const sortable = sortColumn !== undefined && sort !== undefined && onSort !== undefined;
  const active = sortable && sort!.column === sortColumn;

  return (
    <th
      style={{
        textAlign: align,
        padding: '8px 10px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      <span
        ref={wrapperRef}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* Sort handle — clicking the label toggles sort. Stays a
            plain text run when the column isn't sortable. */}
        <span
          onClick={sortable ? () => onSort!(sortColumn!) : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            cursor: sortable ? 'pointer' : 'default',
            color: active ? 'var(--color-text-primary)' : 'inherit',
          }}
        >
          {label}
          {active &&
            (sort!.dir === 'asc' ? (
              <ChevronUp size={12} strokeWidth={2} />
            ) : (
              <ChevronDown size={12} strokeWidth={2} />
            ))}
        </span>

        {/* Filter trigger — only rendered when the column has a
            filter. Active state borrows the accent fill so the user
            can spot which columns are currently filtered. */}
        {renderFilter && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setOpen(v => !v);
            }}
            aria-label={`Filter ${label}`}
            aria-expanded={open}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              padding: 0,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              background: hasActiveFilter
                ? 'var(--color-accent-active)'
                : 'transparent',
              color: hasActiveFilter ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            <Filter size={12} strokeWidth={2} />
          </button>
        )}

        {/* Popover. Anchored to the wrapper; flips to the right edge
            for right-aligned columns so it stays inside the cell. */}
        {open && renderFilter && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              [align === 'right' ? 'right' : 'left']: 0,
              marginTop: 6,
              zIndex: 50,
              minWidth: 200,
              background: '#fff',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-item)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
              padding: 10,
              textTransform: 'none',
              letterSpacing: 'normal',
              color: 'var(--color-text-primary)',
              fontSize: 13,
              fontWeight: 400,
            }}
          >
            {renderFilter()}
          </div>
        )}
      </span>
    </th>
  );
}

function Td({
  children,
  align = 'left',
  truncate = false,
  title,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  /** Clip + ellipsis the cell when content would overflow the column
   *  width. Used for free-text columns (Category, Supplier, Stocktake
   *  age) so chip columns don't bleed wider than their badge. */
  truncate?: boolean;
  title?: string;
}) {
  return (
    <td
      title={title}
      style={{
        textAlign: align,
        padding: '8px 10px',
        color: 'var(--color-text-primary)',
        verticalAlign: 'middle',
        ...(truncate
          ? {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }
          : null),
      }}
    >
      {children}
    </td>
  );
}

// Outlined chip — used in the All items table for both status and
// type cells. With ~12+ rows on screen the solid-fill version was too
// loud, so the chip now just borrows the colour for text + outline
// and keeps the background transparent. The `bg` / `border` props are
// accepted but ignored to keep the call sites identical to STATUS_CONFIG
// / STOCK_TYPE_CONFIG, which already provide all three values.
function Chip({
  children,
  fg,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
  border: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-badge)',
        background: 'transparent',
        color: fg,
        border: `1px solid ${fg}`,
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// ─── Filter popovers ─────────────────────────────────────────────────────────
// Two popover bodies, used as the `renderFilter` content for the
// ColumnHeader trigger. They share a common visual rhythm (header
// label on top, control(s) below) but differ in their primary UI:
// SearchFilterPopover hosts a free-text input, SelectFilterPopover
// hosts a vertical option list with checkmark for the active value.

function SearchFilterPopover({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PopoverTitle>Search items</PopoverTitle>
      <input
        type="text"
        value={value}
        autoFocus
        onChange={e => onChange(e.target.value)}
        placeholder="Name, variant, supplier…"
        style={{
          width: '100%',
          minWidth: 200,
          padding: '6px 10px',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          fontSize: 13,
          fontFamily: 'var(--font-primary)',
          background: '#fff',
          color: 'var(--color-text-primary)',
        }}
      />
      {value.trim() !== '' && (
        <button
          type="button"
          onClick={onClear}
          style={popoverClearBtnStyle}
        >
          Clear search
        </button>
      )}
    </div>
  );
}

function SelectFilterPopover({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <PopoverTitle>{title}</PopoverTitle>
      <div
        role="radiogroup"
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 240,
          overflowY: 'auto',
        }}
      >
        {options.map(opt => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                background: selected ? 'var(--color-bg-hover)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-primary)',
                fontSize: 13,
                color: 'var(--color-text-primary)',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                }}
              >
                {selected && (
                  <Check
                    size={14}
                    strokeWidth={3}
                    color="var(--color-accent-active)"
                  />
                )}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PopoverTitle({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </span>
  );
}

const popoverClearBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '4px 8px',
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  fontFamily: 'var(--font-primary)',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

// ─── Editable cells ───────────────────────────────────────────────────────────
// Both editors swallow row clicks so editing doesn't also open the
// drawer. Default state shows the value with a faint pencil affordance;
// click switches to an input, Enter / blur commits, Esc cancels.

function EditableNumberCell({
  value,
  unit,
  onSave,
}: {
  value: number;
  unit: string;
  onSave: (next: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value.toString());
      // Defer focus to the next tick so the input has mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing, value]);

  function commit() {
    const next = parseFloat(draft);
    if (!Number.isNaN(next) && next !== value) onSave(next);
    setEditing(false);
  }

  if (editing) {
    return (
      <span
        onClick={e => e.stopPropagation()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
      >
        <input
          ref={inputRef}
          type="number"
          step="0.1"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={commit}
          style={{
            width: '70px',
            padding: '4px 8px',
            border: '1px solid var(--color-accent-active)',
            borderRadius: 6,
            fontSize: '13px',
            fontFamily: 'var(--font-primary)',
            textAlign: 'right',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{unit}</span>
        <button
          type="button"
          onClick={commit}
          aria-label="Save"
          style={iconBtnStyle}
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancel"
          style={iconBtnStyle}
        >
          <X size={14} />
        </button>
      </span>
    );
  }

  // Trigger shows just the number — the unit is rendered by the
  // adjacent EditableUnitCell, so a duplicate unit label here would
  // be visual noise.
  const formattedValue = Number.isInteger(value) ? value.toString() : value.toFixed(1);

  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        setEditing(true);
      }}
      style={editTriggerStyle}
    >
      <span>{formattedValue}</span>
      <Pencil
        size={12}
        strokeWidth={2}
        color="var(--color-text-secondary)"
        style={{ opacity: 0.45 }}
      />
    </button>
  );
}

function EditableUnitCell({
  value,
  options,
  onSave,
}: {
  value: string;
  options: string[];
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={value}
        onClick={e => e.stopPropagation()}
        onChange={e => {
          const next = e.target.value;
          if (next !== value) onSave(next);
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        style={{
          padding: '4px 8px',
          border: '1px solid var(--color-accent-active)',
          borderRadius: 6,
          fontSize: '13px',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        setEditing(true);
      }}
      style={editTriggerStyle}
    >
      <span>{value}</span>
      <Pencil
        size={12}
        strokeWidth={2}
        color="var(--color-text-secondary)"
        style={{ opacity: 0.45 }}
      />
    </button>
  );
}

const editTriggerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 8px',
  margin: '-4px -8px',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '13px',
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
};

const iconBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};
