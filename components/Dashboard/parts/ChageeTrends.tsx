'use client';

/**
 * ChageeTrends — the "Trends" tab of the CHAGEE — Flagship manager dashboard.
 *
 * A self-contained set of tea-house charts (all data local to this file) so the
 * second dashboard tab reads unambiguously as CHAGEE: drink mix, boba attach,
 * brew-line yield, iced-vs-hot by hour, topping usage and the revenue trend.
 * Kept independent of the estate analytics datasets so it can evolve freely.
 */

import type { ReactNode } from 'react';
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const ACCENT = 'var(--color-accent-deep)';
const ACCENT_MID = 'var(--color-accent-mid)';
const ACCENT_ACTIVE = 'var(--color-accent-active)';
const WARN = '#B45309';
const OK = '#166534';

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
  boxShadow: '0 2px 8px rgba(0, 28, 53,0.12)',
};

// ── Data (all CHAGEE — Flagship) ────────────────────────────────────────────

const KPIS = [
  { label: 'Cups sold today', value: '486', sub: 'so far · +9% vs typical' },
  { label: 'Avg ticket', value: '£6.80', sub: '+£0.30 vs last week' },
  { label: 'Boba attach rate', value: '63%', sub: 'of drinks add a topping' },
  { label: 'Brew line on-time', value: '96%', sub: 'bases ready before peak' },
];

const DRINK_CATEGORY = [
  { category: 'Milk tea',  value: 1420, colour: ACCENT },
  { category: 'Fruit tea', value: 940,  colour: ACCENT_MID },
  { category: 'Pure tea',  value: 460,  colour: ACCENT_ACTIVE },
  { category: 'Seasonal',  value: 380,  colour: WARN },
];

const TOP_DRINKS = [
  { drink: 'Jasmine Green Milk Tea', units: 128, revenue: 851 },
  { drink: 'Taro Milk Tea',          units: 104, revenue: 728 },
  { drink: 'Brown Sugar Boba',       units: 92,  revenue: 644 },
  { drink: 'Peach Oolong Fruit Tea', units: 78,  revenue: 507 },
  { drink: 'Matcha Latte',           units: 64,  revenue: 480 },
  { drink: 'Mango Green Tea',        units: 52,  revenue: 338 },
  { drink: 'Oolong Milk Tea',        units: 44,  revenue: 286 },
  { drink: 'Osmanthus Pure Tea',     units: 30,  revenue: 165 },
];

// Warm day pushes iced share up through the afternoon peak.
const ICED_HOT_BY_HOUR = [
  { hour: '10am', iced: 34, hot: 26 },
  { hour: '11am', iced: 48, hot: 30 },
  { hour: '12pm', iced: 66, hot: 30 },
  { hour: '1pm',  iced: 78, hot: 28 },
  { hour: '2pm',  iced: 86, hot: 24 },
  { hour: '3pm',  iced: 80, hot: 22 },
  { hour: '4pm',  iced: 72, hot: 22 },
  { hour: '5pm',  iced: 60, hot: 24 },
  { hour: '6pm',  iced: 46, hot: 26 },
  { hour: '7pm',  iced: 34, hot: 24 },
];

const TOPPING_USAGE = [
  { topping: 'Tapioca pearls', servings: 214 },
  { topping: 'Cheese foam',    servings: 132 },
  { topping: 'Grass jelly',    servings: 88 },
  { topping: 'Aiyu jelly',     servings: 61 },
  { topping: 'Red bean',       servings: 47 },
  { topping: 'Pudding',        servings: 33 },
];

const REVENUE_TREND = [
  { wk: 'Wk 1',  rev: 18.6 },
  { wk: 'Wk 2',  rev: 19.1 },
  { wk: 'Wk 3',  rev: 19.8 },
  { wk: 'Wk 4',  rev: 19.4 },
  { wk: 'Wk 5',  rev: 20.6 },
  { wk: 'Wk 6',  rev: 21.2 },
  { wk: 'Wk 7',  rev: 21.9 },
  { wk: 'Wk 8',  rev: 22.4 },
  { wk: 'Wk 9',  rev: 23.1 },
  { wk: 'Wk 10', rev: 23.8 },
  { wk: 'Wk 11', rev: 23.5 },
  { wk: 'Wk 12', rev: 24.6 },
];

// Brewed base vs cups sold from it (yesterday), litres brewed.
const BREW_YIELD = [
  { base: 'Jasmine green', brewed: 42, sold: 39 },
  { base: 'Oolong',        brewed: 30, sold: 31 },
  { base: 'Black tea',     brewed: 26, sold: 22 },
  { base: 'Matcha',        brewed: 14, sold: 15 },
  { base: 'Osmanthus',     brewed: 10, sold: 7 },
];

// ── Card wrapper ────────────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
  height = 240,
  span = 1,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
  span?: 1 | 2;
}) {
  return (
    <div
      style={{
        gridColumn: `span ${span} / span ${span}`,
        padding: '16px 16px 12px',
        borderRadius: '12px 0 12px 12px',
        border: '1px solid #001C35',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)',
        minWidth: 0,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ChageeTrends() {
  const categoryTotal = DRINK_CATEGORY.reduce((s, r) => s + r.value, 0);
  const topMax = Math.max(...TOP_DRINKS.map((r) => r.units));
  const toppingMax = Math.max(...TOPPING_USAGE.map((r) => r.servings));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        {KPIS.map((k) => (
          <div
            key={k.label}
            style={{
              padding: '14px 16px',
              borderRadius: '12px 0 12px 12px',
              border: '1px solid #001C35',
              background: '#fff',
              boxShadow: '0 2px 12px rgba(0, 28, 53,0.08)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {k.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.1, marginTop: 4 }}>
              {k.value}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Chart grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        <ChartCard title="Sales by drink category · this week" subtitle="Milk tea still leads; fruit tea share climbs on warm days.">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={DRINK_CATEGORY}
                dataKey="value"
                nameKey="category"
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
                {DRINK_CATEGORY.map((c) => (
                  <Cell key={c.category} fill={c.colour} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                align="center"
                iconType="circle"
                formatter={(value) => {
                  const row = DRINK_CATEGORY.find((c) => c.category === value);
                  if (!row) return value;
                  const pct = Math.round((row.value / categoryTotal) * 100);
                  return `${value} · £${row.value} (${pct}%)`;
                }}
                wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }}
              />
              <Tooltip formatter={(v, name) => [`£${Number(v)}`, String(name)]} contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top drinks · this week" subtitle="Units sold. Signature milk teas carry the mix.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={TOP_DRINKS} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
              <XAxis type="number" tick={TICK_STYLE} axisLine={false} tickLine={false} domain={[0, topMax * 1.1]} />
              <YAxis type="category" dataKey="drink" tick={{ ...TICK_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} width={150} />
              <Tooltip
                formatter={(v, _name, entry) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const revenue = (entry as any)?.payload?.revenue ?? 0;
                  return [`${Number(v)} cups · £${revenue}`, 'Sold'];
                }}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="units" radius={[0, 3, 3, 0]}>
                {TOP_DRINKS.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? ACCENT : i < 3 ? ACCENT_MID : 'var(--color-border-subtle)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Iced vs hot · by hour" subtitle="Warm afternoon skews the mix hard toward iced.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ICED_HOT_BY_HOUR} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barCategoryGap="18%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
              <XAxis dataKey="hour" tick={{ ...TICK_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}`} />
              <Tooltip formatter={(v, name) => [`${Number(v)} cups`, name === 'iced' ? 'Iced' : 'Hot']} contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }} formatter={(v) => (v === 'iced' ? 'Iced' : 'Hot')} />
              <Bar dataKey="iced" name="iced" stackId="mix" fill={ACCENT} radius={[3, 3, 0, 0]} />
              <Bar dataKey="hot" name="hot" stackId="mix" fill="var(--color-border-subtle)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Topping usage · today" subtitle="Servings prepped on the topping station.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={TOPPING_USAGE} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
              <XAxis type="number" tick={TICK_STYLE} axisLine={false} tickLine={false} domain={[0, toppingMax * 1.1]} />
              <YAxis type="category" dataKey="topping" tick={TICK_STYLE} axisLine={false} tickLine={false} width={110} />
              <Tooltip formatter={(v) => [`${Number(v)} servings`, 'Used']} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="servings" radius={[0, 3, 3, 0]}>
                {TOPPING_USAGE.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? ACCENT : i < 3 ? ACCENT_MID : 'var(--color-border-subtle)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Brew line · brewed vs sold" subtitle="Litres brewed against cups pulled per base (yesterday). Watch under-brews.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={BREW_YIELD} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
              <XAxis dataKey="base" tick={{ ...TICK_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}L`} />
              <Tooltip formatter={(v, name) => [`${Number(v)} L`, name === 'brewed' ? 'Brewed' : 'Sold']} contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }} formatter={(v) => (v === 'brewed' ? 'Brewed' : 'Sold')} />
              <Bar dataKey="brewed" name="brewed" fill="var(--color-border-subtle)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="sold" name="sold" radius={[3, 3, 0, 0]}>
                {BREW_YIELD.map((r, i) => (
                  <Cell key={i} fill={r.sold > r.brewed ? WARN : OK} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue trend · last 12 weeks" subtitle="Weekly net sales (£k). Steady climb as boba attach improves.">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={REVENUE_TREND} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="chageeTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACCENT} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
              <XAxis dataKey="wk" tick={{ ...TICK_STYLE, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={(v: number) => `£${v}k`} domain={[16, 26]} />
              <Tooltip formatter={(v) => [`£${Number(v)}k`, 'Net sales']} contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="rev" stroke={ACCENT} strokeWidth={2} fill="url(#chageeTrendGrad)" dot={false} />
              <Line type="monotone" dataKey="rev" stroke={ACCENT} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
