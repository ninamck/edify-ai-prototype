/**
 * Fitzroy King's Cross: what Edify knows about the site for the rota
 * skill. The site itself is the existing commuter spoke in
 * `ACTIVE_SITES`; this file adds the labour view of it.
 *
 * Forecast shape and day pattern are read from data the prototype
 * already holds (dashboard hourly trading, production day-of-week
 * multipliers). Labour standards are defaults for a café and say so in
 * their provenance; they refine from POS timestamps once the site is
 * live on Edify.
 */

import { hourShapeFromTrading, dayMultiplierFromForecast } from '../shape';
import type { DayKey, DayPartOutcome, SiteLabourData } from '../types';

const H = (h: number, m = 0) => h * 60 + m;

/** Last week's outcomes by day part. Hours vs guide first, then what
 *  the same slots cost. Columns: hoursVsGuide, wasteGBP, wasteVsWeekday,
 *  stockVariancePct, checklistCompletion, speedOfServiceSec. */
const OUTCOMES: Record<DayKey, [number, number, number, number, number, number][]> = {
  Mon: [[0, 14, 0.9, -0.4, 1, 88], [1, 18, 1.0, -0.6, 1, 96], [2, 12, 0.9, -0.3, 1, 74], [1, 9, 1.0, -0.2, 1, 70]],
  Tue: [[0, 15, 1.0, -0.5, 1, 90], [0, 19, 1.0, -0.5, 1, 98], [0, 13, 1.0, -0.4, 0.95, 78], [1, 8, 0.9, -0.2, 1, 68]],
  Wed: [[0, 13, 0.9, -0.3, 1, 86], [0, 20, 1.1, -0.7, 1, 101], [0, 12, 0.9, -0.4, 1, 76], [0, 9, 1.0, -0.3, 1, 72]],
  Thu: [[-1, 24, 1.6, -1.2, 0.85, 118], [0, 21, 1.1, -0.6, 1, 104], [0, 14, 1.0, -0.4, 1, 80], [0, 10, 1.1, -0.3, 1, 74]],
  Fri: [[-2, 31, 2.1, -1.6, 0.7, 131], [0, 22, 1.2, -0.8, 1, 107], [0, 15, 1.1, -0.5, 1, 82], [0, 11, 1.2, -0.4, 0.9, 77]],
  Sat: [[0, 12, 0.8, -0.3, 1, 84], [-3, 38, 2.0, -1.9, 0.75, 142], [-1, 19, 1.4, -0.9, 0.9, 96], [0, 0, 0, 0, 1, 0]],
  Sun: [[0, 9, 0.6, -0.2, 1, 80], [0, 15, 0.8, -0.5, 1, 92], [-1, 14, 1.0, -0.6, 0.6, 88], [0, 0, 0, 0, 1, 0]],
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

export function FITZROY_KINGS_CROSS_LABOUR(): SiteLabourData {
  return {
    siteId: 'fitzroy-kings-cross',
    openMin: H(6),
    closeMin: H(23),
    hoursByDay: {
      Sat: { open: H(8), close: H(20) },
      Sun: { open: H(9), close: H(18) },
    },
    weeklySalesGBP: 12000,
    avgTicketGBP: 6.4,
    dayMultiplier: { ...dayMultiplierFromForecast(), Sat: 0.9 },
    hourShape: hourShapeFromTrading(),
    hourAdjust: {
      Sat: { 11: 1.18, 12: 1.18, 13: 1.18 },
      Tue: { 17: 0.88, 18: 0.88, 19: 0.88, 20: 0.88, 21: 0.88, 22: 0.88 },
    },
    signals: {
      Sat: [{ label: 'Saturday lunch', effectPct: 18, detail: 'up on the last four Saturdays: dry forecast, Granary Square market on', start: H(11), end: H(14) }],
      Tue: [{ label: 'Tuesday evening', effectPct: -12, detail: 'down against the last four Tuesdays', start: H(17), end: H(23) }],
      Fri: [{ label: 'Friday', effectPct: 10, detail: 'usual end-of-week lift, no event' }],
    },
    standards: [
      { productType: 'Hot drink', mix: 0.55, humanSeconds: 140, machineSeconds: 25, provenance: 'Café default: order, make, hand over, clean-down share. Unverified against King\'s Cross POS timestamps.' },
      { productType: 'Food to go', mix: 0.3, humanSeconds: 120, machineSeconds: 0, provenance: 'Café default: pick, till, restock share. Unverified.' },
      { productType: 'Hot food', mix: 0.15, humanSeconds: 240, machineSeconds: 180, provenance: 'Café default: assemble, oven, plate, wash-up share. Oven time is machine time. Unverified.' },
    ],
    stations: [
      { id: 'bar', name: 'Bar', demandShare: 0.5, hasMachine: true, machineUnitsPerHour: 90 },
      { id: 'counter', name: 'Counter', demandShare: 0.3 },
      { id: 'kitchen', name: 'Kitchen', demandShare: 0.2, hasMachine: true, machineUnitsPerHour: 40 },
      { id: 'restock', name: 'Restock and clean', demandShare: 0 },
    ],
    fixedTasks: [
      { id: 'prep-daily', label: 'Opening prep and checks', day: 'daily', start: H(6), end: H(8), humanMinutes: 60, stationId: 'kitchen', source: 'prep', evidence: 'Prep list from the production plan plus the 12-step opening checklist' },
      { id: 'prep-fri', label: 'Prep plan up 22%', day: 'Fri', start: H(6), end: H(9), humanMinutes: 120, stationId: 'kitchen', source: 'prep', evidence: 'Production plan up 22% on Friday: 14 more trays for the weekend' },
      { id: 'grn-thu', label: 'GRN due 07:00', day: 'Thu', start: H(7), end: H(8), humanMinutes: 30, stationId: 'restock', source: 'grn', evidence: 'Bidvest delivery due 07:00 Thursday, 18 lines to check in' },
      { id: 'preorders-sat', label: 'Market-day pre-orders', day: 'Sat', start: H(11), end: H(14), humanMinutes: 90, stationId: 'counter', source: 'order', evidence: '40 lunch boxes pre-ordered for collection 12:00 to 14:00, Granary Square market' },
      { id: 'stocktake-sun', label: 'Stocktake', day: 'Sun', start: H(15), end: H(17), humanMinutes: 90, stationId: 'restock', source: 'stocktake', evidence: 'Weekly stocktake, 90 minutes, Sunday afternoon' },
      { id: 'close-clean', label: 'Close-down', day: 'daily', start: H(22), end: H(23), humanMinutes: 45, stationId: 'restock', source: 'clean', evidence: 'Close-down checklist' },
    ],
    floorMinimum: 2,
    targetLabourPct: 27,
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
        'Saturday midday ran 3 hours under guide. Waste was 2.0x the weekday average, speed of service slipped to 142 seconds and the midday checklist was 75% complete.',
    },
  };
}
