'use client';

import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  WTD_SPEND,
  currentHourIndexForPhase,
  hourlyTradingForPhase,
  weatherHourlyForPhase,
  deliveriesForPhase,
  wasteForPhase,
} from '@/components/Dashboard/data/managerMockData';
import HourlyCombo from '@/components/Dashboard/parts/HourlyCombo';
import WeatherStrip from '@/components/Dashboard/parts/WeatherStrip';
import DeliveriesCard from '@/components/Dashboard/parts/DeliveriesCard';
import WasteCard from '@/components/Dashboard/parts/WasteCard';
import ShiftKpiRow from '@/components/Dashboard/parts/ShiftKpiRow';
import ChecklistComplianceCard from '@/components/Dashboard/parts/ChecklistComplianceCard';
import { getChecklistComplianceSummary } from '@/app/checklists/mockData';
import type { BriefingPhase } from '@/components/briefing';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { renderAnalyticsChart, ANALYTICS_CONFIG } from '@/components/Analytics/AnalyticsCharts';
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
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
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

export default function ManagerDashboard({
  phase,
  layout,
  editing,
  onLayoutChange,
  onToggleEdit,
  onAddInsight,
  onRemovePinned,
}: {
  phase: BriefingPhase;
  layout: DashboardLayoutEntry[];
  editing: boolean;
  onLayoutChange: (next: DashboardLayoutEntry[]) => void;
  onToggleEdit: () => void;
  onAddInsight: () => void;
  onRemovePinned: (chartId: AnalyticsChartId) => void;
}) {
  const hourlyTrading = useMemo(() => hourlyTradingForPhase(phase), [phase]);
  const weatherHourly = useMemo(() => weatherHourlyForPhase(phase), [phase]);
  const deliveries = useMemo(() => deliveriesForPhase(phase), [phase]);
  const waste = useMemo(() => wasteForPhase(phase), [phase]);
  const checklistSummary = useMemo(() => getChecklistComplianceSummary(phase), [phase]);

  const kpis = useMemo(() => {
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
            <QuinnInsightButton text={ANALYTICS_CONFIG[pinned].reasoning} />
          </div>
          {renderAnalyticsChart(pinned)}
        </div>
      );
    }

    switch (id) {
      case 'shift-kpi':
        return (
          <ShiftKpiRow
            salesSoFar={kpis.salesSoFar}
            forecastToNow={kpis.forecastToNow}
            expectedEod={kpis.expectedEod}
            fullDayForecast={kpis.fullDayForecast}
            asAt={nowHourLabel}
          />
        );
      case 'hourly-combo':
        return (
          <ChartCard
            title="Sales v staff v forecast · hour by hour"
            subtitle="Bars: actual £ (green = ahead of forecast, amber = behind, grey = not yet). Line: forecast £. Right axis: staff headcount — solid for hours worked, dashed for the rest of the roster."
            height={280}
          >
            <HourlyCombo data={hourlyTrading} />
          </ChartCard>
        );
      case 'weather':
        return (
          <ChartCard
            title="Weather · now vs forecast"
            subtitle="Morning & afternoon pattern. Tap either to see the hourly breakdown."
            height={96}
          >
            <WeatherStrip data={weatherHourly} />
          </ChartCard>
        );
      case 'waste':
        return <WasteCard rows={waste} />;
      case 'deliveries':
        return <DeliveriesCard drops={deliveries} wtd={WTD_SPEND} />;
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
    // Find which widget the pointer dropped onto (if any) and swap positions.
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
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Fitzroy Espresso <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>· In shift</span>
          </h1>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            Dummy data · it's {nowHourLabel} · how the day is shaping up so far
          </p>
        </div>
        <DashboardEditToolbar
          editing={editing}
          onToggleEdit={onToggleEdit}
          onAddInsight={onAddInsight}
        />
      </div>

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
