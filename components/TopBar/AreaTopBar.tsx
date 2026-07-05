'use client';

import type { CSSProperties, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';

/**
 * AreaTopBar — the redesigned single-bar chrome shared by every managed
 * area of the app. Ported from web-v2's TopBar + HeaderTabs
 * (`components/shell/top-bar.tsx`, `components/ui/tab-bar.tsx`) so the
 * prototype reads as the same system:
 *
 *   [site switcher chip] | [bold area title]  [compact tabs…]   [actions] [← Back]
 *
 * It replaces the old two-strip pattern (SiteSwitcher header with a
 * centred title, plus a separate TOP_NAV_* pill nav below it) with one
 * sticky bar. Tabs come in two flavours:
 *
 *   • `tabs`      — route-based; each tab navigates to its href and the
 *                   active state follows the current pathname.
 *   • `stateTabs` — controlled; the owning page supplies value/onChange
 *                   (e.g. Stock's Count/Live levels, COGS' report tabs).
 *
 * `rightSlot` pins area-level actions (DemoControls, Quinn, attention
 * pill, portal targets…) to the right edge, before the optional Back
 * button (`backTo` path or custom `onBack`).
 */

// ── Tab chrome ───────────────────────────────────────────────────────
// Compact 32px rounded-md chips: active is a solid navy fill, idle is
// plain muted text with a soft hover.

export const AREA_TAB_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  padding: '0 12px',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'var(--font-primary)',
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  transition: 'background-color 0.12s ease, color 0.12s ease',
};

export const AREA_TAB_ACTIVE: CSSProperties = {
  background: 'var(--color-accent-active)',
  color: 'var(--color-text-on-active)',
  fontWeight: 600,
};

export const AREA_TAB_IDLE: CSSProperties = {
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  fontWeight: 500,
};

/** Single compact tab chip. Exported for pages that render their own
 *  secondary tab strips outside the top bar (e.g. Suppliers). */
export function AreaTabButton({
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
      style={{ ...AREA_TAB_BASE, ...(active ? AREA_TAB_ACTIVE : AREA_TAB_IDLE) }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'var(--color-bg-hover)';
          e.currentTarget.style.color = 'var(--color-text-primary)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--color-text-secondary)';
        }
      }}
    >
      {label}
    </button>
  );
}

/** Bordered Back button used on the right of the bar. */
export const AREA_BACK_BUTTON: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '7px 12px',
  borderRadius: 6,
  background: '#ffffff',
  border: '1px solid var(--color-border)',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

// ── Bar ──────────────────────────────────────────────────────────────

export type AreaRouteTab = { id: string; label: string; href: string };

export type AreaStateTabs = {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
};

interface AreaTopBarProps {
  title: string;
  /** Route-based tabs — navigate on click, active follows pathname. */
  tabs?: AreaRouteTab[];
  /** Controlled tabs — the owning page drives value/onChange. */
  stateTabs?: AreaStateTabs;
  ariaLabel?: string;
  /** Override the left chip (defaults to the SiteSwitcher). */
  switcher?: ReactNode;
  /** Forwarded to the default SiteSwitcher (persona label override). */
  siteName?: string;
  /** Pinned right, before the Back button. */
  rightSlot?: ReactNode;
  /** Renders a Back button that pushes this path. */
  backTo?: string;
  /** Custom back handler — wins over `backTo`. */
  onBack?: () => void;
  backLabel?: string;
}

export default function AreaTopBar({
  title,
  tabs,
  stateTabs,
  ariaLabel,
  switcher,
  siteName,
  rightSlot,
  backTo,
  onBack,
  backLabel = 'Back',
}: AreaTopBarProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const handleBack = onBack ?? (backTo ? () => router.push(backTo) : undefined);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 200,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 52,
        padding: '10px 16px 10px 12px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
      }}
    >
      <div style={{ minWidth: 0, maxWidth: 240, flexShrink: 0 }}>
        {switcher ?? <SiteSwitcher siteName={siteName} compact={false} />}
      </div>

      {/* Divider between the site switcher and the area title. */}
      <div
        aria-hidden
        style={{ width: 1, height: 24, background: 'var(--color-border)', flexShrink: 0 }}
      />

      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '0.01em',
          color: 'var(--color-text-primary)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {title}
      </span>

      <nav
        role="tablist"
        aria-label={ariaLabel ?? `${title} sections`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          minWidth: 0,
          flex: 1,
          overflowX: 'auto',
        }}
      >
        {tabs?.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <AreaTabButton
              key={tab.id}
              label={tab.label}
              active={active}
              onClick={() => router.push(tab.href)}
            />
          );
        })}
        {stateTabs?.items.map(tab => (
          <AreaTabButton
            key={tab.id}
            label={tab.label}
            active={stateTabs.value === tab.id}
            onClick={() => stateTabs.onChange(tab.id)}
          />
        ))}
      </nav>

      {(rightSlot || handleBack) && (
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {rightSlot}
          {handleBack && (
            <button type="button" onClick={handleBack} style={AREA_BACK_BUTTON}>
              <ArrowLeft size={14} /> {backLabel}
            </button>
          )}
        </div>
      )}
    </header>
  );
}
