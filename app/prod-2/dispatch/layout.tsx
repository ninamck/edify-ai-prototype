'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import HubOperatorProviders from '@/components/Operator/HubOperatorProviders';
import QuinnProductionPanel, { QuinnTrigger } from '@/components/Production2/QuinnProductionPanel';
import { RoleSwitcher } from '@/components/Production2/RoleContext';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import DemoControls, { DemoControlsSection } from '@/components/DemoControls/DemoControls';
import {
  TOP_NAV_BAR_PADDING,
  TOP_NAV_PILL_ACTIVE,
  TOP_NAV_PILL_BASE,
  TOP_NAV_PILL_GAP,
  TOP_NAV_PILL_IDLE_TRANSPARENT,
} from '@/components/Production2/topNavStyles';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

type SubTab = { id: string; label: string; href: string };

// Dispatch is hub-only. Sub-tabs map the customer-facing outbound surfaces.
// Today is the working view (lifted from /production/dispatch); the others
// are placeholder shells until they get built out.
const DISPATCH_SUB_TABS: SubTab[] = [
  { id: 'today',     label: 'Today',          href: '/dispatch/today' },
  { id: 'orders',    label: 'Customer orders', href: '/dispatch/orders' },
  { id: 'customers', label: 'Customers',      href: '/dispatch/customers' },
  { id: 'products',  label: 'Products',       href: '/dispatch/products' },
  { id: 'invoices',  label: 'Invoices',       href: '/dispatch/invoices' },
];

export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const router = useRouter();
  const pathname = usePathname();
  const { isSpoke } = useActiveSite();

  // Hub-only area. Spokes don't dispatch — the sidebar already hides
  // the entry point, but a direct URL hit should bounce home rather
  // than render an empty hub UI under their persona.
  useEffect(() => {
    if (isSpoke) router.replace('/');
  }, [isSpoke, router]);

  return (
    <HubOperatorProviders>
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
          {/* Top bar — same chrome as Production so persona controls
              stay in the same place across operator surfaces. */}
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
                Dispatch
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
              <DemoControls
                variant="inline"
                extraSection={
                  <DemoControlsSection label="Production role">
                    <RoleSwitcher />
                  </DemoControlsSection>
                }
              />
              {/* Quinn lives in the header now; the floating bottom-right
                  trigger is suppressed below via `hideTrigger`. The Home
                  button was removed — sidebar handles cross-app nav. */}
              <QuinnTrigger />
            </div>
          </header>

          {/* Sub-tabs — sticky so the manager can swap between Today /
              Customer orders / Customers / Products / Invoices without
              losing context as they scroll. Sized via the shared
              TOP_NAV_* constants so this row matches the production
              today/run/plan tab strip exactly. */}
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
            {DISPATCH_SUB_TABS.map(tab => {
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

          {/* Page body */}
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

        <QuinnProductionPanel hideTrigger />
      </div>
    </HubOperatorProviders>
  );
}
