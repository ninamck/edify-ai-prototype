'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import * as ui from '../supportCentreUi';
import { useCashShop } from './useCashShop';
import { Notice, Stat } from './CashUi';
import { WEEKDAY, dayDate, dayLabel, hm, hmLabel, money } from '../cashFixtures';
import { nowMinute, tillDataTo } from '../cashStore';
import { dunkinCashDue } from '../cashOperators';
import { useDunkinCloseProgress } from './DunkinClose';
import { paidOutSummary, paidOutsFor, usePaidOutNotes } from '../paidOuts';

export function PaidOutStat({ summary }: { summary: ReturnType<typeof paidOutSummary> }) {
  return (
    <Stat
      label="Paid outs to explain"
      value={summary.open.length ? `${summary.open.length}, ${money(summary.openValue)}` : 'None'}
      sub={
        summary.open.length ? (
          <>
            {summary.late.length ? `${summary.late.length} older than two days. ` : ''}
            <Link href="/cash/paid-outs" style={{ color: 'inherit', fontWeight: 700 }}>Explain</Link>
          </>
        ) : 'All explained.'
      }
      tone={summary.late.length ? 'warn' : 'neutral'}
    />
  );
}

/** Kyle's day: one card to close the day, and any cash still waiting for the bank. */
export default function DunkinToday() {
  const cash = useCashShop();
  const [notes] = usePaidOutNotes();
  const progress = useDunkinCloseProgress();
  const { shop, rules } = cash;
  if (!shop || !progress) return null;

  const now = new Date();
  const dataTo = Math.max(0, tillDataTo(shop, now));
  const summary = paidOutSummary(paidOutsFor(shop, notes, now));
  const { sales, paidOut, paidIn, due } = dunkinCashDue(shop, progress.todays, dataTo);
  const { close, banked, openPaidOuts } = progress;
  const { waiting, waitingValue, last, sinceLast, late: overdue, missedDay } = progress.deposit;
  const depositDays = rules.collectionDays.map(d => WEEKDAY[d]).join(', ');
  const closeDue = hm(shop.close);
  const lateClose = !close && nowMinute(now) >= closeDue;

  const steps = [
    { label: 'Paid outs', done: openPaidOuts.length === 0, note: openPaidOuts.length ? `${openPaidOuts.length} to explain` : 'All explained' },
    { label: 'Count', done: !!close, note: close ? `Done, ${close.by}` : `After close at ${hmLabel(closeDue)}` },
    { label: 'Bank slip', done: banked, note: banked ? 'Deposited' : close ? 'Cash in the safe' : 'After the count' },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  const action = !close ? (lateClose ? 'Close the day now' : 'Start') : !banked ? 'Deposit now' : openPaidOuts.length ? 'Explain paid outs' : 'See the close';
  const href = close && !banked ? '/cash/end-of-day?step=deposit' : '/cash/end-of-day';
  const urgent = lateClose || overdue;

  return (
    <div style={ui.page}>
      <div>
        <h1 style={ui.h1}>Cash today</h1>
      </div>

      {overdue && (
        <Notice tone="warn">
          <strong>No bank deposit for {sinceLast} days.</strong> {missedDay !== undefined ? `${WEEKDAY[dayDate(missedDay, now).getDay()]}'s deposit was missed and ` : ''}
          {money(waitingValue)} is waiting. {shop.team[0]} got a reminder on their phone at 09:00.
        </Notice>
      )}

      <section aria-labelledby="close-h" style={{ ...ui.card, gap: 16, ...(urgent ? { border: '2px solid var(--color-warning-border)' } : {}) }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h2 id="close-h" style={{ ...ui.h2, fontSize: 20 }}>Close the day</h2>
            <span style={ui.muted}>{allDone ? 'All three steps done.' : `${doneCount} of 3 steps done`}</span>
          </div>
          <Link href={href} style={{ ...(allDone ? ui.ghostBtn : ui.primaryBtn), minHeight: 44, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            {action}
          </Link>
        </div>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          {steps.map((s, i) => (
            <li key={s.label} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
              border: '1px solid var(--color-border-subtle)', background: s.done ? 'var(--color-review-light)' : '#ffffff',
            }}>
              <span aria-hidden style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
                border: '1px solid var(--color-text-primary)', background: '#ffffff',
              }}>
                {s.done ? <Check size={14} /> : i + 1}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{s.label}<span style={srOnly}>{s.done ? ', done' : ', to do'}</span></span>
                <span style={ui.muted}>{s.note}</span>
              </span>
            </li>
          ))}
        </ol>
        {waiting.length > 0 && (
          <p style={{ margin: 0, fontSize: 14, paddingTop: 12, borderTop: '1px solid var(--color-border-subtle)' }}>
            <strong>Deposit waiting:</strong> {money(waitingValue)} in the safe, from {waiting.map(b => dayLabel(b.day, now)).join(', ')}. Deposit days: {depositDays}.
          </p>
        )}
      </section>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat
          label="Cash due so far"
          value={money(due)}
          sub={`Cash sales ${money(sales)} less paid outs ${money(paidOut)}${paidIn ? ` plus paid ins ${money(paidIn)}` : ''}. Till data to ${hmLabel(dataTo)}.`}
        />
        <Stat
          label="Last deposit"
          value={last ? dayLabel(-(sinceLast ?? 0), now) : 'None'}
          sub={last ? `${money(last.value)}${last.bankName ? `, ${last.bankName}` : ''}.` : undefined}
          tone={overdue ? 'warn' : 'neutral'}
        />
        <PaidOutStat summary={summary} />
      </div>
    </div>
  );
}

const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' };
