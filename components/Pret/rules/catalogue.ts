import { usePretState } from '@/components/Pret/pretStore';

/**
 * Pret's rules, values and schedules, built from a vocabulary every customer shares.
 * Pret's entries are data: another customer gets the same trigger points and effects
 * with its own values. See RULES-CATALOGUE.md.
 */

export type Area = 'forecast' | 'ordering' | 'counting' | 'deliveries' | 'transfers' | 'cash' | 'tasks';
export type Kind = 'rule' | 'value' | 'schedule';

export const AREAS: { id: Area; label: string }[] = [
  { id: 'forecast', label: 'Forecast' },
  { id: 'ordering', label: 'Ordering' },
  { id: 'counting', label: 'Counting and stock' },
  { id: 'deliveries', label: 'Deliveries and credits' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'cash', label: 'Cash' },
  { id: 'tasks', label: 'Tasks and checklists' },
];

/** The points in Edify's workflows a rule can attach to. */
export const TRIGGERS = {
  'forecast-changed': { area: 'forecast', label: 'A manager changes a forecast' },
  'order-line-changed': { area: 'ordering', label: 'Someone changes an order line' },
  'order-due': { area: 'ordering', label: 'An order is due (a set time before cut-off)' },
  'order-cutoff': { area: 'ordering', label: 'An order reaches cut-off' },
  'order-send-failed': { area: 'ordering', label: 'An order fails to reach the supplier' },
  'count-saved': { area: 'counting', label: 'A count is saved' },
  'count-overdue': { area: 'counting', label: 'A count is overdue' },
  'stock-looks-wrong': { area: 'counting', label: 'Stock looks wrong' },
  'recall-issued': { area: 'counting', label: 'A recall is issued' },
  'period-closed': { area: 'counting', label: 'The month closes' },
  'delivery-confirmed': { area: 'deliveries', label: 'A delivery is confirmed' },
  'delivery-line-different': { area: 'deliveries', label: 'A delivery line arrives different' },
  'claim-submitted': { area: 'deliveries', label: 'A credit claim is submitted' },
  'claim-ageing': { area: 'deliveries', label: 'A credit claim reaches an age' },
  'transfer-sent': { area: 'transfers', label: 'A transfer is sent' },
  'cash-count-saved': { area: 'cash', label: 'A cash count is saved' },
  'cash-close-started': { area: 'cash', label: 'A shop starts closing the day' },
  'till-pattern': { area: 'cash', label: 'Till activity matches a pattern' },
  'safe-over-limit': { area: 'cash', label: 'The cash in a safe goes up' },
  'correction-made': { area: 'counting', label: 'Someone corrects a saved record' },
} as const satisfies Record<string, { area: Area; label: string }>;
export type Trigger = keyof typeof TRIGGERS;

/** What a rule can do. Eight effects cover every rule Pret has asked for. */
export const EFFECTS = {
  warn: 'Warn',
  'ask-reason': 'Ask for a reason, a photo or a reading',
  'second-person': 'Ask a second person',
  approval: 'Need approval',
  block: 'Block',
  task: 'Create a task',
  notify: 'Notify',
  edify: 'Let Edify do it',
} as const;
export type Effect = keyof typeof EFFECTS;

export const EDIFY_LEVEL = {
  suggests: 'Edify suggests, a person acts',
  'acts-unless-stopped': 'Edify acts unless someone steps in',
  'acts-and-reports': 'Edify acts and reports it',
} as const;
export type EdifyLevel = keyof typeof EDIFY_LEVEL;

export type ShopType = 'airport' | 'station' | 'high-street' | 'hub';
export type Where = { kind: 'all' } | { kind: 'types'; types: ShopType[] } | { kind: 'shops'; ids: string[] };

export const SHOPS: { id: string; name: string; type: Exclude<ShopType, 'hub'>; hub?: boolean }[] = [
  { id: 'fitzroy-espresso', name: 'Pret Victoria Hub', type: 'high-street', hub: true },
  { id: 'fitzroy-kings-cross', name: "King's Cross", type: 'station' },
  { id: 'fitzroy-heathrow', name: 'Heathrow T5', type: 'airport' },
  { id: 'fitzroy-islington', name: 'Islington', type: 'high-street' },
];

const TYPE_LABEL: Record<ShopType, string> = { airport: 'Airport shops', station: 'Station shops', 'high-street': 'High street shops', hub: 'Hubs' };

export function whereLabel(w: Where): string {
  if (w.kind === 'all') return 'Every shop';
  if (w.kind === 'types') {
    const labels = w.types.map(t => TYPE_LABEL[t]);
    return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1].toLowerCase()}` : labels[0];
  }
  return w.ids.map(id => SHOPS.find(s => s.id === id)?.name ?? id).join(', ');
}

export function appliesTo(w: Where, shopId: string): boolean {
  const shop = SHOPS.find(s => s.id === shopId);
  if (!shop) return false;
  if (w.kind === 'all') return true;
  if (w.kind === 'shops') return w.ids.includes(shopId);
  return w.types.includes(shop.type) || (!!shop.hub && w.types.includes('hub'));
}

export function overlaps(a: Where, b: Where): boolean {
  return SHOPS.some(s => appliesTo(a, s.id) && appliesTo(b, s.id));
}

export type CatalogueEntry = {
  id: string;
  area: Area;
  kind: Kind;
  /** The rule as Pret would say it. */
  sentence: string;
  when?: Trigger;
  if?: string;
  then?: { effect: Effect; detail?: string; level?: EdifyLevel }[];
  where: Where;
  /** ISO day the entry starts. */
  from: string;
  setBy: string;
  why?: string;
  reqs: string[];
  /** Demo figure: times the rule fired in the last seven days. */
  firedLastWeek?: number;
};

const RUTH = 'Ruth Adeyemi';
const LEAH = 'Leah Morgan';
const ALL: Where = { kind: 'all' };

export const SEED_CATALOGUE: CatalogueEntry[] = [
  // Forecast
  {
    id: 'forecast-approval', area: 'forecast', kind: 'rule',
    sentence: "A manager's forecast change of more than 20% needs Ops approval by 12:00 the day before.",
    when: 'forecast-changed', if: 'The change is more than 20% of Edify’s forecast', then: [{ effect: 'approval', detail: 'Ops, by 12:00 the day before' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['FOR-015'], firedLastWeek: 9,
  },
  {
    id: 'forecast-operative', area: 'forecast', kind: 'value',
    sentence: "Orders and production use the manager's forecast where there is one, otherwise Edify's.",
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['FOR-014', 'FOR-021'],
  },
  {
    id: 'forecast-exclusions', area: 'forecast', kind: 'value',
    sentence: 'Days with a closure or a one-off event are left out of three-week averages.',
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['FOR-023'],
  },
  {
    id: 'forecast-hub-cutoff', area: 'forecast', kind: 'schedule',
    sentence: 'Hubs see the approved next-day forecast for every Spoke by 15:00.',
    where: { kind: 'types', types: ['hub'] }, from: '2026-09-07', setBy: LEAH, reqs: ['HUB-005'],
  },

  // Ordering
  {
    id: 'order-reason', area: 'ordering', kind: 'rule',
    sentence: 'Changing a suggested quantity by more than 30% needs a reason.',
    when: 'order-line-changed', if: 'The new quantity differs from Edify’s suggestion by more than 30%', then: [{ effect: 'ask-reason', detail: 'A reason' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['SUG-004'], firedLastWeek: 46,
  },
  {
    id: 'order-approval', area: 'ordering', kind: 'rule',
    sentence: "Ordering more than 3 times the suggestion needs the shop manager's approval.",
    when: 'order-line-changed', if: 'The new quantity is more than 3 times Edify’s suggestion', then: [{ effect: 'approval', detail: 'Shop manager' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['ORD-007'], firedLastWeek: 5,
  },
  {
    id: 'order-block', area: 'ordering', kind: 'rule',
    sentence: 'Ordering more than 10 times the suggestion is blocked.',
    when: 'order-line-changed', if: 'The new quantity is more than 10 times Edify’s suggestion', then: [{ effect: 'block' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['ORD-007'], firedLastWeek: 1,
  },
  {
    id: 'order-essentials', area: 'ordering', kind: 'rule',
    sentence: 'If milk, bread or bananas have no quantity an hour before cut-off, remind the shop.',
    when: 'order-due', if: 'Milk, bread or bananas have no quantity, an hour before cut-off', then: [{ effect: 'task', detail: 'Review, or confirm zero with a reason' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['ORD-017'], firedLastWeek: 12,
  },
  {
    id: 'order-review', area: 'ordering', kind: 'rule',
    sentence: 'If stock, the forecast or a delivery has changed by more than 10% since someone last looked, ask the shop to review before cut-off.',
    when: 'order-due', if: 'Inputs changed by more than 10% since the last review', then: [{ effect: 'task', detail: 'Review the changed lines' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['SUG-013'], firedLastWeek: 18,
  },
  {
    id: 'order-autosubmit', area: 'ordering', kind: 'rule',
    sentence: "At cut-off, Edify submits every order: the manager's draft if there is one, otherwise the latest suggestion.",
    when: 'order-cutoff', then: [{ effect: 'edify', detail: 'Submit the order to BFL', level: 'acts-unless-stopped' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['SUG-005', 'SUG-016'], firedLastWeek: 28,
  },
  {
    id: 'order-after-cutoff', area: 'ordering', kind: 'rule',
    sentence: 'After cut-off, shops can still add frozen lines for the day after next. Fresh lines are blocked.',
    when: 'order-line-changed', if: 'After cut-off, and the line is fresh', then: [{ effect: 'block' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['ORD-006'], firedLastWeek: 3,
  },
  {
    id: 'order-send-failed', area: 'ordering', kind: 'rule',
    sentence: 'If an order fails to reach BFL, Edify retries and tells the supply chain team after 15 minutes.',
    when: 'order-send-failed', if: 'Still not sent after 15 minutes', then: [{ effect: 'edify', detail: 'Retry the send', level: 'acts-and-reports' }, { effect: 'notify', detail: 'Supply chain team' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['ORD-014', 'ORD-018', 'NTF-001'], firedLastWeek: 2,
  },
  {
    id: 'order-safety-stock', area: 'ordering', kind: 'value',
    sentence: "Safety stock: one day's use on chilled lines, three days on ambient.",
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['SUG-001', 'TRF-002'],
  },
  {
    id: 'order-horizon', area: 'ordering', kind: 'value',
    sentence: 'Shops can order up to 7 days ahead.',
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['ORD-004'],
  },
  {
    id: 'order-schedule', area: 'ordering', kind: 'schedule',
    sentence: 'Order by 14:00 on day 1 for delivery on day 3. Shops closed at weekends order on Friday for Monday and Tuesday.',
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['ORD-016'],
  },
  {
    id: 'order-christmas', area: 'ordering', kind: 'schedule',
    sentence: 'The Christmas order schedule runs from 21 December to 2 January.',
    where: ALL, from: '2026-12-21', setBy: LEAH, reqs: ['ORD-016'],
  },

  // Counting and stock
  {
    id: 'count-recount', area: 'counting', kind: 'rule',
    sentence: 'A line counted more than £50 out needs a second person to recount it.',
    when: 'count-saved', if: 'A line is more than £50 from the expected stock', then: [{ effect: 'second-person', detail: 'Recount the line' }],
    where: { kind: 'types', types: ['station', 'airport'] }, from: '2026-09-07', setBy: LEAH, reqs: ['INV-012', 'CNT-011'], firedLastWeek: 7,
  },
  {
    id: 'count-recommend', area: 'counting', kind: 'rule',
    sentence: "When stock looks wrong (sold after zero, negative, or short for tomorrow's production), Edify asks the shop to count that line.",
    when: 'stock-looks-wrong', then: [{ effect: 'edify', detail: 'Send a count task for the line', level: 'acts-and-reports' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['CNT-004'], firedLastWeek: 22,
  },
  {
    id: 'count-correction', area: 'counting', kind: 'rule',
    sentence: "Corrections to a saved count, cash count or delivery need the shop manager's approval, never from the person who made the change.",
    when: 'correction-made', then: [{ effect: 'approval', detail: 'Shop manager, not the same person' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['CNT-012', 'CAS-015', 'REC-005', 'SEC-002'], firedLastWeek: 4,
  },
  {
    id: 'count-recall', area: 'counting', kind: 'rule',
    sentence: 'When a recall is issued, block ordering the item and send every affected shop a recall check.',
    when: 'recall-issued', then: [{ effect: 'block', detail: 'Ordering the item' }, { effect: 'task', detail: 'Recall check at each shop' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['INV-022', 'CNT-005'], firedLastWeek: 0,
  },
  {
    id: 'count-period-lock', area: 'counting', kind: 'rule',
    sentence: 'After the month closes, stock changes are blocked until Ops reopens the period.',
    when: 'period-closed', then: [{ effect: 'block', detail: 'Stock changes' }, { effect: 'approval', detail: 'Ops, to reopen' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['INV-023'], firedLastWeek: 0,
  },
  {
    id: 'count-close-list', area: 'counting', kind: 'rule',
    sentence: "Shops more than £500 out at month end go on the Support Centre's close list.",
    when: 'period-closed', if: 'The shop is more than £500 out in total', then: [{ effect: 'notify', detail: 'Support Centre close list' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['INV-024'], firedLastWeek: 0,
  },
  {
    id: 'count-full', area: 'counting', kind: 'schedule',
    sentence: 'Full count on the last Sunday of the month, with 36 hours to finish.',
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['CNT-001'],
  },
  {
    id: 'count-key-lines', area: 'counting', kind: 'schedule',
    sentence: 'Key lines: six counted every day, three once a week.',
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['CNT-001'],
  },

  // Deliveries and credits
  {
    id: 'delivery-check', area: 'deliveries', kind: 'rule',
    sentence: 'Every delivery needs a second person to check it, never the person who received it.',
    when: 'delivery-confirmed', then: [{ effect: 'second-person', detail: 'Check the delivery' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['REC-006', 'SEC-002'], firedLastWeek: 28,
  },
  {
    id: 'delivery-photo', area: 'deliveries', kind: 'rule',
    sentence: 'A damaged, quality or short-life claim worth over £10 needs a photo.',
    when: 'delivery-line-different', if: 'The reason is damaged, quality or short life, and the line is worth over £10', then: [{ effect: 'ask-reason', detail: 'A photo' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['CRD-017', 'CRD-004', 'CRD-003'], firedLastWeek: 9,
  },
  {
    id: 'delivery-send-claim', area: 'deliveries', kind: 'rule',
    sentence: "Edify sends claims to BFL as soon as they're submitted.",
    when: 'claim-submitted', then: [{ effect: 'edify', detail: 'Send the claim to BFL', level: 'acts-and-reports' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['CRD-006'], firedLastWeek: 15,
  },
  {
    id: 'delivery-claim-age', area: 'deliveries', kind: 'rule',
    sentence: 'Claims open for 7 days notify the supply chain team. At 14 days they go to the supply chain manager.',
    when: 'claim-ageing', if: 'Open for 7 days, then 14', then: [{ effect: 'notify', detail: 'Supply chain team at 7 days, manager at 14' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['CRD-012', 'CRD-009'], firedLastWeek: 3,
  },

  // Transfers
  {
    id: 'transfer-chilled', area: 'transfers', kind: 'rule',
    sentence: "Transfers of chilled items need the temperature when sent and the receiving shop's confirmation.",
    when: 'transfer-sent', if: 'The item is chilled', then: [{ effect: 'ask-reason', detail: 'A temperature reading' }, { effect: 'second-person', detail: 'The receiving shop confirms' }],
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['TRF-010'], firedLastWeek: 6,
  },
  {
    id: 'transfer-nearby', area: 'transfers', kind: 'value',
    sentence: 'Shops can ask for stock from shops within 2 miles or in the same Hub group.',
    where: ALL, from: '2026-09-07', setBy: LEAH, reqs: ['TRF-001'],
  },

  // Cash
  {
    id: 'cash-second-person', area: 'cash', kind: 'rule',
    sentence: 'Every cash count needs a second person, never the person who counted.',
    when: 'cash-count-saved', then: [{ effect: 'second-person', detail: 'Check the count' }],
    where: ALL, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-004', 'SEC-002'], firedLastWeek: 84,
  },
  {
    id: 'cash-tolerance', area: 'cash', kind: 'rule',
    sentence: 'A cash count more than £5 out is flagged. More than £20 needs a reason.',
    when: 'cash-count-saved', if: 'More than £5 out, then more than £20', then: [{ effect: 'warn' }, { effect: 'ask-reason', detail: 'A reason, over £20' }],
    where: ALL, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-007', 'CAS-019'], firedLastWeek: 11,
  },
  {
    id: 'cash-tolerance-airport', area: 'cash', kind: 'rule',
    sentence: 'Airport shops: a reason is needed over £25, not £20.',
    when: 'cash-count-saved', if: 'More than £25 out', then: [{ effect: 'ask-reason', detail: 'A reason' }],
    where: { kind: 'types', types: ['airport'] }, from: '2026-11-17', setBy: RUTH, why: 'Airports handle more cash. Trial a higher threshold.', reqs: ['CAS-019'],
  },
  {
    id: 'cash-close-missing', area: 'cash', kind: 'rule',
    sentence: 'Closing the day with cash tasks missing is blocked at airport and station shops. High street shops can close with a reason.',
    when: 'cash-close-started', if: 'A cash task is still open', then: [{ effect: 'block', detail: 'Airport and station shops' }, { effect: 'ask-reason', detail: 'High street shops' }],
    where: ALL, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-013'], firedLastWeek: 2,
  },
  {
    id: 'cash-late-data', area: 'cash', kind: 'rule',
    sentence: 'If till data is more than 20 minutes late, the count goes ahead and reconciles when the data arrives.',
    when: 'cash-count-saved', if: 'Till data is more than 20 minutes old', then: [{ effect: 'warn', detail: 'Count now, reconcile later' }],
    where: ALL, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-016'], firedLastWeek: 17,
  },
  {
    id: 'cash-no-sale', area: 'cash', kind: 'rule',
    sentence: 'Five or more no-sale drawer opens at one till within an hour alert the cash office.',
    when: 'till-pattern', if: 'Five or more no-sale opens at one till within an hour', then: [{ effect: 'notify', detail: 'Cash office' }],
    where: ALL, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-020'], firedLastWeek: 1,
  },
  {
    id: 'cash-safe-limit', area: 'cash', kind: 'rule',
    sentence: 'If a safe holds more than its limit, Edify suggests an extra collection to the cash office.',
    when: 'safe-over-limit', if: 'The safe holds more than its limit', then: [{ effect: 'edify', detail: 'Suggest an extra collection', level: 'suggests' }],
    where: ALL, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-018', 'CAS-011'], firedLastWeek: 2,
  },
  {
    id: 'cash-floats', area: 'cash', kind: 'value',
    sentence: 'Till float £150 at airport shops and £100 elsewhere. Safe float £600 at airport shops and £400 elsewhere.',
    where: ALL, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-007', 'CAS-019'],
  },
  {
    id: 'cash-limits', area: 'cash', kind: 'value',
    sentence: 'Safe limit £6,000 at airport shops and £3,500 elsewhere. Most in one outer bag: £7,000 and £5,000.',
    where: ALL, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-011', 'CAS-019'],
  },
  {
    id: 'cash-tenders', area: 'cash', kind: 'value',
    sentence: 'Airport shops take sterling, euros, dollars and vouchers. Other shops take sterling.',
    where: ALL, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-006'],
  },
  {
    id: 'cash-spot-checks', area: 'cash', kind: 'schedule',
    sentence: 'Spot checks: three a day at airport shops, two elsewhere.',
    where: ALL, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-005', 'CAS-019'],
  },
  {
    id: 'cash-handovers', area: 'cash', kind: 'schedule',
    sentence: 'Airport shops hand over at 08:30, 12:30, 16:30 and 20:30. Station shops hand over at 13:30.',
    where: { kind: 'types', types: ['airport', 'station'] }, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-001'],
  },
  {
    id: 'cash-collections', area: 'cash', kind: 'schedule',
    sentence: 'Collections on Monday, Wednesday and Friday at airport shops. Tuesday and Friday elsewhere.',
    where: ALL, from: '2026-09-07', setBy: RUTH, reqs: ['CAS-011'],
  },
];

export function useCatalogue() {
  return usePretState<CatalogueEntry[]>('rules-catalogue', SEED_CATALOGUE);
}

export function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
