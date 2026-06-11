'use client';

import { useState } from 'react';
import { gbp } from './format';

/**
 * Consolidated COGs — one row per site across the estate for the stocktake
 * period. The hub row reconciles with the Single Site fixtures (£51,000
 * net sales, £14,200 actual, £12,455 theoretical); the spokes are mock but
 * plausible, with one favourable site so the colour-coding reads.
 */

type SiteRow = {
  id: string;
  site: string;
  netSales: number;
  actualCost: number;
  theoCost: number;
  wasteCost: number;
  openingSt: string;
  closingSt: string;
};

const SITE_ROWS: SiteRow[] = [
  {
    id: 'hub',
    site: 'Pret Hub Kitchen',
    netSales: 51000,
    actualCost: 14200,
    theoCost: 12455,
    wasteCost: 278,
    openingSt: '31/12/2025',
    closingSt: '07/01/2026',
  },
  {
    id: 'fitzroy',
    site: 'Fitzroy Espresso',
    netSales: 15300,
    actualCost: 3964,
    theoCost: 3825,
    wasteCost: 92,
    openingSt: '31/12/2025',
    closingSt: '07/01/2026',
  },
  {
    id: 'shoreditch',
    site: 'Shoreditch East',
    netSales: 22950,
    actualCost: 5852,
    theoCost: 5738,
    wasteCost: 134,
    openingSt: '31/12/2025',
    closingSt: '07/01/2026',
  },
  {
    id: 'notting-hill',
    site: 'Notting Hill West',
    netSales: 20400,
    actualCost: 5061,
    theoCost: 5100,
    wasteCost: 118,
    openingSt: '31/12/2025',
    closingSt: '07/01/2026',
  },
  {
    id: 'islington',
    site: 'Islington North',
    netSales: 18750,
    actualCost: 5213,
    theoCost: 4688,
    wasteCost: 217,
    openingSt: '30/12/2025',
    closingSt: '07/01/2026',
  },
  {
    id: 'heathrow',
    site: 'Heathrow T5',
    netSales: 34200,
    actualCost: 8930,
    theoCost: 8550,
    wasteCost: 256,
    openingSt: '31/12/2025',
    closingSt: '07/01/2026',
  },
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

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function varColor(n: number): string {
  if (n > 0) return 'var(--color-error)';
  if (n < 0) return 'var(--color-success)';
  return 'var(--color-text-primary)';
}

export default function ConsolidatedCogs() {
  const [showWaste, setShowWaste] = useState(true);

  const totals = SITE_ROWS.reduce(
    (acc, r) => ({
      netSales: acc.netSales + r.netSales,
      actualCost: acc.actualCost + r.actualCost,
      theoCost: acc.theoCost + r.theoCost,
      wasteCost: acc.wasteCost + r.wasteCost,
    }),
    { netSales: 0, actualCost: 0, theoCost: 0, wasteCost: 0 },
  );

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
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          6 sites · this stocktake period
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Show Waste</span>
          <button
            type="button"
            onClick={() => setShowWaste((v) => !v)}
            aria-label="Toggle waste columns"
            style={{
              width: 38,
              height: 21,
              borderRadius: 999,
              border: 'none',
              background: showWaste ? 'var(--color-accent-deep)' : 'var(--color-border)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: showWaste ? 19 : 2,
                width: 17,
                height: 17,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.15s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: showWaste ? 1100 : 950 }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left' }}>Site</th>
              <th style={TH}>Net Sales</th>
              <th style={TH}>Actual Cost</th>
              <th style={TH}>Actual %</th>
              <th style={TH}>Theo Cost</th>
              <th style={TH}>Theo %</th>
              {showWaste && <th style={TH}>Waste Cost</th>}
              {showWaste && <th style={TH}>Waste %</th>}
              <th style={TH}>Var Cost</th>
              <th style={TH}>Var %</th>
              <th style={TH}>Opening ST</th>
              <th style={TH}>Closing ST</th>
            </tr>
          </thead>
          <tbody>
            {SITE_ROWS.map((r) => {
              const varCost = r.actualCost - r.theoCost;
              const varPct = (varCost / r.netSales) * 100;
              return (
                <tr key={r.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <td
                    style={{
                      ...TD,
                      textAlign: 'left',
                      fontWeight: 600,
                      textDecoration: 'underline',
                      textDecorationColor: 'var(--color-border)',
                      textUnderlineOffset: 3,
                    }}
                  >
                    {r.site}
                  </td>
                  <td style={TD}>{gbp(r.netSales, { decimals: 0 })}</td>
                  <td style={TD}>{gbp(r.actualCost, { decimals: 0 })}</td>
                  <td style={TD}>{pct((r.actualCost / r.netSales) * 100)}</td>
                  <td style={TD}>{gbp(r.theoCost, { decimals: 0 })}</td>
                  <td style={TD}>{pct((r.theoCost / r.netSales) * 100)}</td>
                  {showWaste && <td style={TD}>{gbp(r.wasteCost, { decimals: 0 })}</td>}
                  {showWaste && <td style={TD}>{pct((r.wasteCost / r.netSales) * 100)}</td>}
                  <td style={{ ...TD, fontWeight: 700, color: varColor(varCost) }}>
                    {gbp(varCost, { sign: true, decimals: 0 })}
                  </td>
                  <td style={{ ...TD, fontWeight: 700, color: varColor(varCost) }}>
                    {varPct > 0 ? '+' : ''}
                    {pct(varPct)}
                  </td>
                  <td style={{ ...TD, color: 'var(--color-text-secondary)' }}>{r.openingSt}</td>
                  <td style={{ ...TD, color: 'var(--color-text-secondary)' }}>{r.closingSt}</td>
                </tr>
              );
            })}

            {/* Totals */}
            {(() => {
              const varCost = totals.actualCost - totals.theoCost;
              const varPct = (varCost / totals.netSales) * 100;
              const totalTd: React.CSSProperties = { ...TD, color: '#fff', fontWeight: 700 };
              return (
                <tr style={{ background: 'var(--color-accent-deep)' }}>
                  <td style={{ ...totalTd, textAlign: 'left' }}>Total</td>
                  <td style={totalTd}>{gbp(totals.netSales, { decimals: 0 })}</td>
                  <td style={totalTd}>{gbp(totals.actualCost, { decimals: 0 })}</td>
                  <td style={totalTd}>{pct((totals.actualCost / totals.netSales) * 100)}</td>
                  <td style={totalTd}>{gbp(totals.theoCost, { decimals: 0 })}</td>
                  <td style={totalTd}>{pct((totals.theoCost / totals.netSales) * 100)}</td>
                  {showWaste && <td style={totalTd}>{gbp(totals.wasteCost, { decimals: 0 })}</td>}
                  {showWaste && <td style={totalTd}>{pct((totals.wasteCost / totals.netSales) * 100)}</td>}
                  <td style={totalTd}>{gbp(varCost, { sign: true, decimals: 0 })}</td>
                  <td style={totalTd}>
                    {varPct > 0 ? '+' : ''}
                    {pct(varPct)}
                  </td>
                  <td style={totalTd}>{'\u2014'}</td>
                  <td style={totalTd}>{'\u2014'}</td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
