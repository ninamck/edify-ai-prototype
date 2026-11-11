'use client';

import Link from 'next/link';
import s from './basket.module.css';
import { Button, cx } from './ui';
import { formatMoney, formatShortDate, plural } from './format';
import type { SentSummary } from './useBasket';

export default function OrdersSent({ summary, onAgain }: { summary: SentSummary; onAgain: () => void }) {
  const first = summary.deliveryDates[0];
  const last = summary.deliveryDates[summary.deliveryDates.length - 1];
  const meta = [
    `${summary.suppliers} ${plural(summary.suppliers, 'supplier', 'suppliers')}`,
    `${summary.lines} ${plural(summary.lines, 'line', 'lines')}`,
    formatMoney(summary.total),
    first ? `earliest delivery ${formatShortDate(first)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={s.scroll}>
      <div className={s.sentWrap}>
        <section className={cx(s.card, s.sentCard)} aria-labelledby="orders-sent">
          <h1 id="orders-sent" className={s.sentTitle}>Orders sent</h1>
          <p className={s.sentMeta}>{meta}</p>
          <ol className={s.timeline}>
            {summary.sent.length > 0 && (
              <li className={s.timelineItem}>
                <span className={cx(s.dot, s.dotOk)} aria-hidden />
                <div>
                  <div className={s.timelineTitle}>Sent to suppliers</div>
                  <div className={s.timelineMeta}>
                    Just now · {summary.sent.length} purchase {plural(summary.sent.length, 'order', 'orders')} to {summary.sent.join(', ')}
                  </div>
                </div>
              </li>
            )}
            {summary.awaitingApproval.length > 0 && (
              <li className={s.timelineItem}>
                <span className={cx(s.dot, s.dotWarn)} aria-hidden />
                <div>
                  <div className={s.timelineTitle}>Sent for approval</div>
                  <div className={s.timelineMeta}>
                    {summary.awaitingApproval.join(', ')} {plural(summary.awaitingApproval.length, 'waits', 'wait')} for an approver before going to the supplier
                  </div>
                </div>
              </li>
            )}
            {first && (
              <li className={s.timelineItem}>
                <span className={cx(s.dot, s.dotGrey)} aria-hidden />
                <div>
                  <div className={s.timelineTitle}>Delivery window</div>
                  <div className={s.timelineMeta}>
                    {first === last ? formatShortDate(first) : `${formatShortDate(first)} to ${formatShortDate(last)}`}
                  </div>
                </div>
              </li>
            )}
          </ol>
          <div className={s.sentActions}>
            <Link href="/" className={cx(s.btn, s.btnPrimary)}>Back to Home</Link>
            <Button onClick={onAgain}>Place another order</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
