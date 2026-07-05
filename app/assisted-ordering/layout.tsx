'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

// Predictive ordering area tabs — suggested orders and approvals sit
// behind the sidebar's single "Orders" entry. Duplicated in
// app/approvals/layout.tsx so both routes render the same bar.
const ORDERS_TABS = [
  { id: 'orders',    label: 'Predictive ordering', href: '/assisted-ordering' },
  { id: 'approvals', label: 'Review approvals', href: '/approvals' },
];

export default function AssistedOrderingLayout({ children }: { children: React.ReactNode }) {
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
          title="Orders"
          tabs={ORDERS_TABS}
          siteName="Fitzroy Espresso"
          backTo="/"
        />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
            background: 'var(--color-bg-surface)',
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
