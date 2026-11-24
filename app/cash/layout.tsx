'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { CASH_TABS } from '@/components/Pret/cashTabs';
import { useCashAudience } from '@/components/Pret/cashOperators';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

/** A shop's cash: the day's counts, closing and banking, collections and history. */
export default function CashLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const [audience] = useCashAudience();
  return (
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
        <AreaTopBar title="Cash" tabs={CASH_TABS[audience]} backTo="/" />
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}>{children}</div>
      </div>
    </div>
  );
}
