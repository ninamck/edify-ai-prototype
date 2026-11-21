import type { CashAudience } from './cashOperators';

/**
 * Cash set-up: one engine, a set-up per type of operator.
 * Every customer runs the same four steps in the same order. What changes is
 * which extra steps are switched on. Steps can be switched on and off, never
 * reordered, so every set-up still reconciles.
 * Who needs what comes from Pret's requirements (CAS-001 to CAS-020), Larry's
 * call (Anglian Country Inns, 19 Nov) and Kyle's call (Dunkin, 20 Nov).
 */

export const SETUP_ORDER: CashAudience[] = ['pret', 'pub', 'dunkin'];

export const SETUP: Record<CashAudience, { name: string; who: string; summary: string }> = {
  pret: { name: 'Pret', who: 'Pret', summary: 'Shared tills, counts through the day, a collector picks up sealed bags.' },
  pub: { name: 'Pub', who: 'Larry, Anglian Country Inns', summary: 'Every payment type declared, open tabs, a safe ledger and an accounts file.' },
  dunkin: { name: 'Dunkin', who: 'Kyle, Dunkin franchisee', summary: 'One end-of-day screen. The manager takes the cash to the bank.' },
};

export const BACKBONE = [
  { title: 'Count the cash', help: 'Count what is in the tills and the safe.' },
  { title: 'Compare with the till', help: 'What should be there, what is there, and the difference.' },
  { title: 'Get it to the bank', help: 'By collector, bank run or deposit.' },
  { title: 'Keep the record', help: 'Who did what and when. Corrections keep the original.' },
];

/** on: in this set-up. off: not needed. ask: waiting on an answer from the customer. */
export type Use = 'on' | 'off' | 'ask';

type Base = { id: string; label: string; help: string; pretRef?: string; ask?: Partial<Record<CashAudience, string>> };
export type SwitchStep = Base & { kind: 'switch'; use: Record<CashAudience, Use> };
export type ChoiceStep = Base & { kind: 'choice'; options: string[]; value: Record<CashAudience, string> };
export type Step = SwitchStep | ChoiceStep;

export type Stage = { id: string; title: string; description: string; steps: Step[] };

const on = (...who: CashAudience[]) =>
  Object.fromEntries(SETUP_ORDER.map(a => [a, who.includes(a) ? 'on' : 'off'])) as Record<CashAudience, Use>;

export const STAGES: Stage[] = [
  {
    id: 'counting',
    title: 'Counting',
    description: 'How shops count, and who has to check it.',
    steps: [
      {
        id: 'count-method', kind: 'choice', label: 'How shops count',
        help: 'Note and coin gives a breakdown for the safe. A typed total is faster when only the number matters.',
        options: ['Note and coin', 'Typed total', 'Either'], value: { pret: 'Note and coin', pub: 'Either', dunkin: 'Typed total' }, pretRef: 'CAS-005',
      },
      { id: 'skims', kind: 'switch', label: 'Skims and spot checks', help: 'Take cash out of a till during the day and count a till at any time.', use: on('pret', 'pub', 'dunkin'), pretRef: 'CAS-005' },
      { id: 'two-person', kind: 'switch', label: 'Second person checks the count', help: 'One person counts, another confirms. The same person cannot do both.', use: on('pret'), pretRef: 'CAS-004' },
      { id: 'handovers', kind: 'switch', label: 'Shift handovers', help: 'Count the tills when a new shift takes over. Any number a day.', use: on('pret'), pretRef: 'CAS-001' },
      { id: 'safe-float', kind: 'switch', label: 'Safe float count', help: 'Count the change float in the safe by note and coin.', use: on('pret', 'pub'), pretRef: 'CAS-007' },
      {
        id: 'blind', kind: 'switch', label: 'Blind counts', help: 'Hide expected cash until the count is saved, so people count what is there.',
        use: { pret: 'ask', pub: 'off', dunkin: 'off' }, ask: { pret: 'Pret asked which audit controls are mandatory. This is a common one.' },
      },
      { id: 'till-groups', kind: 'switch', label: 'Count tills together, or one early', help: 'A restaurant can cash out hours before the bar.', use: on('pub') },
    ],
  },
  {
    id: 'day',
    title: 'During the day',
    description: 'Cash that moves between opening and close.',
    steps: [
      { id: 'till-activity', kind: 'switch', label: 'Till activity', help: 'Voids, refunds, discounts, giveaways and drawer opens from the till.', use: on('pret', 'pub', 'dunkin'), pretRef: 'CAS-014' },
      {
        id: 'paid-outs', kind: 'switch', label: 'Paid outs from the till', help: 'The till records the paid out. The manager only says what it was for, on any day.',
        use: { pret: 'ask', pub: 'on', dunkin: 'on' }, ask: { pret: 'Ask Natalia whether Pret\u2019s tills record paid outs at all.' },
      },
      { id: 'transfers', kind: 'switch', label: 'Move cash between tills', help: 'Logs who moved how much, so both tills stay right.', use: on('pub') },
      { id: 'change-in', kind: 'switch', label: 'Order and receive change', help: 'Order change and add it to the safe when it arrives.', use: on('pret', 'pub'), pretRef: 'CAS-007' },
      { id: 'petty-cash', kind: 'switch', label: 'Petty cash', help: 'Cash taken from a till or the safe for supplies, with a reason.', use: on('pub'), pretRef: 'CAS-012' },
      { id: 'tips', kind: 'switch', label: 'Cash tips paid in', help: 'Cash put into the till for gratuities.', use: on('pub') },
    ],
  },
  {
    id: 'close',
    title: 'Closing the day',
    description: 'What the manager does before the day is done.',
    steps: [
      {
        id: 'close-style', kind: 'choice', label: 'How the day closes', help: 'Step by step counts each till, then banks. One screen does the count, the difference and the deposit together.',
        options: ['Step by step', 'One screen'], value: { pret: 'Step by step', pub: 'Step by step', dunkin: 'One screen' }, pretRef: 'CAS-013',
      },
      { id: 'declarations', kind: 'switch', label: 'Declare every payment type', help: 'Cash, card, vouchers and others each get an expected and declared figure. Card fills itself in.', use: on('pret', 'pub'), pretRef: 'CAS-006' },
      { id: 'charity', kind: 'switch', label: 'Charity banking', help: 'Charity cash banked and reported on its own.', use: on('pret'), pretRef: 'CAS-009' },
      {
        id: 'open-tabs', kind: 'switch', label: 'Open tabs carried forward', help: 'Unpaid tabs and late-paying guests move to the next day.',
        use: { pret: 'ask', pub: 'on', dunkin: 'off' }, ask: { pret: 'Ask whether Pret Catering is paid on account.' },
      },
      { id: 'gift-cards', kind: 'switch', label: 'Gift card sales held back', help: 'Gift card sales count when they are spent, not when they are sold.', use: on('pub') },
      { id: 'block-close', kind: 'switch', label: 'Cash tasks must be done before close', help: 'The day cannot close with a count or banking missing.', use: on('pret'), pretRef: 'CAS-013' },
    ],
  },
  {
    id: 'banking',
    title: 'Banking',
    description: 'How the money leaves the shop and how we know it arrived.',
    steps: [
      {
        id: 'banking-method', kind: 'choice', label: 'How cash gets to the bank', help: 'A cash-in-transit company collects, or the manager takes it.',
        options: ['Collector', 'Manager to the bank', 'Either'], value: { pret: 'Collector', pub: 'Either', dunkin: 'Manager to the bank' }, pretRef: 'CAS-010',
      },
      { id: 'bag-numbers', kind: 'switch', label: 'Bag numbers required', help: 'Every banking needs its bag number before it can be saved.', use: on('pret', 'pub'), pretRef: 'CAS-008' },
      { id: 'schedules', kind: 'switch', label: 'Collection days and bag limits', help: 'When the collector comes and the most one bag can hold.', use: on('pret'), pretRef: 'CAS-011' },
      { id: 'slip-photo', kind: 'switch', label: 'Photo of the bank slip', help: 'The manager photographs the paying-in slip.', use: on('dunkin') },
      { id: 'duplicate-slip', kind: 'switch', label: 'Same slip at two shops', help: 'Flags a slip used at two shops on one day.', use: on('dunkin') },
      { id: 'bank-match', kind: 'switch', label: 'Check it reached the bank', help: 'Each deposit is matched to the bank, and shortfalls are flagged.', use: on('pret', 'pub', 'dunkin'), pretRef: 'CAS-010' },
      { id: 'deposit-nudge', kind: 'switch', label: 'Remind the manager to bank', help: 'A push to the manager when a banking day is missed.', use: on('pret', 'dunkin'), pretRef: 'CAS-013' },
    ],
  },
  {
    id: 'oversight',
    title: 'Support Centre and accounts',
    description: 'What head office sees and what goes to the accountants.',
    steps: [
      { id: 'estate', kind: 'switch', label: 'Estate cash view', help: 'Cash in safes, bags waiting, missing counts and variance across every shop.', use: on('pret', 'pub', 'dunkin'), pretRef: 'CAS-018' },
      { id: 'variance-trend', kind: 'switch', label: 'Variance trend and streaks', help: 'Alerts after three short days in a row. A short that reverses the next day is ignored.', use: on('pret', 'pub', 'dunkin'), pretRef: 'CAS-018' },
      { id: 'safe-ledger', kind: 'switch', label: 'Running safe balance', help: 'What went in and out of the safe, day by day, against the count.', use: on('pret', 'pub'), pretRef: 'CAS-017' },
      { id: 'paid-out-rate', kind: 'switch', label: 'Paid outs explained, by shop', help: 'The share of paid outs each manager has explained.', use: on('dunkin') },
      { id: 'statement', kind: 'switch', label: 'Statement of trade', help: 'Seven days side by side, from sales to declared payments and the variance.', use: on('pub') },
      {
        id: 'export', kind: 'switch', label: 'Accounts export', help: 'A file that posts each line to the right account, cost centre and VAT.',
        use: { pret: 'ask', pub: 'on', dunkin: 'on' }, ask: { pret: 'Ask which finance system Pret\u2019s cash posts to today.' },
      },
      {
        id: 'currency', kind: 'choice', label: 'Currency', help: 'The currency shops count and bank in.',
        options: ['GBP', 'USD'], value: { pret: 'GBP', pub: 'GBP', dunkin: 'USD' }, pretRef: 'CAS-006',
      },
    ],
  },
];

export const ALL_STEPS = STAGES.flatMap(s => s.steps);

/** How many optional switches a set-up has on, out of all of them. */
export function stepsOn(a: CashAudience) {
  const switches = ALL_STEPS.filter((s): s is SwitchStep => s.kind === 'switch');
  return { on: switches.filter(s => s.use[a] === 'on').length, ask: switches.filter(s => s.use[a] === 'ask').length, total: switches.length };
}
