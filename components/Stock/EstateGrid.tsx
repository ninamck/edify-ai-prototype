'use client';

import type { SiteStockSnapshot } from './status';
import { summariseSite } from './status';

interface Props {
  sites: SiteStockSnapshot[];
  onSiteClick: (siteId: string) => void;
}

// Each tile is a mini health summary for one site. Tiles sort by total
// attention count desc so the problem sites surface first — the green
// tiles fall to the bottom because they don't need engagement.

export default function EstateGrid({ sites, onSiteClick }: Props) {
  const enriched = sites.map(site => ({
    site,
    summary: summariseSite(site.items),
    oldestStocktakeAgeDays: Math.max(
      ...site.items.map(i => i.stockDataAgeDays),
      0,
    ),
  }));
  enriched.sort((a, b) => b.summary.attentionCount - a.summary.attentionCount);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '12px',
      }}
    >
      {enriched.map(({ site, summary, oldestStocktakeAgeDays }) => {
        const healthy = summary.attentionCount === 0;
        const stocktakeOverdue = oldestStocktakeAgeDays > 7;
        return (
          <button
            key={site.siteId}
            type="button"
            onClick={() => onSiteClick(site.siteId)}
            style={{
              textAlign: 'left',
              padding: '14px 16px',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderLeft: `4px solid ${
                healthy ? 'var(--color-success)' : 'var(--color-error)'
              }`,
              borderRadius: 'var(--radius-card)',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                {site.siteName}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-secondary)',
                  marginTop: '2px',
                }}
              >
                {site.siteCaption}
              </div>
            </div>

            <div
              style={{
                height: '1px',
                background: 'var(--color-border-subtle)',
              }}
            />

            {healthy ? (
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-success)',
                }}
              >
                All clear
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '12px',
                }}
              >
                {summary.stockoutCount > 0 && (
                  <Row
                    count={summary.stockoutCount}
                    label="at risk of stockout"
                    tone="error"
                  />
                )}
                {summary.varianceCount > 0 && (
                  <Row
                    count={summary.varianceCount}
                    label="with variance"
                    tone="warning"
                  />
                )}
                {summary.spoilageCount > 0 && (
                  <Row
                    count={summary.spoilageCount}
                    label="at risk of spoilage"
                    tone="warning"
                  />
                )}
                {summary.overstockCount > 0 && (
                  <Row
                    count={summary.overstockCount}
                    label="overstocked"
                    tone="muted"
                  />
                )}
                {summary.staleCount > 0 && (
                  <Row
                    count={summary.staleCount}
                    label="with stale data"
                    tone="muted"
                  />
                )}
              </div>
            )}

            <div
              style={{
                fontSize: '11px',
                color: stocktakeOverdue
                  ? 'var(--color-warning)'
                  : 'var(--color-text-secondary)',
                marginTop: 'auto',
                fontWeight: stocktakeOverdue ? 600 : 500,
              }}
            >
              {stocktakeOverdue
                ? `Stocktake ${oldestStocktakeAgeDays}d ago — overdue`
                : `Stocktake ${oldestStocktakeAgeDays}d ago`}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Row({
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
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
      <span
        style={{
          minWidth: '18px',
          textAlign: 'right',
          fontSize: '14px',
          fontWeight: 700,
          color: colour,
        }}
      >
        {count}
      </span>
      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
        {label}
      </span>
    </div>
  );
}
