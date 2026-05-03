'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRouter, usePathname } from 'next/navigation';
import QuinnProductionPanel from '@/components/Production/QuinnProductionPanel';
import { RoleProvider, RoleSwitcher } from '@/components/Production/RoleContext';
import { PlanStoreProvider } from '@/components/Production/PlanStore';
import { SpokeRejectStoreProvider } from '@/components/Production/rejectsStore';
import { AdhocRequestStoreProvider } from '@/components/Production/adhocStore';
import { RemakeRequestStoreProvider } from '@/components/Production/remakeStore';
import { HubUnlockStoreProvider } from '@/components/Production/hubUnlockStore';
import { DemoNotificationsProvider } from '@/components/Production/demoNotificationsStore';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import DemoControls from '@/components/DemoControls/DemoControls';
import SpokeAdhocRequestCard from '@/components/Production/SpokeAdhocRequestCard';

const SPOKE_PERSONA_SITE_ID = 'site-spoke-south';
const SPOKE_PERSONA_HUB_ID = 'hub-central';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

type SubTab = { id: string; label: string; href: string };

const HUB_SUB_TABS: SubTab[] = [
  { id: 'amounts',    label: 'Today',             href: '/production/amounts' },
  { id: 'board',      label: 'Benches',           href: '/production/board' },
  { id: 'sales',      label: 'Sales (live)',      href: '/production/sales' },
  { id: 'pcr',        label: 'PCR queue',         href: '/production/pcr' },
  { id: 'plan',       label: 'Plan',              href: '/production/plan' },
  { id: 'carry-over', label: 'Carry-over',        href: '/production/carry-over' },
  { id: 'dispatch',   label: 'Dispatch',          href: '/production/dispatch' },
  { id: 'spokes',     label: 'Spoke submissions', href: '/production/spokes' },
  { id: 'productivity', label: 'Productivity',    href: '/production/productivity' },
  { id: 'sales-report', label: 'Sales vs forecast', href: '/production/sales-report' },
  { id: 'settings',   label: 'Settings health',   href: '/production/settings-health' },
  { id: 'setup',      label: 'Setup (Quinn)',     href: '/production/setup' },
];

// Spokes don't bake — they receive. So the production view bar trims down
// to surfaces a spoke manager actually owns: see what's coming today,
// review live sales, edit their hub order, and check forecast / settings
// health. Notably absent: Benches, PCR, Plan, Carry-over, Dispatch,
// Productivity, Setup — all hub-only concerns.
const SPOKE_SUB_TABS: SubTab[] = [
  { id: 'amounts',      label: 'Today',             href: '/production/amounts' },
  { id: 'sales',        label: 'Sales (live)',      href: '/production/sales' },
  { id: 'carry-over',   label: 'Carry-over',        href: '/production/carry-over' },
  { id: 'spokes',       label: 'Order',             href: '/production/spokes' },
  { id: 'sales-report', label: 'Sales vs forecast', href: '/production/sales-report' },
  { id: 'settings',     label: 'Settings health',   href: '/production/settings-health' },
];

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const router = useRouter();
  const pathname = usePathname();
  const { isSpoke } = useActiveSite();

  // Persona drives which production tabs are visible. Spokes get a
  // curated subset; hubs get everything.
  const subTabs = isSpoke ? SPOKE_SUB_TABS : HUB_SUB_TABS;

  return (
    <RoleProvider>
    <PlanStoreProvider>
    <SpokeRejectStoreProvider>
    <AdhocRequestStoreProvider>
    <RemakeRequestStoreProvider>
    <HubUnlockStoreProvider>
    <DemoNotificationsProvider>
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
        {/* Top bar */}
        <header
          style={{
            flexShrink: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            minHeight: 52,
            padding: '10px 16px 10px 12px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
          }}
        >
          <div style={{ minWidth: 0, maxWidth: 240 }}>
            <SiteSwitcher compact={false} />
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '0.01em',
              }}
            >
              Production
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
            <RoleSwitcher />
            <DemoControls inline />
            <button
              onClick={() => router.push('/')}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                background: '#fff',
                border: '1px solid var(--color-border)',
                fontSize: 12,
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

        {/* Sub-tabs — pinned to the top of the viewport so it stays visible
            as the rest of the page scrolls. */}
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 150,
            flexShrink: 0,
            display: 'flex',
            gap: 4,
            padding: '6px 12px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
            overflowX: 'auto',
          }}
        >
          {subTabs.map(tab => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.href)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  background: active ? 'var(--color-accent-active)' : 'transparent',
                  color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}

          {/* Right-aligned actions for the spoke persona. The ad-hoc
              request trigger lives here on the Order page — it's the
              spoke's only outbound action and pairs naturally with the
              tab row. */}
          {isSpoke && pathname.startsWith('/production/spokes') && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              <SpokeAdhocRequestCard
                spokeId={SPOKE_PERSONA_SITE_ID}
                hubId={SPOKE_PERSONA_HUB_ID}
                recordedBy="Spoke manager"
              />
            </div>
          )}
        </nav>

        {/* Page body — flows in normal document scroll so the page itself
            scrolls rather than an inner container. */}
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

      <QuinnProductionPanel />
    </div>
    </DemoNotificationsProvider>
    </HubUnlockStoreProvider>
    </RemakeRequestStoreProvider>
    </AdhocRequestStoreProvider>
    </SpokeRejectStoreProvider>
    </PlanStoreProvider>
    </RoleProvider>
  );
}
