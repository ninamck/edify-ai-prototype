'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

/**
 * Labour surface layout. Same shell as Activity, Forecast and Stock:
 * sidebar rail, then the page owns its top bar so it can drive the
 * This week / Last week / Estate tabs.
 */
export default function LabourLayout({ children }: { children: React.ReactNode }) {
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}
