'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import {
  DUNKIN_ANALYTICS_CONFIG,
  renderDunkinAnalyticsChart,
  type DunkinAnalyticsChartId,
} from '@/components/Analytics/DunkinAnalyticsCharts';

/** Original chart ids, backed by the cafe-estate mock data. */
type LegacyAnalyticsChartId =
  | 'sales'
  | 'hour'
  | 'trend'
  | 'growth'
  | 'labour'
  | 'cogs'
  | 'eatin'
  | 'daypart'
  | 'lfl'
  | 'waste-top10'
  | 'produced-sold'
  | 'labour-pct'
  | 'waste-heatmap'
  | 'oos-pareto'
  | 'labour-hours'
  | 'waste-kpi'
  | 'waste-trend-stacked'
  | 'prod-avail-scatter'
  | 'waste-category-treemap'
  | 'labour-day-radial';

/**
 * Union of every chart id the app knows about. Legacy ids continue to drive
 * the cafe-estate / Playtomic demos exactly as before; Dunkin-prefixed ids
 * are CSV-backed and only surface for the Dunkin persona's MVP-1 question
 * library and any charts pinned from chat in that persona.
 */
export type AnalyticsChartId = LegacyAnalyticsChartId | DunkinAnalyticsChartId;

export type { DunkinAnalyticsChartId } from '@/components/Analytics/DunkinAnalyticsCharts';

function isDunkinChartId(id: AnalyticsChartId): id is DunkinAnalyticsChartId {
  return typeof id === 'string' && id.startsWith('dunkin-');
}

const ACCENT = 'var(--color-accent-deep)';
const ACCENT_MID = 'var(--color-accent-mid)';
const WARN = '#B45309';
const OK = '#166534';

// ── Data ──────────────────────────────────────────────────────────────────────

const WEEKLY_SALES = [
  { site: 'Fitzroy', current: 52.4, prior: 49.3 },
  { site: 'City Ctr', current: 47.1, prior: 48.0 },
  { site: 'Riverside', current: 45.8, prior: 41.2 },
  { site: 'Canary', current: 41.3, prior: 40.1 },
  { site: 'Shoreditch', current: 43.6, prior: 42.9 },
  { site: 'Kings X', current: 44.2, prior: 43.0 },
  { site: 'S. Yarra', current: 37.6, prior: 35.5 },
];

const HOURLY_REVENUE = [
  { hour: '6am', avg: 480 },
  { hour: '7am', avg: 1840 },
  { hour: '8am', avg: 2840 },
  { hour: '9am', avg: 2310 },
  { hour: '10am', avg: 1560 },
  { hour: '11am', avg: 1820 },
  { hour: '12pm', avg: 2210 },
  { hour: '1pm', avg: 2100 },
  { hour: '2pm', avg: 1480 },
  { hour: '3pm', avg: 1290 },
  { hour: '4pm', avg: 1070 },
  { hour: '5pm', avg: 920 },
  { hour: '6pm', avg: 620 },
  { hour: '7pm', avg: 380 },
  { hour: '8pm', avg: 210 },
  { hour: '9pm', avg: 90 },
];

const WEEKLY_TREND = [
  { wk: 'Wk 1', rev: 268 },
  { wk: 'Wk 2', rev: 272 },
  { wk: 'Wk 3', rev: 275 },
  { wk: 'Wk 4', rev: 270 },
  { wk: 'Wk 5', rev: 278 },
  { wk: 'Wk 6', rev: 283 },
  { wk: 'Wk 7', rev: 289 },
  { wk: 'Wk 8', rev: 295 },
  { wk: 'Wk 9', rev: 303 },
  { wk: 'Wk 10', rev: 308 },
  { wk: 'Wk 11', rev: 305 },
  { wk: 'Wk 12', rev: 312 },
];

const SITE_MOM_GROWTH = [
  { site: 'Riverside', growth: 9.4 },
  { site: 'Shoreditch', growth: 6.1 },
  { site: 'Fitzroy', growth: 4.8 },
  { site: 'Kings X', growth: 3.2 },
  { site: 'Canary', growth: 2.1 },
  { site: 'S. Yarra', growth: 1.4 },
  { site: 'City Ctr', growth: -0.8 },
];

const REVPAR_LABOUR = [
  { site: 'Fitzroy', rplh: 48.2 },
  { site: 'Kings X', rplh: 44.6 },
  { site: 'Riverside', rplh: 42.1 },
  { site: 'Shoreditch', rplh: 39.4 },
  { site: 'S. Yarra', rplh: 37.8 },
  { site: 'City Ctr', rplh: 35.2 },
  { site: 'Canary', rplh: 31.8 },
];

const COGS_BUDGET_VAR = [
  { site: 'City Ctr', var: 2.1 },
  { site: 'Canary', var: 1.8 },
  { site: 'Shoreditch', var: 1.4 },
  { site: 'S. Yarra', var: 0.6 },
  { site: 'Riverside', var: -0.2 },
  { site: 'Fitzroy', var: -0.5 },
  { site: 'Kings X', var: -0.9 },
];

const CHANNEL_SPLIT = [
  { channel: 'Eat-in',    value: 142, colour: 'var(--color-accent-deep)' },
  { channel: 'Takeaway',  value: 128, colour: 'var(--color-accent-mid)' },
  { channel: 'Delivery',  value: 42,  colour: '#B45309' },
];

const DAYPART_BY_SITE = [
  { site: 'Fitzroy',    breakfast: 22.1, lunch: 18.4, afternoon: 11.9 },
  { site: 'City Ctr',   breakfast: 14.2, lunch: 22.6, afternoon: 10.3 },
  { site: 'Riverside',  breakfast: 18.0, lunch: 16.4, afternoon: 11.4 },
  { site: 'Shoreditch', breakfast: 15.2, lunch: 17.8, afternoon: 10.6 },
  { site: 'Kings X',    breakfast: 17.4, lunch: 16.1, afternoon: 10.7 },
  { site: 'Canary',     breakfast: 12.1, lunch: 18.9, afternoon: 10.3 },
  { site: 'S. Yarra',   breakfast: 14.8, lunch: 13.2, afternoon: 9.6 },
];

const LFL_WEEK = [
  { day: 'Mon', current: 44.2, prior: 41.8 },
  { day: 'Tue', current: 46.1, prior: 43.2 },
  { day: 'Wed', current: 47.8, prior: 45.0 },
  { day: 'Thu', current: 49.1, prior: 47.5 },
  { day: 'Fri', current: 52.3, prior: 50.1 },
  { day: 'Sat', current: 58.7, prior: 54.4 },
  { day: 'Sun', current: 48.5, prior: 47.8 },
];

const TOP_WASTED = [
  { item: 'Blueberry muffin',      waste: 142, units: 48 },
  { item: 'Ham & cheese baguette', waste: 118, units: 24 },
  { item: 'Almond croissant',      waste: 96,  units: 32 },
  { item: 'Oat flat white',        waste: 84,  units: 42 },
  { item: 'Chicken salad bowl',    waste: 78,  units: 16 },
  { item: 'Caramel slice',         waste: 64,  units: 26 },
  { item: 'Pain au chocolat',      waste: 56,  units: 24 },
  { item: 'Berry smoothie',        waste: 48,  units: 16 },
  { item: 'Chocolate cookie',      waste: 42,  units: 28 },
  { item: 'Vegan wrap',            waste: 38,  units: 12 },
];

const PRODUCED_SOLD = [
  { item: 'Blueberry muffin',      produced: 48, sold: 32 },
  { item: 'Ham & cheese baguette', produced: 36, sold: 24 },
  { item: 'Almond croissant',      produced: 32, sold: 22 },
  { item: 'Chicken salad bowl',    produced: 28, sold: 18 },
  { item: 'Caramel slice',         produced: 30, sold: 22 },
  { item: 'Oat porridge pot',      produced: 16, sold: 22 },
  { item: 'Green juice',           produced: 12, sold: 18 },
];

const LABOUR_PCT = [
  { site: 'Fitzroy',    actual: 24.1 },
  { site: 'Kings X',    actual: 25.8 },
  { site: 'Riverside',  actual: 26.8 },
  { site: 'Shoreditch', actual: 27.1 },
  { site: 'S. Yarra',   actual: 29.5 },
  { site: 'City Ctr',   actual: 30.2 },
  { site: 'Canary',     actual: 33.4 },
];
const LABOUR_TARGET = 28;

// Waste heatmap: £ wasted by day × hour (last 4 weeks aggregated)
const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEATMAP_HOURS = ['6am', '7am', '8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm'];
// Rows = days, cols = hours. Values in £.
const WASTE_HEATMAP: number[][] = [
  [3, 5, 8,  6,  4,  5, 12, 18, 14,  9, 22, 38], // Mon — big close-out spike
  [2, 4, 6,  5,  3,  4, 10, 14, 11,  8, 18, 30],
  [2, 4, 7,  5,  3,  5, 11, 15, 12,  8, 20, 32],
  [3, 5, 8,  6,  4,  5, 12, 17, 13,  9, 21, 34],
  [4, 7,10,  7,  5,  6, 14, 19, 16, 11, 26, 42], // Fri
  [5, 8,13,  9,  7,  8, 16, 22, 19, 14, 28, 46], // Sat
  [3, 5, 9,  6,  4,  5, 10, 15, 13,  9, 18, 28],
];

// Pareto: items OOS before end of trading (count of OOS events)
const OOS_PARETO = [
  { item: 'Almond croissant',  events: 38 },
  { item: 'Blueberry muffin',  events: 32 },
  { item: 'Oat flat white',    events: 24 },
  { item: 'Ham & cheese baguette', events: 18 },
  { item: 'Green juice',       events: 14 },
  { item: 'Chicken salad bowl', events: 10 },
  { item: 'Pain au chocolat',  events: 8 },
  { item: 'Caramel slice',     events: 6 },
  { item: 'Berry smoothie',    events: 5 },
  { item: 'Vegan wrap',        events: 3 },
];

// Actual vs scheduled labour hours per site (this week)
const LABOUR_HOURS = [
  { site: 'Fitzroy',    scheduled: 412, actual: 398 },
  { site: 'City Ctr',   scheduled: 380, actual: 428 },
  { site: 'Riverside',  scheduled: 344, actual: 352 },
  { site: 'Shoreditch', scheduled: 320, actual: 336 },
  { site: 'Kings X',    scheduled: 296, actual: 288 },
  { site: 'Canary',     scheduled: 282, actual: 318 },
  { site: 'S. Yarra',   scheduled: 258, actual: 266 },
];

// Waste KPI: total this week + 8-week sparkline
const WASTE_KPI = {
  totalThisWeek: 1842,
  deltaPct: -8.4,
  priorWeek: 2011,
  sparkline: [2140, 2260, 2190, 2090, 2130, 2080, 2011, 1842],
};

// Waste trend stacked by reason — last 12 weeks (£)
const WASTE_TREND_STACKED = [
  { wk: 'Wk 1',  expired: 820, overproduction: 1040, spoilage: 360 },
  { wk: 'Wk 2',  expired: 790, overproduction: 1100, spoilage: 340 },
  { wk: 'Wk 3',  expired: 810, overproduction: 1020, spoilage: 380 },
  { wk: 'Wk 4',  expired: 860, overproduction:  960, spoilage: 340 },
  { wk: 'Wk 5',  expired: 840, overproduction:  940, spoilage: 320 },
  { wk: 'Wk 6',  expired: 780, overproduction:  900, spoilage: 300 },
  { wk: 'Wk 7',  expired: 720, overproduction:  840, spoilage: 280 },
  { wk: 'Wk 8',  expired: 680, overproduction:  780, spoilage: 260 },
  { wk: 'Wk 9',  expired: 640, overproduction:  720, spoilage: 240 },
  { wk: 'Wk 10', expired: 600, overproduction:  660, spoilage: 220 },
  { wk: 'Wk 11', expired: 560, overproduction:  620, spoilage: 200 },
  { wk: 'Wk 12', expired: 540, overproduction:  580, spoilage: 200 },
];

// Prod adherence (% hitting plan) × availability failures (count) per site
const PROD_AVAIL_SCATTER = [
  { site: 'Fitzroy',    adherence: 94, failures: 3,  sales: 52 },
  { site: 'Kings X',    adherence: 91, failures: 5,  sales: 44 },
  { site: 'Riverside',  adherence: 88, failures: 7,  sales: 46 },
  { site: 'Shoreditch', adherence: 85, failures: 9,  sales: 44 },
  { site: 'S. Yarra',   adherence: 82, failures: 12, sales: 38 },
  { site: 'City Ctr',   adherence: 76, failures: 18, sales: 47 },
  { site: 'Canary',     adherence: 71, failures: 22, sales: 41 },
];

// Waste by category treemap (nested)
const WASTE_TREEMAP = {
  name: 'Estate waste',
  children: [
    {
      name: 'Food',
      children: [
        { name: 'Pastries',  size: 480 },
        { name: 'Sandwiches', size: 340 },
        { name: 'Salads',    size: 220 },
        { name: 'Hot food',  size: 140 },
      ],
    },
    {
      name: 'Drink',
      children: [
        { name: 'Milk',        size: 280 },
        { name: 'Cold drinks', size: 180 },
        { name: 'Coffee',      size: 120 },
      ],
    },
    {
      name: 'Packaging',
      children: [
        { name: 'Cups',       size: 90 },
        { name: 'Containers', size: 40 },
      ],
    },
  ],
};

// Labour cost as % of revenue by day of week (radial)
const LABOUR_BY_DAY = [
  { day: 'Mon', pct: 27.8 },
  { day: 'Tue', pct: 26.4 },
  { day: 'Wed', pct: 25.9 },
  { day: 'Thu', pct: 26.8 },
  { day: 'Fri', pct: 28.1 },
  { day: 'Sat', pct: 24.6 },
  { day: 'Sun', pct: 31.2 }, // worst day
];

// ── Chart components ──────────────────────────────────────────────────────────

const TICK_STYLE = {
  fontSize: 11,
  fontFamily: 'var(--font-primary)',
  fill: 'var(--color-text-muted)',
};

const TOOLTIP_STYLE = {
  fontSize: 12,
  fontFamily: 'var(--font-primary)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(58,48,40,0.12)',
};

export function SalesChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={WEEKLY_SALES} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
        <XAxis dataKey="site" tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v: number) => `£${v}k`} tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v, name) => [`£${Number(v)}k`, name === 'current' ? 'Last week' : 'Prior week']}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="prior" name="Prior week" fill="var(--color-border-subtle)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="current" name="Last week" fill={ACCENT} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HourChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={HOURLY_REVENUE} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barCategoryGap="15%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
        <XAxis dataKey="hour" tick={{ ...TICK_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
        <YAxis
          tickFormatter={(v: number) => `£${(v / 1000).toFixed(1)}k`}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => [`£${Number(v).toLocaleString()}`, 'Avg revenue']}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="avg" name="Avg revenue" radius={[3, 3, 0, 0]}>
          {HOURLY_REVENUE.map((entry, i) => (
            <Cell key={i} fill={entry.avg === 2840 ? 'var(--color-accent-active)' : ACCENT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={WEEKLY_TREND} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="analyticsAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={ACCENT} stopOpacity={0.18} />
            <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
        <XAxis dataKey="wk" tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v: number) => `£${v}k`}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          domain={[250, 320]}
        />
        <Tooltip
          formatter={(v) => [`£${Number(v)}k`, 'Revenue']}
          contentStyle={TOOLTIP_STYLE}
        />
        <Area type="monotone" dataKey="rev" stroke={ACCENT} strokeWidth={2} fill="url(#analyticsAreaGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function GrowthChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={SITE_MOM_GROWTH} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
        <XAxis
          type="number"
          tickFormatter={(v: number) => `${v}%`}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="site"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          formatter={(v) => [`${Number(v)}%`, 'MoM growth']}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="growth" radius={[0, 3, 3, 0]}>
          {SITE_MOM_GROWTH.map((entry, i) => (
            <Cell key={i} fill={entry.growth >= 0 ? ACCENT : WARN} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LabourChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={REVPAR_LABOUR} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
        <XAxis dataKey="site" tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v: number) => `£${v}`}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          domain={[0, 56]}
        />
        <Tooltip
          formatter={(v) => [`£${Number(v).toFixed(2)}`, 'Rev / labour hr']}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="rplh" radius={[3, 3, 0, 0]}>
          {REVPAR_LABOUR.map((entry, i) => (
            <Cell key={i} fill={entry.rplh >= 42 ? ACCENT : entry.rplh >= 36 ? ACCENT_MID : WARN} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CogsChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={COGS_BUDGET_VAR} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
        <XAxis
          type="number"
          tickFormatter={(v: number) => `${v}%`}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="site"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          formatter={(v) => { const n = Number(v); return [`${n > 0 ? '+' : ''}${n}%`, 'vs COGS budget']; }}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="var" radius={[0, 3, 3, 0]}>
          {COGS_BUDGET_VAR.map((entry, i) => (
            <Cell key={i} fill={entry.var > 0 ? WARN : OK} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── New chart components ──────────────────────────────────────────────────────

export function EatinChart() {
  const total = CHANNEL_SPLIT.reduce((s, r) => s + r.value, 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={CHANNEL_SPLIT}
          dataKey="value"
          nameKey="channel"
          cx="50%"
          cy="45%"
          innerRadius={52}
          outerRadius={82}
          paddingAngle={2}
          stroke="#fff"
          strokeWidth={2}
          isAnimationActive={false}
          labelLine={false}
        >
          {CHANNEL_SPLIT.map((c) => (
            <Cell key={c.channel} fill={c.colour} />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          align="center"
          iconType="circle"
          formatter={(value) => {
            const row = CHANNEL_SPLIT.find((c) => c.channel === value);
            if (!row) return value;
            const pct = Math.round((row.value / total) * 100);
            return `${value} · £${row.value}k (${pct}%)`;
          }}
          wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }}
        />
        <Tooltip
          formatter={(v, name) => [`£${Number(v)}k`, String(name)]}
          contentStyle={TOOLTIP_STYLE}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DaypartChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={DAYPART_BY_SITE} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
        <XAxis
          type="number"
          tickFormatter={(v: number) => `£${v}k`}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="site"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          formatter={(v, name) => [`£${Number(v).toFixed(1)}k`, String(name)]}
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }} />
        <Bar dataKey="breakfast" name="Breakfast"  stackId="day" fill={ACCENT}      radius={[3, 0, 0, 3]} />
        <Bar dataKey="lunch"     name="Lunch"      stackId="day" fill={ACCENT_MID} />
        <Bar dataKey="afternoon" name="Afternoon"  stackId="day" fill="#B45309"     radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LflChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={LFL_WEEK} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
        <XAxis dataKey="day" tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v: number) => `£${v}k`}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          domain={[40, 62]}
        />
        <Tooltip
          formatter={(v, name) => [`£${Number(v)}k`, name === 'current' ? 'This week' : 'Same week last year']}
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend
          iconType="plainline"
          wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }}
          formatter={(value) => (value === 'current' ? 'This week' : 'Same week last year')}
        />
        <Line type="monotone" dataKey="prior"   stroke="var(--color-border-subtle)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
        <Line type="monotone" dataKey="current" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WasteTop10Chart() {
  const max = Math.max(...TOP_WASTED.map((r) => r.waste));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={TOP_WASTED} layout="vertical" margin={{ top: 4, right: 48, bottom: 0, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
        <XAxis
          type="number"
          tickFormatter={(v: number) => `£${v}`}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          domain={[0, max * 1.1]}
        />
        <YAxis
          type="category"
          dataKey="item"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          width={150}
        />
        <Tooltip
          formatter={(v, _name, entry) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload = (entry as any)?.payload;
            const units = payload?.units ?? 0;
            return [`£${Number(v)} · ${units} units`, 'Waste'];
          }}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="waste" radius={[0, 3, 3, 0]}>
          {TOP_WASTED.map((_, i) => (
            <Cell key={i} fill={i < 3 ? WARN : i < 6 ? ACCENT_MID : ACCENT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProducedSoldChart() {
  const data = PRODUCED_SOLD;
  const rowHeight = 28;
  const paddingTop = 12;
  const paddingBottom = 24;
  const paddingLeft = 160;
  const paddingRight = 24;
  const height = paddingTop + paddingBottom + data.length * rowHeight;
  const maxVal = Math.max(...data.flatMap((d) => [d.produced, d.sold])) * 1.1;

  // Build the chart with inline SVG
  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 520 ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        style={{ fontFamily: 'var(--font-primary)' }}
      >
        {/* Axis baseline at bottom */}
        <line
          x1={paddingLeft}
          x2={520 - paddingRight}
          y1={height - paddingBottom + 4}
          y2={height - paddingBottom + 4}
          stroke="var(--color-border-subtle)"
        />
        {/* X ticks */}
        {[0, 12, 24, 36, 48].map((t) => {
          const x = paddingLeft + (t / maxVal) * (520 - paddingLeft - paddingRight);
          return (
            <g key={t}>
              <line x1={x} x2={x} y1={paddingTop} y2={height - paddingBottom + 4} stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
              <text x={x} y={height - paddingBottom + 16} fontSize={11} fill="var(--color-text-muted)" textAnchor="middle">{t}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const y = paddingTop + i * rowHeight + rowHeight / 2;
          const xProduced = paddingLeft + (d.produced / maxVal) * (520 - paddingLeft - paddingRight);
          const xSold = paddingLeft + (d.sold / maxVal) * (520 - paddingLeft - paddingRight);
          const overproduced = d.produced > d.sold;
          const gapColour = overproduced ? WARN : OK;
          return (
            <g key={d.item}>
              <text x={paddingLeft - 8} y={y + 4} fontSize={11} fill="var(--color-text-primary)" textAnchor="end" fontWeight={500}>
                {d.item}
              </text>
              {/* Connector line */}
              <line x1={Math.min(xProduced, xSold)} x2={Math.max(xProduced, xSold)} y1={y} y2={y} stroke={gapColour} strokeWidth={2} opacity={0.45} />
              {/* Produced dot (hollow) */}
              <circle cx={xProduced} cy={y} r={6} fill="#fff" stroke={gapColour} strokeWidth={2.4} />
              {/* Sold dot (solid) */}
              <circle cx={xSold} cy={y} r={5.5} fill={gapColour} />
            </g>
          );
        })}
        {/* Legend */}
        <g transform={`translate(${paddingLeft}, ${height - 6})`}>
          <circle cx={0} cy={0} r={5} fill="#fff" stroke="var(--color-text-secondary)" strokeWidth={2} />
          <text x={10} y={3} fontSize={11} fill="var(--color-text-secondary)">Produced</text>
          <circle cx={90} cy={0} r={5} fill="var(--color-text-secondary)" />
          <text x={100} y={3} fontSize={11} fill="var(--color-text-secondary)">Sold</text>
        </g>
      </svg>
    </div>
  );
}

export function LabourBulletChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={LABOUR_PCT} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 16 }} barCategoryGap={10}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
        <XAxis
          type="number"
          domain={[0, 40]}
          tickFormatter={(v: number) => `${v}%`}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="site"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Labour % of sales']}
          contentStyle={TOOLTIP_STYLE}
        />
        <ReferenceLine
          x={LABOUR_TARGET}
          stroke="var(--color-text-primary)"
          strokeDasharray="4 3"
          label={{ value: `Target ${LABOUR_TARGET}%`, position: 'top', fontSize: 11, fill: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)' }}
        />
        <Bar dataKey="actual" radius={[0, 3, 3, 0]} barSize={12}>
          {LABOUR_PCT.map((r, i) => {
            const over = r.actual - LABOUR_TARGET;
            const fill = over > 2 ? WARN : over > 0 ? ACCENT_MID : OK;
            return <Cell key={i} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Heatmap, Pareto, grouped bar, KPI tile, stacked area, scatter, treemap, radial ───

export function WasteHeatmapChart() {
  const flat = WASTE_HEATMAP.flat();
  const max = Math.max(...flat);
  const cellW = 44;
  const cellH = 26;
  const labelW = 44;
  const labelH = 20;
  const width = labelW + HEATMAP_HOURS.length * cellW + 12;
  const height = labelH + HEATMAP_DAYS.length * cellH + 12;
  function tint(v: number) {
    const t = v / max;
    // Blend white → accent-deep navy; keep at least 8% alpha so zero-ish cells aren't invisible.
    const alpha = 0.08 + 0.82 * t;
    return `rgba(3, 28, 89, ${alpha.toFixed(3)})`;
  }
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width, fontFamily: 'var(--font-primary)' }}>
        {HEATMAP_HOURS.map((h, i) => (
          <text key={h} x={labelW + i * cellW + cellW / 2} y={labelH - 6} fontSize={10} fill="var(--color-text-muted)" textAnchor="middle">
            {h}
          </text>
        ))}
        {HEATMAP_DAYS.map((d, row) => (
          <text key={d} x={labelW - 8} y={labelH + row * cellH + cellH / 2 + 4} fontSize={11} fill="var(--color-text-secondary)" textAnchor="end" fontWeight={600}>
            {d}
          </text>
        ))}
        {WASTE_HEATMAP.map((row, r) =>
          row.map((v, c) => {
            const x = labelW + c * cellW + 2;
            const y = labelH + r * cellH + 2;
            return (
              <g key={`${r}-${c}`}>
                <rect x={x} y={y} width={cellW - 4} height={cellH - 4} rx={3} fill={tint(v)} />
                <text x={x + (cellW - 4) / 2} y={y + (cellH - 4) / 2 + 4} fontSize={10} textAnchor="middle" fill={v / max > 0.55 ? '#fff' : 'var(--color-text-secondary)'} fontWeight={500}>
                  £{v}
                </text>
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}

export function OosParetoChart() {
  const total = OOS_PARETO.reduce((s, r) => s + r.events, 0);
  let running = 0;
  const data = OOS_PARETO.map((r) => {
    running += r.events;
    return { ...r, cum: Math.round((running / total) * 100) };
  });
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 40, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
        <XAxis
          dataKey="item"
          tick={{ ...TICK_STYLE, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          angle={-30}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis
          yAxisId="left"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          formatter={(v, name) => name === 'events' ? [`${Number(v)} events`, 'OOS events'] : [`${Number(v)}%`, 'Cumulative']}
          contentStyle={TOOLTIP_STYLE}
        />
        <ReferenceLine yAxisId="right" y={80} stroke={WARN} strokeDasharray="4 3" label={{ value: '80%', position: 'right', fontSize: 10, fill: WARN }} />
        <Bar yAxisId="left" dataKey="events" fill={ACCENT} radius={[3, 3, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="cum" stroke={WARN} strokeWidth={2.4} dot={{ r: 3, fill: WARN, strokeWidth: 0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function LabourHoursChart() {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={LABOUR_HOURS} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barCategoryGap="18%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
        <XAxis dataKey="site" tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v: number) => `${v}h`} tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v, name) => [`${Number(v)}h`, name === 'scheduled' ? 'Scheduled' : 'Actual']}
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }} />
        <Bar dataKey="scheduled" name="Scheduled" fill="var(--color-border-subtle)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="actual" name="Actual" radius={[3, 3, 0, 0]}>
          {LABOUR_HOURS.map((r, i) => {
            const over = r.actual - r.scheduled;
            const fill = over > 10 ? WARN : over > 0 ? ACCENT_MID : OK;
            return <Cell key={i} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WasteKpiChart() {
  const { totalThisWeek, deltaPct, sparkline } = WASTE_KPI;
  const sparkMax = Math.max(...sparkline);
  const sparkMin = Math.min(...sparkline);
  const sparkRange = sparkMax - sparkMin || 1;
  const sparkW = 260;
  const sparkH = 60;
  const points = sparkline.map((v, i) => {
    const x = (i / (sparkline.length - 1)) * sparkW;
    const y = sparkH - ((v - sparkMin) / sparkRange) * sparkH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const improved = deltaPct < 0;
  const deltaColour = improved ? OK : WARN;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1, fontFamily: 'var(--font-primary)' }}>
          £{totalThisWeek.toLocaleString()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: deltaColour }}>
            {improved ? '▼' : '▲'} {Math.abs(deltaPct)}% vs prior week
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            Estate total · rolling 7 days
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${sparkW} ${sparkH}`} width="100%" height={sparkH} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="wasteSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={improved ? OK : WARN} stopOpacity={0.22} />
            <stop offset="100%" stopColor={improved ? OK : WARN} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={`0,${sparkH} ${points} ${sparkW},${sparkH}`} fill="url(#wasteSparkGrad)" />
        <polyline points={points} fill="none" stroke={improved ? OK : WARN} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {sparkline.map((v, i) => {
          const x = (i / (sparkline.length - 1)) * sparkW;
          const y = sparkH - ((v - sparkMin) / sparkRange) * sparkH;
          if (i !== sparkline.length - 1) return null;
          return <circle key={i} cx={x} cy={y} r={4} fill={improved ? OK : WARN} stroke="#fff" strokeWidth={2} />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginTop: -8 }}>
        <span>8 weeks ago</span>
        <span>This week</span>
      </div>
    </div>
  );
}

export function WasteTrendStackedChart() {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={WASTE_TREND_STACKED} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
        <XAxis dataKey="wk" tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v: number) => `£${v / 1000}k`} tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v, name) => [`£${Number(v)}`, String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }} />
        <Area type="monotone" dataKey="expired"        stackId="1" stroke={ACCENT}     fill={ACCENT}     fillOpacity={0.85} name="Expired" />
        <Area type="monotone" dataKey="overproduction" stackId="1" stroke={ACCENT_MID} fill={ACCENT_MID} fillOpacity={0.85} name="Overproduction" />
        <Area type="monotone" dataKey="spoilage"       stackId="1" stroke={WARN}       fill={WARN}       fillOpacity={0.75} name="Spoilage" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ProdAvailScatterChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
        <XAxis
          type="number"
          dataKey="adherence"
          name="Adherence"
          unit="%"
          domain={[60, 100]}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          label={{ value: 'Production plan adherence', position: 'bottom', offset: 6, fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-primary)' }}
        />
        <YAxis
          type="number"
          dataKey="failures"
          name="OOS events"
          domain={[0, 25]}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          label={{ value: 'Availability failures (30d)', angle: -90, position: 'insideLeft', offset: 14, fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-primary)' }}
        />
        <ZAxis type="number" dataKey="sales" range={[80, 320]} name="Weekly sales" />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(v, name) => {
            if (name === 'Adherence') return [`${v}%`, 'Adherence'];
            if (name === 'OOS events') return [`${v} events`, 'OOS events'];
            if (name === 'Weekly sales') return [`£${v}k`, 'Weekly sales'];
            return [String(v), String(name)];
          }}
          labelFormatter={(_, items) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const first = (items?.[0]?.payload as any);
            return first?.site ?? '';
          }}
        />
        <Scatter data={PROD_AVAIL_SCATTER} fill={ACCENT}>
          {PROD_AVAIL_SCATTER.map((d, i) => {
            const bad = d.failures >= 15 || d.adherence <= 75;
            return <Cell key={i} fill={bad ? WARN : d.failures >= 8 ? ACCENT_MID : OK} />;
          })}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

const LEAF_CATEGORY: Record<string, 'Food' | 'Drink' | 'Packaging'> = {
  Pastries: 'Food', Sandwiches: 'Food', Salads: 'Food', 'Hot food': 'Food',
  Milk: 'Drink', 'Cold drinks': 'Drink', Coffee: 'Drink',
  Cups: 'Packaging', Containers: 'Packaging',
};
const CATEGORY_FILL: Record<string, string> = {
  Food: 'rgba(3, 28, 89, 0.92)',
  Drink: 'rgba(3, 28, 89, 0.68)',
  Packaging: 'rgba(180, 83, 9, 0.82)',
};
const TREEMAP_TOTAL = WASTE_TREEMAP.children.reduce(
  (s, c) => s + c.children.reduce((ss, cc) => ss + cc.size, 0),
  0,
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapContent(props: any) {
  const { x, y, width, height, name, size, depth } = props;
  if (width < 2 || height < 2) return null;
  const isLeaf = depth === 2;
  const category = isLeaf ? LEAF_CATEGORY[name] : undefined;
  const fill = isLeaf ? (category ? CATEGORY_FILL[category] : ACCENT) : 'transparent';
  const pct = isLeaf && size ? Math.round((size / TREEMAP_TOTAL) * 100) : 0;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} />
      {isLeaf && width > 60 && height > 26 && (
        <>
          <text x={x + 8} y={y + 18} fontSize={11} fontWeight={600} fill="#fff" fontFamily="var(--font-primary)">
            {name}
          </text>
          <text x={x + 8} y={y + 34} fontSize={10} fill="rgba(255,255,255,0.85)" fontFamily="var(--font-primary)">
            £{size} · {pct}%
          </text>
        </>
      )}
    </g>
  );
}

export function WasteCategoryTreemapChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <Treemap
        data={[WASTE_TREEMAP]}
        dataKey="size"
        stroke="#fff"
        fill={ACCENT}
        content={<TreemapContent />}
      />
    </ResponsiveContainer>
  );
}

export function LabourDayRadialChart() {
  const data = [...LABOUR_BY_DAY].map((r) => ({ ...r, pctBar: r.pct }));
  // Domain for radial: 0 → 40 so bars are comparable
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadialBarChart
        data={data}
        innerRadius="30%"
        outerRadius="95%"
        startAngle={90}
        endAngle={-270}
        barSize={16}
      >
        <PolarAngleAxis type="number" domain={[0, 40]} tick={false} />
        <Tooltip
          formatter={(v, _name, entry) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload = (entry as any)?.payload;
            return [`${Number(v).toFixed(1)}%`, payload?.day ?? 'Labour %'];
          }}
          contentStyle={TOOLTIP_STYLE}
        />
        <RadialBar dataKey="pctBar" cornerRadius={8} background={{ fill: 'var(--color-bg-hover)' }}>
          {data.map((d, i) => {
            const fill = d.pct >= 30 ? WARN : d.pct >= 28 ? ACCENT_MID : ACCENT;
            return <Cell key={i} fill={fill} />;
          })}
        </RadialBar>
        <Legend
          iconType="circle"
          layout="vertical"
          align="right"
          verticalAlign="middle"
          formatter={(_, __, idx) => {
            const row = data[idx ?? 0];
            if (!row) return '';
            return `${row.day} · ${row.pct.toFixed(1)}%`;
          }}
          wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-primary)' }}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

// ── Render helper ─────────────────────────────────────────────────────────────

export function renderAnalyticsChart(chartId: AnalyticsChartId) {
  if (isDunkinChartId(chartId)) {
    return renderDunkinAnalyticsChart(chartId);
  }
  switch (chartId) {
    case 'sales':                  return <SalesChart />;
    case 'hour':                   return <HourChart />;
    case 'trend':                  return <TrendChart />;
    case 'growth':                 return <GrowthChart />;
    case 'labour':                 return <LabourChart />;
    case 'cogs':                   return <CogsChart />;
    case 'eatin':                  return <EatinChart />;
    case 'daypart':                return <DaypartChart />;
    case 'lfl':                    return <LflChart />;
    case 'waste-top10':            return <WasteTop10Chart />;
    case 'produced-sold':          return <ProducedSoldChart />;
    case 'labour-pct':             return <LabourBulletChart />;
    case 'waste-heatmap':          return <WasteHeatmapChart />;
    case 'oos-pareto':             return <OosParetoChart />;
    case 'labour-hours':           return <LabourHoursChart />;
    case 'waste-kpi':              return <WasteKpiChart />;
    case 'waste-trend-stacked':    return <WasteTrendStackedChart />;
    case 'prod-avail-scatter':     return <ProdAvailScatterChart />;
    case 'waste-category-treemap': return <WasteCategoryTreemapChart />;
    case 'labour-day-radial':      return <LabourDayRadialChart />;
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

export const ANALYTICS_CONFIG: Record<AnalyticsChartId, {
  label: string;
  chartLabel: string;
  reasoning: string;
}> = {
  sales: {
    label: 'Total sales by site — last week',
    chartLabel: 'Here\'s total sales by site for last week, compared against the prior week:',
    reasoning: 'Fitzroy led the estate at **£52.4k**, up 6.2% week-on-week. Riverside showed the biggest jump (+11.2%), driven by extended trading hours. City Centre was the only site to soften slightly (-0.9%). The estate total came in at **£312k**, 3.8% ahead of the prior week — driven primarily by a strong Saturday across all sites.',
  },
  hour: {
    label: 'Revenue by hour — weekday average',
    chartLabel: 'Here\'s average revenue by hour of day across weekdays, estate-wide:',
    reasoning: 'The **8–9am slot** is your highest-revenue hour, averaging **£2,840/day** across the estate — about 18% of total weekday revenue. A secondary peak at **12–1pm** contributes £2,210/day. Revenue drops sharply after 3pm. Consider scheduling staffing and production tightly around these two peaks rather than spreading evenly across the day.',
  },
  trend: {
    label: 'Revenue trend — last 12 weeks',
    chartLabel: 'Here\'s estate revenue over the last 12 weeks:',
    reasoning: 'Revenue has grown **14.2%** over the 12-week window, from £268k in week 1 to **£312k** in the most recent week. The trend shows steady upward momentum, with a notable acceleration in weeks 8–10 — likely driven by the seasonal upturn and the Riverside site reopening. Week 4 was the only dip; worth understanding what was different that period.',
  },
  growth: {
    label: 'Month-on-month growth by site',
    chartLabel: 'Here\'s month-on-month revenue growth by site:',
    reasoning: '**Riverside** has shown the strongest growth at **+9.4%**, driven by the renovated espresso bar and extended trading hours. Shoreditch follows at +6.1%. **City Centre is the only site in slight decline (-0.8%)** — worth investigating footfall and competitor activity in that area before the next trading period.',
  },
  labour: {
    label: 'Revenue per labour hour by site',
    chartLabel: 'Here\'s revenue per labour hour across each site:',
    reasoning: '**Fitzroy leads at £48.20/labour hour**, reflecting high average transaction value and efficient shift scheduling. Kings Cross follows closely at £44.60. **Canary Wharf is lowest at £31.80** — this site has a longer operating window with a late evening period that dilutes the metric. Consider reviewing rostering there.',
  },
  cogs: {
    label: 'COGS variance vs budget by site',
    chartLabel: 'Here\'s COGS variance against budget, averaged over the last 8 weeks per site:',
    reasoning: 'Three sites are **consistently over COGS budget**: City Centre (+2.1%), Canary Wharf (+1.8%), and Shoreditch (+1.4%). Fitzroy and Kings Cross remain within target. The main driver across over-budget sites is dairy and produce variance — suggesting supplier pricing drift or yield issues worth investigating with your ops team.',
  },
  eatin: {
    label: 'Sales split · eat-in v takeaway v delivery',
    chartLabel: 'Here\'s the channel split on this week\'s estate revenue:',
    reasoning: '**Eat-in leads at £142k (45%)**, takeaway close behind at £128k (41%), and delivery contributes £42k (14%). Delivery margin nets out lower after aggregator fees — on an after-fee basis, eat-in and takeaway together deliver ~94% of cash margin. Keep an eye on the delivery share trending up on rainy days.',
  },
  daypart: {
    label: 'Revenue by daypart · per site',
    chartLabel: 'Here\'s revenue per site split by breakfast, lunch, and afternoon:',
    reasoning: '**Fitzroy is breakfast-heavy (43% of daily revenue)** — the commuter crowd. **City Centre is the opposite**: lunch makes up 48% of the day. Canary Wharf and Kings Cross are the most balanced. Use this split when you\'re sizing production runs and rostering — a breakfast-heavy site is more sensitive to 7am open-ready than an afternoon-heavy site.',
  },
  lfl: {
    label: 'This week v same week last year',
    chartLabel: 'Here\'s this week\'s daily revenue compared to the same week last year (like-for-like):',
    reasoning: 'This week is **pacing +5.4% LFL**, with the biggest gains on **Saturday (+7.9%)** and Friday (+4.4%). Sunday is nearly flat (+1.5%) — worth checking whether Sunday weather or a local event dragged on it. The shape of the week mirrors last year closely, suggesting the uplift is trading quality rather than promotional.',
  },
  'waste-top10': {
    label: 'Top 10 most wasted items · network',
    chartLabel: 'Here are the 10 items driving the most waste £ across the network (last 30 days):',
    reasoning: '**Blueberry muffin tops the list at £142** — 48 units wasted, largely from over-production on Mondays. The top three items alone account for 38% of network waste £. Oat flat white is the highest-volume drink waste (42 units) despite sitting at #4 by £. Focus production planning on the top 5 — tightening sell-through by 10% there would save ~£50/day across the estate.',
  },
  'produced-sold': {
    label: 'Produced v sold · yesterday',
    chartLabel: 'Here\'s produced (hollow) versus sold (filled) per item yesterday, ordered by gap size:',
    reasoning: 'Biggest overproduction was **blueberry muffin (made 48, sold 32)** — a 16-unit gap worth ~£48 in waste risk. The bottom two rows are the opposite story: **oat porridge pot and green juice both sold more than were made** (16 vs 22, 12 vs 18), which means lost sales. Bring morning prep down for muffins, nudge up for oat porridge and juice.',
  },
  'labour-pct': {
    label: 'Labour % of sales · vs target',
    chartLabel: 'Here\'s labour as a % of sales by site this month, compared to the 28% target:',
    reasoning: 'Four sites are at or under the **28% target** — Fitzroy is the leanest at 24.1%. **Canary Wharf is the biggest miss at 33.4%** (5.4 points over), followed by City Centre at 30.2%. The main drivers: Canary\'s late-evening roster and City Centre\'s weekend over-staffing. Two tactical shifts (clip the late hour at Canary, cut one weekend shift at City Centre) should close most of the gap.',
  },
  'waste-heatmap': {
    label: 'Waste heatmap · day × hour',
    chartLabel: 'Here\'s where waste is happening, day-of-week by hour (last 4 weeks, £):',
    reasoning: 'The hot spot is unmistakable: **Saturday 5pm (£46) and Friday 5pm (£42)** are the two worst cells, with Monday 5pm close behind. The **last hour of trading drives ~28% of total weekly waste** across the estate. Tightening production cut-offs 90 minutes before close on Fri/Sat/Mon would save ~£110/week. Morning cells (6–10am) are cool — no real waste signal there.',
  },
  'oos-pareto': {
    label: 'Out-of-stock Pareto · items driving stockouts',
    chartLabel: 'Here are the items driving OOS events, with cumulative share:',
    reasoning: '**Four items drive 73% of all OOS events** — almond croissant, blueberry muffin, oat flat white, and ham & cheese baguette. The cumulative line crosses 80% at the fifth item (green juice). Everything beyond that is long tail. Put the top 4 on a tighter replenishment trigger (e.g. second batch at 11am) and availability failures would drop materially without touching the rest of the range.',
  },
  'labour-hours': {
    label: 'Actual vs scheduled labour hours · this week',
    chartLabel: 'Here\'s actual labour hours vs scheduled, per site this week:',
    reasoning: 'Three sites are **meaningfully over schedule**: City Centre (+48h, +12.6%), Canary (+36h, +12.8%), Shoreditch (+16h, +5.0%). Fitzroy and Kings X both came in **under schedule** (less overtime, shifts released early). The City Centre and Canary overruns are the bulk of this week\'s labour budget miss — worth a manager debrief on why the extra hours were needed.',
  },
  'waste-kpi': {
    label: 'Total waste this week · estate',
    chartLabel: 'Here\'s total recorded waste across the estate this week:',
    reasoning: 'Total recorded waste for the past 7 days is **£1,842**, down **8.4% on the prior week** (£2,011) and **14% below the 8-week average**. The trend has been steadily improving since the production planning tightening in week 6. Keep going — another 10% reduction would bring total below £1,700 and unlock the monthly COGS % target.',
  },
  'waste-trend-stacked': {
    label: 'Waste trend · 12 weeks by reason',
    chartLabel: 'Here\'s estate waste over the last 12 weeks, stacked by reason:',
    reasoning: 'Total waste has fallen **~45% over 12 weeks** (£2,220 → £1,320). The biggest improvement is in **overproduction** (down from £1,040 to £580) — credit the production planning targets introduced in week 6. Expired stock is also trending down. **Spoilage is the flattest line** — the remaining cold-chain / storage issue is where the next 10% lives.',
  },
  'prod-avail-scatter': {
    label: 'Production adherence × availability failures',
    chartLabel: 'Here\'s each site plotted by production plan adherence vs availability failures (bubble size = sales):',
    reasoning: 'The correlation is **strong and negative** — sites that stick to their production plan run out of stock less often. Fitzroy (94% adherence, 3 failures) and Canary (71%, 22 failures) are the two poles. The **lower-right cluster** (City Centre, Canary) is where the operational effort should go — each 5 percentage points of adherence correlates with ~4 fewer OOS events per month.',
  },
  'waste-category-treemap': {
    label: 'Waste by category · nested',
    chartLabel: 'Here\'s estate waste broken down by category and item type:',
    reasoning: '**Food dominates at 62%** of estate waste £, led by pastries (£480) and sandwiches (£340). **Drink is 33%** — milk alone accounts for £280 (stock rotation gap in the walk-in). **Packaging is just 5%** — not where the cost lives. Focus: tighten pastry production and fix milk stock-rotation; everything else is noise.',
  },
  'labour-day-radial': {
    label: 'Labour cost % by day of week',
    chartLabel: 'Here\'s labour as a % of revenue, by day of the week:',
    reasoning: '**Sunday is by far the worst at 31.2%** — revenue is low but staffing hasn\'t been cut to match. Saturday is the leanest at 24.6% (high sales, standard crew). Weekdays sit in a tight 26–28% band. Biggest opportunity: cut one back-of-house shift on Sunday — would bring the day in line with Friday\'s 28% and save ~£180/week at the estate level.',
  },
  // ── Dunkin (CSV-backed; only used by the Dunkin persona) ────────────────────
  ...DUNKIN_ANALYTICS_CONFIG,
};
