'use client';

import { useRouter } from 'next/navigation';
import type { StockItem } from './status';
import {
  STATUS_CONFIG,
  formatDaysCover,
  formatStock,
  formatStocktakeAge,
  getDaysCover,
  getStockStatus,
  getVarianceFraction,
} from './status';
import { ctaConfigFor } from './actions';

interface Props {
  item: StockItem;
}

export default function AttentionCard({ item }: Props) {
  const router = useRouter();
  const status = getStockStatus(item);
  const config = STATUS_CONFIG[status];
  const ctas = ctaConfigFor(status, item);
  const daysCover = getDaysCover(item);
  const variance = getVarianceFraction(item);

  // Provenance line — operators need to know whether the projection is
  // POS-derived or stocktake-only.
  const provenance = item.posDataAvailable
    ? `From stocktake ${formatStocktakeAge(item.stockDataAgeDays)} + POS depletion`
    : `From stocktake ${formatStocktakeAge(item.stockDataAgeDays)} — no POS data`;

  // Headline numbers line — currentStock vs par, plus the insight
  // appropriate to the status. For stockout: days cover. For variance:
  // the gap. For spoilage / overstock: how far over par.
  const numbersLine = (() => {
    const stock = formatStock(item.currentStock, item.stockUnit);
    const par =
      item.parLevel !== null
        ? `par ${formatStock(item.parLevel, item.stockUnit)}`
        : 'par not set';

    if (status === 'stockout') {
      return `${stock} on hand · ${par} · runs out in ${formatDaysCover(daysCover)}`;
    }
    if (status === 'variance' && variance !== null) {
      const pct = Math.round(variance * 100);
      const theoretical =
        item.theoreticalStock !== null
          ? formatStock(item.theoreticalStock, item.stockUnit)
          : '—';
      return `${stock} counted · system expected ${theoretical} · ${pct}% gap`;
    }
    if (status === 'spoilage' || status === 'overstock') {
      const ratio =
        item.parLevel && item.parLevel > 0
          ? (item.currentStock / item.parLevel).toFixed(1)
          : null;
      return `${stock} on hand · ${par}${ratio ? ` · ${ratio}× par` : ''}`;
    }
    return `${stock} on hand · ${par}`;
  })();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '14px 16px',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Header row — status chip · name · confidence */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: 'var(--radius-badge)',
            background: 'transparent',
            color: config.chipText,
            border: `1px solid ${config.chipText}`,
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {config.label}
        </span>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            {item.name}
          </span>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
            }}
          >
            {item.variant}
          </span>
        </div>
      </div>

      {/* Numbers + provenance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
          }}
        >
          {numbersLine}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
          }}
        >
          {provenance} · supplier {item.supplierName}
        </div>
      </div>

      {/* CTAs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          paddingTop: '4px',
        }}
      >
        {ctas.primary.label && (
          <button
            type="button"
            onClick={() => router.push(ctas.primary.href)}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-item)',
              background: 'var(--color-accent-active)',
              color: 'var(--color-text-on-active)',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            {ctas.primary.label}
          </button>
        )}
        {ctas.secondaries.map(cta => (
          <button
            key={cta.label}
            type="button"
            onClick={() => router.push(cta.href)}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-item)',
              background: '#fff',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            {cta.label}
          </button>
        ))}
      </div>
    </div>
  );
}
