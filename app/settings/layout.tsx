'use client';

/**
 * Configure settings — shared chrome for the sub-surfaces that sit under
 * the sidebar's "Configure settings" entry:
 *
 *   • Context       — free-form prose Edify reads on every recommendation
 *   • Production    — the structured per-site editor (general, cutoffs,
 *                     benches, team, windows, range-tiers, night-shift)
 *   • Sites         — the estate's locations (recreates Edify Company Info → Sites)
 *   • Users         — the team list (recreates Edify Company Info → Users)
 *   • Company info  — the company profile + supplier policy
 *
 * Uses the same sticky-tab pattern as `/recipes` and `/production` so
 * every "managed" area of the app reads as one system. The Production
 * tab surfaces the same `SiteSettingsEditor` used by the day-to-day
 * production overlay (`/production/settings`); here it's reached from
 * the company / estate-level settings surface and follows the active
 * persona's site via the top-bar site switcher.
 */

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import DemoControls from '@/components/DemoControls/DemoControls';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

type Tab = { id: string; label: string; href: string };

const SETTINGS_TABS: Tab[] = [
  { id: 'context',      label: 'Context',      href: '/settings/context' },
  { id: 'production',   label: 'Production',    href: '/settings/production' },
  { id: 'sites',        label: 'Sites',        href: '/settings/sites' },
  { id: 'users',        label: 'Users',        href: '/settings/users' },
  { id: 'company',      label: 'Company info', href: '/settings/company' },
  { id: 'integrations', label: 'Integrations', href: '/settings/integrations' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);

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
        {/* Single top bar — site switcher · "Settings" title · sub-tabs
            (Context / Production / Sites / Users / Company info /
            Integrations), matching the redesigned area chrome. */}
        <AreaTopBar
          title="Settings"
          tabs={SETTINGS_TABS}
          rightSlot={<DemoControls variant="inline" />}
          backTo="/"
        />

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
