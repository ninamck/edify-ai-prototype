'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRouter, usePathname } from 'next/navigation';
import QuinnProductionPanel, { QuinnTrigger } from '@/components/Production/QuinnProductionPanel';
import { RoleSwitcher } from '@/components/Production/RoleContext';
import HubOperatorProviders from '@/components/Operator/HubOperatorProviders';
import { DemoControlsSection } from '@/components/DemoControls/DemoControls';
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
import EndProductionControl from '@/components/Production/EndProductionControl';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import { DEMO_TODAY } from '@/components/Production/fixtures';

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
// HUB persona — Run / Plan split, mirroring the self-producing sites:
//   • Run  = live floor (Today, Run sheet, PCR queue)
//   • Plan = forward-looking (Plan, Benches, Carry-over, Productivity, Settings)
// Benches (the bench board) sits in Plan: it's where the manager shapes
// how the bake is laid out across stations ahead of the shift, not a
// live-floor monitoring surface.
// The Plan tab itself shows the hub's spoke planning + the same make as
// the day (see RecipeFirstGrid). Sales (live) and Sales vs forecast stay
// dropped: a hub kitchen produces against spoke orders, not retail
// sell-through, so live tills aren't the signal here.
const HUB_RUN_TABS: SubTab[] = [
  { id: 'amounts',         label: 'Today',             href: '/production/amounts' },
  { id: 'run-sheet',       label: 'Run sheet',         href: '/production/run-sheet' },
  { id: 'pcr',             label: 'PCR queue',         href: '/production/pcr' },
];

const HUB_PLAN_TABS: SubTab[] = [
  { id: 'plan',            label: 'Plan',              href: '/production/plan' },
  { id: 'board',           label: 'Benches',           href: '/production/board' },
  // Carry-over tab hidden per request — page still exists at /production/carry-over:
  // { id: 'carry-over',      label: 'Carry-over',        href: '/production/carry-over' },
  { id: 'productivity',    label: 'Productivity',      href: '/production/productivity' },
  // Settings tab hidden — production settings now live in the lower settings area (/settings/production):
  // { id: 'site-settings',   label: 'Settings',          href: '/production/settings' },
];

// STANDALONE + HYBRID split into a Run group and a Plan group, mirroring
// the Run / Plan switch the manager mentally makes during the day. The
// strips are deliberately different so each surface only carries the
// affordances that make sense in that mental mode:
//   • Run = "I'm running today"   → live-floor + live sales
//   • Plan = "I'm shaping ahead"  → planning, retro, settings
const SELF_PRODUCING_RUN_TABS: SubTab[] = [
  { id: 'amounts',         label: 'Today',             href: '/production/amounts' },
  { id: 'run-sheet',       label: 'Run sheet',         href: '/production/run-sheet' },
  { id: 'pcr',             label: 'PCR queue',         href: '/production/pcr' },
  { id: 'sales',           label: 'Live sales',        href: '/production/sales' },
];

const SELF_PRODUCING_PLAN_TABS: SubTab[] = [
  { id: 'plan',            label: 'Plan',              href: '/production/plan' },
  { id: 'board',           label: 'Benches',           href: '/production/board' },
  // Carry-over tab hidden per request — page still exists at /production/carry-over:
  // { id: 'carry-over',      label: 'Carry-over',        href: '/production/carry-over' },
  { id: 'productivity',    label: 'Productivity',      href: '/production/productivity' },
  { id: 'sales-report',    label: 'Sales vs forecast', href: '/production/sales-report' },
  // Settings tab hidden — production settings now live in the lower settings area (/settings/production):
  // { id: 'site-settings',   label: 'Settings',          href: '/production/settings' },
];

/** Run-group prefixes — drives the Run/Plan tab-strip swap for
 *  self-producing personas, and lets the site selector hide on the run
 *  / today views (where mid-shift site swaps lose context). Benches
 *  (/production/board) is deliberately absent: for Pret personas it now
 *  lives in the Plan group. Burger King's crew line shares that path but
 *  stays Run — handled as a persona exception in `productionGroupForPath`. */
const RUN_PRODUCTION_PREFIXES = [
  '/production/amounts',
  '/production/run-sheet',
  '/production/pcr',
  '/production/sales',
];

function productionGroupForPath(pathname: string, isBurgerKing: boolean): 'run' | 'plan' {
  // Burger King's live run-floor surfaces — the crew line (/production/board),
  // the live orders feed (/production/orders) and the prep sheet
  // (/production/prep) — stay in the Run group for that persona (they're
  // floor surfaces, not the Pret planning board).
  if (
    isBurgerKing &&
    (pathname === '/production/board' ||
      pathname.startsWith('/production/board/') ||
      pathname === '/production/orders' ||
      pathname.startsWith('/production/orders/') ||
      pathname === '/production/prep' ||
      pathname.startsWith('/production/prep/'))
  ) {
    return 'run';
  }
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
  // Carry-over tab hidden per request — page still exists at /production/carry-over:
  // { id: 'carry-over',   label: 'Carry-over',        href: '/production/carry-over' },
  { id: 'spokes',       label: 'Order',             href: '/production/spokes' },
  { id: 'sales-report',    label: 'Sales vs forecast', href: '/production/sales-report' },
  // Settings tab hidden — production settings now live in the lower settings area (/settings/production):
  // { id: 'site-settings',   label: 'Settings',          href: '/production/settings' },
];

// Burger King is a standalone hot-production restaurant. Its surfaces are
// deliberately tight:
//   • Make = the crew line display (NOW / NEXT / HAVE per station), backed
//     by the live holding cabinet, plus the Today drop grid.
//   • Plan = how many of each component to drop per 15-min window.
// No dispatch, no benches, no PCR / carry-over / run-sheet (those are Pret
// hub concerns that don't map to a single-restaurant flame-broiler line).
const BK_RUN_TABS: SubTab[] = [
  { id: 'board',   label: 'Crew line', href: '/production/board' },
  { id: 'orders',  label: 'Orders',    href: '/production/orders' },
  { id: 'prep',    label: 'Prep',      href: '/production/prep' },
  { id: 'amounts', label: 'Today',     href: '/production/amounts' },
];

const BK_PLAN_TABS: SubTab[] = [
  { id: 'plan', label: 'Plan', href: '/production/plan' },
];

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const router = useRouter();
  const pathname = usePathname();
  const { isSpoke, isHybrid, isStandalone, isProducingHybrid, isBurgerKing } = useActiveSite();

  // Persona drives the tab set. Every baking persona (Hub, Standalone,
  // Hybrid, producing HYBRID_HUB) now gets a Run/Plan split so the chrome
  // matches the mental mode the manager is in (live floor on Run,
  // planning + retro on Plan). Spokes receive + sell + order (curated),
  // so they keep their single strip. Burger King gets its own trimmed
  // hot-production strips (crew line + drop plan).
  const isSelfProducing = isHybrid || isStandalone || isProducingHybrid;
  const productionGroup = productionGroupForPath(pathname, isBurgerKing);
  const subTabs = isBurgerKing
    ? productionGroup === 'run'
      ? BK_RUN_TABS
      : BK_PLAN_TABS
    : isSpoke
      ? SPOKE_SUB_TABS
      : isSelfProducing
        ? productionGroup === 'run'
          ? SELF_PRODUCING_RUN_TABS
          : SELF_PRODUCING_PLAN_TABS
        : productionGroup === 'run'
          ? HUB_RUN_TABS
          : HUB_PLAN_TABS;

  // Header copy — what kind of view the manager is on. Swaps with the
  // strip so the chrome reflects the mental mode they're in.
  const isBkOrders =
    isBurgerKing &&
    (pathname === '/production/orders' || pathname.startsWith('/production/orders/'));
  const isBkPrep =
    isBurgerKing &&
    (pathname === '/production/prep' || pathname.startsWith('/production/prep/'));
  const headerLabel = isSpoke
    ? 'Production'
    : isBurgerKing
      ? isBkOrders
        ? 'Live orders'
        : isBkPrep
          ? 'Prep sheet'
          : productionGroup === 'run'
            ? 'Kitchen line'
            : 'Drop plan'
      : productionGroup === 'run'
        ? 'Run production'
        : 'Plan production';

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
              {headerLabel}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
            <DemoControls
              variant="inline"
              extraSection={
                <DemoControlsSection label="Production role">
                  <RoleSwitcher />
                </DemoControlsSection>
              }
            />
            {/* Quinn lives in the header now; the floating bottom-right
                trigger is suppressed below via `hideTrigger`. The Home
                button was removed — sidebar handles cross-app nav. */}
            <QuinnTrigger />
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

          {/* Right-aligned slot. Two things live here:
              1. The End production / Reopen control for Hub, Hybrid
                 and Standalone personas while they're in the Run
                 group (Today, Run sheet, Benches, PCR queue, Live
                 sales). Mounted once at the layout level so the
                 button is identical on every run sub-tab and the
                 state survives navigation between them.
              2. A `#production-nav-actions` portal target left in
                 place for sub-page-owned actions that haven't yet
                 been lifted up (e.g. the prod-2 AmountsView). New
                 pages should prefer rendering directly here rather
                 than portalling.
              Spoke persona is excluded entirely; their spoke order
              page already carries its own right-side action above. */}
          {!(isSpoke && pathname.startsWith('/production/spokes')) && (
            <div
              id="production-nav-actions"
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {!isSpoke && productionGroup === 'run' && (
                <RunNavEndProductionSlot />
              )}
            </div>
          )}
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

      <QuinnProductionPanel hideTrigger />
    </div>
    </HubOperatorProviders>
  );
}

/**
 * Thin wrapper that reads the currently-selected production site from
 * `ProductionSiteContext` and renders `<EndProductionControl />` for
 * `DEMO_TODAY`. Pulled out as its own component because the context
 * lives inside `HubOperatorProviders`, which wraps the layout body
 * below the top-level hooks — so calling `useProductionSite()` has to
 * happen in a descendant component, not at the layout's root.
 *
 * Persona / route gating (Hub-Hybrid-Standalone × Run group) is done
 * by the parent before mounting this slot, so the slot just needs to
 * read the site id and hand it to the control.
 */
function RunNavEndProductionSlot() {
  const { siteId } = useProductionSite();
  return <EndProductionControl siteId={siteId} date={DEMO_TODAY} />;
}
