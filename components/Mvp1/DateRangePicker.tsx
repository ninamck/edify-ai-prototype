'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export type DateRange = 'today' | 'week' | 'last_4_weeks' | 'custom';

const OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'last_4_weeks', label: 'Last 4 weeks' },
  { value: 'custom', label: 'Custom\u2026' },
];

export default function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const currentLabel = OPTIONS.find((o) => o.value === value)?.label ?? 'This week';

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: '100px',
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          whiteSpace: 'nowrap',
        }}
      >
        <Calendar size={12} strokeWidth={2.2} color="var(--color-text-muted)" />
        <span>{currentLabel}</span>
        <ChevronDown size={12} strokeWidth={2.2} color="var(--color-text-muted)" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 300,
            minWidth: '180px',
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
            Date range
          </div>
          {OPTIONS.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
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
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
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
