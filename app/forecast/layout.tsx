'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRouter } from 'next/navigation';
import { ProductionSiteProvider } from '@/components/Production/ProductionSiteContext';

// Mobile breakpoint kept in sync with the rest of the shell (Stock,
// Production, etc.) — below 640px we hide the rail and let the page
// own the full viewport.
const MOBILE_BREAKPOINT = '(max-width: 640px)';

/**
 * Forecast surface layout — mirrors the Stock layout (same shell, same
 * header band) so the operator gets a consistent chrome across the
 * planning / monitoring areas of the app.
 *
 * The page renders inside `<ProductionSiteProvider>` so it can use
 * `useProductionSite()` to resolve the *fixtures* SiteId for the
 * persona currently active in the top-bar SiteSwitcher. Production
 * already owns this provider; piggy-backing on it (rather than mapping
 * `ActiveSite` → `SiteId` ourselves) keeps the source of truth in one
 * place.
 *
 * We deliberately do NOT pull in the full HubOperatorProviders stack
 * — the forecast page doesn't need the run/dispatch stores, and
 * mounting them site-wide would add noise (PlanStore, dispatch, etc.)
 * to a surface that's read-mostly upstream of those flows.
 */
export default function ForecastLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const router = useRouter();

  return (
    <ProductionSiteProvider>
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
            <div style={{ minWidth: 0, maxWidth: '240px' }}>
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
                Forecast demand
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
    </ProductionSiteProvider>
  );
}
