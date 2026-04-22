'use client';

import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import RoleSwitcher from './RoleSwitcher';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { ReactNode } from 'react';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

// Matches the shape of each route segment → readable page title.
const TITLE_BY_SEGMENT: Record<string, string> = {
  demand: 'Demand Dashboard',
  plan: 'Production Plan',
  bench: 'Bench Task List',
  pcr: 'PCR Queue',
  pick: 'Pick List',
  dispatch: 'Dispatch Queue',
  sales: 'Sales Feedback',
  ordering: 'Order for my site',
  receive: 'Expected Deliveries',
};

function titleFromPath(pathname: string): string {
  // /production/demand → "Demand Dashboard"
  // /production/plan/2026-04-22 → "Production Plan"
  // /ordering → "Order for my site"
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'production' && segments[1]) {
    return TITLE_BY_SEGMENT[segments[1]] ?? 'Production';
  }
  if (segments[0]) return TITLE_BY_SEGMENT[segments[0]] ?? 'Production';
  return 'Production';
}

export default function ProductionShell({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const pathname = usePathname();
  const router = useRouter();
  const title = titleFromPath(pathname);

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
          <div style={{ minWidth: 0, maxWidth: '260px' }}>
            <SiteSwitcher compact={false} />
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RoleSwitcher />
            <button
              onClick={() => router.push('/')}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
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
