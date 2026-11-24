import type { Reason, ReplySettings, Ripple, Source, Store, StoreId, Ticket, WeekMinute } from './model';

/**
 * Kyle's stores in New York and South Carolina, Nov 15 to 21. The ten open
 * complaints are real, word for word, from Dunkin's feedback system. The
 * replied, resolved and compliment tickets around them are made up in the
 * same style so the week has a history. Manager and guest names, order
 * details and context lines are demo fiction.
 */

export const DISTRICT = { name: 'NY and SC stores', short: 'All stores', initials: 'NS', manager: 'Angela Ruiz', managerFirst: 'Angela' };

/** Demo figures for the week before (Nov 8 to 14), so this week has something to compare against. */
export const LAST_WEEK = { complaints: 17, compliments: 24 };

export const STORES: Store[] = [
  { id: 's301184', name: 'Poughkeepsie #301184', town: 'Poughkeepsie', state: 'NY', manager: 'Priya S.', managerFirst: 'Priya', avgReplyHours: 14 },
  { id: 's332974', name: 'Yonkers #332974', town: 'Yonkers', state: 'NY', manager: 'Keisha T.', managerFirst: 'Keisha', avgReplyHours: 9 },
  { id: 's340462', name: 'Bronx #340462', town: 'Bronx', state: 'NY', manager: 'Devon R.', managerFirst: 'Devon', avgReplyHours: 6 },
  { id: 's302692', name: 'White Plains #302692', town: 'White Plains', state: 'NY', manager: 'Nadia K.', managerFirst: 'Nadia', avgReplyHours: 8 },
  { id: 's302065', name: 'Greenville #302065', town: 'Greenville', state: 'SC', manager: 'Carmen V.', managerFirst: 'Carmen', avgReplyHours: 22 },
  { id: 's350605', name: 'Blythewood #350605', town: 'Blythewood', state: 'SC', manager: 'Omar H.', managerFirst: 'Omar', avgReplyHours: 17 },
  { id: 's358804', name: 'Irmo #358804', town: 'Irmo', state: 'SC', manager: 'Marcus Bell', managerFirst: 'Marcus', avgReplyHours: 19 },
  { id: 's345207', name: 'Greenville #345207', town: 'Greenville', state: 'SC', manager: 'Grace L.', managerFirst: 'Grace', avgReplyHours: 11 },
];

export const storeById = (id: StoreId): Store => STORES.find(s => s.id === id)!;

// ── The demo clock ─────────────────────────────────────────────────

/** Minutes since Sun, Nov 15 at midnight, for a day in November. */
export const t = (day: number, h: number, m = 0): WeekMinute => (day - 15) * 1440 + h * 60 + m;

/** Sat, Nov 21 at 9:30 PM, the end of the week. */
export const DEMO_NOW = t(21, 21, 30);

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function fmtClock(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const fmtTime = (at: WeekMinute) => fmtClock(((at % 1440) + 1440) % 1440);

const dayIndex = (at: WeekMinute) => ((Math.floor(at / 1440) % 7) + 7) % 7;

export function fmtDay(at: WeekMinute): string {
  return `${DAY_NAMES[dayIndex(at)]}, Nov ${15 + Math.floor(at / 1440)}`;
}

export const fmtLongDay = (at: WeekMinute) => `${DAY_LONG[dayIndex(at)]}, Nov ${15 + Math.floor(at / 1440)}`;

export const fmtWeekday = (at: WeekMinute) => DAY_NAMES[dayIndex(at)];

export const hoursWaiting = (at: WeekMinute) => Math.max(0, Math.floor((DEMO_NOW - at) / 60));

export function ageLabel(at: WeekMinute): string {
  const h = hoursWaiting(at);
  if (h < 1) return 'Just now';
  return h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// ── Ripples ────────────────────────────────────────────────────────

export const RIPPLES: Ripple[] = [
  {
    id: 'r-irmo-board',
    kind: 'price',
    reason: 'Charges',
    title: 'Drive-thru prices at Irmo',
    cause: { text: "The drive-thru board wasn't updated after the Nov 18 menu change, so it shows lower prices than the till charges.", from: 'Menu' },
    tag: 'Drive-thru board',
    causePhrase: 'the Irmo drive-thru board',
    headline: "Irmo's drive-thru board is behind the most complaints this week.",
    storeIds: ['s358804'],
    quoteIds: ['5105', '5106'],
    status: 'open',
    ownerSentence: 'Marcus has the drive-thru board.',
    resolveLabel: 'When the board matches the till',
    resolveHelp: (others, first) =>
      `Stays open with the other ${others} drive-thru price tickets. When the board is fixed, Edify drafts a follow-up to ${first} for you to approve.`,
    followUp: (first, sign) =>
      `Hi ${first}, a follow-up on the drive-thru prices. We've updated the board at Irmo so it matches what you pay at the window. Thanks for telling us.\n\n${sign}`,
  },
  {
    id: 'r-wp-bagcheck',
    kind: 'check-skipped',
    reason: 'Order Accuracy',
    title: 'Bag check at White Plains',
    cause: { text: 'The bag check at the handoff window was skipped on 3 shifts this week, the same shifts as the missing items.', from: 'Checklists and Compliance' },
    tag: 'Bag check skipped',
    causePhrase: 'the skipped bag check at White Plains',
    headline: 'A skipped bag check at White Plains is behind the most complaints this week.',
    storeIds: ['s302692'],
    quoteIds: ['5108', '5014'],
    status: 'open',
    ownerSentence: 'Nadia has the bag check.',
    resolveLabel: 'When the bag check is back on every shift',
    resolveHelp: (others, first) =>
      `Stays open with the other ${others} missing-item tickets. When the check is back on every shift, Edify drafts a follow-up to ${first} for you to approve.`,
    followUp: (first, sign) =>
      `Hi ${first}, a follow-up on your missing item. We check every bag at the window before it goes out now, on every shift. Thanks for telling us.\n\n${sign}`,
  },
  {
    id: 'r-gv-close',
    kind: 'early-close',
    reason: 'Hours',
    title: 'Mobile orders after an early close',
    cause: { text: 'Greenville #302065 closed at 6:40 PM on Nov 21. Mobile ordering stayed on until 9 PM, and 3 orders came in after close.', from: 'Sales and POS' },
    tag: 'Early close',
    causePhrase: 'mobile orders taken after an early close',
    headline: 'Mobile orders taken after an early close are behind the most complaints this week.',
    storeIds: ['s302065'],
    quoteIds: ['5102', '5015'],
    status: 'open',
    ownerSentence: 'Carmen has the mobile ordering switch.',
    resolveLabel: 'When mobile ordering turns off at close',
    resolveHelp: (others, first) =>
      `Stays open with the other ${others} early-close tickets. When mobile ordering turns off at close, Edify drafts a follow-up to ${first} for you to approve.`,
    followUp: (first, sign) =>
      `Hi ${first}, a follow-up on your mobile order. Mobile ordering now turns off the moment we close, so nobody pays for an order we can't make. Thanks for telling us.\n\n${sign}`,
  },
  {
    id: 'r-jasmine',
    kind: 'praise',
    reason: 'Compliment',
    title: 'Jasmine on the Yonkers drive-thru',
    tag: 'Jasmine',
    causePhrase: 'Jasmine',
    headline: '',
    storeIds: ['s332974'],
    quoteIds: ['5031'],
    status: 'closed',
    ownerSentence: '',
    resolveLabel: '',
    resolveHelp: () => '',
    followUp: () => '',
    action: { label: 'Tell Jasmine', done: 'Told Jasmine' },
  },
];

export const rippleById = (id?: string) => RIPPLES.find(r => r.id === id);

// ── Tickets ────────────────────────────────────────────────────────

const replied = (at: WeekMinute, reply: string): Ticket['seed'] => ({ status: 'replied', reply, sentAt: Math.min(at + 180, DEMO_NOW - 20), sentBy: 'person', resolveChoice: 'ripple' });
const resolved = (at: WeekMinute, reply: string, by: 'person' | 'edify' = 'person'): Ticket['seed'] => ({
  status: 'resolved', reply, sentAt: at + (by === 'edify' ? 2 : 240), sentBy: by, resolveChoice: 'reply', resolvedAt: at + (by === 'edify' ? 2 : 240),
});

const BOARD_REPLY = "you're right, and I'm sorry. Our drive-thru board is showing old prices, and we're getting it fixed.";
const BAG_REPLY = "I'm sorry your order was missing an item. We've put the bag check back on every order at the window.";
const CLOSE_REPLY = "I'm sorry. We closed early and mobile ordering should have closed with us. Your money is on its way back.";

/** The ten real complaints, open this morning. Wording is exactly as it came from Dunkin's feedback system. */
const REAL: Ticket[] = [
  {
    id: '5101', storeId: 's301184', guest: 'Rachel T.', reason: 'Receipt', source: 'dunkin', origin: 'Web / Website', at: t(15, 8, 42),
    words: "Rewards & Loyalty, Missing Order Transaction. Points weren't added to the app because the store's POS was down. No receipt either, so the guest sent a timestamped photo of the order.",
    context: [
      { text: 'The till at Poughkeepsie was offline from 7:58 to 9:20 AM on Nov 15. Orders were taken by hand.', strong: ['7:58 to 9:20 AM'], from: 'Sales and POS' },
      { text: '23 orders were keyed in after the till came back. None carried a rewards number.', from: 'Sales and POS' },
    ],
    phoneLine: 'Till offline 7:58 to 9:20 AM',
    drafts: {
      standard: "Hi Rachel, sorry about that. Our till was down on Sunday morning, so your points and receipt didn't go through. Thanks for sending the photo. We'll add the points to your app this week.",
      shorter: "Hi Rachel, sorry. Our till was down on Sunday morning. Thanks for the photo. We'll add your points this week.",
      warmer: "Hi Rachel, thank you for sending the photo, and sorry for the hassle. Our till was down on Sunday morning, which is why your points and receipt didn't come through. We'll add the points to your app this week.",
    },
  },
  {
    id: '5102', storeId: 's302065', guest: 'Tamika J.', reason: 'Hours', source: 'dunkin', origin: 'Virtual Agent', at: t(21, 19, 5), rippleId: 'r-gv-close', flag: 'refund',
    words: 'Placed a mobile order and was charged, but a sign at the store said it had closed early. Charged and got nothing.',
    context: [
      { text: 'Greenville #302065 closed at 6:40 PM on Nov 21. Mobile ordering stayed on until 9 PM.', strong: ['6:40 PM'], from: 'Sales and POS' },
      { text: 'Mobile order at 6:58 PM, $11.47, never made.', strong: ['6:58 PM'], from: 'Sales and POS' },
    ],
  },
  {
    id: '5103', storeId: 's332974', guest: 'Sam K.', reason: 'Taste', source: 'dunkin', origin: 'Mobile walk-in (FYI only)', at: t(21, 10, 20), fyiOnly: true,
    words: 'Poor Quality/Taste. Berry clementine lemonade tasted spoiled and sour. Also ordered a bagel twist and 2 donuts.',
    context: [
      { text: 'The last lemonade batch on the log was made at 2:10 PM on Nov 20. Menu says a batch keeps 8 hours.', strong: ['2:10 PM on Nov 20'], from: 'Checklists and Compliance' },
    ],
  },
  {
    id: '5104', storeId: 's350605', guest: 'Jordan P.', reason: 'Slow Service', source: 'dunkin', origin: 'Web / Mobile', at: t(21, 7, 50),
    words: 'Incorrect/Missing Item(s). Waited 20+ minutes with only 2 cars ahead. The coffee came without cold foam, "tasted like crap", and there was no straw.',
    context: [
      { text: 'Drive-thru times at Blythewood averaged 6 min 40 s from 7 to 8 AM on Nov 21. The rest of the week averaged 3 min 10 s.', strong: ['6 min 40 s'], from: 'Sales and POS' },
      { text: 'Cold foam was on the order and paid for, $1.25.', from: 'Sales and POS' },
    ],
    phoneLine: 'Drive-thru twice as slow 7 to 8 AM',
    drafts: {
      standard: "Hi Jordan, that's not good enough, and I'm sorry. Saturday's 7 AM rush was twice as slow as the rest of the week, and your cold foam and straw were missed. We're fixing how we staff that hour.",
      shorter: "Hi Jordan, sorry. Saturday's 7 AM rush was far too slow and your cold foam was missed. We're fixing how we staff that hour.",
      warmer: "Hi Jordan, I'm sorry. Twenty minutes with two cars ahead is far too long, and then the drink wasn't right either. Saturday's 7 AM rush was twice as slow as the rest of the week, and we're fixing how we staff it.",
    },
  },
  {
    id: '5105', storeId: 's358804', guest: 'Chris M.', reason: 'Team Member Friendliness', source: 'dunkin', origin: 'Email', at: t(21, 8, 15), rippleId: 'r-irmo-board',
    words: 'Drive-thru: the board showed $5.69 for a bacon, egg and cheese bagel, but the window asked for $8+. The order hadn\'t been put in, and the team member "copped an attitude" when questioned.',
    context: [
      { text: 'Menu has a bacon, egg and cheese bagel at $5.69. The drive-thru order at 8:06 AM rang through at $8.19.', strong: ['$8.19'], from: 'Sales and POS' },
      { text: "Irmo's drive-thru board still shows the layout from before the Nov 18 menu change.", from: 'Menu' },
    ],
    phoneLine: 'Board $5.69, till $8.19',
    drafts: {
      standard: "Hi Chris, I'm sorry. The board said $5.69 and you should have paid $5.69. Our drive-thru board is showing old prices and we're fixing it. How you were spoken to wasn't OK either, and I'm talking to the team about it.",
      shorter: "Hi Chris, sorry. You should have paid the $5.69 on the board. We're fixing the board, and I'm talking to the team about how you were spoken to.",
      warmer: "Hi Chris, thank you for telling us, and I'm sorry. The board said $5.69, so that's what you should have paid. Our drive-thru board is out of date and we're fixing it. You also deserved a friendlier answer at the window, and I'm talking to the team about it.",
    },
  },
  {
    id: '5106', storeId: 's358804', guest: 'Dana R.', reason: 'Charges', source: 'dunkin', origin: 'Web / Drive-thru', at: t(19, 12, 40), rippleId: 'r-irmo-board',
    words: 'Charged Incorrectly. Charged $5.27 for a medium hot coffee added at the drive-thru, which the guest says is the wrong price. Also waited 15+ minutes.',
    context: [
      { text: 'Menu has a medium hot coffee at $2.89. It rang through at $5.27 on Nov 19.', strong: ['$5.27'], from: 'Sales and POS' },
      { text: "Irmo's drive-thru board still shows the layout from before the Nov 18 menu change.", from: 'Menu' },
    ],
    phoneLine: 'Coffee $2.89 on Menu, charged $5.27',
    drafts: {
      standard: "Hi Dana, you're right, and I'm sorry. A medium hot coffee should have been $2.89. Our drive-thru board is showing old prices and we're getting it fixed. We'll refund the difference.",
      shorter: "Hi Dana, you're right. That coffee should have been $2.89. We're fixing the board and refunding the difference.",
      warmer: "Hi Dana, thanks for telling us, and sorry for the wait and the wrong price. A medium hot coffee should have been $2.89. Our drive-thru board is out of date, we're getting it fixed, and we'll refund the difference.",
    },
  },
  {
    id: '5107', storeId: 's340462', guest: 'Luis A.', reason: 'Foreign Object', source: 'dunkin', origin: 'Web / Mobile', at: t(16, 7, 25), flag: 'food-safety',
    words: 'Paper still stuck to the cheese and/or egg. The guest ate some before noticing.',
    context: [
      { text: 'Mobile order at 7:12 AM: sausage, egg and cheese on a croissant.', strong: ['7:12 AM'], from: 'Sales and POS' },
      { text: 'The food safety check on the opening checklist was signed off at 4:50 AM.', from: 'Checklists and Compliance' },
    ],
  },
  {
    id: '5108', storeId: 's302692', guest: 'Kim W.', reason: 'Order Accuracy', source: 'dunkin', at: t(21, 12, 30), rippleId: 'r-wp-bagcheck',
    words: 'Incorrect/Missing Item(s). Ordered a Wake-Up Wrap, hash browns and the $6 meal deal. The meal-deal sandwich was missing, which they only found back at work.',
    context: [
      { text: 'Order at 11:48 AM: Wake-Up Wrap, hash browns, $6 meal deal.', strong: ['11:48 AM'], from: 'Sales and POS' },
      { text: 'The bag check at the handoff window was skipped on the 11 AM to 3 PM shift.', from: 'Checklists and Compliance' },
    ],
    phoneLine: 'Bag check skipped on that shift',
    drafts: {
      standard: "Hi Kim, I'm sorry. You paid for the meal deal and the sandwich wasn't in the bag, and that's on us. We've put the bag check back on every order at the window.",
      shorter: "Hi Kim, sorry, the meal-deal sandwich should have been in your bag. We've put the bag check back on every order.",
      warmer: "Hi Kim, I'm really sorry. Finding the sandwich missing once you're back at work is the worst time to find out. That's on us, and we've put the bag check back on every order at the window.",
    },
  },
  {
    id: '5109', storeId: 's302692', guest: 'Pat O.', reason: 'Product Quality', source: 'dunkin', at: t(21, 15, 10), flag: 'food-safety',
    words: 'Poor Quality/Taste. Large coffee with cream and sugar. The guest says something about the drink was "unsafe" but gives no detail.',
    context: [
      { text: 'Order at 2:52 PM: large hot coffee, cream and sugar.', strong: ['2:52 PM'], from: 'Sales and POS' },
      { text: 'The 2 PM milk fridge temperature check was in range.', from: 'Checklists and Compliance' },
    ],
  },
  {
    id: '5110', storeId: 's345207', guest: 'Megan S.', reason: 'Foreign Object', source: 'dunkin', origin: 'Manual (social media reply)', at: t(21, 9, 40), flag: 'food-safety',
    words: "Curly dark hair inside the lid of an iced coffee. The guest says it can't be theirs because they're blonde.",
    context: [
      { text: 'Order at 9:22 AM: medium iced coffee.', strong: ['9:22 AM'], from: 'Sales and POS' },
      { text: 'The hair and hat check on the opening checklist was ticked at 5:05 AM.', from: 'Checklists and Compliance' },
    ],
  },
];

/** A complaint with a reason and no comment, linked to its ripple by the order time. */
const HELD: Ticket[] = [
  {
    id: '5016', storeId: 's302065', guest: 'Monique F.', reason: 'Hours', source: 'dunkin', origin: 'Virtual Agent', at: t(21, 19, 45), rippleId: 'r-gv-close',
    context: [{ text: 'Mobile order at 7:31 PM. The store had closed at 6:40 PM.', strong: ['7:31 PM'], from: 'Sales and POS' }],
  },
];

/** Compliments with no comment at Irmo: thank-yous for Marcus to send. */
const THANKS: Ticket[] = [
  { id: '5041', storeId: 's358804', guest: 'Ana C.', reason: 'Compliment', source: 'dunkin', origin: 'Web / Mobile', at: t(21, 6, 31), context: [] },
  { id: '5042', storeId: 's358804', guest: 'Mike B.', reason: 'Compliment', source: 'google', at: t(21, 9, 12), context: [] },
  { id: '5043', storeId: 's358804', guest: 'Tina R.', reason: 'Compliment', source: 'dunkin', origin: 'Web / Drive-thru', at: t(21, 13, 3), context: [] },
];

type Line = [id: string, store: StoreId, guest: string, reason: Reason, source: Source, origin: string | undefined, at: WeekMinute, words: string];

function heldWith(rippleId: string, reply: string, lines: Line[]): Ticket[] {
  return lines.map(([id, storeId, guest, reason, source, origin, at, words]) => ({
    id, storeId, guest, reason, source, origin, at, words, rippleId, context: [],
    seed: replied(at, `Hi ${guest.split(' ')[0]}, ${reply}`),
  }));
}

/** Replied and still open, held with their ripple. */
const REPLIED: Ticket[] = [
  ...heldWith('r-irmo-board', BOARD_REPLY, [
    ['5011', 's358804', 'Tyler B.', 'Charges', 'dunkin', 'Web / Drive-thru', t(18, 7, 35), 'Charged Incorrectly. Board says one price, the window charges another. Medium iced coffee was $3.49 on the board.'],
    ['5012', 's358804', 'Ashley M.', 'Charges', 'dunkin', 'Virtual Agent', t(20, 8, 10), 'Charged Incorrectly. Overcharged at the drive-thru again. The guest says the menu board is wrong.'],
  ]),
  ...heldWith('r-wp-bagcheck', BAG_REPLY, [
    ['5014', 's302692', 'Brianna L.', 'Order Accuracy', 'dunkin', 'Web / Drive-thru', t(19, 13, 5), 'Incorrect/Missing Item(s). Got a latte instead of the cold brew that was ordered.'],
  ]),
  ...heldWith('r-gv-close', CLOSE_REPLY, [
    ['5015', 's302065', 'Derek W.', 'Hours', 'dunkin', 'Web / Mobile', t(21, 19, 20), 'Mobile order went through but the doors were locked. A sign said the store closed early.'],
  ]),
];

const resolvedLines = (lines: Line[], reply: (first: string) => string, extra?: Partial<Ticket>): Ticket[] =>
  lines.map(([id, storeId, guest, reason, source, origin, at, words]) => ({
    id, storeId, guest, reason, source, origin, at, words: words || undefined, context: [], ...extra,
    seed: resolved(at, reply(guest.split(' ')[0]), words ? 'person' : 'edify'),
  }));

/** Resolved earlier in the week. */
const RESOLVED: Ticket[] = [
  {
    id: '5013', storeId: 's302692', guest: 'Kevin O.', reason: 'Order Accuracy', source: 'dunkin', origin: 'Web / Mobile', at: t(17, 12, 20), rippleId: 'r-wp-bagcheck',
    words: 'Incorrect/Missing Item(s). No hash browns in the bag.', context: [],
    seed: { ...resolved(t(17, 12, 20), `Hi Kevin, ${BAG_REPLY}`), resolveChoice: 'in-store', fix: 'refund', fixNote: 'Refunded the hash browns in the app.' },
  },
  ...resolvedLines(
    [
      ['5017', 's340462', 'Ray K.', 'Slow Service', 'dunkin', 'Web / Drive-thru', t(16, 8, 5), 'Long wait at the drive-thru this morning.'],
      ['5018', 's301184', 'Nia W.', 'Order Accuracy', 'dunkin', 'Web / Mobile', t(17, 9, 40), 'Incorrect/Missing Item(s). Hash browns missing from the order.'],
      ['5019', 's350605', 'Paul G.', 'Taste', 'dunkin', 'Web / Website', t(18, 14, 15), 'Poor Quality/Taste. Iced coffee was watery.'],
      ['5020', 's345207', 'Omar S.', 'Team Member Friendliness', 'dunkin', 'Email', t(19, 10, 30), "The cashier didn't say a word the whole order."],
      ['5021', 's332974', 'Lena V.', 'Product Quality', 'dunkin', 'Web / Mobile', t(20, 7, 50), 'Poor Quality/Taste. Donuts were stale.'],
      ['5022', 's358804', 'Greg H.', 'Slow Service', 'dunkin', 'Web / Drive-thru', t(17, 7, 20), 'Ten minutes in the drive-thru for one coffee.'],
    ],
    first => `Hi ${first}, thanks for telling us, and sorry. We've talked it through with the team.`,
  ),
  ...resolvedLines(
    [
      ['5031', 's332974', 'Nicole F.', 'Compliment', 'google', undefined, t(15, 8, 10), 'Jasmine is the reason I go to this Dunkin.'],
      ['5032', 's332974', 'Carlos M.', 'Compliment', 'dunkin', 'Web / Drive-thru', t(16, 7, 55), 'Jasmine at the drive-thru had me in and out in two minutes.'],
      ['5033', 's332974', 'Erin S.', 'Compliment', 'google', undefined, t(17, 16, 20), 'Jasmine always remembers my order.'],
      ['5034', 's332974', 'Tony A.', 'Compliment', 'dunkin', 'Web / Mobile', t(19, 8, 40), 'Shoutout to Jasmine, fast and friendly every time.'],
      ['5035', 's332974', 'Grace H.', 'Compliment', 'dunkin', 'Web / Drive-thru', t(21, 7, 15), 'Jasmine made my morning. Quick and smiling at 6am.'],
    ],
    first => `Hi ${first}, thank you. We've passed this straight to Jasmine.`,
    { rippleId: 'r-jasmine' },
  ),
  ...resolvedLines(
    [
      ['5036', 's358804', 'Monica D.', 'Compliment', 'dunkin', 'Web / Mobile', t(16, 6, 20), 'Tasha had my order ready before I got to the counter.'],
      ['5037', 's358804', 'Victor L.', 'Compliment', 'google', undefined, t(18, 7, 5), 'Tasha is so friendly in the mornings.'],
      ['5038', 's358804', 'Hannah K.', 'Compliment', 'dunkin', 'Email', t(20, 6, 45), 'Thank you Tasha for fixing my order with a smile.'],
    ],
    first => `Hi ${first}, thank you. We'll make sure Tasha hears this.`,
  ),
  ...resolvedLines(
    [
      ['5044', 's340462', 'Ben O.', 'Compliment', 'dunkin', 'Web / Mobile', t(15, 6, 15), ''],
      ['5045', 's340462', 'Ivy C.', 'Compliment', 'google', undefined, t(16, 9, 40), ''],
      ['5046', 's340462', 'Mo A.', 'Compliment', 'dunkin', 'Web / Drive-thru', t(18, 13, 5), ''],
      ['5047', 's302692', 'Kara J.', 'Compliment', 'dunkin', 'Web / Mobile', t(16, 10, 30), ''],
      ['5048', 's302692', 'Dev P.', 'Compliment', 'dunkin', 'Web / Website', t(18, 8, 50), ''],
      ['5049', 's302692', 'Lou T.', 'Compliment', 'google', undefined, t(20, 15, 20), ''],
    ],
    first => `Thanks for the kind words, ${first}. See you soon.`,
  ),
  ...resolvedLines(
    [
      ['5050', 's301184', 'Sara E.', 'Compliment', 'dunkin', 'Web / Mobile', t(15, 7, 30), 'Fast and friendly as always.'],
      ['5051', 's302065', 'Hugo M.', 'Compliment', 'google', undefined, t(15, 8, 45), 'Good coffee, quick service.'],
      ['5052', 's340462', 'Amy W.', 'Compliment', 'dunkin', 'Web / Mobile', t(16, 12, 10), 'Mobile order was ready when I walked in.'],
      ['5053', 's350605', 'Nate F.', 'Compliment', 'dunkin', 'Web / Drive-thru', t(16, 17, 25), 'Hot and on time.'],
      ['5054', 's302692', 'Ola B.', 'Compliment', 'google', undefined, t(16, 19, 5), 'Clean store, nice team.'],
      ['5055', 's345207', 'Ken Y.', 'Compliment', 'dunkin', 'Web / Drive-thru', t(17, 6, 40), 'Drive-thru was quick.'],
      ['5056', 's301184', 'Jill S.', 'Compliment', 'dunkin', 'Web / Website', t(17, 9, 15), 'Best cold brew around.'],
      ['5057', 's302065', 'Rae V.', 'Compliment', 'dunkin', 'Web / Mobile', t(18, 13, 30), 'Everything was in the bag this time.'],
      ['5058', 's350605', 'Sid K.', 'Compliment', 'dunkin', 'Email', t(19, 15, 50), 'Friendly crew this afternoon.'],
      ['5059', 's345207', 'Eve N.', 'Compliment', 'google', undefined, t(19, 18, 20), 'Good spot before work.'],
      ['5060', 's340462', 'Gus D.', 'Compliment', 'dunkin', 'Web / Drive-thru', t(20, 6, 25), 'Coffee was perfect.'],
      ['5061', 's301184', 'May L.', 'Compliment', 'dunkin', 'Web / Mobile', t(20, 9, 55), 'Quick and easy mobile pickup.'],
      ['5062', 's345207', 'Abe R.', 'Compliment', 'dunkin', 'Web / Website', t(21, 11, 40), 'Always a good stop.'],
    ],
    first => `Hi ${first}, thank you. Glad we got it right.`,
  ),
];

export const TICKETS: Ticket[] = [...REAL, ...HELD, ...THANKS, ...REPLIED, ...RESOLVED];

// ── Settings ───────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: ReplySettings = {
  district: 'person',
  stores: {
    s301184: 'person',
    s332974: 'person',
    s340462: 'edify-thanks',
    s302692: 'edify-thanks',
    s302065: 'person',
    s350605: 'person',
    s358804: 'person',
    s345207: 'person',
  },
  style: "Friendly and straight. Say what happened and what we're doing about it. No corporate apologies, no emojis, under 60 words.",
  signAs: 'manager',
  ownLine: true,
  remindManagerHours: 12,
  tellDistrictHours: 24,
};

// ── Huddle ─────────────────────────────────────────────────────────

/**
 * Praise names people; problems name processes. A problem line never names a
 * team member, so it comes from the ripple, not from the tickets.
 */
export const RIPPLE_HUDDLE_LINE: Record<string, string> = {
  'r-irmo-board': 'Check the drive-thru board matches the till before you open',
  'r-wp-bagcheck': 'Check every bag at the window before it goes out',
  'r-gv-close': 'If you close early, turn off mobile ordering first',
};

/** Team members guests name in praise, by store. */
export const TEAM_NAMES: Partial<Record<StoreId, string[]>> = { s332974: ['Jasmine'], s358804: ['Tasha'] };

export const HUDDLE_TIME = '4:45 AM';

/** The store whose manager the phone screens belong to. */
export const PHONE_STORE: StoreId = 's358804';
