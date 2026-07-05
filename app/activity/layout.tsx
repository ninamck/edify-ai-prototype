'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

/**
 * Activity surface layout — mirrors Notebook / Forecast / Stock so the
 * audit log sits in the rest of the app without re-teaching the
 * shell.
 */
export default function ActivityLayout({ children }: { children: React.ReactNode }) {
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
          title="Activity"
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
