'use client';

import { ArrowLeft } from 'lucide-react';
import s from './basket.module.css';
import { Button } from './ui';
import { formatMoney, toBase, weekdayShort } from './format';
import { linesLabel } from './logic';
import type { ActiveOrder } from './useBasket';

export default function SendPanel({
  orders,
  total,
  checkout,
  blocked,
  onSend,
  onBack,
}: {
  orders: ActiveOrder[];
  total: number;
  checkout?: boolean;
  blocked?: boolean;
  onSend?: () => void;
  onBack?: () => void;
}) {
  return (
    <aside className={s.rail} aria-label={checkout ? 'Ready to send' : 'Your basket'}>
      <div className={s.panel}>
        <h2 className={s.panelTitle}>{checkout ? 'Ready to send' : 'Your basket'}</h2>
        {orders.length === 0 ? (
          <p className={s.panelEmpty}>Nothing in your basket yet.</p>
        ) : (
          <ul className={s.panelRows}>
            {orders.map((order) => (
              <li key={order.id}>
                <div className={s.panelRow}>
                  <span>{order.supplierName}</span>
                  <span style={{ whiteSpace: 'nowrap' }}>{formatMoney(toBase(order.total, order.currency))}</span>
                </div>
                <div className={s.panelMeta}>
                  {order.currency !== 'GBP' && `${formatMoney(order.total, order.currency)} · `}
                  {linesLabel(order.activeLines.length)}
                  {order.deliveryDate ? ` · Arrives ${weekdayShort(order.deliveryDate)}` : ' · No date yet'}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className={s.panelTotal}>
          <span className={s.panelTotalLabel}>Total</span>
          <span className={s.panelTotalValue}>{formatMoney(total)}</span>
        </div>
        {checkout && (
          <>
            <div className={s.panelActions}>
              <Button variant="cream" size="lg" onClick={onSend} disabled={blocked || orders.length === 0}>
                Send {orders.length} {orders.length === 1 ? 'order' : 'orders'}
              </Button>
              <Button variant="onDark" onClick={onBack}>
                <ArrowLeft size={14} aria-hidden /> Back to basket
              </Button>
            </div>
            {blocked && <p className={s.panelProblem} role="status">Fix the order marked above before sending.</p>}
          </>
        )}
      </div>
    </aside>
  );
}
