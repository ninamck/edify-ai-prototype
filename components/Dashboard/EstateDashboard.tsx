'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { renderAnalyticsChart, ANALYTICS_CONFIG } from '@/components/Analytics/AnalyticsCharts';
import type { BriefingPhase } from '@/components/briefing';
import DashboardWidget from '@/components/Dashboard/DashboardWidget';
import DashboardEditToolbar from '@/components/Dashboard/DashboardEditToolbar';
import QuinnInsightButton from '@/components/Dashboard/parts/QuinnInsightButton';
import {
  isHalfOnlyChart,
  pinnedChartIdOf,
  widthOf,
  type DashboardLayoutEntry,
  type WidgetWidth,
} from '@/components/Dashboard/layoutTypes';
import { KPI, SALES_TREND } from '@/components/Dashboard/data/estateMockData';
import KpiCard from '@/components/Dashboard/parts/KpiCard';
import SalesTrendChart from '@/components/Dashboard/parts/SalesTrendChart';
import SiteGpChart from '@/components/Dashboard/parts/SiteGpChart';
import WastageChart from '@/components/Dashboard/parts/WastageChart';
import CogsVarianceChart from '@/components/Dashboard/parts/CogsVarianceChart';
import LabourVsSalesChart from '@/components/Dashboard/parts/LabourVsSalesChart';
import ChecklistComplianceCard from '@/components/Dashboard/parts/ChecklistComplianceCard';
import { getChecklistComplianceSummary } from '@/app/checklists/mockData';

function estatePhaseSubtitle(phase: BriefingPhase): string {
  switch (phase) {
    case 'morning':   return 'Morning position · today just getting started';
    case 'midday':    return 'Midday update · trading in flight';
    case 'afternoon': return 'Afternoon position · most of the day in';
    case 'evening':   return 'Evening close · today (near-final)';
  }
}

function labourChartSubtitle(phase: BriefingPhase): string {
  return phase === 'morning'
    ? 'Yesterday · actual vs plan'
    : 'Today so far · actual vs plan';
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        padding: '16px 16px 12px',
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
        minHeight: 0,
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px' }}>{subtitle}</div>
        )}
      </div>
      <div style={{ width: '100%', height: 220 }}>{children}</div>
    </div>
  );
}

export default function EstateDashboard({
  phase,
  layout,
  editing,
  onLayoutChange,
  onToggleEdit,
  onAddInsight,
  onRemovePinned,
  toolbarLeadingControls,
  belowHeader,
  heroGreeting,
}: {
  phase: BriefingPhase;
  layout: DashboardLayoutEntry[];
  editing: boolean;
  onLayoutChange: (next: DashboardLayoutEntry[]) => void;
  onToggleEdit: () => void;
  onAddInsight: () => void;
  onRemovePinned: (chartId: AnalyticsChartId) => void;
  toolbarLeadingControls?: ReactNode;
  belowHeader?: ReactNode;
  /** When provided, render the page header in hero style (large greeting + airy spacing). */
  heroGreeting?: string;
}) {
  const defaultTo = SALES_TREND[SALES_TREND.length - 1].date;
  const defaultFrom = SALES_TREND[Math.max(0, SALES_TREND.length - 14)].date;
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const checklistSummary = useMemo(() => getChecklistComplianceSummary(phase), [phase]);

  const filteredSalesTrend = useMemo(() => {
    return SALES_TREND.filter((p) => {
      if (fromDate && p.date < fromDate) return false;
      if (toDate && p.date > toDate) return false;
      return true;
    });
  }, [fromDate, toDate]);

  const visibleSalesTrend = filteredSalesTrend.length > 0 ? filteredSalesTrend : SALES_TREND;
  const visibleSalesTotal = visibleSalesTrend.reduce((sum, row) => sum + row.sales, 0);
  const periodDays = visibleSalesTrend.length;

  const periodSubtitle = fromDate && toDate
    ? `${fromDate} to ${toDate}`
    : `${periodDays} trading days`;

  const dynamicKpi = KPI.map((k) => {
    if (k.label !== 'Net sales (7d)') return k;
    return {
      ...k,
      label: `Net sales (${periodDays}d)`,
      value: `£${visibleSalesTotal.toFixed(1)}k`,
      deltaLabel: `selected period (${periodSubtitle})`,
    };
  });

  function renderWidget(id: string): ReactNode {
    const pinned = pinnedChartIdOf(id);
    if (pinned) {
      return (
        <div
          style={{
            padding: '14px 16px 10px',
            borderRadius: 12,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            boxShadow: '0 2px 12px rgba(58,48,40,0.07)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11 }}>📌</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', flex: 1, minWidth: 0 }}>
              {ANALYTICS_CONFIG[pinned].label}
            </span>
            <QuinnInsightButton chartId={pinned} text={ANALYTICS_CONFIG[pinned].reasoning} />
          </div>
          {renderAnalyticsChart(pinned)}
        </div>
      );
    }

    switch (id) {
      case 'date-filter':
        return (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'end',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>From</span>
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  fontSize: 12,
                  fontFamily: 'var(--font-primary)',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>To</span>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  fontSize: 12,
                  fontFamily: 'var(--font-primary)',
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setFromDate(defaultFrom);
                setToDate(defaultTo);
              }}
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 8,
                background: 'var(--color-bg-canvas)',
                color: 'var(--color-text-primary)',
                padding: '7px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                height: 32,
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 10,
            }}
          >
            {dynamicKpi.map((k) => (
              <KpiCard key={k.label} {...k} />
            ))}
          </div>
        );

      case 'sales-trend':
        return (
          <ChartCard title="Net sales — estate (£k / day)" subtitle={periodSubtitle}>
            <SalesTrendChart data={visibleSalesTrend} />
          </ChartCard>
        );

      case 'site-gp':
        return (
          <ChartCard title="Gross profit % by site" subtitle="Same period · after transfers">
            <SiteGpChart />
          </ChartCard>
        );

      case 'wastage':
        return (
          <ChartCard title="Wastage value by category" subtitle="£ thousands · spoilage + comps (7d)">
            <WastageChart />
          </ChartCard>
        );

      case 'cogs-variance':
        return (
          <ChartCard title="COGS variance vs theoretical" subtitle="By major line — % over(+) / under(−) recipe cost">
            <CogsVarianceChart />
          </ChartCard>
        );

      case 'labour-vs-sales':
        return (
          <ChartCard title="Labour vs sales — by site" subtitle={`% of net sales · ${labourChartSubtitle(phase)}`}>
            <LabourVsSalesChart />
          </ChartCard>
        );

      case 'checklist-compliance':
        return <ChecklistComplianceCard summary={checklistSummary} />;

      default:
        return null;
    }
  }

  function toggleVisible(id: string) {
    onLayoutChange(
      layout.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e)),
    );
  }

  function toggleWidth(id: string) {
    onLayoutChange(
      layout.map((e) =>
        e.id === id
          ? { ...e, width: (widthOf(e) === 'full' ? 'half' : 'full') as WidgetWidth }
          : e,
      ),
    );
  }

  function removeEntry(id: string) {
    onLayoutChange(layout.filter((e) => e.id !== id));
  }

  const widgetRefs = useRef<Map<string, HTMLElement>>(new Map());

  function handleDragEnd(draggedId: string, dropPoint: { x: number; y: number }) {
    let targetId: string | null = null;
    widgetRefs.current.forEach((el, id) => {
      if (id === draggedId || !el) return;
      const r = el.getBoundingClientRect();
      if (
        dropPoint.x >= r.left &&
        dropPoint.x <= r.right &&
        dropPoint.y >= r.top &&
        dropPoint.y <= r.bottom
      ) {
        targetId = id;
      }
    });
    if (!targetId) return;
    const from = layout.findIndex((e) => e.id === draggedId);
    const to = layout.findIndex((e) => e.id === targetId);
    if (from === -1 || to === -1 || from === to) return;
    const next = layout.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onLayoutChange(next);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: 'var(--font-primary)',
        maxWidth: 1400,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          paddingTop: heroGreeting ? 20 : 0,
          paddingBottom: heroGreeting ? 12 : 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          {heroGreeting ? (
            <>
              <h1
                style={{
                  margin: 0,
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.15,
                }}
              >
                {heroGreeting}
              </h1>
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.4,
                }}
              >
                Fitzroy Espresso estate · {estatePhaseSubtitle(phase)}
              </p>
            </>
          ) : (
            <>
              <h1
                style={{
                  margin: '0 0 4px',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                Estate dashboard
              </h1>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                Dummy data · Fitzroy Espresso estate · {estatePhaseSubtitle(phase)}
              </p>
            </>
          )}
        </div>
        <DashboardEditToolbar
          editing={editing}
          onToggleEdit={onToggleEdit}
          onAddInsight={onAddInsight}
          leadingControls={toolbarLeadingControls}
        />
      </div>

      {belowHeader}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 14,
          gridAutoFlow: 'dense',
        }}
      >
        {(editing ? layout : layout.filter((e) => e.visible)).map((entry) => {
          const pinned = pinnedChartIdOf(entry.id);
          return (
            <div
              key={entry.id}
              ref={(el) => {
                if (el) widgetRefs.current.set(entry.id, el);
                else widgetRefs.current.delete(entry.id);
              }}
              style={{
                gridColumn: `span ${widthOf(entry) === 'full' ? 2 : 1} / span ${widthOf(entry) === 'full' ? 2 : 1}`,
                minWidth: 0,
              }}
            >
              <DashboardWidget
                id={entry.id}
                editing={editing}
                visible={entry.visible}
                width={widthOf(entry)}
                onToggleVisible={() => toggleVisible(entry.id)}
                onToggleWidth={
                  pinned && isHalfOnlyChart(pinned)
                    ? undefined
                    : () => toggleWidth(entry.id)
                }
                onDragEnd={(point) => handleDragEnd(entry.id, point)}
                onRemove={
                  pinned
                    ? () => {
                        onRemovePinned(pinned);
                        removeEntry(entry.id);
                      }
                    : undefined
                }
              >
                {renderWidget(entry.id)}
              </DashboardWidget>
            </div>
          );
        })}
      </div>
    </div>
  );
}
