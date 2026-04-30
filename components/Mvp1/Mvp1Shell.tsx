'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import Mvp1TopBar from '@/components/Mvp1/Mvp1TopBar';
import AskQuinnBar from '@/components/Mvp1/AskQuinnBar';
import DateRangePicker, { type DateRange } from '@/components/Mvp1/DateRangePicker';
import EstateDashboard from '@/components/Dashboard/EstateDashboard';
import ManagerDashboard from '@/components/Dashboard/ManagerDashboard';
import PlaytomicDashboard from '@/components/Dashboard/PlaytomicDashboard';
import AddInsightPopup from '@/components/Dashboard/AddInsightPopup';
import DashboardEditToolbar from '@/components/Dashboard/DashboardEditToolbar';
import Mvp1Tabs from '@/components/Mvp1/Tabs/Mvp1Tabs';
import TablesTab, {
  genChartId,
  genTableId,
  type ChartInstance,
  type TableInstance,
} from '@/components/Mvp1/Tables/TablesTab';
import TableBuilderModal from '@/components/Mvp1/Tables/TableBuilderModal';
import type { TableQuery } from '@/components/Mvp1/Tables/query';
import { pinnedChartIdOf, type DashboardLayoutEntry } from '@/components/Dashboard/layoutTypes';
import type { BriefingPhase } from '@/components/briefing';
import { phaseFromHour, timeAwareGreeting } from '@/components/briefing';
import { useDemoBriefingRole } from '@/components/DemoControls/demoStore';
import type { PhaseOverride } from '@/components/PhaseSwitcher';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useMvp1Tabs } from '@/hooks/useMvp1Tabs';
import MobileShell from '@/components/MobileShell/MobileShell';

const MOBILE_SHELL_BREAKPOINT = '(max-width: 500px)';

export default function Mvp1Shell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const briefingRole = useDemoBriefingRole();
  const { layoutByRole, setLayoutForRole, addPinnedChart: addPinned, removePinnedChart: removePinned } = useDashboardLayout();
  const [editingDashboard, setEditingDashboard] = useState(false);
  const [editingTablesView, setEditingTablesView] = useState(false);
  const [addInsightOpen, setAddInsightOpen] = useState(false);
  const [addInsightShape, setAddInsightShape] = useState<'all' | 'chart' | 'table'>('all');
  const [addInsightTargetTabId, setAddInsightTargetTabId] = useState<string | null>(null);
  const [phaseOverride, setPhaseOverride] = useState<PhaseOverride>('auto');
  const [dateRange, setDateRange] = useState<DateRange>('week');
  const [builderState, setBuilderState] = useState<{
    open: boolean;
    initialQuery?: TableQuery;
    initialTitle?: string;
    targetTabId: string | null;
    replacingTableId?: string;
  }>({ open: false, targetTabId: null });
  const {
    tabs,
    activeId,
    activeTab,
    setActiveId,
    addTablesTab,
    removeTab,
    renameTab,
    updateTablesForTab,
    updateChartsForTab,
    appendChartToTab,
  } = useMvp1Tabs();

  const effectivePhase: BriefingPhase =
    phaseOverride === 'auto' ? phaseFromHour(new Date().getHours()) : phaseOverride;
  const isMobileShell = useMediaQuery(MOBILE_SHELL_BREAKPOINT);

  // ?build=table opens the Tables-filtered Add insight popup pointed at the
  // first available tables tab (or creates one if there isn't one yet). The
  // param is consumed once and then cleared.
  const handledBuildParamRef = useRef(false);
  useEffect(() => {
    if (handledBuildParamRef.current) return;
    if (searchParams?.get('build') !== 'table') return;
    handledBuildParamRef.current = true;
    let targetTab = tabs.find((t) => t.kind === 'tables');
    if (!targetTab) {
      const newId = addTablesTab();
      targetTab = { id: newId, name: 'View', kind: 'tables', tables: [], charts: [] };
    }
    setActiveId(targetTab.id);
    setAddInsightShape('table');
    setAddInsightTargetTabId(targetTab.id);
    setAddInsightOpen(true);
    // Clear the query param so refresh doesn't re-trigger.
    router.replace('/mvp-1');
  }, [searchParams, tabs, addTablesTab, setActiveId, router]);

  if (isMobileShell) {
    return <MobileShell />;
  }

  const currentLayout = layoutByRole[briefingRole] ?? [];

  function updateCurrentLayout(next: DashboardLayoutEntry[]) {
    setLayoutForRole(briefingRole, next);
  }

  function addPinnedChart(id: AnalyticsChartId) {
    addPinned(briefingRole, id);
  }

  function removePinnedChart(id: AnalyticsChartId) {
    removePinned(briefingRole, id);
  }

  /**
   * "Pin to current view" from a chat reply. When the active tab is the
   * dashboard, we pin to the role's dashboard layout (legacy behaviour). When
   * the active tab is a tables-style view, we append a ChartInstance to that
   * view so it renders alongside the user's tables.
   */
  function pinChartToCurrentView(chartId: AnalyticsChartId) {
    if (activeTab.kind === 'dashboard') {
      addPinnedChart(chartId);
      return;
    }
    if (activeTab.charts.some((c) => c.chartId === chartId)) return;
    const newChart: ChartInstance = { id: genChartId(), chartId };
    appendChartToTab(activeTab.id, newChart);
  }

  /**
   * Set of chart IDs already present in whichever view we'd currently pin to,
   * so the AddInsightPopup can disable already-pinned chips.
   */
  const pinnedInCurrentTarget: Set<AnalyticsChartId> =
    activeTab.kind === 'dashboard'
      ? new Set(
          currentLayout
            .map((e) => pinnedChartIdOf(e.id))
            .filter((id): id is AnalyticsChartId => id !== null),
        )
      : new Set(activeTab.charts.map((c) => c.chartId));

  // TODO(mvp1): seed AddInsightPopup chat with the clicked suggestion text.
  function handleAsk(_seed?: string) {
    setAddInsightOpen(true);
  }

  const greeting = timeAwareGreeting(briefingRole);
  const dateControls = <DateRangePicker value={dateRange} onChange={setDateRange} />;

  function renderDashboardTab() {
    if (briefingRole === 'playtomic') {
      return (
        <PlaytomicDashboard
          layout={currentLayout}
          editing={editingDashboard}
          onLayoutChange={updateCurrentLayout}
          onToggleEdit={() => setEditingDashboard((v) => !v)}
          onAddInsight={() => setAddInsightOpen(true)}
          onRemovePinned={removePinnedChart}
          toolbarLeadingControls={dateControls}
        />
      );
    }
    if (briefingRole === 'cheryl') {
      return (
        <EstateDashboard
          phase={effectivePhase}
          layout={currentLayout}
          editing={editingDashboard}
          onLayoutChange={updateCurrentLayout}
          onToggleEdit={() => setEditingDashboard((v) => !v)}
          onAddInsight={() => setAddInsightOpen(true)}
          onRemovePinned={removePinnedChart}
          toolbarLeadingControls={dateControls}
        />
      );
    }
    return (
      <ManagerDashboard
        phase={effectivePhase}
        layout={currentLayout}
        editing={editingDashboard}
        onLayoutChange={updateCurrentLayout}
        onToggleEdit={() => setEditingDashboard((v) => !v)}
        onAddInsight={() => setAddInsightOpen(true)}
        onRemovePinned={removePinnedChart}
        toolbarLeadingControls={dateControls}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <Mvp1TopBar
          siteName="Fitzroy Espresso"
          phaseOverride={phaseOverride}
          onPhaseOverrideChange={setPhaseOverride}
        />

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            padding: 12,
            gap: 12,
            overflow: 'auto',
            background: 'var(--color-bg-surface)',
          }}
        >
          <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ paddingTop: 20, paddingBottom: 4 }}>
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
                {greeting}
              </h1>
            </div>

            <AskQuinnBar onAsk={handleAsk} />

            <Mvp1Tabs
              tabs={tabs}
              activeId={activeId}
              onSelect={setActiveId}
              onAddTablesTab={addTablesTab}
              onRemove={removeTab}
              onRename={renameTab}
            />
          </div>

          {activeTab.kind === 'dashboard' ? (
            renderDashboardTab()
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                maxWidth: 1400,
                margin: '0 auto',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {activeTab.name}
                </h2>
                <DashboardEditToolbar
                  editing={editingTablesView}
                  onToggleEdit={() => setEditingTablesView((v) => !v)}
                  onAddInsight={() => setAddInsightOpen(true)}
                  leadingControls={dateControls}
                />
              </div>
              <TablesTab
                tables={activeTab.tables}
                charts={activeTab.charts}
                onChange={(next) => updateTablesForTab(activeTab.id, next)}
                onChartsChange={(next) => updateChartsForTab(activeTab.id, next)}
                onAskQuinn={() => {
                  setAddInsightShape('all');
                  setAddInsightTargetTabId(activeTab.id);
                  setAddInsightOpen(true);
                }}
                onBrowseLibrary={() => {
                  setAddInsightShape('table');
                  setAddInsightTargetTabId(activeTab.id);
                  setAddInsightOpen(true);
                }}
                onOpenBuilder={() =>
                  setBuilderState({
                    open: true,
                    initialQuery: undefined,
                    initialTitle: undefined,
                    targetTabId: activeTab.id,
                  })
                }
                onEditQuery={(instance) =>
                  setBuilderState({
                    open: true,
                    initialQuery: instance.query,
                    initialTitle: instance.title,
                    targetTabId: activeTab.id,
                    replacingTableId: instance.id,
                  })
                }
              />
            </div>
          )}
        </div>
      </div>

      <AddInsightPopup
        open={addInsightOpen}
        onClose={() => setAddInsightOpen(false)}
        briefingRole={briefingRole}
        onAddToDashboard={pinChartToCurrentView}
        onViewDashboard={() => {
          setAddInsightOpen(false);
          router.push('/mvp-1');
        }}
        alreadyPinned={pinnedInCurrentTarget}
        layout="side-sheet"
        defaultShape={addInsightShape}
        pinTarget="view"
        onPickTable={(entry, tableQuery) => {
          const tabId = addInsightTargetTabId ?? activeTab.id;
          const target = tabs.find((t) => t.id === tabId);
          if (!target || target.kind !== 'tables') return;
          const newInstance: TableInstance = {
            id: genTableId(),
            title: entry.text,
            query: tableQuery,
            origin: { kind: 'preset', questionId: entry.id, questionText: entry.text },
          };
          updateTablesForTab(tabId, [...target.tables, newInstance]);
          setActiveId(tabId);
          setAddInsightOpen(false);
        }}
        onPinTable={({ title, query, prompt }) => {
          const tabId = addInsightTargetTabId ?? activeTab.id;
          const target = tabs.find((t) => t.id === tabId);
          if (!target || target.kind !== 'tables') {
            // No tables-tab to pin to — open as a new view instead.
            const newId = addTablesTab({
              name: title.length > 24 ? title.slice(0, 24) + '…' : title,
              tables: [
                {
                  id: genTableId(),
                  title,
                  query,
                  origin: { kind: 'quinn', prompt },
                },
              ],
            });
            setActiveId(newId);
            return;
          }
          const newInstance: TableInstance = {
            id: genTableId(),
            title,
            query,
            origin: { kind: 'quinn', prompt },
          };
          updateTablesForTab(tabId, [...target.tables, newInstance]);
        }}
        onOpenTableInNewView={({ title, query, prompt }) => {
          const newId = addTablesTab({
            name: title.length > 24 ? title.slice(0, 24) + '…' : title,
            tables: [
              {
                id: genTableId(),
                title,
                query,
                origin: { kind: 'quinn', prompt },
              },
            ],
          });
          setActiveId(newId);
        }}
      />

      <TableBuilderModal
        open={builderState.open}
        initialQuery={builderState.initialQuery}
        initialTitle={builderState.initialTitle}
        onClose={() => setBuilderState({ open: false, targetTabId: null })}
        onSave={({ title, query }) => {
          const tabId = builderState.targetTabId ?? activeTab.id;
          const targetTab = tabs.find((t) => t.id === tabId);
          if (!targetTab || targetTab.kind !== 'tables') return;
          if (builderState.replacingTableId) {
            const next = targetTab.tables.map((t) =>
              t.id === builderState.replacingTableId ? { ...t, title, query } : t,
            );
            updateTablesForTab(tabId, next);
          } else {
            const newInstance: TableInstance = {
              id: genTableId(),
              title,
              query,
              origin: { kind: 'manual' },
            };
            updateTablesForTab(tabId, [...targetTab.tables, newInstance]);
          }
        }}
      />
    </div>
  );
}
