'use client';

/**
 * FxAttributionCard — the multi-currency demo's "differentiator" moment.
 *
 * Edify AI decomposes a period-on-period cost movement into price, volume
 * and exchange-rate effects, answering "is this a real price rise or just
 * FX?". Static scripted content (like the other Edify COGS insights);
 * renders only on the Second Cup multi-currency build.
 */

import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { isMultiCurrencyDemo } from '@/lib/demoConfig';
import { gbp } from './format';

type FxDriver = {
  id: 'fx' | 'price' | 'volume';
  label: string;
  pp: number;
  amount: number;
  color: string;
  detail: string;
};

// Coffee & beans category, this period vs last, for the UK store buying
// from Second Cup Central Supply (billed in CAD, reported in GBP).
const TOTAL_MOVE_PCT = 6.2;
const TOTAL_MOVE_GBP = 214;

const DRIVERS: FxDriver[] = [
  {
    id: 'fx',
    label: 'Exchange rate',
    pp: 4.1,
    amount: 142,
    color: '#4a6cb5',
    detail: 'USD weakened against CAD across the period\u2019s receipts',
  },
  {
    id: 'price',
    label: 'Supplier price',
    pp: 1.8,
    amount: 62,
    color: '#B45309',
    detail: 'Espresso Forte list price rose CA$1.20/case at source',
  },
  {
    id: 'volume',
    label: 'Volume',
    pp: 0.3,
    amount: 10,
    color: '#6B5E55',
    detail: 'Slightly more cases bought than last period',
  },
];

export default function FxAttributionCard() {
  if (!isMultiCurrencyDemo) return null;

  const totalPp = DRIVERS.reduce((s, d) => s + d.pp, 0);

  return (
    <div
      style={{
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <EdifyMark size={14} color="var(--color-accent-deep)" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Edify insight — FX vs price attribution
        </span>
        <span
          style={{
            marginLeft: 'auto',
            padding: '2px 9px',
            borderRadius: 100,
            background: 'var(--color-bg-hover)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          Supplier bills in CAD · reported in USD
        </span>
      </div>

      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Headline */}
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
          Coffee &amp; beans cost is up {TOTAL_MOVE_PCT.toFixed(1)}% ({gbp(TOTAL_MOVE_GBP, { decimals: 0 })}) vs last
          period — but two-thirds of that is the exchange rate, not the supplier.
        </div>

        {/* Attribution bar */}
        <div>
          <div
            style={{
              display: 'flex',
              height: 14,
              borderRadius: 7,
              overflow: 'hidden',
              background: 'var(--color-border-subtle)',
            }}
          >
            {DRIVERS.map((d) => (
              <span
                key={d.id}
                title={`${d.label}: +${d.pp.toFixed(1)}pp`}
                style={{ width: `${(d.pp / totalPp) * 100}%`, background: d.color }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
            {DRIVERS.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, minWidth: 170, flex: '1 1 170px' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {d.label}{' '}
                    <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      +{d.pp.toFixed(1)}pp · {gbp(d.amount, { decimals: 0 })}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    {d.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The "so what" */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--color-bg-hover)',
            fontSize: 12.5,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          Purchases from <strong style={{ color: 'var(--color-text-primary)' }}>Second Cup Central Supply</strong> are
          billed in CAD and booked at the rate locked at each goods receipt, so Edify can separate currency movement
          from genuine price change. Only <strong style={{ color: 'var(--color-text-primary)' }}>+1.8pp is a real
          supplier increase</strong> — worth a conversation. The FX slice isn&apos;t negotiable with the supplier;
          if it persists, consider agreeing a contracted rate with the franchisor on the supplier record.
        </div>
      </div>
    </div>
  );
}
