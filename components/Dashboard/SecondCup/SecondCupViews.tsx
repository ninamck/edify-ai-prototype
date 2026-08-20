'use client';

/**
 * Second Cup demo dashboards — two extra home-dashboard tabs that render
 * only on the multi-currency (Second Cup) build:
 *
 *  - StorePerformanceDashboard: sales and store performance for the
 *    franchisee's UK estate — daily pace, dayparts, store league.
 *  - FranchiseNetworkDashboard: the franchisor's view of how all 150 sites
 *    are doing worldwide, consolidated to CAD.
 *
 * Styled to match the main manager dashboard: navy-bordered KPI tiles and
 * chart cards, recharts charts, and dense tables. Static scripted content;
 * both views return null on non-Second-Cup builds.
 */

import type { CSSProperties, ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp, TrendingDown, Store, Globe, Target, Coins } from 'lucide-react';
import { isMultiCurrencyDemo } from '@/lib/demoConfig';

const NAVY = '#001C35';
const VALUE_INK = '#1A148A';
const OK = '#28AFC9';
const WARN = '#FF0058';
const OK_TEXT = '#166534';
const WARN_TEXT = '#B45309';
const MID = '#4a6cb5';

const tipStyle = {
  background: '#FCF6EE',
  border: '1px solid #001C35',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 500,
  color: '#001C35',
};

// ─── Shared building blocks (manager-dashboard visual language) ──────────────

function KpiTile({
  label,
  value,
  delta,
  positive,
  context,
  icon,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  context?: string;
  icon?: ReactNode;
}) {
  const deltaColor = positive === undefined ? 'var(--color-text-secondary)' : positive ? OK_TEXT : WARN_TEXT;
  const DeltaIcon = positive === undefined ? null : positive ? TrendingUp : TrendingDown;
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '10px 0 10px 10px',
        border: `1px solid ${NAVY}`,
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0, 28, 53,0.08), 0 0 0 1px rgba(0, 28, 53,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, color: VALUE_INK, whiteSpace: 'nowrap' }}>
        {value}
      </div>
      {(delta || context) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: deltaColor, flexWrap: 'wrap' }}>
          {DeltaIcon && <DeltaIcon size={12} strokeWidth={2.4} />}
          {delta && <span>{delta}</span>}
          {context && <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>· {context}</span>}
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  height = 260,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
}) {
  return (
    <div
      style={{
        padding: '16px 16px 12px',
        borderRadius: '12px 0 12px 12px',
        border: `1px solid ${NAVY}`,
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)',
        minHeight: 0,
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

function TableCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: string;
}) {
  return (
    <div
      style={{
        borderRadius: '12px 0 12px 12px',
        border: `1px solid ${NAVY}`,
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
      {footer && (
        <div style={{ padding: '10px 16px 12px', fontSize: 11.5, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-subtle)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

const TH: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  padding: '9px 14px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--color-border-subtle)',
  borderTop: '1px solid var(--color-border-subtle)',
};

const TD: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  padding: '9px 14px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--color-border-subtle)',
};

function DeltaText({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span style={{ fontWeight: 700, color: up ? OK_TEXT : WARN_TEXT }}>
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

/** Two-column dashboard grid, matching the manager dashboard. */
function Grid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 14,
        gridAutoFlow: 'dense',
      }}
    >
      {children}
    </div>
  );
}

const FULL: CSSProperties = { gridColumn: 'span 2 / span 2', minWidth: 0 };
const HALF: CSSProperties = { gridColumn: 'span 1 / span 1', minWidth: 0 };


// ─── Store performance (the franchisee's UK estate) ──────────────────────────

const DAILY_SALES = [
  { day: 'Mon', actual: 6120, lastWeek: 5890 },
  { day: 'Tue', actual: 6480, lastWeek: 6260 },
  { day: 'Wed', actual: 6890, lastWeek: 6540 },
  { day: 'Thu', actual: 7150, lastWeek: 7220 },
  { day: 'Fri', actual: 8240, lastWeek: 7810 },
  { day: 'Sat', actual: 8960, lastWeek: 8420 },
  { day: 'Sun', actual: 4810, lastWeek: 4930 },
];

const DAYPARTS = [
  { part: 'Before 9am', sales: 11840 },
  { part: '9am–12pm', sales: 15620 },
  { part: '12–3pm', sales: 12210 },
  { part: '3–6pm', sales: 6480 },
  { part: 'After 6pm', sales: 2500 },
];

const UK_STORES = [
  { store: 'Covent Garden', sales: 9840, vsLw: 6.2, vsForecast: 3.8, atv: 5.12, cogs: 27.4 },
  { store: 'Canary Wharf', sales: 8720, vsLw: 4.9, vsForecast: 2.1, atv: 5.46, cogs: 26.8 },
  { store: 'Kings Cross', sales: 8110, vsLw: 3.1, vsForecast: 1.2, atv: 4.88, cogs: 27.9 },
  { store: 'Manchester Arndale', sales: 7480, vsLw: 2.4, vsForecast: -0.8, atv: 4.61, cogs: 28.3 },
  { store: 'Birmingham New St', sales: 7260, vsLw: -1.2, vsForecast: -2.4, atv: 4.55, cogs: 28.9 },
  { store: 'Edinburgh Princes St', sales: 7240, vsLw: 5.8, vsForecast: 4.1, atv: 4.92, cogs: 27.1 },
];

const WEEK_TOTAL = DAILY_SALES.reduce((s, d) => s + d.actual, 0);
const LW_TOTAL = DAILY_SALES.reduce((s, d) => s + d.lastWeek, 0);
const WEEK_DELTA_PCT = ((WEEK_TOTAL - LW_TOTAL) / LW_TOTAL) * 100;

// ─── Sales-question charts (the 10 curated sales questions, answered) ────────

const LAST_WEEK_BY_SITE = [
  { store: 'Covent Garden', sales: 9260 },
  { store: 'Canary Wharf', sales: 8310 },
  { store: 'Kings Cross', sales: 7870 },
  { store: 'Manchester Arndale', sales: 7300 },
  { store: 'Birmingham New St', sales: 7350 },
  { store: 'Edinburgh Princes St', sales: 6980 },
];

const REVENUE_30D_BY_SITE = [
  { store: 'Covent Garden', sales: 41200 },
  { store: 'Canary Wharf', sales: 37400 },
  { store: 'Kings Cross', sales: 34600 },
  { store: 'Manchester Arndale', sales: 31900 },
  { store: 'Birmingham New St', sales: 31200 },
  { store: 'Edinburgh Princes St', sales: 30400 },
];

const WEEK_VS_LY = [
  { day: 'Mon', thisYear: 6120, lastYear: 5640 },
  { day: 'Tue', thisYear: 6480, lastYear: 6010 },
  { day: 'Wed', thisYear: 6890, lastYear: 6390 },
  { day: 'Thu', thisYear: 7150, lastYear: 6860 },
  { day: 'Fri', thisYear: 8240, lastYear: 7590 },
  { day: 'Sat', thisYear: 8960, lastYear: 8380 },
  { day: 'Sun', thisYear: 4810, lastYear: 4720 },
];

const ATV_BY_SITE = [
  { store: 'Canary Wharf', atv: 5.46 },
  { store: 'Covent Garden', atv: 5.12 },
  { store: 'Edinburgh Princes St', atv: 4.92 },
  { store: 'Kings Cross', atv: 4.88 },
  { store: 'Manchester Arndale', atv: 4.61 },
  { store: 'Birmingham New St', atv: 4.55 },
];

const WEEKDAY_HOURLY = [
  { hour: '7am', sales: 720 },
  { hour: '8am', sales: 1240 },
  { hour: '9am', sales: 980 },
  { hour: '10am', sales: 760 },
  { hour: '11am', sales: 690 },
  { hour: '12pm', sales: 880 },
  { hour: '1pm', sales: 840 },
  { hour: '2pm', sales: 560 },
  { hour: '3pm', sales: 470 },
  { hour: '4pm', sales: 390 },
  { hour: '5pm', sales: 310 },
  { hour: '6pm', sales: 230 },
];

const TWELVE_WEEK_TREND = [
  { week: 'W-11', sales: 43.1 },
  { week: 'W-10', sales: 43.8 },
  { week: 'W-9', sales: 43.4 },
  { week: 'W-8', sales: 44.6 },
  { week: 'W-7', sales: 44.1 },
  { week: 'W-6', sales: 45.2 },
  { week: 'W-5', sales: 45.8 },
  { week: 'W-4', sales: 46.5 },
  { week: 'W-3', sales: 46.1 },
  { week: 'W-2', sales: 46.9 },
  { week: 'W-1', sales: 47.1 },
  { week: 'This wk', sales: 48.7 },
];

const EATIN_TAKEAWAY = [
  { name: 'Takeaway', value: 61, fill: MID },
  { name: 'Eat-in', value: 39, fill: OK },
];

const CATEGORY_REVENUE = [
  { category: 'Espresso drinks', sales: 19460 },
  { category: 'Brewed coffee', sales: 8270 },
  { category: 'Frappes & iced', sales: 6810 },
  { category: 'Bakery', sales: 6420 },
  { category: 'Sandwiches', sales: 4530 },
  { category: 'Retail beans', sales: 3160 },
];

const TOP_ITEMS = [
  { item: 'Flat white', units: 4820 },
  { item: 'Latte', units: 4310 },
  { item: 'Cappuccino', units: 3660 },
  { item: 'Americano', units: 3240 },
  { item: 'Maple latte', units: 2410 },
  { item: 'Butter croissant', units: 2180 },
  { item: 'Iced latte', units: 1960 },
  { item: 'Hot chocolate', units: 1690 },
  { item: 'Blueberry muffin', units: 1470 },
  { item: 'Chai latte', units: 1250 },
];

const WEEKEND_VS_WEEKDAY = [
  { label: 'Weekday avg', sales: 6976 },
  { label: 'Weekend avg', sales: 6885 },
];

export function StorePerformanceDashboard() {
  if (!isMultiCurrencyDemo) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* KPI hero row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <KpiTile
          label="Sales this week"
          value={`$${WEEK_TOTAL.toLocaleString('en-GB')}`}
          delta={`+$${(WEEK_TOTAL - LW_TOTAL).toLocaleString('en-GB')} (+${WEEK_DELTA_PCT.toFixed(1)}%)`}
          positive
          context="vs last week · 6 stores"
          icon={<TrendingUp size={13} color="var(--color-accent-deep)" strokeWidth={2.2} />}
        />
        <KpiTile
          label="Transactions"
          value="21,340"
          delta="+3.4%"
          positive
          context="vs last week"
          icon={<Store size={13} color="var(--color-text-muted)" strokeWidth={2.2} />}
        />
        <KpiTile
          label="Avg transaction"
          value="$4.87"
          delta="+$0.06"
          positive
          context="menu price round from 1 Apr"
          icon={<Target size={13} color="var(--color-text-muted)" strokeWidth={2.2} />}
        />
        <KpiTile
          label="COGS"
          value="27.8%"
          delta="+0.6pp"
          positive={false}
          context="two-thirds of the rise is CAD FX, not price"
          icon={<Coins size={13} color="var(--color-text-muted)" strokeWidth={2.2} />}
        />
      </div>

      <Grid>
        {/* Daily sales vs last week */}
        <div style={FULL}>
          <ChartCard
            title="Sales by day · this week vs last"
            subtitle="Bars: this week's actual $ (cyan = ahead of last week, pink = behind). Line: same day last week."
            height={280}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={DAILY_SALES} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={44} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `$${Number(v ?? 0).toLocaleString('en-GB')}`} />
                <Bar dataKey="actual" name="This week" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {DAILY_SALES.map((d) => (
                    <Cell key={d.day} fill={d.actual >= d.lastWeek ? OK : WARN} />
                  ))}
                </Bar>
                <Line dataKey="lastWeek" name="Last week" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Daypart mix */}
        <div style={HALF}>
          <ChartCard
            title="Sales by daypart · this week"
            subtitle="Morning trade carries the week — the pre-9am and 9–12 dayparts are 57% of sales."
            height={240}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DAYPARTS} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="part" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={78} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `$${Number(v ?? 0).toLocaleString('en-GB')}`} />
                <Bar dataKey="sales" name="Sales" fill={MID} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Store league */}
        <div style={HALF}>
          <TableCard
            title="Store league · this week"
            subtitle="All six stores, ranked by sales."
            footer="Birmingham New St is the only store behind both last week and forecast — worth a look at local roster and waste."
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>Store</th>
                  <th style={TH}>Sales</th>
                  <th style={TH}>vs LW</th>
                  <th style={TH}>vs forecast</th>
                  <th style={TH}>ATV</th>
                  <th style={TH}>COGS</th>
                </tr>
              </thead>
              <tbody>
                {UK_STORES.map((s, i) => (
                  <tr key={s.store}>
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 700, marginRight: 8 }}>{i + 1}</span>
                      {s.store}
                    </td>
                    <td style={{ ...TD, fontWeight: 600 }}>${s.sales.toLocaleString('en-GB')}</td>
                    <td style={TD}><DeltaText pct={s.vsLw} /></td>
                    <td style={TD}><DeltaText pct={s.vsForecast} /></td>
                    <td style={TD}>${s.atv.toFixed(2)}</td>
                    <td style={TD}>{s.cogs.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>

        {/* Q1: total sales across all sites last week */}
        <div style={HALF}>
          <ChartCard
            title="Total sales across all sites · last week"
            subtitle={`$${LW_TOTAL.toLocaleString('en-GB')} across 6 stores.`}
            height={220}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={LAST_WEEK_BY_SITE} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="store" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={132} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `$${Number(v ?? 0).toLocaleString('en-GB')}`} />
                <Bar dataKey="sales" name="Sales" fill={MID} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Q2: highest revenue in the last 30 days */}
        <div style={HALF}>
          <ChartCard
            title="Highest revenue site · last 30 days"
            subtitle="Covent Garden leads on $41,200 — 10% clear of Canary Wharf."
            height={220}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={REVENUE_30D_BY_SITE} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="store" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={132} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `$${Number(v ?? 0).toLocaleString('en-GB')}`} />
                <Bar dataKey="sales" name="Revenue (30d)" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {REVENUE_30D_BY_SITE.map((d, i) => (
                    <Cell key={d.store} fill={i === 0 ? OK : MID} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Q3: this week vs same week last year */}
        <div style={FULL}>
          <ChartCard
            title="Sales this week vs the same week last year"
            subtitle="Bars: this year's actual $. Line: same week last year. Up +6.8% year on year."
            height={260}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={WEEK_VS_LY} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={44} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `$${Number(v ?? 0).toLocaleString('en-GB')}`} />
                <Bar dataKey="thisYear" name="This year" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {WEEK_VS_LY.map((d) => (
                    <Cell key={d.day} fill={d.thisYear >= d.lastYear ? OK : WARN} />
                  ))}
                </Bar>
                <Line dataKey="lastYear" name="Last year" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Q4: average transaction value per site */}
        <div style={HALF}>
          <ChartCard
            title="Average transaction value per site · this month"
            subtitle="Canary Wharf's office crowd pays the most per visit."
            height={220}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ATV_BY_SITE} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" horizontal={false} />
                <XAxis type="number" domain={[0, 6]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                <YAxis type="category" dataKey="store" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={132} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `$${Number(v ?? 0).toFixed(2)}`} />
                <Bar dataKey="atv" name="Avg transaction" fill={MID} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Q5: which hour drives most weekday revenue */}
        <div style={HALF}>
          <ChartCard
            title="Weekday revenue by hour"
            subtitle="8am is the money hour — the commuter rush is a fifth of weekday sales."
            height={220}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEKDAY_HOURLY} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={44} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `$${Number(v ?? 0).toLocaleString('en-GB')}`} />
                <Bar dataKey="sales" name="Avg weekday sales" radius={[4, 4, 0, 0]} maxBarSize={22}>
                  {WEEKDAY_HOURLY.map((d) => (
                    <Cell key={d.hour} fill={d.hour === '8am' ? OK : MID} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Q6: 12-week revenue trend */}
        <div style={HALF}>
          <ChartCard
            title="Revenue trend · last 12 weeks"
            subtitle="Weekly sales, $ thousands. +13% over the quarter, lifted by the spring menu."
            height={220}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={TWELVE_WEEK_TREND} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }} interval={1} />
                <YAxis domain={[40, 52]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}k`} width={44} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `$${Number(v ?? 0).toFixed(1)}k`} />
                <Line dataKey="sales" name="Weekly sales" stroke={NAVY} strokeWidth={2.4} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Q7: eat-in vs takeaway split */}
        <div style={HALF}>
          <ChartCard
            title="Sales split · eat-in vs takeaway"
            subtitle="Takeaway dominates at 61% — city-centre grab-and-go trade."
            height={220}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={tipStyle} formatter={(v) => `${Number(v ?? 0)}%`} />
                <Pie
                  data={EATIN_TAKEAWAY}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  strokeWidth={0}
                  label={({ name, value }) => `${name} ${value}%`}
                  labelLine={false}
                  fontSize={12}
                  fontWeight={600}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Q8: revenue by product category */}
        <div style={HALF}>
          <ChartCard
            title="Revenue by product category · this month"
            subtitle="Espresso drinks are 40% of revenue; retail beans the long tail."
            height={220}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CATEGORY_REVENUE} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `$${Number(v ?? 0).toLocaleString('en-GB')}`} />
                <Bar dataKey="sales" name="Revenue" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {CATEGORY_REVENUE.map((d, i) => (
                    <Cell key={d.category} fill={i === 0 ? OK : MID} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Q9: top 10 best-selling items */}
        <div style={HALF}>
          <ChartCard
            title="Top 10 best-selling items · all stores"
            subtitle="Units sold this month. Flat white keeps the crown; maple latte is the spring climber."
            height={260}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TOP_ITEMS} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="item" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `${Number(v ?? 0).toLocaleString('en-GB')} units`} />
                <Bar dataKey="units" name="Units" radius={[0, 4, 4, 0]} maxBarSize={14}>
                  {TOP_ITEMS.map((d, i) => (
                    <Cell key={d.item} fill={i === 0 ? OK : MID} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Q10: weekend vs weekday average */}
        <div style={HALF}>
          <ChartCard
            title="Weekend vs weekday sales · average day"
            subtitle="Near parity — Saturday's peak offsets the quiet Sunday."
            height={260}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEKEND_VS_WEEKDAY} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={44} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `$${Number(v ?? 0).toLocaleString('en-GB')}`} />
                <Bar dataKey="sales" name="Avg daily sales" radius={[4, 4, 0, 0]} maxBarSize={72}>
                  <Cell fill={MID} />
                  <Cell fill={OK} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Grid>
    </div>
  );
}

// ─── Franchise network (all 150 sites, franchisor's view) ────────────────────

const REGIONS = [
  { region: 'Canada', sites: 62, salesCad: 1182000, vsLw: 2.1 },
  { region: 'Middle East', sites: 41, salesCad: 804000, vsLw: 5.4 },
  { region: 'US', sites: 22, salesCad: 428000, vsLw: 1.8 },
  { region: 'UK & Europe', sites: 17, salesCad: 296000, vsLw: 4.6 },
  { region: 'Asia', sites: 8, salesCad: 131000, vsLw: 3.2 },
];

const NETWORK_TREND = [
  { week: 'W-7', salesCad: 2.61 },
  { week: 'W-6', salesCad: 2.66 },
  { week: 'W-5', salesCad: 2.63 },
  { week: 'W-4', salesCad: 2.70 },
  { week: 'W-3', salesCad: 2.72 },
  { week: 'W-2', salesCad: 2.75 },
  { week: 'W-1', salesCad: 2.76 },
  { week: 'This wk', salesCad: 2.84 },
];

const TOP_SITES = [
  { store: 'Dubai Mall', region: 'Middle East', local: 'AED 142,300', cad: 53100, vsLw: 8.2 },
  { store: 'Queen St West, Toronto', region: 'Canada', local: '—', cad: 48900, vsLw: 4.1 },
  { store: 'Bryant Park, New York', region: 'US', local: 'US$ 33,800', cad: 46700, vsLw: 5.6 },
  { store: 'Covent Garden, London', region: 'UK & Europe', local: '$ 9,840', cad: 17000, vsLw: 6.2 },
  { store: 'Mall of the Emirates', region: 'Middle East', local: 'AED 118,600', cad: 44300, vsLw: 3.9 },
];

const BOTTOM_SITES = [
  { store: 'Sherway Gardens, Toronto', region: 'Canada', local: '—', cad: 9200, vsLw: -6.8 },
  { store: 'Calgary Chinook', region: 'Canada', local: '—', cad: 9900, vsLw: -4.2 },
  { store: 'Riyadh Park', region: 'Middle East', local: 'SAR 26,900', cad: 10100, vsLw: -3.5 },
  { store: 'Birmingham New St', region: 'UK & Europe', local: '$ 7,260', cad: 12500, vsLw: -1.2 },
  { store: 'Ottawa Rideau', region: 'Canada', local: '—', cad: 12900, vsLw: -0.8 },
];

const NETWORK_TOTAL_CAD = REGIONS.reduce((s, r) => s + r.salesCad, 0);

function SiteRows({ rows, startRank }: { rows: typeof TOP_SITES; startRank: number }) {
  return (
    <>
      {rows.map((s, i) => (
        <tr key={s.store}>
          <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 700, marginRight: 8 }}>
              {startRank + i}
            </span>
            {s.store}
          </td>
          <td style={{ ...TD, textAlign: 'left', color: 'var(--color-text-secondary)' }}>{s.region}</td>
          <td style={{ ...TD, color: 'var(--color-text-secondary)' }}>{s.local}</td>
          <td style={{ ...TD, fontWeight: 600 }}>CA${s.cad.toLocaleString('en-GB')}</td>
          <td style={TD}><DeltaText pct={s.vsLw} /></td>
        </tr>
      ))}
    </>
  );
}

export function FranchiseNetworkDashboard() {
  if (!isMultiCurrencyDemo) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* KPI hero row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <KpiTile
          label="Network sales this week"
          value="CA$2.84M"
          delta="+3.1%"
          positive
          context="consolidated to CAD from 9 billing currencies"
          icon={<Globe size={13} color="var(--color-accent-deep)" strokeWidth={2.2} />}
        />
        <KpiTile
          label="Sites trading"
          value="150"
          context="across 12 countries · 5 regions"
          icon={<Store size={13} color="var(--color-text-muted)" strokeWidth={2.2} />}
        />
        <KpiTile
          label="Same-store growth"
          value="+2.6%"
          delta="+0.4pp"
          positive
          context="vs last week · like-for-like"
          icon={<TrendingUp size={13} color="var(--color-text-muted)" strokeWidth={2.2} />}
        />
        <KpiTile
          label="Ahead of forecast"
          value="118 of 150"
          delta="79%"
          positive
          context="21 behind · 11 flat"
          icon={<Target size={13} color="var(--color-text-muted)" strokeWidth={2.2} />}
        />
      </div>

      <Grid>
        {/* Sales by region */}
        <div style={HALF}>
          <ChartCard
            title="Sales by region · this week"
            subtitle="Consolidated to CAD at the daily rate. Middle East is the fastest-growing region, +5.4% on last week."
            height={240}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={REGIONS} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                <YAxis type="category" dataKey="region" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={92} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `CA$${Number(v ?? 0).toLocaleString('en-GB')}`} />
                <Bar dataKey="salesCad" name="Sales (CAD)" fill={MID} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Network trend */}
        <div style={HALF}>
          <ChartCard
            title="Network sales trend · 8 weeks"
            subtitle="Weekly consolidated sales, CA$ millions. Steady climb since the spring menu launched in W-4."
            height={240}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={NETWORK_TREND} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0, 28, 53,0.08)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }} />
                <YAxis domain={[2.4, 3.0]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v).toFixed(1)}M`} width={48} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => `CA$${Number(v ?? 0).toFixed(2)}M`} />
                <Line dataKey="salesCad" name="Network sales" stroke={NAVY} strokeWidth={2.4} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Region table */}
        <div style={FULL}>
          <TableCard
            title="Regions · this week"
            subtitle="Every region reports in its own currencies; the group consolidates to CAD automatically."
            footer={`Group total CA$${NETWORK_TOTAL_CAD.toLocaleString('en-GB')} across 150 sites — rates auto-updated daily, locked per goods receipt for stock and COGS.`}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>Region</th>
                  <th style={TH}>Sites</th>
                  <th style={TH}>Sales (CAD)</th>
                  <th style={TH}>Share</th>
                  <th style={TH}>vs LW</th>
                </tr>
              </thead>
              <tbody>
                {REGIONS.map((r) => (
                  <tr key={r.region}>
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>{r.region}</td>
                    <td style={TD}>{r.sites}</td>
                    <td style={{ ...TD, fontWeight: 600 }}>CA${r.salesCad.toLocaleString('en-GB')}</td>
                    <td style={{ ...TD, color: 'var(--color-text-secondary)' }}>
                      {((r.salesCad / NETWORK_TOTAL_CAD) * 100).toFixed(0)}%
                    </td>
                    <td style={TD}><DeltaText pct={r.vsLw} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>

        {/* Top sites */}
        <div style={HALF}>
          <TableCard
            title="Top 5 sites · this week"
            subtitle="Billed in local currency, ranked in CAD."
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>Site</th>
                  <th style={{ ...TH, textAlign: 'left' }}>Region</th>
                  <th style={TH}>Local</th>
                  <th style={TH}>CAD</th>
                  <th style={TH}>vs LW</th>
                </tr>
              </thead>
              <tbody>
                <SiteRows rows={TOP_SITES} startRank={1} />
              </tbody>
            </table>
          </TableCard>
        </div>

        {/* Bottom sites */}
        <div style={HALF}>
          <TableCard
            title="Bottom 5 sites · this week"
            subtitle="Ranked from the back of the network."
            footer="Three of the five are Canadian mall sites — footfall is down across enclosed malls this month."
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>Site</th>
                  <th style={{ ...TH, textAlign: 'left' }}>Region</th>
                  <th style={TH}>Local</th>
                  <th style={TH}>CAD</th>
                  <th style={TH}>vs LW</th>
                </tr>
              </thead>
              <tbody>
                <SiteRows rows={BOTTOM_SITES} startRank={146} />
              </tbody>
            </table>
          </TableCard>
        </div>
      </Grid>
    </div>
  );
}
