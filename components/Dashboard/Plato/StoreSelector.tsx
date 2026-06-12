'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { PLATO_STORES } from '@/components/Dashboard/data/platoMockData';

/** Store filter pill for the Platō dashboard — switches which site the tabs show. */
export default function StoreSelector({
  store,
  onChange,
}: {
  store: string;
  onChange: (store: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
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

  return (
    <span ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 8,
          border: `1px solid ${open ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
          background: open ? 'color-mix(in srgb, var(--color-accent-active) 6%, white)' : '#fff',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        <MapPin size={13} strokeWidth={2.2} color="var(--color-text-muted)" />
        <span>{store}</span>
        <ChevronDown size={13} strokeWidth={2.2} color="var(--color-text-muted)" />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 300,
            minWidth: 200,
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0, 28, 53,0.12), 0 0 0 1px rgba(0, 28, 53,0.04)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            fontFamily: 'var(--font-primary)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              padding: '6px 10px 4px',
            }}
          >
            Store
          </div>
          {PLATO_STORES.map((s) => {
            const active = s === store;
            return (
              <button
                key={s}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                style={{
                  all: 'unset',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
                  padding: '7px 10px',
                  borderRadius: 6,
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
                {s}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
