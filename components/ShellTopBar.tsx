'use client';

import { Sparkles } from 'lucide-react';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import FranchiseSwitcher from '@/components/Franchise/FranchiseSwitcher';
import { useFranchise } from '@/components/Franchise/FranchiseContext';
import PhaseSwitcher from '@/components/PhaseSwitcher';
import type { PhaseOverride } from '@/components/PhaseSwitcher';
import DemoControls from '@/components/DemoControls/DemoControls';

export type ShellViewMode = 'command-centre' | 'dashboard';

type ShellTopBarProps = {
  siteName: string;
  shellView: ShellViewMode;
  onShellViewChange: (v: ShellViewMode) => void;
  phaseOverride: PhaseOverride;
  onPhaseOverrideChange: (v: PhaseOverride) => void;
  briefingLabel: string;
  onOpenBriefing: () => void;
};

export default function ShellTopBar({
  siteName,
  shellView,
  onShellViewChange,
  phaseOverride,
  onPhaseOverrideChange,
  briefingLabel,
  onOpenBriefing,
}: ShellTopBarProps) {
  const { isGroupView } = useFranchise();
  return (
    <header
      style={{
        flexShrink: 0,
        zIndex: 200,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
        alignItems: 'center',
        gap: '12px 16px',
        minHeight: '52px',
        padding: '10px 16px 10px 12px',
        borderBottom: '1px solid var(--color-shell-topbar-border, rgba(217, 215, 212, 1))',
        background: '#ffffff',
        boxShadow: '0 1px 0 rgba(0, 28, 53,0.08)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{ minWidth: 0, maxWidth: 'min(280px, 100%)', justifySelf: 'start' }}>
        {isGroupView ? (
          <FranchiseSwitcher compact={false} />
        ) : (
          <SiteSwitcher siteName={siteName} compact={false} />
        )}
      </div>

      <div
        role="tablist"
        aria-label="App view"
        style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          borderRadius: '100px',
          background: '#ffffff',
          border: '1px solid var(--color-shell-tab-border, rgba(0, 28, 53, 1))',
          justifySelf: 'center',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={shellView === 'command-centre'}
          onClick={() => onShellViewChange('command-centre')}
          style={{
            padding: '8px 14px',
            borderRadius: '100px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            background: shellView === 'command-centre' ? 'var(--color-accent-active)' : 'transparent',
            color: shellView === 'command-centre' ? '#fff' : 'var(--color-text-muted)',
            boxShadow: shellView === 'command-centre' ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
            transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          Command Centre
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={shellView === 'dashboard'}
          onClick={() => onShellViewChange('dashboard')}
          style={{
            padding: '8px 14px',
            borderRadius: '100px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            background: shellView === 'dashboard' ? 'var(--color-accent-active)' : 'transparent',
            color: shellView === 'dashboard' ? '#fff' : 'var(--color-text-muted)',
            boxShadow: shellView === 'dashboard' ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
            transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          Dashboard
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          justifyContent: 'flex-end',
          justifySelf: 'end',
        }}
      >
        <DemoControls variant="inline" />
        <PhaseSwitcher phaseOverride={phaseOverride} onPhaseOverrideChange={onPhaseOverrideChange} />
        <button
          type="button"
          onClick={onOpenBriefing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: '100px',
            border: '1px solid var(--color-shell-tab-border, rgba(0, 28, 53, 1))',
            background: 'var(--color-accent-active)',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(34,68,68,0.25)',
          }}
        >
          <Sparkles size={14} />
          {briefingLabel}
        </button>
      </div>
    </header>
  );
}
