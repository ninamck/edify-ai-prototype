'use client';

import type { ShellViewMode } from '@/components/ShellTopBar';

export default function MobileViewSwitcher({
  view,
  onChange,
}: {
  view: ShellViewMode;
  onChange: (next: ShellViewMode) => void;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '6px 12px 8px',
        background: 'var(--color-bg-nav)',
        borderBottom: '1px solid var(--color-border-subtle)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div
        role="tablist"
        aria-label="App view"
        style={{
          display: 'flex',
          gap: '4px',
          padding: '3px',
          borderRadius: '100px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.3)',
        }}
      >
        <Pill label="Command centre" active={view === 'command-centre'} onClick={() => onChange('command-centre')} />
        <Pill label="Dashboard" active={view === 'dashboard'} onClick={() => onChange('dashboard')} />
      </div>
    </div>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: '100px',
        border: 'none',
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
        background: active ? '#fff' : 'transparent',
        color: active ? 'var(--color-accent-active)' : 'rgba(255,255,255,0.75)',
        boxShadow: active ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
        transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
        whiteSpace: 'nowrap',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  );
}
