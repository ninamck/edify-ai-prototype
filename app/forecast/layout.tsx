'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
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
          <AreaTopBar
            title="Forecast demand"
            backTo="/"
          />

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
