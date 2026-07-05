'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ProductionSiteProvider } from '@/components/Production/ProductionSiteContext';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

/**
 * Notebook surface layout — the long-running record the operator
 * builds up over time with Edify. Same chrome as Forecast / Stock so
 * it sits in the rest of the app without re-teaching the shell.
 */
export default function NotebookLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);

  return (
    <ProductionSiteProvider>
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
            title="Notebook"
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
    </ProductionSiteProvider>
  );
}
