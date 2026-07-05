'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import DemoControls from '@/components/DemoControls/DemoControls';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  // The index page renders its own AreaTopBar so the Suppliers /
  // Master products tabs (page-local state) can live inside the bar.
  // Sub-pages (supplier detail, import, master product) still get the
  // plain bar from here.
  const pathname = usePathname();
  const isIndex = pathname === '/suppliers';

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
        {!isIndex && (
          <AreaTopBar
            title="Suppliers & Products"
            siteName="Fitzroy Espresso"
            rightSlot={<DemoControls variant="inline" />}
            backTo="/"
          />
        )}

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
