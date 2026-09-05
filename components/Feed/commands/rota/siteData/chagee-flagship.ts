/**
 * CHAGEE Flagship: what Edify knows about the store for the rota skill.
 *
 * The site is the existing `chagee-flagship` in the CHAGEE fixture
 * bundle (demo/chagee branch). This file is inert on builds without
 * that site and activates when the branch carries it.
 *
 * The store's constraint is machines and hoppers, not headcount: the
 * tea machine dispenses a cup in eight seconds, a person finishes it in
 * about forty. So the workload splits into a human curve (finishing,
 * counter, restock) and a machine capacity curve per machine.
 *
 * Hour shape follows the fixture bundle's day-part split (morning,
 * midday, afternoon) rendered onto hours: a tea bar peaks after lunch
 * and again after dinner, not at 8am like a café.
 */

import { dayMultiplierFromForecast } from '../shape';
import type { DayKey, DayPartOutcome, SiteLabourData } from '../types';

const H = (h: number, m = 0) => h * 60 + m;

const OUTCOMES: Record<DayKey, [number, number, number, number, number, number][]> = {
  Mon: [[0, 22, 0.9, -0.5, 1, 74], [0, 41, 1.0, -0.8, 1, 92], [0, 48, 1.0, -0.9, 1, 96], [0, 30, 1.0, -0.4, 1, 80]],
  Tue: [[0, 20, 0.9, -0.4, 1, 72], [0, 44, 1.1, -0.9, 1, 95], [0, 46, 1.0, -0.8, 1, 94], [0, 28, 0.9, -0.4, 1, 78]],
  Wed: [[0, 21, 0.9, -0.5, 1, 73], [0, 43, 1.0, -0.7, 1, 93], [-1, 61, 1.3, -1.4, 0.9, 118], [0, 31, 1.0, -0.5, 1, 82]],
  Thu: [[0, 23, 1.0, -0.5, 1, 75], [0, 42, 1.0, -0.8, 1, 94], [0, 49, 1.0, -0.9, 1, 97], [0, 29, 1.0, -0.4, 1, 79]],
  Fri: [[0, 24, 1.0, -0.6, 1, 76], [-2, 88, 2.1, -2.3, 0.7, 171], [-2, 94, 2.0, -2.1, 0.75, 164], [0, 36, 1.2, -0.7, 0.9, 88]],
  Sat: [[0, 26, 1.1, -0.6, 1, 78], [-3, 112, 2.6, -2.8, 0.6, 198], [-2, 97, 2.0, -2.0, 0.8, 160], [0, 40, 1.3, -0.8, 1, 90]],
  Sun: [[0, 19, 0.8, -0.4, 1, 71], [0, 47, 1.1, -0.9, 1, 99], [0, 52, 1.1, -1.0, 1, 101], [0, 27, 0.9, -0.4, 1, 77]],
};

const DAY_PARTS = ['Morning', 'Midday', 'Afternoon', 'Evening'];

function outcomes(day: DayKey): DayPartOutcome[] {
  return OUTCOMES[day].map(([hoursVsGuide, wasteGBP, wasteVsWeekday, stockVariancePct, checklistCompletion, speedOfServiceSec], i) => ({
    dayPart: DAY_PARTS[i],
    hoursVsGuide,
    wasteGBP,
    wasteVsWeekday,
    stockVariancePct,
    checklistCompletion,
    speedOfServiceSec,
  }));
}

/** Day parts from the CHAGEE fixture bundle (10:00 to 13:00 morning,
 *  13:00 to 17:00 midday, 17:00 to 22:00 afternoon) spread onto hours
 *  with the afternoon and post-dinner peaks a tea bar trades on. */
const CHAGEE_HOUR_SHAPE: Record<number, number> = {
  10: 420, 11: 640, 12: 900,
  13: 1050, 14: 1420, 15: 1520, 16: 1360,
  17: 1100, 18: 980, 19: 1200, 20: 1050, 21: 700,
};

export function CHAGEE_FLAGSHIP_LABOUR(): SiteLabourData {
  const dm = dayMultiplierFromForecast();
  return {
    siteId: 'chagee-flagship',
    openMin: H(10),
    closeMin: H(22),
    weeklySalesGBP: 52000,
    avgTicketGBP: 5.6,
    // Tea bars trade heavier at the weekend than a commuter café does.
    dayMultiplier: { ...dm, Mon: 0.9, Tue: 0.85, Wed: 0.95, Thu: 0.95, Fri: 1.05, Sat: 1.35, Sun: 1.15 },
    hourShape: CHAGEE_HOUR_SHAPE,
    hourAdjust: {
      Sat: { 14: 1.15, 15: 1.15, 16: 1.1 },
      Tue: { 19: 0.85, 20: 0.85, 21: 0.85 },
    },
    signals: {
      Sat: [{ label: 'Saturday afternoon', effectPct: 20, detail: 'up on the last four Saturdays: app pre-orders and a 60-cup group order at 14:30', start: H(14), end: H(17) }],
      Tue: [{ label: 'Tuesday evening', effectPct: -15, detail: 'down against the last four Tuesdays', start: H(19), end: H(22) }],
      Fri: [{ label: 'Friday', effectPct: 10, detail: 'end-of-week lift, office group orders' }],
    },
    standards: [
      { productType: 'Fresh milk tea', mix: 0.6, humanSeconds: 75, machineSeconds: 25, provenance: 'CHAGEE line standard: the machine dispenses in 8s but holds the cup for about 25s with placement and rinse; finishing, seal, label and hand-over about 42s. Unverified against store timestamps.' },
      { productType: 'Fruit tea with toppings', mix: 0.25, humanSeconds: 95, machineSeconds: 25, provenance: 'CHAGEE line standard plus topping scoop. Unverified.' },
      { productType: 'Pure tea', mix: 0.15, humanSeconds: 55, machineSeconds: 25, provenance: 'CHAGEE line standard, no toppings. Unverified.' },
    ],
    stations: [
      { id: 'machine-1', name: 'Machine 1', demandShare: 0.1, hasMachine: true, machineUnitsPerHour: 120 },
      { id: 'machine-2', name: 'Machine 2', demandShare: 0.1, hasMachine: true, machineUnitsPerHour: 120 },
      { id: 'finishing', name: 'Finishing', demandShare: 0.5 },
      { id: 'counter', name: 'Counter', demandShare: 0.25 },
      { id: 'restock', name: 'Restock and clean', demandShare: 0.05 },
    ],
    fixedTasks: [
      { id: 'brew-open', label: 'Brew bases', day: 'daily', start: H(10), end: H(11), humanMinutes: 20, machineMinutes: 20, stationId: 'machine-1', source: 'brew', evidence: 'Brew schedule: jasmine green and orchid oolong bases ready for 11:00' },
      { id: 'pearls', label: 'Cook pearls', day: 'daily', start: H(10), end: H(12), humanMinutes: 20, stationId: 'restock', source: 'prep', evidence: 'Topping prep from the brew schedule: tapioca pearls, two batches' },
      { id: 'hoppers', label: 'Hopper refills', day: 'daily', start: H(13), end: H(21), humanMinutes: 90, stationId: 'restock', source: 'prep', evidence: 'Hopper refill every 200 cups, about 15 refills across the afternoon and evening' },
      { id: 'group-sat', label: 'Group order, 60 cups', day: 'Sat', start: H(14), end: H(15), humanMinutes: 45, machineMinutes: 25, stationId: 'finishing', source: 'order', evidence: 'Group order of 60 cups booked for 14:30 Saturday, office nearby' },
      { id: 'close', label: 'Close-down', day: 'daily', start: H(21), end: H(22), humanMinutes: 45, stationId: 'restock', source: 'clean', evidence: 'Close-down checklist: machines flushed, hoppers washed' },
      { id: 'stocktake', label: 'Stocktake', day: 'Sun', start: H(10), end: H(12), humanMinutes: 90, stationId: 'restock', source: 'stocktake', evidence: 'Weekly stocktake, Sunday morning' },
    ],
    floorMinimum: 2,
    targetLabourPct: 9,
    lastWeek: {
      weekLabel: 'Mon 31 Aug to Sun 6 Sep',
      byDay: {
        Mon: outcomes('Mon'),
        Tue: outcomes('Tue'),
        Wed: outcomes('Wed'),
        Thu: outcomes('Thu'),
        Fri: outcomes('Fri'),
        Sat: outcomes('Sat'),
        Sun: outcomes('Sun'),
      },
      attribution:
        'Saturday midday ran 3 hours under guide. Waste was 2.6x the weekday average, speed of service reached 198 seconds and the hopper checklist was 60% complete.',
    },
  };
}
