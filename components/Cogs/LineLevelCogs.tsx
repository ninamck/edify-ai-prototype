'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Search } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { gbp } from './format';

/**
 * Line Level COGs — every POS sold item for the period with its matched
 * recipe, unit cost and margin. Two rows are deliberately unmatched
 * ("Missing") so the demo ties back to the Edify insights: the new
 * avocado dish that isn't costed yet, and POS items with no recipe map.
 */

type SoldItemRow = {
  id: string;
  soldItem: string;
  recipe: string | null; // null = missing match
  klass: 'Beverage' | 'Food' | 'Retail' | null;
  unitsSold: number;
  unitCost: number;
  unitPrice: number;
};

const ROWS: SoldItemRow[] = [
  { id: 'flat-white', soldItem: 'Flat White \u2013 Regular', recipe: 'Flat White', klass: 'Beverage', unitsSold: 1412, unitCost: 0.48, unitPrice: 3.6 },
  { id: 'oat-flat-white', soldItem: 'Oat Flat White \u2013 Regular', recipe: 'Flat White (Oat)', klass: 'Beverage', unitsSold: 642, unitCost: 0.61, unitPrice: 3.95 },
  { id: 'latte', soldItem: 'Latte \u2013 Regular', recipe: 'Latte', klass: 'Beverage', unitsSold: 1186, unitCost: 0.52, unitPrice: 3.75 },
  { id: 'americano', soldItem: 'Americano \u2013 Regular', recipe: 'Americano', klass: 'Beverage', unitsSold: 978, unitCost: 0.31, unitPrice: 3.1 },
  { id: 'avocado-smash', soldItem: 'Avocado Smash on Sourdough', recipe: null, klass: null, unitsSold: 322, unitCost: 0, unitPrice: 6.95 },
  { id: 'chicken-caesar', soldItem: 'Chicken Caesar Baguette', recipe: 'Chicken Caesar Baguette', klass: 'Food', unitsSold: 486, unitCost: 2.14, unitPrice: 5.95 },
  { id: 'salmon-bagel', soldItem: 'Smoked Salmon Bagel', recipe: 'Smoked Salmon Bagel', klass: 'Food', unitsSold: 298, unitCost: 2.86, unitPrice: 6.5 },
  { id: 'vegan-bagel', soldItem: 'Vegan Multigrain Bagel', recipe: 'Vegan Bagel & Spread', klass: 'Food', unitsSold: 354, unitCost: 0.92, unitPrice: 3.95 },
  { id: 'banana-bread', soldItem: 'Banana Bread \u2013 Slice', recipe: 'Banana Loaf X1', klass: 'Food', unitsSold: 412, unitCost: 0.74, unitPrice: 3.25 },
  { id: 'sourdough-toast', soldItem: 'Sourdough Toast & Jam', recipe: 'Sourdough Toast', klass: 'Food', unitsSold: 268, unitCost: 0.68, unitPrice: 3.5 },
  { id: 'soup', soldItem: 'Soup of the Day', recipe: null, klass: null, unitsSold: 186, unitCost: 0, unitPrice: 4.75 },
  { id: 'house-red', soldItem: 'House Red \u2013 175ml', recipe: 'House Red Wine', klass: 'Beverage', unitsSold: 224, unitCost: 1.52, unitPrice: 6.0 },
  { id: 'keepcup', soldItem: 'Edify KeepCup (Store)', recipe: 'KeepCup (Retail)', klass: 'Retail', unitsSold: 14, unitCost: 8.24, unitPrice: 13.27 },
];

const TH: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  padding: '10px 12px',
  whiteSpace: 'nowrap',
  textAlign: 'right',
  background: 'var(--color-bg-hover)',
};

const TD: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  padding: '11px 12px',
  whiteSpace: 'nowrap',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

function classBadge(klass: SoldItemRow['klass']) {
  if (!klass) return null;
  const tone =
    klass === 'Beverage'
      ? { bg: 'var(--color-success-light)', fg: 'var(--color-success)' }
      : klass === 'Food'
        ? { bg: 'var(--color-badge-bg)', fg: 'var(--color-accent-deep)' }
        : { bg: 'var(--color-bg-hover)', fg: 'var(--color-text-secondary)' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 9px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        background: tone.bg,
        color: tone.fg,
      }}
    >
      {klass}
    </span>
  );
}

export default function LineLevelCogs() {
  const [search, setSearch] = useState('');
  const router = useRouter();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ROWS;
    return ROWS.filter(
      (r) => r.soldItem.toLowerCase().includes(q) || (r.recipe ?? '').toLowerCase().includes(q),
    );
  }, [search]);

  const missingCount = ROWS.filter((r) => !r.recipe).length;
  const missingSales = ROWS.filter((r) => !r.recipe).reduce(
    (acc, r) => acc + r.unitsSold * r.unitPrice,
    0,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Edify note — unmatched items hide cost */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
        }}
      >
        <EdifyMark size={13} color="var(--color-accent-deep)" />
        <span style={{ fontSize: 12.5, color: 'var(--color-text-primary)', flex: 1 }}>
          <strong>{missingCount} sold items</strong> have no recipe match, so their cost shows £0 —{' '}
          {gbp(missingSales, { decimals: 0 })} of sales is carrying no COGS.
        </span>
        <button
          type="button"
          onClick={() => router.push('/item-matching')}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: '#fff',
            color: 'var(--color-accent-deep)',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Open item matching
        </button>
      </div>

      {/* Table card */}
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
              placeholder="Enter product name..."
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
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
            {rows.length} of {ROWS.length} sold items
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign: 'left' }}>Sold Item</th>
                <th style={{ ...TH, textAlign: 'left' }}>Name</th>
                <th style={{ ...TH, textAlign: 'left' }}>Class</th>
                <th style={TH}>Units Sold</th>
                <th style={TH}>Unit Cost</th>
                <th style={TH}>Total Cost</th>
                <th style={TH}>Unit Price</th>
                <th style={TH}>Net Sales</th>
                <th style={TH}>Gross Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const totalCost = r.unitsSold * r.unitCost;
                const netSales = r.unitsSold * r.unitPrice;
                const margin = netSales > 0 ? ((netSales - totalCost) / netSales) * 100 : 0;
                const missing = !r.recipe;
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>{r.soldItem}</td>
                    <td style={{ ...TD, textAlign: 'left' }}>
                      {missing ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '2px 9px',
                            borderRadius: 999,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: 'var(--color-error-light)',
                            color: 'var(--color-error)',
                          }}
                        >
                          <AlertCircle size={12} />
                          Missing
                        </span>
                      ) : (
                        <span
                          style={{
                            textDecoration: 'underline',
                            textDecorationColor: 'var(--color-border)',
                            textUnderlineOffset: 3,
                          }}
                        >
                          {r.recipe}
                        </span>
                      )}
                    </td>
                    <td style={{ ...TD, textAlign: 'left' }}>
                      {classBadge(r.klass) ?? (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{'\u2014'}</span>
                      )}
                    </td>
                    <td style={TD}>{r.unitsSold.toLocaleString('en-GB')}</td>
                    <td style={{ ...TD, color: missing ? 'var(--color-error)' : undefined }}>
                      {gbp(r.unitCost)}
                    </td>
                    <td style={{ ...TD, color: missing ? 'var(--color-error)' : undefined }}>
                      {gbp(totalCost, { decimals: 2 })}
                    </td>
                    <td style={TD}>{gbp(r.unitPrice)}</td>
                    <td style={TD}>{gbp(netSales, { decimals: 2 })}</td>
                    <td
                      style={{
                        ...TD,
                        fontWeight: 700,
                        color: missing
                          ? 'var(--color-error)'
                          : margin < 60
                            ? 'var(--color-warning)'
                            : 'var(--color-text-primary)',
                      }}
                    >
                      {margin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
