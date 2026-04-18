'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from '@/components/Sidebar/Sidebar';
import ShellTopBar from '@/components/ShellTopBar';
import type { ShellViewMode } from '@/components/ShellTopBar';
import EstateDashboard from '@/components/Dashboard/EstateDashboard';
import ManagerDashboard from '@/components/Dashboard/ManagerDashboard';
import MorningBriefingTimeline from '@/components/Feed/MorningBriefingTimeline';
import RightPanelSheetOverlay from '@/components/RightPanel/RightPanelSheetOverlay';
import MobileInsightsBar from '@/components/MobileInsightsBar';
import AddInsightPopup from '@/components/Dashboard/AddInsightPopup';
import {
  MANAGER_DEFAULT_LAYOUT,
  ESTATE_DEFAULT_LAYOUT,
  pinnedId,
  type DashboardLayoutEntry,
} from '@/components/Dashboard/layoutTypes';

import FloorActionsBox from '@/components/FloorActionsBox';
import Feed from '@/components/Feed/Feed';
import type { BriefingRole, BriefingPhase } from '@/components/briefing';
import { phaseFromHour } from '@/components/briefing';
import type { PhaseOverride } from '@/components/PhaseSwitcher';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import MobileShell from '@/components/MobileShell/MobileShell';



const NARROW_BREAKPOINT = '(max-width: 900px)';
const MOBILE_SHELL_BREAKPOINT = '(max-width: 430px)';

const LAYOUT_STORAGE_KEY = 'edify:dashboardLayoutByRole';

type LayoutByRole = Record<BriefingRole, DashboardLayoutEntry[]>;

const DEFAULT_LAYOUT_BY_ROLE: LayoutByRole = {
  ravi: MANAGER_DEFAULT_LAYOUT,
  gm: MANAGER_DEFAULT_LAYOUT,
  cheryl: ESTATE_DEFAULT_LAYOUT,
};

function loadStoredLayout(): LayoutByRole | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LayoutByRole>;
    if (!parsed || !parsed.ravi || !parsed.cheryl || !parsed.gm) return null;
    return parsed as LayoutByRole;
  } catch {
    return null;
  }
}

function storeLayout(layout: LayoutByRole) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* quota / private mode — ignore */
  }
}

export default function HomeShell() {
  const router = useRouter();
  const [shellView, setShellView] = useState<ShellViewMode>('command-centre');
  const [briefingRole, setBriefingRole] = useState<BriefingRole>('ravi');
  const [mobileInsightsOpen, setMobileInsightsOpen] = useState(false);
  const [chatActive, setChatActive] = useState(false);
  const [dashboardLayoutByRole, setDashboardLayoutByRole] = useState<LayoutByRole>(DEFAULT_LAYOUT_BY_ROLE);
  const [editingDashboard, setEditingDashboard] = useState(false);
  const [addInsightOpen, setAddInsightOpen] = useState(false);
  const [phaseOverride, setPhaseOverride] = useState<PhaseOverride>('auto');
  const effectivePhase: BriefingPhase =
    phaseOverride === 'auto' ? phaseFromHour(new Date().getHours()) : phaseOverride;
  const isNarrow = useMediaQuery(NARROW_BREAKPOINT);
  const isMobileShell = useMediaQuery(MOBILE_SHELL_BREAKPOINT);

  // Hydrate dashboard layout from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    const stored = loadStoredLayout();
    if (stored) setDashboardLayoutByRole(stored);
  }, []);

  // Persist on change.
  useEffect(() => {
    storeLayout(dashboardLayoutByRole);
  }, [dashboardLayoutByRole]);

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

  const currentLayout = dashboardLayoutByRole[briefingRole];

  function updateCurrentLayout(next: DashboardLayoutEntry[]) {
    setDashboardLayoutByRole((prev) => ({ ...prev, [briefingRole]: next }));
  }

  function addPinnedChart(id: AnalyticsChartId) {
    const entryId = pinnedId(id);
    setDashboardLayoutByRole((prev) => {
      const existing = prev[briefingRole];
      if (existing.some((e) => e.id === entryId)) return prev;
      return {
        ...prev,
        [briefingRole]: [...existing, { id: entryId, visible: true }],
      };
    });
  }

  function removePinnedChart(id: AnalyticsChartId) {
    const entryId = pinnedId(id);
    setDashboardLayoutByRole((prev) => ({
      ...prev,
      [briefingRole]: prev[briefingRole].filter((e) => e.id !== entryId),
    }));
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
      <ShellTopBar
        siteName="Fitzroy Espresso"
        briefingRole={briefingRole}
        onBriefingRoleChange={setBriefingRole}
        shellView={shellView}
        onShellViewChange={setShellView}
        phaseOverride={phaseOverride}
        onPhaseOverrideChange={setPhaseOverride}
      />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          background: '#fff',
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
              />
            </div>

            {/* Right panel: briefing timeline — fades out when chat opens */}
            <AnimatePresence initial={false}>
              {!chatActive && !isNarrow && (
                <motion.div
                  key="right-panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    flexShrink: 0,
                    padding: '12px 12px 12px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                  }}
                >
                  <MorningBriefingTimeline briefingRole={briefingRole} phase={effectivePhase} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
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
            {briefingRole === 'cheryl' ? (
              <EstateDashboard
                phase={effectivePhase}
                layout={currentLayout}
                editing={editingDashboard}
                onLayoutChange={updateCurrentLayout}
                onToggleEdit={() => setEditingDashboard((v) => !v)}
                onAddInsight={() => setAddInsightOpen(true)}
                onRemovePinned={removePinnedChart}
              />
            ) : (
              <ManagerDashboard
                phase={effectivePhase}
                layout={currentLayout}
                editing={editingDashboard}
                onLayoutChange={updateCurrentLayout}
                onToggleEdit={() => setEditingDashboard((v) => !v)}
                onAddInsight={() => setAddInsightOpen(true)}
                onRemovePinned={removePinnedChart}
              />
            )}
          </div>
        )}
      </div>
      </div>

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
      />

    </div>
  );
}
