'use client';

import { Fragment, useState, type ReactNode } from 'react';
import * as ui from '@/components/Pret/supportCentreUi';
import { dayLabel, money, round2, signedMoney } from '@/components/Pret/cashFixtures';
import { dayOf } from '@/components/Pret/cashStore';
import { BANK_STATE_LABEL, BANK_STATE_PILL, SHORT_OVER_LOOK, paidOutsLate, type LedgerRow } from '@/components/Pret/dunkinReport';
import OracleDayPanel from './OracleDayPanel';

/** Explained, still inside the two days to explain, or late. */
export function PaidOutState({ r }: { r: LedgerRow }) {
  if (!r.paidOutValue) return null;
  if (r.explainedValue === r.paidOutValue) return <div style={ui.muted}>Explained</div>;
  const left = money(round2(r.paidOutValue - r.explainedValue));
  return paidOutsLate(r) ? <div><span style={ui.pill('warn')}>{left} not explained</span></div> : <div style={ui.muted}>{left} to explain</div>;
}

/** A Dunkin shop's closed days: Oracle's cash due, the deposit, the difference, paid outs and where the cash is. */
export default function DunkinDays({ rows, closeDetail }: { rows: LedgerRow[]; closeDetail: (r: LedgerRow) => ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const now = new Date();
  if (rows.length === 0) return <p style={ui.muted}>No days closed in this period.</p>;
  return (
    <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label="Days table, scrolls sideways">
      <table style={ui.table}>
        <thead>
          <tr>
            <th style={ui.th}>Day</th>
            <th style={ui.thNum}>Cash due</th>
            <th style={ui.thNum}>Deposited</th>
            <th style={ui.thNum}>Short or over</th>
            <th style={ui.thNum}>Paid outs</th>
            <th style={ui.th}>Bank</th>
            <th style={ui.th}>Closed by</th>
            <th style={ui.th}><span className="sr-only">Details</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isOpen = open === r.close.id;
            return (
              <Fragment key={r.close.id}>
                <tr>
                  <td style={ui.td}>
                    {dayLabel(r.day, now)}
                    {r.note && <div style={ui.muted}>{r.note}</div>}
                  </td>
                  <td style={ui.tdNum}>{money(r.cashDue)}</td>
                  <td style={ui.tdNum}>{money(r.deposited)}</td>
                  <td style={ui.tdNum}>
                    {r.shortOver === 0 ? <span style={ui.muted}>Matches</span>
                      : Math.abs(r.shortOver) > SHORT_OVER_LOOK ? <span style={ui.pill('warn')}>{signedMoney(r.shortOver)}</span>
                        : signedMoney(r.shortOver)}
                  </td>
                  <td style={ui.tdNum}>
                    {r.paidOutValue ? money(r.paidOutValue) : <span style={ui.muted}>None</span>}
                    <PaidOutState r={r} />
                  </td>
                  <td style={ui.td}>
                    <span style={ui.pill(BANK_STATE_PILL[r.bank])}>{BANK_STATE_LABEL[r.bank]}</span>
                    {r.deposit && <div style={ui.muted}>Deposited {dayLabel(dayOf(r.deposit.when, now), now)}{r.bankDiff < 0 ? `, ${money(-r.bankDiff)} short` : ''}</div>}
                  </td>
                  <td style={ui.td}>{r.close.by}</td>
                  <td style={{ ...ui.td, textAlign: 'right' }}>
                    <button type="button" className="no-print" style={{ ...ui.ghostBtn, minHeight: 44 }} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.close.id)}>
                      {isOpen ? 'Hide' : 'Open day'}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={8} style={{ ...ui.td, background: '#ffffff', padding: '16px 4px 20px' }}>
                      <OracleDayPanel row={r} />
                      <div style={{ marginTop: 18 }}>{closeDetail(r)}</div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
