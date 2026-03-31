'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar/Sidebar';
import ShellTopBar from '@/components/ShellTopBar';
import type { ShellViewMode } from '@/components/ShellTopBar';
import EstateDashboard from '@/components/Dashboard/EstateDashboard';
import Feed from '@/components/Feed/Feed';
import MorningBriefingTimeline from '@/components/Feed/MorningBriefingTimeline';
import RightPanelSheetOverlay from '@/components/RightPanel/RightPanelSheetOverlay';
import MobileInsightsBar from '@/components/MobileInsightsBar';
import VersionSwitcher from '@/components/VersionSwitcher';
import FloorActionsBox, { CommandCentreModal } from '@/components/FloorActionsBox';
import type { BriefingRole } from '@/components/briefing';
import { commandCentreVariant } from '@/components/briefing';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type HomeShellProps = {
  showVersionSwitcher?: boolean;
};

const NARROW_BREAKPOINT = '(max-width: 900px)';

export default function HomeShell({ showVersionSwitcher = true }: HomeShellProps) {
  const [shellView, setShellView] = useState<ShellViewMode>('command-centre');
  const [commandCentreOpen, setCommandCentreOpen] = useState(false);
  const [briefingRole, setBriefingRole] = useState<BriefingRole>('ravi');
  const [quinnExpanded, setQuinnExpanded] = useState(false);
  const [mobileInsightsOpen, setMobileInsightsOpen] = useState(false);
  const isNarrow = useMediaQuery(NARROW_BREAKPOINT);

  useEffect(() => {
    if (!isNarrow) setMobileInsightsOpen(false);
  }, [isNarrow]);

  useEffect(() => {
    if (shellView === 'dashboard') {
      setCommandCentreOpen(false);
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
    if (!quinnExpanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setQuinnExpanded(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quinnExpanded]);

  useEffect(() => {
    if (!mobileInsightsOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileInsightsOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileInsightsOpen]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <ShellTopBar
        siteName="Fitzroy Espresso"
        briefingRole={briefingRole}
        onBriefingRoleChange={setBriefingRole}
        shellView={shellView}
        onShellViewChange={setShellView}
      />
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
        <Sidebar />
        {shellView === 'command-centre' ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              minWidth: 0,
              minHeight: 0,
              padding: 12,
              gap: 12,
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                minHeight: 0,
                gap: 12,
              }}
            >
              {!quinnExpanded && (
                <FloorActionsBox
                  briefingRole={briefingRole}
                  onOpenCommandCentre={() => setCommandCentreOpen(true)}
                />
              )}
              <Feed
                briefingRole={briefingRole}
                quinnExpanded={quinnExpanded}
                onToggleQuinnExpand={() => setQuinnExpanded((v) => !v)}
              />
              {isNarrow && !quinnExpanded && (
                <MobileInsightsBar onOpen={() => setMobileInsightsOpen(true)} />
              )}
            </div>
            {!quinnExpanded && !isNarrow && (
              <MorningBriefingTimeline briefingRole={briefingRole} />
            )}
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
            <EstateDashboard />
          </div>
        )}
      </div>

      <RightPanelSheetOverlay
        open={mobileInsightsOpen}
        onClose={() => setMobileInsightsOpen(false)}
        title="Timeline"
      >
        <MorningBriefingTimeline briefingRole={briefingRole} layout="sheet" />
      </RightPanelSheetOverlay>

      <CommandCentreModal
        open={commandCentreOpen}
        onClose={() => setCommandCentreOpen(false)}
        variant={commandCentreVariant(briefingRole)}
        siteLabel="Fitzroy Espresso"
      />

      {showVersionSwitcher && (shellView === 'dashboard' || !quinnExpanded) && <VersionSwitcher />}
    </div>
  );
}
