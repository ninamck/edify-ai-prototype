'use client';

import type { StockSummary } from './status';
import { formatStocktakeAge } from './status';

interface Props {
  summary: StockSummary;
  oldestStocktakeAgeDays: number;
  /** When set, the strip frames itself as an estate roll-up. */
  estateSiteCount?: number;
}

// The strip is the one-second read. If everything is zero, we say so
// (and dial down the visual weight). If anything is non-zero we count
// the issues and frame the freshness flag.

export default function HealthStrip({
  summary,
  oldestStocktakeAgeDays,
  estateSiteCount,
}: Props) {
  const allClear = summary.attentionCount === 0;
  const dataStale = oldestStocktakeAgeDays > 7;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 18px',
        background: allClear
          ? 'var(--color-success-light)'
          : 'var(--color-bg-hover)',
        border: `1px solid ${allClear ? 'var(--color-success-border)' : 'var(--color-border-subtle)'}`,
        borderRadius: 'var(--radius-card)',
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
        fontSize: '13px',
      }}
    >
      {allClear ? (
        <span
          style={{
            fontWeight: 600,
            color: 'var(--color-success)',
            fontSize: '13px',
          }}
        >
          {estateSiteCount
            ? `All ${estateSiteCount} sites healthy — nothing on the attention list`
            : 'All clear — nothing on the attention list'}
        </span>
      ) : (
        <>
          {summary.stockoutCount > 0 && (
            <Stat
              count={summary.stockoutCount}
              label="at risk of stockout"
              tone="error"
            />
          )}
          {summary.varianceCount > 0 && (
            <Stat
              count={summary.varianceCount}
              label="with variance"
              tone="warning"
            />
          )}
          {summary.spoilageCount > 0 && (
            <Stat
              count={summary.spoilageCount}
              label="at risk of spoilage"
              tone="warning"
            />
          )}
          {summary.overstockCount > 0 && (
            <Stat
              count={summary.overstockCount}
              label="overstocked"
              tone="muted"
            />
          )}
          {summary.staleCount > 0 && (
            <Stat
              count={summary.staleCount}
              label="with stale data"
              tone="muted"
            />
          )}
        </>
      )}

      <span
        style={{
          marginLeft: 'auto',
          fontSize: '12px',
          color: dataStale ? 'var(--color-warning)' : 'var(--color-text-secondary)',
          fontWeight: dataStale ? 600 : 500,
        }}
      >
        {estateSiteCount
          ? `Oldest stocktake: ${formatStocktakeAge(oldestStocktakeAgeDays)}`
          : `Stock data is ${formatStocktakeAge(oldestStocktakeAgeDays)}`}
        {dataStale && ' — consider a fresh count'}
      </span>
    </div>
  );
}

function Stat({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: 'error' | 'warning' | 'muted';
}) {
  const colour =
    tone === 'error'
      ? 'var(--color-error)'
      : tone === 'warning'
        ? 'var(--color-warning)'
        : 'var(--color-text-secondary)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
      <span
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: colour,
          lineHeight: 1,
        }}
      >
        {count}
      </span>
      <span
        style={{
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </span>
  );
}
