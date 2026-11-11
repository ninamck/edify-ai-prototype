'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown, StickyNote } from 'lucide-react';
import s from './basket.module.css';
import { Badge, Button, Dialog, useDismiss } from './ui';
import { cutOffUrgency, formatCutOffLabel, formatLongDate, formatMoney, formatShortDate, weekdayShort } from './format';
import { lineStatus, orderFigure, shortFrom } from './logic';
import { APPROVAL_LIMIT, deliveryOptions } from './fixtures';
import { CardHeader, MovMeter } from './SupplierCard';
import SendPanel from './SendPanel';
import type { ActiveOrder, BasketState } from './useBasket';
import type { SupplierSummary } from './types';

function orderProblem(order: ActiveOrder, now: Date): string | null {
  if (!order.deliveryDate) return 'Choose a delivery date.';
  if (order.cutOffAt && cutOffUrgency(order.cutOffAt, now) === 'passed') return 'Past the cut-off. Pick a later date.';
  return null;
}

function DatePicker({
  order,
  supplier,
  today,
  now,
  onChange,
}: {
  order: ActiveOrder;
  supplier: SupplierSummary;
  today: string;
  now: Date;
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const options = deliveryOptions(supplier, today, 8).filter((o) => o.cutOffAt.getTime() > now.getTime()).slice(0, 6);
  return (
    <div ref={ref} className={s.dateWrap}>
      <Button size="sm" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`Delivery date for ${order.supplierName}`}>
        <CalendarDays size={14} aria-hidden />
        {order.deliveryDate ? formatLongDate(order.deliveryDate) : 'Choose a date'}
        <ChevronDown size={14} aria-hidden />
      </Button>
      {open && (
        <ul className={s.menu} role="menu">
          {options.map((option) => (
            <li key={option.date} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option.date === order.deliveryDate}
                className={s.menuItem}
                onClick={() => {
                  onChange(option.date);
                  setOpen(false);
                }}
              >
                <span>{formatShortDate(option.date)}</span>
                <span>Cut-off {formatCutOffLabel(option.cutOffAt, now)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function leadText(supplier: SupplierSummary): string {
  const [hours, minutes] = supplier.cutOffTime.split(':').map(Number);
  const clock = new Date(2026, 0, 1, hours, minutes);
  const time = formatCutOffLabel(clock, clock).replace(' today', '');
  if (supplier.leadTimeDays === 0) return `Order by ${time} on the day`;
  if (supplier.leadTimeDays === 1) return `Order by ${time} the day before`;
  return `Order by ${time}, ${supplier.leadTimeDays} days before`;
}

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_LONG: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

function CheckoutCard({ order, basket, now }: { order: ActiveOrder; basket: BasketState; now: Date }) {
  const { fixtures } = basket;
  const supplier = fixtures.suppliers.find((sup) => sup.id === order.supplierId)!;
  const [noteOpen, setNoteOpen] = useState(!!basket.notes[order.id]);
  const [cutOffsOpen, setCutOffsOpen] = useState(false);
  const problem = orderProblem(order, now);
  const noteId = `note-${order.id}`;

  return (
    <section className={s.card} aria-label={order.supplierName}>
      <CardHeader order={order} now={now} />
      <MovMeter order={order} />
      <table className={s.checkoutTable}>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Qty</th>
            <th scope="col" className={s.right}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {order.activeLines.map((line) => {
            const quantity = basket.quantities[line.id] ?? 0;
            return (
              <tr key={line.id}>
                <td style={{ fontWeight: 600 }}>{line.name}</td>
                <td>{orderFigure(quantity, line)}</td>
                <td className={s.right} style={{ fontWeight: 700 }}>{formatMoney(quantity * line.unitPrice, order.currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={s.cardFooter}>
        <div className={s.footerButtons}>
          <DatePicker
            order={order}
            supplier={supplier}
            today={fixtures.today}
            now={now}
            onChange={(date) => basket.setDeliveryDate(order.id, date)}
          />
          <Button size="sm" onClick={() => setCutOffsOpen(true)}>Cut-off times</Button>
          {!noteOpen && (
            <Button size="sm" variant="ghost" onClick={() => setNoteOpen(true)}>
              <StickyNote size={14} aria-hidden /> Add note
            </Button>
          )}
        </div>
        {problem && <p className={s.problem}>{problem}</p>}
        {order.needsApproval && (
          <p className={s.help}>Orders over {formatMoney(APPROVAL_LIMIT)} go to an approver before they reach {order.supplierName}.</p>
        )}
        {noteOpen && (
          <div className={s.noteField}>
            <label htmlFor={noteId} className={s.label}>Note for {order.supplierName}</label>
            <textarea
              id={noteId}
              className={s.textarea}
              value={basket.notes[order.id] ?? ''}
              maxLength={500}
              autoFocus={!basket.notes[order.id]}
              onChange={(e) => basket.setNote(order.id, e.target.value)}
            />
            <p className={s.help}>Any notes here will be included in the order to the supplier.</p>
          </div>
        )}
      </div>

      <Dialog open={cutOffsOpen} onClose={() => setCutOffsOpen(false)} title={`${order.supplierName} cut-off times`}>
        <p className={s.dialogBody}>{leadText(supplier)}.</p>
        <ul className={s.schedule}>
          {WEEK.map((day) => (
            <li key={day} className={s.scheduleRow}>
              <span style={{ fontWeight: 600 }}>{WEEK_LONG[day]}</span>
              <span style={{ color: 'var(--muted)' }}>{supplier.deliveryDays.includes(day) ? 'Delivers' : 'No deliveries'}</span>
            </li>
          ))}
        </ul>
        <div className={s.dialogActions}>
          <Button variant="primary" onClick={() => setCutOffsOpen(false)}>Done</Button>
        </div>
      </Dialog>
    </section>
  );
}

type Flag = { key: string; name: string; supplier: string; text: string };

function flagsFor(orders: ActiveOrder[], basket: BasketState): Flag[] {
  const flags: Flag[] = [];
  for (const order of orders) {
    if (order.minimum > 0 && order.total < order.minimum) {
      flags.push({ key: `${order.id}-min`, name: 'Whole order', supplier: order.supplierName, text: 'Under minimum' });
    }
    for (const line of order.activeLines) {
      const quantity = basket.quantities[line.id] ?? 0;
      const status = lineStatus(line, quantity, order.deliveryDate, basket.fixtures.today);
      const short = shortFrom(line, quantity, order.deliveryDate);
      if (status && (status.text.endsWith('usual order') || status.text.startsWith('Price up'))) {
        flags.push({ key: line.id, name: line.name, supplier: order.supplierName, text: status.text });
      } else if (short) {
        flags.push({ key: line.id, name: line.name, supplier: order.supplierName, text: `Short from ${weekdayShort(short)}` });
      }
    }
  }
  return flags;
}

export default function Checkout({ basket, now }: { basket: BasketState; now: Date }) {
  const { ordersWithLines, basketTotal } = basket;
  const [confirming, setConfirming] = useState(false);
  const blocked = ordersWithLines.some((o) => orderProblem(o, now) !== null);
  const flags = flagsFor(ordersWithLines, basket);
  const sendLabel = `Send ${ordersWithLines.length} ${ordersWithLines.length === 1 ? 'order' : 'orders'}`;

  return (
    <>
      <div className={s.scroll}>
        <div className={s.page}>
          <header>
            <h1 className={s.title}>Checkout</h1>
            <p className={s.subTitle}>Check when each order arrives and add a note for the supplier, then send.</p>
          </header>
          <div className={s.grid}>
            <div className={s.stack}>
              {ordersWithLines.map((order) => (
                <CheckoutCard key={order.id} order={order} basket={basket} now={now} />
              ))}
            </div>
            <SendPanel
              orders={ordersWithLines}
              total={basketTotal}
              checkout
              blocked={blocked}
              onSend={() => setConfirming(true)}
              onBack={() => basket.setStep('basket')}
            />
          </div>
        </div>
      </div>

      <div className={`${s.actionBar} ${s.desktopHidden}`}>
        <div className={s.barInner}>
          <Button onClick={() => basket.setStep('basket')}>Back to basket</Button>
          <div className={s.barTotal}>
            Total <strong>{formatMoney(basketTotal)}</strong>
          </div>
          <Button variant="primary" className={s.barPrimary} onClick={() => setConfirming(true)} disabled={blocked}>{sendLabel}</Button>
        </div>
      </div>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Place these orders?">
        <p className={s.dialogBody}>Once placed, an order can&apos;t be adjusted.</p>
        {flags.length > 0 && (
          <>
            <h3 className={s.flaggedTitle}>Check before sending</h3>
            <ul className={s.flagged}>
              {flags.map((flag) => (
                <li key={flag.key} className={s.flaggedItem}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{flag.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{flag.supplier}</div>
                  </div>
                  <Badge tone="warn">{flag.text}</Badge>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className={s.dialogActions}>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              setConfirming(false);
              basket.placeOrders();
            }}
          >
            Place orders
          </Button>
        </div>
      </Dialog>
    </>
  );
}
