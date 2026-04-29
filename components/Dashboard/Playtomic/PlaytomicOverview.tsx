'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
  Area,
  AreaChart,
  BarChart,
} from 'recharts';
import KpiCardRow from '@/components/Dashboard/Playtomic/parts/KpiCardRow';
import WeeklyWeatherCard from '@/components/Dashboard/Playtomic/parts/WeeklyWeatherCard';
import {
  HOURLY_BOOKINGS,
  LEAD_TIME_DIST,
  MEMBER_GROWTH_12W,
  OVERVIEW_KPIS,
  RETENTION_BY_TIER,
  REVENUE_TREND_12W,
  SITE_REVENUE,
} from '@/components/Dashboard/data/playtomicMockData';

const ACCENT = 'var(--color-accent-active)';
const ACCENT_DEEP = 'var(--color-accent-deep)';
const NEGATIVE = '#d44d4d';
const POSITIVE = '#21a87a';
const TICK_STYLE = {
  fontSize: 11,
  fontFamily: 'var(--font-primary)',
  fill: 'var(--color-text-muted)',
} as const;
const TOOLTIP_STYLE = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 8,
  fontFamily: 'var(--font-primary)',
  fontSize: 12,
};

function ChartCard({
  title,
  subtitle,
  children,
  height = 240,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div
      style={{
        padding: '16px 16px 12px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.06)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}

export default function PlaytomicOverview() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <header>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: 6,
          }}
        >
          Playtomic · overview
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Today across the chain
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Court bookings, cafe revenue and member growth at a glance.
        </div>
      </header>

      <KpiCardRow kpis={OVERVIEW_KPIS} />

      <WeeklyWeatherCard />

      <ChartCard
        title="Revenue · last 12 weeks"
        subtitle="Court revenue (deep) stacked with cafe revenue (light). Both growing steadily."
        height={240}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={REVENUE_TREND_12W} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
            <XAxis dataKey="week" tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v: number) => `£${Math.round(v / 1000)}k`}
              tick={TICK_STYLE}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v, name) => [`£${Number(v).toLocaleString('en-GB')}`, String(name)]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }} />
            <Area
              type="monotone"
              dataKey="courts"
              name="Courts"
              stackId="rev"
              stroke={ACCENT_DEEP}
              fill={ACCENT_DEEP}
              fillOpacity={0.85}
            />
            <Area
              type="monotone"
              dataKey="cafe"
              name="Cafe"
              stackId="rev"
              stroke={ACCENT}
              fill={ACCENT}
              fillOpacity={0.7}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 12 }}>
        <ChartCard
          title="Bookings and cafe revenue · today"
          subtitle="Court bookings (bars) layered with cafe £ per hour (line)."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={HOURLY_BOOKINGS} margin={{ top: 4, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
              <XAxis dataKey="hour" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `£${v}`}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }} />
              <Bar yAxisId="left" dataKey="bookings" name="Bookings" fill={ACCENT} radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cafe"
                name="Cafe £"
                stroke={ACCENT_DEEP}
                strokeWidth={2.4}
                dot={{ r: 3, fill: ACCENT_DEEP, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Revenue by site · this week"
          subtitle="Courts vs cafe split per club."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={SITE_REVENUE}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 0, left: 16 }}
              barCategoryGap="22%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
              <XAxis
                type="number"
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `£${Math.round(v / 1000)}k`}
              />
              <YAxis type="category" dataKey="site" tick={TICK_STYLE} axisLine={false} tickLine={false} width={92} />
              <Tooltip
                formatter={(v, name) => [`£${Number(v).toLocaleString('en-GB')}`, String(name)]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }} />
              <Bar dataKey="courts" name="Courts" stackId="rev" fill={ACCENT_DEEP} />
              <Bar dataKey="cafe" name="Cafe" stackId="rev" fill={ACCENT} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 12 }}>
        <ChartCard
          title="Active members and weekly flow"
          subtitle="Total active members trending up. Bars: new joiners (green) and churn (red) per week."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={MEMBER_GROWTH_12W} margin={{ top: 4, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
              <XAxis dataKey="week" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)' }} />
              <Bar yAxisId="left" dataKey="new" name="New" fill={POSITIVE} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="left" dataKey="churned" name="Churned" fill={NEGATIVE} radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="active"
                name="Active total"
                stroke={ACCENT_DEEP}
                strokeWidth={2.4}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Booking lead time · last 30d"
          subtitle="How far in advance players book. Same-day fill rises with weather sensitivity."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={LEAD_TIME_DIST} margin={{ top: 4, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
              <XAxis dataKey="bucket" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                formatter={(v) => [`${Number(v)}%`, 'Bookings']}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="pct" name="Bookings" fill={ACCENT} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div
        style={{
          padding: '16px 16px 14px',
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
          boxShadow: '0 2px 12px rgba(58,48,40,0.06)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            90-day retention by player tier
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
            Coached members retain best. New players are the leakiest cohort — the lever for an onboarding programme.
          </div>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {RETENTION_BY_TIER.map((row) => (
            <li
              key={row.tier}
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr 80px',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {row.tier}
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: 'var(--color-bg-canvas)',
                  border: '1px solid var(--color-border-subtle)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${row.pct}%`,
                    height: '100%',
                    background: row.pct >= 70 ? POSITIVE : row.pct >= 50 ? ACCENT : NEGATIVE,
                    borderRadius: 999,
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                  textAlign: 'right',
                }}
              >
                {row.pct}% · {row.count.toLocaleString('en-GB')}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
