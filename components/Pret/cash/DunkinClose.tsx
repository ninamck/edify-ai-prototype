'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import * as ui from '../supportCentreUi';
import { useCashShop } from './useCashShop';
import CloseSummary from './CloseSummary';
import PaidOutRow from './PaidOutRow';
import SlipField from './SlipField';
import { Notice, PersonSelect, VarianceText } from './CashUi';
import {
  CASH_SHOPS, DENOMS, cardSalesForDay, dayLabel, hm, hmLabel, money, noBagNumber, round2, slipReference, summariseEvents,
  tillEvents, wasteForDay, type Collection, type DayClose,
} from '../cashFixtures';
import { allCollections, closeToday, dayOf, newId, tillDataTo, toleranceOf } from '../cashStore';
import { depositStatus, dunkinCashDue } from '../cashOperators';
import { useSetupValue, useShopBanking } from '../cashSetup';
import { paidOutsFor, usePaidOutNotes, type PaidOut, type PaidOutNote } from '../paidOuts';
import { useShopName } from '../shopNames';

type Step = 1 | 2 | 3 | 'done';

const STEPS = [
  { n: 1, label: 'Paid outs' },
  { n: 2, label: 'Count' },
  { n: 3, label: 'Bank slip' },
] as const;

/** Where the day has got to, for Today and for this page. */
export function useDunkinCloseProgress() {
  const cash = useCashShop();
  const [notes] = usePaidOutNotes();
  const { shop, rules } = cash;
  if (!shop) return undefined;
  const now = new Date();
  const todays = paidOutsFor(shop, notes, now, 0);
  const close = closeToday(shop.siteId, cash.closes, now);
  const deposit = depositStatus(shop, { ...cash, rules }, now);
  const banked = !!close && !deposit.waiting.some(b => b.day === 0);
  return {
    todays,
    openPaidOuts: todays.filter(p => !p.explained),
    close,
    deposit,
    banked,
  };
}

/**
 * Kyle's close in three steps: say what each paid out was for, enter the cash
 * counted, then photograph the bank slip. Everything else is already known:
 * cash due comes from the till, the bank from Set-up, the person from who is
 * signed in.
 */
export default function DunkinClose() {
  const cash = useCashShop();
  const progress = useDunkinCloseProgress();
  const [, setNotes] = usePaidOutNotes();
  const wantsDeposit = useSearchParams().get('step') === 'deposit';
  const [chosen, setChosen] = useState<Step | null>(null);
  const [announce, setAnnounce] = useState('');
  const { shop, me } = cash;
  if (!shop || !progress) return null;
  const step: Step = chosen ?? (progress.close ? (wantsDeposit && !progress.banked ? 3 : 'done') : 1);

  const savePaidOut = (id: string, note: PaidOutNote) => setNotes(prev => ({ ...prev, [id]: note }));
  const go = (s: Step, message = '') => {
    setChosen(s);
    setAnnounce(message);
    window.scrollTo({ top: 0 });
  };

  return (
    <div style={ui.page}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={ui.h1}>Close the day</h1>
        <StepBar step={step} done={[progress.openPaidOuts.length === 0, !!progress.close, progress.banked]} />
      </div>
      <p role="status" aria-live="polite" style={announce ? { margin: 0, fontSize: 14, fontWeight: 600 } : srOnly}>{announce}</p>

      {step === 1 && <PaidOutsStep todays={progress.todays} me={me.name} onSave={savePaidOut} onNext={() => go(2)} />}
      {step === 2 && <CountStep onBack={() => go(1)} onSaved={() => go(3, 'Count saved. Step 3: the bank slip.')} todays={progress.todays} />}
      {step === 3 && (
        <SlipStep
          onSaved={() => go('done', 'Deposit saved. The day is closed.')}
          onNotToday={() => go('done', 'Count saved. The cash waits in the safe.')}
        />
      )}
      {step === 'done' && <Done todays={progress.todays} me={me.name} onSave={savePaidOut} onDeposit={() => go(3)} />}
    </div>
  );
}

const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' };

/** Steps 1 to 3, with the current one marked. Done steps show a tick so colour is never the only signal. */
function StepBar({ step, done: finished }: { step: Step; done: [boolean, boolean, boolean] }) {
  return (
    <ol aria-label="Steps" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {STEPS.map(s => {
        const current = s.n === step;
        const done = finished[s.n - 1];
        return (
          <li key={s.n} aria-current={current ? 'step' : undefined} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 14px 0 6px', borderRadius: 999, fontSize: 14, fontWeight: current ? 700 : 600,
            border: current ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border)',
            background: done && !current ? 'var(--color-review-light)' : '#ffffff', color: 'var(--color-text-primary)',
          }}>
            <span aria-hidden style={{
              width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700,
              background: current ? 'var(--color-text-primary)' : '#ffffff', color: current ? '#ffffff' : 'var(--color-text-primary)', border: '1px solid var(--color-text-primary)',
            }}>
              {done && !current ? <Check size={14} /> : s.n}
            </span>
            {s.label}
            {done && !current && <span style={srOnly}>, done</span>}
          </li>
        );
      })}
    </ol>
  );
}

function StepHeading({ n, title, help }: { n: number; title: string; help: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ ...ui.muted, margin: 0, fontWeight: 700 }}>Step {n} of 3</p>
      <h2 style={{ ...ui.h2, fontSize: 20 }}>{title}</h2>
      <p style={{ ...ui.muted, margin: 0 }}>{help}</p>
    </div>
  );
}

const actions: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 };
const btn = (style: CSSProperties): CSSProperties => ({ ...style, minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' });

function PaidOutList({ todays, me, onSave }: { todays: PaidOut[]; me: string; onSave: (id: string, note: PaidOutNote) => void }) {
  return (
    <ul className="row-list" style={ui.rowList}>
      {todays.map(p => <PaidOutRow key={`${p.id}-${p.explained?.when ?? 'open'}`} p={p} me={me} onSave={onSave} />)}
    </ul>
  );
}

function PaidOutsStep({ todays, me, onSave, onNext }: { todays: PaidOut[]; me: string; onSave: (id: string, note: PaidOutNote) => void; onNext: () => void }) {
  const open = todays.filter(p => !p.explained).length;
  return (
    <section style={ui.card} aria-label="Step 1, paid outs">
      <StepHeading n={1} title="What were today's paid outs for?" help="The till recorded them. Pick what each one was for." />
      {todays.length === 0 ? <p style={{ margin: 0, fontSize: 14 }}>No paid outs from the till today.</p> : <PaidOutList todays={todays} me={me} onSave={onSave} />}
      {open > 0 && (
        <p style={{ margin: 0, fontSize: 14 }}>
          {open}{' '}still to explain. You can do it later, even after the day is closed. They stay on Today until they&apos;re done.
        </p>
      )}
      <div style={actions}>
        <button type="button" style={btn(open ? ui.ghostBtn : ui.primaryBtn)} onClick={onNext}>
          {open ? 'Do it later, go to the count' : 'Next: count the cash'}
        </button>
      </div>
    </section>
  );
}

function CountStep({ todays, onBack, onSaved }: { todays: PaidOut[]; onBack: () => void; onSaved: () => void }) {
  const cash = useCashShop();
  const [countedText, setCounted] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [tried, setTried] = useState(false);
  const dualConfirm = useSetupValue('dunkin', 'two-person') === 'on';
  const { shop, rules, me } = cash;
  if (!shop) return null;

  const now = new Date();
  const team = shop.team;
  const by = team.includes(me.name) ? me.name : team[0];
  const dataTo = Math.min(hm(shop.close), Math.max(0, tillDataTo(shop, now)));
  const { sales, paidOut, paidIns, paidIn, due } = dunkinCashDue(shop, todays, dataTo);
  const noteTotal = round2(DENOMS.USD.reduce((s, d) => s + (Number(qty[d.id]) || 0) * d.value, 0));
  const counted = noteTotal > 0 ? noteTotal : countedText === '' ? undefined : round2(Number(countedText));
  const variance = counted === undefined ? 0 : round2(counted - due);
  const tol = counted === undefined ? 'ok' : toleranceOf(variance, rules);

  const problems: string[] = [];
  if (counted === undefined || Number.isNaN(counted)) problems.push('Enter the cash you counted.');
  if (tol === 'reason' && reason.trim().length < 4) problems.push(`The difference is over ${money(rules.reasonAt)}. Say why.`);
  if (dualConfirm && !checkedBy) problems.push('Choose who checked the cash.');

  const save = () => {
    setTried(true);
    if (problems.length || counted === undefined) return;
    const id = newId('close');
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
      banking: [{ bagNo: noBagNumber(id), value: counted }],
    };
    cash.setCloses(prev => [...prev, record]);
    onSaved();
  };

  return (
    <section style={ui.card} aria-label="Step 2, count">
      <StepHeading n={2} title="Count the cash" help="Cash due comes from the till. Enter what you counted." />
      {dataTo < hm(shop.close) && <Notice tone="warn">Till data runs to {hmLabel(dataTo)}. Cash due updates when the rest arrives.</Notice>}
      <table style={ui.table}>
        <tbody>
          <tr>
            <td style={ui.td}>Cash sales<div style={ui.muted}>From the till, to {hmLabel(dataTo)}</div></td>
            <td style={ui.tdNum}>{money(sales)}</td>
          </tr>
          <tr>
            <td style={ui.td}>Paid outs<div style={ui.muted}>{todays.length} from the till</div></td>
            <td style={ui.tdNum}>−{money(paidOut)}</td>
          </tr>
          {paidIns.length > 0 && (
            <tr>
              <td style={ui.td}>
                Paid ins<div style={ui.muted}>{paidIns.map(p => `${p.reason}, ${hmLabel(p.minute)}`).join('. ')}</div>
              </td>
              <td style={ui.tdNum}>+{money(paidIn)}</td>
            </tr>
          )}
          <tr>
            <td style={{ ...ui.td, fontWeight: 700 }}>Cash due</td>
            <td style={{ ...ui.tdNum, fontWeight: 700 }}>{money(due)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ ...ui.field, flex: '0 1 220px' }} htmlFor="close-counted">
          <span style={ui.fieldLabel}>Cash counted</span>
          <input
            id="close-counted"
            style={{
              ...ui.input, minHeight: 44, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              background: noteTotal > 0 ? 'var(--color-bg-surface)' : '#ffffff',
            }}
            inputMode="decimal"
            placeholder="0.00"
            aria-describedby="close-counted-hint"
            readOnly={noteTotal > 0}
            value={noteTotal > 0 ? noteTotal.toFixed(2) : countedText}
            onChange={e => setCounted(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </label>
        {counted !== undefined && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }} aria-live="polite">
            <span style={ui.fieldLabel}>Difference</span>
            <VarianceText variance={variance} rules={rules} />
          </div>
        )}
      </div>
      <span id="close-counted-hint" style={{ ...ui.muted, marginTop: -6 }}>
        {noteTotal > 0 ? 'Totalled from bills and coins.' : 'Or count bills and coins below.'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ ...ui.h2, fontSize: 13, margin: 0 }}>Bills and coins (optional)</h3>
        {noteTotal > 0 && (
          <button type="button" style={btn(ui.ghostBtn)} onClick={() => setQty({})}>Clear bills and coins</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {[
          { title: 'Bills', rows: DENOMS.USD.filter(d => d.id.startsWith('n')) },
          { title: 'Coins', rows: DENOMS.USD.filter(d => d.id.startsWith('c')) },
        ].map(group => (
          <table key={group.title} style={{ ...ui.table, flex: '1 1 260px', width: 'auto' }}>
            <thead>
              <tr>
                <th style={ui.th}>{group.title}</th>
                <th style={ui.th}>How many</th>
                <th style={ui.thNum}>Value</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map(d => {
                const raw = qty[d.id] ?? '';
                return (
                  <tr key={d.id}>
                    <td style={{ ...ui.td, fontWeight: 600, verticalAlign: 'middle' }}>{d.label}</td>
                    <td style={{ ...ui.td, verticalAlign: 'middle', paddingTop: 4, paddingBottom: 4 }}>
                      <input
                        aria-label={`How many ${d.label}`}
                        inputMode="numeric"
                        value={raw}
                        onChange={e => setQty(prev => ({ ...prev, [d.id]: e.target.value.replace(/[^\d]/g, '') }))}
                        style={{ ...ui.input, width: 90, minHeight: 44 }}
                      />
                    </td>
                    <td style={{ ...ui.tdNum, verticalAlign: 'middle' }}>{money((Number(raw) || 0) * d.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
      {tol === 'reason' && (
        <label style={ui.field} htmlFor="close-reason">
          <span style={ui.fieldLabel}>Why is it over {money(rules.reasonAt)} out?</span>
          <textarea id="close-reason" style={{ ...ui.input, minHeight: 56 }} value={reason} onChange={e => setReason(e.target.value)} />
        </label>
      )}
      {dualConfirm && (
        <div style={{ maxWidth: 280 }}>
          <PersonSelect id="close-checked" label="Checked by" value={checkedBy} onChange={setCheckedBy} people={team.filter(p => p !== by)} allowNone />
        </div>
      )}
      <p style={{ ...ui.muted, margin: 0 }}>Counted by {by}.</p>
      {tried && problems.length > 0 && (
        <div role="alert" style={{ color: 'var(--color-error)', fontSize: 13, lineHeight: 1.5 }}>
          {problems.map(p => <div key={p}>{p}</div>)}
        </div>
      )}
      <div style={actions}>
        <button type="button" style={btn(ui.primaryBtn)} onClick={save}>Save count</button>
        <button type="button" style={btn(ui.ghostBtn)} onClick={onBack}>Back to paid outs</button>
      </div>
    </section>
  );
}

function SlipStep({ onSaved, onNotToday }: { onSaved: () => void; onNotToday: () => void }) {
  const cash = useCashShop();
  const nameOf = useShopName();
  const { bankingFor } = useShopBanking();
  const [slip, setSlip] = useState('');
  const [amountText, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [bagNo, setBagNo] = useState('');
  const [tried, setTried] = useState(false);
  const { shop, rules, me } = cash;
  if (!shop) return null;

  const now = new Date();
  const by = shop.team.includes(me.name) ? me.name : shop.team[0];
  const { bank, bagNeeded } = bankingFor(shop.siteId);
  const { waiting, waitingValue } = depositStatus(shop, { ...cash, rules }, now);
  const readRef = slipReference(shop.siteId, 0);
  const shopLabel = nameOf(shop.siteId, shop.name);

  const addSlip = (dataUrl: string) => {
    setSlip(dataUrl);
    if (dataUrl) {
      setAmount(waitingValue.toFixed(2));
      setReference(readRef);
    } else {
      setAmount('');
      setReference('');
    }
  };

  const amount = amountText === '' ? undefined : round2(Number(amountText));
  const ref = reference.trim().toLowerCase();
  const twins = CASH_SHOPS.filter(s => s.siteId !== shop.siteId).flatMap(s =>
    allCollections(s.siteId, cash.collections)
      .filter(c => (ref && c.reference?.toLowerCase() === ref) || (amount !== undefined && dayOf(c.when, now) === 0 && c.value === amount))
      .map(c => ({ shop: nameOf(s.siteId, s.name), c })),
  );

  const problems: string[] = [];
  if (!slip) problems.push('Add a photo of the bank slip.');
  if (slip && (amount === undefined || Number.isNaN(amount))) problems.push('Check the amount on the slip.');
  if (slip && reference.trim().length < 4) problems.push('Check the reference on the slip.');
  if (bagNeeded && !bagNo.trim()) problems.push('Enter the deposit bag number. This branch needs one.');
  if (!bank) problems.push('Add this shop\u2019s bank in Set-up.');

  const save = () => {
    setTried(true);
    if (problems.length || amount === undefined) return;
    const deposit: Collection = {
      id: newId('coll'),
      siteId: shop.siteId,
      when: now.toISOString(),
      company: bank,
      collector: by,
      outerBag: bagNo.trim(),
      bagNos: waiting.map(b => b.bagNo),
      value: amount,
      handedOverBy: by,
      method: 'bank-run',
      reference: reference.trim(),
      bankName: bank,
      slip,
    };
    cash.setCollections(prev => [...prev, deposit]);
    onSaved();
  };

  if (!waiting.length) {
    return (
      <section style={ui.card} aria-label="Step 3, bank slip">
        <StepHeading n={3} title="Nothing waiting to bank" help="Every day's cash has gone to the bank." />
      </section>
    );
  }

  const days = waiting.map(b => `${dayLabel(b.day, now)} ${money(b.value)}`).join(', ');
  const off = amount !== undefined && !Number.isNaN(amount) && amount !== waitingValue;

  return (
    <section style={ui.card} aria-label="Step 3, bank slip">
      <StepHeading n={3} title="Photograph the bank slip" help="Edify reads the amount and reference. Check them." />
      <table style={ui.table}>
        <tbody>
          <tr>
            <td style={ui.td}>To deposit<div style={ui.muted}>{days}</div></td>
            <td style={{ ...ui.tdNum, fontWeight: 700 }}>{money(waitingValue)}</td>
          </tr>
          <tr>
            <td style={ui.td}>Bank</td>
            <td style={{ ...ui.tdNum, fontVariantNumeric: 'normal' }}>
              <span style={{ display: 'block' }}>{bank || 'Not set'}</span>
              <Link href="/cash/setup" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: 'inherit', fontWeight: 600, fontSize: 13 }}>Change in Set-up</Link>
            </td>
          </tr>
        </tbody>
      </table>
      <SlipField id="close-slip" value={slip} onChange={addSlip} amount={waitingValue} reference={readRef} shop={shopLabel} required />
      {slip && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ ...ui.field, flex: '0 1 180px' }} htmlFor="close-amount">
            <span style={ui.fieldLabel}>Amount on the slip</span>
            <input id="close-amount" style={{ ...ui.input, minHeight: 44 }} inputMode="decimal" value={amountText} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
          </label>
          <label style={{ ...ui.field, flex: '1 1 240px' }} htmlFor="close-ref">
            <span style={ui.fieldLabel}>Reference on the slip</span>
            <input id="close-ref" style={{ ...ui.input, minHeight: 44 }} value={reference} onChange={e => setReference(e.target.value)} />
          </label>
        </div>
      )}
      {off && <Notice tone="warn">The slip says {money(amount!)} and {money(waitingValue)} is waiting. Check the amount, or save it and the difference shows in History.</Notice>}
      {twins.length > 0 && (
        <Notice tone="warn">
          {twins.map(t => `${t.shop} recorded ${money(t.c.value)} with ref ${t.c.reference ?? 'none'} ${dayLabel(dayOf(t.c.when, now), now).toLowerCase()}.`).join(' ')}{' '}
          Check this slip is from this shop.
        </Notice>
      )}
      {bagNeeded && (
        <label style={{ ...ui.field, maxWidth: 240 }} htmlFor="close-bag">
          <span style={ui.fieldLabel}>Deposit bag number</span>
          <input id="close-bag" style={{ ...ui.input, minHeight: 44 }} value={bagNo} onChange={e => setBagNo(e.target.value)} />
        </label>
      )}
      {tried && problems.length > 0 && (
        <div role="alert" style={{ color: 'var(--color-error)', fontSize: 13, lineHeight: 1.5 }}>
          {problems.map(p => <div key={p}>{p}</div>)}
        </div>
      )}
      <div style={actions}>
        <button type="button" style={btn(ui.primaryBtn)} onClick={save}>Save deposit</button>
        <button type="button" style={btn(ui.ghostBtn)} onClick={onNotToday}>Not going to the bank today</button>
      </div>
    </section>
  );
}

function Done({ todays, me, onSave, onDeposit }: { todays: PaidOut[]; me: string; onSave: (id: string, note: PaidOutNote) => void; onDeposit: () => void }) {
  const cash = useCashShop();
  const { shop, rules } = cash;
  if (!shop) return null;
  const now = new Date();
  const close = closeToday(shop.siteId, cash.closes, now);
  if (!close) return null;
  const todayBag = close.banking[0]?.bagNo;
  const deposit = allCollections(shop.siteId, cash.collections).find(c => c.bagNos.includes(todayBag));
  const { waitingValue } = depositStatus(shop, { ...cash, rules }, now);
  const open = todays.filter(p => !p.explained).length;

  return (
    <>
      {deposit ? (
        <Notice tone="good">
          Day closed. {money(deposit.value)} deposited at {deposit.bankName} by {deposit.handedOverBy}, ref {deposit.reference}.
        </Notice>
      ) : (
        <section style={{ ...ui.card, border: '2px solid var(--color-warning-border)' }} aria-labelledby="safe-h">
          <h2 id="safe-h" style={ui.h2}>Deposit waiting</h2>
          <p style={{ margin: 0, fontSize: 14 }}>The count is saved. {money(waitingValue)} is in the safe until it goes to the bank.</p>
          <div style={actions}>
            <button type="button" style={btn(ui.primaryBtn)} onClick={onDeposit}>Deposit now</button>
          </div>
        </section>
      )}
      {deposit?.slip && (
        <section style={ui.card} aria-labelledby="slip-h">
          <h2 id="slip-h" style={ui.h2}>Bank slip</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={deposit.slip} alt={`Bank slip, ${deposit.reference}`} style={{ width: 280, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }} />
        </section>
      )}
      <section style={ui.card}>
        <CloseSummary close={close} corrections={cash.corrections} onCorrect={c => cash.setCorrections(prev => [...prev, c])} team={shop.team} me={me} rules={rules} />
      </section>
      <section style={ui.card} aria-labelledby="po-h">
        <h2 id="po-h" style={ui.h2}>Today&apos;s paid outs</h2>
        <p style={{ ...ui.muted, margin: 0 }}>
          {open ? `${open} still to explain. ` : ''}You can change what any paid out was for. Each change keeps who made it and when.
        </p>
        {todays.length === 0 ? <p style={{ margin: 0, fontSize: 14 }}>No paid outs from the till today.</p> : <PaidOutList todays={todays} me={me} onSave={onSave} />}
      </section>
    </>
  );
}
