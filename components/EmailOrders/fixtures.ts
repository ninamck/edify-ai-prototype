/**
 * Email orders fixtures.
 *
 * Shape and realism follow the Feedr / Cloud Canteen summary FST-705065
 * (14 labelled items, per-person labels, options and dietary codes). The
 * menu is Fitzroy Espresso's own till (`FITZROY_POS_INTAKE.menuItems`)
 * so line matching is real against the rest of the prototype, and the
 * people are invented.
 *
 * Demo "today" is Thursday 23 April 2026, the same day the Production
 * fixtures use, so "on the plan for" lines agree with the rest of the app.
 */

import { TILL_SEND_TIME as SEND_TIME, type AgentRun, type EmailOrder, type EmailOrderLine, type OrderEvent } from './types';

export const EMAIL_ORDERS_TODAY = '2026-04-23'; // Thursday
export const EMAIL_ORDERS_NOW = `${EMAIL_ORDERS_TODAY}T09:10:00`;

export const OPERATOR = { kind: 'operator' as const, name: 'Ollie', initials: 'OB' };
const EDIFY = { kind: 'edify' as const };

const t = (date: string, time: string) => `${date}T${time}:00`;
const TODAY = EMAIL_ORDERS_TODAY;
const YESTERDAY = '2026-04-22';
const TOMORROW = '2026-04-24';
const SAT = '2026-04-25';
const MON = '2026-04-27';

// Till items the agent matches against. Ids and names come from
// FITZROY_POS_INTAKE.menuItems so the picker and the matches agree.
const POS = {
  avocadoToast: { posItemId: 'mi-avocado-toast', posItemName: 'Avocado toast' },
  salmonBagel: { posItemId: 'mi-salmon-bagel', posItemName: 'Smoked salmon bagel' },
  blueberryMuffin: { posItemId: 'mi-blueberry-muffin', posItemName: 'Blueberry muffin' },
  croissant: { posItemId: 'mi-croissant', posItemName: 'Croissant' },
  almondCroissant: { posItemId: 'mi-almond-croissant', posItemName: 'Almond croissant' },
  orangeJuice: { posItemId: 'mi-orange-juice', posItemName: 'Orange juice' },
  flatWhite: { posItemId: 'mi-flat-white', posItemName: 'Flat white' },
  latte: { posItemId: 'mi-latte', posItemName: 'Latte' },
};

let lineSeq = 0;
function line(
  qty: number,
  itemAsWritten: string,
  unitPrice: number,
  extra: Partial<Omit<EmailOrderLine, 'id' | 'qty' | 'itemAsWritten' | 'unitPrice'>> & {
    pos?: { posItemId: string; posItemName: string };
    posModifier?: string;
  } = {},
): EmailOrderLine {
  lineSeq += 1;
  const { pos, posModifier, ...rest } = extra;
  return {
    id: `l-${lineSeq}`,
    qty,
    itemAsWritten,
    unitPrice,
    ...rest,
    ...(pos
      ? { match: { ...pos, confidence: 'high', by: 'edify', ...(posModifier ? { posModifier } : {}) } }
      : {}),
  };
}

let eventSeq = 0;
function ev(type: OrderEvent['type'], at: string, text: string, actor: OrderEvent['actor'] = EDIFY): OrderEvent {
  eventSeq += 1;
  return { id: `e-${eventSeq}`, type, at, actor, text };
}

// ── 1. The Feedr example, adapted. Held: one item not on the till. ──
const fastly: EmailOrder = {
  id: 'eo-fst-705065',
  source: 'feedr',
  ref: 'FST-705065',
  customer: 'Fastly Ltd',
  sitePart: 'London Office',
  fromAddress: 'orders@feedr.co',
  subject: 'Cloud Canteen Order #FST-705065 · Fastly Ltd · Fri 24 Apr',
  fulfilmentDate: TOMORROW,
  fulfilmentTime: '12:05',
  fulfilmentKind: 'collection',
  status: 'review',
  reason: '1 item we couldn\u2019t find on your till',
  lines: [
    line(1, 'Avocado Toast Boosted', 9.5, { options: ['Poached egg'], dietary: ['v'], forWhom: 'Priya Natarajan', labelNo: 1, pos: POS.avocadoToast }),
    line(1, 'Smoked Salmon Bagel', 8.9, { dietary: ['nd'], forWhom: 'Tom Ashworth', labelNo: 2, pos: POS.salmonBagel }),
    line(1, 'Avocado Toast Reg.', 8.5, { dietary: ['v'], forWhom: 'Hana Kobayashi', labelNo: 3, pos: POS.avocadoToast }),
    line(1, 'Smoked Salmon Bagel', 8.9, { dietary: ['nd'], forWhom: 'Marcus Oyelaran', labelNo: 4, pos: POS.salmonBagel }),
    line(1, 'Avocado Toast Reg.', 8.5, { dietary: ['v'], forWhom: 'Lucia Ferreira', labelNo: 5, pos: POS.avocadoToast }),
    line(1, 'Fresh Orange Juice', 3.2, { dietary: ['ve', 'v', 'ng'], forWhom: 'Tom Ashworth', labelNo: 6, pos: POS.orangeJuice }),
    line(1, 'Almond Croissant', 3.6, { dietary: ['v'], forWhom: 'Sam Whitfield', labelNo: 7, pos: POS.almondCroissant }),
    line(1, 'Butter Croissant', 2.8, { dietary: ['v'], forWhom: 'Joanna Kemp', labelNo: 8, pos: POS.croissant }),
    line(1, 'Blueberry Muffin', 3.2, { dietary: ['v'], forWhom: 'Dev Raghunathan', labelNo: 9, pos: POS.blueberryMuffin }),
    line(1, 'Flat White', 3.8, { options: ['Oat milk'], dietary: ['ve'], forWhom: 'Hana Kobayashi', labelNo: 10, pos: POS.flatWhite, posModifier: 'Oat milk' }),
    line(1, 'Flat White', 3.8, { options: ['Oat milk'], dietary: ['ve'], forWhom: 'Alex Brennan', labelNo: 11, pos: POS.flatWhite, posModifier: 'Oat milk' }),
    line(1, 'Fresh Orange Juice', 3.2, { dietary: ['ve', 'v', 'ng'], forWhom: 'Sam Whitfield', labelNo: 12, pos: POS.orangeJuice }),
    line(1, 'Flat White', 3.4, { dietary: ['v'], forWhom: 'Joanna Kemp', labelNo: 13, pos: POS.flatWhite }),
    line(1, 'Seaweed Crisps - Salt & Vinegar flavour', 2.6, { dietary: ['ve', 'v', 'nd', 'ng', 'nka'], forWhom: 'Dev Raghunathan', labelNo: 14 }),
  ],
  events: [
    ev('matched', t(TODAY, '08:15'), 'Read the Feedr email and matched 13 of 14 items to your till. 2 flat whites carry the oat milk option.'),
    ev('held', t(TODAY, '08:15'), 'Held: Seaweed Crisps, Salt & Vinegar isn\u2019t on your till. Nothing sent yet.'),
  ],
};

// ── 2. Plain email from a regular, for tomorrow. Matched, on the plan,
//       goes to the till tomorrow morning so the sale lands on the day. ──
const mercer: EmailOrder = {
  id: 'eo-mercer-0424',
  source: 'email',
  ref: 'Breakfast order for tomorrow',
  customer: 'Mercer & Co',
  fromAddress: 'anna.r@mercerandco.com',
  subject: 'Breakfast order for tomorrow',
  fulfilmentDate: TOMORROW,
  fulfilmentTime: '08:00',
  fulfilmentKind: 'collection',
  status: 'scheduled',
  lines: [
    line(20, 'croissants', 2.8, { pos: POS.croissant }),
    line(10, 'orange juices', 3.2, { pos: POS.orangeJuice }),
  ],
  events: [
    ev('matched', t(TODAY, '08:13'), 'Read Anna\u2019s email ("20 croissants and 10 OJs for 8am tomorrow please") and matched both lines to your till.'),
    ev('scheduled', t(TODAY, '08:13'), `On the plan for Fri 24 Apr. Goes to Square at ${SEND_TIME} on Friday so the sale counts on the day.`),
  ],
};

// ── 3. Feedr order collected today. Sent at open this morning. ──
const bramble: EmailOrder = {
  id: 'eo-fst-704988',
  source: 'feedr',
  ref: 'FST-704988',
  customer: 'Bramble Studios',
  sitePart: 'Clerkenwell',
  fromAddress: 'orders@feedr.co',
  subject: 'Cloud Canteen Order #FST-704988 · Bramble Studios · Thu 23 Apr',
  fulfilmentDate: TODAY,
  fulfilmentTime: '12:30',
  fulfilmentKind: 'collection',
  status: 'sent',
  posTicketRef: '#4810',
  lines: [
    line(1, 'Avocado Toast Boosted', 9.5, { options: ['Poached egg'], dietary: ['v'], forWhom: 'Rosa Lindqvist', labelNo: 1, pos: POS.avocadoToast }),
    line(1, 'Smoked Salmon Bagel', 8.9, { dietary: ['nd'], forWhom: 'Ben Okafor', labelNo: 2, pos: POS.salmonBagel }),
    line(1, 'Avocado Toast Reg.', 8.5, { dietary: ['v'], forWhom: 'Mei Tanaka', labelNo: 3, pos: POS.avocadoToast }),
    line(1, 'Fresh Orange Juice', 3.2, { dietary: ['ve'], forWhom: 'Ben Okafor', labelNo: 4, pos: POS.orangeJuice }),
    line(1, 'Latte', 3.6, { options: ['Oat milk'], forWhom: 'Rosa Lindqvist', labelNo: 5, pos: POS.latte, posModifier: 'Oat milk' }),
    line(1, 'Blueberry Muffin', 3.2, { dietary: ['v'], forWhom: 'Mei Tanaka', labelNo: 6, pos: POS.blueberryMuffin }),
  ],
  events: [
    ev('matched', t(YESTERDAY, '16:43'), 'Read the Feedr email and matched 6 of 6 items to your till.'),
    ev('scheduled', t(YESTERDAY, '16:43'), `On the plan for Thu 23 Apr. Goes to Square at ${SEND_TIME} tomorrow so the sale counts on the day.`),
    ev('sent', t(TODAY, SEND_TIME), 'Sent to Square, ticket #4810.'),
  ],
};

// ── 4. Loxley order, on the till since 06:00, then updated by Feedr at
// 08:41. Every line in the update matched, so Edify changed the ticket
// itself and flags the order as updated. `lines` is the current state. ──
const loxley: EmailOrder = {
  id: 'eo-fst-705102',
  source: 'feedr',
  ref: 'FST-705102',
  customer: 'Loxley Partners',
  sitePart: 'Farringdon',
  fromAddress: 'orders@feedr.co',
  subject: 'Cloud Canteen Order #FST-705102 UPDATED · Loxley Partners · Thu 23 Apr',
  fulfilmentDate: TODAY,
  fulfilmentTime: '13:00',
  fulfilmentKind: 'delivery',
  status: 'sent',
  posTicketRef: '#4796',
  lines: [
    line(6, 'Avocado Toast Reg.', 8.5, { dietary: ['v'], pos: POS.avocadoToast }),
    line(2, 'Smoked Salmon Bagel', 8.9, { dietary: ['nd'], pos: POS.salmonBagel }),
    line(6, 'Fresh Orange Juice', 3.2, { dietary: ['ve'], pos: POS.orangeJuice }),
  ],
  amendments: [
    {
      id: 'am-705102-1',
      at: t(TODAY, '08:41'),
      ref: 'FST-705102 (updated)',
      added: [line(2, 'Avocado Toast Reg.', 8.5, { dietary: ['v'], pos: POS.avocadoToast })],
      summary: 'Feedr sent an update at 08:41: 2 more Avocado Toast Reg. Added to ticket #4796 on Square and to today\u2019s plan. Nothing else moved.',
    },
  ],
  events: [
    ev('matched', t(YESTERDAY, '11:06'), 'Read the Feedr email and matched 3 of 3 lines to your till.'),
    ev('scheduled', t(YESTERDAY, '11:06'), `On the plan for Thu 23 Apr. Goes to Square at ${SEND_TIME} tomorrow so the sale counts on the day.`),
    ev('sent', t(TODAY, SEND_TIME), 'Sent to Square, ticket #4796.'),
    ev('amended', t(TODAY, '08:41'), 'Read the Feedr update: 2 more Avocado Toast Reg. Added them to ticket #4796 and to today\u2019s plan. Ticket is now 14 items.'),
  ],
};

// ── 5. Early plain email for a 10:00 meeting. Sent before anyone was in. ──
// (The failed-send and waiting-for-till states still exist in the store
// and render if the till is disconnected; they are kept out of the seed
// so the demo opens on a clean day.)
const harbour: EmailOrder = {
  id: 'eo-harbour-0423',
  source: 'email',
  ref: 'Coffees and pastries for 10am',
  customer: 'Harbour Legal',
  fromAddress: 'reception@harbourlegal.co.uk',
  subject: 'Coffees and pastries for 10am client meeting',
  fulfilmentDate: TODAY,
  fulfilmentTime: '10:00',
  fulfilmentKind: 'collection',
  status: 'sent',
  posTicketRef: '#4808',
  lines: [
    line(12, 'almond croissants', 3.6, { pos: POS.almondCroissant }),
    line(12, 'flat whites', 3.4, { pos: POS.flatWhite }),
  ],
  events: [
    ev('matched', t(TODAY, '06:39'), 'Read the email from reception@harbourlegal.co.uk and matched both lines to your till.'),
    ev('sent', t(TODAY, '06:39'), 'Sent to Square, ticket #4808. It\u2019s for today, so it went straight through.'),
  ],
};

// ── 6. Cancelled by the customer. ──
const cancelled: EmailOrder = {
  id: 'eo-fst-704871',
  source: 'feedr',
  ref: 'FST-704871',
  customer: 'Fastly Ltd',
  sitePart: 'London Office',
  fromAddress: 'orders@feedr.co',
  subject: 'Cloud Canteen Order #FST-704871 CANCELLED · Fastly Ltd · Thu 23 Apr',
  fulfilmentDate: TODAY,
  fulfilmentTime: '15:00',
  fulfilmentKind: 'collection',
  status: 'cancelled',
  posTicketRef: '#4801',
  reason: 'Cancelled by the customer at 08:50. Voided on the till.',
  lines: [
    line(8, 'Butter Croissant', 2.8, { dietary: ['v'], pos: POS.croissant }),
    line(8, 'Flat White', 3.4, { pos: POS.flatWhite }),
  ],
  events: [
    ev('matched', t(YESTERDAY, '14:21'), 'Read the Feedr email and matched 2 of 2 lines to your till.'),
    ev('scheduled', t(YESTERDAY, '14:21'), `On the plan for Thu 23 Apr. Goes to Square at ${SEND_TIME} tomorrow so the sale counts on the day.`),
    ev('sent', t(TODAY, SEND_TIME), 'Sent to Square, ticket #4801.'),
    ev('cancelled', t(TODAY, '08:50'), 'Feedr sent a cancellation. Voided ticket #4801 on the till and took 16 items off today\u2019s plan.'),
  ],
};

// ── 7. Later in the week. Matched and on the plan; the till gets them
//       on the morning of the sale. ──
const kemble: EmailOrder = {
  id: 'eo-kemble-0425',
  source: 'email',
  ref: 'Saturday brunch for the team',
  customer: 'Kemble & Rowe',
  fromAddress: 'events@kembleandrowe.com',
  subject: 'Saturday brunch for the team',
  fulfilmentDate: SAT,
  fulfilmentTime: '10:30',
  fulfilmentKind: 'delivery',
  status: 'scheduled',
  lines: [
    line(10, 'avocado toast', 8.5, { dietary: ['v'], pos: POS.avocadoToast }),
    line(6, 'smoked salmon bagels', 8.9, { pos: POS.salmonBagel }),
    line(16, 'orange juice', 3.2, { pos: POS.orangeJuice }),
  ],
  events: [
    ev('matched', t(TODAY, '08:53'), 'Read the email from events@kembleandrowe.com and matched 3 of 3 lines to your till.'),
    ev('scheduled', t(TODAY, '08:53'), `On the plan for Sat 25 Apr. Goes to Square at ${SEND_TIME} on Saturday so the sale counts on the day.`),
  ],
};

const northgate: EmailOrder = {
  id: 'eo-fst-705140',
  source: 'feedr',
  ref: 'FST-705140',
  customer: 'Northgate Media',
  sitePart: 'Shoreditch',
  fromAddress: 'orders@feedr.co',
  subject: 'Cloud Canteen Order #FST-705140 · Northgate Media · Mon 27 Apr',
  fulfilmentDate: MON,
  fulfilmentTime: '12:15',
  fulfilmentKind: 'collection',
  status: 'scheduled',
  lines: [
    line(1, 'Avocado Toast Boosted', 9.5, { options: ['Poached egg'], dietary: ['v'], forWhom: 'Isla McReady', labelNo: 1, pos: POS.avocadoToast }),
    line(1, 'Avocado Toast Reg.', 8.5, { dietary: ['v'], forWhom: 'Yusuf Demir', labelNo: 2, pos: POS.avocadoToast }),
    line(1, 'Smoked Salmon Bagel', 8.9, { dietary: ['nd'], forWhom: 'Clara Voss', labelNo: 3, pos: POS.salmonBagel }),
    line(1, 'Blueberry Muffin', 3.2, { dietary: ['v'], forWhom: 'Yusuf Demir', labelNo: 4, pos: POS.blueberryMuffin }),
    line(1, 'Flat White', 3.8, { options: ['Oat milk'], forWhom: 'Clara Voss', labelNo: 5, pos: POS.flatWhite, posModifier: 'Oat milk' }),
  ],
  events: [
    ev('matched', t(TODAY, '09:03'), 'Read the Feedr email and matched 5 of 5 items to your till.'),
    ev('scheduled', t(TODAY, '09:03'), `On the plan for Mon 27 Apr. Goes to Square at ${SEND_TIME} on Monday so the sale counts on the day.`),
  ],
};

export const SEED_EMAIL_ORDERS: EmailOrder[] = [
  harbour,
  bramble,
  loxley,
  cancelled,
  mercer,
  fastly,
  kemble,
  northgate,
];

export const SEED_AGENT_RUN: AgentRun = {
  lastCheckedAt: `${TODAY}T09:07:00`,
  cadenceMinutes: 15,
  emailsReadToday: 6,
  /** On the till right now: two 06:00 sends plus Harbour Legal. The voided Fastly ticket is not counted, so this agrees with the On the till tile. */
  ordersSentToday: 3,
  ordersHeldToday: 1,
  inboxes: ['orders@fitzroyespresso.co.uk', 'Feedr'],
};

/**
 * An email that "arrives" when the operator presses Check inbox now, so
 * the demo can show the agent reading, matching and sending live.
 */
export function makeIncomingOrder(now: string): EmailOrder {
  return {
    id: `eo-ridley-${now.replace(/\D/g, '')}`,
    source: 'email',
    ref: 'Pastries for tomorrow 9am',
    customer: 'Ridley Architects',
    fromAddress: 'studio@ridleyarch.co.uk',
    subject: 'Pastries for tomorrow 9am',
    fulfilmentDate: TOMORROW,
    fulfilmentTime: '09:00',
    fulfilmentKind: 'collection',
    status: 'scheduled',
    lines: [
      line(12, 'mixed croissants', 2.8, { pos: POS.croissant }),
      line(6, 'almond croissants', 3.6, { pos: POS.almondCroissant }),
      line(8, 'orange juice', 3.2, { pos: POS.orangeJuice }),
    ],
    events: [
      ev('matched', now, 'Read the email from studio@ridleyarch.co.uk and matched 3 of 3 lines to your till. "Mixed croissants" read as Croissant.'),
      ev('scheduled', now, `On the plan for Fri 24 Apr. Goes to Square at ${SEND_TIME} on Friday so the sale counts on the day.`),
    ],
  };
}
