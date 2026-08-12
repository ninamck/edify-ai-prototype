'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRouter, usePathname } from 'next/navigation';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

function getPageTitle(pathname: string): string {
  if (pathname.endsWith('/actions')) return 'Actions';
  if (pathname.includes('/actions/')) return 'Corrective action';
  if (pathname.endsWith('/settings/alerts')) return 'Alert settings';
  if (pathname.includes('/report/')) return 'Audit report';
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
  const isAction = pathname.includes('/actions');
  const isReport = pathname.includes('/report/');

  function handleBack() {
    if (isReport) {
      const id = pathname.split('/').pop();
      router.push(id ? `/checklists/history/${id}` : '/checklists/history');
    } else if (pathname.includes('/actions/')) {
      router.push('/checklists/actions');
    } else if (pathname.endsWith('/actions')) {
      router.push('/checklists/complete');
    } else if (pathname.endsWith('/settings/alerts')) {
      router.push('/checklists');
    } else if (pathname.includes('/complete/') && pathname.split('/').length > 4) {
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
      {!isMobile && !isComplete && !isHistory && !isAction && !isReport && <Sidebar />}

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
        title={title}
        siteName="Fitzroy Espresso"
        onBack={handleBack}
      />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'auto',
          background: (isComplete || isHistory || isAction || isReport) ? '#fff' : 'var(--color-bg-surface)',
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
