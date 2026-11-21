'use client';

import Link from 'next/link';
import { useState } from 'react';
import * as ui from '@/components/Pret/supportCentreUi';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import { NoShop, Notice } from '@/components/Pret/cash/CashUi';
import { control } from '@/components/Pret/cash/DayRangePicker';
import { WEEKDAY, at, money, round2 } from '@/components/Pret/cashFixtures';
import { CHANGE_BAGS, changeOrderValue, dayOf, newId, type ChangeOrder } from '@/components/Pret/cashStore';
import { whenLabel } from '@/components/Pret/countStore';

/** Next collection day, as a day offset from today (1 at the earliest). */
function nextCollectionDay(days: number[], now: Date): number {
  for (let i = 1; i < 8; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    if (days.includes(d.getDay())) return i;
  }
  return 7;
}

export default function CashChangePage() {
  const cash = useCashShop();
  const { shop, rules, me } = cash;
  const [bags, setBags] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  if (!shop) return <NoShop />;
  const now = new Date();
  const deliverDay = nextCollectionDay(rules.collectionDays, now);
  const lines = CHANGE_BAGS.map(b => ({ ...b, qty: Math.max(0, Math.floor(Number(bags[b.id]) || 0)) }));
  const total = round2(lines.reduce((s, l) => s + l.qty * l.bagValue, 0));
  const open = cash.changeOrders.filter(o => o.siteId === shop.siteId && !o.receivedAt).sort((a, b) => dayOf(a.deliverOn, now) - dayOf(b.deliverOn, now));

  const receive = (o: ChangeOrder) => {
    cash.setChangeOrders(prev => prev.map(x => (x.id === o.id ? { ...x, receivedAt: new Date().toISOString(), receivedBy: me.name } : x)));
    setNotice(`${money(changeOrderValue(o))} of change marked received.`);
  };

  const submit = () => {
    if (total <= 0) return;
    const order: ChangeOrder = {
      id: newId('chg'),
      siteId: shop.siteId,
      when: now.toISOString(),
      by: me.name,
      bags: Object.fromEntries(lines.filter(l => l.qty > 0).map(l => [l.id, l.qty])),
      deliverOn: at(deliverDay, '10:00'),
      note: note.trim() || undefined,
    };
    cash.setChangeOrders(prev => [...prev, order]);
    setNotice(`Change ordered: ${money(total)}, arriving ${whenLabel(order.deliverOn)}.`);
    setBags({});
    setNote('');
  };

  return (
    <div style={ui.page}>
      <div>
        <h1 style={ui.h1}>Order change</h1>      </div>

      {notice && <Notice tone="good">{notice}</Notice>}

      {open.length > 0 && (
        <section aria-labelledby="open-h" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 id="open-h" style={ui.h2}>On its way</h2>
          <div style={ui.card}>
          <ul className="row-list" style={ui.rowList}>
            {open.map(o => {
              const late = dayOf(o.deliverOn, now) < 0;
              return (
                <li key={o.id} style={{ ...ui.listRow, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 360px' }}>
                    <span><strong>{money(changeOrderValue(o))}</strong> {late ? <strong>was due {whenLabel(o.deliverOn)}</strong> : `arrives ${whenLabel(o.deliverOn)}`}</span>
                    <span style={ui.muted}>
                      {Object.entries(o.bags).map(([id, q]) => `${q} × ${CHANGE_BAGS.find(b => b.id === id)?.label ?? id}`).join(', ')}.
                      {' '}Ordered {whenLabel(o.when)} by {o.by}{o.note ? `. ${o.note}` : ''}
                    </span>
                  </span>
                  <button type="button" style={control} onClick={() => receive(o)}>Mark received</button>
                </li>
              );
            })}
          </ul>
          </div>
        </section>
      )}

      <section style={ui.card} aria-labelledby="order-h">
        <h2 id="order-h" style={ui.h2}>New order</h2>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Change</th>
              <th style={ui.th}>Bags</th>
              <th style={ui.thNum}>Value</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.id}>
                <td style={ui.td}>{l.label} <span style={ui.muted}>({money(l.bagValue)})</span></td>
                <td style={ui.td}>
                  <input
                    aria-label={`Bags of ${l.label}`}
                    inputMode="numeric"
                    style={{ ...ui.input, width: 80 }}
                    value={bags[l.id] ?? ''}
                    onChange={e => setBags(prev => ({ ...prev, [l.id]: e.target.value.replace(/[^\d]/g, '') }))}
                  />
                </td>
                <td style={ui.tdNum}>{money(l.qty * l.bagValue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...ui.td, fontWeight: 700 }} colSpan={2}>Total</td>
              <td style={{ ...ui.tdNum, fontWeight: 700 }}>{money(total)}</td>
            </tr>
          </tfoot>
        </table>
        <label style={ui.field}>
          <span style={ui.fieldLabel}>Note for the cash office (optional)</span>
          <input style={ui.input} value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <button
          type="button"
          style={{ ...ui.primaryBtn, alignSelf: 'flex-start', opacity: total > 0 ? 1 : 0.5, cursor: total > 0 ? 'pointer' : 'not-allowed' }}
          disabled={total <= 0}
          onClick={submit}
        >
          Place order, {money(total)}
        </button>
        <p style={ui.muted}>
          Arrives with the next collection, {deliverDay === 1 ? 'tomorrow' : WEEKDAY[(now.getDay() + deliverDay) % 7]}.
        </p>
      </section>

      <Link href="/cash/history?view=change" style={{ alignSelf: 'flex-start', color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 13 }}>
        Past orders are in History
      </Link>
    </div>
  );
}
