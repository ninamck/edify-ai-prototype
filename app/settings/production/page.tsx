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

  const setTab = useCallback(
    (tab: SettingsTabId) => {
      const sp = new URLSearchParams(params.toString());
      sp.set('tab', tab);
      router.replace(`/settings/production?${sp.toString()}`);
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
