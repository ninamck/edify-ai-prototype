/**
 * Deputy draft for CHAGEE Flagship, week of Mon 7 Sep 2026. UK store,
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

export function CHAGEE_FLAGSHIP_DEPUTY_DRAFT(): DeputyDraft {
  n = 0;
  const people: Person[] = [
    { id: 'mei', name: 'Mei Lin', role: 'Store manager', contractedHours: 40, keyholder: true },
    { id: 'jun', name: 'Jun Park', role: 'Shift leader', contractedHours: 38, keyholder: true },
    { id: 'priya', name: 'Priya Nair', role: 'Shift leader', contractedHours: 36, keyholder: true },
    { id: 'tom', name: 'Tom Adeyemi', role: 'Tea barista', contractedHours: 30 },
    { id: 'hana', name: 'Hana Sato', role: 'Tea barista', contractedHours: 30 },
    { id: 'leo', name: 'Leo Marsh', role: 'Tea barista', contractedHours: 24 },
    { id: 'zara', name: 'Zara Hussain', role: 'Tea barista', contractedHours: 24 },
    { id: 'kai', name: 'Kai Wong', role: 'Team member', contractedHours: 16, age: 17 },
    { id: 'ines', name: 'Inés Duarte', role: 'Team member', contractedHours: 20 },
    { id: 'dan', name: 'Dan Okoro', role: 'Team member, casual', contractedHours: 0 },
    { id: 'yuki', name: 'Yuki Tanaka', role: 'Tea barista', contractedHours: 30, leave: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], note: 'annual leave all week' },
  ];

  const shifts: Shift[] = [];
  const weekdays: Shift['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const openers = ['mei', 'jun', 'priya', 'mei', 'jun'];
  const closers = ['priya', 'mei', 'jun', 'priya', 'mei'];
  weekdays.forEach((day, i) => {
    shifts.push(shift(openers[i], day, H(9, 30), H(17, 30), OPEN, 'machine-1'));
    shifts.push(shift(i % 2 === 0 ? 'tom' : 'hana', day, H(10), H(18), OPEN, 'finishing'));
    shifts.push(shift(i % 2 === 0 ? 'hana' : 'tom', day, H(12), H(20), PEAK, 'counter'));
    shifts.push(shift(i < 3 ? 'leo' : 'zara', day, H(13), H(21), PEAK, 'finishing'));
    shifts.push(shift(closers[i], day, H(14), H(22, 30), CLOSE, 'machine-2'));
    shifts.push(shift(i < 2 ? 'ines' : i === 2 ? 'kai' : 'dan', day, H(17), i === 2 ? H(22, 30) : H(22), CLOSE, 'finishing'));
  });
  // Saturday: the heavy day. Two openers, three on peak, three to close.
  shifts.push(shift('jun', 'Sat', H(9, 30), H(17, 30), OPEN, 'machine-1'));
  shifts.push(shift('zara', 'Sat', H(10), H(18), OPEN, 'finishing'));
  shifts.push(shift('leo', 'Sat', H(12), H(20), PEAK, 'counter'));
  shifts.push(shift('hana', 'Sat', H(13), H(21), PEAK, 'finishing'));
  shifts.push(shift('priya', 'Sat', H(14), H(22, 30), CLOSE, 'machine-2'));
  shifts.push(shift('ines', 'Sat', H(16), H(22), CLOSE, 'counter'));
  shifts.push(shift('kai', 'Sat', H(17), H(22), CLOSE, 'finishing'));
  // Sunday
  shifts.push(shift('mei', 'Sun', H(9, 30), H(17, 30), OPEN, 'machine-1'));
  shifts.push(shift('tom', 'Sun', H(10), H(18), OPEN, 'finishing'));
  shifts.push(shift('zara', 'Sun', H(12), H(20), PEAK, 'counter'));
  shifts.push(shift('jun', 'Sun', H(14), H(22, 30), CLOSE, 'machine-2'));
  shifts.push(shift('dan', 'Sun', H(16), H(22), CLOSE, 'finishing'));

  return {
    siteId: 'chagee-flagship',
    siteName: 'CHAGEE Flagship',
    weekStart: '2026-09-07',
    weekLabel: 'Mon 7 to Sun 13 Sep',
    tool: 'Deputy',
    lastSynced: '08:40 today',
    hourlyCostGBP: 14.2,
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
