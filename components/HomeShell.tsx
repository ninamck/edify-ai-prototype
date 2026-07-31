'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Radio } from 'lucide-react';
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
import TablesTab, { genChartId, genTableId } from '@/components/Mvp1/Tables/TablesTab';
import { useMvp1Tabs, type Mvp1Tab } from '@/hooks/useMvp1Tabs';
import {
  StorePerformanceDashboard,
  FranchiseNetworkDashboard,
} from '@/components/Dashboard/SecondCup/SecondCupViews';
import TemplatesDashboard from '@/components/Dashboard/Templates/TemplatesDashboard';
import { isMultiCurrencyDemo } from '@/lib/demoConfig';
import RolesDashboardTab from '@/components/Dashboard/permissions/RolesDashboardTab';
import PublishedOverviewDialog from '@/components/Dashboard/permissions/PublishedOverviewDialog';
import PublishDialog from '@/components/Dashboard/permissions/PublishDialog';
import AdminToolsMenu from '@/components/Dashboard/permissions/AdminToolsMenu';
import { ViewAsBanner } from '@/components/Dashboard/permissions/ViewAsControl';
import { isRolesPersona } from '@/components/Dashboard/permissions/sites';
import {
  canCreateDashboards,
  canEditDashboard,
  visibleDashboards,
  type Audience,
  type DemoDashboard,
} from '@/components/Dashboard/permissions/model';
import {
  addInsight as addRolesInsight,
  createDashboard as createRolesDashboard,
  hydrateDashboards,
  unpublishDashboard,
  useDemoDashboards,
} from '@/components/Dashboard/permissions/dashboardStore';
import { effectiveViewer, useViewAs } from '@/components/Dashboard/permissions/viewAsStore';

/** Home-tab ids for roles-model dashboards are namespaced to avoid clashing
 *  with MVP1 view ids ('roles:company', 'roles:pub-weekend', …). */
const ROLES_TAB_PREFIX = 'roles:';

// Starter-templates tab — the out-of-the-box dashboard a new customer sees
// before any customisation. Pinned (kind: 'dashboard') so it can't be
// renamed or removed from the tab strip.
const TEMPLATE_TABS: Mvp1Tab[] = [
  { id: 'starter-templates', name: 'Templates', kind: 'dashboard' },
];

// Who can see the Templates dashboard (roles demo). `null` = the default:
// everyone at the company. An admin can narrow it to role-at-sites via the
// same audience picker the roles dashboards use; the choice persists and the
// Templates tab disappears for personas outside the audience.
const TEMPLATES_AUDIENCE_KEY = 'edify:templatesAudience:v1';

function loadTemplatesAudience(): Audience | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TEMPLATES_AUDIENCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.roles) && Array.isArray(parsed.siteIds)) {
      return parsed as Audience;
    }
    return null;
  } catch {
    return null;
  }
}

function persistTemplatesAudience(audience: Audience | null) {
  if (typeof window === 'undefined') return;
  try {
    if (audience) window.localStorage.setItem(TEMPLATES_AUDIENCE_KEY, JSON.stringify(audience));
    else window.localStorage.removeItem(TEMPLATES_AUDIENCE_KEY);
  } catch {
    /* ignore quota errors */
  }
}

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
  const [publishedOverviewOpen, setPublishedOverviewOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ kind: 'this_week' });
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
    appendTableToTab,
    appendChartToTab,
  } = useMvp1Tabs();
  // When the insight popup is opened from a view's empty state ("Ask Edify" /
  // "Pick a question"), picked charts and tables land in that view rather
  // than on the role dashboard.
  const [addInsightViewTabId, setAddInsightViewTabId] = useState<string | null>(null);
  const effectivePhase: BriefingPhase =
    phaseOverride === 'auto' ? phaseFromHour(new Date().getHours()) : phaseOverride;
  const isNarrow = useMediaQuery(NARROW_BREAKPOINT);
  const isMobileShell = useMediaQuery(MOBILE_SHELL_BREAKPOINT);

  // Roles & permissions demo (Admin / Manager / Employee personas): the
  // roles-model dashboards join the home tab strip alongside the original
  // role dashboard, and chat pins offer a "Pin to…" destination picker over
  // the dashboards this viewer can edit (plus the original Dashboard tab).
  const rolesDashboards = useDemoDashboards();
  const rolesViewAs = useViewAs();
  const rolesPersona = isRolesPersona(briefingRole) ? briefingRole : null;
  const rolesViewer = rolesPersona ? effectiveViewer(rolesPersona, rolesViewAs) : null;
  useEffect(() => {
    hydrateDashboards();
  }, []);

  // Templates audience (roles demo): null = everyone at the company.
  const [templatesAudience, setTemplatesAudience] = useState<Audience | null>(null);
  const [templatesAudienceOpen, setTemplatesAudienceOpen] = useState(false);
  useEffect(() => {
    setTemplatesAudience(loadTemplatesAudience());
  }, []);
  function updateTemplatesAudience(next: Audience | null) {
    setTemplatesAudience(next);
    persistTemplatesAudience(next);
  }
  // Synthetic dashboard so the shared publish dialog and summary line can
  // describe the Templates tab without it living in the roles store. Kind
  // 'company' because it shares those semantics: no audience = everyone, so
  // the dialog opens with the full selection ticked.
  const templatesStub: DemoDashboard = {
    id: 'starter-templates',
    kind: 'company',
    name: 'Templates',
    owner: 'cheryl',
    audience: templatesAudience,
    insights: [],
  };
  // Enforce the audience for the non-admin roles personas: outside it, the
  // Templates tab simply isn't there. Admins and non-roles personas always
  // see it.
  const canSeeTemplates =
    !rolesViewer ||
    rolesViewer.role === 'admin' ||
    !templatesAudience ||
    (templatesAudience.roles.includes(rolesViewer.role as Audience['roles'][number]) &&
      templatesAudience.siteIds.some((s) => rolesViewer.siteIds.includes(s)));
  const rolesVisibleDashboards = rolesViewer
    ? visibleDashboards(rolesViewer, rolesDashboards)
    : [];
  const rolesTabs: Mvp1Tab[] = rolesVisibleDashboards.map((d) => ({
    id: `${ROLES_TAB_PREFIX}${d.id}`,
    name: d.name,
    kind: 'dashboard',
  }));
  /** Chat-pin destination for the original role dashboard (layout-based). */
  const LEGACY_PIN_TARGET_ID = 'legacy-dashboard';
  const rolesPinTargets = (() => {
    if (!rolesViewer) return undefined;
    const editable = rolesVisibleDashboards
      .filter((d) => canEditDashboard(rolesViewer, d))
      .map((d) => ({
        id: d.id,
        label: d.name,
      }));
    if (editable.length === 0) return undefined; // employees keep the plain pin button
    return [{ id: LEGACY_PIN_TARGET_ID, label: 'Dashboard' }, ...editable];
  })();

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
  const templateTabs = canSeeTemplates ? TEMPLATE_TABS : [];
  const baseTabs: Mvp1Tab[] = isMultiCurrencyDemo
    ? [...visibleMvp1Tabs, ...templateTabs, ...SECOND_CUP_TABS]
    : [...visibleMvp1Tabs, ...templateTabs];
  // Roles personas: the roles-model dashboards slot in right after the
  // original Dashboard tab. During a "View as" preview only the previewed
  // viewer's dashboards show — that's exactly what they'd see.
  const allTabs: Mvp1Tab[] = !rolesPersona
    ? baseTabs
    : rolesViewer?.previewing
      ? rolesTabs
      : [
          ...baseTabs.filter((t) => t.id === 'dashboard'),
          ...rolesTabs,
          ...baseTabs.filter((t) => t.id !== 'dashboard'),
        ];
  // Guard against a stale stored id (e.g. a Second Cup tab id persisted, then
  // the brand switched away) — fall back to the main dashboard, or the first
  // available tab when the Dashboard tab itself is hidden (view-as preview).
  const fallbackTabId = allTabs.some((t) => t.id === 'dashboard')
    ? 'dashboard'
    : (allTabs[0]?.id ?? 'dashboard');
  const effectiveTabId = allTabs.some((t) => t.id === activeTabId) ? activeTabId : fallbackTabId;
  const activeHomeTab = allTabs.find((t) => t.id === effectiveTabId) ?? allTabs[0];
  const dateControls = <DateRangePicker value={dateRange} onChange={setDateRange} />;
  // Workspace-level admin tools ("All published" governance overview and
  // "View as" preview), collapsed into one dropdown. They operate across
  // every dashboard, so they sit on the tab-strip row rather than inside any
  // single dashboard's toolbar.
  const adminDashboardControls =
    rolesViewer?.role === 'admin' && !rolesViewer.previewing ? (
      <AdminToolsMenu onOpenPublishedOverview={() => setPublishedOverviewOpen(true)} />
    ) : null;
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
    if (rolesPersona && effectiveTabId.startsWith(ROLES_TAB_PREFIX)) {
      return (
        <RolesDashboardTab
          briefingRole={rolesPersona}
          dashboardId={effectiveTabId.slice(ROLES_TAB_PREFIX.length)}
          onSelectDashboard={(id) => setActiveTabId(`${ROLES_TAB_PREFIX}${id}`)}
        />
      );
    }
    if (effectiveTabId === 'starter-templates') {
      // No TabHeaderRow here — the templates view puts its Daily/Weekly/Period
      // switcher where the title would be, with the shared toolbar beside it.
      // Roles-demo admins also get the audience control ("who can see this").
      const templatesToolbar =
        rolesViewer?.role === 'admin' && !rolesViewer.previewing ? (
          <DashboardEditToolbar
            editing={editingDashboard}
            onToggleEdit={() => setEditingDashboard((v) => !v)}
            onAddInsight={() => setAddInsightOpen(true)}
            leadingControls={
              <>
                <button
                  type="button"
                  onClick={() => setTemplatesAudienceOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--color-border-subtle)',
                    background: '#fff',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                >
                  <Radio size={14} strokeWidth={2.2} />
                  Audience…
                </button>
                {dateControls}
              </>
            }
          />
        ) : (
          tabToolbar
        );
      return <TemplatesDashboard controls={templatesToolbar} />;
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
            onAskQuinn={() => {
              setAddInsightViewTabId(activeHomeTab.id);
              setAddInsightOpen(true);
            }}
            onBrowseLibrary={() => {
              setAddInsightViewTabId(activeHomeTab.id);
              setAddInsightOpen(true);
            }}
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
                pinTargets={rolesPinTargets}
                defaultPinTargetId={rolesPinTargets?.[0]?.id}
                onAddChartToTarget={
                  rolesPinTargets
                    ? (chartId, targetId) => {
                        if (targetId === LEGACY_PIN_TARGET_ID) addPinnedChart(chartId);
                        else addRolesInsight(targetId, chartId);
                      }
                    : undefined
                }
                onAddChartToNewView={
                  rolesPersona && rolesPinTargets
                    ? (chartId) => {
                        const d = createRolesDashboard(rolesPersona);
                        addRolesInsight(d.id, chartId);
                        return d.id;
                      }
                    : undefined
                }
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
            {rolesViewer?.previewing && rolesViewAs && <ViewAsBanner viewAs={rolesViewAs} />}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Mvp1Tabs
                tabs={allTabs}
                activeId={effectiveTabId}
                onSelect={setActiveTabId}
                onAddTablesTab={addTablesTab}
                onRemove={removeTab}
                onRename={renameTab}
                onAddDashboard={
                  rolesPersona && rolesViewer && canCreateDashboards(rolesViewer)
                    ? () => {
                        const d = createRolesDashboard(rolesPersona);
                        setActiveTabId(`${ROLES_TAB_PREFIX}${d.id}`);
                      }
                    : undefined
                }
                onAddPeriodDashboard={
                  rolesPersona && rolesViewer && canCreateDashboards(rolesViewer)
                    ? (period) => {
                        const d = createRolesDashboard(rolesPersona, undefined, period);
                        setActiveTabId(`${ROLES_TAB_PREFIX}${d.id}`);
                      }
                    : undefined
                }
                onAddRangeDashboard={
                  rolesPersona && rolesViewer && canCreateDashboards(rolesViewer)
                    ? (range) => {
                        const d = createRolesDashboard(
                          rolesPersona,
                          undefined,
                          undefined,
                          range,
                        );
                        setActiveTabId(`${ROLES_TAB_PREFIX}${d.id}`);
                      }
                    : undefined
                }
              />
              {adminDashboardControls && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {adminDashboardControls}
                </div>
              )}
            </div>
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
        onClose={() => {
          setAddInsightOpen(false);
          setAddInsightViewTabId(null);
        }}
        briefingRole={briefingRole}
        onAddToDashboard={addPinnedChart}
        onViewDashboard={() => setShellView('dashboard')}
        alreadyPinned={new Set(
          currentLayout
            .map((e) => pinnedChartIdOf(e.id))
            .filter((id): id is AnalyticsChartId => id !== null),
        )}
        layout="side-sheet"
        pinTarget={addInsightViewTabId ? 'view' : 'dashboard'}
        pinTargets={
          addInsightViewTabId
            ? [
                {
                  id: addInsightViewTabId,
                  label:
                    mvp1Tabs.find((t) => t.id === addInsightViewTabId)?.name ?? 'This view',
                },
              ]
            : undefined
        }
        defaultPinTargetId={addInsightViewTabId ?? undefined}
        onAddChartToTarget={
          addInsightViewTabId
            ? (chartId, targetId) => appendChartToTab(targetId, { id: genChartId(), chartId })
            : undefined
        }
        onPickTable={
          addInsightViewTabId
            ? (entry, tableQuery) => {
                appendTableToTab(addInsightViewTabId, {
                  id: genTableId(),
                  title: entry.text,
                  query: tableQuery,
                  origin: { kind: 'preset', questionId: entry.id, questionText: entry.text },
                });
                setActiveTabId(addInsightViewTabId);
                setAddInsightOpen(false);
                setAddInsightViewTabId(null);
              }
            : undefined
        }
        onPinTable={
          addInsightViewTabId
            ? ({ title, query, prompt }) => {
                appendTableToTab(addInsightViewTabId, {
                  id: genTableId(),
                  title,
                  query,
                  origin: { kind: 'quinn', prompt },
                });
              }
            : undefined
        }
      />

      <PublishedOverviewDialog
        open={publishedOverviewOpen}
        dashboards={rolesDashboards}
        onClose={() => setPublishedOverviewOpen(false)}
        onOpenDashboard={(id) => {
          setActiveTabId(`${ROLES_TAB_PREFIX}${id}`);
          setShellView('dashboard');
        }}
        onUnpublish={unpublishDashboard}
      />

      {rolesViewer && (
        <PublishDialog
          open={templatesAudienceOpen}
          dashboard={templatesStub}
          viewer={rolesViewer}
          onClose={() => setTemplatesAudienceOpen(false)}
          onPublish={(audience) => updateTemplatesAudience(audience)}
          onUnpublish={() => updateTemplatesAudience(null)}
        />
      )}

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
