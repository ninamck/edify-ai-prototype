'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

// The Stock area's top bar (site switcher · "Stock" title · tabs ·
// Back) is rendered by the page itself (`app/stock/page.tsx`) as a
// single sticky bar, matching the redesigned web-v2 TopBar. This
// layout only provides the sidebar + scroll container.
export default function StockLayout({ children }: { children: React.ReactNode }) {
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
          overflow: 'auto',
          background: 'var(--color-bg-surface)',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
}
