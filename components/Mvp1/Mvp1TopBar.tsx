'use client';

import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import PhaseSwitcher from '@/components/PhaseSwitcher';
import DemoControls from '@/components/DemoControls/DemoControls';
import type { PhaseOverride } from '@/components/PhaseSwitcher';

type Mvp1TopBarProps = {
  siteName: string;
  phaseOverride: PhaseOverride;
  onPhaseOverrideChange: (v: PhaseOverride) => void;
};

export default function Mvp1TopBar({
  siteName,
  phaseOverride,
  onPhaseOverrideChange,
}: Mvp1TopBarProps) {
  return (
    <header
      style={{
        flexShrink: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        minHeight: '52px',
        padding: '10px 16px 10px 12px',
        borderBottom: '2px solid rgba(217, 215, 212, 1)',
        background: '#ffffff',
        boxShadow: '0 1px 0 rgba(58,48,40,0.08)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{ minWidth: 0, maxWidth: 'min(280px, 100%)' }}>
        <SiteSwitcher siteName={siteName} compact={false} />
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'flex-end',
        }}
      >
        <PhaseSwitcher phaseOverride={phaseOverride} onPhaseOverrideChange={onPhaseOverrideChange} />
        <DemoControls variant="inline" />
      </div>
    </header>
  );
}
