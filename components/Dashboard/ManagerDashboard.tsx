'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { demoCustomer, isDemoBuild } from '@/lib/demoConfig';
import ChageeTrends from '@/components/Dashboard/parts/ChageeTrends';
import DateRangePicker, { type DateRange } from '@/components/Mvp1/DateRangePicker';
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

// ── Custom user pages ─────────────────────────────────────────────────────
// Operators can add their own dashboard pages (like the normal demo). Pages
// are persisted per-browser so a demo build-up survives a reload.
type CustomTab = { id: string; name: string };

const CUSTOM_TABS_STORAGE_KEY = 'edify:manager-custom-tabs';

function genCustomTabId(): string {
  return `md-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function loadStoredCustomTabs(): CustomTab[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t: unknown): t is CustomTab =>
          !!t &&
          typeof t === 'object' &&
          typeof (t as CustomTab).id === 'string' &&
          typeof (t as CustomTab).name === 'string',
      )
      .map((t) => ({ id: t.id, name: t.name }));
  } catch {
    return [];
  }
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
        border: '1px solid #001C35',
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

export default function ManagerDashboard({
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
  const hourlyTrading = useMemo(() => hourlyTradingForPhase(phase), [phase]);
  const weatherHourly = useMemo(() => weatherHourlyForPhase(phase), [phase]);
  const deliveries = useMemo(() => deliveriesForPhase(phase), [phase]);
  const waste = useMemo(() => wasteForPhase(phase), [phase]);
  const checklistSummary = useMemo(() => getChecklistComplianceSummary(phase), [phase]);

  // On a customer demo build the manager dashboard is branded and gets a second
  // "Trends" tab. Internally (pilot / Dunkin shells) it stays a single grid.
  const siteLabel = isDemoBuild ? `${demoCustomer.name} — Flagship` : 'Fitzroy Espresso';
  const showTrendsTab = isDemoBuild;
  // Active tab: 'today', 'trends' (demo only), or a custom page id (md-*).
  const [activeTab, setActiveTab] = useState<string>('today');
  // Cosmetic date scope on the demo build — mirrors the normal demo toolbar.
  const [dateRange, setDateRange] = useState<DateRange>({ kind: 'week' });

  // Custom user-created pages. Hydrated from localStorage after mount to avoid
  // SSR/CSR mismatch, then persisted on change.
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setCustomTabs(loadStoredCustomTabs());
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CUSTOM_TABS_STORAGE_KEY, JSON.stringify(customTabs));
    } catch {
      // localStorage may be unavailable (private mode / quota) — skip silently.
    }
  }, [customTabs]);

  function handleAddCustomTab() {
    const taken = new Set(customTabs.map((t) => t.name.toLowerCase()));
    let name = 'New page';
    let n = 2;
    while (taken.has(name.toLowerCase())) {
      name = `New page ${n++}`;
    }
    const next: CustomTab = { id: genCustomTabId(), name };
    setCustomTabs((prev) => [...prev, next]);
    setActiveTab(next.id);
  }

  function handleRenameCustomTab(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
  }

  function handleRemoveCustomTab(id: string) {
    setCustomTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveTab((prev) => (prev === id ? 'today' : prev));
  }

  const activeCustomTab = customTabs.find((t) => t.id === activeTab) ?? null;

  const pinnedEntries = layout.filter((e) => pinnedChartIdOf(e.id) !== null);
  const visiblePinned = editing ? pinnedEntries : pinnedEntries.filter((e) => e.visible);

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
            border: '1px solid #001C35',
            background: '#fff',
            boxShadow: '0 2px 12px rgba(0, 28, 53,0.07)',
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
            subtitle="Bars: actual £ (cyan = ahead of forecast, pink = behind, sand = not yet). Line: forecast £. Right axis: staff headcount — solid for hours worked, dashed for the rest of the roster."
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

  // Grid of the user's pinned insight charts. Shared by the Trends tab and
  // any custom page so a chart can be added to — and shown on — every view.
  function renderPinnedGrid() {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 14,
          gridAutoFlow: 'dense',
        }}
      >
        {visiblePinned.map((entry) => {
          const pinned = pinnedChartIdOf(entry.id);
          if (!pinned) return null;
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
                onToggleWidth={isHalfOnlyChart(pinned) ? undefined : () => toggleWidth(entry.id)}
                onDragEnd={(point) => handleDragEnd(entry.id, point)}
                onRemove={() => {
                  onRemovePinned(pinned);
                  removeEntry(entry.id);
                }}
              >
                {renderWidget(entry.id)}
              </DashboardWidget>
            </div>
          );
        })}
      </div>
    );
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
                {siteLabel} · it&apos;s {nowHourLabel} · how the day is shaping up so far
              </p>
            </>
          ) : (
            <>
              <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {siteLabel} <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>· In shift</span>
              </h1>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                {isDemoBuild ? 'Replayed service' : 'Dummy data'} · it&apos;s {nowHourLabel} · how the day is shaping up so far
              </p>
            </>
          )}
        </div>
        <DashboardEditToolbar
          editing={editing}
          onToggleEdit={onToggleEdit}
          onAddInsight={onAddInsight}
          leadingControls={
            <>
              {toolbarLeadingControls}
              {isDemoBuild && (
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              )}
            </>
          }
        />
      </div>

      {belowHeader}

      {showTrendsTab && (
        <div
          role="tablist"
          aria-label="Dashboard views"
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            gap: 4,
            padding: 4,
            borderRadius: 999,
            background: 'var(--color-bg-hover)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          {[
            { id: 'today', label: 'Today' },
            { id: 'trends', label: 'Trends' },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                  background: active ? 'var(--color-accent-active)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-muted)',
                  boxShadow: active ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
                }}
              >
                {tab.label}
              </button>
            );
          })}

          {customTabs.map((tab) => (
            <CustomTabPill
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              editing={editing}
              onSelect={() => setActiveTab(tab.id)}
              onRename={(name) => handleRenameCustomTab(tab.id, name)}
              onRemove={() => handleRemoveCustomTab(tab.id)}
            />
          ))}

          <button
            type="button"
            onClick={handleAddCustomTab}
            aria-label="Add page"
            title="Add page"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 999,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-muted)';
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {activeTab === 'trends' ? (
        <>
          <ChageeTrends />
          {visiblePinned.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Pinned insights
                </h2>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  Charts you&apos;ve pinned from Edify appear here.
                </span>
              </div>
              {renderPinnedGrid()}
            </section>
          )}
        </>
      ) : activeCustomTab ? (
        visiblePinned.length === 0 ? (
          <CustomTabEmptyState onAddInsight={onAddInsight} onToggleEdit={onToggleEdit} />
        ) : (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {activeCustomTab.name}
              </h2>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                Charts you&apos;ve pinned from Edify appear here.
              </span>
            </div>
            {renderPinnedGrid()}
          </section>
        )
      ) : (
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
      )}
    </div>
  );
}

// ── Custom page pill (rename on double-click, remove on hover) ──────────────
function CustomTabPill({
  tab,
  active,
  editing,
  onSelect,
  onRename,
  onRemove,
}: {
  tab: CustomTab;
  active: boolean;
  /** When the dashboard is in edit view, expose rename + delete controls. */
  editing: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(tab.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) inputRef.current?.select();
  }, [editingName]);

  // Leaving edit view should also drop any in-progress rename.
  useEffect(() => {
    if (!editing) setEditingName(false);
  }, [editing]);

  function commit() {
    setEditingName(false);
    if (draft.trim() && draft.trim() !== tab.name) onRename(draft);
    else setDraft(tab.name);
  }

  const iconColor = active ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)';

  return (
    <div
      role="tab"
      aria-selected={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: editingName ? '4px 6px 4px 12px' : '8px 8px 8px 16px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
        background: active ? 'var(--color-accent-active)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text-muted)',
        boxShadow: active ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
      }}
    >
      {editingName ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(tab.name);
              setEditingName(false);
            }
          }}
          style={{
            all: 'unset',
            width: Math.max(60, draft.length * 7),
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: active ? '#fff' : 'var(--color-text-primary)',
          }}
        />
      ) : (
        <span onClick={onSelect} onDoubleClick={() => editing && setEditingName(true)}>
          {tab.name}
        </span>
      )}

      {/* Rename + delete only surface in edit view. Rename also works via
          double-click on the label while editing. */}
      {editing && !editingName && (
        <>
          <button
            type="button"
            aria-label={`Rename ${tab.name}`}
            title="Rename page"
            onClick={(e) => {
              e.stopPropagation();
              setDraft(tab.name);
              setEditingName(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: 999,
              border: 'none',
              background: 'transparent',
              color: iconColor,
              cursor: 'pointer',
            }}
          >
            <Pencil size={12} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            aria-label={`Remove ${tab.name}`}
            title="Delete page"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: 999,
              border: 'none',
              background: 'transparent',
              color: iconColor,
              cursor: 'pointer',
            }}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </>
      )}
    </div>
  );
}

function CustomTabEmptyState({
  onAddInsight,
  onToggleEdit,
}: {
  onAddInsight: () => void;
  onToggleEdit: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '64px 24px',
        textAlign: 'center',
        borderRadius: 12,
        border: '1px dashed var(--color-border-subtle)',
        background: 'var(--color-bg-hover)',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        Your page, your insights
      </div>
      <p
        style={{
          margin: 0,
          maxWidth: 460,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-text-muted)',
          lineHeight: 1.5,
        }}
      >
        This page is empty. Use{' '}
        <strong style={{ color: 'var(--color-text-secondary)' }}>Add insight</strong>{' '}
        to drop in a chart, or toggle{' '}
        <strong style={{ color: 'var(--color-text-secondary)' }}>Edit view</strong>{' '}
        to rearrange. Double-click the tab to rename it.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onAddInsight} style={emptyStatePrimaryBtn}>
          Add insight
        </button>
        <button type="button" onClick={onToggleEdit} style={emptyStateSecondaryBtn}>
          Edit view
        </button>
      </div>
    </div>
  );
}

const emptyStatePrimaryBtn: CSSProperties = {
  all: 'unset',
  padding: '8px 14px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  background: 'var(--color-accent-active)',
  color: '#fff',
  boxShadow: '0 2px 8px rgba(34,68,68,0.25)',
};

const emptyStateSecondaryBtn: CSSProperties = {
  all: 'unset',
  padding: '8px 14px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  background: '#fff',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border-subtle)',
};
