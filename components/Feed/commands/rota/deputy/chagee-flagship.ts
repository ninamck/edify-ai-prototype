/**
 * Workforce.com draft for CHAGEE Flagship, week of Mon 7 Sep 2026. UK store,
 * UK rules, GBP. The site is the existing `chagee-flagship` in the
 * CHAGEE fixture bundle.
 */

import type { DeputyDraft, Person, Shift } from '../types';

const H = (h: number, m = 0) => h * 60 + m;

let n = 0;
function shift(personId: string, day: Shift['day'], start: number, end: number, area: string, stationId?: string): Shift {
  n += 1;
  return { id: `ch-${n}`, personId, day, start, end, area, stationId, breakMin: end - start > 6 * 60 ? 30 : 0 };
}

const OPEN = 'Open and brew';
const PEAK = 'Afternoon peak';
const CLOSE = 'Evening and close';

/**
 * The story in this draft. Mei built it on Friday with Yuki's leave
 * approved but her shifts not yet covered, so the weekend is thin:
 *   Kai (17) is on Wed's close to 22:30: under-18 rule breach.
 *   Saturday afternoon has the 60-cup group order at 14:30 on top of
 *     the Saturday lift, with only the weekday pattern rostered.
 *   Sunday morning has the stocktake with two on.
 *   Tuesday evening is quiet and runs four deep after 20:00.
 * Everything else matches the workload.
 */
export function CHAGEE_FLAGSHIP_DEPUTY_DRAFT(): DeputyDraft {
  n = 0;
  const people: Person[] = [
    { id: 'mei', name: 'Mei Lin', role: 'Store manager', contractedHours: 37.5, keyholder: true },
    { id: 'jun', name: 'Jun Park', role: 'Shift leader', contractedHours: 37.5, keyholder: true },
    { id: 'priya', name: 'Priya Nair', role: 'Shift leader', contractedHours: 30, keyholder: true },
    { id: 'tom', name: 'Tom Adeyemi', role: 'Tea barista', contractedHours: 32 },
    { id: 'hana', name: 'Hana Sato', role: 'Tea barista', contractedHours: 32 },
    { id: 'leo', name: 'Leo Marsh', role: 'Tea barista', contractedHours: 24 },
    { id: 'zara', name: 'Zara Hussain', role: 'Tea barista', contractedHours: 24 },
    { id: 'kai', name: 'Kai Wong', role: 'Team member', contractedHours: 15, age: 17 },
    { id: 'ines', name: 'Inés Duarte', role: 'Team member', contractedHours: 20 },
    { id: 'dan', name: 'Dan Okoro', role: 'Team member, casual', contractedHours: 0 },
    { id: 'yuki', name: 'Yuki Tanaka', role: 'Tea barista', contractedHours: 30, leave: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], note: 'annual leave all week' },
  ];

  const shifts: Shift[] = [];
  const weekdays: Shift['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  // Managers rotate open and close so nobody closes then opens.
  const openers = ['mei', 'jun', 'priya', 'mei', 'jun'];
  const closers = ['jun', 'priya', 'mei', 'jun', 'priya'];
  const openBarista = ['tom', 'hana', 'tom', 'hana', 'tom'];
  const midBarista = ['leo', 'zara', 'leo', 'zara', 'ines'];
  const lateBarista = ['hana', 'tom', 'hana', 'tom', 'hana'];
  const closeTeam = ['ines', 'kai', 'kai', 'ines', 'dan'];
  weekdays.forEach((day, i) => {
    shifts.push(shift(openers[i], day, H(10), H(18), OPEN, 'machine-1'));
    shifts.push(shift(openBarista[i], day, H(10), H(18), OPEN, 'finishing'));
    shifts.push(shift(midBarista[i], day, H(12), H(20), PEAK, 'counter'));
    shifts.push(shift(lateBarista[i], day, H(14), H(22), PEAK, 'finishing'));
    shifts.push(shift(closers[i], day, H(14), H(22), CLOSE, 'machine-2'));
    // Kai is 17. Wednesday's 22:30 finish is the breach the GM missed.
    shifts.push(shift(closeTeam[i], day, H(17), day === 'Wed' ? H(22, 30) : H(22), CLOSE, 'finishing'));
  });
  // Saturday: everyone bar Yuki, on the weekday pattern. Not enough
  // for the Saturday lift plus the 14:30 group order.
  shifts.push(shift('priya', 'Sat', H(10), H(18), OPEN, 'machine-1'));
  shifts.push(shift('zara', 'Sat', H(10), H(18), OPEN, 'finishing'));
  shifts.push(shift('leo', 'Sat', H(12), H(20), PEAK, 'counter'));
  shifts.push(shift('hana', 'Sat', H(13), H(21), PEAK, 'finishing'));
  shifts.push(shift('mei', 'Sat', H(14), H(22), CLOSE, 'machine-2'));
  shifts.push(shift('tom', 'Sat', H(14), H(22), CLOSE, 'finishing'));
  shifts.push(shift('ines', 'Sat', H(16), H(22), CLOSE, 'counter'));
  shifts.push(shift('kai', 'Sat', H(17), H(22), CLOSE, 'finishing'));
  // Sunday: stocktake morning with two on, and a close one short.
  shifts.push(shift('mei', 'Sun', H(10), H(18), OPEN, 'machine-1'));
  shifts.push(shift('leo', 'Sun', H(10), H(18), OPEN, 'finishing'));
  shifts.push(shift('zara', 'Sun', H(12), H(20), PEAK, 'counter'));
  shifts.push(shift('dan', 'Sun', H(13), H(22), PEAK, 'finishing'));
  shifts.push(shift('jun', 'Sun', H(14), H(22), CLOSE, 'machine-2'));
  shifts.push(shift('priya', 'Sun', H(15), H(22), CLOSE, 'counter'));

  return {
    siteId: 'chagee-flagship',
    siteName: 'CHAGEE Flagship',
    weekStart: '2026-09-07',
    weekLabel: 'Mon 7 to Sun 13 Sep',
    tool: 'Workforce.com',
    lastSynced: '08:40 today',
    hourlyCostGBP: 15,
    areas: [OPEN, PEAK, CLOSE],
    people,
    shifts,
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
