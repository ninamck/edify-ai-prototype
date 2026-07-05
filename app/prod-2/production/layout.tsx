'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePathname } from 'next/navigation';
import QuinnProductionPanel, { QuinnTrigger } from '@/components/Production2/QuinnProductionPanel';
import { RoleSwitcher } from '@/components/Production2/RoleContext';
import HubOperatorProviders from '@/components/Operator/HubOperatorProviders';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import DemoControls, { DemoControlsSection } from '@/components/DemoControls/DemoControls';
import SpokeAdhocRequestCard from '@/components/Production2/SpokeAdhocRequestCard';

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
  { id: 'sales',      label: 'Sales (live)',  href: '/production/sales' },
  { id: 'pcr',        label: 'PCR queue',     href: '/production/pcr' },
];

const HUB_PLAN_TABS: SubTab[] = [
  // Plan is polymorphic: when the hub is selected in the site picker it
  // shows the hub plan (PlanStrip + AmountsView). When a spoke is
  // selected it shows the spoke-order workflow (day strip, recipe lines,
  // submit, hub Unlock) — the same surface the spoke persona uses on
  // their own /production/spokes "Order" tab. The dedicated "Spoke
  // plans" sub-tab was removed; the layout-level site picker is the
  // only spoke selector.
  // Benches (the bench board) sits here in Plan: it's where the bake is
  // laid out across stations ahead of the shift, not a live-floor view.
  { id: 'plan',            label: 'Plan',              href: '/production/plan' },
  { id: 'board',           label: 'Benches',           href: '/production/board' },
  // Carry-over tab hidden per request — page still exists at /production/carry-over:
  // { id: 'carry-over',      label: 'Carry-over',        href: '/production/carry-over' },
  { id: 'productivity',    label: 'Productivity',      href: '/production/productivity' },
  { id: 'sales-report',    label: 'Sales vs forecast', href: '/production/sales-report' },
  { id: 'site-settings',   label: 'Settings',          href: '/production/settings' },
  { id: 'settings-health', label: 'Settings health',   href: '/production/settings-health' },
  { id: 'setup',           label: 'Setup',             href: '/production/setup' },
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
  // Carry-over tab hidden per request — page still exists at /production/carry-over:
  // { id: 'carry-over',   label: 'Carry-over',        href: '/production/carry-over' },
  { id: 'spokes',       label: 'Order',             href: '/production/spokes' },
  { id: 'sales-report',    label: 'Sales vs forecast', href: '/production/sales-report' },
  { id: 'site-settings',   label: 'Settings',          href: '/production/settings' },
  { id: 'settings-health', label: 'Settings health',   href: '/production/settings-health' },
];

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
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
        {/* Single top bar — site switcher · mode title (Run / Plan
            production) · persona-driven sub-tabs, with the persona
            controls, Quinn and page actions pinned right. Matches the
            redesigned area chrome. */}
        <AreaTopBar
          title={
            isSpoke
              ? 'Production'
              : hubGroup === 'run'
                ? 'Run production'
                : 'Plan production'
          }
          tabs={subTabs}
          rightSlot={
            <>
              {/* Spoke persona: the ad-hoc request trigger lives here on
                  the Order page — it's the spoke's only outbound action. */}
              {isSpoke && pathname.startsWith('/production/spokes') && (
                <SpokeAdhocRequestCard
                  spokeId={SPOKE_PERSONA_SITE_ID}
                  hubId={SPOKE_PERSONA_HUB_ID}
                  recordedBy="Spoke manager"
                />
              )}

              {/* Portal target for sub-page-owned actions (AmountsView
                  mounts the End production / Reopen control here via
                  createPortal). Collapses when nothing is mounted. */}
              {!(isSpoke && pathname.startsWith('/production/spokes')) && (
                <div
                  id="production-nav-actions"
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                />
              )}

              <DemoControls
                variant="inline"
                extraSection={
                  <DemoControlsSection label="Production role">
                    <RoleSwitcher />
                  </DemoControlsSection>
                }
              />
              {/* Quinn lives in the header; the floating bottom-right
                  trigger is suppressed below via `hideTrigger`. */}
              <QuinnTrigger />
            </>
          }
        />

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
