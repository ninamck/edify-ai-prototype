'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useActiveSite, type ActiveSite } from '@/components/ActiveSite/ActiveSiteContext';

/**
 * SiteSwitcher — top-bar (and sidebar) control that lets the demo flip
 * between persona sites. Backed by `ActiveSiteContext`; opening it shows
 * a dropdown of every available site with a type chip + caption, click
 * to switch.
 *
 * The button still renders the avatar + name + chevron when not compact;
 * compact mode (icon-only rail) just shows the avatar.
 *
 * Layered above shell content via fixed positioning so the dropdown
 * isn't clipped by overflow:hidden parents.
 */

interface SiteSwitcherProps {
  /**
   * Optional override — when provided, the button shows this name
   * instead of the active site's. Used by `<MobileShell />` for legacy
   * call sites that haven't switched to the context yet. New consumers
   * should leave this undefined and let the context drive the label.
   */
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
  const { sites, activeSite, activeSiteId, setActiveSiteId } = useActiveSite();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const displayName = siteName ?? activeSite.name;

  // Close on outside click / escape.
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

  // Position the menu just below the button when opening.
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    setMenuPos({
      left: r.left,
      top: r.bottom + 6,
      width: Math.max(r.width, 280),
    });
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={compact ? `${displayName} · Switch site` : undefined}
        aria-label={`${displayName}, switch site`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'center' : 'flex-start',
          gap: compact ? 0 : '10px',
          width: '100%',
          padding: compact ? '10px 6px' : '10px 10px',
          borderRadius: 'var(--radius-card)',
          background: open ? 'var(--color-bg-hover)' : 'var(--color-bg-hover)',
          border: `1px solid ${open ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'opacity 0.12s ease, border-color 0.12s ease',
          fontFamily: 'var(--font-primary)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
      >
        {/* Site avatar */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: compact ? '36px' : '32px',
            height: compact ? '36px' : '32px',
            borderRadius: 'var(--radius-avatar)',
            background:
              activeSite.type === 'SPOKE'
                ? 'var(--color-info)'
                : 'var(--color-accent-active)',
            color: '#ffffff',
            fontSize: compact ? '12px' : '12px',
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
                {activeSite.type === 'HUB' ? 'Hub kitchen' : 'Spoke site'} · Switch
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
          role="listbox"
          aria-label="Choose site"
          style={{
            position: 'fixed',
            left: menuPos.left,
            top: menuPos.top,
            width: menuPos.width,
            zIndex: 1000,
            background: '#ffffff',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 12px 32px rgba(12,20,44,0.18)',
            overflow: 'hidden',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
            }}
          >
            Site
          </div>
          <div style={{ padding: 4 }}>
            {sites.map(site => (
              <SiteRow
                key={site.id}
                site={site}
                isActive={site.id === activeSiteId}
                onSelect={() => {
                  setActiveSiteId(site.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────

function SiteRow({
  site,
  isActive,
  onSelect,
}: {
  site: ActiveSite;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={onSelect}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 10px',
        borderRadius: 8,
        background: isActive ? 'var(--color-bg-hover)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-primary)',
      }}
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-surface)';
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-avatar)',
          background:
            site.type === 'SPOKE'
              ? 'var(--color-info)'
              : 'var(--color-accent-active)',
          color: '#ffffff',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {getInitials(site.name)}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          {site.name}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.04em',
              background:
                site.type === 'SPOKE'
                  ? 'var(--color-info-light)'
                  : 'var(--color-accent-light, var(--color-bg-hover))',
              color:
                site.type === 'SPOKE'
                  ? 'var(--color-info)'
                  : 'var(--color-accent-active)',
            }}
          >
            {site.type}
          </span>
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {site.caption}
        </span>
      </span>
      {isActive && <Check size={14} color="var(--color-accent-active)" />}
    </button>
  );
}
