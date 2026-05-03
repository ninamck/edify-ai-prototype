'use client';

import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
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
};

export default function ShellTopBar({
  siteName,
  shellView,
  onShellViewChange,
  phaseOverride,
  onPhaseOverrideChange,
}: ShellTopBarProps) {
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
        borderBottom: '2px solid rgba(217, 215, 212, 1)',
        background: '#ffffff',
        boxShadow: '0 1px 0 rgba(58,48,40,0.08)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{ minWidth: 0, maxWidth: 'min(280px, 100%)', justifySelf: 'start' }}>
        <SiteSwitcher siteName={siteName} compact={false} />
      </div>

      <div
        role="tablist"
        aria-label="App view"
        style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          borderRadius: '100px',
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-subtle)',
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
          Command centre
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
      </div>
    </header>
  );
}
