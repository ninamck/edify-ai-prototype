'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { gbp } from './format';
import { rowHasInsight } from './insights';
import CountPicker, { LATEST } from './CountPicker';
import {
  COUNT_KIND_LABEL,
  DAY_LABELS,
  QUICK_COUNT_SESSIONS,
  getLatestCountRows,
  getQuickCountRows,
  type QuickCountRow,
} from './quickCounts';

const OK = 'var(--color-success)';
const WARN = 'var(--color-error)';

function qty(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

function varColor(n: number): string {
  if (n > 0) return WARN;
  if (n < 0) return OK;
  return 'var(--color-text-muted)';
}

type SortKey = keyof QuickCountRow;

const NUMERIC_KEYS: SortKey[] = [
  'unitCost',
  'openingStock',
  'purchases',
  'transfer',
  'waste',
  'theoUsage',
  'expectedStock',
  'countedStock',
  'stockValue',
  'prevCount',
  'varPrevQty',
  'varPrevCost',
  'varOpeningQty',
  'varOpeningCost',
  'varPct',
];

type Col = {
  key: SortKey;
  header: string;
  align: 'left' | 'right';
  render: (r: QuickCountRow) => React.ReactNode;
};

const COLS: Col[] = [
  { key: 'name', header: 'Name', align: 'left', render: (r) => r.name },
  { key: 'productClass', header: 'Product Class', align: 'left', render: (r) => r.productClass },
  { key: 'packType', header: 'Pack Type', align: 'left', render: (r) => r.packType },
  { key: 'unitCost', header: 'Unit Cost', align: 'right', render: (r) => gbp(r.unitCost) },
  { key: 'openingStock', header: 'Opening Stock', align: 'right', render: (r) => qty(r.openingStock) },
  { key: 'purchases', header: 'Purchases', align: 'right', render: (r) => qty(r.purchases) },
  { key: 'transfer', header: 'Transfer (+/\u2212)', align: 'right', render: (r) => qty(r.transfer) },
  { key: 'waste', header: 'Waste', align: 'right', render: (r) => qty(r.waste) },
  { key: 'theoUsage', header: 'Theo Usage', align: 'right', render: (r) => qty(r.theoUsage) },
  { key: 'expectedStock', header: 'Expected Stock', align: 'right', render: (r) => qty(r.expectedStock) },
  {
    key: 'countedStock',
    header: 'Counted Stock',
    align: 'right',
    render: (r) => <span style={{ fontWeight: 700 }}>{qty(r.countedStock)}</span>,
  },
  { key: 'stockValue', header: 'Stock Value', align: 'right', render: (r) => gbp(r.stockValue) },
  {
    key: 'prevCount',
    header: 'Previous Count',
    align: 'right',
    render: (r) => (
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.3 }}>
        {qty(r.prevCount)}
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {DAY_LABELS[r.prevDay]} {COUNT_KIND_LABEL[r.prevKind].toLowerCase()}
        </span>
      </span>
    ),
  },
  { key: 'varPrevQty', header: 'Var Qty vs Previous', align: 'right', render: (r) => qty(r.varPrevQty) },
  {
    key: 'varPrevCost',
    header: 'Var Cost vs Previous',
    align: 'right',
    render: (r) => <span style={{ fontWeight: 700, color: varColor(r.varPrevCost) }}>{gbp(r.varPrevCost)}</span>,
  },
  { key: 'varOpeningQty', header: 'Var Qty vs Opening', align: 'right', render: (r) => qty(r.varOpeningQty) },
  {
    key: 'varOpeningCost',
    header: 'Var Cost vs Opening',
    align: 'right',
    render: (r) => <span style={{ fontWeight: 700, color: varColor(r.varOpeningCost) }}>{gbp(r.varOpeningCost)}</span>,
  },
];

const TH_BASE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  padding: '10px 12px',
  whiteSpace: 'nowrap',
  background: 'var(--color-bg-hover)',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  userSelect: 'none',
};

const TD_BASE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  padding: '11px 12px',
  whiteSpace: 'nowrap',
};

export default function QuickCountVarianceTable({ onOpenDetail }: { onOpenDetail?: (rowId: string) => void }) {
  const [view, setView] = useState<string>(LATEST);
  const [search, setSearch] = useState('');
  const [largeOnly, setLargeOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('varPrevCost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const latest = view === LATEST;
  const session = QUICK_COUNT_SESSIONS.find((s) => s.id === view);
  const allRows = useMemo(() => (latest ? getLatestCountRows() : getQuickCountRows(view)), [latest, view]);

  const rows = useMemo(() => {
    let out = allRows.slice();
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.productClass.toLowerCase().includes(q) ||
          r.packType.toLowerCase().includes(q),
      );
    }
    if (largeOnly) out = out.filter((r) => Math.abs(r.varPct) >= 10);
    const numeric = NUMERIC_KEYS.includes(sortKey);
    out.sort((a, b) => {
      const cmp = numeric
        ? (a[sortKey] as number) - (b[sortKey] as number)
        : String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [allRows, search, largeOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function sortIcon(k: SortKey) {
    if (sortKey !== k) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  }

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.06)',
      }}
    >
      {/* Which count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          flexWrap: 'wrap',
        }}
      >
        <CountPicker value={view} onChange={setView} />
        <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
          {latest
            ? 'Each product from its most recent count, so rows can come from different nights.'
            : `Counted by ${session?.counter}.`}
        </span>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: '1 1 240px',
            minWidth: 200,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: '#fff',
          }}
        >
          <Search size={15} color="var(--color-text-muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            style={{
              border: 'none',
              outline: 'none',
              fontSize: 13,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
              background: 'transparent',
              width: '100%',
            }}
          />
        </div>

        <button
          type="button"
          aria-pressed={largeOnly}
          onClick={() => setLargeOnly((v) => !v)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: `1px solid ${largeOnly ? 'var(--color-accent-deep)' : 'var(--color-border)'}`,
            background: largeOnly ? 'var(--color-accent-deep)' : '#fff',
            color: largeOnly ? '#fff' : 'var(--color-text-secondary)',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Large variances only
        </button>

        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          {rows.length} of {allRows.length} products
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: '64vh', overflowY: 'auto', borderRadius: '0 0 12px 12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1900 }}>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  style={{
                    ...TH_BASE,
                    textAlign: c.align,
                    ...(c.key === 'name' ? { position: 'sticky', left: 0, zIndex: 2 } : null),
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      font: 'inherit',
                      color: 'inherit',
                      textTransform: 'inherit',
                      letterSpacing: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    {c.header}
                    {sortIcon(c.key)}
                  </button>
                </th>
              ))}
              <th scope="col" style={{ ...TH_BASE, textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => toggleSort('varPct')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    font: 'inherit',
                    color: 'inherit',
                    textTransform: 'inherit',
                    letterSpacing: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Var % {sortIcon('varPct')}
                </button>
              </th>
              <th scope="col" style={{ ...TH_BASE, textAlign: 'center' }}>Insight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--color-border-subtle)', background: '#fff' }}>
                {COLS.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      ...TD_BASE,
                      textAlign: c.align,
                      ...(c.key === 'name'
                        ? { position: 'sticky', left: 0, zIndex: 1, background: '#fff', fontWeight: 600 }
                        : null),
                    }}
                  >
                    {latest && c.key === 'countedStock' ? (
                      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.3 }}>
                        {c.render(r)}
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {DAY_LABELS[r.countDay]} {COUNT_KIND_LABEL[r.countKind].toLowerCase()}
                        </span>
                      </span>
                    ) : (
                      c.render(r)
                    )}
                  </td>
                ))}
                <td style={{ ...TD_BASE, textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: varColor(r.varPct),
                      background:
                        r.varPct > 0
                          ? 'var(--color-error-light)'
                          : r.varPct < 0
                            ? 'var(--color-success-light)'
                            : 'transparent',
                    }}
                  >
                    {r.varPct > 0 ? '+' : ''}
                    {r.varPct.toFixed(1)}%
                  </span>
                </td>
                <td style={{ ...TD_BASE, textAlign: 'center' }}>
                  {rowHasInsight(r.varPct, r.insightId) ? (
                    <button
                      type="button"
                      onClick={() => onOpenDetail?.(r.id)}
                      aria-label={`Edify insight for ${r.name}`}
                      title="Open Edify breakdown"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 999,
                        border: '1px solid var(--color-border-subtle)',
                        background: '#fff',
                        color: 'var(--color-accent-deep)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <EdifyMark size={12} color="var(--color-accent-deep)" />
                      Edify
                    </button>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{'\u2014'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
