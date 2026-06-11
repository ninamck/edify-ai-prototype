'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ArrowRight, Layers } from 'lucide-react';
import { useFranchise } from '@/components/Franchise/FranchiseContext';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { TOTAL_STORE_COUNT, type Franchise } from '@/components/Franchise/fixtures';

/**
 * FranchiseSwitcher — top-bar control shown when the demo is in the
 * franchise-admin "group view". Mirrors the SiteSwitcher's fixed-position
 * dropdown, listing every franchise brand in the group and its stores, with
 * a quick "open" affordance to drop into a single store's normal view.
 */

function groupInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function FranchiseSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { group, franchises } = useFranchise();
  const { setActiveSiteId } = useActiveSite();

  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const summary = `${TOTAL_STORE_COUNT} stores · Group view`;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    setMenuPos({ left: r.left, top: r.bottom + 6, width: Math.max(r.width, 320) });
  }, [open]);

  // Stay in group view when opening a store — only the View toggle in Demo
  // controls switches back, so the Franchise group context persists.
  function enterStore(activeSiteId: string) {
    setActiveSiteId(activeSiteId);
    setOpen(false);
    router.push('/');
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={compact ? `${group.name} · Group view` : undefined}
        aria-label={`${group.name}, ${summary}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'center' : 'flex-start',
          gap: compact ? 0 : '10px',
          width: '100%',
          padding: compact ? '10px 6px' : '10px 10px',
          borderRadius: 'var(--radius-card)',
          background: '#ffffff',
          border: `1px solid ${open ? 'var(--color-accent-active)' : 'var(--color-site-switcher-border, rgba(0, 28, 53, 1))'}`,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'opacity 0.12s ease, border-color 0.12s ease',
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
            background: 'var(--color-accent-deep)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 700,
            flexShrink: 0,
            letterSpacing: '0.02em',
          }}
        >
          {groupInitials(group.name)}
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
                {group.name}
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
                {summary}
              </span>
            </span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              style={{
                color: 'var(--color-text-secondary)',
                flexShrink: 0,
                transform: open ? 'rotate(180deg)' : undefined,
                transition: 'transform 0.15s ease',
              }}
            />
          </>
        )}
      </button>

      {open && menuPos && (
        <div
          ref={menuRef}
          role="dialog"
          aria-label="Franchises and stores"
          style={{
            position: 'fixed',
            left: menuPos.left,
            top: menuPos.top,
            width: menuPos.width,
            maxHeight: '70vh',
            overflowY: 'auto',
            zIndex: 1000,
            background: '#ffffff',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 12px 32px rgba(12,20,44,0.18)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderBottom: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
              position: 'sticky',
              top: 0,
            }}
          >
            <Layers size={13} color="var(--color-accent-deep)" strokeWidth={2.2} />
            <span
              style={{
                flex: 1,
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {group.name}
            </span>
          </div>

          <div style={{ padding: 6 }}>
            {franchises.map((franchise) => (
              <FranchiseGroupBlock
                key={franchise.id}
                franchise={franchise}
                onEnterStore={enterStore}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function FranchiseGroupBlock({
  franchise,
  onEnterStore,
}: {
  franchise: Franchise;
  onEnterStore: (activeSiteId: string) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 6,
            background: franchise.brandColor,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {franchise.code ?? groupInitials(franchise.name)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {franchise.name}
          </span>
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {franchise.stores.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4 }}>
        {franchise.stores.map((store) => (
          <div
            key={store.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 8,
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {store.name}
                {store.needsAttention && (
                  <span
                    title="Needs attention"
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--color-warning)',
                      marginLeft: 6,
                      verticalAlign: 'middle',
                    }}
                  />
                )}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 10,
                  color: 'var(--color-text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {store.location}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Open ${store.name}`}
              title="Open this store"
              onClick={() => { if (store.activeSiteId) onEnterStore(store.activeSiteId); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: 6,
                flexShrink: 0,
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                color: 'var(--color-accent-active)',
                cursor: 'pointer',
              }}
            >
              <ArrowRight size={13} strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
