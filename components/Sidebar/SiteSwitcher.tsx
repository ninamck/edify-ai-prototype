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

/**
 * Single source of truth for site-type styling in the switcher.
 * Mirrors the palette used in the production `SiteTypeBanner` so the
 * persona pill and the in-page banner read as the same visual system:
 *   HUB    → info (blue)        — accent-active is reserved for "active"
 *   SPOKE  → secondary (neutral)
 *   HYBRID → warning (amber)
 */
function siteTypeTheme(type: ActiveSite['type']) {
  switch (type) {
    case 'ALL':
      // Meta-persona — dark accent so it reads as the "global mode"
      // option, visually distinct from the individual-site rows below.
      return {
        avatarBg: 'var(--color-accent-deep)',
        chipBg: 'var(--color-bg-hover)',
        chipFg: 'var(--color-accent-deep)',
      };
    case 'HUB':
      return {
        avatarBg: 'var(--color-accent-active)',
        chipBg: 'var(--color-accent-light, var(--color-bg-hover))',
        chipFg: 'var(--color-accent-active)',
      };
    case 'HYBRID':
    case 'HYBRID_HUB':
      return {
        avatarBg: 'var(--color-warning)',
        chipBg: 'var(--color-warning-light)',
        chipFg: 'var(--color-warning)',
      };
    case 'STANDALONE':
      return {
        avatarBg: 'var(--color-success)',
        chipBg: 'var(--color-success-light)',
        chipFg: 'var(--color-success)',
      };
    case 'SPOKE':
    default:
      return {
        avatarBg: 'var(--color-info)',
        chipBg: 'var(--color-info-light)',
        chipFg: 'var(--color-info)',
      };
  }
}

/** Short chip label shown next to the site name in the dropdown row.
 *  Keeps the internal HYBRID_HUB enum value out of the UI — a producing
 *  hybrid still reads as "HYBRID" on the chip, matching the persona's
 *  user-facing "Hybrid" framing. */
function siteTypeChipLabel(type: ActiveSite['type']): string {
  return type === 'HYBRID_HUB' ? 'HYBRID' : type;
}

/** One-line "what kind of site this is" caption used under the name. */
function siteTypeCaption(type: ActiveSite['type']): string {
  switch (type) {
    case 'ALL':
      return 'All sites';
    case 'HUB':
      return 'Hub kitchen';
    case 'HYBRID':
      return 'Hybrid site';
    case 'HYBRID_HUB':
      return 'Hybrid hub';
    case 'STANDALONE':
      return 'Standalone site';
    case 'SPOKE':
    default:
      return 'Spoke site';
  }
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
        {/* Site avatar */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: compact ? '36px' : '32px',
            height: compact ? '36px' : '32px',
            borderRadius: 'var(--radius-avatar)',
            background: siteTypeTheme(activeSite.type).avatarBg,
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
                {siteTypeCaption(activeSite.type)} · Switch
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
          background: siteTypeTheme(site.type).avatarBg,
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
              background: siteTypeTheme(site.type).chipBg,
              color: siteTypeTheme(site.type).chipFg,
            }}
          >
            {siteTypeChipLabel(site.type)}
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
