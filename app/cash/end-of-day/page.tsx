'use client';

import Link from 'next/link';
import { useState } from 'react';
import * as ui from '@/components/Pret/supportCentreUi';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import CloseSummary from '@/components/Pret/cash/CloseSummary';
import PaidOutRow from '@/components/Pret/cash/PaidOutRow';
import SlipField from '@/components/Pret/cash/SlipField';
import { NoShop, Notice, OperatorOnly, PersonSelect, VarianceText } from '@/components/Pret/cash/CashUi';
import {
  CASH_SHOPS, cardSalesForDay, cashSalesUpTo, dayLabel, hm, hmLabel, money, noBagNumber, round2, summariseEvents,
  tillEvents, wasteForDay, type Collection, type DayClose,
} from '@/components/Pret/cashFixtures';
import { allCollections, bagGbp, closeToday, dayOf, exposureFor, newId, tillDataTo, toleranceOf } from '@/components/Pret/cashStore';
import { useDunkinCash } from '@/components/Pret/cashOperators';
import { paidOutsFor, usePaidOutNotes, type PaidOutNote } from '@/components/Pret/paidOuts';
import { useShopName } from '@/components/Pret/shopNames';

/** Kyle's four WorkPulse screens in one: what's due, what's counted, and the deposit with its slip. */
export default function EndOfDayPage() {
  const cash = useCashShop();
  const dunkin = useDunkinCash();
  const [notes, setNotes] = usePaidOutNotes();
  const nameOf = useShopName();
  const [countedText, setCounted] = useState('');
  const [reason, setReason] = useState('');
  const [bankNow, setBankNow] = useState(true);
  const [bankName, setBankName] = useState('');
  const [reference, setReference] = useState('');
  const [bagNo, setBagNo] = useState('');
  const [slip, setSlip] = useState('');
  const [byChoice, setBy] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [tried, setTried] = useState(false);
  const { shop, rules, me } = cash;

  if (!dunkin) return <OperatorOnly setUp="Dunkin (Kyle)" />;
  if (!shop) return <NoShop />;
  const now = new Date();
  const team = shop.team;
  const by = team.includes(byChoice) ? byChoice : team.includes(me.name) ? me.name : team[0];
  const savePaidOut = (id: string, note: PaidOutNote) => setNotes(prev => ({ ...prev, [id]: note }));
  const todaysPaidOuts = paidOutsFor(shop, notes, now, 0);
  const paidOutList = (
    <section style={ui.card} aria-labelledby="po-h">
      <h2 id="po-h" style={ui.h2}>Today&apos;s paid outs</h2>
      {todaysPaidOuts.length === 0 ? (
        <p style={ui.muted}>None from the tills today.</p>
      ) : (
        <>
          <p style={ui.muted}>Already taken off cash due.</p>
          <ul className="row-list" style={ui.rowList}>
            {todaysPaidOuts.map(p => (
              <PaidOutRow key={`${p.id}-${p.explained?.when ?? 'open'}`} p={p} me={me.name} onSave={savePaidOut} />
            ))}
          </ul>
        </>
      )}
    </section>
  );

  const done = closeToday(shop.siteId, cash.closes, now);
  if (done) {
    const deposit = allCollections(shop.siteId, cash.collections).find(c => c.bagNos.includes(done.banking[0]?.bagNo));
    return (
      <div style={ui.page}>
        <div>
          <h1 style={ui.h1}>End of day</h1>
        </div>
        {deposit ? (
          <Notice tone="good">
            Done. {money(deposit.value)} deposited at {deposit.bankName} by {deposit.handedOverBy}, ref {deposit.reference}.
          </Notice>
        ) : (
          <Notice tone="warn">
            Done. {money(done.banking[0]?.value ?? 0)} is in the safe.{' '}
            <Link href="/cash/collection" style={{ color: 'inherit', fontWeight: 700 }}>Record the bank deposit</Link> when it goes.
          </Notice>
        )}
        {deposit?.slip && (
          <section style={ui.card} aria-labelledby="slip-h">
            <h2 id="slip-h" style={ui.h2}>Paying-in slip</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={deposit.slip} alt={`Paying-in slip, ${deposit.reference}`} style={{ width: 280, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }} />
          </section>
        )}
        <section style={ui.card}>
          <CloseSummary close={done} corrections={cash.corrections} onCorrect={c => cash.setCorrections(prev => [...prev, c])} team={team} me={me.name} rules={rules} />
        </section>
        {paidOutList}
      </div>
    );
  }

  const dataTo = Math.min(hm(shop.close), Math.max(0, tillDataTo(shop, now)));
  const sales = round2(shop.tills.reduce((s, _, i) => s + (cashSalesUpTo(shop, i, 0, dataTo, ['GBP']).GBP ?? 0), 0));
  const paidOut = round2(todaysPaidOuts.reduce((s, p) => s + p.value, 0));
  const due = round2(sales - paidOut);
  const counted = countedText === '' ? undefined : round2(Number(countedText));
  const variance = counted === undefined ? 0 : round2(counted - due);
  const tol = counted === undefined ? 'ok' : toleranceOf(variance, rules);
  const waiting = exposureFor(shop.siteId, { ...cash, rules }, now).bags.filter(b => b.kind === 'takings');
  const waitingValue = round2(waiting.reduce((s, b) => s + bagGbp(b), 0));
  const depositValue = round2((counted ?? 0) + (bankNow ? waitingValue : 0));

  const ref = reference.trim().toLowerCase();
  const twins = CASH_SHOPS.filter(s => s.siteId !== shop.siteId).flatMap(s =>
    allCollections(s.siteId, cash.collections)
      .filter(c => (ref && c.reference?.toLowerCase() === ref) || (bankNow && dayOf(c.when, now) === 0 && c.value === depositValue))
      .map(c => ({ shop: nameOf(s.siteId, s.name), c })),
  );

  const problems: string[] = [];
  if (counted === undefined || Number.isNaN(counted)) problems.push('Enter the cash counted for the deposit.');
  if (tol === 'reason' && reason.trim().length < 4) problems.push(`The difference is over ${money(rules.reasonAt)}. Add a reason.`);
  if (bankNow && bankName.trim().length < 3) problems.push('Enter the bank and branch.');
  if (bankNow && reference.trim().length < 4) problems.push('Enter the paying-in reference.');
  if (bankNow && !slip) problems.push('Add a photo of the paying-in slip.');
  if (rules.dualConfirm && !checkedBy) problems.push('Choose who checked the cash.');

  const save = () => {
    setTried(true);
    if (problems.length || counted === undefined) return;
    const id = newId('close');
    const bag = bagNo.trim() || noBagNumber(id);
    const record: DayClose = {
      id,
      siteId: shop.siteId,
      day: 0,
      when: now.toISOString(),
      by,
      checkedBy: checkedBy || undefined,
      tills: [{ till: 'All tills', expected: due, counted, countedBy: by }],
      takingsCash: sales,
      takingsCard: cardSalesForDay(shop, 0, sales),
      ...summariseEvents(tillEvents(shop, 0).filter(e => e.minute <= dataTo)),
      waste: wasteForDay(shop, 0),
      variance,
      varianceReason: reason.trim() || undefined,
      missing: [],
      banking: [{ bagNo: bag, value: counted }],
    };
    cash.setCloses(prev => [...prev, record]);
    if (bankNow) {
      const deposit: Collection = {
        id: newId('coll'),
        siteId: shop.siteId,
        when: now.toISOString(),
        company: bankName.trim(),
        collector: by,
        outerBag: '',
        bagNos: [bag, ...waiting.map(b => b.bagNo)],
        value: depositValue,
        handedOverBy: by,
        witnessedBy: checkedBy || undefined,
        method: 'bank-run',
        reference: reference.trim(),
        bankName: bankName.trim(),
        slip,
      };
      cash.setCollections(prev => [...prev, deposit]);
    }
    setTried(false);
  };

  return (
    <div style={ui.page}>
      <div>
        <h1 style={ui.h1}>End of day</h1>
      </div>

      {dataTo < hm(shop.close) && (
        <Notice tone="warn">Till data runs to {hmLabel(dataTo)}. Cash due updates when the rest arrives.</Notice>
      )}

      <section style={ui.card} aria-labelledby="due-h">
        <h2 id="due-h" style={ui.h2}>Cash due</h2>
        <table style={ui.table}>
          <tbody>
            <tr>
              <td style={ui.td}>Cash sales<div style={ui.muted}>From the till, to {hmLabel(dataTo)}</div></td>
              <td style={ui.tdNum}>{money(sales)}</td>
            </tr>
            <tr>
              <td style={ui.td}>Paid outs<div style={ui.muted}>{todaysPaidOuts.length} from the till</div></td>
              <td style={ui.tdNum}>−{money(paidOut)}</td>
            </tr>
            <tr>
              <td style={{ ...ui.td, fontWeight: 700 }}>Cash due</td>
              <td style={{ ...ui.tdNum, fontWeight: 700 }}>{money(due)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ ...ui.field, flex: '0 1 220px' }} htmlFor="eod-counted">
            <span style={ui.fieldLabel}>Cash counted for the deposit</span>
            <input
              id="eod-counted"
              style={{ ...ui.input, fontSize: 18, fontWeight: 700 }}
              inputMode="decimal"
              placeholder="0.00"
              value={countedText}
              onChange={e => setCounted(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </label>
          {counted !== undefined && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 36 }} aria-live="polite">
              <span style={ui.fieldLabel}>Difference</span>
              <VarianceText variance={variance} rules={rules} />
            </div>
          )}
        </div>
        {tol !== 'ok' && (
          <label style={ui.field} htmlFor="eod-reason">
            <span style={ui.fieldLabel}>{tol === 'reason' ? 'Reason (required)' : 'Reason (optional)'}</span>
            <textarea id="eod-reason" style={{ ...ui.input, minHeight: 56 }} value={reason} onChange={e => setReason(e.target.value)} />
          </label>
        )}
      </section>

      {paidOutList}

      <section style={ui.card} aria-labelledby="dep-h">
        <h2 id="dep-h" style={ui.h2}>Deposit</h2>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
          <input type="checkbox" checked={bankNow} onChange={e => setBankNow(e.target.checked)} style={{ width: 18, height: 18 }} />
          Taking it to the bank now
        </label>
        {bankNow ? (
          <>
            {waiting.length > 0 && (
              <p style={{ margin: 0, fontSize: 13 }}>
                Also going: {waiting.map(b => `${dayLabel(b.day, now)} ${money(bagGbp(b))}`).join(', ')}. Deposit total {money(depositValue)}.
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ ...ui.field, flex: '1 1 200px' }} htmlFor="eod-bank">
                <span style={ui.fieldLabel}>Bank and branch</span>
                <input id="eod-bank" style={ui.input} value={bankName} placeholder="Barclays, Camden" onChange={e => setBankName(e.target.value)} />
              </label>
              <label style={{ ...ui.field, flex: '1 1 200px' }} htmlFor="eod-ref">
                <span style={ui.fieldLabel}>Paying-in reference</span>
                <input id="eod-ref" style={ui.input} value={reference} placeholder="From the slip" onChange={e => setReference(e.target.value)} />
              </label>
              <label style={{ ...ui.field, flex: '1 1 160px' }} htmlFor="eod-bag">
                <span style={ui.fieldLabel}>Bag number (optional)</span>
                <input id="eod-bag" style={ui.input} value={bagNo} onChange={e => setBagNo(e.target.value)} />
              </label>
            </div>
            <SlipField id="eod-slip" value={slip} onChange={setSlip} amount={depositValue} reference={reference} shop={shop.name} required />
            {twins.length > 0 && (
              <Notice tone="warn">
                {twins.map(t => `${t.shop} recorded ${money(t.c.value)} with ref ${t.c.reference ?? 'none'} ${dayLabel(dayOf(t.c.when, now), now).toLowerCase()}.`).join(' ')}{' '}
                Check this slip is from this shop.
              </Notice>
            )}
          </>
        ) : (
          <>
            <label style={{ ...ui.field, maxWidth: 240 }} htmlFor="eod-bag">
              <span style={ui.fieldLabel}>Bag number (optional)</span>
              <input id="eod-bag" style={ui.input} value={bagNo} onChange={e => setBagNo(e.target.value)} />
            </label>
            <p style={ui.muted}>The cash waits in the safe. Record it in Bank deposit when it goes.</p>
          </>
        )}
      </section>

      <section style={ui.card} aria-labelledby="sign-h">
        <h2 id="sign-h" style={ui.h2}>Sign off</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <PersonSelect id="eod-by" label={bankNow ? 'Counted and deposited by' : 'Counted by'} value={by} onChange={setBy} people={team} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <PersonSelect
              id="eod-checked"
              label={rules.dualConfirm ? 'Checked by (required)' : 'Checked by (optional)'}
              value={checkedBy}
              onChange={setCheckedBy}
              people={team.filter(p => p !== by)}
              allowNone
            />
          </div>
        </div>
        {tried && problems.length > 0 && (
          <div role="alert" style={{ color: 'var(--color-error)', fontSize: 13, lineHeight: 1.5 }}>
            {problems.map(p => <div key={p}>{p}</div>)}
          </div>
        )}
        <button type="button" style={{ ...ui.primaryBtn, alignSelf: 'flex-start' }} onClick={save}>
          {bankNow ? 'Save end of day and deposit' : 'Save end of day'}
        </button>
      </section>
    </div>
  );
}
