'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ProductionSiteProvider } from '@/components/Production/ProductionSiteContext';
import { SUPPORT_CENTRE_TABS } from '@/components/Pret/supportCentreTabs';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

/** Pret's Support Centre: the estate-wide rules shops work to. */
export default function SupportCentreLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  return (
    <ProductionSiteProvider>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          background: 'var(--color-bg-surface)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {!isMobile && <Sidebar />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <AreaTopBar title="Support Centre" tabs={SUPPORT_CENTRE_TABS} backTo="/" />
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}>{children}</div>
        </div>
      </div>
    </ProductionSiteProvider>
  );
}
