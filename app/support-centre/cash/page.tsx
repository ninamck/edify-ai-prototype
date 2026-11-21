'use client';

import Link from 'next/link';
import { Suspense, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as ui from '@/components/Pret/supportCentreUi';
import StyledSelect from '@/components/ui/StyledSelect';
import { CASH_OFFICE } from '@/components/Pret/people';
import CloseSummary from '@/components/Pret/cash/CloseSummary';
import { Notice, VarianceText, downloadCsv } from '@/components/Pret/cash/CashUi';
import { control } from '@/components/Pret/cash/DayRangePicker';
import {
  CASH_SHOPS, PROFILE_LABEL, at, dayLabel, dayPhrase, hmLabel, money, round2, type CashShop, type ShopProfile,
} from '@/components/Pret/cashFixtures';
import {
  ALERT_RULES, COUNT_KIND_LABEL, REQUEST_LABEL, TASK_STATUS_LABEL, TASK_STATUS_PILL, alertsFor, allCloses, cashTasksFor, corrected,
  countPlace, countedOf, dayOf, expectedForCount, exposureFor, newId, nowMinute, rulesFor, timeOf, todaysCounts,
  toleranceOf, useCashCloses, useCashCollections, useCashCorrections, useCashCounts, useCashRequests, useRuleChanges,
  type CashRequest, type CashRequestKind,
} from '@/components/Pret/cashStore';
import { DEPOSIT_RULES, depositAlerts, depositStatus, useBankLandings, useDunkinCash, useOperatorCash } from '@/components/Pret/cashOperators';
import { paidOutAlerts, paidOutSummary, paidOutsFor, usePaidOutNotes } from '@/components/Pret/paidOuts';
import VarianceTrend from '@/components/Pret/cash/VarianceTrend';
import { useShopName } from '@/components/Pret/shopNames';
import { AccountsExport, BlindCountSetting } from '@/components/Pret/cash/OperatorSettings';

const STALE_AFTER = 20;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Headline({ cells }: { cells: { label: string; value: ReactNode; note?: string }[] }) {
  return (
    <dl style={{
      ...ui.card, padding: 0, margin: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 1, background: 'var(--color-border-subtle)',
    }}>
      {cells.map(c => (
        <div key={c.label} style={{ background: '#ffffff', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <dt style={{ ...ui.muted, fontSize: 13 }}>{c.label}</dt>
          <dd style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{c.value}</dd>
          {c.note && <dd style={{ ...ui.muted, margin: 0, fontSize: 13 }}>{c.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

export default function SupportCentreCashPage() {
  return (
    <Suspense>
      <CashOverview />
    </Suspense>
  );
}

function CashOverview() {
  const router = useRouter();
  const params = useSearchParams();
  const [counts] = useCashCounts();
  const [closes] = useCashCloses();
  const [collections] = useCashCollections();
  const [corrections] = useCashCorrections();
  const [ruleChanges] = useRuleChanges();
  const [requests, setRequests] = useCashRequests();
  const [profile, setProfile] = useState<'all' | ShopProfile>('all');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [notes] = usePaidOutNotes();
  const [landings] = useBankLandings();
  const pub = useOperatorCash();
  const dunkin = useDunkinCash();
  const operators = pub || dunkin;
  const nameOf = useShopName();
  const now = new Date();
  const selected = params.get('shop');
  const dayParam = params.get('day');
  const selectedDay = dayParam !== null && /^-?\d+$/.test(dayParam) ? Number(dayParam) : undefined;

  const shops = CASH_SHOPS.map(s => ({ ...s, name: nameOf(s.siteId, s.name) }));
  const rows = shops.map(shop => {
    const rules = rulesFor(shop.siteId, ruleChanges, now);
    const data = { counts, closes, collections, corrections, requests, rules };
    const tasks = cashTasksFor(shop.siteId, data, now);
    const exposure = exposureFor(shop.siteId, data, now);
    const deposit = depositStatus(shop, data, now);
    const alerts = [
      ...alertsFor(shop, data, now, { operators }).filter(a => !dunkin || a.rule !== ALERT_RULES.bags),
      ...(operators ? depositAlerts(shop, collections, landings, now, s => nameOf(s.siteId, s.name)) : []),
      ...(dunkin && deposit.late ? [{
        id: `missed-${shop.siteId}`, siteId: shop.siteId, rule: DEPOSIT_RULES.missed, day: 0, severity: 'bad' as const,
        detail: `Last deposit ${deposit.last ? dayPhrase(-(deposit.sinceLast ?? 0), now) : 'never'}. ${money(deposit.waitingValue)} waiting. ${shop.team[0]} was reminded at 09:00.`,
      }] : []),
      ...paidOutAlerts(shop, notes, now),
    ].sort((a, b) => b.day - a.day);
    const overdue = dunkin ? [] : tasks.filter(t => t.status === 'overdue');
    const handoversDue = tasks.filter(t => t.id.startsWith('handover-') && !t.id.includes('extra') && t.due <= nowMinute(now));
    const handoversDone = handoversDue.filter(t => t.status === 'done');
    const lag = shop.tillDataLagMin;
    const week = allCloses(shop.siteId, closes, now).filter(c => c.day >= -6);
    const material = week.filter(c => toleranceOf(c.variance, rules) === 'reason');
    const paidOuts = paidOutsFor(shop, notes, now, -6);
    const paidOutOpen = paidOutSummary(paidOuts);
    const { last: lastDeposit, sinceLast: sinceDeposit, late: depositLate } = deposit;
    const flags = [
      !dunkin && exposure.total > exposure.limit && `Safe ${money(round2(exposure.total - exposure.limit))} over limit`,
      !dunkin && exposure.oldestDay !== undefined && exposure.oldestDay <= -3 && `Bag waiting ${-exposure.oldestDay} days`,
      dunkin && depositLate && `No deposit for ${sinceDeposit} days`,
      overdue.length > 0 && plural(overdue.length, 'task', 'tasks') + ' overdue',
      !dunkin && handoversDone.length < handoversDue.length && 'Handover count missed',
      lag > STALE_AFTER && `Till data ${lag} min late`,
      material.length > 0 && `${plural(material.length, 'variance', 'variances')} over ${money(rules.reasonAt)}`,
      paidOutOpen.late.length > 0 && `${plural(paidOutOpen.late.length, 'paid out', 'paid outs')} not explained`,
    ].filter(Boolean) as string[];
    return {
      shop, rules, tasks, exposure, alerts, overdue, handoversDue, handoversDone, lag, week, material, flags,
      paidOuts, paidOutOpen, lastDeposit, sinceDeposit, depositLate, deposit,
    };
  });

  const visible = rows
    .filter(r => (profile === 'all' || r.shop.profile === profile) && (!attentionOnly || r.flags.length))
    .sort((a, b) => b.flags.length - a.flags.length);
  const totalSafe = round2(rows.reduce((s, r) => s + r.exposure.total, 0));
  const bagsWaiting = rows.reduce((s, r) => s + r.exposure.bags.length, 0);
  const allAlerts = rows.flatMap(r => r.alerts.map(a => ({ ...a, shop: r.shop })));
  const sortedAlerts = [...allAlerts].sort((a, b) => Number(b.severity === 'bad') - Number(a.severity === 'bad') || b.day - a.day);
  const drill = rows.find(r => r.shop.siteId === selected);

  const raise = (shop: CashShop, kind: CashRequestKind, note: string) => {
    const req: CashRequest = {
      id: newId('req'), siteId: shop.siteId, kind, note, by: CASH_OFFICE.name, when: now.toISOString(),
      forDay: kind === 'extra-collection' ? at(1, '09:00') : undefined,
    };
    setRequests(prev => [...prev, req]);
    setSent(`${REQUEST_LABEL[kind]} sent to ${shop.name}.`);
  };

  const exportCsv = () =>
    downloadCsv('estate-cash.csv', [
      ['Shop', 'Profile', 'Cash in safe', 'Safe limit', 'Bags waiting', 'Oldest bag (days)', 'Overdue tasks', 'Till data lag (min)', 'Large variances (7 days)', 'Needs attention'],
      ...visible.map(r => [r.shop.name, PROFILE_LABEL[r.shop.profile], r.exposure.total.toFixed(2), r.exposure.limit.toFixed(2), r.exposure.bags.length,
        r.exposure.oldestDay === undefined ? '' : -r.exposure.oldestDay, r.overdue.map(t => t.label).join('; '), r.lag, r.material.length, r.flags.join('; ')]),
    ]);

  return (
    <div style={ui.page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={ui.h1}>Cash overview</h1>
        <div role="group" aria-label="Filter and export" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <StyledSelect aria-label="Shop type" width={170} height={44} value={profile} onChange={e => setProfile(e.target.value as 'all' | ShopProfile)}>
            <option value="all">All shops</option>
            {(Object.keys(PROFILE_LABEL) as ShopProfile[]).map(p => <option key={p} value={p}>{PROFILE_LABEL[p]}</option>)}
          </StyledSelect>
          <label style={{ ...control, gap: 8 }}>
            <input type="checkbox" checked={attentionOnly} onChange={e => setAttentionOnly(e.target.checked)} style={{ width: 16, height: 16, margin: 0, accentColor: 'var(--color-accent-active)' }} />
            Needs attention only
          </label>
          <button type="button" style={control} onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      {sent && <Notice tone="good">{sent}</Notice>}

      <Headline cells={[
        ...(dunkin ? [
          {
            label: 'Waiting to be banked',
            value: money(round2(rows.reduce((s, r) => s + r.deposit.waitingValue, 0))),
            note: `${plural(rows.reduce((s, r) => s + r.deposit.waiting.length, 0), 'day', 'days')} of takings`,
          },
          { label: 'Deposit missed', value: `${rows.filter(r => r.depositLate).length} of ${rows.length}`, note: 'Nothing banked for 3 days or more' },
        ] : [
          {
            label: 'Cash in safes',
            value: money(totalSafe),
            note: rows.some(r => r.exposure.total > r.exposure.limit) ? `${plural(rows.filter(r => r.exposure.total > r.exposure.limit).length, 'shop', 'shops')} over limit` : 'All within limit',
          },
          { label: 'Bags awaiting collection', value: String(bagsWaiting), note: `Oldest ${plural(Math.max(0, ...rows.map(r => -(r.exposure.oldestDay ?? 0))), 'day', 'days')}` },
        ]),
        { label: 'Shops needing attention', value: `${rows.filter(r => r.flags.length).length} of ${rows.length}` },
        { label: 'Alerts this week', value: String(allAlerts.length), note: `${allAlerts.filter(a => a.severity === 'bad').length} high` },
      ]} />

      <section style={ui.card} aria-label="Shops">
        <div style={{ overflowX: 'auto' }}>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Shop</th>
                <th style={ui.th}>Needs attention</th>
                {dunkin ? (
                  <>
                    <th style={ui.thNum}>Waiting to bank</th>
                    <th style={ui.th}>Last deposit</th>
                  </>
                ) : (
                  <>
                    <th style={ui.thNum}>Cash in safe</th>
                    <th style={ui.thNum}>Bags waiting</th>
                  </>
                )}
                <th style={ui.thNum}>Paid outs, 7 days</th>
                <th style={ui.thNum}>Variance, 7 days</th>
                <th style={ui.th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const net = money(round2(r.week.reduce((s, c) => s + c.variance, 0)));
                return (
                  <tr key={r.shop.siteId} style={selected === r.shop.siteId ? { background: 'var(--color-bg-hover)' } : undefined}>
                    <td style={ui.td}>
                      <strong>{r.shop.name}</strong>
                      <div style={ui.muted}>{PROFILE_LABEL[r.shop.profile]}, {r.shop.tills.length} tills</div>
                    </td>
                    <td style={ui.td}>
                      {r.flags.length ? (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.flags.map(f => (
                            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--color-accent-amber)', flexShrink: 0 }} />
                              {f}
                            </li>
                          ))}
                        </ul>
                      ) : <span style={ui.muted}>Nothing</span>}
                    </td>
                    {dunkin ? (
                      <>
                        <td style={ui.tdNum}>
                          {r.deposit.waiting.length ? money(r.deposit.waitingValue) : <span style={ui.muted}>None</span>}
                          {r.deposit.waiting.length > 0 && <div style={ui.muted}>{plural(r.deposit.waiting.length, 'day', 'days')}</div>}
                        </td>
                        <td style={ui.td}>
                          {r.lastDeposit ? dayLabel(-(r.sinceDeposit ?? 0), now) : <span style={ui.muted}>None</span>}
                          {r.lastDeposit && <div style={ui.muted}>{money(r.lastDeposit.value)}</div>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={ui.tdNum}>
                          {money(r.exposure.total)}
                          <div style={ui.muted}>Limit {money(r.exposure.limit)}</div>
                        </td>
                        <td style={ui.tdNum}>
                          {r.exposure.bags.length}
                          {r.exposure.oldestDay !== undefined && <div style={ui.muted}>Oldest {plural(-r.exposure.oldestDay, 'day', 'days')}</div>}
                        </td>
                      </>
                    )}
                    <td style={ui.tdNum}>
                      {money(round2(r.paidOuts.reduce((s, p) => s + p.value, 0)))}
                      <div style={ui.muted}>{r.paidOutOpen.open.length ? `${r.paidOutOpen.open.length} to explain` : 'All explained'}</div>
                    </td>
                    <td style={ui.tdNum}>
                      Net {net}
                      <div style={ui.muted}>{plural(r.week.length, 'close', 'closes')}</div>
                    </td>
                    <td style={{ ...ui.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" style={control} aria-expanded={selected === r.shop.siteId}
                        onClick={() => router.push(selected === r.shop.siteId ? '/support-centre/cash' : `/support-centre/cash?shop=${r.shop.siteId}`)}>
                        {selected === r.shop.siteId ? 'Hide day' : 'Open day'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {drill && (
        <ShopDay row={drill} counts={counts} closes={closes} corrections={corrections} requests={requests} raise={raise} day={selectedDay} operators={operators} dunkin={dunkin} />
      )}

      <section aria-labelledby="alerts-h" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="alerts-h" style={ui.h2}>Alerts this week</h2>
        {allAlerts.length === 0 ? <p style={ui.muted}>None.</p> : (
          <div style={ui.card}>
            <ul className="row-list" style={ui.rowList}>
              {sortedAlerts.map(a => (
                <li key={a.id} style={{ ...ui.listRow, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 360px' }}>
                    <span><strong>{a.shop.name}</strong> <span style={ui.muted}>{dayPhrase(a.day, now)}</span></span>
                    <span>{a.detail}</span>
                  </div>
                  {a.severity === 'bad' && <span style={ui.pill('neutral')}>High</span>}
                  {operators && (
                    <Link href={`/support-centre/cash?shop=${a.shop.siteId}&day=${a.day}#day-h`} style={{ ...control, textDecoration: 'none' }}>
                      View day
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {operators && (
        <>
          {pub && <BlindCountSetting />}
          <AccountsExport closes={closes} rulesOf={siteId => rulesFor(siteId, ruleChanges, now)} now={now} />
        </>
      )}
    </div>
  );
}

type Row = {
  shop: CashShop;
  rules: ReturnType<typeof rulesFor>;
  tasks: ReturnType<typeof cashTasksFor>;
  exposure: ReturnType<typeof exposureFor>;
  alerts: ReturnType<typeof alertsFor>;
  deposit: ReturnType<typeof depositStatus>;
};

function ShopDay({
  row, counts, closes, corrections, requests, raise, day, operators, dunkin,
}: {
  row: Row;
  counts: ReturnType<typeof useCashCounts>[0];
  closes: ReturnType<typeof useCashCloses>[0];
  corrections: ReturnType<typeof useCashCorrections>[0];
  requests: CashRequest[];
  raise: (shop: CashShop, kind: CashRequestKind, note: string) => void;
  /** A closed day to open, from a drill-through link. */
  day?: number;
  operators: boolean;
  dunkin: boolean;
}) {
  const { shop, rules, tasks, exposure } = row;
  const router = useRouter();
  const now = new Date();
  const [note, setNote] = useState('');
  const today = todaysCounts(counts, shop.siteId, now);
  const shopCloses = allCloses(shop.siteId, closes, now);
  const lastClose = (operators && day !== undefined ? shopCloses.find(c => c.day === day) : undefined) ?? shopCloses.at(-1);
  const open = requests.filter(r => r.siteId === shop.siteId && dayOf(r.when, now) === 0);
  const extraBooked = requests.some(r => r.siteId === shop.siteId && r.kind === 'extra-collection' && r.forDay && dayOf(r.forDay, now) >= 0);

  return (
    <section style={{ ...ui.card, border: '1px solid var(--color-border)' }} aria-labelledby="day-h">
      <h2 id="day-h" style={ui.h2}>{shop.name} today</h2>

      {dunkin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ ...ui.h2, fontSize: 14 }}>Waiting to be banked</h3>
          {row.deposit.waiting.length === 0 ? <p style={ui.muted}>Nothing waiting.</p> : (
            <ul className="row-list" style={ui.rowList}>
              {row.deposit.waiting.map(b => (
                <li key={b.bagNo} style={ui.listRow}>
                  <span>End of day {dayPhrase(b.day, now)}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(b.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!dunkin && <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ ...ui.field, flex: '1 1 320px' }}>
          <span style={ui.fieldLabel}>Note for the shop</span>
          <input style={{ ...ui.input, minHeight: 44 }} value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <button type="button" style={{ ...ui.primaryBtn, minHeight: 44 }} onClick={() => { raise(shop, 'recount-safe', note.trim() || 'Please recount the safe with a second person.'); setNote(''); }}>
          Ask for a safe recount
        </button>
        <button type="button" style={control} onClick={() => { raise(shop, 'spot-check', note.trim() || 'Please spot check a till.'); setNote(''); }}>
          Ask for a spot check
        </button>
        <button type="button" style={control} disabled={extraBooked}
          onClick={() => raise(shop, 'extra-collection', `${exposure.bags.length} bags worth ${money(exposure.bagsValue)} waiting. Collector booked for tomorrow morning.`)}>
          {extraBooked ? 'Extra collection booked' : 'Book extra collection'}
        </button>
      </div>
      {open.length > 0 && (
        <p style={ui.muted}>Sent today: {open.map(r => `${REQUEST_LABEL[r.kind]} at ${timeOf(r.when)}`).join(', ')}.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ ...ui.h2, fontSize: 14 }}>Tasks</h3>
          <ul className="row-list" style={ui.rowList}>
            {tasks.map(t => (
              <li key={t.id} style={ui.listRow}>
                <span>
                  {t.label}
                  <span style={{ ...ui.muted, display: 'block' }}>{t.status === 'done' ? `${t.doneAt}, ${t.doneBy}` : `By ${hmLabel(t.due)}`}</span>
                </span>
                {t.status === 'overdue'
                  ? <span style={ui.pill(TASK_STATUS_PILL[t.status])}>{TASK_STATUS_LABEL[t.status]}</span>
                  : <span style={ui.muted}>{TASK_STATUS_LABEL[t.status]}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ ...ui.h2, fontSize: 14 }}>Counts today</h3>
          {today.length === 0 ? <p style={ui.muted}>No counts yet.</p> : (
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Time</th>
                  <th style={ui.th}>Count</th>
                  <th style={ui.thNum}>Counted</th>
                  <th style={ui.th}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {today.map(c => {
                  const gbp = corrected(c.id, 'counted', countedOf(c).GBP ?? 0, corrections);
                  const exp = expectedForCount(c, counts, rules, now);
                  return (
                    <tr key={c.id}>
                      <td style={ui.td}>{timeOf(c.when)}</td>
                      <td style={ui.td}>
                        {COUNT_KIND_LABEL[c.kind]}{countPlace(c) ? `, ${countPlace(c)}` : ''}
                        <div style={ui.muted}>{c.countedBy}{c.checkedBy ? `, ${c.checkedBy}` : ''}</div>
                      </td>
                      <td style={ui.tdNum}>{money(gbp)}</td>
                      <td style={ui.td}>
                        {exp ? <VarianceText variance={round2(gbp - (exp.amounts.GBP ?? 0))} rules={rules} provisional={exp.provisional} /> : <span style={ui.muted}>–</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <h3 style={{ ...ui.h2, fontSize: 14, marginTop: 8 }}>Bags in the safe</h3>
          {exposure.bags.length === 0 ? <p style={ui.muted}>None.</p> : (
            <ul className="row-list" style={ui.rowList}>
              {exposure.bags.map(b => (
                <li key={b.bagNo} style={ui.listRow}>
                  <span>{b.shownBagNo} {b.kind === 'charity' ? '(charity)' : ''} <span style={ui.muted}>banked {dayPhrase(b.day, now)}</span></span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(b.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      </>}

      {operators && <VarianceTrend closes={shopCloses.slice(-14)} rules={rules} now={now} />}

      {lastClose && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <h3 style={{ ...ui.h2, fontSize: 14 }}>
              {operators && day !== undefined && lastClose.day === day ? 'Close' : 'Last close'}: {dayLabel(lastClose.day, now)}
            </h3>
            {operators && (
              <label style={ui.field} htmlFor="sc-close-day">
                <span style={ui.fieldLabel}>Day</span>
                <select
                  id="sc-close-day"
                  style={ui.input}
                  value={lastClose.day}
                  onChange={e => router.push(`/support-centre/cash?shop=${shop.siteId}&day=${e.target.value}`, { scroll: false })}
                >
                  {shopCloses.slice(-14).reverse().map(c => (
                    <option key={c.id} value={c.day}>{dayLabel(c.day, now)}, cash {c.variance > 0 ? '+' : ''}{money(c.variance)}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <CloseSummary close={lastClose} corrections={corrections} team={shop.team} me={CASH_OFFICE.name} rules={rules} />
        </div>
      )}
    </section>
  );
}
