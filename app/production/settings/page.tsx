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

  const setTab = useCallback(
    (tab: SettingsTabId) => {
      const sp = new URLSearchParams(params.toString());
      sp.set('tab', tab);
      router.replace(`/production/settings?${sp.toString()}`);
    },
    [router, params],
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
