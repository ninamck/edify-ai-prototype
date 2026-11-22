'use client';

import type { CSSProperties, ReactNode } from 'react';
import * as ui from '@/components/Pret/supportCentreUi';
import { money, signedMoney } from '@/components/Pret/cashFixtures';
import type { LedgerRow, Tally } from '@/components/Pret/dunkinReport';

type Line = { label: string; count?: number; value: ReactNode; strong?: boolean; note?: string };

const t = (label: string, x: Tally, note?: string): Line => ({ label, count: x.count, value: money(x.value), note });

function Group({ title, lines, counts }: { title: string; lines: Line[]; counts?: boolean }) {
  return (
    <section aria-label={title} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>{title}</h4>
      <table style={{ ...ui.table, fontSize: 13 }}>
        {counts && (
          <thead>
            <tr>
              <th style={{ ...ui.th, padding: '4px 0' }}><span className="sr-only">Line</span></th>
              <th style={{ ...ui.thNum, padding: '4px 0' }}>Count</th>
              <th style={{ ...ui.thNum, padding: '4px 0' }}>Amount</th>
            </tr>
          </thead>
        )}
        <tbody>
          {lines.map(l => (
            <tr key={l.label}>
              <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: l.strong ? 700 : 400 }}>
                {l.label}
                {l.note && <div style={{ ...ui.muted, fontWeight: 400 }}>{l.note}</div>}
              </th>
              {counts && <td style={{ ...cell, textAlign: 'right' }}>{l.count ?? ''}</td>}
              <td style={{ ...cell, textAlign: 'right', fontWeight: l.strong ? 700 : 400 }}>{l.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const cell: CSSProperties = { padding: '5px 0', borderTop: '1px solid var(--color-border-subtle)', fontVariantNumeric: 'tabular-nums', verticalAlign: 'top' };

/** One store's day as Oracle reports it, with the deposit and over/short Oracle never gets filled in from the close. */
export default function OracleDayPanel({ row, flags = [] }: { row: LedgerRow; flags?: string[] }) {
  const o = row.oracle;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ ...ui.muted, fontSize: 13 }}>
        From Oracle, pulled after close. Deposit and over/short come from the shop&apos;s close in Edify, so they&apos;re never blank.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '18px 28px' }}>
        <Group title="Sales" lines={[
          { label: 'Net sales', value: money(o.netSales) },
          { label: 'Service charges', value: money(o.serviceCharges) },
          { label: 'Tax collected', value: money(o.tax) },
          { label: 'Total revenue', value: money(o.totalRevenue), strong: true },
          { label: 'Non-revenue service', value: money(o.nonRevenueSvc) },
          { label: 'Gift card sales', value: money(o.giftCardSales) },
          { label: 'Total collections', value: money(o.totalCollections), strong: true },
        ]} />
        <Group title="Cash" lines={[
          { label: 'Cash collected', value: money(o.cashIn) },
          { label: 'Paid outs', value: money(o.paidOut), note: row.paidOutValue > row.explainedValue ? `${money(row.paidOutValue - row.explainedValue)} not explained` : undefined },
          { label: 'Paid ins', value: money(o.paidIn) },
          { label: 'Cash due', value: money(o.cashDue), strong: true },
          { label: 'Deposit', value: money(row.deposited), note: 'Counted and bagged at close' },
          { label: 'Over/short', value: row.shortOver === 0 ? money(0) : signedMoney(row.shortOver), strong: true },
        ]} />
        <Group title="Adjustments" counts lines={[
          t('Returns', o.returns),
          t('Voids', o.voids),
          t('Manager voids', o.mgrVoids),
          t('Error corrects', o.errorCorrects, flags.find(f => f.startsWith('Error'))),
          t('Cancels', o.cancels, flags.find(f => f.startsWith('Cancels'))),
          { label: 'Credit total', value: money(o.creditTotal) },
          { label: 'Rounding total', value: money(o.rounding) },
        ]} />
        <Group title="Checks" counts lines={[
          t('Carried over', o.checks.carriedOver),
          t('Begun', o.checks.begun),
          t('Paid', o.checks.paid),
          t('Transferred in', o.checks.transferredIn),
          t('Transferred out', o.checks.transferredOut),
          t('Outstanding', o.checks.outstanding),
        ]} />
      </div>
    </div>
  );
}
