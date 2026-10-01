'use client';

/**
 * OrderRow — one email order in the list.
 *
 * Collapsed: source chip · ref · customer and site part · collection
 * time · items · value · status pill · chevron, with a muted "last
 * event" line so the row alone says what happened and when.
 *
 * Expanded: the lines table (what the email said, who it is for, what
 * till item it maps to), the order timeline, and a footer with the
 * actions that are valid for the order's state. Sending shows the
 * standard green success banner.
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarClock, Check, ChevronDown, ChevronRight, ChevronUp, Clock, Mail, ExternalLink, RefreshCw, Send,
} from 'lucide-react';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { TILL_SEND_TIME, type EmailOrder, type EmailOrderLine, type EmailOrderStatus } from './types';
import {
  applyAdded,
  formatClock,
  formatPlanDay,
  isForLaterDay,
  lastEvent,
  matchLine,
  retrySend,
  sendToPos,
  setRememberMatches,
  useEmailOrdersState,
} from './store';
import { usePrimaryPosConnection } from './posConnection';
import OrderTimeline from './OrderTimeline';
import PosItemPicker from './PosItemPicker';
import AmendmentDiff from './AmendmentDiff';

const STATUS: Record<EmailOrderStatus, { label: string; tone: StatusPillTone; icon?: React.ReactNode }> = {
  sent: { label: 'On the till', tone: 'success', icon: <Check size={10} strokeWidth={2.6} /> },
  scheduled: { label: 'On the plan', tone: 'info', icon: <CalendarClock size={10} strokeWidth={2.4} /> },
  review: { label: 'Needs review', tone: 'warning', icon: <AlertTriangle size={10} strokeWidth={2.4} /> },
  failed: { label: 'Failed to send', tone: 'error', icon: <AlertTriangle size={10} strokeWidth={2.4} /> },
  waiting: { label: 'Waiting for till', tone: 'info', icon: <Clock size={10} strokeWidth={2.4} /> },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export function orderValue(o: EmailOrder): number {
  return o.lines.reduce((n, l) => n + l.qty * l.unitPrice, 0);
}
export function orderItemCount(o: EmailOrder): number {
  return o.lines.reduce((n, l) => n + l.qty, 0);
}
const gbp = (n: number) => `\u00a3${n.toFixed(2)}`;
const shortDay = (iso: string) => formatPlanDay(iso).split(' ')[0];

export default function OrderRow({
  order,
  open,
  onToggle,
  first,
  last: lastInGroup,
}: {
  order: EmailOrder;
  open: boolean;
  onToggle: () => void;
  first: boolean;
  /** Last row in its day group: carries the bottom corner radius. */
  last: boolean;
}) {
  const { rememberMatches, orders } = useEmailOrdersState();
  // Held update that could not be applied automatically (fallback path).
  const original = order.amendsOrderId ? orders.find((o) => o.id === order.amendsOrderId) : undefined;
  const isAmendment = !!original;
  // Updates Edify applied itself. The GM is told, not asked.
  const amendments = order.amendments ?? [];
  const latestUpdate = amendments[amendments.length - 1];
  const addedLines = amendments.flatMap((a) => a.added);
  const pos = usePrimaryPosConnection();
  const posName = pos?.vendor ?? 'the till';
  const posLive = pos?.status === 'connected';
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const status = STATUS[order.status];
  const last = lastEvent(order);
  const items = orderItemCount(order);
  const value = orderValue(order);
  const unmatched = order.lines.filter((l) => !l.match || l.match.confidence === 'low').length;
  const canSend = order.status === 'review' && unmatched === 0;
  const isCancelled = order.status === 'cancelled';

  // One short line under the status pill: when it happened and the one
  // fact that matters for that state. The reason for a held order is
  // long, so it lives on the customer line instead (see below).
  const lastLine = useMemo(() => {
    if (!last) return '';
    const when = formatClock(last.at);
    switch (order.status) {
      case 'sent':
        return `${when} · ticket ${order.posTicketRef ?? ''}`.trim();
      case 'scheduled':
        return `till at ${TILL_SEND_TIME} ${shortDay(order.fulfilmentDate)}`;
      case 'review':
        return `${when} · waiting for you`;
      case 'failed':
        return `${when} · nothing on the till`;
      case 'waiting':
        return `${when} · queued`;
      case 'cancelled':
        return `${when} · voided ${order.posTicketRef ?? ''}`.trim();
    }
  }, [last, order]);

  function handleSend() {
    sendToPos(order.id, posName);
    setJustSent(true);
  }
  function handleRetry() {
    retrySend(order.id, posName, posLive);
    if (posLive) setJustSent(true);
  }

  // The group container keeps overflow visible so the till picker can
  // drop below a row, so the rounded corners are drawn here instead.
  const radius = 12;
  const cornerStyle: React.CSSProperties = {
    borderTopLeftRadius: first ? radius : 0,
    borderTopRightRadius: first ? radius : 0,
    borderBottomLeftRadius: lastInGroup ? radius : 0,
    borderBottomRightRadius: lastInGroup ? radius : 0,
  };

  return (
    <div
      style={{
        borderTop: first ? 'none' : '1px solid var(--color-border)',
        background: open ? '#FBFAF8' : '#fff',
        ...cornerStyle,
      }}
    >
      {/* ── Collapsed row ───────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
          padding: '14px 16px', cursor: 'pointer', fontFamily: 'var(--font-primary)',
          ...cornerStyle,
          ...(open ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : null),
          display: 'grid',
          gridTemplateColumns: '72px minmax(0, 1fr) 104px 150px 20px',
          alignItems: 'center', columnGap: 16,
          color: 'var(--color-text-primary)',
          opacity: isCancelled ? 0.6 : 1,
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Time first: rows are sorted by it, so it is the scanning anchor. */}
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
            {order.fulfilmentTime}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {order.fulfilmentKind === 'collection' ? 'Collect' : 'Deliver'}
          </div>
        </div>

        {/* Who, then where it came from. A held order shows its reason
            here because that is the thing the GM needs to read. */}
        <div style={{ minWidth: 0, lineHeight: 1.3 }}>
          <div
            style={{
              fontSize: 14, fontWeight: 600,
              textDecoration: isCancelled ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {order.customer}
            {order.sitePart && <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>, {order.sitePart}</span>}
            {latestUpdate && <UpdatedTag />}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {order.status === 'review' && order.reason ? (
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{order.reason}</span>
            ) : latestUpdate ? (
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                Updated {formatClock(latestUpdate.at)} · {describeAdded(latestUpdate.added)} added to the ticket
              </span>
            ) : (
              <>
                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.02em' }}>
                  {order.source === 'feedr' ? 'Feedr' : 'Email'}
                </span>
                {' · '}
                {order.ref}
              </>
            )}
          </div>
        </div>

        {/* Value with the item count under it. */}
        <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
          <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: isAmendment ? 'var(--color-success)' : undefined }}>
            {isAmendment && '+'}{gbp(value)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            {isAmendment && '+'}{items} {items === 1 ? 'item' : 'items'}
          </div>
        </div>

        {/* Status with when it happened under it. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <StatusPill tone={status.tone} icon={status.icon}>{status.label}</StatusPill>
          <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {lastLine}
          </span>
        </div>

        {open ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
      </button>

      {/* ── Expanded body ───────────────────────────────────── */}
      {open && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {justSent && (
            <div
              role="status"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)',
                color: 'var(--color-success)', fontSize: 13, fontWeight: 600,
              }}
            >
              <Check size={15} strokeWidth={2.6} />
              <span style={{ flex: 1 }}>
                {order.status === 'scheduled'
                  ? `Done. ${order.customer} is on the plan for ${formatPlanDay(order.fulfilmentDate)}. It goes to ${posName} at ${TILL_SEND_TIME} that morning so the sale counts on the day.`
                  : `Done. ${order.customer} is on ${posName}, ticket ${order.posTicketRef}, and on the plan for ${order.fulfilmentTime} ${order.fulfilmentKind}.`}
              </span>
            </div>
          )}

          {order.reason && order.status !== 'sent' && order.status !== 'scheduled' && (
            <div
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.45,
              }}
            >
              <EdifyMark size={14} color="var(--color-accent-active)" style={{ marginTop: 2, flexShrink: 0 }} />
              <span>
                {/[.!?]$/.test(order.reason) ? order.reason : `${order.reason}.`}
                {order.status === 'review' && unmatched > 0 && (
                  isForLaterDay(order)
                    ? ` Match it below and we\u2019ll put it on the plan. The till gets it at ${TILL_SEND_TIME} on ${shortDay(order.fulfilmentDate)}.`
                    : ' Match it below and we\u2019ll send the order.'
                )}
                {order.status === 'review' && isAmendment && original && (
                  ` It went to ${posName} at ${formatClock(original.events.find((e) => e.type === 'sent' || e.type === 'operator-sent')?.at ?? original.events[0].at)} with ${orderItemCount(original)} items. Confirm and we\u2019ll add the ${items} to it; nothing else on the ticket moves.`
                )}
              </span>
            </div>
          )}

          {/* Update Edify applied itself: say what changed, then show the ticket. */}
          {latestUpdate && (
            <div
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.45,
              }}
            >
              <EdifyMark size={14} color="var(--color-accent-active)" style={{ marginTop: 2, flexShrink: 0 }} />
              <span>{latestUpdate.summary}</span>
            </div>
          )}
          {latestUpdate && (
            <AmendmentDiff current={order.lines} added={addedLines} ticketRef={order.posTicketRef} applied />
          )}

          {/* Held update: the whole ticket as it will be once confirmed. */}
          {isAmendment && original && (
            <AmendmentDiff
              current={applyAdded(original.lines, order.lines)}
              added={order.lines}
              ticketRef={original.posTicketRef}
              applied={false}
            />
          )}

          {/* Lines. Hidden when a diff above already shows every line, unless something still needs matching. */}
          {((!isAmendment && !latestUpdate) || unmatched > 0) && (
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'visible' }}>
            <div style={{ ...lineGrid, padding: '9px 14px', borderBottom: '1px solid var(--color-border)', background: '#FBFAF8', borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
              <HeadCell align="right">Qty</HeadCell>
              <HeadCell>In the email</HeadCell>
              <HeadCell>For</HeadCell>
              <HeadCell align="right">Price</HeadCell>
              <HeadCell>On your till</HeadCell>
            </div>
            {order.lines.map((l, i) => (
              <LineRow
                key={l.id}
                line={l}
                last={i === order.lines.length - 1}
                editable={order.status === 'review'}
                pickerOpen={pickerFor === l.id}
                onOpenPicker={() => setPickerFor(pickerFor === l.id ? null : l.id)}
                onClosePicker={() => setPickerFor(null)}
                onPick={(pick) => { matchLine(order.id, l.id, pick); setPickerFor(null); }}
              />
            ))}
            <div style={{ ...lineGrid, padding: '9px 14px', borderTop: '1px solid var(--color-border)' }}>
              <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{items}</span>
              <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                {order.lines.length} {order.lines.length === 1 ? 'line' : 'lines'}
                {order.lines.some((l) => l.labelNo) && ` · ${order.lines.filter((l) => l.labelNo).length} labelled`}
              </span>
              <span />
              <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{gbp(value)}</span>
              <span style={{ fontSize: 12.5, color: unmatched > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 600 }}>
                {unmatched > 0
                  ? `${unmatched} to match`
                  : `${order.lines.length} of ${order.lines.length} matched`}
              </span>
            </div>
          </div>
          )}

          {/* Timeline */}
          <div>
            <div style={sectionLabel}>What happened</div>
            <OrderTimeline events={order.events} />
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              paddingTop: 12, borderTop: '1px solid var(--color-border)',
            }}
          >
            <button
              type="button"
              onClick={() => alert(`Opens the original email from ${order.fromAddress}: "${order.subject}".`)}
              style={textBtn}
            >
              <Mail size={12} /> Open original email <ExternalLink size={11} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>from {order.fromAddress}</span>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {order.status === 'review' && unmatched > 0 && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-text-secondary)', cursor: 'pointer', minHeight: 40 }}>
                  <input
                    type="checkbox"
                    checked={rememberMatches}
                    onChange={(e) => setRememberMatches(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-accent-active)' }}
                  />
                  Remember my matches for next time
                </label>
              )}
              {order.status === 'review' && (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  title={canSend ? (isForLaterDay(order) ? 'Put it on the plan' : `Send to ${posName}`) : `Match every item first (${unmatched} to go)`}
                  style={{ ...primaryBtn, opacity: canSend ? 1 : 0.45, cursor: canSend ? 'pointer' : 'not-allowed' }}
                >
                  {isForLaterDay(order) && !order.amendsOrderId ? <CalendarClock size={13} /> : <Send size={13} />}
                  {order.amendsOrderId
                    ? 'Update the ticket'
                    : isForLaterDay(order)
                      ? `Confirm for ${shortDay(order.fulfilmentDate)}`
                      : `Send to ${posName}`}
                </button>
              )}
              {order.status === 'scheduled' && (
                <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <CalendarClock size={13} color="var(--color-info)" strokeWidth={2.4} />
                  On the plan. Goes to {posName} at <strong style={{ color: 'var(--color-text-primary)' }}>{TILL_SEND_TIME} {shortDay(order.fulfilmentDate)}</strong> so the sale counts on the day.
                </span>
              )}
              {(order.status === 'failed' || order.status === 'waiting') && (
                <button type="button" onClick={handleRetry} style={primaryBtn}>
                  <RefreshCw size={13} /> Retry now
                </button>
              )}
              {order.status === 'sent' && order.posTicketRef && (
                <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Check size={13} color="var(--color-success)" strokeWidth={2.6} />
                  On {posName} as ticket <strong style={{ color: 'var(--color-text-primary)' }}>{order.posTicketRef}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Line row ─────────────────────────────────────────────────────────

function LineRow({
  line, last, editable, pickerOpen, onOpenPicker, onClosePicker, onPick,
}: {
  line: EmailOrderLine;
  last: boolean;
  editable: boolean;
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onPick: (pick: { posItemId: string; posItemName: string }) => void;
}) {
  const matched = !!line.match && line.match.confidence === 'high';
  const sub = [
    ...(line.options ?? []),
    ...(line.dietary && line.dietary.length ? [line.dietary.map((d) => `(${d})`).join(' ')] : []),
  ];

  return (
    <div
      style={{
        ...lineGrid,
        padding: '9px 14px',
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
        background: matched ? '#fff' : 'var(--color-warning-bg)',
      }}
    >
      <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{line.qty}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{line.itemAsWritten}</div>
        {sub.length > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 1 }}>{sub.join(' · ')}</div>
        )}
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {line.forWhom ?? ''}
        {line.labelNo && <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}> #{line.labelNo}</span>}
      </span>
      <span style={{ textAlign: 'right', fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>
        {gbp(line.unitPrice)}
      </span>
      <div style={{ position: 'relative', minWidth: 0 }}>
        {matched && line.match ? (
          <span
            title={line.match.by === 'operator' ? 'You matched this' : 'Edify matched this'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%',
              fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)',
            }}
          >
            {line.match.by === 'operator'
              ? <Check size={12} color="var(--color-success)" strokeWidth={2.6} />
              : <EdifyMark size={12} color="var(--color-accent-active)" />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {line.match.posItemName}
              {line.match.posModifier && <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}> + {line.match.posModifier}</span>}
            </span>
          </span>
        ) : editable ? (
          <button
            type="button"
            onClick={onOpenPicker}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%', maxWidth: 260, minHeight: 36,
              padding: '6px 10px', borderRadius: 8,
              border: `1px dashed ${pickerOpen ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
              background: '#fff', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)', cursor: 'pointer', textAlign: 'left',
            }}
          >
            {line.suggestion ? <EdifyMark size={12} color="var(--color-accent-active)" /> : <AlertTriangle size={12} color="var(--color-warning)" />}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {line.suggestion ? `${line.suggestion.posItemName}?` : 'Not on your till. Match to\u2026'}
            </span>
            <ChevronRight size={13} />
          </button>
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Not matched</span>
        )}
        {pickerOpen && (
          <PosItemPicker
            suggestion={line.suggestion}
            onPick={onPick}
            onClose={onClosePicker}
          />
        )}
      </div>
    </div>
  );
}

/** "+2 Avocado Toast Reg." or "+2 Avocado Toast Reg., +1 Latte". */
function describeAdded(added: EmailOrderLine[]): string {
  return added.map((l) => `+${l.qty} ${l.itemAsWritten}`).join(', ');
}

function UpdatedTag() {
  return (
    <span
      style={{
        display: 'inline-block', verticalAlign: 'middle', marginLeft: 8,
        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--color-info)', border: '1px solid var(--color-info)', borderRadius: 999,
        padding: '1px 7px', lineHeight: '14px',
      }}
    >
      Updated
    </span>
  );
}

function HeadCell({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', textAlign: align }}>
      {children}
    </span>
  );
}

const lineGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '40px minmax(0, 1.6fr) minmax(0, 1fr) 72px minmax(0, 1.3fr)',
  columnGap: 14,
  alignItems: 'center',
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--color-text-muted)', marginBottom: 10,
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '9px 14px', borderRadius: 10, minHeight: 40,
  border: 'none', background: 'var(--color-accent-active)', color: '#fff',
  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
};

const textBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 8px', borderRadius: 7, minHeight: 32,
  border: '1px solid transparent', background: 'transparent',
  fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-primary)',
  color: 'var(--color-link)', cursor: 'pointer',
};
