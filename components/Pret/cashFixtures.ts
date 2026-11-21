/**
 * Demo cash data for the Pret walkthrough. Every figure is made up and
 * generated from a fixed seed, so the server and the browser agree and
 * each walkthrough shows the same numbers. Days are offsets from today
 * (0 today, -1 yesterday) so the history always ends yesterday.
 */

// ── Money ──────────────────────────────────────────────────────────

export type Tender = 'GBP' | 'EUR' | 'USD' | 'VOUCHER';
export type Coinage = Exclude<Tender, 'VOUCHER'>;
export type Denom = { id: string; label: string; value: number };

const denoms = (rows: [string, string, number][]): Denom[] => rows.map(([id, label, value]) => ({ id, label, value }));

export const DENOMS: Record<Coinage, Denom[]> = {
  GBP: denoms([
    ['n50', '£50', 50], ['n20', '£20', 20], ['n10', '£10', 10], ['n5', '£5', 5],
    ['c200', '£2', 2], ['c100', '£1', 1], ['c50', '50p', 0.5], ['c20', '20p', 0.2],
    ['c10', '10p', 0.1], ['c5', '5p', 0.05], ['c2', '2p', 0.02], ['c1', '1p', 0.01],
  ]),
  EUR: denoms([
    ['n50', '€50', 50], ['n20', '€20', 20], ['n10', '€10', 10], ['n5', '€5', 5],
    ['c200', '€2', 2], ['c100', '€1', 1], ['c50', '50c', 0.5], ['c20', '20c', 0.2], ['c10', '10c', 0.1],
  ]),
  USD: denoms([
    ['n20', '$20', 20], ['n10', '$10', 10], ['n5', '$5', 5], ['n1', '$1', 1],
    ['c25', '25¢', 0.25], ['c10', '10¢', 0.1], ['c5', '5¢', 0.05], ['c1', '1¢', 0.01],
  ]),
};

export const TENDER_LABEL: Record<Tender, string> = { GBP: 'Sterling', EUR: 'Euro', USD: 'US dollar', VOUCHER: 'Vouchers' };
const SYMBOL: Record<Tender, string> = { GBP: '£', EUR: '€', USD: '$', VOUCHER: '£' };
/** Demo rates for adding foreign cash into a sterling total. */
export const TO_GBP: Record<Tender, number> = { GBP: 1, EUR: 0.86, USD: 0.79, VOUCHER: 1 };

export const round2 = (v: number) => Math.round(v * 100) / 100;

export function money(value: number, tender: Tender = 'GBP'): string {
  const v = round2(value);
  const body = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? '−' : ''}${SYMBOL[tender]}${body}`;
}

export function signedMoney(value: number, tender: Tender = 'GBP'): string {
  const v = round2(value);
  return v > 0 ? `+${money(v, tender)}` : money(v, tender);
}

/** Splits an amount into notes and coins, largest first, with no note above `largest`. */
export function breakdown(total: number, coinage: Coinage = 'GBP', largest = Infinity): Record<string, number> {
  let pence = Math.round(total * 100);
  const out: Record<string, number> = {};
  for (const d of DENOMS[coinage]) {
    if (d.value > largest) continue;
    const p = Math.round(d.value * 100);
    const n = Math.floor(pence / p);
    if (n > 0) {
      out[d.id] = n;
      pence -= n * p;
    }
  }
  return out;
}

export function totalOf(qty: Record<string, number> | undefined, coinage: Coinage = 'GBP'): number {
  if (!qty) return 0;
  return round2(DENOMS[coinage].reduce((sum, d) => sum + (qty[d.id] ?? 0) * d.value, 0));
}

// ── Time ───────────────────────────────────────────────────────────

export function hm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export function hmLabel(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export const at = (day: number, time: string) => `d${day}@${time}`;

export function dayDate(day: number, now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dayLabel(day: number, now = new Date()): string {
  if (day === 0) return 'Today';
  if (day === -1) return 'Yesterday';
  if (day === 1) return 'Tomorrow';
  return dayDate(day, now).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** For the middle of a sentence: "today", "yesterday", "Tue 10 Nov". */
export function dayPhrase(day: number, now = new Date()): string {
  return Math.abs(day) <= 1 ? dayLabel(day, now).toLowerCase() : dayLabel(day, now);
}

export const HISTORY_DAYS = 14;

// ── Seeded randomness ──────────────────────────────────────────────

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Shops and rules ────────────────────────────────────────────────

export type ShopProfile = 'airport' | 'station' | 'high-street';
export const PROFILE_LABEL: Record<ShopProfile, string> = { airport: 'Airport', station: 'Station', 'high-street': 'High street' };

export type CashShop = {
  siteId: string;
  name: string;
  profile: ShopProfile;
  tills: string[];
  open: string;
  close: string;
  /** Shift changes on the rota. Each one needs a handover count of the safe. */
  handovers: string[];
  /** How far behind the till data runs, in minutes. */
  tillDataLagMin: number;
  /** Who can count or check. The first name is the manager. */
  team: string[];
  cashPerTill: number;
};

const tills = (n: number) => Array.from({ length: n }, (_, i) => `Till ${i + 1}`);

export const CASH_SHOPS: CashShop[] = [
  {
    siteId: 'fitzroy-kings-cross', name: "King's Cross", profile: 'station', tills: tills(3),
    open: '05:30', close: '21:00', handovers: ['13:30'], tillDataLagMin: 47,
    team: ['Priya Shah', 'Ade Okoro', 'Lena Novak'], cashPerTill: 340,
  },
  {
    siteId: 'fitzroy-heathrow', name: 'Heathrow T5', profile: 'airport', tills: tills(5),
    open: '04:30', close: '22:00', handovers: ['08:30', '12:30', '16:30', '20:30'], tillDataLagMin: 4,
    team: ['Marta Silva', 'Raj Patel', 'Chloe Dunn', 'Kofi Mensah'], cashPerTill: 410,
  },
  {
    siteId: 'fitzroy-espresso', name: 'Pret Victoria Hub', profile: 'high-street', tills: tills(4),
    open: '06:30', close: '19:00', handovers: ['14:30'], tillDataLagMin: 6,
    team: ['Tom Bailey', 'Grace Lin', 'Femi Adebayo'], cashPerTill: 260,
  },
  {
    siteId: 'fitzroy-islington', name: 'Islington', profile: 'high-street', tills: tills(2),
    open: '07:00', close: '18:00', handovers: [], tillDataLagMin: 9,
    team: ['Jo Evans', 'Casey Park', 'Sam Hill'], cashPerTill: 180,
  },
];

export function cashShop(siteId: string): CashShop | undefined {
  return CASH_SHOPS.find(s => s.siteId === siteId);
}

export type IncompleteClose = 'block' | 'flag';

export type CashRules = {
  tillFloat: number;
  safeFloat: number;
  /** Most cash the safe should hold before Support Centre wants it collected. */
  safeLimit: number;
  spotChecksPerDay: number;
  /** Variance that shows as flagged. */
  flagAt: number;
  /** Variance that needs a written reason before saving. */
  reasonAt: number;
  dualConfirm: boolean;
  incompleteClose: IncompleteClose;
  /** 0 Sunday to 6 Saturday. */
  collectionDays: number[];
  maxOuterBag: number;
  tenders: Tender[];
};

export const PROFILE_RULES: Record<ShopProfile, CashRules> = {
  airport: {
    tillFloat: 150, safeFloat: 600, safeLimit: 6000, spotChecksPerDay: 3, flagAt: 5, reasonAt: 20,
    dualConfirm: true, incompleteClose: 'block', collectionDays: [1, 3, 5], maxOuterBag: 7000,
    tenders: ['GBP', 'EUR', 'USD', 'VOUCHER'],
  },
  station: {
    tillFloat: 100, safeFloat: 400, safeLimit: 3500, spotChecksPerDay: 2, flagAt: 5, reasonAt: 20,
    dualConfirm: true, incompleteClose: 'block', collectionDays: [2, 5], maxOuterBag: 5000,
    tenders: ['GBP'],
  },
  'high-street': {
    tillFloat: 100, safeFloat: 400, safeLimit: 3500, spotChecksPerDay: 2, flagAt: 5, reasonAt: 20,
    dualConfirm: true, incompleteClose: 'flag', collectionDays: [2, 5], maxOuterBag: 5000,
    tenders: ['GBP'],
  },
};

export const RULE_LABEL: Record<keyof CashRules, string> = {
  tillFloat: 'Till float',
  safeFloat: 'Safe float',
  safeLimit: 'Safe limit',
  spotChecksPerDay: 'Spot checks a day',
  flagAt: 'Flag variance over',
  reasonAt: 'Reason needed over',
  dualConfirm: 'Second person checks every count',
  incompleteClose: 'Closing with tasks missing',
  collectionDays: 'Collection days',
  maxOuterBag: 'Most value in one outer bag',
  tenders: 'Tenders taken',
};

export const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ruleValueLabel(field: keyof CashRules, value: CashRules[keyof CashRules]): string {
  if (field === 'dualConfirm') return value ? 'On' : 'Off';
  if (field === 'incompleteClose') return value === 'block' ? 'Blocked' : 'Allowed with a reason';
  if (field === 'collectionDays') return (value as number[]).map(d => WEEKDAY[d]).join(', ');
  if (field === 'tenders') return (value as Tender[]).map(t => TENDER_LABEL[t]).join(', ');
  if (field === 'spotChecksPerDay') return String(value);
  return money(value as number);
}

// ── Cash sales from the till ───────────────────────────────────────

/** Share of the day's trade by hour of day. */
function hourWeight(h: number): number {
  if (h >= 7 && h < 9) return 1.7;
  if (h >= 12 && h < 14) return 2;
  if (h >= 9 && h < 12) return 1;
  if (h >= 14 && h < 17) return 0.8;
  return 0.5;
}

function tradedShare(shop: CashShop, minute: number): number {
  const open = hm(shop.open);
  const close = hm(shop.close);
  const until = Math.max(open, Math.min(close, minute));
  let done = 0;
  let total = 0;
  for (let m = open; m < close; m += 15) {
    const w = hourWeight(Math.floor(m / 60));
    total += w;
    if (m < until) done += w * Math.min(1, (until - m) / 15);
  }
  return total === 0 ? 0 : done / total;
}

function dayFactor(shop: CashShop, day: number, till: number): number {
  return 0.85 + rng(`${shop.siteId}|${day}|${till}|sales`)() * 0.3;
}

const FOREIGN_PER_TILL: Partial<Record<Tender, number>> = { EUR: 22, USD: 14, VOUCHER: 8 };

/** Cash a till has taken by a minute of the day, net of voids and refunds. */
export function cashSalesUpTo(shop: CashShop, tillIndex: number, day: number, minute: number, tenders: Tender[]): Partial<Record<Tender, number>> {
  const share = tradedShare(shop, minute);
  const f = dayFactor(shop, day, tillIndex);
  const tillShare = 1.2 - 0.1 * tillIndex;
  const out: Partial<Record<Tender, number>> = { GBP: round2(shop.cashPerTill * tillShare * f * share) };
  for (const t of tenders) {
    if (t === 'GBP') continue;
    out[t] = round2((FOREIGN_PER_TILL[t] ?? 0) * f * share);
  }
  return out;
}

export function cardSalesForDay(shop: CashShop, day: number, cashTotal: number): number {
  return round2(cashTotal * (11 + rng(`${shop.siteId}|${day}|card`)() * 3));
}

// ── Till activity ──────────────────────────────────────────────────

export type TillEventType =
  | 'no-sale' | 'void' | 'refund' | 'discount-staff' | 'discount-customer' | 'joy' | 'paid-out' | 'skim' | 'cash-out';

export const TILL_EVENT_LABEL: Record<TillEventType, string> = {
  'no-sale': 'Drawer opened, no sale',
  void: 'Void',
  refund: 'Refund',
  'discount-staff': 'Staff discount',
  'discount-customer': 'Customer discount',
  joy: 'Joy of Pret',
  'paid-out': 'Paid out',
  skim: 'Skim',
  'cash-out': 'Cash-out',
};

export type TillEvent = {
  id: string;
  siteId: string;
  till: string;
  day: number;
  minute: number;
  type: TillEventType;
  value: number;
  item?: string;
  /** The login on the till. Tills are shared, so this is often not who served. */
  login: string;
};

const ITEMS = [
  'Flat white', 'Filter coffee', 'Croissant', 'Chicken caesar baguette', 'Tuna mayo sandwich',
  'Very berry croissant', 'Hot chocolate', 'Mango smoothie', 'Egg and spinach pot', 'Brownie',
];

const EVENT_MIX: [TillEventType, number, number, number, number][] = [
  // type, min per day, max per day, min value, max value
  ['no-sale', 3, 7, 0, 0],
  ['void', 4, 9, 1.5, 7],
  ['refund', 1, 3, 2, 8],
  ['discount-staff', 10, 18, 0.8, 3.2],
  ['discount-customer', 2, 5, 1, 4],
  ['joy', 14, 26, 1.6, 4.4],
];

const eventCache = new Map<string, TillEvent[]>();

/**
 * Till activity for one shop and day. Today's skims and cash-outs come from
 * the counts the shop records, so this only generates them for past days.
 */
export function tillEvents(shop: CashShop, day: number): TillEvent[] {
  const key = `${shop.siteId}|${day}`;
  const cached = eventCache.get(key);
  if (cached) return cached;
  const r = rng(`${key}|events`);
  const open = hm(shop.open);
  const close = hm(shop.close);
  const out: TillEvent[] = [];
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  let n = 0;
  const push = (e: Omit<TillEvent, 'id' | 'siteId' | 'day'>) => {
    n += 1;
    out.push({ id: `${key}|${n}`, siteId: shop.siteId, day, ...e });
  };
  for (const [type, lo, hi, vlo, vhi] of EVENT_MIX) {
    const count = lo + Math.floor(r() * (hi - lo + 1)) + (shop.tills.length > 3 ? 3 : 0);
    for (let i = 0; i < count; i += 1) {
      push({
        till: pick(shop.tills),
        minute: open + 10 + Math.floor(r() * (close - open - 40)),
        type,
        value: type === 'no-sale' ? 0 : round2(vlo + r() * (vhi - vlo)),
        item: type === 'no-sale' || type.startsWith('discount') ? undefined : pick(ITEMS),
        login: pick(shop.team),
      });
    }
  }
  // Paid outs keyed on the till, on their own random stream so the other events stay put.
  const rp = rng(`${key}|paid-outs`);
  const paidOuts = 1 + Math.floor(rp() * 3) + (shop.tills.length > 3 ? 1 : 0);
  for (let i = 0; i < paidOuts; i += 1) {
    push({
      till: shop.tills[Math.floor(rp() * shop.tills.length)],
      minute: open + 30 + Math.floor(rp() * (close - open - 90)),
      type: 'paid-out',
      value: round2(3.5 + rp() * 21),
      login: shop.team[Math.floor(rp() * shop.team.length)],
    });
  }
  // Heathrow, today: a burst of no-sale drawer opens on till 3, for the alert rule.
  if (shop.siteId === 'fitzroy-heathrow' && day === 0) {
    for (const m of [425, 433, 438, 446, 455, 468]) {
      push({ till: 'Till 3', minute: m, type: 'no-sale', value: 0, login: 'Kofi Mensah' });
    }
  }
  // Islington, yesterday: more refunds than usual, for the alert rule.
  if (shop.siteId === 'fitzroy-islington' && day === -1) {
    for (const [m, v] of [[612, 8.4], [655, 9.95], [701, 7.6], [744, 11.2], [790, 8.85]] as const) {
      push({ till: 'Till 2', minute: m, type: 'refund', value: v, item: pick(ITEMS), login: 'Sam Hill' });
    }
  }
  if (day < 0) {
    shop.tills.forEach((till, i) => {
      const sales = cashSalesUpTo(shop, i, day, close, ['GBP']).GBP ?? 0;
      const paid = round2(out.filter(e => e.type === 'paid-out' && e.till === till).reduce((s, e) => s + e.value, 0));
      if (sales > 250) push({ till, minute: hm('13:45') + i * 7, type: 'skim', value: 200, login: shop.team[0] });
      push({ till, minute: close + 5 + i * 4, type: 'cash-out', value: round2(sales - paid - (sales > 250 ? 200 : 0)), login: shop.team[0] });
    });
  }
  out.sort((a, b) => a.minute - b.minute);
  eventCache.set(key, out);
  return out;
}

/** Paid outs the till recorded for a day, optionally for one till and up to a minute. */
export function tillPaidOuts(shop: CashShop, day: number, opts: { till?: string; upTo?: number } = {}): TillEvent[] {
  return tillEvents(shop, day).filter(
    e => e.type === 'paid-out' && (!opts.till || e.till === opts.till) && (opts.upTo === undefined || e.minute <= opts.upTo),
  );
}

export const eventsTotal = (events: TillEvent[]) => round2(events.reduce((s, e) => s + e.value, 0));

// ── History: closes, bags, collections, safe counts ────────────────

export type BankingLine = { bagNo: string; value: number; foreign?: Partial<Record<Tender, number>> };
export type CharityLine = { value: number; slipNo: string; bagNo: string };

export type DayClose = {
  id: string;
  siteId: string;
  day: number;
  when: string;
  by: string;
  checkedBy?: string;
  tills: { till: string; expected: number; counted: number; countedBy: string }[];
  takingsCash: number;
  takingsCard: number;
  joyItems: number;
  joyValue: number;
  waste: number;
  voids: number;
  discounts: number;
  variance: number;
  varianceReason?: string;
  /** Tasks still open when the day closed, and why. */
  missing: string[];
  missingReason?: string;
  banking: BankingLine[];
  charity?: CharityLine;
  /** Other operators: what the team declared for each payment type. */
  declarations?: DeclaredLine[];
  /** Other operators: open tabs carried to tomorrow, and yesterday's paid today. */
  tabsCarried?: number;
  tabsBrought?: number;
};

export type DeclaredLine = { id: string; label: string; expected: number; declared: number; auto?: boolean };

/** Bag numbers are optional outside Pret; a deposit without one still needs a key. */
export const noBagNumber = (closeId: string) => `none-${closeId}`;
export const bagLabel = (bagNo: string) => (bagNo.startsWith('none-') ? 'No bag number' : bagNo);

function bagNumber(siteId: string, day: number, kind: string): string {
  return String(40000 + (hash(`${siteId}|${day}|${kind}`) % 9000) + Math.max(0, day + 20) * 3);
}

export function summariseEvents(events: TillEvent[]) {
  const of = (t: TillEventType) => events.filter(e => e.type === t);
  const sum = (es: TillEvent[]) => round2(es.reduce((s, e) => s + e.value, 0));
  return {
    joyItems: of('joy').length,
    joyValue: sum(of('joy')),
    voids: sum(of('void')),
    discounts: sum([...of('discount-staff'), ...of('discount-customer')]),
  };
}

export function wasteForDay(shop: CashShop, day: number): number {
  return round2(28 + rng(`${shop.siteId}|${day}|waste`)() * 60);
}

const SPECIAL_VARIANCE: Record<string, { variance: number; reason?: string }> = {
  'fitzroy-espresso|-6': { variance: -27.4, reason: 'Till 3 short. A £20 note was likely taken as a £10. Recounted with Grace, same result.' },
  'fitzroy-heathrow|-2': { variance: 21.6, reason: 'Euro change given in sterling at Till 4 during the morning rush.' },
  // A late cash sale that lands in the next day's till data: over one day, short the next.
  'fitzroy-kings-cross|-5': { variance: 16.4, reason: 'A customer paid £16.40 in cash after Till 1 had closed on the till system.' },
  'fitzroy-kings-cross|-4': { variance: -16.4, reason: "Yesterday's late cash sale came through on today's till data." },
  // Small shortfalls three days running: none needs a reason, together they're worth a look.
  'fitzroy-islington|-4': { variance: -6.2 },
  'fitzroy-islington|-3': { variance: -8.4 },
  'fitzroy-islington|-2': { variance: -7.1 },
};

const MISSING: Record<string, { missing: string[]; reason: string }> = {
  'fitzroy-islington|-1': { missing: ['Spot check 2 of 2'], reason: 'Two people off sick, nobody free to check at 15:00.' },
};

const closeCache = new Map<string, DayClose[]>();

export function historyCloses(shop: CashShop): DayClose[] {
  const cached = closeCache.get(shop.siteId);
  if (cached) return cached;
  const rules = PROFILE_RULES[shop.profile];
  const out: DayClose[] = [];
  for (let day = -(HISTORY_DAYS - 1); day <= -1; day += 1) {
    const r = rng(`${shop.siteId}|${day}|close`);
    const key = `${shop.siteId}|${day}`;
    const special = SPECIAL_VARIANCE[key];
    let varianceLeft = special ? special.variance : round2((r() - 0.5) * 6);
    const sales = shop.tills.map((_, i) => cashSalesUpTo(shop, i, day, hm(shop.close), ['GBP']).GBP ?? 0);
    const tillRows = shop.tills.map((till, i) => {
      const expected = round2(sales[i] - eventsTotal(tillPaidOuts(shop, day, { till })));
      const v = i === 0 ? varianceLeft : 0;
      varianceLeft -= v;
      return { till, expected, counted: round2(expected + v), countedBy: shop.team[(day + 20) % shop.team.length] };
    });
    const takingsCash = round2(sales.reduce((s, v) => s + v, 0));
    const toBank = round2(tillRows.reduce((s, t) => s + t.counted, 0));
    const variance = round2(tillRows.reduce((s, t) => s + t.counted - t.expected, 0));
    const foreign: Partial<Record<Tender, number>> = {};
    for (const t of rules.tenders) {
      if (t === 'GBP') continue;
      foreign[t] = round2(shop.tills.reduce((s, _, i) => s + (cashSalesUpTo(shop, i, day, hm(shop.close), [t])[t] ?? 0), 0));
    }
    const s = summariseEvents(tillEvents(shop, day));
    const missing = MISSING[key];
    out.push({
      id: `close-${key}`,
      siteId: shop.siteId,
      day,
      when: at(day, hmLabel(hm(shop.close) + 35)),
      by: shop.team[(day + 21) % shop.team.length],
      checkedBy: shop.team[(day + 22) % shop.team.length],
      tills: tillRows,
      takingsCash,
      takingsCard: cardSalesForDay(shop, day, takingsCash),
      ...s,
      waste: wasteForDay(shop, day),
      variance,
      varianceReason: special?.reason,
      missing: missing?.missing ?? [],
      missingReason: missing?.reason,
      banking: [{ bagNo: bagNumber(shop.siteId, day, 'takings'), value: toBank, foreign: Object.keys(foreign).length ? foreign : undefined }],
      charity: { value: round2(6 + r() * 22), slipNo: String(2000 + (hash(key) % 900)), bagNo: bagNumber(shop.siteId, day, 'charity') },
    });
  }
  closeCache.set(shop.siteId, out);
  return out;
}

export type Bag = {
  bagNo: string;
  siteId: string;
  day: number;
  kind: 'takings' | 'charity';
  /** 1 for the first banking of the day, 2 for the second. */
  banking: number;
  value: number;
  foreign?: Partial<Record<Tender, number>>;
  closeId: string;
};

export function bagsFromClose(close: DayClose): Bag[] {
  const bags: Bag[] = close.banking.map((b, i) => ({
    bagNo: b.bagNo, siteId: close.siteId, day: close.day, kind: 'takings', banking: i + 1,
    value: b.value, foreign: b.foreign, closeId: close.id,
  }));
  if (close.charity) {
    bags.push({
      bagNo: close.charity.bagNo, siteId: close.siteId, day: close.day, kind: 'charity', banking: 1,
      value: close.charity.value, closeId: close.id,
    });
  }
  return bags;
}

export type Collection = {
  id: string;
  siteId: string;
  when: string;
  company: string;
  collector: string;
  outerBag: string;
  bagNos: string[];
  value: number;
  handedOverBy: string;
  witnessedBy?: string;
  extra?: boolean;
  /** Other operators: a manager taking the cash to the bank rather than a collector calling. */
  method?: 'collector' | 'bank-run';
  /** Usually the date, site and paying-in slip or collection reference. */
  reference?: string;
  bankName?: string;
  comment?: string;
  /** Photo of the paying-in slip, shrunk to a thumbnail. */
  slip?: string;
  /** History only: a slip photo is on file. */
  slipOnFile?: boolean;
};

/** Islington's last deposit carries King's Cross's slip, the mix-up Kyle catches by hand. */
const SAME_SLIP_AS: Record<string, string> = { 'fitzroy-islington': 'fitzroy-kings-cross' };

function slipReference(siteId: string, day: number): string {
  const d = dayDate(day);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `PIS ${dd}.${mm}.${String(d.getFullYear()).slice(-2)} - ${4000000 + (hash(`${siteId}|${day}|slip`) % 999999)}`;
}

export const COLLECTION_COMPANY = 'Loomis (demo)';
const COLLECTORS = ['D. Hughes', 'K. Owusu', 'M. Brennan', 'S. Ali'];

/** Heathrow's most recent collection day before today didn't happen, whatever weekday the demo runs on. */
const MISSES_LAST_COLLECTION = new Set(['fitzroy-heathrow']);

/** The most recent collection day before today, as a day offset. */
export function lastCollectionDay(rules: CashRules, now = new Date()): number | undefined {
  for (let day = -1; day >= -7; day -= 1) if (rules.collectionDays.includes(dayDate(day, now).getDay())) return day;
  return undefined;
}

const collectionCache = new Map<string, Collection[]>();

export function historyCollections(shop: CashShop): Collection[] {
  const cached = collectionCache.get(shop.siteId);
  if (cached) return cached;
  const rules = PROFILE_RULES[shop.profile];
  const bags = historyCloses(shop).flatMap(bagsFromClose);
  const out: Collection[] = [];
  let taken = new Set<string>();
  const missed = MISSES_LAST_COLLECTION.has(shop.siteId) ? lastCollectionDay(rules) : undefined;
  for (let day = -(HISTORY_DAYS - 2); day <= -1; day += 1) {
    if (!rules.collectionDays.includes(dayDate(day).getDay())) continue;
    if (day === missed) continue;
    const due = bags.filter(b => b.day < day && !taken.has(b.bagNo));
    if (!due.length) continue;
    taken = new Set([...taken, ...due.map(b => b.bagNo)]);
    out.push({
      id: `coll-${shop.siteId}|${day}`,
      siteId: shop.siteId,
      when: at(day, '10:20'),
      company: COLLECTION_COMPANY,
      collector: COLLECTORS[(day + 20) % COLLECTORS.length],
      outerBag: `OB-${String(7000 + (hash(`${shop.siteId}|${day}|outer`) % 2000))}`,
      bagNos: due.map(b => b.bagNo),
      value: round2(due.reduce((s, b) => s + b.value, 0)),
      handedOverBy: shop.team[0],
      witnessedBy: shop.team[1],
      reference: slipReference(shop.siteId, day),
      slipOnFile: true,
    });
  }
  const twin = SAME_SLIP_AS[shop.siteId];
  const last = out.at(-1);
  if (twin && last) {
    const day = Number(last.id.split('|')[1]);
    const theirs = historyCollections(cashShop(twin)!).find(c => c.id === `coll-${twin}|${day}`);
    if (theirs) last.reference = theirs.reference;
  }
  collectionCache.set(shop.siteId, out);
  return out;
}

export type SafeCountKind = 'safe-float' | 'handover';

export type PastSafeCount = { id: string; siteId: string; day: number; when: string; kind: SafeCountKind; expected: number; counted: number; countedBy: string; checkedBy: string };

export function historySafeCounts(shop: CashShop): PastSafeCount[] {
  const rules = PROFILE_RULES[shop.profile];
  const out: PastSafeCount[] = [];
  for (let day = -(HISTORY_DAYS - 1); day <= -1; day += 1) {
    const r = rng(`${shop.siteId}|${day}|safe`);
    const times = [hmLabel(hm(shop.open) + 15), ...shop.handovers];
    times.forEach((time, i) => {
      const off = r() < 0.75 ? 0 : round2((r() - 0.5) * 4);
      out.push({
        id: `safe-${shop.siteId}|${day}|${i}`,
        siteId: shop.siteId,
        day,
        when: at(day, time),
        kind: i === 0 ? 'safe-float' : 'handover',
        expected: rules.safeFloat,
        counted: round2(rules.safeFloat + off),
        countedBy: shop.team[(i + day + 20) % shop.team.length],
        checkedBy: shop.team[(i + day + 21) % shop.team.length],
      });
    });
  }
  return out;
}
