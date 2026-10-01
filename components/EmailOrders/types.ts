/**
 * Email orders — the data model for orders the Edify email agent reads
 * from the inbox, matches to till items, and sends to the POS.
 *
 * Shape follows what a Feedr / Cloud Canteen summary actually carries
 * (see the FST-705065 example): a header (customer, collection time,
 * item count, value, site part) and one labelled line per person, each
 * with options, dietary codes and a label number. A plain email from a
 * regular ("20 croissants for 8am") fits the same shape with fewer
 * fields filled in.
 *
 * Every order also carries an event trail. The agent writes an event
 * for each step it takes; the operator's own actions append to the same
 * trail. The trail is the audit record and the reason the GM can trust
 * that the agent did the work.
 *
 * Timing rule: a matched order is NOT sent to the till until the day it
 * is for. The sale has to land in that day's takings, not the day the
 * email arrived. So a fully matched order for a future date sits as
 * `scheduled` (already on the production plan, since the kitchen needs
 * the lead time) and goes to the till at `TILL_SEND_TIME` on the morning
 * of the sale. Orders for today go straight through.
 */

/** Clock time on the fulfilment day when scheduled orders go to the till. */
export const TILL_SEND_TIME = '06:00';

export type OrderSource = 'feedr' | 'email';

export type EmailOrderStatus =
  /** Every line matched, POS accepted the order. */
  | 'sent'
  /** Every line matched, on the plan, waiting for the morning of the sale to go to the till. */
  | 'scheduled'
  /** At least one line unmatched / low confidence, or an amendment, or an unreadable date. Nothing sent. */
  | 'review'
  /** All lines matched but the POS rejected it or was offline. Nothing on the till. */
  | 'failed'
  /** Matched and ready, but the till is not connected. Goes through on reconnect. */
  | 'waiting'
  /** Customer cancelled by email. Voided on the till if it had been sent. */
  | 'cancelled';

export type MatchConfidence = 'high' | 'low';

export type LineMatch = {
  /** POS item id from `FITZROY_POS_INTAKE.menuItems`. */
  posItemId: string;
  posItemName: string;
  confidence: MatchConfidence;
  /** POS modifier applied when an option maps to a modifier group (e.g. "Oat milk"). */
  posModifier?: string;
  /** Who made the match: the agent or the operator. */
  by: 'edify' | 'operator';
};

export type EmailOrderLine = {
  id: string;
  qty: number;
  /** Item name exactly as the email wrote it. */
  itemAsWritten: string;
  /** Add-ons / choices under the item ("Go Large", "Grilled Halloumi portion"). */
  options?: string[];
  /** Dietary codes as printed: v, ve, h, nrs, nd, ng, nka. */
  dietary?: string[];
  /** The person the item is labelled for, where the email gives one. */
  forWhom?: string;
  /** Label number from the "items labelled" block. */
  labelNo?: number;
  /** Unit price in GBP. */
  unitPrice: number;
  /** Set when matched to a till item. Absent means unmatched. */
  match?: LineMatch;
  /** Edify's best guess when it could not match with confidence. */
  suggestion?: { posItemId: string; posItemName: string };
};

export type OrderEventType =
  | 'email-received'
  | 'parsed'
  | 'matched'
  | 'held'
  | 'scheduled'
  | 'sent'
  | 'send-failed'
  | 'queued'
  | 'retried'
  | 'amended'
  | 'cancelled'
  | 'operator-matched'
  | 'operator-sent'
  | 'operator-scheduled';

export type OrderEvent = {
  id: string;
  type: OrderEventType;
  /** ISO timestamp. */
  at: string;
  actor: { kind: 'edify' } | { kind: 'operator'; name: string; initials: string };
  /** Plain-English line shown on the timeline, in Edify's voice. */
  text: string;
};

export type EmailOrder = {
  id: string;
  source: OrderSource;
  /** External ref as the sender wrote it (Feedr ref, or a subject-derived ref for plain email). */
  ref: string;
  customer: string;
  /** The "Part 1 / 1: London Office" line on a Feedr summary. */
  sitePart?: string;
  /** Sender address the email came from. */
  fromAddress: string;
  subject: string;
  /** ISO date the order is for. */
  fulfilmentDate: string;
  /** Clock time, "12:05". */
  fulfilmentTime: string;
  fulfilmentKind: 'collection' | 'delivery';
  lines: EmailOrderLine[];
  status: EmailOrderStatus;
  /** Plain-English reason the order is held, failed or waiting. */
  reason?: string;
  /** POS ticket ref once sent. */
  posTicketRef?: string;
  /**
   * Set when this email amends an order already on the till AND we could
   * not apply it ourselves (a line didn't match). Fully matched updates
   * never appear as their own order: they fold into the original as an
   * `amendments` entry and the ticket is changed straight away.
   */
  amendsOrderId?: string;
  /** Updates applied to this order after it was first read. `lines` is always the current state. */
  amendments?: OrderAmendment[];
  events: OrderEvent[];
};

/**
 * An update email that Edify applied to an order automatically. The
 * added lines are deltas; the order's `lines` already include them.
 * Removals would need a negative qty here; not modelled yet.
 */
export type OrderAmendment = {
  id: string;
  /** ISO timestamp the update was applied. */
  at: string;
  /** External ref as the sender wrote it, e.g. "FST-705102 (updated)". */
  ref: string;
  added: EmailOrderLine[];
  /** One plain sentence saying what changed, in Edify's voice. */
  summary: string;
};

/** Summary of the agent's work today, for the status strip. */
export type AgentRun = {
  /** ISO timestamp of the last inbox check. */
  lastCheckedAt: string;
  /** Minutes between automatic checks. */
  cadenceMinutes: number;
  emailsReadToday: number;
  ordersSentToday: number;
  ordersHeldToday: number;
  inboxes: string[];
};

/** One line in the "What Edify did today" log, across all orders. */
export type DayLogEntry = {
  id: string;
  at: string;
  text: string;
  orderId?: string;
};
