'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import Mvp1TopBar from '@/components/Mvp1/Mvp1TopBar';
import HomeUtilityBar from '@/components/Mvp1/HomeUtilityBar';
import DateRangePicker, { type DateRange } from '@/components/Mvp1/DateRangePicker';
import EstateDashboard from '@/components/Dashboard/EstateDashboard';
import ManagerDashboard from '@/components/Dashboard/ManagerDashboard';
import PlaytomicDashboard from '@/components/Dashboard/PlaytomicDashboard';
import DunkinDashboard from '@/components/Dashboard/DunkinDashboard';
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
import { fullSourceQuery, type TableQuery } from '@/components/Mvp1/Tables/query';
import { pinnedChartIdOf, type DashboardLayoutEntry } from '@/components/Dashboard/layoutTypes';
import type { BriefingPhase } from '@/components/briefing';
import { phaseFromHour, timeAwareGreeting } from '@/components/briefing';
import { useDemoBriefingRole } from '@/components/DemoControls/demoStore';
import type { PhaseOverride } from '@/components/PhaseSwitcher';
import { ANALYTICS_CONFIG, type AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useMvp1Tabs } from '@/hooks/useMvp1Tabs';
import MobileShell from '@/components/MobileShell/MobileShell';

const MOBILE_SHELL_BREAKPOINT = '(max-width: 500px)';

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) + '…' : value;
}

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
  /**
   * When set, the AddInsightPopup opens directly into a Quinn-led chat seeded
   * with this starter table. Used by the empty-state "Build manually" card and
   * the per-table "Edit query" pencil. `replacingTableId` triggers an
   * in-place table swap on pin (rather than appending a new card).
   */
  const [tableChatState, setTableChatState] = useState<{
    prompt: string;
    query: TableQuery;
    title?: string;
    targetTabId: string | null;
    replacingTableId?: string;
  } | null>(null);
  /**
   * When set, the TableBuilderModal is open in edit-in-place mode for the
   * given table instance. Saving from the modal swaps the table on its host
   * tab without leaving the current view.
   */
  const [tableBuilderState, setTableBuilderState] = useState<{
    tabId: string;
    tableId: string;
    initialQuery: TableQuery;
    initialTitle?: string;
  } | null>(null);
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
  /**
   * Pin a chart to a specific tab. Used by the AddInsightPopup pin-target
   * dropdown so the user can pick any of their views (dashboard included).
   */
  function pinChartToTarget(chartId: AnalyticsChartId, targetId: string) {
    const target = tabs.find((t) => t.id === targetId);
    if (!target) return;
    if (target.kind === 'dashboard') {
      addPinnedChart(chartId);
      return;
    }
    if (target.charts.some((c) => c.chartId === chartId)) return;
    const newChart: ChartInstance = { id: genChartId(), chartId };
    appendChartToTab(target.id, newChart);
  }

  /**
   * Create a brand-new tables-style view containing this chart. Returns the
   * new tab id so the chat dropdown can mark it as pinned.
   */
  function pinChartToNewView(chartId: AnalyticsChartId): string {
    const cfg = ANALYTICS_CONFIG[chartId];
    const name = cfg?.label ? truncate(cfg.label, 24) : 'View';
    const newId = addTablesTab({
      name,
      tables: [],
    });
    // Append the chart instance after the tab is created.
    appendChartToTab(newId, { id: genChartId(), chartId });
    return newId;
  }

  /** List of pin-target options shown in the chart pin dropdown. */
  const chartPinTargets = tabs.map((t) => ({ id: t.id, label: t.name }));

  /** Default-highlighted target (the currently visible tab). */
  const defaultChartPinTargetId = activeTab.id;

  /**
   * Set of chart IDs already present in whichever view is currently visible.
   * Used to grey out already-pinned chips in the question-library browse view.
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
  const siteName =
    briefingRole === 'dunkin'
      ? "Dunkin'"
      : briefingRole === 'playtomic'
        ? 'Playtomic'
        : 'Fitzroy Espresso';

  function renderDashboardTab() {
    if (briefingRole === 'dunkin') {
      return (
        <DunkinDashboard
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
          siteName={siteName}
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
            padding: '12px clamp(16px, 2.4vw, 32px) 56px',
            gap: 12,
            overflow: 'auto',
            background: 'var(--color-bg-surface)',
          }}
        >
          <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* H1 greeting carries the top-of-page hierarchy. The utility bar
                below it owns the operational chips + Ask Quinn entry point. */}
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

            <HomeUtilityBar
              briefingRole={briefingRole}
              onReceiveDelivery={() => router.push('/receive')}
              onAsk={handleAsk}
            />

            {/* Visual break between the morning ops bar and the dashboard zone */}
            <hr
              aria-hidden="true"
              style={{
                margin: '12px 0 4px',
                border: 0,
                borderTop: '1px solid var(--color-border-subtle)',
              }}
            />

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
                <EditableTabHeading
                  key={activeTab.id}
                  name={activeTab.name}
                  editing={editingTablesView}
                  onCommit={(next) => renameTab(activeTab.id, next)}
                />
                <DashboardEditToolbar
                  editing={editingTablesView}
                  onToggleEdit={() => setEditingTablesView((v) => !v)}
                  onAddInsight={() => setAddInsightOpen(true)}
                  leadingControls={dateControls}
                />
              </div>
              <TablesTab
                key={activeTab.id}
                editing={editingTablesView}
                tables={activeTab.tables.filter(
                  (t) => !t.roleScope || t.roleScope.includes(briefingRole),
                )}
                charts={activeTab.charts}
                defaultFilters={activeTab.id === 'sales-deep-dive' ? [] : undefined}
                onChange={(next) => {
                  // Merge back any tables hidden for this role so toggling the
                  // role pill stays reversible.
                  const hidden = activeTab.tables.filter(
                    (t) => t.roleScope && !t.roleScope.includes(briefingRole),
                  );
                  updateTablesForTab(activeTab.id, [...next, ...hidden]);
                }}
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
                onOpenBuilder={() => {
                  setAddInsightShape('all');
                  setAddInsightTargetTabId(activeTab.id);
                  setTableChatState({
                    prompt: 'Help me build a custom table from scratch.',
                    query: fullSourceQuery('flashReport'),
                    title: 'Custom table',
                    targetTabId: activeTab.id,
                  });
                  setAddInsightOpen(true);
                }}
                onEditQuery={(instance) => {
                  setTableBuilderState({
                    tabId: activeTab.id,
                    tableId: instance.id,
                    initialQuery: instance.query,
                    initialTitle: instance.title,
                  });
                }}
              />
            </div>
          )}
        </div>
      </div>

      <AddInsightPopup
        open={addInsightOpen}
        onClose={() => {
          setAddInsightOpen(false);
          setTableChatState(null);
        }}
        briefingRole={briefingRole}
        onAddToDashboard={addPinnedChart}
        onViewDashboard={() => {
          setAddInsightOpen(false);
          router.push('/mvp-1');
        }}
        alreadyPinned={pinnedInCurrentTarget}
        layout="side-sheet"
        defaultShape={addInsightShape}
        pinTarget="view"
        pinTargets={chartPinTargets}
        defaultPinTargetId={defaultChartPinTargetId}
        onAddChartToTarget={pinChartToTarget}
        onAddChartToNewView={pinChartToNewView}
        autoChatTable={
          tableChatState
            ? {
                prompt: tableChatState.prompt,
                query: tableChatState.query,
                title: tableChatState.title,
              }
            : undefined
        }
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
          const tabId = tableChatState?.targetTabId ?? addInsightTargetTabId ?? activeTab.id;
          const target = tabs.find((t) => t.id === tabId);
          if (!target || target.kind !== 'tables') {
            // No tables-tab to pin to — open as a new view instead.
            const newId = addTablesTab({
              name: truncate(title, 24),
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
          // Edit-query flow: replace the original table in place. We clear the
          // chat state so any subsequent pins in the same chat session add new
          // tables rather than overwriting again.
          if (tableChatState?.replacingTableId) {
            const replacingId = tableChatState.replacingTableId;
            const next = target.tables.map((t) =>
              t.id === replacingId
                ? { ...t, title, query, origin: { kind: 'quinn' as const, prompt } }
                : t,
            );
            updateTablesForTab(tabId, next);
            setTableChatState((prev) => (prev ? { ...prev, replacingTableId: undefined } : prev));
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
        open={tableBuilderState !== null}
        initialQuery={tableBuilderState?.initialQuery}
        initialTitle={tableBuilderState?.initialTitle}
        onClose={() => setTableBuilderState(null)}
        onSave={({ title, query }) => {
          if (!tableBuilderState) return;
          const { tabId, tableId } = tableBuilderState;
          const target = tabs.find((t) => t.id === tabId);
          if (!target || target.kind !== 'tables') {
            setTableBuilderState(null);
            return;
          }
          const next = target.tables.map((t) =>
            t.id === tableId
              ? { ...t, title: title?.trim() ? title : t.title, query }
              : t,
          );
          updateTablesForTab(tabId, next);
          setTableBuilderState(null);
        }}
      />

    </div>
  );
}

/**
 * The active tables-tab heading. Renders as a static h2 outside edit mode and
 * an inline editable input when the tab is in edit mode. Reset by `key` on
 * tab change in the parent so the draft never leaks between tabs.
 */
function EditableTabHeading({
  name,
  editing,
  onCommit,
}: {
  name: string;
  editing: boolean;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(name);

  // Keep the local draft in lock-step with external rename sources.
  useEffect(() => {
    setDraft(name);
  }, [name]);

  if (!editing) {
    return (
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
        }}
      >
        {name}
      </h2>
    );
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== name) onCommit(trimmed);
        else setDraft(name);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(name);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      placeholder="Tab name"
      aria-label="Rename tab"
      style={{
        margin: 0,
        fontFamily: 'var(--font-primary)',
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        padding: '4px 10px',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 8,
        background: '#fff',
        outline: 'none',
        minWidth: 220,
      }}
    />
  );
}
