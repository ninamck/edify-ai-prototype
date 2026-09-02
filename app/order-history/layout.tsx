'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

// Same tab set as app/assisted-ordering/layout.tsx — placed orders now
// live in the "Orders" area alongside predictive ordering and approvals.
const ORDERS_TABS = [
  { id: 'orders',    label: 'Predictive ordering', href: '/assisted-ordering' },
  { id: 'approvals', label: 'Review approvals', href: '/approvals' },
  { id: 'placed',    label: 'Placed', href: '/order-history' },
];

export default function OrderHistoryLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const { isFarmerJ } = useActiveSite();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100vh',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {!isMobile && <Sidebar />}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <AreaTopBar
          title="Orders"
          tabs={ORDERS_TABS}
          siteName={isFarmerJ ? undefined : 'Fitzroy Espresso'}
          backTo="/"
        />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: 'auto',
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
