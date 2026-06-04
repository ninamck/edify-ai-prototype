'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RecipeFirstGrid from '@/components/Production/RecipeFirstGrid';
import DaySelectorStrip from '@/components/Production/DaySelectorStrip';
import { PRET_SITES, DEMO_TODAY, getSite } from '@/components/Production/fixtures';
import IncomingRejectsStrip from '@/components/Production/IncomingRejectsStrip';
import IncomingAdhocRequestsStrip from '@/components/Production/IncomingAdhocRequestsStrip';
import UrgentRemakeBanner from '@/components/Production/UrgentRemakeBanner';
import SpokeTodayPanel from '@/components/Production/SpokeTodayPanel';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { useDemoNotifications } from '@/components/Production/demoNotificationsStore';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import { useRole } from '@/components/Production/RoleContext';
import PlanConfirmBar from '@/components/Production/PlanConfirmBar';

/**
 * 14-day day-strip range (yesterday on the far left, today second).
 * Mirrors the Plan view's strip so the hub manager can scan a couple
 * weeks ahead from the Today screen — collapsing the old Plan/Run
 * split without losing forward visibility.
 */
const DAY_STRIP_RANGE = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Today (formerly "Amounts") — the live-floor production-day view.
 *
 * The body is now the recipe-first grid (same component the Plan page uses)
 * locked to `DEMO_TODAY`. Hub-side incoming-from-spokes strips
 * (urgent remakes, rejects, ad-hoc requests) sit above the grid because the
 * Today screen is where the hub manager triages everything that's landed on
 * their plate today; Dispatch stays focused on outbound transfers.
 *
 * Deep-link contract (consumed by Quinn nudges via `usePlanNudges`):
 *   ?site={SiteId}&focus={ProductionItemId}&reason={FocusReason}
 *
 * On arrival we still switch the site selector to `?site` so the grid
 * renders against the right site. The `focus`/`reason` params are
 * stripped on consumption — the recipe-first grid surfaces a row's detail
 * via tap into the focus panel rather than auto-pulsing.
 */
export default function TodayPage() {
  return (
    <Suspense fallback={null}>
      <TodayPageInner />
    </Suspense>
  );
}

function TodayPageInner() {
  useRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSpoke } = useActiveSite();
  const demoFlags = useDemoNotifications();
  const { siteId, setSiteId } = useProductionSite();
  const site = getSite(siteId);
  // Sites that bake for downstream spokes — a plain HUB and the producing
  // hybrid (HYBRID_HUB). Both triage incoming-from-spokes work (rejects,
  // ad-hoc requests, urgent remakes) on the Today screen.
  const suppliesSpokes = site?.type === 'HUB' || site?.type === 'HYBRID_HUB';

  // Day strip selection — drives both the grid date and the hub triage
  // strips. Defaults to today; selecting a future day reuses the same
  // RecipeFirstGrid (read-only summary) so the hub manager can scan
  // ahead without leaving Today.
  const [selectedDate, setSelectedDate] = useState(DEMO_TODAY);
  // "Hub-fed" = a site that doesn't bake for itself: regular SPOKEs,
  // HYBRIDs, and STANDALONEs that have been linked to a hub kitchen
  // (PAC139 dark-kitchen pattern). When the hub manager picks one of
  // these from the site selector on Today, they don't want the bake
  // editor (there's nothing to edit) — they want the spoke's incoming
  // delivery view, same shape as the spoke persona's own Today.
  //
  // HYBRID is excluded here because the recipe-first grid handles HYBRID
  // natively via per-row Make/Receive tags.
  const isHubFedSite =
    !!site?.hubId &&
    (site.type === 'SPOKE' ||
      (site.type === 'STANDALONE' && site.linkType === 'linked'));

  // Lift the deep-link site param into local state and strip the consumed
  // `focus` / `reason` from the URL so a back-button bounce doesn't replay.
  useEffect(() => {
    const siteParam = searchParams.get('site');
    const focusParam = searchParams.get('focus');
    const reasonParam = searchParams.get('reason');

    if (siteParam && PRET_SITES.some(s => s.id === siteParam)) {
      setSiteId(siteParam);
    }

    if (focusParam || reasonParam || siteParam) {
      const next = new URLSearchParams();
      if (siteParam) next.set('site', siteParam);
      const qs = next.toString();
      router.replace(qs ? `/production/amounts?${qs}` : '/production/amounts', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Spoke persona — read-only "what's coming today" panel.
  if (isSpoke) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <SpokeTodayPanel spokeId="site-spoke-south" hubId="hub-central" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Day strip — same shape as the Plan view. Lets the hub manager
          page through D-1..D+12 without leaving Today; today sits in
          the second slot for "look back one, look ahead two weeks". */}
      <DaySelectorStrip
        siteId={siteId}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        range={DAY_STRIP_RANGE}
      />

      {/* Incoming-from-spokes surfaces — only relevant when the hub manager
          is viewing one of their own hubs AND on the live day. Future
          days have no rejects / ad-hoc requests yet. */}
      {suppliesSpokes && selectedDate === DEMO_TODAY && (
        <>
          {demoFlags.urgentRemake && (
            <UrgentRemakeBanner hubId={siteId} recordedBy="Hub manager" />
          )}
          {demoFlags.rejects && <IncomingRejectsStrip hubId={siteId} />}
          {demoFlags.adhoc && <IncomingAdhocRequestsStrip hubId={siteId} />}
        </>
      )}

      {/* When the hub manager picks a hub-fed (non-HYBRID) site from the
          selector on Today, swap the bake editor for the same hub→spoke
          summary panel — but flipped to the hub's perspective. Same data,
          re-skinned as "what we're sending today". */}
      {isHubFedSite ? (
        <SpokeTodayPanel
          spokeId={siteId}
          hubId={site!.hubId!}
          perspective="hub"
        />
      ) : (
        <>
          {/* Flow-through from Plan: once the day's plan is confirmed, the
              Run screen shows it's running to those committed numbers. */}
          <PlanConfirmBar siteId={siteId} date={selectedDate} variant="run" />
          <RecipeFirstGrid siteId={siteId} date={selectedDate} surface="today" />
        </>
      )}
    </div>
  );
}
