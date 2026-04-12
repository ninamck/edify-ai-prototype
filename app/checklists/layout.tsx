'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRouter, usePathname } from 'next/navigation';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

function getPageTitle(pathname: string): string {
  if (pathname.includes('/complete/') && pathname.split('/').length > 4) return 'Complete checklist';
  if (pathname.endsWith('/complete')) return 'Complete tasks';
  if (pathname.includes('/history/')) return 'Checklist record';
  if (pathname.endsWith('/history')) return 'History';
  if (pathname.endsWith('/new')) return 'Create checklist';
  if (/\/checklists\/[^/]+$/.test(pathname) && !pathname.endsWith('/complete') && !pathname.endsWith('/history')) return 'Edit checklist';
  return 'Manage checklists';
}

export default function ChecklistsLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const title = getPageTitle(pathname);

  const isComplete = pathname.includes('/complete');
  const isHistory = pathname.includes('/history');

  function handleBack() {
    if (pathname.includes('/complete/') && pathname.split('/').length > 4) {
      router.push('/checklists/complete');
    } else if (isComplete) {
      router.push('/');
    } else if (pathname.includes('/history/')) {
      router.push('/checklists/history');
    } else if (isHistory) {
      router.push('/checklists/complete');
    } else if (pathname.endsWith('/new') || /\/checklists\/[^/]+$/.test(pathname)) {
      router.push('/checklists');
    } else {
      router.push('/');
    }
  }

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
      {!isMobile && !isComplete && !isHistory && <Sidebar />}

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
          background: '#ffffff',
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
            {title}
          </span>
        </div>

        <div style={{ minWidth: 0, maxWidth: '240px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleBack}
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
            ← Back
          </button>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'auto',
          background: (isComplete || isHistory) ? '#fff' : 'var(--color-bg-surface)',
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
