'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import type { BriefingPhase } from '@/components/briefing';

export type PhaseOverride = BriefingPhase | 'auto';

const PHASE_OPTIONS: { value: PhaseOverride; label: string }[] = [
  { value: 'auto', label: 'Auto (use real time)' },
  { value: 'morning', label: 'Morning briefing' },
  { value: 'midday', label: 'Midday update' },
  { value: 'afternoon', label: 'Afternoon briefing' },
  { value: 'evening', label: 'Evening wrap' },
];

export default function PhaseSwitcher({
  phaseOverride,
  onPhaseOverrideChange,
}: {
  phaseOverride: PhaseOverride;
  onPhaseOverrideChange: (v: PhaseOverride) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const isOverridden = phaseOverride !== 'auto';

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Switch briefing phase (demo)"
        title="Switch briefing phase (demo)"
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          width: '22px',
          height: '22px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          border: isOverridden ? '1px dashed var(--color-accent-active)' : 'none',
          background: isOverridden ? 'rgba(34,68,68,0.06)' : 'transparent',
          color: isOverridden ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
          cursor: 'pointer',
          opacity: isOverridden ? 1 : 0.4,
          transition: 'opacity 0.15s ease, background 0.15s ease',
        }}
        onMouseEnter={(e) => { if (!isOverridden) e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={(e) => { if (!isOverridden) e.currentTarget.style.opacity = '0.4'; }}
      >
        <Clock size={12} strokeWidth={2} />
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 300,
            minWidth: '200px',
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(58,48,40,0.12), 0 0 0 1px rgba(58,48,40,0.04)',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              padding: '6px 10px 4px',
            }}
          >
            Demo · briefing phase
          </div>
          {PHASE_OPTIONS.map((opt) => {
            const active = phaseOverride === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onPhaseOverrideChange(opt.value);
                  setMenuOpen(false);
                }}
                style={{
                  all: 'unset',
                  fontFamily: 'var(--font-primary)',
                  fontSize: '12px',
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: active ? 'rgba(34,68,68,0.08)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)'; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
