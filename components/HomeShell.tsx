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

export default function HomeShell() {
  const router = useRouter();
  const [shellView, setShellView] = useState<ShellViewMode>('command-centre');
  const [briefingRole, setBriefingRole] = useState<BriefingRole>('ravi');
  const [mobileInsightsOpen, setMobileInsightsOpen] = useState(false);
  const [chatActive, setChatActive] = useState(false);
  const [pinnedCharts, setPinnedCharts] = useState<AnalyticsChartId[]>([]);
  const [phaseOverride, setPhaseOverride] = useState<PhaseOverride>('auto');
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
                onAddToDashboard={(id) => {
                  setPinnedCharts(prev => prev.includes(id) ? prev : [...prev, id]);
                }}
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
              <EstateDashboard pinnedCharts={pinnedCharts} phase={effectivePhase} />
            ) : (
              <ManagerDashboard phase={effectivePhase} />
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

    </div>
  );
}
