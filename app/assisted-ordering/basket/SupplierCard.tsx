'use client';

import { useState, type ReactNode } from 'react';
import { Clock, Plus, TriangleAlert } from 'lucide-react';
import s from './basket.module.css';
import { Badge, Button } from './ui';
import { cutOffUrgency, formatCutOffLabel, formatMoney, formatShortDate, formatSupplierMoney } from './format';
import { deliveryNote } from './logic';
import { ProductSearch } from './ProductSearch';
import type { ActiveOrder, BasketState } from './useBasket';
import BasketLineRow from './BasketLineRow';

export function CutOffMeta({ order, now }: { order: ActiveOrder; now: Date }) {
  if (!order.cutOffAt) return null;
  const urgency = cutOffUrgency(order.cutOffAt, now);
  const label = formatCutOffLabel(order.cutOffAt, now);
  if (urgency === 'passed') {
    return <Badge tone="warn"><TriangleAlert size={12} aria-hidden /> Cut-off passed {label}</Badge>;
  }
  if (urgency === 'urgent') {
    return <Badge tone="warn"><Clock size={12} aria-hidden /> Cut-off {label}</Badge>;
  }
  return (
    <span className={s.cardMetaItem}>
      <Clock size={13} aria-hidden /> Cut-off {label}
    </span>
  );
}

export function CardHeader({ order, now, action }: { order: ActiveOrder; now: Date; action?: ReactNode }) {
  const urgency = order.cutOffAt ? cutOffUrgency(order.cutOffAt, now) : 'normal';
  const moved = deliveryNote(order);
  return (
    <div className={s.cardHeader}>
      <div style={{ minWidth: 0 }}>
        <h2 className={s.cardName}>{order.supplierName}</h2>
        <div className={s.cardMeta}>
          <CutOffMeta order={order} now={now} />
          {order.deliveryDate ? (
            <span>
              {order.cutOffAt && urgency === 'normal' && '· '}Arrives {formatShortDate(order.deliveryDate)}
              {order.dateEstimated && ' (estimated)'}
            </span>
          ) : (
            <span>No delivery date yet</span>
          )}
          {order.builtByYou && <span>· Built by you</span>}
        </div>
        {urgency === 'passed' && <div className={s.cardNote}>Pick a later delivery date at checkout.</div>}
        {moved && <div className={s.cardNoteQuiet}>{moved}</div>}
      </div>
      <div className={s.cardSide}>
        {action}
        <div className={s.cardTotal}>
          <span className={s.srOnly}>{order.supplierName} total: </span>
          {formatSupplierMoney(order.total, order.currency)}
        </div>
      </div>
    </div>
  );
}

export function MovMeter({ order }: { order: ActiveOrder }) {
  if (order.minimum <= 0) return null;
  const met = order.total >= order.minimum;
  const percent = Math.min(100, (order.total / order.minimum) * 100);
  return (
    <div className={s.meter}>
      <div
        className={s.meterTrack}
        role="progressbar"
        aria-label={`${order.supplierName} minimum order`}
        aria-valuemin={0}
        aria-valuemax={order.minimum}
        aria-valuenow={Math.round(order.total * 100) / 100}
      >
        <div className={s.meterFill} style={{ width: `${percent}%`, background: met ? 'var(--ok)' : 'var(--warn-fill)' }} />
      </div>
      <div className={s.meterText}>
        {met ? (
          <><span className={s.meterOk}>Minimum met</span> · minimum {formatMoney(order.minimum, order.currency)}</>
        ) : (
          <><span className={s.meterUnder}>{formatMoney(order.minimum - order.total, order.currency)} to reach minimum</span> · minimum {formatMoney(order.minimum, order.currency)}</>
        )}
      </div>
    </div>
  );
}

export default function SupplierCard({ order, basket, now }: { order: ActiveOrder; basket: BasketState; now: Date }) {
  const [adding, setAdding] = useState(false);
  const { fixtures } = basket;
  const products = fixtures.catalogue.filter((p) => p.supplierId === order.supplierId);

  return (
    <section className={s.card} aria-label={order.supplierName}>
      <CardHeader
        order={order}
        now={now}
        action={(
          <Button size="sm" onClick={() => setAdding((v) => !v)} aria-expanded={adding} aria-label={`Add from ${order.supplierName}`}>
            <Plus size={14} aria-hidden /> <span className={s.addLabel}>Add</span>
          </Button>
        )}
      />
      <MovMeter order={order} />

      {adding && (
        <div className={s.cardSearch}>
          <ProductSearch
            title={`Add from ${order.supplierName}`}
            placeholder={`Search ${order.supplierName}'s products`}
            products={products}
            suppliers={fixtures.suppliers}
            inBasket={basket.inBasket}
            onAdd={basket.addProduct}
            onClose={() => setAdding(false)}
            showAllWhenEmpty
            autoFocus
          />
        </div>
      )}

      <div className={s.cols} aria-hidden>
        <span>Product</span>
        <span>On hand</span>
        <span>Last 4 orders</span>
        <span>Order</span>
        <span className={s.right}>Subtotal</span>
      </div>
      <ul className={s.lines}>
        {order.lines.map((line) => (
          <BasketLineRow
            key={line.id}
            line={line}
            order={order}
            quantity={basket.quantities[line.id] ?? 0}
            removed={basket.removed.has(line.id)}
            stopped={basket.stopped.has(line.id)}
            reasons={basket.reasons[line.id]}
            today={fixtures.today}
            siteName={fixtures.siteName}
            onQuantity={(next) => basket.setQuantity(line.id, next)}
            onRemove={() => basket.removeLine(order, line)}
            onUndo={() => basket.undoRemove(line)}
            onStop={() => basket.stopSuggesting(line)}
            onReasons={(value) => basket.setLineReasons(line.id, value)}
          />
        ))}
      </ul>
    </section>
  );
}
