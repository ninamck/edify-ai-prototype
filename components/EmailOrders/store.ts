'use client';

/**
 * Email orders store.
 *
 * Holds the orders the agent has read, the agent's run summary, and a
 * flag for "checking the inbox right now". Every action that changes an
 * order appends an `OrderEvent` to that order, so the per-order timeline
 * and the cross-order "What Edify did today" log are derived from the
 * same facts and can never disagree with the data.
 *
 * Mirrors the `useSyncExternalStore` pattern in
 * `components/ItemMatching/overrideStore.ts`. Not persisted.
 */

import { useSyncExternalStore } from 'react';
import { TILL_SEND_TIME, type AgentRun, type DayLogEntry, type EmailOrder, type EmailOrderLine, type OrderEvent } from './types';
import {
  EMAIL_ORDERS_NOW,
  EMAIL_ORDERS_TODAY,
  OPERATOR,
  SEED_AGENT_RUN,
  SEED_EMAIL_ORDERS,
  makeIncomingOrder,
} from './fixtures';

type State = {
  orders: EmailOrder[];
  run: AgentRun;
  checking: boolean;
  /** Demo clock. Advances a minute each time the operator does something. */
  now: string;
  /** Operator matches to remember for the next email: item as written → POS item. */
  learned: Map<string, { posItemId: string; posItemName: string }>;
  rememberMatches: boolean;
};

let state: State = {
  orders: SEED_EMAIL_ORDERS,
  run: SEED_AGENT_RUN,
  checking: false,
  now: EMAIL_ORDERS_NOW,
  learned: new Map(),
  rememberMatches: true,
};

const listeners = new Set<() => void>();
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function notify() { for (const l of listeners) l(); }
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  notify();
}

const getState = () => state;
export function useEmailOrdersState(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}
export function useEmailOrders(): EmailOrder[] {
  return useEmailOrdersState().orders;
}

let eventSeq = 1000;
function nextEventId() { eventSeq += 1; return `e-${eventSeq}`; }
let ticketSeq = 4831;
function nextTicket() { ticketSeq += 1; return `#${ticketSeq}`; }

/** Move the demo clock forward by `minutes`. */
function tick(minutes = 1): string {
  // Plain string arithmetic so the demo clock never shifts with the
  // browser's timezone (the fixtures are timezone-less local times).
  const [date, clock] = state.now.split('T');
  const [h, m] = clock.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  const next = `${date}T${hh}:${mm}:00`;
  state = { ...state, now: next };
  return next;
}

function updateOrder(id: string, mut: (o: EmailOrder) => EmailOrder) {
  set({ orders: state.orders.map((o) => (o.id === id ? mut(o) : o)) });
}

function appendEvent(order: EmailOrder, event: Omit<OrderEvent, 'id'>): EmailOrder {
  return { ...order, events: [...order.events, { id: nextEventId(), ...event }] };
}

// ── Actions ─────────────────────────────────────────────────────────

/** Operator matches an unmatched or low-confidence line to a till item. */
export function matchLine(
  orderId: string,
  lineId: string,
  pos: { posItemId: string; posItemName: string },
): void {
  const at = tick();
  const order = state.orders.find((o) => o.id === orderId);
  const line = order?.lines.find((l) => l.id === lineId);
  if (!order || !line) return;

  const learned = new Map(state.learned);
  if (state.rememberMatches) learned.set(line.itemAsWritten.toLowerCase(), pos);

  updateOrder(orderId, (o) => {
    const lines = o.lines.map((l) =>
      l.id === lineId
        ? { ...l, match: { ...pos, confidence: 'high' as const, by: 'operator' as const }, suggestion: undefined }
        : l,
    );
    const stillUnmatched = lines.filter((l) => !l.match || l.match.confidence === 'low').length;
    const reason =
      o.amendsOrderId
        ? o.reason
        : stillUnmatched > 0
          ? `${stillUnmatched} item${stillUnmatched === 1 ? '' : 's'} we couldn\u2019t find on your till`
          : 'Every item matched. Ready to send.';
    const text = state.rememberMatches
      ? `${OPERATOR.name} matched "${line.itemAsWritten}" to ${pos.posItemName}. We\u2019ll remember that next time.`
      : `${OPERATOR.name} matched "${line.itemAsWritten}" to ${pos.posItemName}.`;
    return appendEvent({ ...o, lines, reason }, { type: 'operator-matched', at, actor: OPERATOR, text });
  });
  set({ learned });
}

/** Operator sends a reviewed order (or amendment) to the till. */
export function sendToPos(orderId: string, posName: string): void {
  const at = tick();
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;
  const allMatched = order.lines.every((l) => l.match && l.match.confidence === 'high');
  if (!allMatched) return;

  const planDay = formatPlanDay(order.fulfilmentDate);

  if (order.amendsOrderId) {
    // Held update, now confirmed: fold it into the original order and drop
    // the held row. The original carries the amendment record and the event.
    const original = state.orders.find((o) => o.id === order.amendsOrderId);
    if (!original) return;
    const ticket = original.posTicketRef ?? nextTicket();
    const added = describeAdded(order.lines);
    const folded: EmailOrder = appendEvent(
      {
        ...original,
        lines: applyAdded(original.lines, order.lines),
        posTicketRef: ticket,
        amendments: [
          ...(original.amendments ?? []),
          {
            id: `am-${Date.now()}`,
            at,
            ref: order.ref,
            added: order.lines,
            summary: `${OPERATOR.name} confirmed the update at ${formatClock(at)}: ${added}. Added to ticket ${ticket} on ${posName} and to the plan for ${planDay}.`,
          },
        ],
      },
      {
        type: 'operator-sent',
        at,
        actor: OPERATOR,
        text: `${OPERATOR.name} confirmed the update: ${added}. Added to ticket ${ticket} on ${posName}. The plan for ${planDay} is updated.`,
      },
    );
    set({
      orders: state.orders.filter((o) => o.id !== orderId).map((o) => (o.id === original.id ? folded : o)),
    });
    return;
  } else if (isForLaterDay(order)) {
    // Not today's sale: on the plan now, to the till on the morning.
    updateOrder(orderId, (o) =>
      appendEvent(
        { ...o, status: 'scheduled', reason: undefined },
        {
          type: 'operator-scheduled',
          at,
          actor: OPERATOR,
          text: `${OPERATOR.name} confirmed. On the plan for ${planDay}. Goes to ${posName} at ${TILL_SEND_TIME} that morning so the sale counts on the day.`,
        },
      ),
    );
    return;
  } else {
    const ticket = nextTicket();
    updateOrder(orderId, (o) =>
      appendEvent(
        { ...o, status: 'sent', reason: undefined, posTicketRef: ticket },
        {
          type: 'operator-sent',
          at,
          actor: OPERATOR,
          text: `${OPERATOR.name} sent to ${posName}, ticket ${ticket}. On the plan for ${planDay}.`,
        },
      ),
    );
  }
  set({ run: { ...state.run, ordersSentToday: state.run.ordersSentToday + 1 } });
}

/** True when the order is for a day after the demo's today. */
export function isForLaterDay(order: EmailOrder): boolean {
  return order.fulfilmentDate > EMAIL_ORDERS_TODAY;
}

/** Same till item (or same wording) counts as the same line. */
function lineKey(l: EmailOrderLine): string {
  return l.match?.posItemId ?? l.itemAsWritten.trim().toLowerCase();
}

/** Merge update lines into a ticket's current lines. Additions only; see OrderAmendment. */
export function applyAdded(current: EmailOrderLine[], added: EmailOrderLine[]): EmailOrderLine[] {
  const out = current.map((l) => ({ ...l }));
  for (const add of added) {
    const hit = out.find((l) => lineKey(l) === lineKey(add));
    if (hit) hit.qty += add.qty;
    else out.push({ ...add });
  }
  return out;
}

/** "+2 Avocado Toast Reg., +1 Latte" */
function describeAdded(added: EmailOrderLine[]): string {
  return added.map((l) => `+${l.qty} ${l.itemAsWritten}`).join(', ');
}

/** Retry a failed send. Succeeds when the till is connected. */
export function retrySend(orderId: string, posName: string, posConnected: boolean): void {
  const at = tick();
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;
  const planDay = formatPlanDay(order.fulfilmentDate);

  if (!posConnected) {
    updateOrder(orderId, (o) =>
      appendEvent(
        { ...o, status: 'waiting', reason: 'Till not connected. We\u2019ll send this as soon as it\u2019s back.' },
        { type: 'queued', at, actor: { kind: 'edify' }, text: `${capitalise(posName)} still isn\u2019t answering. Queued; we\u2019ll send it the moment the till is back.` },
      ),
    );
    return;
  }

  const ticket = nextTicket();
  updateOrder(orderId, (o) =>
    appendEvent(
      appendEvent(
        { ...o, status: 'sent', reason: undefined, posTicketRef: ticket },
        { type: 'retried', at, actor: OPERATOR, text: `${OPERATOR.name} asked us to try again.` },
      ),
      { type: 'sent', at, actor: { kind: 'edify' }, text: `Sent to ${posName}, ticket ${ticket}. On the plan for ${planDay}.` },
    ),
  );
  set({ run: { ...state.run, ordersSentToday: state.run.ordersSentToday + 1 } });
}

/**
 * Check the inbox now. Fakes a 900ms read, then lands one new email that
 * matches cleanly and is scheduled for tomorrow morning, so the demo
 * shows the agent working end to end.
 */
export function checkInbox(): void {
  if (state.checking) return;
  set({ checking: true });
  window.setTimeout(() => {
    const at = tick(2);
    const incoming = makeIncomingOrder(at);
    const alreadyThere = state.orders.some((o) => o.customer === incoming.customer);
    const orders = alreadyThere ? state.orders : [...state.orders, incoming];
    set({
      checking: false,
      orders,
      run: {
        ...state.run,
        lastCheckedAt: at,
        emailsReadToday: state.run.emailsReadToday + (alreadyThere ? 0 : 1),
        ordersSentToday: state.run.ordersSentToday + (!alreadyThere && incoming.status === 'sent' ? 1 : 0),
      },
    });
  }, 900);
}

export function setRememberMatches(v: boolean): void {
  set({ rememberMatches: v });
}

// ── Derived ─────────────────────────────────────────────────────────

/** The last thing that happened to an order, for the collapsed row. */
export function lastEvent(order: EmailOrder): OrderEvent | undefined {
  return order.events[order.events.length - 1];
}

/** Today's events across every order, newest first. */
export function dayLog(orders: EmailOrder[], today = EMAIL_ORDERS_TODAY): DayLogEntry[] {
  const out: DayLogEntry[] = [];
  for (const o of orders) {
    for (const e of o.events) {
      if (!e.at.startsWith(today)) continue;
      // The sent / held / failed line already tells the story; the
      // reading steps live on the order's own timeline.
      if (e.type === 'email-received' || e.type === 'parsed' || e.type === 'matched') continue;
      out.push({ id: `${o.id}-${e.id}`, at: e.at, text: dayLogText(o, e), orderId: o.id });
    }
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

function dayLogText(o: EmailOrder, e: OrderEvent): string {
  const items = o.lines.reduce((n, l) => n + l.qty, 0);
  switch (e.type) {
    case 'sent':
      return `Sent ${o.customer}, ${items} items, to Square, ticket ${o.posTicketRef ?? ''}`.trim();
    case 'operator-sent':
      return `${OPERATOR.name} sent ${o.customer}, ${items} items, ticket ${o.posTicketRef ?? ''}`.trim();
    case 'scheduled':
      return `${o.customer}, ${items} items, on the plan for ${formatPlanDay(o.fulfilmentDate)}. Till gets it that morning.`;
    case 'operator-scheduled':
      return `${OPERATOR.name} confirmed ${o.customer}, ${items} items, for ${formatPlanDay(o.fulfilmentDate)}.`;
    case 'held':
      return `Held ${o.customer}: ${e.text.replace(/^Held: /, '').replace(/ Nothing sent yet\.$/, '')}`;
    case 'send-failed':
      return `Couldn\u2019t send ${o.customer}: Square didn\u2019t answer. Nothing has changed on the till.`;
    case 'queued':
      return `Queued ${o.customer} until the till is back.`;
    case 'cancelled':
      return `${o.customer} cancelled ${o.ref}. Voided ticket ${o.posTicketRef ?? ''} and took ${items} items off the plan.`;
    case 'amended':
      return o.amendsOrderId ? `${o.customer} changed ${o.ref.replace(' (updated)', '')}. Waiting for you.` : e.text;
    case 'matched':
      return `Matched ${o.customer}, ${o.lines.length} line${o.lines.length === 1 ? '' : 's'}.`;
    case 'operator-matched':
    case 'retried':
      return e.text;
    default:
      return e.text;
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatPlanDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatClock(isoDateTime: string): string {
  return isoDateTime.slice(11, 16);
}

/** "3 min ago" style relative label against the demo clock. */
export function minutesAgo(iso: string, now: string): string {
  const toMin = (s: string) => {
    const [d, c] = s.split('T');
    const [h, m] = c.split(':').map(Number);
    return Math.round(new Date(`${d}T00:00:00Z`).getTime() / 60000) + h * 60 + m;
  };
  const diff = Math.max(0, toMin(now) - toMin(iso));
  if (diff === 0) return 'just now';
  if (diff === 1) return '1 min ago';
  if (diff < 60) return `${diff} min ago`;
  const h = Math.round(diff / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}
