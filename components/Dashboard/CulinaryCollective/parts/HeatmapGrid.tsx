'use client';

import type { CSSProperties } from 'react';
import {
  formatNumber,
  formatPctSigned,
  formatPounds,
  heatmapCellColor,
} from '@/components/Dashboard/CulinaryCollective/parts/format';
import type { OutletHeatmap } from '@/components/Dashboard/CulinaryCollective/data/fisMockData';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const TH: CSSProperties = {
  position: 'sticky',
  top: 0,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  textAlign: 'right',
  color: 'var(--color-text-muted)',
  background: 'var(--color-bg-hover)',
  padding: '6px 8px',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--color-border-subtle)',
};

const TD_BASE: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  textAlign: 'right',
  padding: '4px 8px',
  borderBottom: '1px solid var(--color-border-subtle)',
  whiteSpace: 'nowrap',
};

const TD_LABEL: CSSProperties = {
  ...TD_BASE,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  textAlign: 'left',
};

const TD_SUMMARY: CSSProperties = {
  ...TD_BASE,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  background: 'var(--color-bg-hover)',
  borderLeft: '1px solid var(--color-border-subtle)',
};

/** A single outlet's variance heatmap grid. Mirrors the per-outlet block in
 *  the spreadsheet's HEATMAPS sheet: rows = week endings, daily cells are
 *  variance vs last year, summary columns on the right are unshaded. */
export function HeatmapGrid({ heatmap }: { heatmap: OutletHeatmap }) {
  // Magnitude reference is the largest absolute daily variance in this grid
  // so each outlet's scaling is local. That keeps small outlets (Flock, Opa)
  // visually legible without being washed out by Bar's swings.
  const magnitude = heatmap.rows.reduce(
    (max, r) => Math.max(max, ...r.daily.map((v) => Math.abs(v))),
    0,
  );

  return (
    <div
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          background: 'var(--color-bg-hover)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        {heatmap.outlet}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left', minWidth: 80 }}>Week ending</th>
              <th style={TH}>Prior year</th>
              {DAY_HEADERS.map((d) => (
                <th key={d} style={TH}>
                  {d}
                </th>
              ))}
              <th style={{ ...TH, borderLeft: '1px solid var(--color-border-subtle)' }}>
                Total var
              </th>
              <th style={TH}>This year</th>
              <th style={TH}>Var %</th>
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((r) => (
              <tr key={r.weekEnding}>
                <td style={TD_LABEL}>{r.weekEnding}</td>
                <td style={TD_BASE}>{formatPounds(r.priorYear)}</td>
                {r.daily.map((v, i) => (
                  <td
                    key={i}
                    style={{
                      ...TD_BASE,
                      background: heatmapCellColor(v, magnitude),
                      color: v < 0 ? '#7f1d1d' : v > 0 ? '#14532d' : 'var(--color-text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                    title={`${DAY_HEADERS[i]} variance vs LY: ${formatPounds(v)}`}
                  >
                    {v === 0 ? '—' : formatNumber(v)}
                  </td>
                ))}
                <td
                  style={{
                    ...TD_SUMMARY,
                    color:
                      r.totalVar < 0
                        ? '#7f1d1d'
                        : r.totalVar > 0
                          ? '#14532d'
                          : 'var(--color-text-primary)',
                  }}
                >
                  {formatPounds(r.totalVar)}
                </td>
                <td style={TD_SUMMARY}>{formatPounds(r.thisYear)}</td>
                <td
                  style={{
                    ...TD_SUMMARY,
                    color:
                      r.pctVar < 0
                        ? '#7f1d1d'
                        : r.pctVar > 0
                          ? '#14532d'
                          : 'var(--color-text-primary)',
                  }}
                >
                  {formatPctSigned(r.pctVar)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default HeatmapGrid;
