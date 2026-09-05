/**
 * Last week across the estate, one row per existing site, for the
 * Estate tab on /labour. This is the HQ view: which sites ran under
 * the labour guide, and what it cost them in waste, variance,
 * checklists and speed of service.
 *
 * King's Cross is derived from its full day-part outcomes so the two
 * views agree. The other Fitzroy sites carry a weekly summary only;
 * the prototype has no Deputy draft for them, so the rebalance is not
 * offered there. No new sites: every id is already in ACTIVE_SITES.
 */

import type { DayKey, DayPartOutcome, LastWeek } from '../types';

export interface EstateLabourRow {
  siteId: string;
  /** Hours rostered against the guide last week. Negative is under. */
  hoursVsGuide: number;
  guideHours: number;
  /** Waste as a multiple of the weekday average across the week. */
  wasteVsWeekday: number;
  stockVariancePct: number;
  /** Checklist steps completed, 0 to 1. */
  checklistCompletion: number;
  speedOfServiceSec: number;
  /** Where the hours went missing, in one line. Empty when on guide. */
  note: string;
}

const DAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Roll a site's day-part outcomes up to one estate row. Day parts the
 *  site was closed for (all zeros) are skipped. */
export function rowFromLastWeek(siteId: string, lastWeek: LastWeek, guideHours: number): EstateLabourRow {
  const parts: DayPartOutcome[] = DAYS.flatMap((d) => lastWeek.byDay[d]).filter((p) => p.speedOfServiceSec > 0);
  const n = parts.length || 1;
  const avg = (f: (p: DayPartOutcome) => number, dp = 2) => Math.round((parts.reduce((s, p) => s + f(p), 0) / n) * 10 ** dp) / 10 ** dp;
  const under = DAYS.flatMap((d) => lastWeek.byDay[d].map((p) => ({ d, p }))).filter(({ p }) => p.hoursVsGuide < 0);
  const worst = under.sort((a, b) => a.p.hoursVsGuide - b.p.hoursVsGuide)[0];
  return {
    siteId,
    hoursVsGuide: parts.reduce((s, p) => s + p.hoursVsGuide, 0),
    guideHours,
    wasteVsWeekday: avg((p) => p.wasteVsWeekday),
    stockVariancePct: avg((p) => p.stockVariancePct, 1),
    checklistCompletion: avg((p) => p.checklistCompletion),
    speedOfServiceSec: Math.round(avg((p) => p.speedOfServiceSec, 0)),
    note: worst ? `${worst.d} ${worst.p.dayPart.toLowerCase()} ran ${Math.abs(worst.p.hoursVsGuide)}h under guide` : '',
  };
}

/** Weekly summaries for the sites that have no full labour view yet. */
export const ESTATE_SUMMARY_ROWS: EstateLabourRow[] = [
  {
    siteId: 'fitzroy-espresso',
    hoursVsGuide: 6,
    guideHours: 312,
    wasteVsWeekday: 0.9,
    stockVariancePct: -0.4,
    checklistCompletion: 0.98,
    speedOfServiceSec: 0,
    note: 'Hub kitchen, no counter. 6h over guide on Tue and Wed bake shifts.',
  },
  {
    siteId: 'fitzroy-heathrow',
    hoursVsGuide: -7,
    guideHours: 268,
    wasteVsWeekday: 1.6,
    stockVariancePct: -1.1,
    checklistCompletion: 0.82,
    speedOfServiceSec: 124,
    note: 'Fri and Sun mornings ran 4h and 3h under guide against early departures',
  },
  {
    siteId: 'fitzroy-gatwick',
    hoursVsGuide: -2,
    guideHours: 241,
    wasteVsWeekday: 1.1,
    stockVariancePct: -0.6,
    checklistCompletion: 0.94,
    speedOfServiceSec: 98,
    note: 'Sat midday ran 2h under guide',
  },
  {
    siteId: 'fitzroy-islington',
    hoursVsGuide: 5,
    guideHours: 186,
    wasteVsWeekday: 0.8,
    stockVariancePct: -0.3,
    checklistCompletion: 1,
    speedOfServiceSec: 79,
    note: 'On guide. 5h over on Mon and Tue afternoons.',
  },
];
