/**
 * Mock data for the in-shift Manager dashboard.
 * Scenario: Fitzroy Espresso, ~11am on a trading day. Weather is warmer than
 * forecast which creates a real "push cold drinks / reopen terrace" decision.
 *
 * CURRENT_HOUR marks the cutoff — hours at/before it are actual, after it are
 * null so the UI can ghost them. Change CURRENT_HOUR to simulate a different
 * point in the shift.
 */

export const CURRENT_HOUR_INDEX = 5; // 0=6am, 5=11am

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
