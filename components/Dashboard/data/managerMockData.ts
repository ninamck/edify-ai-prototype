/**
 * Mock data for the in-shift Manager dashboard.
 * Scenario: Fitzroy Espresso on a trading day. Weather came in warmer than
 * forecast, creating a "push cold drinks" decision.
 *
 * The dashboard is phase-aware: morning / midday / afternoon / evening shift
 * the cutoff so hours past it are ghosted. The `FOR_PHASE` helpers return
 * copies of the fixtures with `actual` populated up to the phase's cutoff.
 */

import type { BriefingPhase } from '@/components/briefing';

// Legacy — kept for any direct imports. Matches midday.
export const CURRENT_HOUR_INDEX = 5;

export function currentHourIndexForPhase(phase: BriefingPhase): number {
  switch (phase) {
    case 'morning':   return 2;  // 8am — 3 hours of actuals
    case 'midday':    return 5;  // 11am — current default
    case 'afternoon': return 9;  // 3pm
    case 'evening':   return 14; // 8pm — nearly full day
  }
}

export type WeatherCondition = 'sun' | 'cloud' | 'rain' | 'part-cloud';

export interface WeatherRow {
  hour: string;
  actual: { condition: WeatherCondition; tempC: number } | null;
  forecast: { condition: WeatherCondition; tempC: number };
}

export const WEATHER_HOURLY: WeatherRow[] = [
  { hour: '6am',  actual: { condition: 'cloud', tempC: 11 }, forecast: { condition: 'cloud', tempC: 10 } },
  { hour: '7am',  actual: { condition: 'cloud', tempC: 12 }, forecast: { condition: 'cloud', tempC: 11 } },
  { hour: '8am',  actual: { condition: 'part-cloud', tempC: 14 }, forecast: { condition: 'cloud', tempC: 12 } },
  { hour: '9am',  actual: { condition: 'part-cloud', tempC: 16 }, forecast: { condition: 'part-cloud', tempC: 13 } },
  { hour: '10am', actual: { condition: 'sun', tempC: 19 }, forecast: { condition: 'part-cloud', tempC: 14 } },
  { hour: '11am', actual: { condition: 'sun', tempC: 21 }, forecast: { condition: 'part-cloud', tempC: 15 } },
  { hour: '12pm', actual: null, forecast: { condition: 'part-cloud', tempC: 16 } },
  { hour: '1pm',  actual: null, forecast: { condition: 'part-cloud', tempC: 16 } },
  { hour: '2pm',  actual: null, forecast: { condition: 'cloud', tempC: 16 } },
  { hour: '3pm',  actual: null, forecast: { condition: 'cloud', tempC: 15 } },
  { hour: '4pm',  actual: null, forecast: { condition: 'cloud', tempC: 14 } },
  { hour: '5pm',  actual: null, forecast: { condition: 'rain', tempC: 13 } },
  { hour: '6pm',  actual: null, forecast: { condition: 'rain', tempC: 12 } },
  { hour: '7pm',  actual: null, forecast: { condition: 'cloud', tempC: 11 } },
  { hour: '8pm',  actual: null, forecast: { condition: 'cloud', tempC: 10 } },
  { hour: '9pm',  actual: null, forecast: { condition: 'cloud', tempC: 10 } },
];

export interface HourlyTradingRow {
  hour: string;        // '6am'
  actual: number | null;   // £ sales, null if future hour
  forecast: number;    // £ forecast sales
  staff: number;       // headcount on the floor — actual if past, rostered if future
}

// Staffing is a GM-style roster: opener at 6am, peak 4-5 through the morning
// rush, trim through afternoon lull, 2 on to close. Past hours = actual staff
// that turned up; future hours = rostered plan.
export const HOURLY_TRADING: HourlyTradingRow[] = [
  { hour: '6am',  actual: 510,  forecast: 480,  staff: 2 },
  { hour: '7am',  actual: 1920, forecast: 1840, staff: 4 },
  { hour: '8am',  actual: 3120, forecast: 2840, staff: 5 },
  { hour: '9am',  actual: 2480, forecast: 2310, staff: 5 },
  { hour: '10am', actual: 1710, forecast: 1560, staff: 4 },
  { hour: '11am', actual: 2040, forecast: 1820, staff: 4 },
  { hour: '12pm', actual: null, forecast: 2210, staff: 4 },
  { hour: '1pm',  actual: null, forecast: 2100, staff: 4 },
  { hour: '2pm',  actual: null, forecast: 1480, staff: 4 },
  { hour: '3pm',  actual: null, forecast: 1290, staff: 3 },
  { hour: '4pm',  actual: null, forecast: 1070, staff: 3 },
  { hour: '5pm',  actual: null, forecast: 920,  staff: 3 },
  { hour: '6pm',  actual: null, forecast: 620,  staff: 2 },
  { hour: '7pm',  actual: null, forecast: 380,  staff: 2 },
  { hour: '8pm',  actual: null, forecast: 210,  staff: 2 },
  { hour: '9pm',  actual: null, forecast: 90,   staff: 2 },
];

export interface DeliveryDrop {
  id: string;
  supplier: string;
  eta: string;
  lines: number;
  spend: number;    // £
  status: 'done' | 'in-window' | 'upcoming';
}

export const DELIVERIES_TODAY: DeliveryDrop[] = [
  { id: 'd1', supplier: 'Fresh Direct', eta: '08:45', lines: 18, spend: 486, status: 'done' },
  { id: 'd2', supplier: 'Bidvest',      eta: '11:10', lines: 14, spend: 412, status: 'in-window' },
  { id: 'd3', supplier: 'Urban Fresh',  eta: '14:00', lines: 9,  spend: 228, status: 'upcoming' },
  { id: 'd4', supplier: 'Lacto Dairy',  eta: '16:30', lines: 6,  spend: 184, status: 'upcoming' },
];

export type WasteCategory = 'pastry' | 'lunch' | 'dairy' | 'fruit' | 'cake';

export interface WasteRow {
  product: string;
  category: WasteCategory;
  unitsToday: number;
  unitsTypical: number;    // rolling average waste for this time of day
  spendToday: number;      // £ wasted so far today
  spendTypical: number;    // £ typically wasted by this time of day
  flag?: string;           // short action hint, only on anomalies
}

// Scenario: 11am at Fitzroy Espresso. Muffins and baguettes are running over —
// a GM can still push them before lunch closes.
export const WASTE_TODAY: WasteRow[] = [
  { product: 'Blueberry muffin',     category: 'pastry', unitsToday: 6, unitsTypical: 2, spendToday: 15, spendTypical: 5,  flag: 'Push before lunch close' },
  { product: 'Ham & cheese baguette', category: 'lunch',  unitsToday: 3, unitsTypical: 1, spendToday: 18, spendTypical: 6,  flag: 'Over-prepped vs pace' },
  { product: 'Almond croissant',      category: 'pastry', unitsToday: 4, unitsTypical: 3, spendToday: 14, spendTypical: 10 },
  { product: 'Carrot cake slice',     category: 'cake',   unitsToday: 2, unitsTypical: 1, spendToday: 9,  spendTypical: 5 },
  { product: 'Fruit cup',             category: 'fruit',  unitsToday: 2, unitsTypical: 2, spendToday: 8,  spendTypical: 8 },
  { product: 'Whole milk (opened)',   category: 'dairy',  unitsToday: 1, unitsTypical: 1, spendToday: 2,  spendTypical: 2 },
];

export interface WtdSupplierSpend {
  supplier: string;
  spend: number;   // £ week-to-date
  budget: number;  // £ weekly budget
}

export const WTD_SPEND: WtdSupplierSpend[] = [
  { supplier: 'Fresh Direct', spend: 1840, budget: 2100 },
  { supplier: 'Bidvest',      spend: 1210, budget: 1200 },
  { supplier: 'Urban Fresh',  spend: 680,  budget: 900  },
  { supplier: 'Lacto Dairy',  spend: 520,  budget: 600  },
  { supplier: 'Other',        spend: 290,  budget: 400  },
];

// ── Phase-aware helpers ────────────────────────────────────────────────────────
// Actuals for hours the base fixture left null (12pm–9pm). These get revealed
// as the phase advances. Numbers chosen to feel like a plausible continuation
// of the morning (lunch bump, afternoon lull, tapering evening).
const FULL_DAY_ACTUALS: Record<string, number> = {
  '12pm': 2420,
  '1pm':  2280,
  '2pm':  1610,
  '3pm':  1380,
  '4pm':  1150,
  '5pm':   990,
  '6pm':   660,
  '7pm':   410,
  '8pm':   230,
  '9pm':   100,
};

const FULL_DAY_WEATHER_ACTUALS: Record<string, { condition: WeatherCondition; tempC: number }> = {
  '12pm': { condition: 'sun',        tempC: 22 },
  '1pm':  { condition: 'sun',        tempC: 22 },
  '2pm':  { condition: 'part-cloud', tempC: 21 },
  '3pm':  { condition: 'part-cloud', tempC: 19 },
  '4pm':  { condition: 'cloud',      tempC: 17 },
  '5pm':  { condition: 'cloud',      tempC: 15 },
  '6pm':  { condition: 'rain',       tempC: 13 },
  '7pm':  { condition: 'cloud',      tempC: 12 },
  '8pm':  { condition: 'cloud',      tempC: 11 },
  '9pm':  { condition: 'cloud',      tempC: 10 },
};

export function hourlyTradingForPhase(phase: BriefingPhase): HourlyTradingRow[] {
  const cutoff = currentHourIndexForPhase(phase);
  return HOURLY_TRADING.map((row, i) => {
    if (i <= cutoff) {
      const actual = row.actual ?? FULL_DAY_ACTUALS[row.hour] ?? row.forecast;
      return { ...row, actual };
    }
    return { ...row, actual: null };
  });
}

export function weatherHourlyForPhase(phase: BriefingPhase): WeatherRow[] {
  const cutoff = currentHourIndexForPhase(phase);
  return WEATHER_HOURLY.map((row, i) => {
    if (i <= cutoff) {
      const actual = row.actual ?? FULL_DAY_WEATHER_ACTUALS[row.hour] ?? row.forecast;
      return { ...row, actual };
    }
    return { ...row, actual: null };
  });
}

// Deliveries evolve through the day. Status transitions:
//   Fresh Direct (08:45): already done in morning
//   Bidvest (11:10):  upcoming → in-window → done after midday
//   Urban Fresh (14:00): upcoming → in-window → done after afternoon
//   Lacto Dairy (16:30): upcoming → in-window (afternoon) → done (evening)
export function deliveriesForPhase(phase: BriefingPhase): DeliveryDrop[] {
  const statusForDelivery = (id: string): DeliveryDrop['status'] => {
    if (id === 'd1') return 'done';
    if (id === 'd2') {
      if (phase === 'morning') return 'upcoming';
      if (phase === 'midday') return 'in-window';
      return 'done';
    }
    if (id === 'd3') {
      if (phase === 'morning' || phase === 'midday') return 'upcoming';
      if (phase === 'afternoon') return 'in-window';
      return 'done';
    }
    if (id === 'd4') {
      if (phase === 'evening') return 'done';
      if (phase === 'afternoon') return 'in-window';
      return 'upcoming';
    }
    return 'upcoming';
  };
  return DELIVERIES_TODAY.map((d) => ({ ...d, status: statusForDelivery(d.id) }));
}

// Waste accrues through the day. Morning has near-zero (pre-lunch), midday
// matches the current fixture, afternoon adds lunch/cake items, evening is
// the full day.
export function wasteForPhase(phase: BriefingPhase): WasteRow[] {
  const scaleFor: Record<BriefingPhase, number> = {
    morning: 0.15,
    midday: 1.0, // the current fixture represents midday
    afternoon: 1.6,
    evening: 2.2,
  };
  const typicalScaleFor: Record<BriefingPhase, number> = {
    morning: 0.2,
    midday: 1.0,
    afternoon: 1.7,
    evening: 2.4,
  };
  const scale = scaleFor[phase];
  const typicalScale = typicalScaleFor[phase];
  return WASTE_TODAY.map((row) => ({
    ...row,
    unitsToday: Math.max(0, Math.round(row.unitsToday * scale)),
    unitsTypical: Math.max(0, Math.round(row.unitsTypical * typicalScale)),
    spendToday: Math.round(row.spendToday * scale),
    spendTypical: Math.round(row.spendTypical * typicalScale),
    // Only keep action flags once there's meaningful waste to talk about.
    flag: phase === 'morning' ? undefined : row.flag,
  }));
}
