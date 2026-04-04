'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRouter } from 'next/navigation';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

export default function CreditNotesLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const router = useRouter();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <header
        style={{
          flexShrink: 0,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          minHeight: '52px',
          padding: '10px 16px 10px 12px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-nav)',
          boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.04)',
        }}
      >
        <div style={{ minWidth: 0, maxWidth: '240px' }}>
          <SiteSwitcher siteName="Fitzroy Espresso" compact={false} />
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '0.01em',
            }}
          >
            Manage Credit Notes
          </span>
        </div>

        <div style={{ minWidth: 0, maxWidth: '240px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              background: '#fff',
              border: '1px solid var(--color-border)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ← Home
          </button>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        {!isMobile && (
          <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
            <Sidebar />
          </div>
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
