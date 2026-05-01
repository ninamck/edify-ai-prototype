'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRouter, usePathname } from 'next/navigation';
import { PRET_SITES, getSite } from '@/components/Production/fixtures';
import { useMemo } from 'react';
import QuinnProductionPanel from '@/components/Production/QuinnProductionPanel';
import { RoleProvider, RoleSwitcher } from '@/components/Production/RoleContext';
import { PlanStoreProvider } from '@/components/Production/PlanStore';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

const SUB_TABS: Array<{ id: string; label: string; href: string }> = [
  { id: 'amounts',    label: 'Today',             href: '/production/amounts' },
  { id: 'board',      label: 'Benches',           href: '/production/board' },
  { id: 'sales',      label: 'Sales (live)',      href: '/production/sales' },
  { id: 'pcr',        label: 'PCR queue',         href: '/production/pcr' },
  { id: 'plan',       label: 'Plan',              href: '/production/plan' },
  { id: 'carry-over', label: 'Carry-over',        href: '/production/carry-over' },
  { id: 'dispatch',   label: 'Dispatch',          href: '/production/dispatch' },
  { id: 'spokes',     label: 'Spoke submissions', href: '/production/spokes' },
  { id: 'settings',   label: 'Settings health',   href: '/production/settings-health' },
  { id: 'setup',      label: 'Setup (Quinn)',     href: '/production/setup' },
];

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const router = useRouter();
  const pathname = usePathname();

  // Pick the current site label — default to hub-central. In a real app this would live in state.
  const currentSite = useMemo(
    () => getSite('hub-central') ?? PRET_SITES[0],
    []
  );

  return (
    <RoleProvider>
    <PlanStoreProvider>
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        minHeight: '100vh',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
        alignItems: 'flex-start',
      }}
    >
      {!isMobile && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            flexShrink: 0,
            zIndex: 100,
          }}
        >
          <Sidebar />
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Top bar */}
        <header
          style={{
            flexShrink: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            minHeight: 52,
            padding: '10px 16px 10px 12px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
          }}
        >
          <div style={{ minWidth: 0, maxWidth: 240 }}>
            <SiteSwitcher siteName={currentSite.name} compact={false} />
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '0.01em',
              }}
            >
              Production
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
            <RoleSwitcher />
            <button
              onClick={() => router.push('/')}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                background: '#fff',
                border: '1px solid var(--color-border)',
                fontSize: 12,
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

        {/* Sub-tabs — pinned to the top of the viewport so it stays visible
            as the rest of the page scrolls. */}
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 150,
            flexShrink: 0,
            display: 'flex',
            gap: 4,
            padding: '6px 12px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
            overflowX: 'auto',
          }}
        >
          {SUB_TABS.map(tab => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.href)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  background: active ? 'var(--color-accent-active)' : 'transparent',
                  color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Page body — flows in normal document scroll so the page itself
            scrolls rather than an inner container. */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--color-bg-surface)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {children}
        </div>
      </div>

      <QuinnProductionPanel />
    </div>
    </PlanStoreProvider>
    </RoleProvider>
  );
}
