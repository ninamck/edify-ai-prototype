'use client';

import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import type { BriefingRole } from '@/components/briefing';
import { BRIEFING_ROLES } from '@/components/briefing';

export type ShellViewMode = 'command-centre' | 'dashboard';

type ShellTopBarProps = {
  siteName: string;
  briefingRole: BriefingRole;
  onBriefingRoleChange: (r: BriefingRole) => void;
  shellView: ShellViewMode;
  onShellViewChange: (v: ShellViewMode) => void;
};

export default function ShellTopBar({
  siteName,
  briefingRole,
  onBriefingRoleChange,
  shellView,
  onShellViewChange,
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
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-nav)',
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
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            background: shellView === 'command-centre' ? 'var(--color-accent-active)' : 'transparent',
            color: shellView === 'command-centre' ? '#fff' : 'var(--color-text-muted)',
            boxShadow: shellView === 'command-centre' ? '0 2px 8px rgba(20,67,233,0.25)' : 'none',
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
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            background: shellView === 'dashboard' ? 'var(--color-accent-active)' : 'transparent',
            color: shellView === 'dashboard' ? '#fff' : 'var(--color-text-muted)',
            boxShadow: shellView === 'dashboard' ? '0 2px 8px rgba(20,67,233,0.25)' : 'none',
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
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginRight: '4px',
          }}
        >
          Role
        </span>
        {BRIEFING_ROLES.map((r) => {
          const active = briefingRole === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onBriefingRoleChange(r.id)}
              title={r.label}
              style={{
                padding: '6px 12px',
                borderRadius: '100px',
                fontSize: '11.5px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
                border: active ? '1.5px solid var(--color-accent-active)' : '1.5px solid var(--color-border-subtle)',
                background: active ? 'rgba(20,67,233,0.08)' : '#fff',
                color: active ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
                transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
              }}
            >
              {r.short}
            </button>
          );
        })}
      </div>
    </header>
  );
}
