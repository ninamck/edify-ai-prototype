'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

/**
 * Chrome for the standalone COGS area. The top bar (site switcher ·
 * "COGS" title · report tabs · Back) is rendered by the page itself
 * (`app/cogs/page.tsx`) as a single sticky bar, matching the redesigned
 * area chrome — the tab state lives in the page, so the bar does too.
 * This layout only provides the sidebar + scroll container.
 */
export default function CogsLayout({ children }: { children: React.ReactNode }) {
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
