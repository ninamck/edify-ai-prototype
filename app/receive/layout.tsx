'use client';

import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

// Deliveries area tabs — receiving on one side, the accepted-deliveries
// record (GRNs) on the other. Controlled (stateTabs) rather than
// route-based so the GRN detail route (/receive/grn/…) highlights
// "Accepted deliveries" instead of prefix-matching both tabs.
const DELIVERIES_TABS = [
  { id: 'receive', label: 'Receive' },
  { id: 'accepted', label: 'Accepted' },
];

export default function ReceiveLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const acceptedActive =
    pathname.startsWith('/receive/accepted') || pathname.startsWith('/receive/grn');

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
          stateTabs={{
            items: DELIVERIES_TABS,
            value: acceptedActive ? 'accepted' : 'receive',
            onChange: id => router.push(id === 'accepted' ? '/receive/accepted' : '/receive'),
          }}
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
