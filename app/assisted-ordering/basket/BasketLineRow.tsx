'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import s from './basket.module.css';
import { Badge, Button, DeleteIconButton, QuantityStepper, cx } from './ui';
import { REASONS, REASON_PROMPTS, editDirection, lastOrdersText, lineStatus, shortFrom, stockFigure } from './logic';
import { formatMoney, weekdayLong, weekdayShort } from './format';
import type { BasketLine, BasketOrder } from './types';
import type { LineReasons } from './useBasket';
import LineWhy from './LineWhy';

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

