'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import s from './basket.module.css';
import { cx } from './ui';
import { formatMoney, formatShortDate, formatTime, isoDate, trimNumber, weekdayLong, weekdayShort } from './format';
import { lastOrdersText, needOverWindow, orderFigure, runsOutOn, sameUnits, stockFigure, usualOrder } from './logic';
import type { BasketLine, BasketOrder, UseDay } from './types';

type Layout = 'columns' | 'rows';

function WhyBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.whyBox}>
      <h3 className={s.whyTitle}>{title}</h3>
      <div className={s.whyBody}>{children}</div>
    </section>
  );
}

function dayLabel(date: string, today: string): string {
  return date === today ? 'Today' : `${weekdayShort(date)} ${Number(date.slice(8, 10))}`;
}

function differsFromUsual(day: UseDay): boolean {
  return day.usual > 0 && Math.abs(day.quantity - day.usual) / day.usual >= 0.1;
}

function barClass(day: UseDay, today: string): string {
  if (day.date === today) return cx(s.bar, s.barToday);
  return cx(s.bar, differsFromUsual(day) && s.barChanged);
}

/** "0.6 bags" from stock units. */
function packFigure(line: BasketLine, single: number): string {
  return orderFigure(Math.round((single / line.packSize) * 10) / 10, line);
}

/** "9.6 kg", or nothing when the pack and stock units say the same thing. */
function stockAside(line: BasketLine, single: number): string | null {
  return sameUnits(line) ? null : stockFigure(single, line);
}

function UsualNote({ line, day }: { line: BasketLine; day: UseDay }) {
  if (!differsFromUsual(day)) return null;
  return <span className={s.barUsual}>usually {packFigure(line, day.usual)}</span>;
}

function ForecastDays({ line, today, layout }: { line: BasketLine; today: string; layout: Layout }) {
  const busiest = Math.max(...line.forecast.map((d) => d.quantity));
  const scale = (day: UseDay) => (busiest > 0 ? Math.max(6, (day.quantity / busiest) * 100) : 6);

  if (layout === 'rows') {
    return (
      <ul className={s.dayRows}>
        {line.forecast.map((day) => {
          const aside = stockAside(line, day.quantity);
          return (
            <li key={day.date} className={s.dayRow}>
              <span className={s.barLabel}>{dayLabel(day.date, today)}</span>
              <span aria-hidden className={s.dayRowTrack}>
                <span className={cx(barClass(day, today), s.barRow)} style={{ width: `${scale(day)}%` }} />
              </span>
              <span className={s.dayRowValue}>
                <span className={s.barValue}>{packFigure(line, day.quantity)}</span>
                {aside && ` · ${aside}`}
              </span>
              {differsFromUsual(day) && (
                <span className={s.dayRowUsual}><UsualNote line={line} day={day} /></span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className={s.bars}>
      {line.forecast.map((day) => {
        const aside = stockAside(line, day.quantity);
        return (
          <li key={day.date} className={s.barCol}>
            <span aria-hidden className={s.barArea}>
              <span className={barClass(day, today)} style={{ height: `${scale(day)}%` }} />
            </span>
            <span className={s.barLabel}>{dayLabel(day.date, today)}</span>
            <span className={s.barValue}>{packFigure(line, day.quantity)}</span>
            {aside && <span className={s.barSub}>{aside}</span>}
            <UsualNote line={line} day={day} />
          </li>
        );
      })}
    </ul>
  );
}

const dayAndDate = formatShortDate;

function OrderedRows({ line, across }: { line: BasketLine; across: boolean }) {
  const amount = (quantity: number) => (quantity === 0 ? 'None' : orderFigure(quantity, line));
  if (across) {
    return (
      <ul className={s.historyAcross}>
        {line.lastOrders.map((o) => (
          <li key={o.date} className={s.historyCell}>
            <span className={s.nowrap}>{dayAndDate(o.date)}</span>
            <span className={s.historyValue}>{amount(o.quantity)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={s.historyRows}>
      {line.lastOrders.map((o) => (
        <li key={o.date} className={s.historyRow}>
          <span className={s.nowrap}>{dayAndDate(o.date)}</span>
          <span className={s.historyRowValue}>{amount(o.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}

function readAt(asOf: Date, today: string): string {
  const day = isoDate(asOf);
  return day === today ? `today ${formatTime(asOf)}` : formatShortDate(day);
}

function OnHandDetail({ line, deliveryDate, today }: { line: BasketLine; deliveryDate: string | null; today: string }) {
  const runsOut = runsOutOn(line, deliveryDate);
  const asOf = new Date(line.stockAsOf);
  return (
    <>
      {line.onHand === null ? (
        <p className={s.whyP}>
          No recent count, so we guessed. <Link href="/stock" className={s.actionLink}>Count it</Link>
        </p>
      ) : (
        <p className={s.whyP}>
          {line.stockSource === 'live' ? 'Live stock' : 'Stocktake'}, {readAt(asOf, today)}
          {line.stockWeak && (
            <>. <Link href="/stock" className={s.actionLink}>Count again</Link></>
          )}
        </p>
      )}
      {line.incoming.map((d) => (
        <p key={`in-${d.date}`} className={s.whyP}>
          <span className={s.keyFact}>+ {stockFigure(d.quantity, line)} arriving {weekdayShort(d.date)}</span>{' '}
          · from {weekdayShort(d.orderedOn)}&apos;s order
        </p>
      ))}
      {line.overdue.map((d) => (
        <p key={`late-${d.date}`} className={s.whyP}>
          <span className={s.keyFact}>{stockFigure(d.quantity, line)} due {weekdayShort(d.date)}, not arrived</span>{' '}
          · from {weekdayShort(d.orderedOn)}&apos;s order.{' '}
          <Link href="/receive" className={s.actionLink}>Chase it</Link>
        </p>
      ))}
      {runsOut && deliveryDate && (
        <p className={cx(s.whyP, s.keyText)}>
          Runs out {runsOut === today ? 'today' : weekdayShort(runsOut)} at the forecast rate, before this order arrives {weekdayShort(deliveryDate)}.
        </p>
      )}
    </>
  );
}

function hasStockToAct(line: BasketLine, deliveryDate: string | null): boolean {
  return line.incoming.length > 0 || line.overdue.length > 0 || line.stockWeak || line.onHand === null || !!runsOutOn(line, deliveryDate);
}

function EachDayWhy({
  line,
  deliveryDate,
  today,
  layout,
}: {
  line: BasketLine;
  deliveryDate: string | null;
  today: string;
  layout: Layout;
}) {
  const ordered = line.lastOrders.length > 0;
  const stock = hasStockToAct(line, deliveryDate);
  const alone = layout === 'columns' && stock !== ordered;
  return (
    <div className={s.eachDay}>
      {line.forecast.length > 0 && (
        <WhyBox title="Expected use each day">
          <ForecastDays line={line} today={today} layout={layout} />
        </WhyBox>
      )}
      <div className={cx(s.whyPair, layout === 'columns' && !alone && s.whyPairTwo)}>
        {stock && (
          <WhyBox title="Stock">
            <OnHandDetail line={line} deliveryDate={deliveryDate} today={today} />
          </WhyBox>
        )}
        {ordered && (
          <WhyBox title={`Ordered, last 4 ${weekdayLong(today)}s`}>
            <OrderedRows line={line} across={alone} />
          </WhyBox>
        )}
      </div>
    </div>
  );
}

export default function LineWhy({
  id,
  line,
  order,
  quantity,
  today,
}: {
  id: string;
  line: BasketLine;
  order: BasketOrder & { deliveryDate: string | null };
  quantity: number;
  today: string;
}) {
  const [showDays, setShowDays] = useState(false);
  const usual = usualOrder(line);

  const notes: ReactNode[] = [];
  if (line.rule) {
    notes.push(
      <>Your rule &ldquo;{line.rule.name}&rdquo; changed this from {orderFigure(line.rule.from, line)} to {orderFigure(line.rule.to, line)}. Set by {line.rule.setBy}.</>,
    );
  }
  if (line.forMinimum) {
    notes.push(<>Added to reach {order.supplierName}&apos;s {formatMoney(order.minimum, order.currency)} minimum.</>);
  }
  if (line.priceUp) {
    const before = line.unitPrice / (1 + line.priceUp / 100);
    notes.push(<>Price up {line.priceUp}% since your last order, from {formatMoney(before, order.currency)} to {formatMoney(line.unitPrice, order.currency)}.</>);
  }
  if (usual && !line.forMinimum && quantity >= usual * 3) {
    notes.push(<>That&apos;s {trimNumber(quantity / usual)} times your usual order of {orderFigure(Math.round(usual), line)}. Check it before you send.</>);
  }
  if (line.lastChangedBy) notes.push(<>Last changed by {line.lastChangedBy}.</>);

  return (
    <div id={id} className={s.why}>
      <div className={s.desktopWhy}>
        <EachDayWhy line={line} deliveryDate={order.deliveryDate} today={today} layout="columns" />
      </div>

      <div className={s.mobileWhy}>
        <div className={s.glance}>
          <div className={s.glanceBox}>
            <div className={s.glanceLabel}>On hand</div>
            <div className={s.glanceValue}>{line.onHand === null ? 'Not known' : stockFigure(line.onHand, line)}</div>
          </div>
          <div className={s.glanceBox}>
            <div className={s.glanceLabel}>Need</div>
            <div className={s.glanceValue}>{line.forecast.length ? stockFigure(needOverWindow(line), line) : 'Not known'}</div>
          </div>
          <div className={s.glanceBox}>
            <div className={s.glanceLabel}>Last 4 {weekdayShort(today)}</div>
            <div className={s.glanceValue}>{lastOrdersText(line)}</div>
          </div>
        </div>
        {showDays && <EachDayWhy line={line} deliveryDate={order.deliveryDate} today={today} layout="rows" />}
        <div>
          <button type="button" className={s.textLink} onClick={() => setShowDays((v) => !v)} aria-expanded={showDays}>
            {showDays ? 'Hide each day' : 'See each day'}
          </button>
        </div>
      </div>

      {notes.map((note, index) => (
        <p key={index} className={s.whyNote}>{note}</p>
      ))}
    </div>
  );
}
