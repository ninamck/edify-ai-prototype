'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as ui from '@/components/Pret/supportCentreUi';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import { NoShop, OperatorOnly, PersonSelect, timeOf } from '@/components/Pret/cash/CashUi';
import { money, round2 } from '@/components/Pret/cashFixtures';
import {
  COUNT_KIND_LABEL,
  countPlace,
  countedOf,
  exposureFor,
  expectedTill,
  isMovement,
  newId,
  nowMinute,
  todaysCounts,
  type CashCount,
  type CashMovementKind,
} from '@/components/Pret/cashStore';
import { PAID_IN_FOR, PAID_OUT_FOR, useOperatorCash } from '@/components/Pret/cashOperators';

const SAFE = 'safe';

const KINDS: { id: CashMovementKind; label: string; how: string }[] = [
  { id: 'paid-out', label: 'Paid out', how: 'Cash spent from the safe. Keep the receipt.' },
  { id: 'paid-in', label: 'Paid in', how: 'Cash added that is not a sale, such as tips or a float top-up.' },
  { id: 'transfer', label: 'Till to till', how: 'Cash moved between tills.' },
  { id: 'change-in', label: 'Change received', how: 'A change delivery into the safe.' },
];

export default function CashMovementsPage() {
  const cash = useCashShop();
  const router = useRouter();
  const operators = useOperatorCash();
  const { shop, rules, me } = cash;
  const team = shop?.team ?? [];

  const [kind, setKind] = useState<CashMovementKind>('paid-out');
  const [from, setFrom] = useState(SAFE);
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [countedChoice, setCountedBy] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [tried, setTried] = useState(false);

  if (!operators) return <OperatorOnly />;
  if (!shop) return <NoShop />;

  const now = new Date();
  const countedBy = team.includes(countedChoice) ? countedChoice : team.includes(me.name) ? me.name : team[0] ?? '';
  const value = round2(Number(amount) || 0);
  const isTransfer = kind === 'transfer';
  const fromTill = isTransfer ? (shop.tills.includes(from) ? from : shop.tills[0]) : from === SAFE || kind === 'change-in' || kind === 'paid-out' ? undefined : from;
  const toTill = isTransfer ? (shop.tills.includes(to) && to !== fromTill ? to : shop.tills.find(t => t !== fromTill)) : undefined;
  const categories = kind === 'paid-out' ? PAID_OUT_FOR : kind === 'paid-in' ? PAID_IN_FOR : [];
  const pickedCategory = categories.includes(category) ? category : '';
  const leaving = kind === 'paid-out' || isTransfer;
  const available = !leaving
    ? undefined
    : fromTill
      ? round2(expectedTill(shop, fromTill, nowMinute(now), cash.counts, rules, now).amounts.GBP ?? 0)
      : exposureFor(shop.siteId, { ...cash, rules }, now).total;

  const problems: string[] = [];
  if (value <= 0) problems.push('Enter the amount.');
  if (categories.length && !pickedCategory) problems.push(`Choose what the cash was ${kind === 'paid-out' ? 'for' : 'from'}.`);
  if (pickedCategory === 'Other' && note.trim().length < 4) problems.push('Add a note saying what it was for.');
  if (kind === 'change-in' && reference.trim().length < 3) problems.push('Enter the delivery reference.');
  if (isTransfer && !toTill) problems.push('Choose a different till.');
  if (available !== undefined && value > available) problems.push(`More than ${fromTill ?? 'the safe'} holds (${money(available)}).`);
  if (rules.dualConfirm && !checkedBy) problems.push('Choose who checked it.');
  if (checkedBy && checkedBy === countedBy) problems.push('The checker must be a different person.');

  const save = () => {
    setTried(true);
    if (problems.length) return;
    const record: CashCount = {
      id: newId('move'),
      siteId: shop.siteId,
      when: now.toISOString(),
      kind,
      till: fromTill,
      toTill,
      qty: {},
      totals: { GBP: value },
      category: kind === 'change-in' ? `Delivery ${reference.trim()}` : pickedCategory || undefined,
      reason: note.trim() || undefined,
      countedBy,
      checkedBy: checkedBy || undefined,
    };
    cash.setCounts(prev => [...prev, record]);
    router.push(`/cash/today?saved=${record.id}`);
  };

  const moves = todaysCounts(cash.counts, shop.siteId, now).filter(c => isMovement(c.kind));
  const activeBtn = { background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)' };
  const how = KINDS.find(k => k.id === kind)?.how;

  return (
    <div style={ui.page}>
      <div>
        <Link href="/cash/today" style={{ ...ui.muted, textDecoration: 'none' }}>← Cash today</Link>
        <h1 style={{ ...ui.h1, marginTop: 6 }}>Cash in and out</h1>      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <section style={ui.card} aria-labelledby="move-h">
          <h2 id="move-h" style={ui.h2}>New entry</h2>
          <div role="radiogroup" aria-label="Type of movement" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {KINDS.map(k => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={k.id === kind}
                onClick={() => { setKind(k.id); setCategory(''); }}
                style={{ ...ui.ghostBtn, ...(k.id === kind ? activeBtn : {}) }}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p style={ui.muted}>
            {how}
            {kind === 'paid-out' && (
              <> Paid outs at a till come from the till data. <Link href="/cash/paid-outs" style={{ color: 'var(--color-accent-active)', fontWeight: 700 }}>Explain them in Paid outs</Link>.</>
            )}
          </p>

          {kind !== 'change-in' && kind !== 'paid-out' && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ ...ui.field, flex: '1 1 140px' }} htmlFor="move-from">
                <span style={ui.fieldLabel}>{isTransfer ? 'From till' : 'Put into'}</span>
                <select id="move-from" style={ui.input} value={isTransfer ? fromTill : from} onChange={e => setFrom(e.target.value)}>
                  {!isTransfer && <option value={SAFE}>The safe</option>}
                  {shop.tills.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              {isTransfer && (
                <label style={{ ...ui.field, flex: '1 1 140px' }} htmlFor="move-to">
                  <span style={ui.fieldLabel}>To till</span>
                  <select id="move-to" style={ui.input} value={toTill ?? ''} onChange={e => setTo(e.target.value)}>
                    {shop.tills.filter(t => t !== fromTill).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}

          {categories.length > 0 && (
            <label style={ui.field} htmlFor="move-category">
              <span style={ui.fieldLabel}>{kind === 'paid-out' ? 'What for' : 'Where it came from'}</span>
              <select id="move-category" style={ui.input} value={pickedCategory} onChange={e => setCategory(e.target.value)}>
                <option value="">Choose one</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          {kind === 'change-in' && (
            <label style={ui.field} htmlFor="move-ref">
              <span style={ui.fieldLabel}>Delivery reference</span>
              <input id="move-ref" style={ui.input} value={reference} placeholder="For example CHG 4471" onChange={e => setReference(e.target.value)} />
            </label>
          )}

          <label style={ui.field} htmlFor="move-amount">
            <span style={ui.fieldLabel}>Amount</span>
            <input
              id="move-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              aria-describedby={available !== undefined ? 'move-available' : undefined}
              onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              style={{ ...ui.input, fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minHeight: 44 }}
            />
            {available !== undefined && (
              <span id="move-available" style={ui.muted}>{fromTill ?? 'Safe'} expected now: {money(available)}</span>
            )}
          </label>
          <label style={ui.field} htmlFor="move-note">
            <span style={ui.fieldLabel}>{pickedCategory === 'Other' ? 'Note (required)' : 'Note (optional)'}</span>
            <textarea id="move-note" style={{ ...ui.input, minHeight: 56 }} value={note} onChange={e => setNote(e.target.value)} />
          </label>

          <PersonSelect id="move-counted-by" label="Counted by" value={countedBy} onChange={setCountedBy} people={team} />
          <PersonSelect
            id="move-checked-by"
            label={rules.dualConfirm ? 'Checked by (required)' : 'Checked by (optional)'}
            value={checkedBy}
            onChange={setCheckedBy}
            people={team.filter(p => p !== countedBy)}
            allowNone
          />

          {tried && problems.length > 0 && (
            <div role="alert" style={{ color: 'var(--color-error)', fontSize: 13, lineHeight: 1.5 }}>
              {problems.map(p => <div key={p}>{p}</div>)}
            </div>
          )}
          <button type="button" style={ui.primaryBtn} onClick={save}>
            Save {COUNT_KIND_LABEL[kind].toLowerCase()}
          </button>
        </section>

        <section style={ui.card} aria-labelledby="moves-h">
          <h2 id="moves-h" style={ui.h2}>Today</h2>
          {moves.length === 0 ? (
            <p style={ui.muted}>Nothing recorded yet.</p>
          ) : (
            <ul className="row-list" style={ui.rowList}>
              {moves.map(m => (
                <li key={m.id} style={{ ...ui.listRow, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{COUNT_KIND_LABEL[m.kind]}, {countPlace(m)}</span>
                    <span style={ui.muted}>
                      {timeOf(m.when)}{m.category ? `, ${m.category}` : ''}{m.reason ? `. ${m.reason}` : ''}. {m.countedBy}{m.checkedBy ? `, checked by ${m.checkedBy}` : ''}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {m.kind === 'paid-out' ? `${money(countedOf(m).GBP ?? 0)} out` : m.kind === 'transfer' ? money(countedOf(m).GBP ?? 0) : `${money(countedOf(m).GBP ?? 0)} in`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
