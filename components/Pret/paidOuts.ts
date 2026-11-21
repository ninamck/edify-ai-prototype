'use client';

import { usePretState } from './pretStore';
import {
  HISTORY_DAYS, at, dayLabel, hmLabel, money, rng, round2, tillPaidOuts, type CashShop, type TillEvent,
} from './cashFixtures';
import { tillDataTo, type CashAlert } from './cashStore';
import { PAID_OUT_FOR } from './cashOperators';

/**
 * Paid outs come from the till. The shop only says what each was for, and
 * can do it any time: nothing locks once the day is closed or banked.
 */

export type PaidOutNote = { category: string; note?: string; receipt: boolean; by: string; when: string };

export const usePaidOutNotes = () => usePretState<Record<string, PaidOutNote>>('cash-paid-out-notes', {});

export type PaidOut = TillEvent & { explained?: PaidOutNote };

/** Share of older paid outs each demo shop has explained, so the Support Centre has a spread to show. */
const EXPLAINED_SHARE: Record<string, number> = {
  'fitzroy-kings-cross': 0.92,
  'fitzroy-heathrow': 0.6,
  'fitzroy-espresso': 0.97,
  'fitzroy-islington': 1,
};

/** Today and yesterday stay open in the demo; earlier days are mostly explained already. */
function seededNote(e: TillEvent, shop: CashShop): PaidOutNote | undefined {
  if (e.day > -2) return undefined;
  const r = rng(`${e.id}|explained`);
  if (r() >= (EXPLAINED_SHARE[shop.siteId] ?? 0.8)) return undefined;
  const reasons = PAID_OUT_FOR.filter(x => x !== 'Other');
  return { category: reasons[Math.floor(r() * reasons.length)], receipt: true, by: e.login, when: at(e.day, hmLabel(e.minute + 5)) };
}

/** Paid outs for a shop, newest first, from `fromDay` to today. Today stops where the till data stops. */
export function paidOutsFor(shop: CashShop, notes: Record<string, PaidOutNote>, now = new Date(), fromDay = -(HISTORY_DAYS - 1)): PaidOut[] {
  const out: PaidOut[] = [];
  for (let day = 0; day >= fromDay; day -= 1) {
    const events = tillPaidOuts(shop, day, day === 0 ? { upTo: tillDataTo(shop, now) } : {});
    for (const e of [...events].reverse()) out.push({ ...e, explained: notes[e.id] ?? seededNote(e, shop) });
  }
  return out;
}

export function paidOutSummary(rows: PaidOut[]) {
  const open = rows.filter(r => !r.explained);
  return {
    total: rows.length,
    explained: rows.length - open.length,
    open,
    openValue: round2(open.reduce((s, r) => s + r.value, 0)),
    /** Unexplained for two days or more. */
    late: open.filter(r => r.day <= -2),
  };
}

export const PAID_OUT_RULE = 'Paid outs not explained after two days';

export function paidOutAlerts(shop: CashShop, notes: Record<string, PaidOutNote>, now = new Date()): CashAlert[] {
  const { late } = paidOutSummary(paidOutsFor(shop, notes, now, -6));
  if (!late.length) return [];
  const oldest = late.reduce((a, b) => (a.day < b.day ? a : b));
  return [{
    id: `paid-out-${shop.siteId}`, siteId: shop.siteId, rule: PAID_OUT_RULE, day: 0, severity: 'warn',
    detail: `${late.length} paid ${late.length === 1 ? 'out' : 'outs'}, ${money(round2(late.reduce((s, r) => s + r.value, 0)))}, not explained. Oldest ${dayLabel(oldest.day)}.`,
  }];
}
