'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRouter, usePathname } from 'next/navigation';
import QuinnProductionPanel from '@/components/Production/QuinnProductionPanel';
import { RoleSwitcher } from '@/components/Production/RoleContext';
import HubOperatorProviders from '@/components/Operator/HubOperatorProviders';
import ProductionSiteSelector from '@/components/Production/ProductionSiteSelector';
import {
  TOP_NAV_BAR_PADDING,
  TOP_NAV_PILL_ACTIVE,
  TOP_NAV_PILL_BASE,
  TOP_NAV_PILL_GAP,
  TOP_NAV_PILL_IDLE_TRANSPARENT,
} from '@/components/Production/topNavStyles';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import DemoControls from '@/components/DemoControls/DemoControls';
import SpokeAdhocRequestCard from '@/components/Production/SpokeAdhocRequestCard';

const SPOKE_PERSONA_SITE_ID = 'site-spoke-south';
const SPOKE_PERSONA_HUB_ID = 'hub-central';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

type SubTab = { id: string; label: string; href: string };

// Hub Production splits into two sidebar destinations to match how a
// manager actually works:
//   • Run production  → live floor view (today's bake, what's selling,
//                       what's queued for PCR sign-off)
//   • Plan production → tomorrow & future (week plan, carry-over to
//                       inform tomorrow, performance and setup)
// The sub-tabs surface depends on which sidebar item brought you here.
// `productionGroupForPath` below decides which set is active.
const HUB_RUN_TABS: SubTab[] = [
  { id: 'amounts',    label: 'Today',         href: '/production/amounts' },
  { id: 'run-sheet',  label: 'Run sheet',     href: '/production/run-sheet' },
  { id: 'board',      label: 'Benches',       href: '/production/board' },
  { id: 'sales',      label: 'Sales (live)',  href: '/production/sales' },
  { id: 'pcr',        label: 'PCR queue',     href: '/production/pcr' },
];

const HUB_PLAN_TABS: SubTab[] = [
  { id: 'plan',            label: 'Plan',              href: '/production/plan' },
  { id: 'carry-over',      label: 'Carry-over',        href: '/production/carry-over' },
  { id: 'productivity',    label: 'Productivity',      href: '/production/productivity' },
  { id: 'sales-report',    label: 'Sales vs forecast', href: '/production/sales-report' },
  { id: 'site-settings',   label: 'Settings',          href: '/production/settings' },
  { id: 'settings-health', label: 'Settings health',   href: '/production/settings-health' },
  { id: 'setup',           label: 'Setup (Quinn)',     href: '/production/setup' },
];

/** Same prefix list the Sidebar uses to highlight Run vs Plan. Kept in
 *  sync by hand — both files are short. */
const RUN_PRODUCTION_PREFIXES = HUB_RUN_TABS.map(t => t.href);

function productionGroupForPath(pathname: string): 'run' | 'plan' {
  return RUN_PRODUCTION_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
    ? 'run'
    : 'plan';
}

// Spokes don't bake — they receive. So the production view bar trims down
// to surfaces a spoke manager actually owns: see what's coming today,
// review live sales, edit their hub order, and check forecast / settings
// health. Notably absent: Benches, PCR, Plan, Carry-over, Dispatch,
// Productivity, Setup — all hub-only concerns.
const SPOKE_SUB_TABS: SubTab[] = [
  { id: 'amounts',      label: 'Today',             href: '/production/amounts' },
  { id: 'sales',        label: 'Sales (live)',      href: '/production/sales' },
  { id: 'carry-over',   label: 'Carry-over',        href: '/production/carry-over' },
  { id: 'spokes',       label: 'Order',             href: '/production/spokes' },
  { id: 'sales-report',    label: 'Sales vs forecast', href: '/production/sales-report' },
  { id: 'site-settings',   label: 'Settings',          href: '/production/settings' },
  { id: 'settings-health', label: 'Settings health',   href: '/production/settings-health' },
];

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const router = useRouter();
  const pathname = usePathname();
  const { isSpoke } = useActiveSite();

  // Persona + active sidebar group drive which sub-tabs render here.
  // Spokes get their flat curated list. Hubs see either the Run set
  // (today/floor) or the Plan set (tomorrow/future) based on which
  // sidebar item is open — keeps the tab strip focused on one mode at
  // a time instead of mixing planning surfaces with live floor ones.
  const hubGroup = productionGroupForPath(pathname);
  const subTabs = isSpoke
    ? SPOKE_SUB_TABS
    : hubGroup === 'run'
      ? HUB_RUN_TABS
      : HUB_PLAN_TABS;

  return (
    <HubOperatorProviders>
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
            <SiteSwitcher compact={false} />
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
              {isSpoke
                ? 'Production'
                : hubGroup === 'run'
                  ? 'Run production'
                  : 'Plan production'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
            <RoleSwitcher />
            <DemoControls variant="inline" />
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
            as the rest of the page scrolls. Sized for tablet via the
            shared TOP_NAV_* constants so this row and the site picker
            below it stack as a single header band. */}
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 150,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: TOP_NAV_PILL_GAP,
            padding: TOP_NAV_BAR_PADDING,
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
            overflowX: 'auto',
          }}
        >
          {subTabs.map(tab => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.href)}
                style={{
                  ...TOP_NAV_PILL_BASE,
                  ...(active ? TOP_NAV_PILL_ACTIVE : TOP_NAV_PILL_IDLE_TRANSPARENT),
                }}
              >
                {tab.label}
              </button>
            );
          })}

          {/* Right-aligned actions for the spoke persona. The ad-hoc
              request trigger lives here on the Order page — it's the
              spoke's only outbound action and pairs naturally with the
              tab row. */}
          {isSpoke && pathname.startsWith('/production/spokes') && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              <SpokeAdhocRequestCard
                spokeId={SPOKE_PERSONA_SITE_ID}
                hubId={SPOKE_PERSONA_HUB_ID}
                recordedBy="Spoke manager"
              />
            </div>
          )}

          {/* Right-aligned slot for sub-page-owned actions to portal into.
              AmountsView fills it with the End production / Reopen
              control on Today + Plan; other pages can opt in by
              targeting `#production-nav-actions` via createPortal.
              Lives behind the spoke block above so spoke-only pages
              stay focused, and stays empty (collapses) when no page
              is mounting an action. */}
          {!(isSpoke && pathname.startsWith('/production/spokes')) && (
            <div
              id="production-nav-actions"
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            />
          )}
        </nav>

        {/* Shared site selector — single source of truth for which site
            every production sub-page operates on. Hidden for the spoke
            persona since they're locked to their own site, and hidden
            on hub-kitchen-only views (Benches, PCR queue) where the
            selector would just be noise. */}
        {!pathname.startsWith('/production/board') &&
          !pathname.startsWith('/production/pcr') &&
          !pathname.startsWith('/production/run-sheet') && <ProductionSiteSelector />}

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
    </HubOperatorProviders>
  );
}
