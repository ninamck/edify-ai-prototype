'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteSettingsEditor, {
  type SettingsTabId,
} from '@/components/Settings/SiteSettingsEditor';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';

const TAB_IDS: SettingsTabId[] = [
  'general', 'cutoffs', 'benches', 'team', 'windows', 'range-tiers',
];

export default function ProductionSettingsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
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
      router.replace(`/production/settings?tab=${tab}`);
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
