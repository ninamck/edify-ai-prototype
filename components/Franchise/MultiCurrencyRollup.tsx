'use client';

/**
 * MultiCurrencyRollup — the HQ closer of the multi-currency demo.
 *
 * Every store buys from Second Cup Central Supply in CAD but reports food
 * cost in its own local currency; this section consolidates the group's
 * purchasing back into one reporting currency (CAD — the franchisor's).
 * Mock data, gated to the Second Cup build; renders null elsewhere.
 */

import { Globe } from 'lucide-react';
import { isMultiCurrencyDemo } from '@/lib/demoConfig';
import {
  convert,
  formatMoneyRounded,
  fxRateLabel,
  FX_RATE_DATE,
  type CurrencyCode,
} from '@/lib/currency';

/** The group consolidates in the franchisor's currency. */
const GROUP_CURRENCY: CurrencyCode = 'CAD';

type StoreRow = {
  id: string;
  store: string;
  location: string;
  localCurrency: CurrencyCode;
  /** This period's purchases from Central Supply, in CAD as billed. */
  purchasesCad: number;
};

const STORE_ROWS: StoreRow[] = [
  { id: 'toronto', store: 'Queen Street West', location: 'Toronto, Canada', localCurrency: 'CAD', purchasesCad: 7950 },
  { id: 'dubai', store: 'Dubai Mall', location: 'Dubai, UAE', localCurrency: 'AED', purchasesCad: 6340 },
  { id: 'newyork', store: 'Bryant Park', location: 'New York, USA', localCurrency: 'USD', purchasesCad: 5110 },
  { id: 'london', store: 'Covent Garden', location: 'London, UK', localCurrency: 'GBP', purchasesCad: 4820 },
];

const TOTAL_CAD = STORE_ROWS.reduce((s, r) => s + r.purchasesCad, 0);

const TH: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  padding: '10px 14px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--color-border-subtle)',
};

const TD: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  padding: '11px 14px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--color-border-subtle)',
};

export default function MultiCurrencyRollup() {
  if (!isMultiCurrencyDemo) return null;

  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          margin: '0 0 12px',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <Globe size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        Group purchasing — multi-currency
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Every store buys from Central Supply in CAD; each reports food cost in its own currency.
        The group consolidates back to CAD automatically — no spreadsheets, no manual rates.
      </p>

      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14,
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        {/* Consolidated headline */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            flexWrap: 'wrap',
            padding: '14px 16px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-surface)',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Consolidated purchases this period
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {formatMoneyRounded(TOTAL_CAD, GROUP_CURRENCY)}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
            across {STORE_ROWS.length} stores in 4 currencies · daily rates auto-updated {FX_RATE_DATE}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign: 'left' }}>Store</th>
                <th style={{ ...TH, textAlign: 'left' }}>Reports in</th>
                <th style={TH}>Purchases (billed, CAD)</th>
                <th style={TH}>In store currency</th>
                <th style={TH}>Rate applied</th>
              </tr>
            </thead>
            <tbody>
              {STORE_ROWS.map((row) => (
                <tr key={row.id}>
                  <td style={{ ...TD, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600 }}>{row.store}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{row.location}</div>
                  </td>
                  <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>{row.localCurrency}</td>
                  <td style={{ ...TD, fontWeight: 600 }}>
                    {formatMoneyRounded(row.purchasesCad, GROUP_CURRENCY)}
                  </td>
                  <td style={TD}>
                    {row.localCurrency === GROUP_CURRENCY
                      ? '—'
                      : formatMoneyRounded(convert(row.purchasesCad, GROUP_CURRENCY, row.localCurrency), row.localCurrency)}
                  </td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {row.localCurrency === GROUP_CURRENCY
                      ? 'Base'
                      : fxRateLabel(GROUP_CURRENCY, row.localCurrency)}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ ...TD, textAlign: 'left', fontWeight: 700, borderBottom: 'none' }}>
                  Group total
                </td>
                <td style={{ ...TD, textAlign: 'left', fontWeight: 600, borderBottom: 'none' }}>
                  {GROUP_CURRENCY}
                </td>
                <td style={{ ...TD, fontWeight: 700, borderBottom: 'none' }}>
                  {formatMoneyRounded(TOTAL_CAD, GROUP_CURRENCY)}
                </td>
                <td style={{ ...TD, borderBottom: 'none' }} colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: '10px 16px 14px',
            fontSize: 11.5,
            color: 'var(--color-text-muted)',
            borderTop: '1px solid var(--color-border-subtle)',
          }}
        >
          Store food-cost reports keep both figures — the CAD amount as invoiced and the local-currency
          equivalent at the rate locked at goods receipt — so nothing is lost in translation.
        </div>
      </div>
    </section>
  );
}
