'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Building2 } from 'lucide-react';
import { useSites } from '@/components/Production/productionStore';
import { useCurrentSiteId, setCurrentSiteId } from '@/components/DemoControls/demoStore';

interface SiteSwitcherProps {
  siteName?: string;
  compact?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function SiteSwitcher({ siteName, compact = false }: SiteSwitcherProps) {
  const sites = useSites();
  const currentSiteId = useCurrentSiteId();
  const currentSite = sites.find(s => s.id === currentSiteId);
  const displayName = currentSite?.name ?? siteName ?? 'Fitzroy Espresso';

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
    <div style={{ position: 'relative', display: 'inline-flex', width: compact ? 'auto' : '100%' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${displayName}, switch site`}
        title={compact ? `${displayName} · Switch site` : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'center' : 'flex-start',
          gap: compact ? 0 : '10px',
          width: '100%',
          padding: compact ? '10px 6px' : '10px 10px',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-subtle)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'opacity 0.12s ease',
          fontFamily: 'var(--font-primary)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: compact ? '36px' : '32px',
            height: compact ? '36px' : '32px',
            borderRadius: 'var(--radius-avatar)',
            background: 'var(--color-accent-active)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 700,
            flexShrink: 0,
            letterSpacing: '0.02em',
          }}
        >
          {getInitials(displayName)}
        </span>

        {!compact && (
          <>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 400,
                  color: 'var(--color-text-secondary)',
                  marginTop: '1px',
                }}
              >
                Switch site
              </span>
            </span>

            <ChevronDown size={14} strokeWidth={2} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          </>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 400,
            minWidth: '260px',
            maxWidth: '320px',
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
            Switch site
          </div>
          {sites.map(s => {
            const active = s.id === currentSiteId;
            return (
              <button
                key={s.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setCurrentSiteId(s.id);
                  setOpen(false);
                }}
                style={{
                  all: 'unset',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
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
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-avatar)',
                    background: s.kind === 'hub' ? 'var(--color-accent-deep)' : 'var(--color-accent-active)',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(s.name)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: active ? 'var(--color-accent-active)' : 'var(--color-text-primary)',
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Building2 size={10} strokeWidth={2} />
                    {s.kind === 'hub' ? 'CPU · Hub' : `Spoke · ${s.classification.replace('_', ' ')}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
