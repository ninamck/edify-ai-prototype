'use client';

import { Fragment, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as ui from '@/components/Pret/supportCentreUi';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import CloseSummary from '@/components/Pret/cash/CloseSummary';
import { NoShop, VarianceText, downloadCsv } from '@/components/Pret/cash/CashUi';
import { HISTORY_DAYS, cashShop, dayLabel, dayPhrase, historySafeCounts, money, round2 } from '@/components/Pret/cashFixtures';
import {
  CHANGE_BAGS, COUNT_KIND_LABEL, allBags, allCloses, allCollections, changeOrderValue, corrected, countPlace, countedOf, dayOf, expectedForCount,
  timeOf, todaysCounts, toleranceOf,
} from '@/components/Pret/cashStore';
import VarianceTrend from '@/components/Pret/cash/VarianceTrend';
import {
  asDeposit, bankDifference, coveredDays, landingFor, missingAtBank, safeLedger, useBankLandings, useDunkinCash, useOperatorCash,
} from '@/components/Pret/cashOperators';
import { SlipCell } from '@/components/Pret/cash/SlipField';
import { whenLabel } from '@/components/Pret/countStore';
import DayRangePicker, { control, rangeLabel, type DayRange } from '@/components/Pret/cash/DayRangePicker';

const LAST_7: DayRange = { lo: -6, hi: 0 };

type View = 'bankings' | 'collections' | 'variances' | 'safe' | 'change' | 'balance';
const VIEWS: { id: View; label: string }[] = [
  { id: 'bankings', label: 'Bankings' },
  { id: 'collections', label: 'Collections' },
  { id: 'variances', label: 'Variances' },
  { id: 'safe', label: 'Safe counts' },
  { id: 'change', label: 'Change orders' },
];
const OPERATOR_VIEWS: { id: View; label: string }[] = [...VIEWS, { id: 'balance', label: 'Safe balance' }];
const DUNKIN_VIEWS: { id: View; label: string }[] = [
  { id: 'bankings', label: 'Days' },
  { id: 'collections', label: 'Deposits' },
  { id: 'variances', label: 'Variances' },
];

type VarRow = { key: string; day: number; time: string; what: string; expected: number; counted: number; by: string };

export default function CashHistoryPage() {
  return (
    <Suspense>
      <CashHistory />
    </Suspense>
  );
}

function CashHistory() {
  const cash = useCashShop();
  const { shop, rules, me } = cash;
  const params = useSearchParams();
  const [view, setView] = useState<View>(() => (params.get('view') as View | null) ?? 'bankings');
  const [range, setRange] = useState<DayRange>(LAST_7);
  const [openClose, setOpenClose] = useState<string | null>(null);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const operators = useOperatorCash();
  const dunkin = useDunkinCash();
  const banked = operators || dunkin;
  const [landings, setLandings] = useBankLandings();

  if (!shop) return <NoShop />;
  const now = new Date();
  const views = dunkin ? DUNKIN_VIEWS : operators ? OPERATOR_VIEWS : VIEWS;
  const shown: View = views.some(v => v.id === view) ? view : 'bankings';
  const { lo, hi } = range;
  const inRange = (d: number) => d >= lo && d <= hi;
  const periodLabel = rangeLabel(range, now);

  const closes = allCloses(shop.siteId, cash.closes, now).filter(c => inRange(c.day)).reverse();
  const bags = allBags(shop.siteId, cash.closes, cash.collections, cash.corrections, now);
  const collections = allCollections(shop.siteId, cash.collections).filter(c => inRange(dayOf(c.when, now))).reverse()
    .map(c => (dunkin ? asDeposit(c) : c));
  const today = todaysCounts(cash.counts, shop.siteId, now);

  const varRows: VarRow[] = [
    ...allCloses(shop.siteId, cash.closes, now).flatMap(c =>
      c.tills.map(t => ({
        key: `${c.id}-${t.till}`, day: c.day, time: timeOf(c.when), what: `${dunkin ? 'End of day' : 'Cash-out'}, ${t.till}`,
        expected: t.expected, counted: t.counted, by: t.countedBy,
      })),
    ),
    ...(dunkin ? [] : historySafeCounts(cashShop(shop.siteId)!)).map(s => ({
      key: s.id, day: s.day, time: timeOf(s.when), what: COUNT_KIND_LABEL[s.kind], expected: s.expected, counted: s.counted, by: `${s.countedBy}, ${s.checkedBy}`,
    })),
    ...(dunkin ? [] : today).filter(c => c.kind !== 'skim' && c.kind !== 'cash-out').flatMap(c => {
      const exp = expectedForCount(c, cash.counts, rules, now);
      if (!exp || exp.provisional) return [];
      return [{
        key: c.id, day: 0, time: timeOf(c.when), what: `${COUNT_KIND_LABEL[c.kind]}${countPlace(c) ? `, ${countPlace(c)}` : ''}`,
        expected: exp.amounts.GBP ?? 0, counted: corrected(c.id, 'counted', countedOf(c).GBP ?? 0, cash.corrections),
        by: `${c.countedBy}${c.checkedBy ? `, ${c.checkedBy}` : ''}`,
      }];
    }),
  ]
    .filter(r => inRange(r.day))
    .sort((a, b) => b.day - a.day || b.time.localeCompare(a.time));
  const variances = varRows.filter(r => round2(r.counted - r.expected) !== 0 && (!flaggedOnly || toleranceOf(r.counted - r.expected, rules) !== 'ok'));
  const safeRows = varRows.filter(r => r.what === COUNT_KIND_LABEL['safe-float'] || r.what === COUNT_KIND_LABEL.handover);
  const ledger = operators
    ? safeLedger(shop.siteId, { ...cash, rules }, Array.from({ length: hi - lo + 1 }, (_, i) => hi - i), now)
    : [];
  const trendCloses = allCloses(shop.siteId, cash.closes, now).filter(c => c.day > -HISTORY_DAYS);
  const changeOrders = cash.changeOrders.filter(o => o.siteId === shop.siteId && inRange(dayOf(o.when, now))).reverse();
  const bagsLabel = (bags: Record<string, number>) =>
    Object.entries(bags).map(([id, q]) => `${q} × ${CHANGE_BAGS.find(b => b.id === id)?.label ?? id}`).join(', ');

  const exportCsv = () => {
    const head = ['Shop', shop.name, 'Period', periodLabel];
    if (shown === 'balance') {
      downloadCsv(`safe-balance-${shop.siteId}.csv`, [head, ['Date', 'Opening', 'Takings in', 'Banked out', 'Cash in and out', 'Closing', 'Float expected', 'Float counted next morning'],
        ...ledger.map(s => [dayLabel(s.day, now), s.opening.toFixed(2), s.added.toFixed(2), s.banked.toFixed(2), s.moved.toFixed(2), s.closing.toFixed(2),
          s.floatExpected.toFixed(2), s.floatCounted === undefined ? '' : s.floatCounted.toFixed(2)])]);
    } else if (shown === 'bankings') {
      downloadCsv(`bankings-${shop.siteId}.csv`, [head, ['Date', 'Cash takings', 'Banked', 'Inner bags', 'Charity', 'Charity slip', 'Variance', 'Closed by', 'Checked by'],
        ...closes.map(c => {
          const b = bags.filter(x => x.closeId === c.id);
          return [dayLabel(c.day, now), c.takingsCash.toFixed(2), b.filter(x => x.kind === 'takings').reduce((s, x) => s + x.value, 0).toFixed(2),
            b.map(x => x.shownBagNo).join(' '), (b.find(x => x.kind === 'charity')?.value ?? 0).toFixed(2), c.charity?.slipNo ?? '', c.variance.toFixed(2), c.by, c.checkedBy ?? ''];
        })]);
    } else if (shown === 'change') {
      downloadCsv(`change-orders-${shop.siteId}.csv`, [head, ['Ordered', 'Ordered by', 'Change', 'Value', 'Due', 'Received', 'Received by', 'Note'],
        ...changeOrders.map(o => [whenLabel(o.when), o.by, bagsLabel(o.bags), changeOrderValue(o).toFixed(2), whenLabel(o.deliverOn),
          o.receivedAt ? whenLabel(o.receivedAt) : 'Not yet', o.receivedBy ?? '', o.note ?? ''])]);
    } else if (shown === 'collections') {
      downloadCsv(`collections-${shop.siteId}.csv`, [head, ['When', 'Outer bag', 'Inner bags', 'Value', 'Collector', 'Company', 'Handed over by', 'Witnessed by',
        ...(banked ? ['Method', 'Reference', 'In the bank', 'Bank amount'] : [])],
        ...collections.map(c => {
          const l = landingFor(c, landings, now);
          return [c.when, c.outerBag, c.bagNos.join(' '), c.value.toFixed(2), c.collector, c.company, c.handedOverBy, c.witnessedBy ?? '',
            ...(banked ? [c.method === 'bank-run' ? 'Bank run' : 'Collector', c.reference ?? '', l?.when ?? 'Not yet', l?.amount?.toFixed(2) ?? ''] : [])];
        })]);
    } else {
      const rows = shown === 'variances' ? variances : safeRows;
      downloadCsv(`${shown}-${shop.siteId}.csv`, [head, ['Date', 'Time', 'Count', 'Expected', 'Counted', 'Variance', 'Counted by, checked by'],
        ...rows.map(r => [dayLabel(r.day, now), r.time, r.what, r.expected.toFixed(2), r.counted.toFixed(2), round2(r.counted - r.expected).toFixed(2), r.by])]);
    }
  };

  return (
    <div style={ui.page} className="cash-print-root">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={ui.h1}>Cash history</h1>
        <div role="group" aria-label="Dates and export" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <DayRangePicker
            value={range}
            onChange={setRange}
            min={-(HISTORY_DAYS - 1)}
            now={now}
            presets={[{ label: 'Yesterday', range: { lo: -1, hi: -1 } }, { label: 'Last 7 days', range: LAST_7 }, { label: 'Previous 7 days', range: { lo: -13, hi: -7 } }]}
          />
          <button type="button" className="no-print" style={control} onClick={exportCsv}>Export CSV</button>
          <button type="button" className="no-print" style={control} onClick={() => window.print()}>Print</button>
        </div>
      </div>

      <div role="tablist" aria-label="View" className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {views.map(v => (
          <button key={v.id} type="button" role="tab" aria-selected={shown === v.id} onClick={() => setView(v.id)}
            style={{ ...control, ...(shown === v.id ? { background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)' } : {}) }}>
            {v.label}
          </button>
        ))}
      </div>

      <section style={ui.card}>
        {shown === 'bankings' && (
          closes.length === 0 ? <p style={ui.muted}>No days closed in this period.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={ui.table}>
                <thead>
                  <tr>
                    <th style={ui.th}>Day</th>
                    <th style={ui.thNum}>Cash takings</th>
                    <th style={ui.thNum}>Banked</th>
                    <th style={ui.th}>{dunkin ? 'Deposit' : 'Inner bags'}</th>
                    {!dunkin && <th style={ui.thNum}>Charity</th>}
                    <th style={ui.th}>Variance</th>
                    <th style={ui.th}>Closed by</th>
                    <th style={ui.th}><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {closes.map(c => {
                    const b = bags.filter(x => x.closeId === c.id && (!dunkin || x.kind === 'takings'));
                    const bankedValue = round2(b.filter(x => x.kind === 'takings').reduce((s, x) => s + x.value, 0));
                    const open = openClose === c.id;
                    return (
                      <Fragment key={c.id}>
                        <tr>
                          <td style={ui.td}>{dayLabel(c.day, now)}</td>
                          <td style={ui.tdNum}>{money(c.takingsCash)}</td>
                          <td style={ui.tdNum}>{money(bankedValue)}</td>
                          <td style={ui.td}>
                            {b.map(x => (
                              <div key={x.bagNo}>
                                {dunkin ? '' : `${x.shownBagNo}${x.kind === 'charity' ? ' (charity)' : ''} `}
                                {dunkin ? (
                                  x.collectedBy ? `Deposited ${dayPhrase(dayOf(x.collectedBy.when, now), now)}` : <span style={ui.pill('warn')}>Not banked</span>
                                ) : (
                                  <span style={ui.muted}>{x.collectedBy ? `collected ${dayPhrase(dayOf(x.collectedBy.when, now), now)}` : 'in safe'}</span>
                                )}
                              </div>
                            ))}
                          </td>
                          {!dunkin && <td style={ui.tdNum}>{money(b.find(x => x.kind === 'charity')?.value ?? 0)}</td>}
                          <td style={ui.td}>
                            <VarianceText variance={c.variance} rules={rules} />
                            {c.missing.length > 0 && <div style={ui.muted}>Tasks left open</div>}
                          </td>
                          <td style={ui.td}>{c.by}</td>
                          <td style={ui.td}>
                            <button type="button" className="no-print" style={ui.ghostBtn} aria-expanded={open} onClick={() => setOpenClose(open ? null : c.id)}>
                              {open ? 'Hide' : 'Details'}
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={dunkin ? 7 : 8} style={{ ...ui.td, background: 'var(--color-bg-surface)' }}>
                              <CloseSummary close={c} corrections={cash.corrections} onCorrect={x => cash.setCorrections(prev => [...prev, x])} team={shop.team} me={me.name} rules={rules} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {shown === 'collections' && (
          collections.length === 0 ? <p style={ui.muted}>No collections in this period.</p> : (
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Day</th>
                  <th style={ui.th}>{dunkin ? 'Reference' : 'Outer bag'}</th>
                  <th style={ui.th}>{dunkin ? 'Covers' : 'Inner bags'}</th>
                  <th style={ui.thNum}>Value</th>
                  <th style={ui.th}>{dunkin ? 'Bank' : 'Collector'}</th>
                  <th style={ui.th}>{dunkin ? 'Deposited by' : 'Handed over by'}</th>
                  {dunkin && <th style={ui.th}>Slip</th>}
                  {banked && <th style={ui.th}>In bank</th>}
                </tr>
              </thead>
              <tbody>
                {collections.map(c => {
                  const landed = landingFor(c, landings, now);
                  const diff = landed ? bankDifference(c, landed) : 0;
                  return (
                    <tr key={c.id}>
                      <td style={ui.td}>{dayLabel(dayOf(c.when, now), now)} {timeOf(c.when)}</td>
                      <td style={ui.td}>
                        {dunkin ? c.reference ?? <span style={ui.muted}>None</span> : (
                          <>
                            {c.method === 'bank-run' ? 'Bank run' : c.outerBag}
                            {c.reference && <div style={ui.muted}>Ref {c.reference}</div>}
                          </>
                        )}
                      </td>
                      <td style={ui.td}>
                        {dunkin
                          ? coveredDays(c, bags, now)
                          : c.bagNos.map(n => bags.find(b => b.bagNo === n)?.shownBagNo ?? n).join(', ')}
                      </td>
                      <td style={ui.tdNum}>{money(c.value)}</td>
                      <td style={ui.td}>{c.method === 'bank-run' ? c.company : `${c.collector}, ${c.company}`}</td>
                      <td style={ui.td}>
                        {c.handedOverBy}
                        {c.witnessedBy && <div style={ui.muted}>{dunkin ? 'Checked by' : 'Witness:'} {c.witnessedBy}</div>}
                      </td>
                      {dunkin && <td style={ui.td}><SlipCell c={c} /></td>}
                      {banked && (
                        <td style={ui.td}>
                          {landed ? (
                            <>
                              {diff < 0 ? <span style={ui.pill('warn')}>Short {money(-diff)} at bank</span> : landed.amount === undefined ? 'Landed' : 'Matched'}
                              <div style={ui.muted}>{whenLabel(landed.when)}, {landed.by}</div>
                            </>
                          ) : (
                            <>
                              {missingAtBank(c, landings, now)
                                ? <span style={ui.pill('warn')}>Missing at bank, {-dayOf(c.when, now)} days</span>
                                : <span style={ui.pill('neutral')}>Waiting for the bank</span>}
                              <div className="no-print" style={{ marginTop: 4 }}>
                                <button
                                  type="button"
                                  style={ui.ghostBtn}
                                  onClick={() => setLandings(prev => ({ ...prev, [c.id]: { when: now.toISOString(), by: me.name } }))}
                                >
                                  Mark as landed
                                </button>
                              </div>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {shown === 'change' && (
          changeOrders.length === 0 ? <p style={ui.muted}>No change ordered in this period.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={ui.table}>
                <thead>
                  <tr>
                    <th style={ui.th}>Ordered</th>
                    <th style={ui.th}>Change</th>
                    <th style={ui.thNum}>Value</th>
                    <th style={ui.th}>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {changeOrders.map(o => (
                    <tr key={o.id}>
                      <td style={ui.td}>
                        {whenLabel(o.when)}
                        <div style={ui.muted}>{o.by}</div>
                      </td>
                      <td style={ui.td}>
                        {bagsLabel(o.bags)}
                        {o.note && <div style={ui.muted}>{o.note}</div>}
                      </td>
                      <td style={ui.tdNum}>{money(changeOrderValue(o))}</td>
                      <td style={ui.td}>
                        {o.receivedAt ? whenLabel(o.receivedAt) : <span style={ui.muted}>Not yet, due {whenLabel(o.deliverOn)}</span>}
                        {o.receivedBy && <div style={ui.muted}>{o.receivedBy}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {shown === 'balance' && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={ui.table}>
                <thead>
                  <tr>
                    <th style={ui.th}>Day</th>
                    <th style={ui.thNum}>Opening</th>
                    <th style={ui.thNum}>Takings</th>
                    <th style={ui.thNum}>Banked</th>
                    <th style={ui.thNum}>In and out</th>
                    <th style={ui.thNum}>Closing</th>
                    <th style={ui.th}>Next float count</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(s => (
                    <tr key={s.day}>
                      <td style={ui.td}>{dayLabel(s.day, now)}</td>
                      <td style={ui.tdNum}>{money(s.opening)}</td>
                      <td style={ui.tdNum}>{s.added ? money(s.added) : '–'}</td>
                      <td style={ui.tdNum}>{s.banked ? money(s.banked) : '–'}</td>
                      <td style={ui.tdNum}>{s.moved ? money(s.moved) : '–'}</td>
                      <td style={{ ...ui.tdNum, fontWeight: 700 }}>{money(s.closing)}</td>
                      <td style={ui.td}>
                        {s.floatCounted === undefined ? (
                          <span style={ui.muted}>{s.day === 0 ? 'Tomorrow' : 'Not counted'}</span>
                        ) : (
                          <VarianceText variance={round2(s.floatCounted - s.floatExpected)} rules={rules} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {(shown === 'variances' || shown === 'safe') && (
          <>
            {shown === 'variances' && banked && <VarianceTrend closes={trendCloses} rules={rules} now={now} />}
            {shown === 'variances' && (
              <label className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={flaggedOnly} onChange={e => setFlaggedOnly(e.target.checked)} />
                Over {money(rules.flagAt)} only
              </label>
            )}
            {(shown === 'variances' ? variances : safeRows).length === 0 ? (
              <p style={ui.muted}>{shown === 'variances' ? 'No variances in this period.' : 'No safe counts in this period.'}</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={ui.table}>
                  <thead>
                    <tr>
                      <th style={ui.th}>Day</th>
                      <th style={ui.th}>Count</th>
                      <th style={ui.thNum}>Expected</th>
                      <th style={ui.thNum}>Counted</th>
                      <th style={ui.th}>Variance</th>
                      <th style={ui.th}>Counted and checked by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(shown === 'variances' ? variances : safeRows).map(r => (
                      <tr key={r.key}>
                        <td style={ui.td}>{dayLabel(r.day, now)} {r.time}</td>
                        <td style={ui.td}>{r.what}</td>
                        <td style={ui.tdNum}>{money(r.expected)}</td>
                        <td style={ui.tdNum}>{money(r.counted)}</td>
                        <td style={ui.td}><VarianceText variance={round2(r.counted - r.expected)} rules={rules} /></td>
                        <td style={ui.td}>{r.by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
