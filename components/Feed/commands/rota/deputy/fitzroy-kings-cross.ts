/**
 * Workforce.com draft for Fitzroy King's Cross, week of Mon 7 Sep 2026.
 *
 * This is what Edify pulls from the workforce tool: the GM's draft as
 * she left it, with people, contracted hours, age, leave and the
 * site's labour rules. Rules are configuration, not code: a Malaysian
 * or Chinese franchisee carries a different list.
 */

import type { DeputyDraft, Shift } from '../types';

const H = (h: number, m = 0) => h * 60 + m;

let n = 0;
function shift(personId: string, day: Shift['day'], start: number, end: number, area: string, stationId?: string): Shift {
  n += 1;
  return {
    id: `kx-${n}`,
    personId,
    day,
    start,
    end,
    area,
    stationId,
    breakMin: end - start > 6 * 60 ? 30 : 0,
  };
}

const OPENING = 'Opening';
const CLOSING = 'Closing / Support';

export function KINGS_CROSS_DEPUTY_DRAFT(): DeputyDraft {
  n = 0;
  return {
    siteId: 'fitzroy-kings-cross',
    siteName: "Fitzroy King's Cross",
    weekStart: '2026-09-07',
    weekLabel: 'Mon 7 to Sun 13 Sep',
    tool: 'Workforce.com',
    lastSynced: '09:12 today',
    hourlyCostGBP: 15,
    areas: [OPENING, CLOSING],
    people: [
      { id: 'amy', name: 'Amy', role: 'Team leader', contractedHours: 32, keyholder: true },
      { id: 'alba', name: 'Alba', role: 'Barista', contractedHours: 24 },
      { id: 'emily', name: 'Emily Christie', role: 'Barista', contractedHours: 24 },
      { id: 'finn', name: 'Finn', role: 'Team member', contractedHours: 12, age: 17 },
      { id: 'freya', name: 'Freya', role: 'Barista', contractedHours: 20 },
      { id: 'giuseppe', name: 'Giuseppe Colaci', role: 'Team leader', contractedHours: 30, keyholder: true },
      { id: 'helen', name: 'Helen', role: 'Supervisor', contractedHours: 38, keyholder: true },
      { id: 'sam', name: 'Sam Fry', role: 'Barista, casual', contractedHours: 0, unavailable: ['Sat'], note: 'unavailable Sat' },
      { id: 'cynthia', name: 'Cynthia Markuseková', role: 'Barista', contractedHours: 24, leave: ['Mon', 'Tue', 'Wed', 'Thu'], note: 'annual leave Mon to Thu, back Friday' },
    ],
    shifts: [
      // Monday
      shift('amy', 'Mon', H(6), H(15), OPENING, 'bar'),
      shift('giuseppe', 'Mon', H(6), H(14), OPENING, 'counter'),
      shift('sam', 'Mon', H(11), H(23), CLOSING, 'counter'),
      shift('helen', 'Mon', H(14), H(23), CLOSING, 'bar'),
      shift('alba', 'Mon', H(15), H(23), CLOSING, 'kitchen'),
      // Tuesday
      shift('amy', 'Tue', H(6), H(14), OPENING, 'bar'),
      shift('freya', 'Tue', H(6), H(13), OPENING, 'counter'),
      shift('emily', 'Tue', H(12), H(20), CLOSING, 'bar'),
      shift('helen', 'Tue', H(14), H(23), CLOSING, 'counter'),
      shift('sam', 'Tue', H(18), H(23), CLOSING, 'kitchen'),
      // Wednesday
      shift('giuseppe', 'Wed', H(6), H(15), OPENING, 'bar'),
      shift('alba', 'Wed', H(6), H(14), OPENING, 'counter'),
      shift('helen', 'Wed', H(14), H(23), CLOSING, 'bar'),
      shift('finn', 'Wed', H(15), H(23), CLOSING, 'counter'),
      // Thursday
      shift('amy', 'Thu', H(6), H(14), OPENING, 'bar'),
      shift('giuseppe', 'Thu', H(6), H(14), OPENING, 'kitchen'),
      shift('helen', 'Thu', H(7), H(15), OPENING, 'counter'),
      shift('freya', 'Thu', H(14), H(23), CLOSING, 'bar'),
      shift('alba', 'Thu', H(15), H(23), CLOSING, 'counter'),
      // Friday
      shift('emily', 'Fri', H(6), H(14), OPENING, 'bar'),
      shift('giuseppe', 'Fri', H(6), H(14), OPENING, 'kitchen'),
      shift('helen', 'Fri', H(14), H(23), CLOSING, 'bar'),
      shift('sam', 'Fri', H(14), H(23), CLOSING, 'counter'),
      // Saturday
      shift('emily', 'Sat', H(8), H(16), OPENING, 'bar'),
      shift('cynthia', 'Sat', H(8), H(16), OPENING, 'counter'),
      shift('freya', 'Sat', H(15), H(20), CLOSING, 'bar'),
      shift('finn', 'Sat', H(16), H(20), CLOSING, 'counter'),
      // Sunday
      shift('amy', 'Sun', H(9), H(18), OPENING, 'bar'),
      shift('cynthia', 'Sun', H(9), H(18), OPENING, 'counter'),
    ],
    rules: [
      { id: 'rest', kind: 'rest-between-shifts', label: '11 hours rest between shifts', value: 11 },
      { id: 'u18-finish', kind: 'under18-latest-finish', label: 'Under-18s finish by 22:00', value: H(22) },
      { id: 'u18-daily', kind: 'under18-max-daily-hours', label: 'Under-18s work 8 hours a day at most', value: 8 },
      { id: 'weekly', kind: 'weekly-average', label: '48-hour week', value: 48 },
      { id: 'break', kind: 'break-after', label: '20-minute break after 6 hours', value: 6 },
      { id: 'contract', kind: 'contracted-hours', label: 'Contracted hours met', value: 0 },
    ],
  };
}
