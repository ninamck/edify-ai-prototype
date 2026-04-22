'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, UserRound } from 'lucide-react';
import { useCurrentRole, setCurrentRole } from '@/components/DemoControls/demoStore';
import { ALL_ROLES, ROLE_LABEL, ROLE_DESCRIPTION, defaultRouteForRole } from './roleFilter';
import { useRouter } from 'next/navigation';

export default function RoleSwitcher() {
  const role = useCurrentRole();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

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

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Role: ${ROLE_LABEL[role]}, switch role`}
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '7px 12px',
          borderRadius: '100px',
          border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-hover)',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        <UserRound size={13} strokeWidth={2.2} color="var(--color-accent-active)" />
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          Role
        </span>
        <span>{ROLE_LABEL[role]}</span>
        <ChevronDown size={13} strokeWidth={2} color="var(--color-text-secondary)" />
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
            minWidth: '260px',
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '10px',
            boxShadow: '0 8px 28px rgba(58,48,40,0.15)',
            padding: '6px',
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
              padding: '8px 10px 6px',
            }}
          >
            Switch role
          </div>
          {ALL_ROLES.map(r => {
            const active = role === r;
            return (
              <button
                key={r}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setCurrentRole(r);
                  setOpen(false);
                  router.push(defaultRouteForRole(r));
                }}
                style={{
                  all: 'unset',
                  display: 'block',
                  width: 'calc(100% - 4px)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: active ? 'rgba(34,68,68,0.08)' : 'transparent',
                  border: active ? '1.5px solid var(--color-accent-active)' : '1.5px solid transparent',
                  margin: '2px',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: active ? 'var(--color-accent-active)' : 'var(--color-text-primary)',
                    marginBottom: '2px',
                  }}
                >
                  {ROLE_LABEL[r]}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {ROLE_DESCRIPTION[r]}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
