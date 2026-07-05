'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import HubOperatorProviders from '@/components/Operator/HubOperatorProviders';
import QuinnProductionPanel, { QuinnTrigger } from '@/components/Production2/QuinnProductionPanel';
import { RoleSwitcher } from '@/components/Production2/RoleContext';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import DemoControls, { DemoControlsSection } from '@/components/DemoControls/DemoControls';

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
          {/* Single top bar — site switcher · "Dispatch" title · sub-tabs
              (Today / Customer orders / Customers / Products / Invoices),
              with the persona controls + Quinn pinned right. Matches the
              redesigned area chrome. */}
          <AreaTopBar
            title="Dispatch"
            tabs={DISPATCH_SUB_TABS}
            rightSlot={
              <>
                <DemoControls
                  variant="inline"
                  extraSection={
                    <DemoControlsSection label="Production role">
                      <RoleSwitcher />
                    </DemoControlsSection>
                  }
                />
                {/* Quinn lives in the header; the floating bottom-right
                    trigger is suppressed below via `hideTrigger`. */}
                <QuinnTrigger />
              </>
            }
          />

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
