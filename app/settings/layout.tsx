'use client';

/**
 * Configure settings — shared chrome for the four sub-surfaces that
 * sit under the sidebar's "Configure settings" entry:
 *
 *   • Context       — free-form prose Edify reads on every recommendation
 *   • Sites         — the estate's locations (recreates Edify Company Info → Sites)
 *   • Users         — the team list (recreates Edify Company Info → Users)
 *   • Company info  — the company profile + supplier policy
 *
 * Uses the same sticky-tab pattern as `/recipes` and `/production` so
 * every "managed" area of the app reads as one system. The structured
 * per-site editor (cutoffs, benches, windows, range-tiers, night-shift)
 * still lives at /production/settings — this surface is the company /
 * estate level, not the day-to-day production overlay.
 */

import Sidebar from '@/components/Sidebar/Sidebar';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import DemoControls from '@/components/DemoControls/DemoControls';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRouter, usePathname } from 'next/navigation';
import {
  TOP_NAV_BAR_PADDING,
  TOP_NAV_PILL_ACTIVE,
  TOP_NAV_PILL_BASE,
  TOP_NAV_PILL_GAP,
  TOP_NAV_PILL_IDLE_TRANSPARENT,
} from '@/components/Production/topNavStyles';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

type Tab = { id: string; label: string; href: string };

const SETTINGS_TABS: Tab[] = [
  { id: 'context',      label: 'Context',      href: '/settings/context' },
  { id: 'sites',        label: 'Sites',        href: '/settings/sites' },
  { id: 'users',        label: 'Users',        href: '/settings/users' },
  { id: 'company',      label: 'Company info', href: '/settings/company' },
  { id: 'integrations', label: 'Integrations', href: '/settings/integrations' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const router = useRouter();
  const pathname = usePathname() ?? '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        minHeight: '100vh',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
        alignItems: 'flex-start',
      }}
    >
      {!isMobile && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            flexShrink: 0,
            zIndex: 100,
          }}
        >
          <Sidebar />
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <header
          style={{
            flexShrink: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            minHeight: '52px',
            padding: '10px 16px 10px 12px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
          }}
        >
          <div style={{ minWidth: 0, maxWidth: '240px' }}>
            <SiteSwitcher compact={false} />
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '0.01em',
              }}
            >
              Configure settings
            </span>
          </div>

          <div style={{ minWidth: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            <DemoControls variant="inline" />
            <button
              onClick={() => router.push('/')}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                background: '#fff',
                border: '1px solid var(--color-border)',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ← Home
            </button>
          </div>
        </header>

        {/* Sticky sub-tabs — Context / Sites / Users / Company info.
            Matches the Manage menu + Production tab strips 1:1 so every
            managed surface of the app reads as one system. */}
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 150,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: TOP_NAV_PILL_GAP,
            padding: TOP_NAV_BAR_PADDING,
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
            overflowX: 'auto',
          }}
        >
          {SETTINGS_TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.href)}
                style={{
                  ...TOP_NAV_PILL_BASE,
                  ...(active ? TOP_NAV_PILL_ACTIVE : TOP_NAV_PILL_IDLE_TRANSPARENT),
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--color-bg-surface)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
