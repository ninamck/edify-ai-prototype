'use client';

/**
 * /settings/production — the structured per-site production editor mounted
 * inside the company-level Settings nav (Context / Production / Sites /
 * Users / Company info / Integrations).
 *
 * Reuses the exact same `SiteSettingsEditor` as `/production/settings`, so
 * the two surfaces stay 1:1. The site it edits follows the active persona
 * (the top-bar site switcher) via `ProductionSiteContext`, which we mount
 * here through `HubOperatorProviders` since the Settings layout doesn't
 * carry the production provider stack on its own.
 */

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteSettingsEditor, {
  type SettingsTabId,
} from '@/components/Settings/SiteSettingsEditor';
import HubOperatorProviders from '@/components/Operator/HubOperatorProviders';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';

const TAB_IDS: SettingsTabId[] = [
  'general', 'cutoffs', 'benches', 'team', 'windows', 'range-tiers', 'night-shift',
];

export default function SettingsProductionPage() {
  return (
    <Suspense fallback={null}>
      <HubOperatorProviders>
        <Inner />
      </HubOperatorProviders>
    </Suspense>
  );
}

function Inner() {
  const { siteId } = useProductionSite();
  const router = useRouter();
  const params = useSearchParams();
  const queryTab = params.get('tab') as SettingsTabId | null;
  const initialTab: SettingsTabId =
    queryTab && TAB_IDS.includes(queryTab) ? queryTab : 'general';

  // Stable across renders: depends only on `router`, never on the
  // per-render `useSearchParams()` object. `tab` is the only query
  // parameter this surface owns, so rebuilding the string from it alone
  // is lossless and keeps this callback referentially stable.
  const setTab = useCallback(
    (tab: SettingsTabId) => {
      router.replace(`/settings/production?tab=${tab}`);
    },
    [router],
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <SiteSettingsEditor
        key={siteId}
        siteId={siteId}
        lockedSite
        initialTab={initialTab}
        onTabChange={setTab}
      />
    </div>
  );
}
