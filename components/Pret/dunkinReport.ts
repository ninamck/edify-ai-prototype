import {
  eventsTotal, rng, round2, tillPaidIns, tillPaidOuts, type CashShop, type Collection, type DayClose,
} from './cashFixtures';
import { allBags, allCloses, dayOf, type Correction } from './cashStore';
import { DEPOSIT_NUDGE_DAYS, bankDifference, landingFor, missingAtBank, type Landing } from './cashOperators';
import { paidOutsFor, type PaidOut, type PaidOutNote } from './paidOuts';

/**
 * Head office reporting for Kyle. It replaces two things he uses today: the
 * Oracle System Sales Report, one store and day at a time, and the Cash Deposit
 * Report spreadsheet built from WorkPulse downloads and the bank statements.
 * Every figure from both is here; the layout is Edify's.
 */

export type Market = 'New York' | 'South Carolina';

/** What Kyle's spreadsheet carries for each store: store number, legal entity, district manager and market. */
export type DunkinStore = { pc: string; entity: string; dm: string; market: Market; cashShare: number; taxRate: number };

export const DUNKIN_ORG: Record<string, DunkinStore> = {
  'fitzroy-espresso': { pc: '340462', entity: 'BRX 340 LLC', dm: 'Angela Ruiz', market: 'New York', cashShare: 0.15, taxRate: 0.0742 },
  'fitzroy-kings-cross': { pc: '332974', entity: 'YNK 332 LLC', dm: 'Angela Ruiz', market: 'New York', cashShare: 0.14, taxRate: 0.0742 },
  'fitzroy-heathrow': { pc: '302692', entity: 'WPL 302 LLC', dm: 'Luis Moreno', market: 'New York', cashShare: 0.15, taxRate: 0.0702 },
  'fitzroy-islington': { pc: '358804', entity: 'IRM 358 LLC', dm: 'Tanya Brooks', market: 'South Carolina', cashShare: 0.08, taxRate: 0.07 },
};

const FALLBACK: DunkinStore = { pc: '', entity: '', dm: 'Unassigned', market: 'New York', cashShare: 0.1, taxRate: 0.07 };
export const dunkinStore = (siteId: string) => DUNKIN_ORG[siteId] ?? FALLBACK;
export const DUNKIN_DMS = [...new Set(Object.values(DUNKIN_ORG).map(s => s.dm))];

// ── The Oracle day ─────────────────────────────────────────────────

export type Tally = { count: number; value: number };

/** Every line of Oracle's System Sales Report for one store and day. */
export type OracleDay = {
  netSales: number;
  serviceCharges: number;
  tax: number;
  totalRevenue: number;
  nonRevenueSvc: number;
  giftCardSales: number;
  totalCollections: number;
  returns: Tally;
  voids: Tally;
  mgrVoids: Tally;
  errorCorrects: Tally;
  cancels: Tally;
  creditTotal: number;
  rounding: number;
  checks: { carriedOver: Tally; begun: Tally; paid: Tally; transferredIn: Tally; transferredOut: Tally; outstanding: Tally };
  cashIn: number;
  paidOut: number;
  paidIn: number;
  cashDue: number;
};

/** White Plains has run high on error corrects and cancels this week, so the demo has one to spot. */
const ADJUSTMENT_BOOST: Record<string, { from: number; errorCorrects: number; cancels: number }> = {
  'fitzroy-heathrow': { from: -6, errorCorrects: 1.8, cancels: 1.7 },
};

function openChecks(shop: CashShop, day: number): Tally {
  const r = rng(`${shop.siteId}|${day}|open-checks`);
  const count = 5 + Math.floor(r() * 9);
  return { count, value: round2(count * (7.6 + r() * 2)) };
}

const tally = (r: () => number, lo: number, hi: number, each: [number, number], boost = 1): Tally => {
  const count = Math.round((lo + Math.floor(r() * (hi - lo + 1))) * boost);
  return { count, value: round2(count * (each[0] + r() * (each[1] - each[0]))) };
};

/** Built back from cash due, so Oracle's figures always agree with the close in Edify. */
export function oracleDay(shop: CashShop, day: number, cashDue: number, paidOut: number, paidIn: number): OracleDay {
  const org = dunkinStore(shop.siteId);
  const r = rng(`${shop.siteId}|${day}|oracle`);
  const cashIn = round2(cashDue + paidOut - paidIn);
  const totalRevenue = round2(cashIn / (org.cashShare * (0.9 + r() * 0.2)));
  const netSales = round2(totalRevenue / (1 + org.taxRate));
  const giftCardSales = r() < 0.25 ? round2(10 + r() * 40) : 0;
  const begun = Math.round(totalRevenue / (7.2 + r() * 0.9));
  const carriedOver = openChecks(shop, day - 1);
  const outstanding = openChecks(shop, day);
  const boost = ADJUSTMENT_BOOST[shop.siteId];
  const boosted = boost && day >= boost.from;
  const scale = begun / 400;
  return {
    netSales,
    serviceCharges: 0,
    tax: round2(totalRevenue - netSales),
    totalRevenue,
    nonRevenueSvc: 0,
    giftCardSales,
    totalCollections: round2(totalRevenue + giftCardSales),
    returns: tally(r, 0, 4, [1.5, 3.2]),
    voids: tally(r, 0, 2, [2, 6]),
    mgrVoids: tally(r, 0, 1, [3, 9]),
    errorCorrects: tally(r, Math.round(36 * scale), Math.round(56 * scale), [1.5, 2], boosted ? boost.errorCorrects : 1),
    cancels: tally(r, 4, 11, [8, 11], boosted ? boost.cancels : 1),
    creditTotal: 0,
    rounding: 0,
    checks: {
      carriedOver,
      begun: { count: begun, value: totalRevenue },
      paid: { count: begun + carriedOver.count - outstanding.count, value: round2(totalRevenue + carriedOver.value - outstanding.value) },
      transferredIn: { count: 0, value: 0 },
      transferredOut: { count: 0, value: 0 },
      outstanding,
    },
    cashIn,
    paidOut,
    paidIn,
    cashDue,
  };
}

// ── One row per store per day ──────────────────────────────────────

/**
 * Where a day's cash is: still in the safe, taken to the bank and waiting for
 * the statement, on the statement, on it but short, or missing after 3 days.
 */
export type BankState = 'in-safe' | 'waiting' | 'in-bank' | 'bank-short' | 'missing';

export const BANK_STATE_LABEL: Record<BankState, string> = {
  'in-safe': 'In the safe',
  waiting: 'On its way',
  'in-bank': 'In the bank',
  'bank-short': 'Short at bank',
  missing: 'Missing at bank',
};

export const BANK_STATE_PILL: Record<BankState, string> = {
  'in-safe': 'neutral', waiting: 'reporting', 'in-bank': 'good', 'bank-short': 'warn', missing: 'warn',
};

export type LedgerRow = {
  siteId: string;
  day: number;
  close: DayClose;
  oracle: OracleDay;
  cashDue: number;
  /** What the shop counted and bagged for the bank. */
  deposited: number;
  shortOver: number;
  paidOuts: PaidOut[];
  paidOutValue: number;
  explainedValue: number;
  deposit?: Collection;
  bank: BankState;
  /** Bank received less than the deposit carrying this day. Negative when short. */
  bankDiff: number;
  note?: string;
};

/** Close notes written for the Pret shops that don't make sense in a US store. */
const DUNKIN_NOTE: Record<string, string> = {
  'close-fitzroy-heathrow|-2': 'Till 4 over after the morning rush. Change likely not given on a $20.',
};

/** Days off by more than this get a look. Smaller differences are change given. */
export const SHORT_OVER_LOOK = 5;

/** Paid outs only count against a day once the two days to explain them have passed. */
export const paidOutsLate = (r: LedgerRow) => r.day <= -2 && r.explainedValue < r.paidOutValue;

/** The day's takings are still in the safe as long after the close as the missed-deposit rule allows. */
export const depositLate = (r: LedgerRow) => r.bank === 'in-safe' && r.day <= -DEPOSIT_NUDGE_DAYS;

export function needsLook(r: LedgerRow): boolean {
  return Math.abs(r.shortOver) > SHORT_OVER_LOOK || r.bank === 'missing' || r.bank === 'bank-short' || paidOutsLate(r) || depositLate(r);
}

export function dunkinLedger(
  shop: CashShop,
  data: { closes: DayClose[]; collections: Collection[]; corrections: Correction[] },
  notes: Record<string, PaidOutNote>,
  landings: Record<string, Landing>,
  fromDay: number,
  now = new Date(),
): LedgerRow[] {
  const bags = allBags(shop.siteId, data.closes, data.collections, data.corrections, now).filter(b => b.kind === 'takings');
  const paidOuts = paidOutsFor(shop, notes, now, fromDay);
  return allCloses(shop.siteId, data.closes, now)
    .filter(c => c.day >= fromDay)
    .map(original => {
      const c = DUNKIN_NOTE[original.id] ? { ...original, varianceReason: DUNKIN_NOTE[original.id] } : original;
      const dayPaidOuts = paidOuts.filter(p => p.day === c.day);
      const paidOut = eventsTotal(tillPaidOuts(shop, c.day));
      const paidIn = round2(tillPaidIns(shop, c.day).reduce((s, p) => s + p.value, 0));
      const mine = bags.filter(b => b.closeId === c.id);
      const deposited = round2(mine.reduce((s, b) => s + b.value, 0));
      const cashDue = round2(deposited - c.variance);
      const deposit = mine.find(b => b.collectedBy)?.collectedBy;
      let bank: BankState = 'in-safe';
      let bankDiff = 0;
      if (deposit) {
        const l = landingFor(deposit, landings, now);
        if (l) {
          bankDiff = bankDifference(deposit, l);
          bank = bankDiff < 0 ? 'bank-short' : 'in-bank';
        } else {
          bank = missingAtBank(deposit, landings, now) ? 'missing' : 'waiting';
        }
      }
      return {
        siteId: shop.siteId,
        day: dayOf(c.when, now),
        close: c,
        oracle: oracleDay(shop, c.day, cashDue, paidOut, paidIn),
        cashDue,
        deposited,
        shortOver: c.variance,
        paidOuts: dayPaidOuts,
        paidOutValue: round2(dayPaidOuts.reduce((s, p) => s + p.value, 0)),
        explainedValue: round2(dayPaidOuts.filter(p => p.explained).reduce((s, p) => s + p.value, 0)),
        deposit,
        bank,
        bankDiff,
        note: c.varianceReason ?? deposit?.comment,
      };
    });
}

/** Error corrects and cancels per $1,000 of net sales, the fair way to compare a big store with a small one. */
export function adjustmentRate(rows: LedgerRow[], key: 'errorCorrects' | 'cancels'): number {
  const sales = rows.reduce((s, r) => s + r.oracle.netSales, 0);
  return sales ? (rows.reduce((s, r) => s + r.oracle[key].value, 0) / sales) * 1000 : 0;
}

export const sumTally = (rows: LedgerRow[], key: 'returns' | 'voids' | 'mgrVoids' | 'errorCorrects' | 'cancels'): Tally => ({
  count: rows.reduce((s, r) => s + r.oracle[key].count, 0),
  value: round2(rows.reduce((s, r) => s + r.oracle[key].value, 0)),
});
