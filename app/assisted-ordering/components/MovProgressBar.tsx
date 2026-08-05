'use client';

import { BASE_CURRENCY, formatMoneyRounded, type CurrencyCode } from '@/lib/currency';

interface Props {
  current: number;
  /** In the supplier's `currency` — MOVs are agreed in the billing currency. */
  minimum: number;
  currency?: CurrencyCode;
}

export default function MovProgressBar({ current, minimum, currency = BASE_CURRENCY }: Props) {
  if (minimum === 0) return null;
  const fmt = (n: number) => formatMoneyRounded(n, currency);

  const pct = Math.min(100, (current / minimum) * 100);
  const met = current >= minimum;
  const close = pct >= 70;

  // Not meeting the MOV yet is a to-do, not a failure — red is reserved
  // for genuinely broken states. Close = the warning yellow field; far =
  // neutral navy progress.
  const barColor = met ? '#166534' : close ? '#EAD173' : '#001C35';
  const bgColor = met ? 'rgba(22, 101, 52, 0.10)' : close ? '#FEF6DA' : 'rgba(0, 28, 53, 0.08)';

  return (
    <div style={{ marginTop: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: met ? '#166534' : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {met
            ? 'Minimum order met'
            : `${fmt(minimum - current)} to reach minimum`}
        </span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {fmt(current)} / {fmt(minimum)}
        </span>
      </div>
      <div
        style={{
          height: '6px',
          borderRadius: '999px',
          background: bgColor,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: '999px',
            background: barColor,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}
