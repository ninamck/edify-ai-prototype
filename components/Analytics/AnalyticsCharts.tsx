'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type AnalyticsChartId = 'sales' | 'hour' | 'trend' | 'growth' | 'labour' | 'cogs';

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

// ── Render helper ─────────────────────────────────────────────────────────────

export function renderAnalyticsChart(chartId: AnalyticsChartId) {
  switch (chartId) {
    case 'sales':   return <SalesChart />;
    case 'hour':    return <HourChart />;
    case 'trend':   return <TrendChart />;
    case 'growth':  return <GrowthChart />;
    case 'labour':  return <LabourChart />;
    case 'cogs':    return <CogsChart />;
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
};
