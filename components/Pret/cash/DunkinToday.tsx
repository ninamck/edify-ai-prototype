'use client';

import Link from 'next/link';
import * as ui from '../supportCentreUi';
import { useCashShop } from './useCashShop';
import { Notice, Stat } from './CashUi';
import { WEEKDAY, cashSalesUpTo, dayDate, dayLabel, hm, hmLabel, money, round2 } from '../cashFixtures';
import { closeToday, nowMinute, tillDataTo } from '../cashStore';
import { depositStatus } from '../cashOperators';
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

/** Kyle's day: what's due, when cash last went to the bank, and what needs explaining. */
export default function DunkinToday() {
  const cash = useCashShop();
  const [notes] = usePaidOutNotes();
  const { shop, rules } = cash;
  if (!shop) return null;

  const now = new Date();
  const dataTo = Math.max(0, tillDataTo(shop, now));
  const all = paidOutsFor(shop, notes, now);
  const summary = paidOutSummary(all);
  const todays = all.filter(p => p.day === 0);
  const sales = round2(shop.tills.reduce((s, _, i) => s + (cashSalesUpTo(shop, i, 0, dataTo, ['GBP']).GBP ?? 0), 0));
  const paidOut = round2(todays.reduce((s, p) => s + p.value, 0));
  const closed = closeToday(shop.siteId, cash.closes, now);
  const { waiting, waitingValue, last, sinceLast, late: overdue, missedDay } = depositStatus(shop, { ...cash, rules }, now);
  const depositDays = rules.collectionDays.map(d => WEEKDAY[d]).join(', ');
  const closeDue = hm(shop.close);

  const tasks = [
    {
      id: 'eod', label: 'End of day', href: '/cash/end-of-day', action: 'Start',
      done: closed ? `Done, ${closed.by}` : undefined,
      detail: closed ? undefined : `After close at ${hmLabel(closeDue)}`,
      due: !closed && nowMinute(now) >= closeDue,
    },
    {
      id: 'deposit', label: 'Bank deposit', href: '/cash/collection', action: 'Record deposit',
      done: !waiting.length ? (sinceLast === 0 ? 'Deposited today' : 'Nothing waiting') : undefined,
      detail: waiting.length ? `${money(waitingValue)} waiting. Deposit days: ${depositDays}.` : undefined,
      due: overdue,
    },
    {
      id: 'paid-outs', label: 'Explain paid outs', href: '/cash/paid-outs', action: 'Explain',
      done: summary.open.length ? undefined : 'All explained',
      detail: summary.open.length ? `${summary.open.length} open, ${money(summary.openValue)}` : undefined,
      due: summary.late.length > 0,
    },
  ];

  return (
    <div style={ui.page}>
      <div>
        <h1 style={ui.h1}>Cash today</h1>
      </div>

      {overdue && (
        <Notice tone="warn">
          <strong>No bank deposit for {sinceLast} days.</strong> {missedDay !== undefined ? `${WEEKDAY[dayDate(missedDay, now).getDay()]}'s deposit was missed and ` : ''}
          {money(waitingValue)} is waiting. {shop.team[0]} got a reminder on their phone at 09:00.{' '}
          <Link href="/cash/collection" style={{ color: 'inherit', fontWeight: 700 }}>Record deposit</Link>
        </Notice>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat
          label="Cash due so far"
          value={money(round2(sales - paidOut))}
          sub={`Cash sales ${money(sales)} less paid outs ${money(paidOut)}. Till data to ${hmLabel(dataTo)}.`}
        />
        <Stat
          label="Last deposit"
          value={last ? dayLabel(-(sinceLast ?? 0), now) : 'None'}
          sub={last ? `${money(last.value)}${last.bankName ? `, ${last.bankName}` : ''}.${waiting.length ? ` ${money(waitingValue)} waiting.` : ''}` : undefined}
          tone={overdue ? 'warn' : 'neutral'}
        />
        <PaidOutStat summary={summary} />
      </div>

      <section style={ui.card} aria-labelledby="tasks-h">
        <h2 id="tasks-h" style={ui.h2}>Tasks</h2>
        <ul className="row-list" style={ui.rowList}>
          {tasks.map(t => (
            <li key={t.id} style={{ ...ui.listRow, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 320px' }}>
                {t.due ? (
                  <span style={{ ...ui.pill('warn'), minWidth: 74, textAlign: 'center' }}>Overdue</span>
                ) : (
                  <span style={{ ...ui.muted, minWidth: 74, textAlign: 'center', fontWeight: 600 }}>{t.done ? 'Done' : 'To do'}</span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: t.done ? 'var(--color-text-secondary)' : undefined }}>{t.label}</span>
                  <span style={ui.muted}>{t.done ?? t.detail}</span>
                </div>
              </div>
              {!t.done && (
                <Link href={t.href} style={{ ...(t.due ? ui.primaryBtn : ui.ghostBtn), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  {t.action}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
