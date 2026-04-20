'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Feed from '@/components/Feed/Feed';
import MobileTopBar from './MobileTopBar';
import MobileBottomNav from './MobileBottomNav';
import MobileHamburgerDrawer from './MobileHamburgerDrawer';
import MobileTasksDrawer from './MobileTasksDrawer';
import MobileInsightsSheet from './MobileInsightsSheet';
import MobileViewSwitcher from './MobileViewSwitcher';
import MobileDashboard from './MobileDashboard';
import type { BriefingRole, BriefingPhase } from '@/components/briefing';
import { phaseFromHour } from '@/components/briefing';
import type { ShellViewMode } from '@/components/ShellTopBar';

type NavTab = 'receive' | 'checklists' | 'tasks' | 'waste' | 'insights';

const BOTTOM_NAV_HEIGHT = 64;

export default function MobileShell() {
  const router = useRouter();
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab | null>(null);
  const [briefingRole, setBriefingRole] = useState<BriefingRole>('gm');
  const [view, setView] = useState<ShellViewMode>('command-centre');
  const phase: BriefingPhase = phaseFromHour(new Date().getHours());

  function handleTabChange(tab: NavTab) {
    if (tab === 'tasks') {
      setActiveTab('tasks');
      setTasksOpen(true);
      return;
    }
    if (tab === 'insights') {
      setActiveTab('insights');
      setInsightsOpen(true);
      return;
    }
    if (tab === 'waste') {
      setActiveTab('waste');
      router.push('/log-waste');
      return;
    }
    // receive & checklists navigate away — tab state resets on return
    setActiveTab(tab);
  }

  function handleTasksClose() {
    setTasksOpen(false);
    setActiveTab(null);
  }

  function handleInsightsClose() {
    setInsightsOpen(false);
    setActiveTab(null);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <MobileTopBar
        siteName="Fitzroy Espresso"
        onHamburgerOpen={() => setHamburgerOpen(true)}
        role={briefingRole}
        onRoleChange={setBriefingRole}
      />

      <MobileViewSwitcher view={view} onChange={setView} />

      {/* Content — fills remaining space above bottom nav */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          paddingBottom: BOTTOM_NAV_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {view === 'command-centre' ? (
          <Feed briefingRole={briefingRole} />
        ) : (
          <MobileDashboard role={briefingRole} phase={phase} />
        )}
      </div>

      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <MobileHamburgerDrawer
        open={hamburgerOpen}
        onClose={() => setHamburgerOpen(false)}
        siteName="Fitzroy Espresso"
      />

      <MobileTasksDrawer
        open={tasksOpen}
        onClose={handleTasksClose}
        role={briefingRole}
      />

      <MobileInsightsSheet
        open={insightsOpen}
        onClose={handleInsightsClose}
        role={briefingRole}
      />
    </div>
  );
}
