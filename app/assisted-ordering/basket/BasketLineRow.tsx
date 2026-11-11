'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import s from './basket.module.css';
import { Badge, Button, DeleteIconButton, QuantityStepper, cx } from './ui';
import {
  REASONS, REASON_PROMPTS, editDirection, lastOrdersText, lineStatus, needOverWindow, orderFigure,
  runsOutOn, sameUnits, shortFrom, stockFigure, usualOrder,
} from './logic';
import { daysBetween, formatDayLabel, formatMoney, formatShortDate, formatTime, isoDate, parseIsoDate, trimNumber, weekdayLong, weekdayShort } from './format';
import type { BasketLine, BasketOrder } from './types';
import type { LineReasons } from './useBasket';

type RowProps = {
  line: BasketLine;
  order: BasketOrder & { deliveryDate: string | null };
  quantity: number;
  removed: boolean;
  stopped: boolean;
  reasons: LineReasons | undefined;
  today: string;
  siteName: string;
  onQuantity: (next: number) => void;
  onRemove: () => void;
  onUndo: () => void;
  onStop: () => void;
  onReasons: (value: LineReasons) => void;
};

export default function BasketLineRow(props: RowProps) {
  const { line, order, quantity, removed, stopped, reasons, today, siteName } = props;
  const [open, setOpen] = useState(false);
  const detailId = `why-${line.id}`;

  if (stopped) {
    return (
      <li className={s.lineItem}>
        <div className={s.removedRow}>
          <div className={s.removedName}>
            <span>{line.name}</span>
            <Badge tone="muted">Not suggested at {siteName}</Badge>
          </div>
          <Button size="sm" onClick={props.onUndo}>Undo</Button>
        </div>
      </li>
    );
  }

  if (removed) {
    const weekday = weekdayLong(today);
    return (
      <li className={s.lineItem}>
        <div className={s.removedRow}>
          <div style={{ minWidth: 0 }}>
            <div className={s.removedName}>
              <span>{line.name}</span>
              <Badge tone="muted">Removed</Badge>
            </div>
            {line.recentRemovals && (
              <p className={s.removedNote}>
                You&apos;ve also removed it {line.recentRemovals.removed} of the last {line.recentRemovals.of} {weekday}s.
              </p>
            )}
            {!line.addedByYou && (
              <EditReasonPrompt kind="removed" value={reasons} onChange={props.onReasons} inline />
            )}
            {!line.addedByYou && (
              <div className={s.removedActions}>
                <button type="button" className={s.textLink} onClick={props.onStop}>Stop suggesting at {siteName}</button>
              </div>
            )}
          </div>
          <Button size="sm" onClick={props.onUndo}>Undo</Button>
        </div>
      </li>
    );
  }

  const status = lineStatus(line, quantity, order.deliveryDate, today);
  const short = shortFrom(line, quantity, order.deliveryDate);
  const direction = editDirection(line, quantity);
  const subtotal = quantity * line.unitPrice;
  const pills: string[] = [];
  if (line.addedByYou) pills.push('Added by you');
  if (line.forMinimum && quantity === line.suggested) pills.push('For minimum');

  return (
    <li className={s.lineItem}>
      <div className={s.row}>
        <div className={s.product}>
          <button
            type="button"
            className={s.productToggle}
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown size={16} aria-hidden />
            <span className={s.productName}>{line.name}</span>
          </button>
          <div className={s.subRow}>
            <span>{line.orderUnit[0].toUpperCase() + line.orderUnit.slice(1)} · {formatMoney(line.unitPrice, order.currency)}</span>
            {pills.map((pill) => <Badge key={pill}>{pill}</Badge>)}
            {status?.kind === 'badge' && <Badge tone="warn">{status.text}</Badge>}
            {status?.kind === 'strong' && <span className={s.statusStrong}>{status.text}</span>}
            {status?.kind === 'quiet' && <span>{status.text}</span>}
            {short && (
              <Badge tone="warn">
                Short from {weekdayShort(short)} ·{' '}
                <button type="button" className={s.inlineLink} style={{ fontWeight: 700, fontSize: 11 }} onClick={() => props.onQuantity(line.suggested)}>
                  undo
                </button>
              </Badge>
            )}
          </div>
        </div>
        <div className={cx(s.cell, s.hideMobile)}>
          {line.onHand === null ? (
            <><span aria-hidden>–</span><span className={s.srOnly}>Not known</span></>
          ) : stockFigure(line.onHand, line)}
        </div>
        <div className={cx(s.cellMuted, s.hideMobile)}>{lastOrdersText(line)}</div>
        <div className={s.orderCell}>
          <QuantityStepper value={quantity} onChange={props.onQuantity} label={line.name} warn={!!short} />
          <DeleteIconButton label={`Remove ${line.name}`} onClick={props.onRemove} />
        </div>
        <div className={s.subtotal}>
          <span className={s.srOnly}>{line.name} subtotal: </span>
          {formatMoney(subtotal, order.currency)}
        </div>
      </div>

      {direction && (
        <div className={s.reasons}>
          <EditReasonPrompt kind={direction} value={reasons} onChange={props.onReasons} />
        </div>
      )}

      {open && <LineWhy id={detailId} line={line} order={order} quantity={quantity} today={today} />}
    </li>
  );
}

export function EditReasonPrompt({
  kind,
  value,
  onChange,
  inline,
}: {
  kind: keyof typeof REASONS;
  value: LineReasons | undefined;
  onChange: (value: LineReasons) => void;
  inline?: boolean;
}) {
  const picked = value?.picked ?? [];
  const [otherOpen, setOtherOpen] = useState(!!value?.other);
  const [draft, setDraft] = useState(value?.other ?? '');

  const toggle = (reason: string) => {
    const next = picked.includes(reason) ? picked.filter((r) => r !== reason) : [...picked, reason];
    onChange({ picked: next, other: value?.other });
  };

  return (
    <div className={inline ? cx(s.reasons, s.reasonsInline) : undefined}>
      <p className={s.reasonsPrompt}>{REASON_PROMPTS[kind]}</p>
      <div className={s.chips} role="group" aria-label={REASON_PROMPTS[kind]}>
        {REASONS[kind].map((reason) => {
          const on = picked.includes(reason);
          return (
            <button key={reason} type="button" className={cx(s.chip, on && s.chipOn)} aria-pressed={on} onClick={() => toggle(reason)}>
              {reason}
            </button>
          );
        })}
        <button
          type="button"
          className={cx(s.chip, (otherOpen || !!value?.other) && s.chipOn)}
          aria-pressed={otherOpen || !!value?.other}
          onClick={() => setOtherOpen((v) => !v)}
        >
          Other
        </button>
      </div>
      {otherOpen && (
        <form
          className={s.otherRow}
          onSubmit={(e) => {
            e.preventDefault();
            onChange({ picked, other: draft.trim() || undefined });
            if (!draft.trim()) setOtherOpen(false);
          }}
        >
          <input
            className={s.input}
            value={draft}
            maxLength={200}
            placeholder="Tell us why"
            aria-label="Tell us why"
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" size="sm" variant="primary" style={{ height: 36 }}>
            {value?.other && value.other === draft.trim() ? 'Saved' : 'Save'}
          </Button>
        </form>
      )}
    </div>
  );
}

function barHeight(quantity: number, max: number): string {
  if (max <= 0) return '4px';
  return `${Math.max(8, Math.round((quantity / max) * 100))}%`;
}

function figuresFor(line: BasketLine, single: number) {
  const packs = single / line.packSize;
  const packText = `${trimNumber(packs)} ${packs === 1 ? line.orderUnit : line.orderUnitPlural}`;
  return sameUnits(line) ? { main: packText, sub: null } : { main: packText, sub: stockFigure(single, line) };
}

function LineWhy({
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
  const max = Math.max(...line.forecast.map((d) => d.quantity), 0);
  const weekday = weekdayLong(today);
  const runsOut = runsOutOn(line, order.deliveryDate);
  const usual = usualOrder(line);
  const asOf = new Date(line.stockAsOf);
  const stockTitle = line.stockSource === 'live'
    ? `Live stock, today ${formatTime(asOf)}`
    : `Last counted ${formatShortDate(isoDate(asOf))}`;
  const hasStockStory = line.incoming.length > 0 || line.overdue.length > 0 || !!runsOut || line.stockWeak || line.onHand === null;
  const need = needOverWindow(line);

  const notes: ReactNode[] = [];
  if (line.rule) {
    notes.push(
      <>Your rule <strong>&ldquo;{line.rule.name}&rdquo;</strong> changed this from {orderFigure(line.rule.from, line)} to {orderFigure(line.rule.to, line)}. Set by {line.rule.setBy}.</>,
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

  const stockBox = hasStockStory && (
    <div className={s.whyBox}>
      <h3 className={s.whyTitle}>Stock</h3>
      <div className={s.stockLines}>
        <span><strong>{line.onHand === null ? 'Not known' : stockFigure(line.onHand, line)}</strong> · {line.onHand === null ? 'Nobody has counted this yet' : stockTitle}</span>
        {line.stockWeak && <span>That count is {daysBetween(isoDate(asOf), today)} days old, so stock may be different now.</span>}
        {line.incoming.map((d) => (
          <span key={d.date}><strong>+ {stockFigure(d.quantity, line)} arriving {weekdayShort(d.date)}</strong> · from {weekdayShort(d.orderedOn)}&apos;s order</span>
        ))}
        {line.overdue.map((d) => (
          <span key={d.date}><strong>{stockFigure(d.quantity, line)} due {weekdayShort(d.date)} has not arrived</strong> · from {weekdayShort(d.orderedOn)}&apos;s order</span>
        ))}
        {runsOut && order.deliveryDate && (
          <span>Runs out {runsOut === today ? 'today' : weekdayShort(runsOut)}, before this order arrives {weekdayShort(order.deliveryDate)}.</span>
        )}
        <span className={s.stockLinks}>
          {line.overdue.length > 0 && <Link className={s.textLink} href="/receive">Chase it</Link>}
          {(line.stockWeak || line.onHand === null || runsOut) && <Link className={s.textLink} href="/stock">Count it</Link>}
        </span>
      </div>
    </div>
  );

  const historyBox = (
    <div className={s.whyBox}>
      <h3 className={s.whyTitle}>Ordered, last 4 {weekday}s</h3>
      <div className={s.history}>
        {line.lastOrders.map((o) => (
          <div key={o.date}>
            <div className={s.historyDate}>{parseIsoDate(o.date).getDate()} {formatShortDate(o.date).split(' ')[2]}</div>
            <div className={s.historyValue}>{o.quantity === 0 ? 'None' : trimNumber(o.quantity)}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div id={id} className={s.why}>
      <div className={s.desktopWhy}>
        {line.forecast.length > 0 && (
          <div className={s.whyBox}>
            <h3 className={s.whyTitle}>Expected use each day</h3>
            <div className={s.bars}>
              {line.forecast.map((day) => {
                const changed = Math.abs(day.quantity - day.usual) / Math.max(day.usual, 0.0001) >= 0.1;
                const figures = figuresFor(line, day.quantity);
                return (
                  <div key={day.date} className={s.barCol}>
                    <div className={s.barArea} aria-hidden>
                      <div
                        className={cx(s.bar, day.date === today && s.barToday, changed && day.date !== today && s.barChanged)}
                        style={{ height: barHeight(day.quantity, max) }}
                      />
                    </div>
                    <div className={s.barLabel}>{formatDayLabel(day.date, today)}</div>
                    <div className={s.barValue}>{figures.main}</div>
                    {figures.sub && <div className={s.barSub}>{figures.sub}</div>}
                    {changed && <div className={s.barSub}>usually {figuresFor(line, day.usual).main}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {stockBox ? <div className={s.whyPair}>{stockBox}{historyBox}</div> : historyBox}
      </div>

      <div className={s.mobileWhy}>
        <div className={s.glance}>
          <div className={s.glanceBox}>
            <div className={s.glanceLabel}>On hand</div>
            <div className={s.glanceValue}>{line.onHand === null ? 'Not known' : stockFigure(line.onHand, line)}</div>
          </div>
          <div className={s.glanceBox}>
            <div className={s.glanceLabel}>Need</div>
            <div className={s.glanceValue}>{line.forecast.length ? stockFigure(need, line) : 'Not known'}</div>
          </div>
          <div className={s.glanceBox}>
            <div className={s.glanceLabel}>Last 4 {weekdayShort(today)}</div>
            <div className={s.glanceValue}>{lastOrdersText(line)}</div>
          </div>
        </div>
        {stockBox}
        {line.forecast.length > 0 && (
          <>
            {showDays && (
              <ul className={s.dayRows} aria-label="Expected use each day">
                {line.forecast.map((day) => (
                  <li key={day.date} className={s.dayRow}>
                    <span style={{ fontWeight: 600 }}>{formatDayLabel(day.date, today)}</span>
                    <span>{figuresFor(line, day.quantity).main}</span>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <button type="button" className={s.textLink} onClick={() => setShowDays((v) => !v)} aria-expanded={showDays}>
                {showDays ? 'Hide each day' : 'See each day'}
              </button>
            </div>
          </>
        )}
      </div>

      {notes.map((note, index) => (
        <p key={index} className={s.whyNote}>{note}</p>
      ))}
    </div>
  );
}
