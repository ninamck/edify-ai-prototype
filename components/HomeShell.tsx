'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from '@/components/Sidebar/Sidebar';
import ShellTopBar from '@/components/ShellTopBar';
import type { ShellViewMode } from '@/components/ShellTopBar';
import EstateDashboard from '@/components/Dashboard/EstateDashboard';
import ManagerDashboard from '@/components/Dashboard/ManagerDashboard';
import PlaytomicDashboard from '@/components/Dashboard/PlaytomicDashboard';
import PlatoDashboard from '@/components/Dashboard/PlatoDashboard';
import CulinaryCollectiveDashboard from '@/components/Dashboard/CulinaryCollective/CulinaryCollectiveDashboard';
import MorningBriefingTimeline from '@/components/Feed/MorningBriefingTimeline';
import BriefingDrawer, { briefingLabelForPhase } from '@/components/Feed/BriefingDrawer';
import NoteForEdifyPopup from '@/components/Feed/NoteForEdifyPopup';
import RightPanelSheetOverlay from '@/components/RightPanel/RightPanelSheetOverlay';
import MobileInsightsBar from '@/components/MobileInsightsBar';
import AddInsightPopup from '@/components/Dashboard/AddInsightPopup';
import DashboardEditToolbar from '@/components/Dashboard/DashboardEditToolbar';
import { pinnedChartIdOf, type DashboardLayoutEntry } from '@/components/Dashboard/layoutTypes';

import FloorActionsBox from '@/components/FloorActionsBox';
import Feed from '@/components/Feed/Feed';
import type { BriefingPhase } from '@/components/briefing';
import { phaseFromHour } from '@/components/briefing';
import { useDemoBriefingRole } from '@/components/DemoControls/demoStore';
import type { PhaseOverride } from '@/components/PhaseSwitcher';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import MobileShell from '@/components/MobileShell/MobileShell';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import Mvp1Tabs from '@/components/Mvp1/Tabs/Mvp1Tabs';
import DateRangePicker, { type DateRange } from '@/components/Mvp1/DateRangePicker';
import TablesTab from '@/components/Mvp1/Tables/TablesTab';
import { useMvp1Tabs, type Mvp1Tab } from '@/hooks/useMvp1Tabs';
import {
  StorePerformanceDashboard,
  FranchiseNetworkDashboard,
} from '@/components/Dashboard/SecondCup/SecondCupViews';
import TemplatesDashboard from '@/components/Dashboard/Templates/TemplatesDashboard';
import { isMultiCurrencyDemo } from '@/lib/demoConfig';

// Starter-templates tab — the out-of-the-box dashboard a new customer sees
// before any customisation. Pinned (kind: 'dashboard') so it can't be
// renamed or removed from the tab strip.
const TEMPLATE_TABS: Mvp1Tab[] = [
  { id: 'starter-templates', name: 'Templates', kind: 'dashboard' },
];

// Extra dashboard tabs for the Second Cup (multi-currency) build only.
// Typed as `kind: 'dashboard'` so the shared tab strip treats them as
// pinned (no rename, no remove); HomeShell resolves them by id.
const SECOND_CUP_TABS: Mvp1Tab[] = [
  { id: 'sc-performance', name: 'Store Performance', kind: 'dashboard' },
  { id: 'sc-network', name: 'Franchise Network', kind: 'dashboard' },
];

// MVP1-seeded views that belong to the /mvp-1 page's demo script — hidden
// from the home tab strip. User-created views still show in both places.
const HIDDEN_MVP1_TAB_IDS = new Set(['flash-report', 'summary-analysis', 'sales-deep-dive']);



const NARROW_BREAKPOINT = '(max-width: 900px)';
const MOBILE_SHELL_BREAKPOINT = '(max-width: 500px)';

export default function HomeShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSite } = useActiveSite();
  const flowParam = searchParams?.get('flow');
  const autoStartFlow = flowParam === 'recipe' || flowParam === 'integrity' ? flowParam : undefined;

  // Strip the ?flow=… param after it's been read so a reload doesn't re-trigger the flow.
  useEffect(() => {
    if (autoStartFlow) router.replace('/');
  }, [autoStartFlow, router]);

  const [shellView, setShellView] = useState<ShellViewMode>('command-centre');
  const briefingRole = useDemoBriefingRole();
  const [mobileInsightsOpen, setMobileInsightsOpen] = useState(false);
  const [chatActive, setChatActive] = useState(false);
  const { layoutByRole, setLayoutForRole, addPinnedChart: addPinned, removePinnedChart: removePinned } = useDashboardLayout();
  const [editingDashboard, setEditingDashboard] = useState(false);
  const [addInsightOpen, setAddInsightOpen] = useState(false);
  const [phaseOverride, setPhaseOverride] = useState<PhaseOverride>('auto');
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ kind: 'week' });
  // Same tab set as the MVP1 shell (shared localStorage state), plus the
  // Second Cup dashboards appended on the multi-currency build.
  const {
    tabs: mvp1Tabs,
    activeId: activeTabId,
    setActiveId: setActiveTabId,
    addTablesTab,
    removeTab,
    renameTab,
    updateTablesForTab,
    updateChartsForTab,
  } = useMvp1Tabs();
  const effectivePhase: BriefingPhase =
    phaseOverride === 'auto' ? phaseFromHour(new Date().getHours()) : phaseOverride;
  const isNarrow = useMediaQuery(NARROW_BREAKPOINT);
  const isMobileShell = useMediaQuery(MOBILE_SHELL_BREAKPOINT);

  useEffect(() => {
    if (!isNarrow) setMobileInsightsOpen(false);
  }, [isNarrow]);

  useEffect(() => {
    if (shellView === 'dashboard') {
      setMobileInsightsOpen(false);
    } else {
      // Leaving the dashboard exits edit mode.
      setEditingDashboard(false);
    }
  }, [shellView]);

  useEffect(() => {
    if (!mobileInsightsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileInsightsOpen]);

  useEffect(() => {
    if (!mobileInsightsOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileInsightsOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileInsightsOpen]);

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

  const visibleMvp1Tabs = mvp1Tabs.filter((t) => !HIDDEN_MVP1_TAB_IDS.has(t.id));
  const allTabs: Mvp1Tab[] = isMultiCurrencyDemo
    ? [...visibleMvp1Tabs, ...TEMPLATE_TABS, ...SECOND_CUP_TABS]
    : [...visibleMvp1Tabs, ...TEMPLATE_TABS];
  // Guard against a stale stored id (e.g. a Second Cup tab id persisted, then
  // the brand switched away) — fall back to the main dashboard.
  const effectiveTabId = allTabs.some((t) => t.id === activeTabId) ? activeTabId : 'dashboard';
  const activeHomeTab = allTabs.find((t) => t.id === effectiveTabId) ?? allTabs[0];
  const dateControls = <DateRangePicker value={dateRange} onChange={setDateRange} />;
  // Same toolbar cluster the main dashboard shows (date range + Add insight +
  // Edit view), reused in the header of every other home tab.
  const tabToolbar = (
    <DashboardEditToolbar
      editing={editingDashboard}
      onToggleEdit={() => setEditingDashboard((v) => !v)}
      onAddInsight={() => setAddInsightOpen(true)}
      leadingControls={dateControls}
    />
  );

  function renderRoleDashboard() {
    if (briefingRole === 'culinary') {
      return (
        <CulinaryCollectiveDashboard
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
    if (briefingRole === 'plato') {
      return (
        <PlatoDashboard
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

  function renderActiveHomeTab() {
    if (effectiveTabId === 'starter-templates') {
      // No TabHeaderRow here — the templates view puts its Daily/Weekly/Period
      // switcher where the title would be, with the shared toolbar beside it.
      return <TemplatesDashboard controls={tabToolbar} />;
    }
    if (effectiveTabId === 'sc-performance') {
      return (
        <>
          <TabHeaderRow title="Store performance — UK estate" controls={tabToolbar} />
          <StorePerformanceDashboard />
        </>
      );
    }
    if (effectiveTabId === 'sc-network') {
      return (
        <>
          <TabHeaderRow title="Franchise network — 150 sites worldwide" controls={tabToolbar} />
          <FranchiseNetworkDashboard />
        </>
      );
    }
    if (activeHomeTab.kind === 'tables') {
      return (
        <>
          <TabHeaderRow title={activeHomeTab.name} controls={tabToolbar} />
          <TablesTab
            tables={activeHomeTab.tables.filter(
              (t) => !t.roleScope || t.roleScope.includes(briefingRole),
            )}
            charts={activeHomeTab.charts}
            defaultFilters={activeHomeTab.id === 'sales-deep-dive' ? [] : undefined}
            onChange={(next) => {
              // Merge back tables hidden for this role so switching the demo
              // role stays reversible (same pattern as the MVP1 shell).
              const hidden = activeHomeTab.tables.filter(
                (t) => t.roleScope && !t.roleScope.includes(briefingRole),
              );
              updateTablesForTab(activeHomeTab.id, [...next, ...hidden]);
            }}
            onChartsChange={(next) => updateChartsForTab(activeHomeTab.id, next)}
          />
        </>
      );
    }
    return renderRoleDashboard();
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
          background: 'var(--color-bg-main, #fff)',
        }}
      >
      <ShellTopBar
        siteName={activeSite.name}
        shellView={shellView}
        onShellViewChange={setShellView}
        phaseOverride={phaseOverride}
        onPhaseOverrideChange={setPhaseOverride}
        briefingLabel={briefingLabelForPhase(effectivePhase).title}
        onOpenBriefing={() => setBriefingOpen(true)}
      />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          background: 'var(--color-bg-main, #fff)',
        }}
      >

        {shellView === 'command-centre' ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Main column: floor actions above Quinn chat */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              {/* Floor actions strip — fades out when chat opens */}
              <AnimatePresence initial={false}>
                {!chatActive && (
                  <motion.div
                    key="floor-actions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      flexShrink: 0,
                      padding: '12px 12px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <FloorActionsBox
                      briefingRole={briefingRole}
                      onReceiveDelivery={() => router.push('/receive')}
                      onNote={() => setNoteOpen(true)}
                    />
                    {isNarrow && (
                      <MobileInsightsBar onOpen={() => setMobileInsightsOpen(true)} />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quinn chat — expands to fill full area when chat is active */}
              <Feed
                briefingRole={briefingRole}
                onChatStateChange={setChatActive}
                onAddToDashboard={addPinnedChart}
                onViewDashboard={() => setShellView('dashboard')}
                autoStartFlow={autoStartFlow}
                enableNoteCapture
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              minHeight: 0,
              padding: 20,
              gap: 12,
              overflow: 'auto',
              background: 'var(--color-bg-surface)',
            }}
          >
            <Mvp1Tabs
              tabs={allTabs}
              activeId={effectiveTabId}
              onSelect={setActiveTabId}
              onAddTablesTab={addTablesTab}
              onRemove={removeTab}
              onRename={renameTab}
            />
            {renderActiveHomeTab()}
          </div>
        )}
      </div>
      </div>

      <BriefingDrawer
        open={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        briefingRole={briefingRole}
        phase={effectivePhase}
      />

      <NoteForEdifyPopup
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        phase={effectivePhase}
      />

      <RightPanelSheetOverlay
        open={mobileInsightsOpen}
        onClose={() => setMobileInsightsOpen(false)}
        title="Timeline"
      >
        <MorningBriefingTimeline briefingRole={briefingRole} phase={effectivePhase} layout="sheet" />
      </RightPanelSheetOverlay>

      <AddInsightPopup
        open={addInsightOpen}
        onClose={() => setAddInsightOpen(false)}
        briefingRole={briefingRole}
        onAddToDashboard={addPinnedChart}
        onViewDashboard={() => setShellView('dashboard')}
        alreadyPinned={new Set(
          currentLayout
            .map((e) => pinnedChartIdOf(e.id))
            .filter((id): id is AnalyticsChartId => id !== null),
        )}
        layout="side-sheet"
      />

    </div>
  );
}

/** Heading + trailing controls (date range) for non-dashboard home tabs. */
function TabHeaderRow({ title, controls }: { title: string; controls: React.ReactNode }) {
  return (
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
        {title}
      </h2>
      {controls}
    </div>
  );
}
