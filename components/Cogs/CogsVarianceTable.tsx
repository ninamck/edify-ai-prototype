'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import CogsInsightButton from './CogsInsightButton';
import { gbp } from './format';
import { COGS_VARIANCE_ROWS, type CogsVarianceRow } from './fixtures';
import { getCogsRowInsight, rowHasInsight } from './insights';

const OK = 'var(--color-success)';
const WARN = 'var(--color-error)';

function qty(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

type SortKey = keyof CogsVarianceRow | null;

const NUMERIC_KEYS: Array<keyof CogsVarianceRow> = [
  'unitCost',
  'openingStock',
  'purchases',
  'transfer',
  'waste',
  'closingStock',
  'stockValue',
  'actualUsage',
  'actualCost',
  'theoUsage',
  'theoCost',
  'varQty',
  'varCost',
  'varPct',
];

type Col = {
  key: keyof CogsVarianceRow;
  header: string;
  align: 'left' | 'right';
  render: (r: CogsVarianceRow) => React.ReactNode;
  sortable?: boolean;
};

const COLS: Col[] = [
  { key: 'name', header: 'Name', align: 'left', render: (r) => r.name, sortable: true },
  { key: 'productClass', header: 'Product Class', align: 'left', render: (r) => r.productClass, sortable: true },
  { key: 'packType', header: 'Pack Type', align: 'left', render: (r) => r.packType },
  { key: 'unitCost', header: 'Unit Cost', align: 'right', render: (r) => gbp(r.unitCost), sortable: true },
  { key: 'openingStock', header: 'Opening Stock', align: 'right', render: (r) => qty(r.openingStock), sortable: true },
  { key: 'purchases', header: 'Purchases', align: 'right', render: (r) => qty(r.purchases), sortable: true },
  { key: 'transfer', header: 'Transfer (+/\u2212)', align: 'right', render: (r) => qty(r.transfer), sortable: true },
  { key: 'waste', header: 'Waste', align: 'right', render: (r) => qty(r.waste), sortable: true },
  { key: 'closingStock', header: 'Closing Stock', align: 'right', render: (r) => qty(r.closingStock), sortable: true },
  { key: 'stockValue', header: 'Stock Value', align: 'right', render: (r) => gbp(r.stockValue), sortable: true },
  { key: 'actualUsage', header: 'Actual Usage', align: 'right', render: (r) => qty(r.actualUsage), sortable: true },
  { key: 'actualCost', header: 'Actual Cost', align: 'right', render: (r) => gbp(r.actualCost), sortable: true },
  { key: 'theoUsage', header: 'Theo Usage', align: 'right', render: (r) => qty(r.theoUsage), sortable: true },
  { key: 'theoCost', header: 'Theo Cost', align: 'right', render: (r) => gbp(r.theoCost), sortable: true },
  { key: 'varQty', header: 'Var Qty', align: 'right', render: (r) => qty(r.varQty), sortable: true },
  { key: 'varCost', header: 'Var Cost', align: 'right', render: (r) => gbp(r.varCost), sortable: true },
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
  cursor: 'default',
  userSelect: 'none',
};

const TD_BASE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  padding: '11px 12px',
  whiteSpace: 'nowrap',
};

export default function CogsVarianceTable({
  highlightRowIds,
}: {
  highlightRowIds?: string[];
}) {
  const [search, setSearch] = useState('');
  const [largeOnly, setLargeOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('varCost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const highlightSet = useMemo(() => new Set(highlightRowIds ?? []), [highlightRowIds]);

  const rows = useMemo(() => {
    let out = COGS_VARIANCE_ROWS.slice();
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.productClass.toLowerCase().includes(q) ||
          r.packType.toLowerCase().includes(q),
      );
    }
    if (largeOnly) {
      out = out.filter((r) => Math.abs(r.varPct) >= 10);
    }
    if (sortKey) {
      const numeric = NUMERIC_KEYS.includes(sortKey as keyof CogsVarianceRow);
      out.sort((a, b) => {
        const av = a[sortKey as keyof CogsVarianceRow];
        const bv = b[sortKey as keyof CogsVarianceRow];
        let cmp: number;
        if (numeric) {
          cmp = (av as number) - (bv as number);
        } else {
          cmp = String(av).localeCompare(String(bv));
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [search, largeOnly, sortKey, sortDir]);

  function toggleSort(key: keyof CogsVarianceRow) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortIcon({ k }: { k: keyof CogsVarianceRow }) {
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
        overflow: 'hidden',
      }}
    >
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
          {rows.length} of {COGS_VARIANCE_ROWS.length} products
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: '64vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1500 }}>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key as string}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                  style={{
                    ...TH_BASE,
                    textAlign: c.align,
                    cursor: c.sortable ? 'pointer' : 'default',
                    ...(c.key === 'name'
                      ? { position: 'sticky', left: 0, zIndex: 2 }
                      : null),
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {c.header}
                    {c.sortable && <SortIcon k={c.key} />}
                  </span>
                </th>
              ))}
              <th style={{ ...TH_BASE, textAlign: 'right' }}>
                <span
                  onClick={() => toggleSort('varPct')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                >
                  Var % <SortIcon k="varPct" />
                </span>
              </th>
              <th style={{ ...TH_BASE, textAlign: 'center' }}>Insight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const highlighted = highlightSet.has(r.id);
              const varColor = r.varPct > 0 ? WARN : r.varPct < 0 ? OK : 'var(--color-text-muted)';
              return (
                <tr
                  key={r.id}
                  style={{
                    borderTop: '1px solid var(--color-border-subtle)',
                    background: highlighted ? 'var(--color-badge-bg)' : '#fff',
                    transition: 'background 0.3s',
                  }}
                >
                  {COLS.map((c) => (
                    <td
                      key={c.key as string}
                      style={{
                        ...TD_BASE,
                        textAlign: c.align,
                        ...(c.key === 'name'
                          ? {
                              position: 'sticky',
                              left: 0,
                              zIndex: 1,
                              background: highlighted ? 'var(--color-badge-bg)' : '#fff',
                              fontWeight: 600,
                            }
                          : null),
                      }}
                    >
                      {c.render(r)}
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
                        color: varColor,
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
                      <CogsInsightButton text={getCogsRowInsight(r.id)} />
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{'\u2014'}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
