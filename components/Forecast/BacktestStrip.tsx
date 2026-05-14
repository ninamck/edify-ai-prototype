'use client';

/**
 * BacktestStrip — per-SKU forecast accuracy over the recent window.
 *
 * Sits below the HorizonGrid as a secondary surface. The page's
 * AccuracyStrip already names the headline number; this strip exposes
 * the recipe-level breakdown so a manager can see *which* recipes are
 * driving the variance and click through to the WhyPanel for any one
 * of them.
 *
 * Sort default is "most off first" (largest |variancePct|) — the
 * actionable end of the list. We dedupe the strip to recipes with
 * material volume in the window so very-low-volume rows don't dominate
 * the top of the table.
 *
 * Columns are deliberately spare: recipe · forecast · actual · variance
 * · trend chip. Anything richer belongs in the WhyPanel.
 */

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { type SiteId } from '@/components/Production/fixtures';
import { siteSalesReport } from '@/components/Production/salesReport';

type Props = {
  siteId: SiteId;
  dates: string[];
  onPick: (skuId: string) => void;
};

const MIN_FORECAST_VOLUME = 10; // Suppress noise from sub-10-units-over-7-days rows.

type SortKey = 'variance' | 'sold' | 'forecast';

export default function BacktestStrip({ siteId, dates, onPick }: Props) {
  const [sort, setSort] = useState<SortKey>('variance');

  const recipes = useMemo(() => {
    const report = siteSalesReport(siteId, dates);
    const filtered = report.recipes.filter(r => r.forecast >= MIN_FORECAST_VOLUME);
    const cmp = (a: (typeof filtered)[number], b: (typeof filtered)[number]) => {
      if (sort === 'variance') return Math.abs(b.variancePct) - Math.abs(a.variancePct);
      if (sort === 'sold') return b.sold - a.sold;
      return b.forecast - a.forecast;
    };
    return [...filtered].sort(cmp);
  }, [siteId, dates, sort]);

  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        fontFamily: 'var(--font-primary)',
      }}
    >
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
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          How accurate has Quinn been? · last {dates.length} days
        </h2>
        <div
          role="tablist"
          aria-label="Sort"
          style={{
            display: 'flex',
            background: 'var(--color-bg-hover)',
            borderRadius: 100,
            padding: 3,
            marginLeft: 'auto',
          }}
        >
          {(
            [
              { id: 'variance', label: 'Most off' },
              { id: 'sold', label: 'Best sellers' },
              { id: 'forecast', label: 'Biggest forecast' },
            ] as const
          ).map(opt => {
            const active = opt.id === sort;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSort(opt.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 100,
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  background: active ? 'var(--color-accent-active)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            minWidth: 720,
            borderCollapse: 'separate',
            borderSpacing: 0,
          }}
        >
          <thead>
            <tr>
              <th style={headCell({ left: true, minWidth: 240 })}>
                <span style={headLabel}>Recipe</span>
              </th>
              <th style={headCell({ right: true, minWidth: 90 })}>
                <span style={headLabel}>Forecast</span>
              </th>
              <th style={headCell({ right: true, minWidth: 90 })}>
                <span style={headLabel}>Sold</span>
              </th>
              <th style={headCell({ right: true, minWidth: 90 })}>
                <span style={headLabel}>Variance</span>
              </th>
              <th style={headCell({ right: true, minWidth: 110 })}>
                <span style={headLabel}>Tendency</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {recipes.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Not enough volume to score — backtest needs at least {MIN_FORECAST_VOLUME} forecast units per recipe.
                </td>
              </tr>
            )}
            {recipes.map(r => {
              const onTrack = Math.abs(r.variancePct) < 5;
              return (
                <tr
                  key={r.skuId}
                  onClick={() => onPick(r.skuId)}
                  style={{
                    background: '#ffffff',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
                >
                  <td style={bodyCell({ left: true })}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={r.recipe.name}
                      >
                        {r.recipe.name}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                        {r.category} · seen on {r.daysSeen} {r.daysSeen === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  </td>
                  <td style={bodyCell({ right: true })}>
                    <span style={numberCell}>{r.forecast.toLocaleString()}</span>
                  </td>
                  <td style={bodyCell({ right: true })}>
                    <span style={numberCell}>{r.sold.toLocaleString()}</span>
                  </td>
                  <td style={bodyCell({ right: true })}>
                    <span
                      style={{
                        ...numberCell,
                        color: onTrack
                          ? 'var(--color-text-muted)'
                          : r.variance >= 0
                            ? 'var(--color-success)'
                            : 'var(--color-error)',
                      }}
                      title={`${r.variance >= 0 ? '+' : ''}${r.variance.toLocaleString()} vs forecast`}
                    >
                      {formatSignedPct(r.variancePct)}
                    </span>
                  </td>
                  <td style={bodyCell({ right: true })}>
                    <TendencyChip tendency={r.tendency} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TendencyChip({ tendency }: { tendency: 'overshoot' | 'undershoot' | 'on-target' | 'mixed' }) {
  const config: Record<typeof tendency, { label: string; bg: string; color: string; icon: React.ComponentType<{ size?: number }> }> = {
    overshoot: { label: 'Sells over', bg: 'var(--color-success-light)', color: 'var(--color-success)', icon: ArrowUpRight },
    undershoot: { label: 'Sells under', bg: 'var(--color-error-light)', color: 'var(--color-error)', icon: ArrowDownRight },
    'on-target': { label: 'On target', bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)', icon: Minus },
    mixed: { label: 'Mixed', bg: 'var(--color-warning-light)', color: 'var(--color-warning)', icon: Minus },
  };
  const c = config[tendency];
  const Icon = c.icon;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        background: c.bg,
        color: c.color,
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={11} />
      {c.label}
    </span>
  );
}

function formatSignedPct(p: number): string {
  if (Math.abs(p) < 1) return '0%';
  const v = Math.round(p);
  return `${v >= 0 ? '+' : ''}${v}%`;
}

// ─── Cell style helpers ──────────────────────────────────────────────────────

const headLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

const numberCell: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  fontVariantNumeric: 'tabular-nums',
};

function headCell({
  left,
  right,
  minWidth,
}: {
  left?: boolean;
  right?: boolean;
  minWidth?: number;
}): React.CSSProperties {
  return {
    padding: '10px 12px',
    background: 'var(--color-bg-hover)',
    borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : right ? 'right' : 'center',
    minWidth,
    whiteSpace: 'nowrap',
  };
}

function bodyCell({ left, right }: { left?: boolean; right?: boolean }): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : right ? 'right' : 'center',
    verticalAlign: 'middle',
  };
}
