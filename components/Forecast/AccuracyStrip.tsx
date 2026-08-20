'use client';

/**
 * AccuracyStrip — the demo hero for the Forecast page.
 *
 * Calmed down per feedback: no coloured background, no hero icon, no
 * per-tile chrome. The strip is now a single headline sentence plus
 * three flat inline figures separated by hairline dividers — the same
 * information at a lower visual cost so the grid below gets the
 * attention.
 *
 * The four-KPI design (Tracking, Best tracked, etc.) collapsed because:
 *  - Tracking duplicated the variance already in the headline.
 *  - Best-tracked lives one section down on the BacktestStrip — having
 *    it here too made the page top read as a dashboard rather than a
 *    page header.
 *
 * The four figures we keep are: Forecast total · Sold · Sales ($) ·
 * Accuracy. Together they answer "what did Quinn predict, what actually
 * happened (in units and pounds), and how close was Quinn?" — the four
 * facts the demo needs, in the units operators read in every other tool.
 */

import { useMemo } from 'react';
import type { SiteId } from '@/components/Production/fixtures';
import { getAccuracyHeadline } from './accuracy';
import { formatCurrency, unitPriceFor } from './economics';

type Props = {
  siteId: SiteId;
  /** Dates the backtest covers. Ordered oldest → newest. */
  backtestDates: string[];
};

export default function AccuracyStrip({ siteId, backtestDates }: Props) {
  const headline = useMemo(
    () => getAccuracyHeadline(siteId, backtestDates),
    [siteId, backtestDates],
  );

  // $ totals — derive from the per-recipe rows so the number ties out to
  // the same data the units totals do. Done here rather than in
  // getAccuracyHeadline so accuracy.ts stays unit-only and revenue
  // concerns stay in economics.ts.
  const revenue = useMemo(() => {
    let sold = 0;
    let forecast = 0;
    for (const r of headline.report.recipes) {
      const price = unitPriceFor(r.skuId);
      sold += r.sold * price;
      forecast += r.forecast * price;
    }
    return { sold: Math.round(sold), forecast: Math.round(forecast) };
  }, [headline.report.recipes]);

  const variancePctRounded = Math.round(headline.variancePct);
  const variancePctLabel =
    Math.abs(headline.variancePct) < 1
      ? 'on target'
      : `${variancePctRounded >= 0 ? '+' : ''}${variancePctRounded}%`;

  // Headline sentence — the one a manager would read out at standup.
  const headlineSentence = (() => {
    if (headline.totalForecast === 0) {
      return 'Backtest unavailable for this site — no live actuals yet.';
    }
    const soldRevenue = formatCurrency(revenue.sold);
    if (Math.abs(headline.variancePct) < 1) {
      return `Predicted ${headline.totalForecast.toLocaleString()} units across the last ${backtestDates.length} days. You sold ${headline.totalActual.toLocaleString()} (${soldRevenue}) — bang on.`;
    }
    const dir = headline.variance >= 0 ? 'sold' : 'short by';
    return `Predicted ${headline.totalForecast.toLocaleString()} units across the last ${backtestDates.length} days. You ${dir} ${headline.totalActual.toLocaleString()} (${soldRevenue}, ${variancePctLabel}).`;
  })();

  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        flexWrap: 'wrap',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Headline sentence — small caps caption + sentence */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: '1 1 320px' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          {backtestDates.length}-day backtest
        </span>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--color-text-primary)',
            fontWeight: 500,
          }}
        >
          {headlineSentence}
        </p>
      </div>

      {/* Inline figures — flat, divided by hairlines instead of cards. */}
      {headline.totalForecast > 0 && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'stretch',
            gap: 0,
            flexShrink: 0,
          }}
        >
          <Figure label="Forecast" value={headline.totalForecast.toLocaleString()} />
          <Divider />
          <Figure label="Sold" value={headline.totalActual.toLocaleString()} />
          <Divider />
          <Figure label="Sales" value={formatCurrency(revenue.sold)} />
          <Divider />
          <Figure
            label="Accuracy"
            value={`${headline.accuracyScore}%`}
          />
        </div>
      )}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '0 14px',
        minWidth: 78,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        alignSelf: 'stretch',
        background: 'var(--color-border-subtle)',
      }}
    />
  );
}
