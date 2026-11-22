'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import * as ui from '@/components/Pret/supportCentreUi';
import StyledSelect from '@/components/ui/StyledSelect';
import { downloadCsv } from './CashUi';
import DayRangePicker, { control, rangeLabel, type DayRange } from './DayRangePicker';
import OracleDayPanel from './OracleDayPanel';
import { CASH_SHOPS, HISTORY_DAYS, dayDate, dayLabel, dayPhrase, money, round2, signedMoney, type Collection } from '../cashFixtures';
import { dayOf, rulesFor, useCashCloses, useCashCollections, useCashCorrections, useRuleChanges, type CashAlert } from '../cashStore';
import { DEPOSIT_RULES, depositAlerts, depositStatus, useBankLandings } from '../cashOperators';
import { paidOutAlerts, usePaidOutNotes } from '../paidOuts';
import { useShopBanking } from '../cashSetup';
import { useShopName } from '../shopNames';
import {
  BANK_STATE_LABEL, BANK_STATE_PILL, DUNKIN_DMS, SHORT_OVER_LOOK, adjustmentRate, depositLate, dunkinLedger, dunkinStore, needsLook, paidOutsLate, sumTally,
  type BankState, type LedgerRow,
} from '../dunkinReport';

const LAST_7: DayRange = { lo: -6, hi: 0 };
const PRESETS = [
  { label: 'Yesterday', range: { lo: -1, hi: -1 } },
  { label: 'Last 7 days', range: LAST_7 },
  { label: 'Last 2 weeks', range: { lo: -(HISTORY_DAYS - 1), hi: 0 } },
];
const ADJUSTMENT_RULE = 'Error corrects or cancels well above the district average';
const HIGH = 1.5;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const pct = (part: number, whole: number) => `${whole ? Math.round((part / whole) * 100) : 100}%`;
const sum = (rows: LedgerRow[], f: (r: LedgerRow) => number) => round2(rows.reduce((s, r) => s + f(r), 0));
const rowKey = (r: { siteId: string; day: number }) => `${r.siteId}|${r.day}`;
function totals(rows: LedgerRow[]) {
  return {
    cashDue: sum(rows, r => r.cashDue),
    deposited: sum(rows, r => r.deposited),
    shortOver: sum(rows, r => r.shortOver),
    offDays: rows.filter(r => Math.abs(r.shortOver) > SHORT_OVER_LOOK).length,
    paidOut: sum(rows, r => r.paidOutValue),
    explained: sum(rows, r => r.explainedValue),
    errorCorrects: sumTally(rows, 'errorCorrects'),
    cancels: sumTally(rows, 'cancels'),
  };
}

/** The deposits behind a set of days, once each, with where they stand at the bank. */
function depositsOf(rows: LedgerRow[]) {
  const seen = new Map<string, { deposit: Collection; bank: BankState; bankDiff: number; value: number }>();
  for (const r of rows) {
    if (!r.deposit) continue;
    const d = seen.get(r.deposit.id);
    if (d) d.value = round2(d.value + r.deposited);
    else seen.set(r.deposit.id, { deposit: r.deposit, bank: r.bank, bankDiff: r.bankDiff, value: r.deposited });
  }
  return [...seen.values()];
}

function ShortOver({ v }: { v: number }) {
  if (v === 0) return <span style={ui.muted}>Matches</span>;
  return Math.abs(v) > SHORT_OVER_LOOK ? <span style={ui.pill('warn')}>{signedMoney(v)}</span> : <span>{signedMoney(v)}</span>;
}

/** Explained against not explained, in dollars. The bar is a picture of the percentage beside it. */
function ShareBar({ part, total }: { part: number; total: number }) {
  if (!total) return <span style={ui.muted}>None</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <span aria-hidden style={{ width: 72, height: 8, borderRadius: 999, background: 'var(--color-warning-border)', overflow: 'hidden', display: 'block' }}>
        <span style={{ display: 'block', height: '100%', width: `${(part / total) * 100}%`, background: 'var(--color-text-primary)' }} />
      </span>
      <strong style={{ minWidth: 38, textAlign: 'right' }}>{pct(part, total)}</strong>
    </span>
  );
}

function Step({ label, value, sub, last }: { label: string; value: string; sub: ReactNode; last?: boolean }) {
  return (
    <li style={{ display: 'flex', alignItems: 'stretch', gap: 10, flex: '1 1 200px', minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 16px', borderRadius: 10, background: 'var(--color-bg-hover)' }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-text-secondary)' }}>{sub}</span>
      </div>
      {!last && <ArrowRight size={18} aria-hidden style={{ alignSelf: 'center', flexShrink: 0, color: 'var(--color-text-secondary)' }} />}
    </li>
  );
}

function Headline({ cells }: { cells: { label: string; value: ReactNode; note?: ReactNode }[] }) {
  return (
    <dl style={{
      ...ui.card, padding: 0, margin: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 1, background: 'var(--color-border-subtle)',
    }}>
      {cells.map(c => (
        <div key={c.label} style={{ background: '#ffffff', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <dt style={{ ...ui.muted, fontSize: 13 }}>{c.label}</dt>
          <dd style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{c.value}</dd>
          {c.note && <dd style={{ ...ui.muted, margin: 0, fontSize: 12, lineHeight: 1.4 }}>{c.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

function SectionHead({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <h2 id={id} style={{ ...ui.h2, fontSize: 17 }}>{title}</h2>
      {children}
    </div>
  );
}

const scroller = (label: string) => ({ style: { overflowX: 'auto' as const }, tabIndex: 0, role: 'region', 'aria-label': `${label}, scrolls sideways` });

/** Kyle's head office view: Oracle, every close and the bank statements, matched for every shop and day. */
export default function DunkinOverview() {
  const [closes] = useCashCloses();
  const [collections] = useCashCollections();
  const [corrections] = useCashCorrections();
  const [ruleChanges] = useRuleChanges();
  const [notes] = usePaidOutNotes();
  const [landings] = useBankLandings();
  const { bankingFor } = useShopBanking();
  const nameOf = useShopName();
  const [range, setRange] = useState<DayRange>(LAST_7);
  const [dm, setDm] = useState('all');
  const [shopFilter, setShopFilter] = useState<string | null>(null);
  const [lookOnly, setLookOnly] = useState(true);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const now = new Date();

  const all = CASH_SHOPS.map(s => {
    const shop = { ...s, name: nameOf(s.siteId, s.name) };
    const org = dunkinStore(shop.siteId);
    const data = { closes, collections, corrections, rules: rulesFor(shop.siteId, ruleChanges, now) };
    const ledger = dunkinLedger(shop, data, notes, landings, range.lo, now).filter(r => r.day <= range.hi);
    const deposit = depositStatus(shop, data, now);
    const alerts: CashAlert[] = [
      ...depositAlerts(shop, collections, landings, now, x => nameOf(x.siteId, x.name)),
      ...(deposit.late ? [{
        id: `missed-${shop.siteId}`, siteId: shop.siteId, rule: DEPOSIT_RULES.missed, day: 0, severity: 'bad' as const,
        detail: `Last deposit ${deposit.last ? dayPhrase(-(deposit.sinceLast ?? 0), now) : 'never'}. ${money(deposit.waitingValue)} waiting. ${shop.team[0]} was reminded at 09:00.`,
      }] : []),
      ...paidOutAlerts(shop, notes, now),
    ];
    return { shop, org, ledger, deposit, alerts, bank: bankingFor(shop.siteId).bank.split(',')[0] || 'Bank not set' };
  });

  const everyRow = all.flatMap(r => r.ledger);
  const avg = { errorCorrects: adjustmentRate(everyRow, 'errorCorrects'), cancels: adjustmentRate(everyRow, 'cancels') };
  const shops = all.map(r => {
    const t = totals(r.ledger);
    const ec = adjustmentRate(r.ledger, 'errorCorrects') / (avg.errorCorrects || 1);
    const ca = adjustmentRate(r.ledger, 'cancels') / (avg.cancels || 1);
    const adjustments = [
      ec >= HIGH && `Error corrects ${ec.toFixed(1)} times the district rate`,
      ca >= HIGH && `Cancels ${ca.toFixed(1)} times the district rate`,
    ].filter(Boolean) as string[];
    const alerts: CashAlert[] = [
      ...r.alerts,
      ...(adjustments.length ? [{
        id: `adj-${r.shop.siteId}`, siteId: r.shop.siteId, rule: ADJUSTMENT_RULE, day: -1, severity: 'warn' as const,
        detail: `${adjustments.join('. ')}, ${rangeLabel(range, now)}. ${t.errorCorrects.count} error corrects for ${money(t.errorCorrects.value)}, ${t.cancels.count} cancels for ${money(t.cancels.value)}.`,
      }] : []),
    ];
    const flags = [
      r.deposit.late && `No deposit for ${r.deposit.sinceLast} days`,
      r.ledger.some(x => x.bank === 'missing') && 'Deposit missing at bank',
      r.ledger.some(x => x.bank === 'bank-short') && 'Deposit short at bank',
      alerts.some(a => a.rule === DEPOSIT_RULES.sameSlip) && 'Same slip as another shop',
      t.offDays > 0 && `${plural(t.offDays, 'day', 'days')} off by more than ${money(SHORT_OVER_LOOK)}`,
      r.ledger.some(paidOutsLate) && `${money(sum(r.ledger.filter(paidOutsLate), x => x.paidOutValue - x.explainedValue))} of paid outs not explained after 2 days`,
      ...adjustments,
    ].filter(Boolean) as string[];
    return { ...r, t, alerts, adjustments, flags };
  });

  const visible = shops.filter(r => dm === 'all' || r.org.dm === dm);
  const rows = visible.flatMap(r => r.ledger);
  const t = totals(rows);
  const deposits = depositsOf(rows);
  const taken = sum(rows.filter(r => r.bank !== 'in-safe'), r => r.deposited);
  const onWay = sum(rows.filter(r => r.bank === 'waiting'), r => r.deposited);
  const missing = sum(rows.filter(r => r.bank === 'missing'), r => r.deposited);
  const shortAtBank = round2(-deposits.reduce((s, d) => s + Math.min(0, d.bankDiff), 0));
  const onStatement = round2(sum(rows.filter(r => r.bank === 'in-bank' || r.bank === 'bank-short'), r => r.deposited) - shortAtBank);
  const bankGap = [missing && `${money(missing)} missing`, shortAtBank && `${money(shortAtBank)} short`, onWay && `${money(onWay)} on its way`].filter(Boolean);

  const ledgerRows = rows
    .filter(r => (!shopFilter || r.siteId === shopFilter) && (!lookOnly || needsLook(r)))
    .sort((a, b) => b.day - a.day || a.siteId.localeCompare(b.siteId));
  const allAlerts = visible.flatMap(r => r.alerts.map(a => ({ ...a, shop: r.shop })))
    .sort((a, b) => Number(b.severity === 'bad') - Number(a.severity === 'bad') || b.day - a.day);
  const banks = [...new Set(visible.map(r => r.bank))].map(bank => {
    const mine = visible.filter(r => r.bank === bank);
    const ds = depositsOf(mine.flatMap(r => r.ledger));
    const by = (s: BankState[]) => ds.filter(d => s.includes(d.bank));
    return { bank, shops: mine, ds, matched: by(['in-bank']), short: by(['bank-short']), missing: by(['missing']), waiting: by(['waiting']) };
  });
  const nameById = (siteId: string) => shops.find(s => s.shop.siteId === siteId)!.shop.name;

  const showDay = (siteId: string, day: number) => {
    setShopFilter(siteId);
    setLookOnly(false);
    setOpenRow(rowKey({ siteId, day }));
    requestAnimationFrame(() => document.getElementById('ledger-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const exportCsv = () => downloadCsv(`cash-deposit-report-${[range.lo, range.hi].map(d => dayDate(d, now).toLocaleDateString('en-CA')).join('-to-')}.csv`, [
    ['In bank?', 'Amount matches?', 'PC#', 'Location', 'Date', 'District manager', 'Oracle cash due', 'Deposit', 'Total cash short over',
      'Actual bank deposit', 'Oracle paid out', 'Paid out explained in Edify', 'Error corrects', 'Cancels', 'Notes'],
    ...[...rows].sort((a, b) => a.siteId.localeCompare(b.siteId) || b.day - a.day).map(r => {
      const org = dunkinStore(r.siteId);
      const inBank = r.bank === 'in-bank' || r.bank === 'bank-short';
      return [
        inBank ? 'Complete' : BANK_STATE_LABEL[r.bank],
        r.bank === 'in-bank' ? 'Correct' : r.bank === 'bank-short' ? `Deposit short ${money(-r.bankDiff)}` : '',
        org.pc, `${org.pc} ${org.entity}`, dayDate(r.day, now).toLocaleDateString('en-US'), org.dm,
        r.cashDue.toFixed(2), r.deposited.toFixed(2), r.shortOver.toFixed(2), inBank ? r.deposited.toFixed(2) : '',
        r.paidOutValue.toFixed(2), !r.paidOutValue ? '' : r.explainedValue === r.paidOutValue ? 'Yes' : r.explainedValue === 0 ? 'No' : 'Partly',
        r.oracle.errorCorrects.value.toFixed(2), r.oracle.cancels.value.toFixed(2), r.note ?? '',
      ];
    }),
  ]);

  return (
    <div style={ui.page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={ui.h1}>All shops</h1>
        <div role="group" aria-label="Filter and export" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <DayRangePicker value={range} onChange={setRange} min={-(HISTORY_DAYS - 1)} now={now} presets={PRESETS} />
          <StyledSelect aria-label="District manager" width={200} height={44} value={dm} onChange={e => { setDm(e.target.value); setShopFilter(null); }}>
            <option value="all">All district managers</option>
            {DUNKIN_DMS.map(d => <option key={d} value={d}>{d}</option>)}
          </StyledSelect>
          <button type="button" style={{ ...control, minHeight: 44 }} onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <section aria-labelledby="addsup-h" style={{ ...ui.card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHead id="addsup-h" title="Does it add up?" />
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Step label="Cash due, from Oracle" value={money(t.cashDue)} sub="Cash sales less paid outs, plus paid ins" />
          <Step label="Counted at close" value={money(t.deposited)} sub={t.shortOver === 0 ? 'Matches Oracle' : `${signedMoney(t.shortOver)} against Oracle`} />
          <Step label="Taken to the bank" value={money(taken)} sub={t.deposited - taken > 0 ? `${money(round2(t.deposited - taken))} still in safes` : 'Nothing left in safes'} />
          <Step last label="On bank statements" value={money(onStatement)} sub={bankGap.length ? bankGap.join(', ') : 'All matched'} />
        </ol>
      </section>

      <Headline cells={[
        { label: 'Short or over, after paid outs', value: t.shortOver === 0 ? money(0) : signedMoney(t.shortOver), note: `${plural(t.offDays, 'day', 'days')} off by more than ${money(SHORT_OVER_LOOK)}` },
        {
          label: 'Paid outs explained', value: pct(t.explained, t.paidOut),
          note: `${money(t.explained)} of ${money(t.paidOut)}. Unexplained paid outs no longer show as cash short.`,
        },
        {
          label: 'Deposits late or missing',
          value: String(visible.filter(r => r.deposit.late).length + deposits.filter(d => d.bank === 'missing').length),
          note: `${plural(visible.filter(r => r.deposit.late).length, 'shop', 'shops')} late, ${plural(deposits.filter(d => d.bank === 'missing').length, 'deposit', 'deposits')} not at the bank`,
        },
        {
          label: 'Error corrects and cancels', value: money(round2(t.errorCorrects.value + t.cancels.value)),
          note: `${t.errorCorrects.count} error corrects, ${t.cancels.count} cancels`,
        },
      ]} />

      <section aria-labelledby="dm-h" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHead id="dm-h" title="District managers" />
        <div style={ui.card}>
          <div {...scroller('District managers table')}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>District manager</th>
                  <th style={ui.thNum}>Cash due</th>
                  <th style={ui.thNum}>Short or over</th>
                  <th style={ui.thNum}>Paid outs explained</th>
                  <th style={ui.th}>Deposits</th>
                  <th style={ui.thNum}>Error corrects and cancels</th>
                  <th style={ui.th}><span className="sr-only">Filter</span></th>
                </tr>
              </thead>
              <tbody>
                {DUNKIN_DMS.map(name => {
                  const mine = shops.filter(s => s.org.dm === name);
                  const mt = totals(mine.flatMap(s => s.ledger));
                  const late = mine.filter(s => s.deposit.late).length;
                  const miss = depositsOf(mine.flatMap(s => s.ledger)).filter(d => d.bank === 'missing').length;
                  return (
                    <tr key={name} style={dm === name ? { background: 'var(--color-bg-hover)' } : undefined}>
                      <td style={ui.td}>
                        <strong>{name}</strong>
                        <div style={ui.muted}>{mine[0]?.org.market}, {plural(mine.length, 'shop', 'shops')}</div>
                      </td>
                      <td style={ui.tdNum}>{money(mt.cashDue)}</td>
                      <td style={ui.tdNum}><ShortOver v={mt.shortOver} /></td>
                      <td style={ui.tdNum}>
                        <ShareBar part={mt.explained} total={mt.paidOut} />
                        {mt.paidOut > mt.explained && <div style={ui.muted}>{money(round2(mt.paidOut - mt.explained))} not explained</div>}
                      </td>
                      <td style={ui.td}>
                        {late || miss ? [late && `${plural(late, 'shop', 'shops')} late`, miss && `${miss} missing at bank`].filter(Boolean).join(', ') : <span style={ui.muted}>All on time</span>}
                      </td>
                      <td style={ui.tdNum}>
                        {money(round2(mt.errorCorrects.value + mt.cancels.value))}
                        {mine.some(s => s.adjustments.length) && <div><span style={ui.pill('warn')}>Above average</span></div>}
                      </td>
                      <td style={{ ...ui.td, textAlign: 'right' }}>
                        <button type="button" style={{ ...control, minHeight: 44 }} aria-pressed={dm === name} onClick={() => { setDm(dm === name ? 'all' : name); setShopFilter(null); }}>
                          {dm === name ? 'Show everyone' : 'Only these shops'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ ...ui.muted, marginTop: 10 }}>On the bar, dark is explained and yellow is not yet explained.</p>
        </div>
      </section>

      <section aria-labelledby="shops-h" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHead id="shops-h" title="Shops" />
        <div style={ui.card}>
          <div {...scroller('Shops table')}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Shop</th>
                  <th style={ui.th}>Needs attention</th>
                  <th style={ui.thNum}>Waiting to bank</th>
                  <th style={ui.th}>Last deposit</th>
                  <th style={ui.thNum}>Short or over</th>
                  <th style={ui.thNum}>Paid outs explained</th>
                  <th style={ui.thNum}>Error corrects</th>
                  <th style={ui.thNum}>Cancels</th>
                  <th style={ui.th}><span className="sr-only">Days</span></th>
                </tr>
              </thead>
              <tbody>
                {[...visible].sort((a, b) => b.flags.length - a.flags.length).map(r => (
                  <tr key={r.shop.siteId}>
                    <td style={ui.td}>
                      <strong>{r.shop.name}</strong>
                      <div style={ui.muted}>{r.org.entity} · {r.org.dm}</div>
                    </td>
                    <td style={ui.td}>
                      {r.flags.length ? (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {r.flags.map(f => (
                            <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--color-accent-amber)', flexShrink: 0, marginTop: 5 }} />
                              {f}
                            </li>
                          ))}
                        </ul>
                      ) : <span style={ui.muted}>Nothing</span>}
                    </td>
                    <td style={ui.tdNum}>
                      {r.deposit.waiting.length ? money(r.deposit.waitingValue) : <span style={ui.muted}>None</span>}
                      {r.deposit.waiting.length > 0 && <div style={ui.muted}>{plural(r.deposit.waiting.length, 'day', 'days')}</div>}
                    </td>
                    <td style={ui.td}>
                      {r.deposit.last ? dayLabel(-(r.deposit.sinceLast ?? 0), now) : <span style={ui.muted}>None</span>}
                      {r.deposit.last && <div style={ui.muted}>{money(r.deposit.last.value)}</div>}
                    </td>
                    <td style={ui.tdNum}><ShortOver v={r.t.shortOver} /></td>
                    <td style={ui.tdNum}>
                      <ShareBar part={r.t.explained} total={r.t.paidOut} />
                      <div style={ui.muted}>{money(r.t.explained)} of {money(r.t.paidOut)}</div>
                    </td>
                    <td style={ui.tdNum}>
                      {money(r.t.errorCorrects.value)}
                      <div style={ui.muted}>{r.t.errorCorrects.count}</div>
                    </td>
                    <td style={ui.tdNum}>
                      {money(r.t.cancels.value)}
                      <div style={ui.muted}>{r.t.cancels.count}</div>
                    </td>
                    <td style={{ ...ui.td, textAlign: 'right' }}>
                      <button type="button" style={{ ...control, minHeight: 44 }} onClick={() => {
                        setShopFilter(r.shop.siteId);
                        requestAnimationFrame(() => document.getElementById('ledger-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                      }}>
                        See days
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="ledger-h" style={{ display: 'flex', flexDirection: 'column', gap: 10, scrollMarginTop: 16 }}>
        <SectionHead id="ledger-h" title="Every day, every shop">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {shopFilter && (
              <button type="button" style={{ ...control, minHeight: 44 }} onClick={() => setShopFilter(null)}>
                {nameById(shopFilter)} only. Show all shops
              </button>
            )}
            <label style={{ ...control, minHeight: 44, gap: 8 }}>
              <input type="checkbox" checked={lookOnly} onChange={e => setLookOnly(e.target.checked)} style={{ width: 16, height: 16, margin: 0, accentColor: 'var(--color-accent-active)' }} />
              Flagged days only
            </label>
          </div>
        </SectionHead>
        <div style={ui.card}>
          {ledgerRows.length === 0 ? <p style={ui.muted}>Nothing to look at in this period.</p> : (
            <div {...scroller('Every day table')}>
              <table style={ui.table}>
                <thead>
                  <tr>
                    <th style={ui.th}>Day</th>
                    <th style={ui.th}>Shop</th>
                    <th style={ui.thNum}>Cash due</th>
                    <th style={ui.thNum}>Deposited</th>
                    <th style={ui.thNum}>Short or over</th>
                    <th style={ui.thNum}>Paid outs</th>
                    <th style={ui.th}>Bank</th>
                    <th style={ui.th}><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map(r => {
                    const key = rowKey(r);
                    const open = openRow === key;
                    const shop = shops.find(s => s.shop.siteId === r.siteId)!;
                    return (
                      <Fragment key={key}>
                        <tr>
                          <td style={ui.td}>{dayLabel(r.day, now)}</td>
                          <td style={ui.td}>{shop.shop.name}</td>
                          <td style={ui.tdNum}>{money(r.cashDue)}</td>
                          <td style={ui.tdNum}>{money(r.deposited)}</td>
                          <td style={ui.tdNum}><ShortOver v={r.shortOver} /></td>
                          <td style={ui.tdNum}>
                            {paidOutsLate(r)
                              ? <span style={ui.pill('warn')}>{money(round2(r.paidOutValue - r.explainedValue))} not explained</span>
                              : r.paidOutValue ? money(r.paidOutValue) : <span style={ui.muted}>None</span>}
                          </td>
                          <td style={ui.td}>
                            {depositLate(r)
                              ? <span style={ui.pill('warn')}>In the safe {plural(-r.day, 'day', 'days')}</span>
                              : BANK_STATE_PILL[r.bank] === 'warn'
                              ? <span style={ui.pill('warn')}>{BANK_STATE_LABEL[r.bank]}</span>
                              : <span style={ui.muted}>{BANK_STATE_LABEL[r.bank]}</span>}
                          </td>
                          <td style={{ ...ui.td, textAlign: 'right', padding: '2px 0' }}>
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={`${open ? 'Hide' : 'Open'} ${dayLabel(r.day, now)}, ${shop.shop.name}`}
                              onClick={() => setOpenRow(open ? null : key)}
                              style={{ width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                            >
                              <ChevronDown size={18} aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined }} />
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={8} style={{ ...ui.td, background: '#ffffff', padding: '16px 4px 20px' }}>
                              {r.note && <p style={{ fontSize: 14, margin: '0 0 12px' }}>{r.note}</p>}
                              <OracleDayPanel row={r} flags={shop.adjustments} />
                              <p style={{ ...ui.muted, fontSize: 13, marginTop: 12 }}>
                                Closed by {r.close.by}{r.close.checkedBy ? `, checked by ${r.close.checkedBy}` : ''}.
                                {r.deposit ? ` Deposited ${dayLabel(dayOf(r.deposit.when, now), now)}${r.bankDiff < 0 ? `, bank received ${money(-r.bankDiff)} less` : ''}.` : ''}
                                {r.deposit?.reference ? ` Slip ${r.deposit.reference}.` : ''}
                              </p>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="banks-h" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHead id="banks-h" title="By bank" />
        <div style={ui.card}>
          <div {...scroller('Banks table')}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Bank</th>
                  <th style={ui.thNum}>Deposits</th>
                  <th style={ui.thNum}>Matched</th>
                  <th style={ui.thNum}>Short</th>
                  <th style={ui.thNum}>Missing</th>
                  <th style={ui.thNum}>On its way</th>
                </tr>
              </thead>
              <tbody>
                {banks.map(b => {
                  const v = (ds: typeof b.ds) => money(round2(ds.reduce((s, d) => s + d.value, 0)));
                  const cell = (ds: typeof b.ds, warn?: boolean) => ds.length === 0
                    ? <span style={ui.muted}>None</span>
                    : <>{warn ? <span style={ui.pill('warn')}>{v(ds)}</span> : v(ds)}<div style={ui.muted}>{ds.length}</div></>;
                  return (
                    <tr key={b.bank}>
                      <td style={ui.td}>
                        <strong>{b.bank}</strong>
                        <div style={ui.muted}>{b.shops.map(s => s.shop.name).join(', ')}</div>
                      </td>
                      <td style={ui.tdNum}>{v(b.ds)}<div style={ui.muted}>{b.ds.length}</div></td>
                      <td style={ui.tdNum}>{cell(b.matched)}</td>
                      <td style={ui.tdNum}>{cell(b.short, true)}</td>
                      <td style={ui.tdNum}>{cell(b.missing, true)}</td>
                      <td style={ui.tdNum}>{cell(b.waiting)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="alerts-h" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHead id="alerts-h" title="Alerts" />
        {allAlerts.length === 0 ? <p style={ui.muted}>None.</p> : (
          <div style={ui.card}>
            <ul className="row-list" style={ui.rowList}>
              {allAlerts.map(a => (
                <li key={a.id} style={{ ...ui.listRow, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 360px' }}>
                    <span><strong>{a.shop.name}</strong> <span style={ui.muted}>{a.rule}</span></span>
                    <span>{a.detail}</span>
                  </div>
                  {a.severity === 'bad' && <span style={ui.pill('neutral')}>High</span>}
                  {rows.some(r => r.siteId === a.shop.siteId && r.day === a.day) && (
                    <button type="button" style={{ ...control, minHeight: 44 }} onClick={() => showDay(a.shop.siteId, a.day)}>View day</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
