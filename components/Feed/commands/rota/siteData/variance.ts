/**
 * Yesterday's labour variance, one record per existing site, for the
 * morning sweep. Saturday 5 September, pulled from Workforce.com at
 * 06:00 on the Sunday after the overnight pay run, joined to Edify's
 * sales for the same day.
 *
 * Planned is what the published rota would have cost. Actual is what the
 * clock data and pay rules say it did cost. Every cause is a fact from
 * the clock data with the pounds it moved; the engine adds them up and
 * decides what matters. Overtime is paid at 1.25 past the weekly
 * contract, a Workforce.com pay rule, so an overtime hour costs
 * 15 x 1.25 = 18.75. A missed 30-minute unpaid break is 7.50 of pay
 * and a legal exposure whatever it costs.
 *
 * No new sites: every id already exists in ACTIVE_SITES (or, for
 * Chagee, in the branch's fixture bundle). People at King's Cross and
 * Chagee are the rota fixtures' people. The other Fitzroy sites have
 * no draft in this build, so their people appear here only.
 */

import type { SiteDayVariance } from '../types';

export const SWEEP_DATE_LABEL = 'Saturday 5 Sep';
export const SWEEP_PULLED_AT = '06:00';
const TOOL = 'Workforce.com';

const VARIANCE: Record<string, SiteDayVariance> = {
  'fitzroy-heathrow': {
    siteId: 'fitzroy-heathrow',
    tool: TOOL,
    plannedHours: 92,
    plannedCostGBP: 1380,
    actualHours: 103.3,
    actualCostGBP: 1566,
    salesGBP: 7070,
    forecastGBP: 6200,
    causes: [
      { kind: 'extra-shift', gbp: 90, minutes: 360, personName: 'Marcus Bell', detail: 'Casual, called in 12:00 to 18:00 for the delayed BA bank' },
      { kind: 'overtime', gbp: 37.5, minutes: 120, personName: 'Aisha Rahman', detail: 'Stayed 15:00 to 17:00 on the till bank, past her 35h week, paid at 1.25' },
      { kind: 'overtime', gbp: 28.13, minutes: 90, personName: 'Dev Sharma', detail: '1.5h past his 40h week, paid at 1.25' },
      { kind: 'late-clock-out', gbp: 20, minutes: 80, who: 'Both closers', detail: 'Out at 22:55 against 22:15' },
      { kind: 'early-clock-in', gbp: 7.5, minutes: 30, who: 'Three openers', detail: 'In at 04:35 for a 04:45 start' },
    ],
    context: 'Speed of service held at 96s through the 15:00 bank.',
  },
  'fitzroy-gatwick': {
    siteId: 'fitzroy-gatwick',
    tool: TOOL,
    plannedHours: 66,
    plannedCostGBP: 990,
    actualHours: 74.75,
    actualCostGBP: 1132.5,
    salesGBP: 4180,
    forecastGBP: 4350,
    causes: [
      { kind: 'overtime', gbp: 56.25, minutes: 180, personName: 'Sofia Ricci', detail: '3h past her 37.5h week, paid at 1.25' },
      { kind: 'extra-shift', gbp: 45, minutes: 180, personName: 'Ollie Grant', detail: '11:00 to 14:00, added on Friday night' },
      { kind: 'missed-break', gbp: 22.5, minutes: 90, who: 'Three shifts', detail: 'Three 8h shifts closed with no break recorded', repeat: 'third Saturday running', compliance: true },
      { kind: 'late-clock-out', gbp: 18.75, minutes: 75, who: 'Both closers', detail: 'Jonah Reid out at 21:55 and Carla Mendes at 21:50 against 21:15' },
    ],
    context: 'Sales 4% under forecast; the midday queue never formed.',
  },
  'fitzroy-islington': {
    siteId: 'fitzroy-islington',
    tool: TOOL,
    plannedHours: 44,
    plannedCostGBP: 660,
    actualHours: 37.5,
    actualCostGBP: 562.5,
    salesGBP: 2640,
    forecastGBP: 2900,
    causes: [
      { kind: 'unfilled-shift', gbp: -90, minutes: -360, personName: 'Nadia Osei', detail: 'Off sick at 09:40, 11:00 to 17:00 barista shift, no cover found' },
      { kind: 'early-finish', gbp: -7.5, minutes: -30, personName: 'Tom Whitlock', detail: 'Sent home 16:30 against 17:00' },
    ],
    context: 'Speed of service 141s at 12:30 against 79s the Saturday before.',
  },
  'fitzroy-kings-cross': {
    siteId: 'fitzroy-kings-cross',
    tool: TOOL,
    plannedHours: 24,
    plannedCostGBP: 360,
    actualHours: 26.1,
    actualCostGBP: 397.5,
    salesGBP: 1350,
    forecastGBP: 1340,
    causes: [
      { kind: 'overtime', gbp: 18.75, minutes: 60, personName: 'Giuseppe Colaci', detail: 'Closed with Helen, 1h past his 30h week, paid at 1.25' },
      { kind: 'late-clock-out', gbp: 8.75, minutes: 35, personName: 'Helen', detail: 'Out at 20:50 against 20:15, close-down ran long' },
      { kind: 'missed-break', gbp: 7.5, minutes: 30, personName: 'Freya', detail: '8h shift, no break recorded', compliance: true },
    ],
  },
  'fitzroy-espresso': {
    siteId: 'fitzroy-espresso',
    tool: TOOL,
    plannedHours: 58,
    plannedCostGBP: 870,
    actualHours: 58.75,
    actualCostGBP: 881.25,
    salesGBP: 0,
    forecastGBP: 0,
    causes: [
      { kind: 'late-clock-out', gbp: 10, minutes: 40, who: 'Bake team', detail: 'Two people out at 14:20 against 14:00' },
      { kind: 'early-clock-in', gbp: 1.25, minutes: 5, who: 'One clock-in', detail: 'Five minutes early' },
    ],
    context: 'Hub kitchen, no counter sales to set it against.',
  },
  'chagee-flagship': {
    siteId: 'chagee-flagship',
    tool: TOOL,
    plannedHours: 70,
    plannedCostGBP: 1050,
    actualHours: 75.8,
    actualCostGBP: 1146.5,
    salesGBP: 10250,
    forecastGBP: 9600,
    causes: [
      { kind: 'extra-shift', gbp: 45, minutes: 180, personName: 'Dan Okoro', detail: 'Casual, called in 13:00 to 16:00 for the queue' },
      { kind: 'overtime', gbp: 37.5, minutes: 120, personName: 'Hana Sato', detail: 'Stayed to 22:30 against 20:30, past her 32h week, paid at 1.25' },
      { kind: 'missed-break', gbp: 7.5, minutes: 30, personName: 'Zara Hussain', detail: '8h shift, no break recorded', compliance: true },
      { kind: 'late-clock-out', gbp: 5, minutes: 20, personName: 'Kai Wong', detail: 'Out at 22:20 against 22:00. He is 17: nothing past 22:00', repeat: 'second time in a fortnight', compliance: true },
    ],
    context: 'Queue peaked at 14 in line at 14:10; sales 7% over forecast.',
  },
};

export function varianceFor(siteId: string): SiteDayVariance | undefined {
  return VARIANCE[siteId];
}

export function sitesWithVariance(): string[] {
  return Object.keys(VARIANCE);
}
