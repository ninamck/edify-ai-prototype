import type { ReplySettings, Ripple, Source, Store, StoreId, Ticket, WeekMinute } from './model';

/**
 * The Bronx district story, Nov 16 to 20. Every count on screen is worked
 * out from these tickets: 26 low ratings, 17 of them from the bakery truck
 * and the iced coffee price, 9 waiting on a reply, 14 replied and still open,
 * 41 resolved this week.
 */

export const DISTRICT = { name: 'Bronx district', initials: 'BX', manager: 'Angela Ruiz', managerFirst: 'Angela' };

/** Demo figures for the week before (Nov 9 to 13), so this week has something to compare against. */
export const LAST_WEEK = { avgStars: 4.2, low: 14 };

export const STORES: Store[] = [
  { id: 'fordham', name: 'Fordham Rd', manager: 'Marcus Bell', managerFirst: 'Marcus', avgReplyHours: 19 },
  { id: 'tremont', name: 'E Tremont Ave', manager: 'Priya S.', managerFirst: 'Priya', avgReplyHours: 14 },
  { id: 'concourse', name: 'Grand Concourse', manager: 'Keisha T.', managerFirst: 'Keisha', avgReplyHours: 9 },
  { id: 'pelham', name: 'Pelham Pkwy', manager: 'Devon R.', managerFirst: 'Devon', avgReplyHours: 6 },
  { id: 'castlehill', name: 'Castle Hill Ave', manager: 'Carmen V.', managerFirst: 'Carmen', avgReplyHours: 22 },
  { id: 'westchester', name: 'Westchester Sq', manager: 'Nadia K.', managerFirst: 'Nadia', avgReplyHours: 8 },
];

export const storeById = (id: StoreId): Store => STORES.find(s => s.id === id)!;

// ── The demo clock ─────────────────────────────────────────────────

/** Minutes since Mon, Nov 16 at midnight, for a day in November. */
export const t = (day: number, h: number, m = 0): WeekMinute => (day - 16) * 1440 + h * 60 + m;

/** Fri, Nov 20 at 9:14 AM. Dana's ticket has been waiting 26 hours. */
export const DEMO_NOW = t(20, 9, 14);

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function fmtClock(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const fmtTime = (at: WeekMinute) => fmtClock(((at % 1440) + 1440) % 1440);

export function fmtDay(at: WeekMinute): string {
  const d = Math.floor(at / 1440);
  return `${DAY_NAMES[((d % 7) + 7) % 7]}, Nov ${16 + d}`;
}

export const fmtWeekday = (at: WeekMinute) => DAY_NAMES[((Math.floor(at / 1440) % 7) + 7) % 7];

export const hoursWaiting = (at: WeekMinute) => Math.max(0, Math.floor((DEMO_NOW - at) / 60));

export function ageLabel(at: WeekMinute): string {
  const h = hoursWaiting(at);
  return h < 1 ? 'Just now' : `${h}h`;
}

// ── Ripples ────────────────────────────────────────────────────────

export const BAKERY_DELIVERIES: { day: string; at: number }[] = [
  { day: 'Mon', at: 4 * 60 + 28 },
  { day: 'Tue', at: 6 * 60 + 41 },
  { day: 'Wed', at: 4 * 60 + 35 },
  { day: 'Thu', at: 6 * 60 + 52 },
  { day: 'Fri', at: 6 * 60 + 38 },
];
export const STORE_OPENS = 5 * 60;

export const RIPPLES: Ripple[] = [
  {
    id: 'r-bakery',
    kind: 'late-delivery',
    chip: 'Late delivery · 3 mornings',
    title: 'Bakery truck arriving after 6:30 AM',
    detail: { text: 'Fordham Rd and E Tremont Ave. Usually in by 4:30 AM. From receiving in Ordering and Stock.' },
    tag: 'Late bakery delivery',
    causePhrase: 'the bakery truck',
    headline: "Late bakery deliveries are behind most of this week's complaints.",
    offFloor: true,
    storeIds: ['fordham', 'tremont'],
    quoteIds: ['4471', '4462'],
    numberKind: 'open',
    numberLabel: n => `Open tickets at ${n} ${n === 1 ? 'store' : 'stores'}.`,
    support: 'Boston Kreme sold out before 7:15 AM on all three days.',
    owner: 'the bakery',
    status: 'with',
    done: 'Sent to the bakery, Thu',
    ownerSentence: 'Angela has the bakery.',
    resolveLabel: "When the bakery's back on time",
    resolveHelp: (others, first) =>
      `Stays open with the other ${others} late-delivery tickets. After a week of deliveries before 5 AM, Edify drafts a follow-up to ${first} for you to approve.`,
    fixRule: 'Bakery deliveries before 5 AM for seven days in a row.',
    followUp: (first, sign) =>
      `Hi ${first}, a follow-up on the Boston Kremes. Our bakery deliveries have been in before 5 AM every day for a week, so the case is full when we open. Thanks for telling us.\n\n${sign}`,
  },
  {
    id: 'r-price',
    kind: 'price',
    chip: 'Price change · Nov 9',
    title: 'Medium iced coffee up 30¢',
    detail: { struck: '$3.49', text: ' to $3.79 at 4 stores, set in Menu' },
    tag: 'Iced coffee price',
    causePhrase: 'the iced coffee price',
    headline: 'The iced coffee price is behind most of this week\'s complaints.',
    offFloor: true,
    storeIds: ['fordham', 'tremont', 'pelham', 'westchester'],
    quoteIds: ['4486', '4465'],
    numberKind: 'guests',
    numberLabel: () => 'Guests mentioned the price. Medium iced coffee sales are down 4% since.',
    support: 'Medium iced coffee sales are down 4% since Nov 9.',
    owner: 'the owner',
    status: 'with',
    ownerSentence: 'The owner sets prices.',
    resolveLabel: 'When the owner decides on the price',
    resolveHelp: (others, first) =>
      `Stays open with the other ${others} price tickets. When the owner decides, Edify drafts a follow-up to ${first} for you to approve.`,
    fixRule: 'The owner has decided on the medium iced coffee price.',
    followUp: (first, sign) =>
      `Hi ${first}, following up on your note about the medium iced coffee price. The owner has looked at it again after hearing from guests like you. Thanks for telling us.\n\n${sign}`,
  },
  {
    id: 'r-bagcheck',
    kind: 'check-skipped',
    chip: 'Check skipped · 4 times',
    title: 'Mobile order bag check at Grand Concourse',
    detail: { text: 'From Checklists and Compliance' },
    tag: 'Bag check skipped',
    causePhrase: 'the skipped bag check',
    headline: 'A skipped bag check is behind most of this week\'s complaints.',
    offFloor: false,
    storeIds: ['concourse'],
    quoteIds: ['4492', '4467'],
    numberKind: 'guests',
    numberLabel: () => 'Orders missing an item, all on shifts where the check was skipped',
    support: 'The bag check was skipped on 4 shifts this week.',
    owner: 'Keisha T.',
    status: 'with',
    done: 'Task raised for Keisha T.',
    ownerSentence: 'Keisha has the bag check.',
    resolveLabel: 'When the bag check is back on every shift',
    resolveHelp: (others, first) =>
      `Stays open with the other ${others} missing-item tickets. After a week of bag checks on every shift, Edify drafts a follow-up to ${first} for you to approve.`,
    fixRule: 'Bag check done on every mobile order shift for seven days.',
    followUp: (first, sign) =>
      `Hi ${first}, a follow-up on your missing item. We check every mobile order bag before it goes out now, and it's been done on every shift for a week. Thanks for telling us.\n\n${sign}`,
  },
  {
    id: 'r-jasmine',
    kind: 'praise',
    chip: 'Going well',
    title: 'Jasmine on the Pelham Pkwy drive-thru',
    detail: { text: 'Named by guests for speed and a smile' },
    tag: 'Jasmine',
    causePhrase: 'Jasmine',
    headline: '',
    offFloor: false,
    storeIds: ['pelham'],
    quoteIds: ['4430'],
    numberKind: 'guests',
    numberLabel: () => 'Guests named her this week',
    support: '',
    owner: '',
    status: 'closed',
    ownerSentence: '',
    resolveLabel: '',
    resolveHelp: () => '',
    fixRule: '',
    followUp: () => '',
    action: { label: 'Tell Jasmine', done: 'Told Jasmine' },
  },
];

export const rippleById = (id?: string) => RIPPLES.find(r => r.id === id);

// ── Tickets ────────────────────────────────────────────────────────

const replied = (at: WeekMinute, reply: string): Ticket['seed'] => ({ status: 'replied', reply, sentAt: at + 180, sentBy: 'person', resolveChoice: 'ripple' });
const resolved = (at: WeekMinute, reply: string, by: 'person' | 'edify' = 'person'): Ticket['seed'] => ({
  status: 'resolved', reply, sentAt: at + (by === 'edify' ? 2 : 240), sentBy: by, resolveChoice: 'reply', resolvedAt: at + (by === 'edify' ? 2 : 240),
});

const BAKERY_REPLY = "you're right, and I'm sorry. Our bakery delivery has been coming in late and we've taken it up with the bakery directly.";
const PRICE_REPLY = "thanks for telling us. The price went up on Nov 9 and I've passed your note to the owner, who sets prices for our stores.";
const BAG_REPLY = "I'm sorry your order was missing an item. We've put the bag check back on every mobile order.";

/** The tickets with drafts: the ones waiting on a reply this morning. */
const WAITING: Ticket[] = [
  {
    id: '4471', storeId: 'fordham', guest: 'Dana K.', stars: 2, source: 'dunkin', at: t(19, 7, 14), rippleId: 'r-bakery',
    words: '7am and no Boston Kreme. Again. Third time this week.',
    context: [
      { text: "Bakery delivery came in at 6:52 AM. It's usually in by 4:30.", strong: ['6:52 AM'], from: 'Ordering and Stock' },
      { text: 'Boston Kreme sold out at 7:09 AM. It usually lasts past 10.', strong: ['7:09 AM'], from: 'Sales and POS' },
      { text: 'Dana has reviewed this store twice before, both 5 stars.', from: 'Dunkin feedback' },
    ],
    phoneLine: 'Bakery in at 6:52 AM, sold out 7:09',
    drafts: {
      standard: "Hi Dana, you're right, and I'm sorry. Our bakery delivery came in late this morning and the Boston Kremes were gone by 7:10. It's happened three times this week, so we've taken it up with the bakery directly.",
      shorter: "Hi Dana, you're right, and I'm sorry. The bakery delivery was late and the Boston Kremes were gone by 7:10. We've taken it up with the bakery.",
      warmer: "Hi Dana, thank you for telling us, and I'm sorry. You came in for a Boston Kreme three mornings this week and we didn't have one. Our bakery delivery has been running late, and we've taken it up with them directly.",
    },
  },
  {
    id: '4486', storeId: 'tremont', guest: 'Rob M.', stars: 2, source: 'dunkin', at: t(19, 14, 14), rippleId: 'r-price',
    words: '$3.79 for a medium iced? Getting ridiculous.',
    context: [
      { text: 'Medium iced coffee went from $3.49 to $3.79 on Nov 9.', strong: ['$3.79'], from: 'Menu' },
      { text: 'Rob has bought a medium iced coffee here 31 times since September.', from: 'Sales and POS' },
    ],
    phoneLine: 'Price went up 30¢ on Nov 9',
    drafts: {
      standard: "Hi Rob, that's fair, and thanks for saying it. The medium iced coffee went up on Nov 9, and I've passed your note to the owner, who sets prices for our stores.",
      shorter: "Hi Rob, fair point. The price went up on Nov 9 and I've passed your note to the owner, who sets our prices.",
      warmer: "Hi Rob, thanks for being straight with us, and for coming in so often. The medium iced went up on Nov 9. I've passed your note to the owner, who sets prices for our stores, so it's heard where it counts.",
    },
  },
  {
    id: '4492', storeId: 'concourse', guest: 'Tanya W.', stars: 1, source: 'doordash', at: t(20, 0, 14), rippleId: 'r-bagcheck',
    words: "Paid for hash browns, didn't get them.",
    context: [
      { text: 'DoorDash order at 11:52 PM: iced latte, sausage egg and cheese, hash browns.', from: 'Sales and POS' },
      { text: 'The mobile order bag check was skipped on that shift.', from: 'Checklists and Compliance' },
    ],
    phoneLine: 'Bag check skipped on that shift',
    drafts: {
      standard: "Hi Tanya, I'm sorry. You paid for hash browns and they weren't in the bag, and that's on us. We've put the bag check back on every mobile order.",
      shorter: "Hi Tanya, sorry, the hash browns should have been in your bag. We've put the bag check back on every mobile order.",
      warmer: "Hi Tanya, I'm really sorry. You paid for hash browns and opened the bag to find them missing. That's on us, and we've put the bag check back on every mobile order so it doesn't happen again.",
    },
  },
  {
    id: '4496', storeId: 'westchester', guest: 'Chris O.', stars: 3, source: 'google', at: t(20, 5, 14),
    words: 'Restroom was out of order all morning.',
    context: [
      { text: 'No maintenance issue was logged at Westchester Sq this week.', from: 'Checklists and Compliance' },
      { text: 'The restroom check on the opening checklist was ticked at 5:02 AM.', strong: ['5:02 AM'], from: 'Checklists and Compliance' },
    ],
    phoneLine: 'Restroom check ticked at 5:02 AM',
    drafts: {
      standard: "Hi Chris, sorry about that. I'm finding out why the restroom was out of order and getting it fixed today.",
      shorter: "Hi Chris, sorry. We're getting the restroom fixed today.",
      warmer: "Hi Chris, thanks for letting us know, and sorry it spoiled your morning. I'm finding out why the restroom was out of order and getting it fixed today.",
    },
  },
  {
    id: '4498', storeId: 'fordham', guest: 'Pat L.', stars: 2, source: 'ubereats', at: t(20, 7, 21), rippleId: 'r-bakery',
    words: 'Ordered two Boston Kremes, got glazed instead. No call, no note.',
    context: [
      { text: 'Uber Eats order at 7:02 AM. Boston Kreme had sold out at 6:58 AM, so the store swapped in glazed.', strong: ['6:58 AM'], from: 'Sales and POS' },
      { text: 'Bakery delivery came in at 6:38 AM.', strong: ['6:38 AM'], from: 'Ordering and Stock' },
    ],
    phoneLine: 'Sold out 6:58 AM, swapped for glazed',
    drafts: {
      standard: "Hi Pat, I'm sorry. We'd run out of Boston Kremes when your order came in, and we should have told you before swapping. Our bakery delivery has been late this week and we've taken it up with them.",
      shorter: "Hi Pat, sorry. We'd sold out of Boston Kremes and should have told you before swapping.",
      warmer: "Hi Pat, I'm sorry. You ordered Boston Kremes and got something else without a word from us. We'd run out because the bakery delivery was late, and we should have told you. We've taken the deliveries up with the bakery.",
    },
  },
  {
    id: '4499', storeId: 'fordham', guest: 'Jordan S.', stars: 4, source: 'google', at: t(20, 6, 40),
    words: 'Good coffee, line was long at 6:30.',
    context: [
      { text: '18 orders between 6:15 and 6:45 AM, the busiest half hour this week.', strong: ['18 orders'], from: 'Sales and POS' },
    ],
    phoneLine: 'Busiest half hour this week',
    drafts: {
      standard: "Hi Jordan, thanks for the four stars. 6:30 was our busiest half hour this week, and we're looking at how we staff it.",
      shorter: 'Hi Jordan, thanks. 6:30 was our busiest half hour this week and we\'re on it.',
      warmer: "Hi Jordan, thank you, glad the coffee was good. 6:30 was our busiest half hour this week, and we're looking at how we staff it so the line moves faster.",
    },
  },
  {
    id: '4472', storeId: 'castlehill', guest: 'Maria G.', stars: 1, source: 'dunkin', at: t(19, 8, 10), flag: 'allergy',
    words: 'I told them I have a dairy allergy. My sandwich came with cheese.',
    context: [
      { text: 'Order at 8:02 AM: Wake-Up Wrap, no cheese, with an allergy note.', strong: ['8:02 AM'], from: 'Sales and POS' },
      { text: 'The allergen check on the opening checklist was signed off at 4:51 AM.', from: 'Checklists and Compliance' },
    ],
  },
  {
    id: '4494', storeId: 'westchester', guest: 'Kevin D.', stars: 2, source: 'dunkin', at: t(20, 6, 5), flag: 'refund',
    words: 'Coffee tasted burnt. I want my money back.',
    context: [
      { text: 'Order at 5:48 AM: large hot coffee, $3.19.', strong: ['5:48 AM'], from: 'Sales and POS' },
      { text: 'The brewer was cleaned at 9:40 PM yesterday, per the closing checklist.', from: 'Checklists and Compliance' },
    ],
  },
  {
    id: '4490', storeId: 'tremont', guest: 'Alicia R.', stars: 2, source: 'google', at: t(20, 7, 50), flag: 'named-team-member',
    words: 'Guy on the register, Mike, rolled his eyes when I asked for oat milk.',
    context: [{ text: 'Order at 7:36 AM: medium latte with oat milk.', strong: ['7:36 AM'], from: 'Sales and POS' }],
  },
];

/** Low ratings with no comment, linked to the bakery ripple by their order. */
const HELD: Ticket[] = [
  {
    id: '4500', storeId: 'fordham', guest: 'Sam P.', stars: 2, source: 'ubereats', at: t(20, 7, 48), rippleId: 'r-bakery',
    context: [{ text: 'Uber Eats order at 7:31 AM included a Boston Kreme. It had sold out at 6:58 AM.', strong: ['6:58 AM'], from: 'Sales and POS' }],
  },
  {
    id: '4501', storeId: 'fordham', guest: 'Lee W.', stars: 2, source: 'dunkin', at: t(20, 8, 5), rippleId: 'r-bakery',
    context: [{ text: 'Ordered a Boston Kreme in the Dunkin app at 7:40 AM. It had sold out at 6:58 AM.', strong: ['6:58 AM'], from: 'Sales and POS' }],
  },
];

/** Five stars, no comment, at Fordham Rd: thank-yous for Marcus to send. */
const THANKS: Ticket[] = [
  { id: '4502', storeId: 'fordham', guest: 'Ana C.', stars: 5, source: 'dunkin', at: t(20, 5, 31), context: [] },
  { id: '4503', storeId: 'fordham', guest: 'Mike B.', stars: 5, source: 'google', at: t(20, 6, 12), context: [] },
  { id: '4504', storeId: 'fordham', guest: 'Tina R.', stars: 5, source: 'dunkin', at: t(20, 7, 3), context: [] },
  { id: '4505', storeId: 'fordham', guest: 'Joe F.', stars: 5, source: 'ubereats', at: t(20, 8, 26), context: [] },
];

type Line = [id: string, store: StoreId, guest: string, stars: Ticket['stars'], source: Source, at: WeekMinute, words: string];

function heldWith(rippleId: string, reply: string, lines: Line[]): Ticket[] {
  return lines.map(([id, storeId, guest, stars, source, at, words]) => ({
    id, storeId, guest, stars, source, at, words, rippleId, context: [],
    seed: replied(at, `Hi ${guest.split(' ')[0]}, ${reply}`),
  }));
}

/** Replied and still open, held with their ripple. */
const REPLIED: Ticket[] = [
  ...heldWith('r-bakery', BAKERY_REPLY, [
    ['4462', 'tremont', 'Luis P.', 2, 'google', t(17, 7, 40), 'Half the donut case was empty before work.'],
    ['4460', 'fordham', 'Kim A.', 2, 'dunkin', t(17, 7, 5), "No Boston Kreme at 7. What's the point."],
    ['4461', 'tremont', 'Jose R.', 3, 'ubereats', t(17, 6, 50), 'Donut case half empty at 6:45am.'],
    ['4474', 'fordham', 'Tamika B.', 2, 'dunkin', t(19, 7, 30), 'Wanted a jelly, they had none.'],
    ['4475', 'tremont', 'Greg H.', 2, 'google', t(19, 7, 12), 'Sold out of half the donuts by 7. Come on.'],
    ['4476', 'fordham', 'Lena V.', 3, 'doordash', t(19, 7, 48), 'Boston Kreme gone again before work.'],
    ['4495', 'tremont', 'Omar S.', 2, 'dunkin', t(20, 6, 55), 'Kid wanted a Boston Kreme. None left.'],
  ]),
  ...heldWith('r-price', PRICE_REPLY, [
    ['4465', 'westchester', 'Sam T.', 3, 'ubereats', t(18, 9, 20), 'Prices keep creeping up.'],
    ['4463', 'fordham', 'Dee M.', 2, 'dunkin', t(17, 8, 15), 'Medium iced is almost four bucks now.'],
    ['4464', 'pelham', 'Ray K.', 3, 'google', t(18, 7, 45), 'Went up again? Really?'],
    ['4477', 'tremont', 'Nia W.', 2, 'dunkin', t(19, 10, 2), '$3.79 for iced coffee is a lot.'],
    ['4478', 'westchester', 'Paul G.', 3, 'google', t(19, 12, 30), 'Love the coffee, not the new price.'],
  ]),
  ...heldWith('r-bagcheck', BAG_REPLY, [
    ['4467', 'concourse', 'Andre B.', 2, 'dunkin', t(18, 17, 40), 'Missing my Munchkins. Kid was not happy.'],
    ['4479', 'concourse', 'Rita J.', 2, 'ubereats', t(19, 18, 5), 'No straws, no napkins, no hash browns.'],
  ]),
];

const fixedInStore = (line: Line, fix: 'refund' | 'remake', note: string): Ticket => {
  const [id, storeId, guest, stars, source, at, words] = line;
  return {
    id, storeId, guest, stars, source, at, words, rippleId: 'r-bagcheck', context: [],
    seed: { ...resolved(at, `Hi ${guest.split(' ')[0]}, ${BAG_REPLY}`), resolveChoice: 'in-store', fix, fixNote: note },
  };
};

const resolvedLines = (lines: Line[], reply: (first: string) => string, extra?: Partial<Ticket>): Ticket[] =>
  lines.map(([id, storeId, guest, stars, source, at, words]) => ({
    id, storeId, guest, stars, source, at, words: words || undefined, context: [], ...extra,
    seed: resolved(at, reply(guest.split(' ')[0]), words ? 'person' : 'edify'),
  }));

/** Resolved this week: 41 in all. */
const RESOLVED: Ticket[] = [
  fixedInStore(['4466', 'concourse', 'Will N.', 2, 'doordash', t(17, 19, 10), 'Mobile order came without my coffee.'], 'refund', 'Refunded the coffee on DoorDash.'),
  fixedInStore(['4468', 'concourse', 'Beth L.', 3, 'dunkin', t(18, 12, 25), "Got someone else's order."], 'remake', 'Remade the order when she came back in.'),
  ...resolvedLines(
    [
      ['4430', 'pelham', 'Nicole F.', 5, 'google', t(16, 8, 10), 'Jasmine is the reason I go to this Dunkin.'],
      ['4431', 'pelham', 'Carlos M.', 5, 'dunkin', t(17, 7, 55), 'Jasmine at the drive-thru had me in and out in two minutes.'],
      ['4432', 'pelham', 'Erin S.', 5, 'google', t(17, 16, 20), 'Jasmine always remembers my order. Best drive-thru in the Bronx.'],
      ['4433', 'pelham', 'Tony A.', 5, 'dunkin', t(18, 8, 40), 'Shoutout to Jasmine, fast and friendly every time.'],
      ['4434', 'pelham', 'Grace H.', 5, 'ubereats', t(19, 7, 15), 'Jasmine made my morning. Quick and smiling at 6am.'],
      ['4435', 'pelham', 'Leon P.', 5, 'dunkin', t(20, 6, 30), 'Jasmine on the window is a star.'],
    ],
    first => `Hi ${first}, thank you. We've passed this straight to Jasmine.`,
    { rippleId: 'r-jasmine' },
  ),
  ...resolvedLines(
    [
      ['4440', 'fordham', 'Monica D.', 5, 'dunkin', t(17, 6, 20), 'Tasha had my order ready before I got to the counter.'],
      ['4441', 'fordham', 'Victor L.', 5, 'google', t(18, 7, 5), 'Tasha is so friendly in the mornings.'],
      ['4442', 'fordham', 'Hannah K.', 5, 'dunkin', t(19, 6, 45), 'Thank you Tasha for fixing my order with a smile.'],
    ],
    first => `Hi ${first}, thank you. We'll make sure Tasha hears this.`,
  ),
  ...resolvedLines(
    [
      ['4410', 'pelham', 'Ben O.', 5, 'dunkin', t(16, 6, 15), ''],
      ['4411', 'pelham', 'Ivy C.', 5, 'google', t(17, 9, 40), ''],
      ['4412', 'pelham', 'Mo A.', 5, 'dunkin', t(18, 13, 5), ''],
      ['4413', 'westchester', 'Kara J.', 5, 'dunkin', t(16, 10, 30), ''],
      ['4414', 'westchester', 'Dev P.', 5, 'ubereats', t(17, 8, 50), ''],
      ['4415', 'westchester', 'Lou T.', 5, 'google', t(18, 15, 20), ''],
      ['4416', 'pelham', 'Zoe R.', 5, 'dunkin', t(19, 11, 45), ''],
      ['4417', 'westchester', 'Raj B.', 5, 'dunkin', t(19, 16, 10), ''],
    ],
    first => `Thanks for the five stars, ${first}. See you soon.`,
  ),
  ...resolvedLines(
    [
      ['4420', 'fordham', 'Sara E.', 5, 'dunkin', t(16, 7, 30), 'Fast and friendly as always.'],
      ['4421', 'tremont', 'Hugo M.', 4, 'google', t(16, 8, 45), 'Good coffee, quick service.'],
      ['4422', 'concourse', 'Amy W.', 5, 'dunkin', t(16, 12, 10), 'Mobile order was ready when I walked in.'],
      ['4423', 'castlehill', 'Nate F.', 4, 'ubereats', t(16, 17, 25), 'Hot and on time.'],
      ['4424', 'westchester', 'Ola B.', 5, 'google', t(16, 19, 5), 'Clean store, nice team.'],
      ['4425', 'pelham', 'Ken Y.', 4, 'dunkin', t(17, 6, 40), 'Drive-thru was quick.'],
      ['4426', 'tremont', 'Jill S.', 5, 'dunkin', t(17, 9, 15), 'Best cold brew around.'],
      ['4427', 'concourse', 'Rae V.', 4, 'doordash', t(17, 13, 30), 'Everything was in the bag this time.'],
      ['4428', 'castlehill', 'Sid K.', 5, 'dunkin', t(17, 15, 50), 'Friendly crew this afternoon.'],
      ['4429', 'fordham', 'Eve N.', 4, 'google', t(17, 18, 20), 'Good spot before the train.'],
      ['4436', 'westchester', 'Gus D.', 5, 'dunkin', t(18, 6, 25), 'Coffee was perfect.'],
      ['4437', 'tremont', 'May L.', 4, 'ubereats', t(18, 9, 55), 'Arrived warm.'],
      ['4438', 'castlehill', 'Abe R.', 5, 'google', t(18, 11, 40), 'Always a good stop.'],
      ['4439', 'concourse', 'Ida P.', 4, 'dunkin', t(18, 14, 15), 'Quick and easy mobile pickup.'],
      ['4443', 'pelham', 'Ron T.', 5, 'dunkin', t(18, 16, 35), 'Great iced latte.'],
      ['4444', 'westchester', 'Fay M.', 4, 'doordash', t(18, 20, 10), 'Order was right.'],
      ['4445', 'castlehill', 'Ty G.', 5, 'dunkin', t(19, 6, 5), 'Nice and quick before work.'],
      ['4446', 'tremont', 'Liv H.', 4, 'google', t(19, 9, 30), 'Friendly cashier.'],
      ['4447', 'concourse', 'Max E.', 5, 'dunkin', t(19, 12, 45), 'Love the new seasonal latte.'],
      ['4448', 'fordham', 'Una S.', 4, 'dunkin', t(19, 16, 20), 'Good afternoon pick-me-up.'],
      ['4449', 'pelham', 'Cal W.', 5, 'ubereats', t(19, 19, 40), 'Fast delivery, still hot.'],
      ['4450', 'castlehill', 'Bea O.', 4, 'google', t(20, 6, 15), 'Quick service this morning.'],
    ],
    first => `Hi ${first}, thank you. Glad we got it right.`,
  ),
];

export const TICKETS: Ticket[] = [...WAITING, ...HELD, ...THANKS, ...REPLIED, ...RESOLVED];

// ── Settings ───────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: ReplySettings = {
  district: 'person',
  stores: {
    fordham: 'person',
    tremont: 'person',
    concourse: 'person',
    pelham: 'edify-thanks',
    castlehill: 'person',
    westchester: 'edify-thanks',
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
  'r-bakery': 'If the case is light, tell guests why',
  'r-price': 'If a guest asks about the iced coffee price, the owner has their notes',
  'r-bagcheck': 'Check every mobile order bag before it goes out',
};

/** Team members guests name in praise, by store. */
export const TEAM_NAMES: Partial<Record<StoreId, string[]>> = { fordham: ['Tasha'], pelham: ['Jasmine'] };

export const HUDDLE_TIME = '4:45 AM';
