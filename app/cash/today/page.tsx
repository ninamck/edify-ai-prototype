'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import * as ui from '@/components/Pret/supportCentreUi';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import {
  Corrected, CorrectionControl, CorrectionTrail, NoShop, Notice, Stat, VarianceText,
} from '@/components/Pret/cash/CashUi';
import { WEEKDAY, dayPhrase, money, round2, TENDER_LABEL, type Tender } from '@/components/Pret/cashFixtures';
import {
  COUNT_KIND_LABEL,
  REQUEST_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_PILL,
  cashTasksFor,
  corrected,
  countPlace,
  countedOf,
  dayOf,
  expectedForCount,
  exposureFor,
  isMovement,
  nowMinute,
  timeOf,
  tillDataTo,
  todaysCounts,
} from '@/components/Pret/cashStore';
import { hmLabel } from '@/components/Pret/cashFixtures';
import { useDunkinCash, useOperatorCash } from '@/components/Pret/cashOperators';
import { paidOutSummary, paidOutsFor, usePaidOutNotes } from '@/components/Pret/paidOuts';
import DunkinToday, { PaidOutStat } from '@/components/Pret/cash/DunkinToday';

export default function CashTodayPage() {
  return (
    <Suspense>
      <CashToday />
    </Suspense>
  );
}

function CashToday() {
  const cash = useCashShop();
  const params = useSearchParams();
  const operators = useOperatorCash();
  const dunkin = useDunkinCash();
  const [notes] = usePaidOutNotes();
  const { shop, rules } = cash;
  if (!shop) return <NoShop />;
  if (dunkin) return <DunkinToday />;
  const paidOuts = paidOutSummary(paidOutsFor(shop, notes));

  const now = new Date();
  const data = { counts: cash.counts, closes: cash.closes, collections: cash.collections, requests: cash.requests, rules, corrections: cash.corrections };
  const tasks = cashTasksFor(shop.siteId, data, now);
  const exposure = exposureFor(shop.siteId, data, now);
  const today = todaysCounts(cash.counts, shop.siteId, now);
  const lag = nowMinute(now) - Math.min(nowMinute(now), Math.max(0, tillDataTo(shop, now)));
  const saved = params.get('saved');
  const savedCount = saved ? cash.counts.find(c => c.id === saved) : undefined;
  const closedNow = params.get('closed') === '1';
  const open = tasks.filter(t => t.status !== 'done');
  const overdue = tasks.filter(t => t.status === 'overdue');
  const requests = cash.requests.filter(r => r.siteId === shop.siteId && dayOf(r.when, now) >= -1);
  const nextCollection = (() => {
    for (let i = 0; i < 8; i += 1) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      if (rules.collectionDays.includes(d.getDay())) return i === 0 ? 'today' : i === 1 ? 'tomorrow' : WEEKDAY[d.getDay()];
    }
    return 'not set';
  })();
  const safePct = exposure.total / exposure.limit;

  return (
    <div style={ui.page}>
      <div>
        <h1 style={ui.h1}>Cash today</h1>
      </div>

      {savedCount && (
        <Notice tone="good">
          Saved: {COUNT_KIND_LABEL[savedCount.kind]}{countPlace(savedCount) ? `, ${countPlace(savedCount)}` : ''} at {timeOf(savedCount.when)}, counted by {savedCount.countedBy}
          {savedCount.checkedBy ? ` and checked by ${savedCount.checkedBy}` : ''}.
        </Notice>
      )}
      {closedNow && <Notice tone="good">Day closed. Bags are in the safe for collection.</Notice>}

      {requests.map(r => (
        <Notice key={r.id} tone="warn">
          <strong>{REQUEST_LABEL[r.kind]}</strong>, requested by {r.by} at {timeOf(r.when)}
          {r.forDay ? `, collector due ${dayPhrase(dayOf(r.forDay, now), now)}` : ''}. {r.note}
        </Notice>
      ))}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat
          label="Cash in the safe"
          value={`${money(exposure.total)} of ${money(exposure.limit)}`}
          sub={`Float ${money(exposure.safeFloat)}, bags ${money(exposure.bagsValue)}, skims ${money(exposure.skims)}${exposure.movements ? `, cash in and out ${money(exposure.movements)}` : ''}.${safePct > 1 ? ' Over the limit.' : safePct > 0.8 ? ' Near the limit.' : ''}`}
          tone={safePct > 0.8 ? 'warn' : 'neutral'}
        />
        <Stat
          label="Bags waiting for collection"
          value={exposure.bags.length ? `${exposure.bags.length} bags` : 'None'}
          sub={
            exposure.oldestDay !== undefined
              ? `Oldest ${-exposure.oldestDay} ${exposure.oldestDay === -1 ? 'day' : 'days'}. Next collection ${nextCollection}.`
              : `Next collection ${nextCollection}.`
          }
          tone={exposure.oldestDay !== undefined && exposure.oldestDay <= -3 ? 'warn' : 'neutral'}
        />
        <Stat
          label="Till data"
          value={`Up to ${hmLabel(Math.max(0, tillDataTo(shop, now)))}`}
          sub={lag > 20 ? `${lag} minutes behind. Expected cash updates when it arrives.` : `${lag} minutes behind.`}
          tone={lag > 20 ? 'warn' : 'neutral'}
        />
        <PaidOutStat summary={paidOuts} />
      </div>

      <section style={ui.card} aria-labelledby="tasks-h">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 id="tasks-h" style={ui.h2}>Tasks</h2>
          <span style={ui.muted}>
            {open.length ? `${open.length} to do${overdue.length ? `, ${overdue.length} overdue` : ''}` : 'All done'}
          </span>
        </div>
        <ul className="row-list" style={ui.rowList}>
          {tasks.map(t => (
            <li key={t.id} style={{ ...ui.listRow, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 320px' }}>
                {t.status === 'overdue' || t.status === 'due' ? (
                  <span style={{ ...ui.pill(TASK_STATUS_PILL[t.status]), minWidth: 74, textAlign: 'center' }}>{TASK_STATUS_LABEL[t.status]}</span>
                ) : (
                  <span style={{ ...ui.muted, minWidth: 74, textAlign: 'center', fontWeight: 600 }}>{TASK_STATUS_LABEL[t.status]}</span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: t.status === 'done' ? 'var(--color-text-secondary)' : undefined }}>{t.label}</span>
                  <span style={ui.muted}>
                    {t.status === 'done' ? `${t.doneAt}, ${t.doneBy}` : `By ${hmLabel(t.due)}${t.detail ? `. ${t.detail}` : ''}`}
                  </span>
                </div>
              </div>
              {t.status !== 'done' && (
                <Link href={t.href} style={{ ...(t.status === 'later' ? ui.ghostBtn : ui.primaryBtn), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  {t.id === 'close' ? 'Close the day' : t.id === 'collection' ? 'Record collection' : 'Count now'}
                </Link>
              )}
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/cash/count?kind=handover" style={{ ...ui.ghostBtn, textDecoration: 'none' }}>Handover count</Link>
          <Link href="/cash/count?kind=spot-check" style={{ ...ui.ghostBtn, textDecoration: 'none' }}>Spot check</Link>
          <Link href="/cash/count?kind=skim" style={{ ...ui.ghostBtn, textDecoration: 'none' }}>Skim</Link>
          {operators && (
            <>
              <Link href="/cash/count?kind=cash-out" style={{ ...ui.ghostBtn, textDecoration: 'none' }}>Early cash-out</Link>
              <Link href="/cash/movements" style={{ ...ui.ghostBtn, textDecoration: 'none' }}>Cash in or out</Link>
            </>
          )}
        </div>
      </section>

      <section style={ui.card} aria-labelledby="counts-h">
        <h2 id="counts-h" style={ui.h2}>Counts today</h2>
        {today.length === 0 ? (
          <p style={ui.muted}>No counts yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Time</th>
                  <th style={ui.th}>Count</th>
                  <th style={ui.thNum}>Counted</th>
                  <th style={ui.thNum}>Expected</th>
                  <th style={ui.th}>Variance</th>
                  <th style={ui.th}>Counted by</th>
                  <th style={ui.th}><span className="sr-only">Correct</span></th>
                </tr>
              </thead>
              <tbody>
                {today.map(c => {
                  const counted = countedOf(c);
                  const gbp = corrected(c.id, 'counted', counted.GBP ?? 0, cash.corrections);
                  const isCorr = gbp !== (counted.GBP ?? 0);
                  const exp = expectedForCount(c, cash.counts, rules, now);
                  const expGbp = exp?.amounts.GBP;
                  const others = (Object.keys(counted) as Tender[]).filter(t => t !== 'GBP' && counted[t]);
                  return (
                    <tr key={c.id}>
                      <td style={ui.td}>{timeOf(c.when)}</td>
                      <td style={ui.td}>
                        {COUNT_KIND_LABEL[c.kind]}{countPlace(c) ? `, ${countPlace(c)}` : ''}
                        {c.category && <div style={ui.muted}>{c.category}</div>}
                        {c.reason && <div style={ui.muted}>{isMovement(c.kind) ? 'Note' : 'Reason'}: {c.reason}</div>}
                        <CorrectionTrail recordId={c.id} corrections={cash.corrections} />
                      </td>
                      <td style={ui.tdNum}>
                        <Corrected
                          show={c.kind === 'skim' ? `${money(gbp)} taken out` : c.kind === 'paid-out' ? `${money(gbp)} out` : c.kind === 'paid-in' || c.kind === 'change-in' ? `${money(gbp)} in` : money(gbp)}
                          isCorrected={isCorr}
                        />
                        {others.map(t => (
                          <div key={t} style={ui.muted}>{TENDER_LABEL[t]} {money(counted[t] ?? 0, t)}</div>
                        ))}
                      </td>
                      <td style={ui.tdNum}>{expGbp === undefined ? '–' : money(expGbp)}</td>
                      <td style={ui.td}>
                        {expGbp === undefined ? (
                          <span style={ui.muted}>–</span>
                        ) : (
                          <VarianceText variance={round2(gbp - expGbp)} rules={rules} provisional={exp?.provisional} />
                        )}
                        {exp?.provisional && <div style={ui.muted}>Till data to {exp.dataTo}</div>}
                      </td>
                      <td style={ui.td}>
                        {c.countedBy}
                        {c.checkedBy && <div style={ui.muted}>Checked by {c.checkedBy}</div>}
                      </td>
                      <td style={ui.td}>
                        <CorrectionControl
                          recordId={c.id}
                          field="counted"
                          label="Counted amount"
                          current={gbp}
                          kind="money"
                          people={shop.team}
                          me={cash.me.name}
                          onSave={corr => cash.setCorrections(prev => [...prev, corr])}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
