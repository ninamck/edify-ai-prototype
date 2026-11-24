'use client';

import { usePretState } from './pretStore';
import { whenDate } from './countStore';
import {
  CASH_SHOPS,
  PROFILE_RULES,
  TO_GBP,
  at,
  bagLabel,
  bagsFromClose,
  breakdown,
  cashSalesUpTo,
  cashShop,
  eventsTotal,
  hm,
  hmLabel,
  historyCloses,
  historyCollections,
  money,
  round2,
  signedMoney,
  tillEvents,
  tillPaidOuts,
  totalOf,
  type TillEvent,
  type Bag,
  type CashRules,
  type CashShop,
  type Coinage,
  type Collection,
  type DayClose,
  type ShopProfile,
  type Tender,
} from './cashFixtures';

/**
 * What shops and the Support Centre record about cash during a walkthrough.
 * Generated history lives in cashFixtures; this holds today's counts, closes,
 * collections, change orders, corrections, rule changes and Support Centre
 * requests. "Reset walkthrough" clears it.
 */

// ── Time ───────────────────────────────────────────────────────────

export function dayOf(when: string, now = new Date()): number {
  const d = whenDate(when);
  const a = new Date(d.toDateString()).getTime();
  const b = new Date(now.toDateString()).getTime();
  return Math.round((a - b) / 86400000);
}

export function minuteOf(when: string): number {
  const d = whenDate(when);
  return d.getHours() * 60 + d.getMinutes();
}

export const timeOf = (when: string) => hmLabel(minuteOf(when));

export function nowMinute(now = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

// ── Counts ─────────────────────────────────────────────────────────

/** Cash moved without a count: petty cash out of the safe, tips in, till to till, change delivered. Pub set-up only. */
export type CashMovementKind = 'paid-out' | 'paid-in' | 'transfer' | 'change-in';

export type CashCountKind = 'safe-float' | 'handover' | 'spot-check' | 'skim' | 'cash-out' | CashMovementKind;

export const COUNT_KIND_LABEL: Record<CashCountKind, string> = {
  'safe-float': 'Safe float count',
  handover: 'Handover count',
  'spot-check': 'Spot check',
  skim: 'Skim',
  'cash-out': 'Cash-out',
  'paid-out': 'Cash paid out',
  'paid-in': 'Cash paid in',
  transfer: 'Till to till',
  'change-in': 'Change received',
};

export const isSafeCount = (k: CashCountKind) => k === 'safe-float' || k === 'handover';
export const isMovement = (k: CashCountKind): k is CashMovementKind =>
  k === 'paid-out' || k === 'paid-in' || k === 'transfer' || k === 'change-in';

export type CashCount = {
  id: string;
  siteId: string;
  when: string;
  kind: CashCountKind;
  /** The till counted, or where a movement came from. No till on a movement means the safe. */
  till?: string;
  /** Tills cashed out together as one count. */
  tills?: string[];
  /** Where a till-to-till transfer went. */
  toTill?: string;
  qty: Partial<Record<Coinage, Record<string, number>>>;
  /** A typed total, used when nobody counted note by note. */
  totals?: Partial<Record<Coinage, number>>;
  vouchers?: number;
  countedBy: string;
  checkedBy?: string;
  reason?: string;
  /** What a paid-out or paid-in was for. */
  category?: string;
  /** Set when the count answers a Support Centre request. */
  requestId?: string;
};

/** Notes and coins win when both were entered; otherwise the typed total. */
export function countedOf(c: CashCount): Partial<Record<Tender, number>> {
  const out: Partial<Record<Tender, number>> = {};
  const coinages = new Set([...Object.keys(c.qty), ...Object.keys(c.totals ?? {})]) as Set<Coinage>;
  for (const k of coinages) {
    const byNote = totalOf(c.qty[k], k);
    out[k] = byNote > 0 ? byNote : round2(c.totals?.[k] ?? 0);
  }
  if (c.vouchers) out.VOUCHER = c.vouchers;
  return out;
}

export const tillsOf = (c: CashCount): string[] => (c.tills?.length ? c.tills : c.till ? [c.till] : []);

/** "Till 2", "Till 1 and Till 3", "the safe", "Till 1 to Till 2". */
export function countPlace(c: CashCount): string {
  if (c.kind === 'transfer') return `${c.till} to ${c.toTill}`;
  const tills = tillsOf(c);
  if (!tills.length) return isMovement(c.kind) ? 'the safe' : '';
  return tills.length === 1 ? tills[0] : `${tills.slice(0, -1).join(', ')} and ${tills.at(-1)}`;
}

export function gbpValue(amounts: Partial<Record<Tender, number>> | undefined): number {
  if (!amounts) return 0;
  return round2((Object.keys(amounts) as Tender[]).reduce((s, t) => s + (amounts[t] ?? 0) * TO_GBP[t], 0));
}

// ── Rules ──────────────────────────────────────────────────────────

export type RuleChange = {
  id: string;
  /** A shop profile, or one shop's site id. */
  scope: ShopProfile | string;
  field: keyof CashRules;
  value: CashRules[keyof CashRules];
  effectiveFrom: string;
  by: string;
  when: string;
  note?: string;
};

const PROFILES: ShopProfile[] = ['airport', 'station', 'high-street'];
export const isProfileScope = (scope: string): scope is ShopProfile => (PROFILES as string[]).includes(scope);

export function rulesFor(siteId: string, changes: RuleChange[], now = new Date()): CashRules {
  const shop = cashShop(siteId);
  const base: CashRules = { ...PROFILE_RULES[shop?.profile ?? 'high-street'] };
  const live = changes
    .filter(c => (c.scope === siteId || c.scope === shop?.profile) && whenDate(c.effectiveFrom) <= now)
    .sort((a, b) => {
      const scopeOrder = Number(!isProfileScope(a.scope)) - Number(!isProfileScope(b.scope));
      return scopeOrder || whenDate(a.effectiveFrom).getTime() - whenDate(b.effectiveFrom).getTime();
    });
  for (const c of live) (base as Record<string, unknown>)[c.field] = c.value;
  return base;
}

// ── Expected cash ──────────────────────────────────────────────────

export type Expected = {
  amounts: Partial<Record<Tender, number>>;
  /** True while the till data hasn't reached the time of the count. */
  provisional: boolean;
  /** Time the till data runs to, for the count's day. */
  dataTo: string;
};

/** Till data runs this far behind. Counts are never blocked waiting for it. */
export function tillDataTo(shop: CashShop, now = new Date()): number {
  return nowMinute(now) - shop.tillDataLagMin;
}

/**
 * Expected cash in a till at a minute of today: the float, plus cash sales
 * the till data has reported, less the till's own paid outs, skims and
 * cash-outs already taken out, and any cash paid in or moved between tills.
 * Paid outs come from the till, so a manager who forgets to explain one
 * doesn't create a false variance.
 */
export function expectedTill(
  shop: CashShop,
  till: string,
  minute: number,
  counts: CashCount[],
  rules: CashRules,
  now = new Date(),
): Expected {
  const i = shop.tills.indexOf(till);
  const covered = Math.min(minute, tillDataTo(shop, now));
  const sales = cashSalesUpTo(shop, Math.max(0, i), 0, covered, rules.tenders);
  const paidOut = eventsTotal(tillPaidOuts(shop, 0, { till, upTo: covered }));
  const amounts: Partial<Record<Tender, number>> = { ...sales, GBP: round2(rules.tillFloat + (sales.GBP ?? 0) - paidOut) };
  const before = counts
    .filter(c => c.siteId === shop.siteId && dayOf(c.when, now) === 0 && minuteOf(c.when) < minute)
    .sort((a, b) => minuteOf(a.when) - minuteOf(b.when));
  for (const c of before) {
    const gbp = countedOf(c).GBP ?? 0;
    if (c.kind === 'cash-out' && tillsOf(c).includes(till)) {
      for (const t of Object.keys(amounts) as Tender[]) amounts[t] = t === 'GBP' ? rules.tillFloat : 0;
    } else if ((c.kind === 'skim' || c.kind === 'transfer') && c.till === till) {
      amounts.GBP = round2((amounts.GBP ?? 0) - gbp);
    } else if ((c.kind === 'paid-in' && c.till === till) || (c.kind === 'transfer' && c.toTill === till)) {
      amounts.GBP = round2((amounts.GBP ?? 0) + gbp);
    }
  }
  return { amounts, provisional: minute - covered > FRESH_ENOUGH_MIN, dataTo: hmLabel(covered) };
}

/** Expected cash across tills counted together, floats included. */
export function expectedTills(
  shop: CashShop,
  tills: string[],
  minute: number,
  counts: CashCount[],
  rules: CashRules,
  now = new Date(),
): Expected {
  const each = tills.map(t => expectedTill(shop, t, minute, counts, rules, now));
  const amounts: Partial<Record<Tender, number>> = {};
  for (const e of each) {
    for (const t of Object.keys(e.amounts) as Tender[]) amounts[t] = round2((amounts[t] ?? 0) + (e.amounts[t] ?? 0));
  }
  return { amounts, provisional: each.some(e => e.provisional), dataTo: each[0]?.dataTo ?? '' };
}

/** Till data this close to the count is treated as current. */
const FRESH_ENOUGH_MIN = 10;

/** Cash paid into or out of the safe today before a minute, and change delivered to it. */
export function safeMovementsBefore(siteId: string, minute: number, counts: CashCount[], now = new Date()): number {
  return round2(
    counts
      .filter(c => c.siteId === siteId && !c.till && isMovement(c.kind) && dayOf(c.when, now) === 0 && minuteOf(c.when) < minute)
      .reduce((s, c) => s + (c.kind === 'paid-out' ? -1 : 1) * (countedOf(c).GBP ?? 0), 0),
  );
}

export function expectedForCount(count: CashCount, counts: CashCount[], rules: CashRules, now = new Date()): Expected | null {
  const shop = cashShop(count.siteId);
  if (!shop || count.kind === 'skim' || isMovement(count.kind)) return null;
  if (isSafeCount(count.kind)) {
    const moved = safeMovementsBefore(count.siteId, minuteOf(count.when), counts, now);
    return { amounts: { GBP: round2(rules.safeFloat + moved) }, provisional: false, dataTo: '' };
  }
  const tills = tillsOf(count);
  if (!tills.length) return null;
  return expectedTills(shop, tills, minuteOf(count.when), counts, rules, now);
}

export type Tolerance = 'ok' | 'flag' | 'reason';

export function toleranceOf(variance: number, rules: CashRules): Tolerance {
  const v = Math.abs(round2(variance));
  if (v > rules.reasonAt) return 'reason';
  if (v > rules.flagAt) return 'flag';
  return 'ok';
}

export const TOLERANCE_LABEL: Record<Tolerance, string> = {
  ok: 'Within tolerance',
  flag: 'Flagged',
  reason: 'Reason needed',
};

export const TOLERANCE_PILL: Record<Tolerance, string> = { ok: 'neutral', flag: 'neutral', reason: 'warn' };

// ── Corrections ────────────────────────────────────────────────────

export type Correction = {
  id: string;
  recordId: string;
  field: string;
  label: string;
  from: string | number;
  to: string | number;
  reason: string;
  by: string;
  when: string;
  approvedBy?: string;
};

export function corrected<T extends string | number>(recordId: string, field: string, original: T, corrections: Correction[]): T {
  const last = corrections.filter(c => c.recordId === recordId && c.field === field).at(-1);
  return (last ? last.to : original) as T;
}

// ── Change orders and requests ─────────────────────────────────────

export const CHANGE_BAGS: { id: string; label: string; bagValue: number }[] = [
  { id: 'n5', label: '£5 notes, bundle of 20', bagValue: 100 },
  { id: 'c200', label: '£2 coins, bag', bagValue: 20 },
  { id: 'c100', label: '£1 coins, bag', bagValue: 20 },
  { id: 'c50', label: '50p coins, bag', bagValue: 10 },
  { id: 'c20', label: '20p coins, bag', bagValue: 10 },
  { id: 'c10', label: '10p coins, bag', bagValue: 5 },
  { id: 'c5', label: '5p coins, bag', bagValue: 5 },
  { id: 'c2', label: '2p coins, bag', bagValue: 1 },
  { id: 'c1', label: '1p coins, bag', bagValue: 1 },
];

export type ChangeOrder = {
  id: string;
  siteId: string;
  when: string;
  by: string;
  bags: Record<string, number>;
  deliverOn: string;
  note?: string;
  receivedAt?: string;
  receivedBy?: string;
};

export const changeOrderValue = (o: ChangeOrder) =>
  Object.entries(o.bags).reduce((s, [id, q]) => s + q * (CHANGE_BAGS.find(b => b.id === id)?.bagValue ?? 0), 0);

export type CashRequestKind = 'recount-safe' | 'spot-check' | 'extra-collection';

export const REQUEST_LABEL: Record<CashRequestKind, string> = {
  'recount-safe': 'Recount the safe',
  'spot-check': 'Extra spot check',
  'extra-collection': 'Extra collection booked',
};

export type CashRequest = {
  id: string;
  siteId: string;
  kind: CashRequestKind;
  note: string;
  by: string;
  when: string;
  /** For an extra collection, the day the collector comes. */
  forDay?: string;
};

// ── Seeds ──────────────────────────────────────────────────────────

/** The change a safe float holds, topped up with £20 and £10 notes. */
function safeQty(total: number): Record<string, number> {
  const mix: Record<string, number> = { c200: 25, c100: 40, c50: 40, c20: 50, c10: 50, c5: 40, c2: 50, c1: 50 };
  const rest = breakdown(round2(total - totalOf(mix)), 'GBP', 20);
  for (const [k, v] of Object.entries(rest)) mix[k] = (mix[k] ?? 0) + v;
  return mix;
}

function seedCounts(): CashCount[] {
  const out: CashCount[] = [];
  const safe = (siteId: string, time: string, kind: 'safe-float' | 'handover', total: number, countedBy: string, checkedBy: string) =>
    out.push({ id: `seed-${siteId}-${kind}-${time}`, siteId, when: at(0, time), kind, qty: { GBP: safeQty(total) }, countedBy, checkedBy });
  const skim = (siteId: string, till: string, time: string, countedBy: string, checkedBy: string) =>
    out.push({ id: `seed-${siteId}-skim-${till}-${time}`, siteId, when: at(0, time), kind: 'skim', till, qty: { GBP: { n20: 10 } }, countedBy, checkedBy });
  /** A till count that lands `off` away from the expected cash, worked out from the seeded sales. */
  const spot = (siteId: string, till: string, time: string, off: number, countedBy: string, checkedBy: string) => {
    const shop = cashShop(siteId)!;
    const rules = PROFILE_RULES[shop.profile];
    const i = shop.tills.indexOf(till);
    const sales = cashSalesUpTo(shop, i, 0, hm(time), rules.tenders);
    const skims = out.filter(c => c.siteId === siteId && c.till === till && c.kind === 'skim' && hm(c.when.slice(-5)) < hm(time));
    const gbp = round2(rules.tillFloat + (sales.GBP ?? 0) - skims.length * 200 + off);
    const qty: CashCount['qty'] = { GBP: breakdown(gbp, 'GBP', 20) };
    if (sales.EUR) qty.EUR = breakdown(sales.EUR, 'EUR', 20);
    if (sales.USD) qty.USD = breakdown(sales.USD, 'USD', 20);
    out.push({ id: `seed-${siteId}-spot-${till}-${time}`, siteId, when: at(0, time), kind: 'spot-check', till, qty, vouchers: sales.VOUCHER, countedBy, checkedBy });
  };

  safe('fitzroy-kings-cross', '05:45', 'safe-float', 398.5, 'Priya Shah', 'Ade Okoro');
  spot('fitzroy-kings-cross', 'Till 2', '10:30', -0.4, 'Priya Shah', 'Lena Novak');
  skim('fitzroy-kings-cross', 'Till 1', '11:30', 'Priya Shah', 'Ade Okoro');

  safe('fitzroy-heathrow', '04:45', 'safe-float', 600, 'Marta Silva', 'Raj Patel');
  spot('fitzroy-heathrow', 'Till 4', '07:30', -2.1, 'Marta Silva', 'Raj Patel');
  skim('fitzroy-heathrow', 'Till 1', '08:10', 'Marta Silva', 'Raj Patel');
  safe('fitzroy-heathrow', '08:30', 'handover', 599.2, 'Raj Patel', 'Chloe Dunn');
  skim('fitzroy-heathrow', 'Till 2', '12:05', 'Chloe Dunn', 'Kofi Mensah');
  safe('fitzroy-heathrow', '12:35', 'handover', 600, 'Chloe Dunn', 'Kofi Mensah');

  safe('fitzroy-espresso', '06:45', 'safe-float', 400, 'Tom Bailey', 'Grace Lin');
  skim('fitzroy-espresso', 'Till 1', '09:40', 'Tom Bailey', 'Femi Adebayo');
  spot('fitzroy-espresso', 'Till 3', '10:20', 1.1, 'Grace Lin', 'Tom Bailey');

  safe('fitzroy-islington', '07:10', 'safe-float', 400, 'Jo Evans', 'Casey Park');
  return out;
}

const SEED_COUNTS = seedCounts();
const SEED_CLOSES: DayClose[] = [];
const SEED_COLLECTIONS: Collection[] = [];
const SEED_CHANGE_ORDERS: ChangeOrder[] = [
  { id: 'chg-kx-1', siteId: 'fitzroy-kings-cross', when: 'd-6@09:10', by: 'Priya Shah', bags: { c100: 3, c50: 2, c20: 2, c10: 2 }, deliverOn: 'd-3@10:00', receivedAt: 'd-3@10:20', receivedBy: 'Priya Shah' },
];
const SEED_CORRECTIONS: Correction[] = [
  {
    id: 'corr-hub-1', recordId: 'close-fitzroy-espresso|-4', field: 'bagNo-0', label: 'Inner bag number',
    from: '', to: '', reason: 'Typed the bag number wrong. Corrected from the bag seal.', by: 'Tom Bailey', when: 'd-4@20:05',
  },
];
const SEED_RULE_CHANGES: RuleChange[] = [
  {
    id: 'rule-1', scope: 'high-street', field: 'spotChecksPerDay', value: 2, effectiveFrom: 'd-10@00:00',
    by: 'Ruth Adeyemi', when: 'd-12@15:20', note: 'Up from one a day after the October audit.',
  },
  {
    id: 'rule-2', scope: 'airport', field: 'reasonAt', value: 25, effectiveFrom: 'd5@00:00',
    by: 'Ruth Adeyemi', when: 'd-1@11:05', note: 'Airports handle more cash. Trial a higher threshold.',
  },
];
const SEED_REQUESTS: CashRequest[] = [];

// The seeded bag-number correction needs the real bag number from the history.
{
  const close = historyCloses(cashShop('fitzroy-espresso')!).find(c => c.id === 'close-fitzroy-espresso|-4');
  if (close) {
    SEED_CORRECTIONS[0].from = String(Number(close.banking[0].bagNo) + 10);
    SEED_CORRECTIONS[0].to = close.banking[0].bagNo;
  }
}

// ── Hooks ──────────────────────────────────────────────────────────

export const useCashCounts = () => usePretState<CashCount[]>('cash-counts', SEED_COUNTS);
export const useCashCloses = () => usePretState<DayClose[]>('cash-closes', SEED_CLOSES);
export const useCashCollections = () => usePretState<Collection[]>('cash-collections', SEED_COLLECTIONS);
export const useChangeOrders = () => usePretState<ChangeOrder[]>('cash-change-orders', SEED_CHANGE_ORDERS);
export const useCashCorrections = () => usePretState<Correction[]>('cash-corrections', SEED_CORRECTIONS);
export const useRuleChanges = () => usePretState<RuleChange[]>('cash-rule-changes', SEED_RULE_CHANGES);
export const useCashRequests = () => usePretState<CashRequest[]>('cash-requests', SEED_REQUESTS);

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ── Derived views ──────────────────────────────────────────────────

/** Counts for one shop today that have happened by now. */
export function todaysCounts(counts: CashCount[], siteId: string, now = new Date()): CashCount[] {
  return counts
    .filter(c => c.siteId === siteId && dayOf(c.when, now) === 0 && whenDate(c.when) <= now)
    .sort((a, b) => whenDate(a.when).getTime() - whenDate(b.when).getTime());
}

/** History plus anything closed during the walkthrough, with the day worked out fresh. */
export function allCloses(siteId: string, stored: DayClose[], now = new Date()): DayClose[] {
  const shop = cashShop(siteId);
  const past = shop ? historyCloses(shop) : [];
  const mine = stored.filter(c => c.siteId === siteId).map(c => ({ ...c, day: dayOf(c.when, now) }));
  return [...past, ...mine].sort((a, b) => a.day - b.day);
}

export function closeToday(siteId: string, stored: DayClose[], now = new Date()): DayClose | undefined {
  return allCloses(siteId, stored, now).find(c => c.day === 0);
}

export function allCollections(siteId: string, stored: Collection[]): Collection[] {
  const shop = cashShop(siteId);
  const past = shop ? historyCollections(shop) : [];
  return [...past, ...stored.filter(c => c.siteId === siteId)].sort(
    (a, b) => whenDate(a.when).getTime() - whenDate(b.when).getTime(),
  );
}

export type BagView = Bag & { shownBagNo: string; collectedBy?: Collection };

export function allBags(siteId: string, closes: DayClose[], collections: Collection[], corrections: Correction[], now = new Date()): BagView[] {
  const colls = allCollections(siteId, collections);
  return allCloses(siteId, closes, now).flatMap(c => {
    const bags = bagsFromClose(c);
    return bags.map(b => ({
      ...b,
      value: corrected(c.id, b.kind === 'charity' ? 'charityValue' : `bankValue-${b.banking - 1}`, b.value, corrections),
      shownBagNo: bagLabel(corrected(c.id, b.kind === 'charity' ? 'charityBagNo' : `bagNo-${b.banking - 1}`, b.bagNo, corrections)),
      collectedBy: colls.find(x => x.bagNos.includes(b.bagNo)),
    }));
  });
}

export const bagGbp = (b: Bag) => round2(b.value + gbpValue(b.foreign));

export type Exposure = {
  total: number;
  safeFloat: number;
  bags: BagView[];
  bagsValue: number;
  skims: number;
  /** Cash paid into or out of the safe today, and change delivered. */
  movements: number;
  oldestDay?: number;
  limit: number;
};

export function exposureFor(
  siteId: string,
  data: { counts: CashCount[]; closes: DayClose[]; collections: Collection[]; corrections: Correction[]; rules: CashRules },
  now = new Date(),
): Exposure {
  const bags = allBags(siteId, data.closes, data.collections, data.corrections, now).filter(b => !b.collectedBy);
  const bagsValue = round2(bags.reduce((s, b) => s + bagGbp(b), 0));
  const closed = !!closeToday(siteId, data.closes, now);
  const skims = closed
    ? 0
    : round2(todaysCounts(data.counts, siteId, now).filter(c => c.kind === 'skim').reduce((s, c) => s + (countedOf(c).GBP ?? 0), 0));
  const movements = safeMovementsBefore(siteId, nowMinute(now) + 1, data.counts, now);
  return {
    total: round2(data.rules.safeFloat + bagsValue + skims + movements),
    safeFloat: data.rules.safeFloat,
    bags,
    bagsValue,
    skims,
    movements,
    oldestDay: bags.length ? Math.min(...bags.map(b => b.day)) : undefined,
    limit: data.rules.safeLimit,
  };
}

// ── The day's cash tasks ───────────────────────────────────────────

export type CashTaskStatus = 'done' | 'overdue' | 'due' | 'later';

export type CashTask = {
  id: string;
  label: string;
  detail?: string;
  status: CashTaskStatus;
  /** Minute of the day it's due by. */
  due: number;
  href: string;
  doneBy?: string;
  doneAt?: string;
  /** Required for close. Collections and Support Centre extras aren't. */
  required: boolean;
};

const DUE_WINDOW = 60;

function statusOf(done: boolean, due: number, now: number): CashTaskStatus {
  if (done) return 'done';
  if (now > due) return 'overdue';
  if (now >= due - DUE_WINDOW) return 'due';
  return 'later';
}

function countHref(kind: CashCountKind, till?: string, request?: string) {
  const q = new URLSearchParams({ kind });
  if (till) q.set('till', till);
  if (request) q.set('request', request);
  return `/cash/count?${q.toString()}`;
}

export function cashTasksFor(
  siteId: string,
  data: { counts: CashCount[]; closes: DayClose[]; collections: Collection[]; requests: CashRequest[]; rules: CashRules },
  now = new Date(),
): CashTask[] {
  const shop = cashShop(siteId);
  if (!shop) return [];
  const m = nowMinute(now);
  const today = todaysCounts(data.counts, siteId, now);
  const open = hm(shop.open);
  const close = hm(shop.close);
  const tasks: CashTask[] = [];
  const doneInfo = (c?: CashCount) => (c ? { doneBy: c.checkedBy ? `${c.countedBy} and ${c.checkedBy}` : c.countedBy, doneAt: timeOf(c.when) } : {});

  const safeCount = today.find(c => c.kind === 'safe-float');
  tasks.push({
    id: 'safe-float', label: 'Count the safe float', detail: 'Before the first till opens',
    status: statusOf(!!safeCount, open + 30, m), due: open + 30, href: countHref('safe-float'), required: true, ...doneInfo(safeCount),
  });

  const spots = today.filter(c => c.kind === 'spot-check');
  const n = data.rules.spotChecksPerDay;
  for (let i = 0; i < n; i += 1) {
    const due = Math.round(open + ((close - open) * (i + 1)) / (n + 1));
    tasks.push({
      id: `spot-${i + 1}`, label: `Spot check ${i + 1} of ${n}`, detail: 'Any till',
      status: statusOf(!!spots[i], due, m), due, href: countHref('spot-check'), required: true, ...doneInfo(spots[i]),
    });
  }
  spots.slice(n).forEach((c, i) => {
    tasks.push({ id: `spot-extra-${i}`, label: `Extra spot check, ${c.till}`, status: 'done', due: minuteOf(c.when), href: countHref('spot-check'), required: false, ...doneInfo(c) });
  });

  const handovers = today.filter(c => c.kind === 'handover');
  shop.handovers.forEach((time, i) => {
    const due = hm(time) + 30;
    tasks.push({
      id: `handover-${i + 1}`, label: `Handover count at ${time}`, detail: 'Both managers count the safe',
      status: statusOf(!!handovers[i], due, m), due, href: countHref('handover'), required: true, ...doneInfo(handovers[i]),
    });
  });
  handovers.slice(shop.handovers.length).forEach((c, i) => {
    tasks.push({ id: `handover-extra-${i}`, label: 'Extra handover count', status: 'done', due: minuteOf(c.when), href: countHref('handover'), required: false, ...doneInfo(c) });
  });

  for (const r of data.requests.filter(x => x.siteId === siteId && dayOf(x.when, now) === 0 && x.kind !== 'extra-collection')) {
    const answer = data.counts.find(c => c.requestId === r.id);
    const due = minuteOf(r.when) + 60;
    tasks.push({
      id: `request-${r.id}`, label: `${REQUEST_LABEL[r.kind]}, requested by Support Centre`, detail: r.note,
      status: statusOf(!!answer, due, m), due, href: countHref(r.kind === 'recount-safe' ? 'handover' : 'spot-check', undefined, r.id),
      required: false, ...doneInfo(answer),
    });
  }

  const cashOuts = today.filter(c => c.kind === 'cash-out');
  shop.tills.forEach(till => {
    const c = cashOuts.find(x => tillsOf(x).includes(till));
    tasks.push({
      id: `cash-out-${till}`, label: `Cash-out ${till}`, detail: 'Float stays in the till',
      status: statusOf(!!c, close + 20, m), due: close + 20, href: countHref('cash-out', till), required: true, ...doneInfo(c),
    });
  });

  const closed = closeToday(siteId, data.closes, now);
  tasks.push({
    id: 'close', label: 'Close the day and bank', detail: 'Takings, waste and banking',
    status: statusOf(!!closed, close + 45, m), due: close + 45, href: '/cash/close', required: false,
    ...(closed ? { doneBy: closed.by, doneAt: timeOf(closed.when) } : {}),
  });

  const extra = data.requests.find(x => x.siteId === siteId && x.kind === 'extra-collection' && x.forDay && dayOf(x.forDay, now) === 0);
  const collectionDay = data.rules.collectionDays.includes(now.getDay());
  if (collectionDay || extra) {
    const collected = data.collections.find(c => c.siteId === siteId && dayOf(c.when, now) === 0);
    tasks.push({
      id: 'collection', label: extra && !collectionDay ? 'Extra collection' : 'Hand bags to the collector',
      detail: `Collector due ${COLLECTION_WINDOW}`, status: statusOf(!!collected, hm('12:00'), m), due: hm('12:00'), href: '/cash/collection', required: false,
      ...(collected ? { doneBy: collected.handedOverBy, doneAt: timeOf(collected.when) } : {}),
    });
  }

  return tasks.sort((a, b) => a.due - b.due);
}

export const COLLECTION_WINDOW = '09:00 to 12:00';

// ── Till activity ──────────────────────────────────────────────────

/**
 * Till activity for a shop and day. Today stops where the till data stops,
 * and its skims and cash-outs are the counts the shop recorded.
 */
export function activityFor(shop: CashShop, day: number, counts: CashCount[], now = new Date()): TillEvent[] {
  if (day < 0) return tillEvents(shop, day);
  const dataTo = tillDataTo(shop, now);
  const fromCounts: TillEvent[] = todaysCounts(counts, shop.siteId, now)
    .filter(c => (c.kind === 'skim' || c.kind === 'cash-out') && tillsOf(c).length)
    .map(c => ({
      id: c.id, siteId: shop.siteId, till: countPlace(c), day: 0, minute: minuteOf(c.when),
      type: c.kind as 'skim' | 'cash-out', value: countedOf(c).GBP ?? 0, login: c.countedBy,
    }));
  return [...tillEvents(shop, 0).filter(e => e.minute <= dataTo), ...fromCounts].sort((a, b) => a.minute - b.minute);
}

// ── Rule-based alerts ──────────────────────────────────────────────

export type CashAlert = { id: string; siteId: string; rule: string; detail: string; day: number; severity: 'warn' | 'bad' };

export const ALERT_RULES = {
  noSale: 'Five or more drawer opens without a sale at one till within an hour',
  refunds: () => `Refunds over ${money(40).replace('.00', '')} at a shop in a day`,
  variance: 'Day variance over the reason threshold at banking',
  bags: 'Bags in the safe for three days or more',
  streak: () => `Cash short by more than ${money(5).replace('.00', '')} three days or more in a row`,
} as const;

/** Smallest daily variance the pattern checks count, above day-to-day counting noise. */
const PATTERN_MIN = 5;

/** A day's variance that the next day's cancels out, such as a late sale arriving in the next day's till data. */
export function cancelsOut(closes: DayClose[], i: number): boolean {
  const a = closes[i];
  if (!a || Math.abs(a.variance) < PATTERN_MIN) return false;
  return [closes[i - 1], closes[i + 1]].some(b => b && Math.abs(b.day - a.day) === 1 && Math.abs(a.variance + b.variance) <= 1);
}

/** Runs of three or more days in a row where the cash came up short by more than £5. */
export function shortStreaks(closes: DayClose[]): DayClose[][] {
  const runs: DayClose[][] = [];
  let run: DayClose[] = [];
  for (const c of closes) {
    const continues = run.length && c.day === run[run.length - 1].day + 1;
    if (c.variance < -PATTERN_MIN && (continues || !run.length)) run.push(c);
    else {
      if (run.length >= 3) runs.push(run);
      run = c.variance < -PATTERN_MIN ? [c] : [];
    }
  }
  if (run.length >= 3) runs.push(run);
  return runs;
}

export function alertsFor(
  shop: CashShop,
  data: { counts: CashCount[]; closes: DayClose[]; collections: Collection[]; corrections: Correction[]; rules: CashRules },
  now = new Date(),
  opts: { operators?: boolean } = {},
): CashAlert[] {
  const out: CashAlert[] = [];
  for (let day = -6; day <= 0; day += 1) {
    const events = activityFor(shop, day, data.counts, now);
    for (const till of shop.tills) {
      const opens = events.filter(e => e.till === till && e.type === 'no-sale').map(e => e.minute);
      for (let i = 0; i + 4 < opens.length; i += 1) {
        if (opens[i + 4] - opens[i] <= 60) {
          const n = opens.filter(m => m >= opens[i] && m <= opens[i] + 60).length;
          out.push({
            id: `nosale-${shop.siteId}-${day}-${till}`, siteId: shop.siteId, rule: ALERT_RULES.noSale, day, severity: 'bad',
            detail: `${n} drawer opens without a sale at ${till} between ${hmLabel(opens[i])} and ${hmLabel(opens[i] + 60)}.`,
          });
          break;
        }
      }
    }
    const refunds = round2(events.filter(e => e.type === 'refund').reduce((s, e) => s + e.value, 0));
    if (refunds > 40) {
      out.push({ id: `refund-${shop.siteId}-${day}`, siteId: shop.siteId, rule: ALERT_RULES.refunds(), day, severity: 'warn', detail: `${money(refunds)} refunded across ${events.filter(e => e.type === 'refund').length} refunds.` });
    }
  }
  for (const c of allCloses(shop.siteId, data.closes, now).filter(x => x.day >= -6)) {
    if (Math.abs(c.variance) > data.rules.reasonAt) {
      out.push({
        id: `var-${c.id}`, siteId: shop.siteId, rule: ALERT_RULES.variance, day: c.day, severity: 'bad',
        detail: `Variance ${signedMoney(c.variance)}. ${c.varianceReason ? `Shop's reason: ${c.varianceReason}` : 'No reason given.'}`,
      });
    }
  }
  if (opts.operators) {
    for (const run of shortStreaks(allCloses(shop.siteId, data.closes, now).filter(x => x.day >= -13))) {
      const last = run[run.length - 1];
      if (last.day < -6) continue;
      const total = round2(run.reduce((s, c) => s + c.variance, 0));
      out.push({
        id: `streak-${shop.siteId}-${last.day}`, siteId: shop.siteId, rule: ALERT_RULES.streak(), day: last.day, severity: 'warn',
        detail: `Short ${run.length} days running, ${money(-total)} in all. Each day was small, so none needed a reason on its own.`,
      });
    }
  }
  const exposure = exposureFor(shop.siteId, data, now);
  if (exposure.oldestDay !== undefined && exposure.oldestDay <= -3) {
    out.push({
      id: `bags-${shop.siteId}`, siteId: shop.siteId, rule: ALERT_RULES.bags, day: 0, severity: 'bad',
      detail: `${exposure.bags.length} bags worth ${money(exposure.bagsValue)} waiting; the oldest is ${-exposure.oldestDay} days old.`,
    });
  }
  return out.sort((a, b) => b.day - a.day);
}

export const TASK_STATUS_LABEL: Record<CashTaskStatus, string> = { done: 'Done', overdue: 'Overdue', due: 'Due now', later: 'Later' };
export const TASK_STATUS_PILL: Record<CashTaskStatus, string> = { done: 'neutral', overdue: 'warn', due: 'neutral', later: 'neutral' };

export function missingForClose(tasks: CashTask[]): CashTask[] {
  return tasks.filter(t => t.required && t.status !== 'done');
}

export { CASH_SHOPS };
