'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { BriefingPhase, BriefingRole } from '@/components/briefing';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import {
  pinnedChartIdOf,
  type DashboardLayoutEntry,
} from '@/components/Dashboard/layoutTypes';
import {
  ANALYTICS_CONFIG,
  renderAnalyticsChart,
} from '@/components/Analytics/AnalyticsCharts';

import {
  KPI,
  SALES_TREND,
  SITE_GP,
  WASTAGE,
  COGS_VAR,
  LABOUR_VS_SALES,
} from '@/components/Dashboard/data/estateMockData';
import {
  WTD_SPEND,
  currentHourIndexForPhase,
  deliveriesForPhase,
  hourlyTradingForPhase,
  wasteForPhase,
  weatherHourlyForPhase,
} from '@/components/Dashboard/data/managerMockData';

import KpiCard from '@/components/Dashboard/parts/KpiCard';
import ShiftKpiRow from '@/components/Dashboard/parts/ShiftKpiRow';
import HourlyCombo from '@/components/Dashboard/parts/HourlyCombo';
import WeatherStrip from '@/components/Dashboard/parts/WeatherStrip';
import DeliveriesCard from '@/components/Dashboard/parts/DeliveriesCard';
import WasteCard from '@/components/Dashboard/parts/WasteCard';
import SalesTrendChart from '@/components/Dashboard/parts/SalesTrendChart';
import SiteGpChart from '@/components/Dashboard/parts/SiteGpChart';
import WastageChart from '@/components/Dashboard/parts/WastageChart';
import CogsVarianceChart from '@/components/Dashboard/parts/CogsVarianceChart';
import LabourVsSalesChart from '@/components/Dashboard/parts/LabourVsSalesChart';

import DashboardTile from './parts/DashboardTile';
import MobileChartFullscreen from './MobileChartFullscreen';

type ChartEntry = {
  title: string;
  subtitle?: string;
  render: ReactNode;
};

export default function MobileDashboard({
  role,
  phase,
}: {
  role: BriefingRole;
  phase: BriefingPhase;
}) {
  const { layoutByRole } = useDashboardLayout();
  const layout = layoutByRole[role];
  const [openChartId, setOpenChartId] = useState<string | null>(null);

  // ── Estate date filter ──────────────────────────────────────────────────
  const defaultTo = SALES_TREND[SALES_TREND.length - 1].date;
  const defaultFrom = SALES_TREND[Math.max(0, SALES_TREND.length - 14)].date;
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const visibleSalesTrend = useMemo(() => {
    const filtered = SALES_TREND.filter((p) => {
      if (fromDate && p.date < fromDate) return false;
      if (toDate && p.date > toDate) return false;
      return true;
    });
    return filtered.length > 0 ? filtered : SALES_TREND;
  }, [fromDate, toDate]);

  const periodDays = visibleSalesTrend.length;
  const visibleSalesTotal = visibleSalesTrend.reduce((sum, r) => sum + r.sales, 0);
  const periodSubtitle =
    fromDate && toDate ? `${fromDate} → ${toDate}` : `${periodDays} trading days`;

  const dynamicKpi = KPI.map((k) =>
    k.label !== 'Net sales (7d)'
      ? k
      : {
          ...k,
          label: `Net sales (${periodDays}d)`,
          value: `£${visibleSalesTotal.toFixed(1)}k`,
          deltaLabel: `selected period`,
        },
  );

  // ── Manager data ────────────────────────────────────────────────────────
  const hourlyTrading = useMemo(() => hourlyTradingForPhase(phase), [phase]);
  const weatherHourly = useMemo(() => weatherHourlyForPhase(phase), [phase]);
  const deliveries = useMemo(() => deliveriesForPhase(phase), [phase]);
  const waste = useMemo(() => wasteForPhase(phase), [phase]);

  const shiftKpis = useMemo(() => {
    let salesSoFar = 0;
    let forecastToNow = 0;
    let forecastRemaining = 0;
    hourlyTrading.forEach((row) => {
      if (row.actual !== null) {
        salesSoFar += row.actual;
        forecastToNow += row.forecast;
      } else {
        forecastRemaining += row.forecast;
      }
    });
    const pace = forecastToNow > 0 ? salesSoFar / forecastToNow : 1;
    const expectedEod = Math.round(salesSoFar + forecastRemaining * pace);
    const fullDayForecast = Math.round(forecastToNow + forecastRemaining);
    return {
      salesSoFar: Math.round(salesSoFar),
      forecastToNow: Math.round(forecastToNow),
      expectedEod,
      fullDayForecast,
    };
  }, [hourlyTrading]);

  const nowHourLabel = hourlyTrading[currentHourIndexForPhase(phase)]?.hour ?? '11am';

  // ── Chart registry for the fullscreen overlay ───────────────────────────
  const chartRegistry: Record<string, ChartEntry> = {
    'sales-trend': {
      title: 'Net sales — estate',
      subtitle: periodSubtitle,
      render: <SalesTrendChart data={visibleSalesTrend} />,
    },
    'site-gp': {
      title: 'Gross profit % by site',
      subtitle: 'Same period · after transfers',
      render: <SiteGpChart />,
    },
    wastage: {
      title: 'Wastage by category',
      subtitle: '£ thousands · spoilage + comps (7d)',
      render: <WastageChart />,
    },
    'cogs-variance': {
      title: 'COGS variance vs theoretical',
      subtitle: 'By major line',
      render: <CogsVarianceChart />,
    },
    'labour-vs-sales': {
      title: 'Labour vs sales',
      subtitle: '% of net sales · by site',
      render: <LabourVsSalesChart />,
    },
    'hourly-combo': {
      title: 'Sales v staff v forecast',
      subtitle: 'Hour by hour',
      render: <HourlyCombo data={hourlyTrading} />,
    },
    waste: {
      title: "Today's waste",
      subtitle: `As at ${nowHourLabel}`,
      render: <WasteCard rows={waste} />,
    },
  };

  // ── Per-entry rendering ─────────────────────────────────────────────────
  function renderEntry(entry: DashboardLayoutEntry): ReactNode {
    if (!entry.visible) return null;
    const pinned = pinnedChartIdOf(entry.id);
    if (pinned) {
      return (
        <div
          style={{
            padding: '12px 14px 10px',
            borderRadius: 12,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            boxShadow: '0 2px 8px rgba(58,48,40,0.06)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>
            📌 {ANALYTICS_CONFIG[pinned].label}
          </div>
          {renderAnalyticsChart(pinned)}
        </div>
      );
    }

    switch (entry.id) {
      case 'date-filter':
        return (
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)' }}>FROM</span>
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
                style={dateInputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)' }}>TO</span>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                style={dateInputStyle}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setFromDate(defaultFrom);
                setToDate(defaultTo);
              }}
              style={{
                alignSelf: 'flex-end',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 6,
                background: 'var(--color-bg-canvas)',
                color: 'var(--color-text-primary)',
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                height: 28,
              }}
            >
              Reset
            </button>
          </div>
        );

      case 'kpi-grid':
        return (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {dynamicKpi.map((k) => (
              <KpiCard key={k.label} {...k} />
            ))}
          </div>
        );

      case 'sales-trend': {
        const sparkline = visibleSalesTrend.map((p) => p.sales);
        const first = sparkline[0] ?? 0;
        const last = sparkline[sparkline.length - 1] ?? 0;
        const diffPct = first > 0 ? ((last - first) / first) * 100 : 0;
        return (
          <DashboardTile
            label="Net sales"
            value={`£${visibleSalesTotal.toFixed(1)}k`}
            delta={`${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%`}
            deltaLabel={periodSubtitle}
            trend={diffPct >= 0 ? 'positive' : 'negative'}
            sparkline={sparkline}
            onTap={() => setOpenChartId('sales-trend')}
          />
        );
      }

      case 'site-gp': {
        const avg = SITE_GP.reduce((s, r) => s + r.gp, 0) / SITE_GP.length;
        const top = [...SITE_GP].sort((a, b) => b.gp - a.gp)[0];
        return (
          <DashboardTile
            label="Gross profit by site"
            value={`${avg.toFixed(1)}%`}
            delta={`Best: ${top.site} ${top.gp}%`}
            deltaLabel={`${SITE_GP.length} sites`}
            trend="neutral"
            sparkline={SITE_GP.map((r) => r.gp)}
            onTap={() => setOpenChartId('site-gp')}
          />
        );
      }

      case 'wastage': {
        const totalK = WASTAGE.reduce((s, r) => s + r.k, 0);
        return (
          <DashboardTile
            label="Wastage (7d)"
            value={`£${(totalK * 1000).toFixed(0)}`}
            delta="−0.2pp vs LW"
            deltaLabel="of net sales"
            trend="positive"
            sparkline={WASTAGE.map((r) => r.k)}
            onTap={() => setOpenChartId('wastage')}
          />
        );
      }

      case 'cogs-variance': {
        const avg = COGS_VAR.reduce((s, r) => s + r.var, 0) / COGS_VAR.length;
        return (
          <DashboardTile
            label="COGS variance"
            value={`${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%`}
            delta={avg > 1.5 ? 'Unfavourable' : 'Within range'}
            deltaLabel="vs theoretical"
            trend={avg > 1.5 ? 'negative' : 'neutral'}
            sparkline={COGS_VAR.map((r) => r.var)}
            onTap={() => setOpenChartId('cogs-variance')}
          />
        );
      }

      case 'labour-vs-sales': {
        const avgActual = LABOUR_VS_SALES.reduce((s, r) => s + r.actual, 0) / LABOUR_VS_SALES.length;
        const avgPlan = LABOUR_VS_SALES.reduce((s, r) => s + r.plan, 0) / LABOUR_VS_SALES.length;
        const gap = avgActual - avgPlan;
        return (
          <DashboardTile
            label="Labour % sales"
            value={`${avgActual.toFixed(1)}%`}
            delta={`${gap >= 0 ? '+' : ''}${gap.toFixed(1)}pp vs plan`}
            deltaLabel="estate avg"
            trend={gap > 0 ? 'negative' : 'positive'}
            sparkline={LABOUR_VS_SALES.map((r) => r.actual)}
            onTap={() => setOpenChartId('labour-vs-sales')}
          />
        );
      }

      case 'shift-kpi':
        return (
          <ShiftKpiRow
            salesSoFar={shiftKpis.salesSoFar}
            forecastToNow={shiftKpis.forecastToNow}
            expectedEod={shiftKpis.expectedEod}
            fullDayForecast={shiftKpis.fullDayForecast}
            asAt={nowHourLabel}
          />
        );

      case 'hourly-combo': {
        const actualOnly = hourlyTrading
          .filter((r) => r.actual !== null)
          .map((r) => r.actual as number);
        const pace =
          shiftKpis.forecastToNow > 0 ? shiftKpis.salesSoFar / shiftKpis.forecastToNow : 1;
        const paceDelta = (pace - 1) * 100;
        return (
          <DashboardTile
            label={`Sales vs forecast · as at ${nowHourLabel}`}
            value={`£${shiftKpis.salesSoFar.toLocaleString()}`}
            delta={`${paceDelta >= 0 ? '+' : ''}${paceDelta.toFixed(1)}%`}
            deltaLabel="vs forecast to now"
            trend={paceDelta >= 0 ? 'positive' : 'negative'}
            sparkline={actualOnly.length > 1 ? actualOnly : undefined}
            onTap={() => setOpenChartId('hourly-combo')}
          />
        );
      }

      case 'weather':
        return (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              boxShadow: '0 2px 8px rgba(58,48,40,0.06)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                marginBottom: 8,
              }}
            >
              Weather · now vs forecast
            </div>
            <WeatherStrip data={weatherHourly} />
          </div>
        );

      case 'waste': {
        const totalSpend = waste.reduce((s, r) => s + r.spendToday, 0);
        const typicalSpend = waste.reduce((s, r) => s + r.spendTypical, 0);
        const diff = totalSpend - typicalSpend;
        return (
          <DashboardTile
            label={`Waste · as at ${nowHourLabel}`}
            value={`£${totalSpend}`}
            delta={`${diff >= 0 ? '+' : '−'}£${Math.abs(diff)} vs typical`}
            deltaLabel={`${waste.length} items`}
            trend={diff > 5 ? 'negative' : diff < 0 ? 'positive' : 'neutral'}
            sparkline={waste.map((r) => r.spendToday)}
            onTap={() => setOpenChartId('waste')}
          />
        );
      }

      case 'deliveries':
        return <DeliveriesCard drops={deliveries} wtd={WTD_SPEND} />;

      default:
        return null;
    }
  }

  const openChart = openChartId ? chartRegistry[openChartId] : null;

  return (
    <>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 14,
          paddingBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'var(--color-bg-surface)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 2,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            {role === 'cheryl' ? 'Estate dashboard' : 'In-shift dashboard'}
          </h1>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {role === 'cheryl' ? 'Dummy data' : `as at ${nowHourLabel}`}
          </span>
        </div>

        {layout.map((entry) => {
          const rendered = renderEntry(entry);
          if (!rendered) return null;
          return <div key={entry.id}>{rendered}</div>;
        })}
      </div>

      <MobileChartFullscreen
        open={openChart !== null}
        onClose={() => setOpenChartId(null)}
        title={openChart?.title ?? ''}
        subtitle={openChart?.subtitle}
      >
        {openChart?.render}
      </MobileChartFullscreen>
    </>
  );
}

const dateInputStyle = {
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 6,
  padding: '5px 6px',
  fontSize: 12,
  fontFamily: 'var(--font-primary)',
  minWidth: 0,
  width: '100%',
};
