'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as ui from '@/components/Pret/supportCentreUi';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import CloseSummary from '@/components/Pret/cash/CloseSummary';
import { NoShop, Notice, PersonSelect, VarianceText } from '@/components/Pret/cash/CashUi';
import {
  TENDER_LABEL, cardSalesForDay, cashSalesUpTo, eventsTotal, hm, hmLabel, money, noBagNumber, round2, summariseEvents,
  tillEvents, tillPaidOuts, wasteForDay, type DayClose, type DeclaredLine, type Tender,
} from '@/components/Pret/cashFixtures';
import {
  cashTasksFor, closeToday, corrected, countPlace, countedOf, expectedForCount, missingForClose, newId, tillDataTo,
  tillsOf, todaysCounts, toleranceOf,
} from '@/components/Pret/cashStore';
import { DECLARE_LABEL, openTabsFor, otherTendersFor, tabsTotal, useDunkinCash, useOperatorCash } from '@/components/Pret/cashOperators';

type Line = { bagNo: string; value: string };

export default function CashClosePage() {
  const cash = useCashShop();
  const router = useRouter();
  const { shop, rules, me } = cash;
  const [lines, setLines] = useState<Line[]>([{ bagNo: '', value: '' }]);
  const [charity, setCharity] = useState({ value: '', slipNo: '', bagNo: '' });
  const [byChoice, setBy] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [missingReason, setMissingReason] = useState('');
  const [typedTenders, setTypedTenders] = useState({ gift: '', bacs: '' });
  const [tried, setTried] = useState(false);
  const operators = useOperatorCash();
  const dunkin = useDunkinCash();

  if (!shop) return <NoShop />;
  if (dunkin) {
    return (
      <div style={ui.page}>
        <div style={ui.card}>
          <h1 style={ui.h1}>Closing is part of End of day</h1>
          <Link href="/cash/end-of-day" style={{ color: 'var(--color-accent-active)', fontWeight: 700 }}>Go to End of day</Link>
        </div>
      </div>
    );
  }
  const now = new Date();
  const team = shop.team;
  const by = team.includes(byChoice) ? byChoice : team.includes(me.name) ? me.name : team[0];

  const done = closeToday(shop.siteId, cash.closes, now);
  if (done) {
    return (
      <div style={ui.page}>
        <div>
          <Link href="/cash/today" style={{ ...ui.muted, textDecoration: 'none' }}>← Cash today</Link>
          <h1 style={{ ...ui.h1, marginTop: 6 }}>Day closed</h1>        </div>
        <section style={ui.card}>
          <CloseSummary close={done} corrections={cash.corrections} onCorrect={c => cash.setCorrections(prev => [...prev, c])} team={team} me={me.name} rules={rules} />
        </section>
      </div>
    );
  }

  const today = todaysCounts(cash.counts, shop.siteId, now);
  const dataTo = Math.min(hm(shop.close), Math.max(0, tillDataTo(shop, now)));
  const tasks = cashTasksFor(shop.siteId, { ...cash, rules }, now);
  const missing = missingForClose(tasks);

  // One row per cash-out, which can cover several tills; then one row per till not cashed out yet.
  const cashedOut = today.filter(x => x.kind === 'cash-out').map(c => {
    const amounts = countedOf(c);
    const exp = expectedForCount(c, cash.counts, rules, now);
    return {
      till: countPlace(c),
      floats: tillsOf(c).length,
      count: c,
      counted: corrected(c.id, 'counted', amounts.GBP ?? 0, cash.corrections),
      expected: exp?.amounts.GBP ?? 0,
      foreign: amounts,
    };
  });
  const notOut = shop.tills.filter(t => !cashedOut.some(r => tillsOf(r.count).includes(t)));
  const skims = today.filter(c => c.kind === 'skim').reduce((s, c) => s + corrected(c.id, 'counted', countedOf(c).GBP ?? 0, cash.corrections), 0);
  const variance = round2(cashedOut.reduce((s, t) => s + t.counted - t.expected, 0));
  const tol = toleranceOf(variance, rules);
  const bankTotal = round2(cashedOut.reduce((s, t) => s + Math.max(0, t.counted - rules.tillFloat * t.floats), 0) + skims);
  const bankExpected = round2(cashedOut.reduce((s, t) => s + Math.max(0, t.expected - rules.tillFloat * t.floats), 0) + skims);
  const foreign: Partial<Record<Tender, number>> = {};
  for (const t of rules.tenders.filter(x => x !== 'GBP')) {
    foreign[t] = round2(cashedOut.reduce((s, r) => s + (r.foreign[t] ?? 0), 0));
  }

  const takingsCash = round2(shop.tills.reduce((s, _, i) => s + (cashSalesUpTo(shop, i, 0, dataTo, ['GBP']).GBP ?? 0), 0));
  const takingsCard = cardSalesForDay(shop, 0, takingsCash);
  const events = tillEvents(shop, 0).filter(e => e.minute <= dataTo);
  const summary = summariseEvents(events);
  const waste = wasteForDay(shop, 0);

  const paidOut = eventsTotal(tillPaidOuts(shop, 0, { upTo: dataTo }));
  const tenders = otherTendersFor(shop, 0);
  const declarations: DeclaredLine[] = [
    { id: 'cash', label: DECLARE_LABEL.cash, expected: bankExpected, declared: bankTotal, auto: true },
    { id: 'card', label: DECLARE_LABEL.card, expected: takingsCard, declared: takingsCard, auto: true },
    ...(paidOut ? [{ id: 'paid-out', label: DECLARE_LABEL['paid-out'], expected: paidOut, declared: paidOut, auto: true }] : []),
    { id: 'gift', label: DECLARE_LABEL.gift, expected: tenders.gift, declared: round2(Number(typedTenders.gift) || 0) },
    { id: 'bacs', label: DECLARE_LABEL.bacs, expected: tenders.bacs, declared: round2(Number(typedTenders.bacs) || 0) },
  ];
  const tabsCarried = openTabsFor(shop, 0);
  const tabsBrought = tabsTotal(openTabsFor(shop, -1));

  // Every bag but the last takes what's typed; the last takes what's left.
  const lineValues = lines.map((l, i) =>
    i === lines.length - 1 ? round2(bankTotal - lines.slice(0, -1).reduce((s, x) => s + (Number(x.value) || 0), 0)) : Number(l.value) || 0,
  );

  const problems: string[] = [];
  if (!cashedOut.length) problems.push('Cash out at least one till before closing.');
  if (missing.length && rules.incompleteClose === 'block') {
    problems.push(`Finish open tasks first: ${missing.map(t => t.label).join(', ')}.`);
  }
  if (missing.length && rules.incompleteClose === 'flag' && missingReason.trim().length < 4) {
    problems.push('Add a reason for the open tasks.');
  }
  if (tol === 'reason' && varianceReason.trim().length < 4) problems.push(`Variance is over ${money(rules.reasonAt)}. Add a reason.`);
  lines.forEach((l, i) => {
    if (operators ? l.bagNo.trim() !== '' && !/^\d{3,}$/.test(l.bagNo.trim()) : !/^\d{5,}$/.test(l.bagNo.trim())) {
      problems.push(`Enter the inner bag ${i + 1} number${operators ? ', or leave it blank' : ''}.`);
    }
  });
  if (lineValues.some(v => v < 0)) problems.push('Bag values are more than the cash to bank.');
  if (charity.value && (!charity.slipNo.trim() || !charity.bagNo.trim())) problems.push('Charity needs a slip number and a bag number.');
  if (rules.dualConfirm && !checkedBy) problems.push('Choose who checked the banking.');
  if (operators && (typedTenders.gift === '' || typedTenders.bacs === '')) {
    problems.push('Enter gift cards and BACS, or 0.');
  }

  const save = () => {
    setTried(true);
    if (problems.length) return;
    const id = newId('close');
    const record: DayClose = {
      id,
      siteId: shop.siteId,
      day: 0,
      when: now.toISOString(),
      by,
      checkedBy: checkedBy || undefined,
      tills: cashedOut.map(t => ({ till: t.till, expected: t.expected, counted: t.counted, countedBy: t.count.countedBy })),
      takingsCash,
      takingsCard,
      ...summary,
      waste,
      variance,
      varianceReason: varianceReason.trim() || undefined,
      missing: missing.map(t => t.label),
      missingReason: missing.length ? missingReason.trim() : undefined,
      banking: lines.map((l, i) => ({
        bagNo: l.bagNo.trim() || noBagNumber(i ? `${id}-${i}` : id),
        value: lineValues[i],
        foreign: i === 0 && Object.keys(foreign).length ? foreign : undefined,
      })),
      charity: charity.value ? { value: round2(Number(charity.value)), slipNo: charity.slipNo.trim(), bagNo: charity.bagNo.trim() } : undefined,
      ...(operators ? { declarations, tabsCarried: tabsTotal(tabsCarried), tabsBrought } : {}),
    };
    cash.setCloses(prev => [...prev, record]);
    router.push('/cash/today?closed=1');
  };

  return (
    <div style={ui.page}>
      <div>
        <Link href="/cash/today" style={{ ...ui.muted, textDecoration: 'none' }}>← Cash today</Link>
        <h1 style={{ ...ui.h1, marginTop: 6 }}>Close the day</h1>      </div>

      {missing.length > 0 && (
        <Notice tone="warn">
          <strong>{missing.length} {missing.length === 1 ? 'task' : 'tasks'} open:</strong> {missing.map(t => t.label).join(', ')}.{' '}
          {rules.incompleteClose === 'block' ? 'Finish them before closing.' : 'Add a reason below to close.'}{' '}
          <Link href="/cash/today" style={{ color: 'inherit', fontWeight: 700 }}>View tasks</Link>
        </Notice>
      )}
      {dataTo < hm(shop.close) && (
        <Notice tone="warn">Till data runs to {hmLabel(dataTo)}. Takings update when the rest arrives.</Notice>
      )}

      <section style={ui.card} aria-labelledby="tills-h">
        <h2 id="tills-h" style={ui.h2}>Tills</h2>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Till</th>
              <th style={ui.thNum}>Expected</th>
              <th style={ui.thNum}>Counted</th>
              <th style={ui.th}>Variance</th>
              <th style={ui.th}>Counted by</th>
            </tr>
          </thead>
          <tbody>
            {cashedOut.map(t => (
              <tr key={t.count.id}>
                <td style={ui.td}>{t.till}</td>
                <td style={ui.tdNum}>{money(t.expected)}</td>
                <td style={ui.tdNum}>{money(t.counted)}</td>
                <td style={ui.td}><VarianceText variance={round2(t.counted - t.expected)} rules={rules} /></td>
                <td style={ui.td}>{t.count.countedBy}{t.count.checkedBy ? `, checked by ${t.count.checkedBy}` : ''}</td>
              </tr>
            ))}
            {notOut.map(till => (
              <tr key={till}>
                <td style={ui.td}>{till}</td>
                <td style={ui.td} colSpan={4}>
                  <span style={ui.pill('warn')}>Not cashed out</span>{' '}
                  <Link href={`/cash/count?kind=cash-out&till=${encodeURIComponent(till)}`} style={{ color: 'var(--color-accent-active)', fontWeight: 700 }}>
                    Cash out {till}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cashedOut.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={ui.fieldLabel}>Day variance</span>
            <VarianceText variance={variance} rules={rules} />
          </div>
        )}
        {tol !== 'ok' && (
          <label style={ui.field}>
            <span style={ui.fieldLabel}>{tol === 'reason' ? 'Reason (required)' : 'Reason (optional)'}</span>
            <textarea style={{ ...ui.input, minHeight: 56 }} value={varianceReason} onChange={e => setVarianceReason(e.target.value)} />
          </label>
        )}
      </section>

      <section style={ui.card} aria-labelledby="takings-h">
        <h2 id="takings-h" style={ui.h2}>Takings</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <Figure label="Cash takings" value={money(takingsCash)} />
          <Figure label="Card takings" value={money(takingsCard)} />
          <Figure label={operators ? 'Promotions and giveaways' : 'Joy of Pret'} value={`${summary.joyItems} items, ${money(summary.joyValue)}`} />
          <Figure label="Waste" value={money(waste)} />
          <Figure label="Voids" value={money(summary.voids)} />
          <Figure label="Discounts" value={money(summary.discounts)} />
        </div>
      </section>

      {operators && (
        <section style={ui.card} aria-labelledby="declare-h">
          <h2 id="declare-h" style={ui.h2}>Declarations</h2>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Payment type</th>
                <th style={ui.thNum}>Expected</th>
                <th style={ui.thNum}>Declared</th>
                <th style={ui.th}>Difference</th>
              </tr>
            </thead>
            <tbody>
              {declarations.map(d => {
                const typed = d.id === 'gift' || d.id === 'bacs' ? typedTenders[d.id] : undefined;
                return (
                  <tr key={d.id}>
                    <td style={ui.td}>
                      {d.label}
                      {d.auto && <div style={ui.muted}>Automatic</div>}
                    </td>
                    <td style={ui.tdNum}>{money(d.expected)}</td>
                    <td style={ui.tdNum}>
                      {typed === undefined ? (
                        money(d.declared)
                      ) : (
                        <input
                          aria-label={`Declared ${d.label.toLowerCase()}`}
                          inputMode="decimal"
                          placeholder="0.00"
                          value={typed}
                          onChange={e => setTypedTenders(prev => ({ ...prev, [d.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                          style={{ ...ui.input, width: 110, textAlign: 'right' }}
                        />
                      )}
                    </td>
                    <td style={ui.td}>
                      {typed === '' ? <span style={ui.muted}>–</span> : <VarianceText variance={round2(d.declared - d.expected)} rules={rules} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3 style={{ ...ui.h2, fontSize: 14, marginTop: 6 }}>Open tabs</h3>
          <p style={ui.muted}>
            Brought forward: {money(tabsBrought)}. Carried forward: {money(tabsTotal(tabsCarried))}
            {tabsCarried.length ? ` (${tabsCarried.length} open)` : ''}.
          </p>
          {tabsCarried.length > 0 && (
            <ul className="row-list" style={ui.rowList}>
              {tabsCarried.map(t => (
                <li key={`${t.ref}-${t.opened}`} style={ui.listRow}>
                  <span>{t.ref}, opened {t.opened}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(t.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section style={ui.card} aria-labelledby="bank-h">
        <h2 id="bank-h" style={ui.h2}>Banking</h2>
        <p style={ui.muted}>
          To bank: {money(bankTotal)}, made up of {money(round2(bankTotal - skims))} from cash-outs and {money(round2(skims))} from skims.
          {paidOut ? <> Paid out from tills: {money(paidOut)}. <Link href="/cash/paid-outs" style={{ color: 'var(--color-accent-active)', fontWeight: 700 }}>Explain paid outs</Link></> : ''}
        </p>
        {Object.keys(foreign).length > 0 && (
          <p style={ui.muted}>
            Also in bag 1: {(Object.keys(foreign) as Tender[]).map(t => `${TENDER_LABEL[t]} ${money(foreign[t] ?? 0, t)}`).join(', ')}.
          </p>
        )}
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ ...ui.field, flex: '1 1 200px' }}>
              <span style={ui.fieldLabel}>Inner bag {i + 1} number{operators ? ' (optional)' : ''}</span>
              <input style={ui.input} inputMode="numeric" value={l.bagNo} placeholder="From the bag seal"
                onChange={e => setLines(prev => prev.map((x, j) => (j === i ? { ...x, bagNo: e.target.value.replace(/[^\d]/g, '') } : x)))} />
            </label>
            <label style={{ ...ui.field, flex: '1 1 160px' }}>
              <span style={ui.fieldLabel}>Value</span>
              {i === lines.length - 1 ? (
                <span style={{ ...ui.input, display: 'flex', alignItems: 'center', background: 'var(--color-bg-surface)' }} aria-live="polite">
                  {money(lineValues[i])}{lines.length > 1 ? ' (remainder)' : ''}
                </span>
              ) : (
                <input style={ui.input} inputMode="decimal" value={l.value}
                  onChange={e => setLines(prev => prev.map((x, j) => (j === i ? { ...x, value: e.target.value.replace(/[^\d.]/g, '') } : x)))} />
              )}
            </label>
            {lines.length > 1 && (
              <button type="button" style={ui.ghostBtn} onClick={() => setLines(prev => prev.filter((_, j) => j !== i))}>Remove bag {i + 1}</button>
            )}
          </div>
        ))}
        {lines.length < 2 && (
          <button type="button" style={{ ...ui.ghostBtn, alignSelf: 'flex-start' }} onClick={() => setLines(prev => [{ ...prev[0], value: String(round2(bankTotal / 2)) }, { bagNo: '', value: '' }])}>
            Add a second bag
          </button>
        )}

        <h3 style={{ ...ui.h2, fontSize: 14, marginTop: 6 }}>Charity</h3>
        <p style={ui.muted}>Separate bag and paying-in slip. Leave blank if none.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['value', 'slipNo', 'bagNo'] as const).map(f => (
            <label key={f} style={{ ...ui.field, flex: '1 1 160px' }}>
              <span style={ui.fieldLabel}>{f === 'value' ? 'Charity value' : f === 'slipNo' ? 'Paying-in slip number' : 'Charity bag number'}</span>
              <input style={ui.input} inputMode={f === 'value' ? 'decimal' : 'numeric'} value={charity[f]}
                onChange={e => setCharity(prev => ({ ...prev, [f]: e.target.value.replace(f === 'value' ? /[^\d.]/g : /[^\d]/g, '') }))} />
            </label>
          ))}
        </div>
      </section>

      <section style={ui.card} aria-labelledby="sign-h">
        <h2 id="sign-h" style={ui.h2}>Sign off</h2>
        {missing.length > 0 && rules.incompleteClose === 'flag' && (
          <label style={ui.field}>
            <span style={ui.fieldLabel}>Reason for open tasks (required)</span>
            <textarea style={{ ...ui.input, minHeight: 56 }} value={missingReason} onChange={e => setMissingReason(e.target.value)} />
          </label>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}><PersonSelect id="close-by" label="Closed by" value={by} onChange={setBy} people={team} /></div>
          <div style={{ flex: '1 1 200px' }}>
            <PersonSelect id="close-checked" label={rules.dualConfirm ? 'Checked by (required)' : 'Checked by (optional)'} value={checkedBy} onChange={setCheckedBy} people={team.filter(p => p !== by)} allowNone />
          </div>
        </div>
        {tried && problems.length > 0 && (
          <div role="alert" style={{ color: 'var(--color-error)', fontSize: 13, lineHeight: 1.5 }}>
            {problems.map(p => <div key={p}>{p}</div>)}
          </div>
        )}
        <button type="button" style={{ ...ui.primaryBtn, alignSelf: 'flex-start' }} onClick={save}>Close day</button>
      </section>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', border: '1px solid var(--color-border-subtle)', borderRadius: 8 }}>
      <span style={ui.fieldLabel}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
