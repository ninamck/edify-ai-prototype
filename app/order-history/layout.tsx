'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

// Deliveries area tabs — receiving and history present as one area.
// Duplicated in app/receive/layout.tsx so both routes render the same bar.
const DELIVERIES_TABS = [
  { id: 'receive', label: 'Receive delivery', href: '/receive' },
  { id: 'history', label: 'Orders',           href: '/order-history' },
];

export default function OrderHistoryLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);

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
          title="Deliveries"
          tabs={DELIVERIES_TABS}
          siteName="Fitzroy Espresso"
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
