'use client';

import { usePretState } from './pretStore';
import {
  CASH_SHOPS,
  at,
  cashShop,
  dayLabel,
  eventsTotal,
  historyCollections,
  historySafeCounts,
  hm,
  lastCollectionDay,
  hmLabel,
  money,
  rng,
  round2,
  tillPaidOuts,
  type CashRules,
  type CashShop,
  type Collection,
  type DayClose,
  type DeclaredLine,
} from './cashFixtures';
import {
  allBags,
  allCollections,
  bagGbp,
  corrected,
  countedOf,
  dayOf,
  safeMovementsBefore,
  todaysCounts,
  type CashAlert,
  type CashCount,
  type Correction,
} from './cashStore';

/**
 * Cash set-ups for demos, chosen under "Cash features" in demo controls.
 * Pub: the Anglian Country Inns call on 19 November. Cash in and out, till
 * groups, declarations, open tabs, bank runs, the safe balance, the
 * statement of trade, blind counts and the accounts export.
 * Dunkin: Kyle's call on 20 November. One end of day screen, bank deposits
 * with a slip photo, bank matching and the accounts export.
 */

// ── The switch ─────────────────────────────────────────────────────

export type CashAudience = 'pret' | 'pub' | 'dunkin';

export const CASH_AUDIENCE_LABEL: Record<CashAudience, string> = { pret: 'Pret', pub: 'Pub', dunkin: 'Dunkin (Kyle)' };

export function useCashAudience(): [CashAudience, (a: CashAudience) => void] {
  const [stored, setStored] = usePretState<string>('cash-audience', 'pret');
  const audience: CashAudience = stored === 'operators' ? 'pub' : stored === 'pub' || stored === 'dunkin' ? stored : 'pret';
  return [audience, setStored];
}

/** The pub set-up's full feature set. */
export function useOperatorCash(): boolean {
  return useCashAudience()[0] === 'pub';
}

/** Kyle's simple end of day and bank deposit flow. */
export function useDunkinCash(): boolean {
  return useCashAudience()[0] === 'dunkin';
}

/** Expected cash and the variance stay hidden until the count is saved. */
export const useBlindCount = () => usePretState<boolean>('cash-blind-count', false);

// ── Regions and site codes, for the accounts export ────────────────

const REGION: Record<string, string> = {
  'fitzroy-kings-cross': 'London stations',
  'fitzroy-heathrow': 'Airports',
  'fitzroy-espresso': 'London high street',
  'fitzroy-islington': 'London high street',
};

const SITE_CODE: Record<string, string> = {
  'fitzroy-kings-cross': 'KX',
  'fitzroy-heathrow': 'LHR',
  'fitzroy-espresso': 'VIC',
  'fitzroy-islington': 'ISL',
};

export const regionOf = (siteId: string) => REGION[siteId] ?? 'Other';
export const siteCodeOf = (siteId: string) => SITE_CODE[siteId] ?? siteId.slice(0, 3).toUpperCase();

// ── Cash in and out ────────────────────────────────────────────────

export const PAID_OUT_FOR = ['Cleaning and supplies', 'Milk or bread run', 'Repairs', 'Staff', 'Postage', 'Refund, no receipt', 'Other'];
export const PAID_IN_FOR = ['Cash tips', 'Float top-up', 'Found cash', 'Other'];

// ── Open tabs ──────────────────────────────────────────────────────

export type OpenTab = { ref: string; value: number; opened: string };

const TAB_REFS = ['Table 4', 'Bar tab, J. Reid', 'Table 11', 'Account: office lunch', 'Bar tab, M. Cole', 'Table 7'];

/** Sales rung up but not paid when the till closed. They carry to the next day. */
export function openTabsFor(shop: CashShop, day: number): OpenTab[] {
  const r = rng(`${shop.siteId}|${day}|tabs`);
  const n = Math.floor(r() * 3);
  return Array.from({ length: n }, (_, i) => ({
    ref: TAB_REFS[Math.floor(r() * TAB_REFS.length)],
    value: round2(8 + r() * 52),
    opened: hmLabel(hm(shop.close) - 40 - i * 25),
  }));
}

export const tabsTotal = (tabs: OpenTab[]) => round2(tabs.reduce((s, t) => s + t.value, 0));

// ── Declarations ───────────────────────────────────────────────────

/** Payments other than cash and integrated card that the till expects for a day. */
export function otherTendersFor(shop: CashShop, day: number): { gift: number; bacs: number } {
  const r = rng(`${shop.siteId}|${day}|tenders`);
  return {
    gift: round2(r() * 40),
    bacs: r() < 0.3 ? round2(120 + r() * 280) : 0,
  };
}

export const DECLARE_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card, from the card machines',
  gift: 'Gift cards redeemed',
  bacs: 'BACS and invoices',
  'paid-out': 'Paid out from the tills',
};

/** What was declared for a closed day. Days closed before the feature came on are filled from the till data. */
export function declarationsFor(shop: CashShop, close: DayClose): DeclaredLine[] {
  if (close.declarations) return close.declarations;
  const o = otherTendersFor(shop, close.day);
  const paidOut = eventsTotal(tillPaidOuts(shop, close.day));
  const cashExpected = round2(close.takingsCash - paidOut);
  return [
    { id: 'cash', label: DECLARE_LABEL.cash, expected: cashExpected, declared: round2(cashExpected + close.variance) },
    { id: 'card', label: DECLARE_LABEL.card, expected: close.takingsCard, declared: close.takingsCard, auto: true },
    ...(paidOut ? [{ id: 'paid-out', label: DECLARE_LABEL['paid-out'], expected: paidOut, declared: paidOut, auto: true }] : []),
    { id: 'gift', label: DECLARE_LABEL.gift, expected: o.gift, declared: o.gift },
    { id: 'bacs', label: DECLARE_LABEL.bacs, expected: o.bacs, declared: o.bacs },
  ];
}

// ── Statement of trade ─────────────────────────────────────────────

export const CATEGORIES = ['Food', 'Hot drinks', 'Cold drinks', 'Snacks and sundries'] as const;
export type Category = (typeof CATEGORIES)[number];
const CATEGORY_SHARE: Record<Category, number> = { Food: 0.52, 'Hot drinks': 0.3, 'Cold drinks': 0.12, 'Snacks and sundries': 0.06 };

export type StatementDay = {
  day: number;
  sales: Record<Category, number>;
  totalSales: number;
  promotions: number;
  discounts: number;
  afterDiscounts: number;
  tips: number;
  grossIncome: number;
  broughtForward: number;
  carriedForward: number;
  giftSold: number;
  expectedIncome: number;
  declared: DeclaredLine[];
  totalDeclared: number;
  variance: number;
};

/**
 * One day of the statement. Built from the expected income down, so every
 * column adds up: gross income, plus tabs brought forward, less tabs carried,
 * plus gift cards sold, equals what the till expects to have been paid.
 */
export function statementDay(shop: CashShop, close: DayClose): StatementDay {
  const r = rng(`${shop.siteId}|${close.day}|statement`);
  const declared = declarationsFor(shop, close);
  const expectedIncome = round2(declared.reduce((s, d) => s + d.expected, 0));
  const totalDeclared = round2(declared.reduce((s, d) => s + d.declared, 0));
  const tips = round2(4 + r() * 18);
  const giftSold = round2(r() * 50);
  const broughtForward = close.tabsBrought ?? tabsTotal(openTabsFor(shop, close.day - 1));
  const carriedForward = close.tabsCarried ?? tabsTotal(openTabsFor(shop, close.day));
  const afterDiscounts = round2(expectedIncome - broughtForward + carriedForward - giftSold - tips);
  const promotions = close.joyValue;
  const discounts = close.discounts;
  const totalSales = round2(afterDiscounts + promotions + discounts);
  const sales = {} as Record<Category, number>;
  let left = totalSales;
  CATEGORIES.forEach((c, i) => {
    const v = i === CATEGORIES.length - 1 ? left : round2(totalSales * CATEGORY_SHARE[c] * (0.94 + r() * 0.12));
    sales[c] = round2(v);
    left = round2(left - v);
  });
  return {
    day: close.day,
    sales,
    totalSales,
    promotions,
    discounts,
    afterDiscounts,
    tips,
    grossIncome: round2(afterDiscounts + tips),
    broughtForward,
    carriedForward,
    giftSold,
    expectedIncome,
    declared,
    totalDeclared,
    variance: round2(totalDeclared - expectedIncome),
  };
}

// ── Running safe balance ───────────────────────────────────────────

export type SafeDay = {
  day: number;
  opening: number;
  added: number;
  banked: number;
  moved: number;
  closing: number;
  floatExpected: number;
  /** The safe float counted the next morning. Missing until it happens. */
  floatCounted?: number;
};

/**
 * Cash on site, day by day: the safe float plus sealed bags waiting. Takings
 * go in at close, collections and bank runs take bags out, and the next
 * morning's float count checks it.
 */
export function safeLedger(
  siteId: string,
  data: { counts: CashCount[]; closes: DayClose[]; collections: Collection[]; corrections: Correction[]; rules: CashRules },
  days: number[],
  now = new Date(),
): SafeDay[] {
  const shop = cashShop(siteId);
  if (!shop) return [];
  const bags = allBags(siteId, data.closes, data.collections, data.corrections, now);
  const past = historySafeCounts(shop);
  const collectedOn = (b: (typeof bags)[number]) => (b.collectedBy ? dayOf(b.collectedBy.when, now) : Infinity);
  const sum = (bs: typeof bags) => round2(bs.reduce((s, b) => s + bagGbp(b), 0));
  const floatExpected = data.rules.safeFloat;
  return days.map(day => {
    const openingBags = sum(bags.filter(b => b.day < day && collectedOn(b) >= day));
    const added = sum(bags.filter(b => b.day === day));
    const banked = sum(bags.filter(b => collectedOn(b) === day));
    const moved = day === 0 ? safeMovementsBefore(siteId, 24 * 60, data.counts, now) : 0;
    const opening = round2(floatExpected + openingBags);
    let floatCounted: number | undefined;
    if (day + 1 === 0) {
      const c = todaysCounts(data.counts, siteId, now).find(x => x.kind === 'safe-float');
      if (c) floatCounted = corrected(c.id, 'counted', countedOf(c).GBP ?? 0, data.corrections);
    } else if (day + 1 < 0) {
      floatCounted = past.find(p => p.day === day + 1 && p.kind === 'safe-float')?.counted;
    }
    return { day, opening, added, banked, moved, closing: round2(opening + added - banked + moved), floatExpected, floatCounted };
  });
}

// ── Money landing in the bank ──────────────────────────────────────

/** A deposit found on the bank statement. Amount is missing when someone marked it by hand. */
export type Landing = { when: string; by: string; amount?: number };

export const useBankLandings = () => usePretState<Record<string, Landing>>('cash-landings', {});

/** Victoria Hub's latest matched deposit reached the bank £20 light, so the demo has one to chase. */
const SHORT_AT_BANK: Record<string, number> = { 'fitzroy-espresso': 20 };

/** Deposits three or more days old have reached the bank statement in the demo; newer ones wait. */
export function landingFor(c: Collection, stored: Record<string, Landing>, now = new Date()): Landing | undefined {
  if (stored[c.id]) return stored[c.id];
  const d = dayOf(c.when, now);
  if (d > -3) return undefined;
  const shop = cashShop(c.siteId);
  const matched = shop ? historyCollections(shop).filter(x => dayOf(x.when, now) <= -3) : [];
  const short = matched.at(-1)?.id === c.id ? SHORT_AT_BANK[c.siteId] ?? 0 : 0;
  return { when: at(d + 2, '09:00'), by: 'Bank statement', amount: round2(c.value - short) };
}

const BRANCH: Record<string, string> = {
  'fitzroy-kings-cross': 'Barclays, Euston Road',
  'fitzroy-heathrow': 'Lloyds, Hounslow',
  'fitzroy-espresso': 'NatWest, Victoria Street',
  'fitzroy-islington': 'HSBC, Upper Street',
};

/** Dunkin shops bank their own cash: past collector pickups show as deposits at the shop's branch. */
export function asDeposit(c: Collection): Collection {
  if (c.method === 'bank-run') return c;
  const bank = BRANCH[c.siteId] ?? 'Barclays';
  return { ...c, method: 'bank-run', company: bank, bankName: bank, collector: c.handedOverBy, outerBag: '' };
}

/** Reminders go out when a deposit day passes and nothing has gone to the bank for this many days. */
export const DEPOSIT_NUDGE_DAYS = 3;

/** Where a Dunkin shop stands on banking: what's waiting, when it last deposited, and whether to nudge. */
export function depositStatus(
  shop: CashShop,
  data: { closes: DayClose[]; collections: Collection[]; corrections: Correction[]; rules: CashRules },
  now = new Date(),
) {
  const waiting = allBags(shop.siteId, data.closes, data.collections, data.corrections, now).filter(b => b.kind === 'takings' && !b.collectedBy);
  const waitingValue = round2(waiting.reduce((s, b) => s + bagGbp(b), 0));
  const last = allCollections(shop.siteId, data.collections).at(-1);
  const sinceLast = last ? -dayOf(last.when, now) : undefined;
  const missedDay = lastCollectionDay(data.rules, now);
  const missed = missedDay !== undefined && (!last || dayOf(last.when, now) < missedDay);
  const late = waiting.length > 0 && missed && (sinceLast ?? Infinity) >= DEPOSIT_NUDGE_DAYS;
  return { waiting, waitingValue, last, sinceLast, late, missedDay };
}

/** The days of takings a deposit carries, oldest first. */
export function coveredDays(c: Collection, bags: { bagNo: string; day: number; kind: string }[], now = new Date()): string {
  const days = [...new Set(c.bagNos.map(n => bags.find(b => b.bagNo === n)).filter(b => b && b.kind === 'takings').map(b => b!.day))];
  return days.sort((a, b) => a - b).map(d => dayLabel(d, now)).join(', ') || `${c.bagNos.length} bags`;
}

/** Bank amount less the deposit: negative when the bank received less. Zero when matched by hand. */
export const bankDifference = (c: Collection, l: Landing) => (l.amount === undefined ? 0 : round2(l.amount - c.value));

/** Rule-based alerts on deposits: the same slip at two shops, and money short at the bank. */
export function depositAlerts(
  shop: CashShop, stored: Collection[], landings: Record<string, Landing>, now = new Date(), nameOf = (s: CashShop) => s.name,
): CashAlert[] {
  const out: CashAlert[] = [];
  const mine = allCollections(shop.siteId, stored).filter(c => dayOf(c.when, now) >= -13);
  for (const c of mine) {
    const l = landingFor(c, landings, now);
    const diff = l ? bankDifference(c, l) : 0;
    if (diff < 0) {
      out.push({
        id: `bank-${c.id}`, siteId: shop.siteId, rule: DEPOSIT_RULES.bankShort, day: dayOf(c.when, now), severity: 'bad',
        detail: `Deposited ${money(c.value)}, the bank received ${money(l?.amount ?? 0)}. ${money(-diff)} short.`,
      });
    }
    if (!c.reference) continue;
    for (const other of CASH_SHOPS.filter(s => s.siteId !== shop.siteId)) {
      const twin = allCollections(other.siteId, stored).find(x => x.reference === c.reference);
      if (twin && shop.siteId < other.siteId) {
        out.push({
          id: `slip-${c.id}`, siteId: shop.siteId, rule: DEPOSIT_RULES.sameSlip, day: dayOf(c.when, now), severity: 'bad',
          detail: `Same slip reference as ${nameOf(other)}, ${c.reference}. One shop may have uploaded the other's slip.`,
        });
      }
    }
  }
  return out;
}

export const DEPOSIT_RULES = {
  bankShort: 'Bank received less than the shop deposited',
  sameSlip: 'Same paying-in slip reference at two shops',
  missed: 'Deposit day missed and nothing banked for 3 days or more',
} as const;

// ── Accounts export ────────────────────────────────────────────────

export type MappingLine = { id: string; label: string; nominal: string; perSite?: boolean };

/** Nominal codes follow the example import Larry sent; each customer sets their own. */
export const DEFAULT_MAPPING: MappingLine[] = [
  { id: 'sales-Food', label: 'Food sales', nominal: '4200' },
  { id: 'sales-Hot drinks', label: 'Hot drinks sales', nominal: '4250' },
  { id: 'sales-Cold drinks', label: 'Cold drinks sales', nominal: '4120' },
  { id: 'sales-Snacks and sundries', label: 'Snacks and sundries sales', nominal: '4130' },
  { id: 'discounts', label: 'Discounts', nominal: '4201' },
  { id: 'promotions', label: 'Promotions and giveaways', nominal: '4111' },
  { id: 'tips', label: 'Tips control', nominal: '2125' },
  { id: 'gift-sold', label: 'Gift cards sold', nominal: '2140' },
  { id: 'gift-redeemed', label: 'Gift cards redeemed', nominal: '2141' },
  { id: 'tabs', label: 'Open tabs', nominal: '1102' },
  { id: 'cash', label: 'Cash declared (banking control)', nominal: '1222' },
  { id: 'card', label: 'Card control', nominal: '1520', perSite: true },
  { id: 'bacs', label: 'BACS receipts', nominal: '1405' },
  { id: 'paid-out', label: 'Sundry expenses paid from the till', nominal: '8205' },
  { id: 'variance', label: 'Cash variances', nominal: '7694' },
];

export const DEFAULT_COST_CENTRES: Record<string, string> = {
  'London stations': '110',
  'London high street': '120',
  Airports: '200',
};

export const useAccountsMapping = () => usePretState<MappingLine[]>('cash-accounts-mapping', DEFAULT_MAPPING);
export const useCostCentres = () => usePretState<Record<string, string>>('cash-cost-centres', DEFAULT_COST_CENTRES);

export type ExportRow = {
  day: number;
  siteId: string;
  site: string;
  region: string;
  costCentre: string;
  nominal: string;
  narrative: string;
  side: 'Debit' | 'Credit';
  amount: number;
};

/** Journal lines for one site-day. Debits and credits balance. */
export function exportRows(
  shop: CashShop,
  s: StatementDay,
  mapping: MappingLine[],
  centres: Record<string, string>,
): ExportRow[] {
  const region = regionOf(shop.siteId);
  const line = (id: string) => mapping.find(m => m.id === id);
  const out: ExportRow[] = [];
  const push = (id: string, side: 'Debit' | 'Credit', amount: number, narrative?: string) => {
    const m = line(id);
    if (!m || round2(amount) === 0) return;
    out.push({
      day: s.day, siteId: shop.siteId, site: shop.name, region, costCentre: centres[region] ?? '',
      nominal: m.perSite ? `${m.nominal}-${siteCodeOf(shop.siteId)}` : m.nominal,
      narrative: narrative ?? m.label, side: amount < 0 ? (side === 'Debit' ? 'Credit' : 'Debit') : side, amount: Math.abs(round2(amount)),
    });
  };
  for (const c of CATEGORIES) push(`sales-${c}`, 'Credit', s.sales[c]);
  push('discounts', 'Debit', s.discounts);
  push('promotions', 'Debit', s.promotions);
  push('tips', 'Credit', s.tips);
  push('gift-sold', 'Credit', s.giftSold);
  push('tabs', 'Debit', round2(s.carriedForward - s.broughtForward), 'Open tabs, carried less brought forward');
  for (const d of s.declared) {
    const id = d.id === 'gift' ? 'gift-redeemed' : d.id;
    push(id, 'Debit', d.declared);
  }
  push('variance', 'Debit', -s.variance, s.variance < 0 ? 'Cash variance, short' : 'Cash variance, over');
  return out;
}
