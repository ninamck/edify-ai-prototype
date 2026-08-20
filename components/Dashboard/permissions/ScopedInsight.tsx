'use client';

// Site-scoped insight renderers. Each one takes the viewer's sites and
// re-cuts its data at render time — this is "a pinned insight is a saved
// question, not a saved answer" made visible: Cheryl sees 12 bars, Ed sees
// his 3, from the same dashboard.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WidgetWidth } from '@/components/Dashboard/layoutTypes';
import type { SiteId } from './sites';
import {
  figuresForSites,
  kpiSummaryForSites,
  salesTrendForSites,
} from './scopedData';

const ACCENT = 'var(--color-accent-deep)';
const ACCENT_MID = 'var(--color-accent-mid)';
const WARN = '#B45309';
const OK = '#166534';

export type ScopedInsightId =
  | 'scoped:kpi-row'
  | 'scoped:sales-trend'
  | 'scoped:sales-by-site'
  | 'scoped:waste-by-site'
  | 'scoped:labour-by-site'
  | 'scoped:gp-by-site'
  | 'scoped:million-milestone';

export const SCOPED_INSIGHT_CONFIG: Record<
  ScopedInsightId,
  { label: string; subtitle: string; defaultWidth: WidgetWidth }
> = {
  'scoped:kpi-row': {
    label: 'This week at a glance',
    subtitle: 'Net sales, waste and labour · this week',
    defaultWidth: 'full',
  },
  'scoped:sales-trend': {
    label: 'Net sales trend',
    subtitle: '$k per week · last 12 weeks',
    defaultWidth: 'full',
  },
  'scoped:sales-by-site': {
    label: 'Net sales by site',
    subtitle: 'This week vs prior week · $k',
    defaultWidth: 'full',
  },
  'scoped:waste-by-site': {
    label: 'Waste by site — last 4 weeks',
    subtitle: 'Spoilage + comps · $',
    defaultWidth: 'half',
  },
  'scoped:labour-by-site': {
    label: 'Labour % of sales by site',
    subtitle: 'This week · target 27%',
    defaultWidth: 'half',
  },
  'scoped:gp-by-site': {
    label: 'Gross profit % by site',
    subtitle: 'This week · after transfers',
    defaultWidth: 'half',
  },
  'scoped:million-milestone': {
    label: 'Company milestone',
    subtitle: 'Broadcast from head office',
    defaultWidth: 'full',
  },
};

export function isScopedInsightId(id: string): id is ScopedInsightId {
  return id in SCOPED_INSIGHT_CONFIG;
}

const axisTick = { fontSize: 11, fill: 'var(--color-text-muted)' } as const;
const tooltipStyle = {
  fontSize: 12,
  fontFamily: 'var(--font-primary)',
  borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
} as const;

function SalesBySite({ siteIds }: { siteIds: SiteId[] }) {
  const data = figuresForSites(siteIds).map((r) => ({
    site: r.site.name,
    current: r.sales,
    prior: r.priorSales,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis dataKey="site" tick={axisTick} interval={0} angle={data.length > 6 ? -28 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 52 : 26} />
        <YAxis tick={axisTick} unit="k" />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${v}k`]} />
        <Bar dataKey="prior" name="Prior week" fill={ACCENT_MID} radius={[3, 3, 0, 0]} opacity={0.45} />
        <Bar dataKey="current" name="This week" fill={ACCENT} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function WasteBySite({ siteIds }: { siteIds: SiteId[] }) {
  const data = figuresForSites(siteIds).map((r) => ({
    site: r.site.name,
    waste: r.waste4wk,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis dataKey="site" tick={axisTick} interval={0} angle={data.length > 6 ? -28 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 52 : 26} />
        <YAxis tick={axisTick} tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Waste (4 wks)']} />
        <Bar dataKey="waste" fill={WARN} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LabourBySite({ siteIds }: { siteIds: SiteId[] }) {
  const data = figuresForSites(siteIds).map((r) => ({
    site: r.site.name,
    labour: r.labourPct,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis dataKey="site" tick={axisTick} interval={0} angle={data.length > 6 ? -28 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 52 : 26} />
        <YAxis tick={axisTick} unit="%" domain={[0, 40]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Labour']} />
        <Bar dataKey="labour" fill={ACCENT} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function GpBySite({ siteIds }: { siteIds: SiteId[] }) {
  const data = figuresForSites(siteIds).map((r) => ({
    site: r.site.name,
    gp: r.gpPct,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis dataKey="site" tick={axisTick} interval={0} angle={data.length > 6 ? -28 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 52 : 26} />
        <YAxis tick={axisTick} unit="%" domain={[55, 80]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'GP']} />
        <Bar dataKey="gp" fill={OK} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SalesTrend({ siteIds }: { siteIds: SiteId[] }) {
  const data = salesTrendForSites(siteIds);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis dataKey="wk" tick={axisTick} />
        <YAxis tick={axisTick} unit="k" domain={['auto', 'auto']} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${v}k`, 'Net sales']} />
        <Line type="monotone" dataKey="sales" stroke={ACCENT} strokeWidth={2.2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function KpiRow({ siteIds }: { siteIds: SiteId[] }) {
  const kpi = kpiSummaryForSites(siteIds);
  const deltaPct = ((kpi.salesK - kpi.priorSalesK) / Math.max(kpi.priorSalesK, 1)) * 100;
  const cards = [
    {
      label: 'Net sales (wk)',
      value: `$${kpi.salesK >= 100 ? Math.round(kpi.salesK) : kpi.salesK}k`,
      delta: `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% vs prior week`,
      good: deltaPct >= 0,
    },
    {
      label: 'Waste (wk)',
      value: `$${kpi.wasteTotal.toLocaleString()}`,
      delta: 'spoilage + comps',
      good: false,
    },
    {
      label: 'Labour % of sales',
      value: `${kpi.labourPct}%`,
      delta: 'target 27%',
      good: kpi.labourPct <= 27,
    },
    {
      label: 'Gross profit',
      value: `${kpi.gpPct}%`,
      delta: 'after transfers',
      good: kpi.gpPct >= 66,
    },
  ];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 10,
        height: '100%',
        alignContent: 'center',
      }}
    >
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 10,
            padding: '12px 14px',
            background: 'var(--color-bg-surface)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>{c.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: '4px 0 2px' }}>
            {c.value}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.good ? OK : 'var(--color-text-muted)' }}>{c.delta}</div>
        </div>
      ))}
    </div>
  );
}

/** The one deliberate exception to per-viewer scoping: a broadcast tile an
 *  admin marks "show company-wide". Same numbers for every viewer. */
function MillionMilestone() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 10,
        padding: '18px 22px',
        background: 'var(--color-bg-nav)',
        color: '#fff',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.75 }}>
        Company record
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>$1.02m net sales this month</div>
      <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85 }}>
        First time past $1m — thank you, every site. Shared with the whole company by head office.
      </div>
    </div>
  );
}

export function renderScopedInsight(id: ScopedInsightId, siteIds: SiteId[]) {
  switch (id) {
    case 'scoped:kpi-row':          return <KpiRow siteIds={siteIds} />;
    case 'scoped:sales-trend':      return <SalesTrend siteIds={siteIds} />;
    case 'scoped:sales-by-site':    return <SalesBySite siteIds={siteIds} />;
    case 'scoped:waste-by-site':    return <WasteBySite siteIds={siteIds} />;
    case 'scoped:labour-by-site':   return <LabourBySite siteIds={siteIds} />;
    case 'scoped:gp-by-site':       return <GpBySite siteIds={siteIds} />;
    case 'scoped:million-milestone': return <MillionMilestone />;
  }
}
