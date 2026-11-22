'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar, { type AreaRouteTab } from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DISTRICT, STORES } from '@/components/Feedback/dunkinData';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

const FEEDBACK_TABS: AreaRouteTab[] = [
  { id: 'ripples', label: 'Ripples', href: '/feedback', exact: true },
  { id: 'tickets', label: 'Tickets', href: '/feedback/tickets' },
  { id: 'settings', label: 'Reply settings', href: '/feedback/settings' },
];

/** The district manager's guest feedback: what's going wrong across the stores, why, and who is waiting. */
export default function FeedbackDeskLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const roomy = useMediaQuery('(min-width: 1100px)');
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#ffffff', fontFamily: 'var(--font-primary)' }}>
      {!isMobile && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <AreaTopBar
          title="Guest feedback"
          tabs={FEEDBACK_TABS}
          switcher={<DistrictChip compact={!roomy} />}
          backTo="/"
        />
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}>{children}</div>
      </div>
    </div>
  );
}

function DistrictChip({ compact }: { compact: boolean }) {
  return (
    <div
      title={compact ? `${DISTRICT.name}, ${STORES.length} stores, ${DISTRICT.manager}` : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px 6px 6px', borderRadius: 10,
        border: '1px solid var(--color-border)', background: '#ffffff', minHeight: 44,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 30, height: 30, borderRadius: 7, background: 'var(--color-bg-nav)', color: '#ffffff', display: 'grid', placeItems: 'center',
          fontSize: 11.5, fontWeight: 700,
        }}
      >
        {DISTRICT.initials}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{DISTRICT.name}</span>
        {!compact && (
          <span style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            {STORES.length} stores · {DISTRICT.manager}
          </span>
        )}
      </span>
    </div>
  );
}
