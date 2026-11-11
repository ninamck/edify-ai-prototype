'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { COMPANY, SITE_COUNT } from './data';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

function CompanyChip({ compact }: { compact?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: compact ? 6 : '6px 12px 6px 6px',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        background: '#fff',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          background: 'var(--color-accent-active)',
          color: 'var(--color-text-on-active)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        PP
      </span>
      <span style={compact ? VISUALLY_HIDDEN : { display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>{COMPANY}</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>All {SITE_COUNT} pizzerias</span>
      </span>
    </div>
  );
}

export default function FinanceControlsLayout({ children }: { children: React.ReactNode }) {
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <AreaTopBar title="Finance controls" switcher={<CompanyChip compact={isMobile} />} backTo="/" />
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
