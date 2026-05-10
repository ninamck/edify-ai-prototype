'use client';

import { RoleProvider } from '@/components/Production/RoleContext';
import { PlanStoreProvider } from '@/components/Production/PlanStore';
import { SpokeRejectStoreProvider } from '@/components/Production/rejectsStore';
import { AdhocRequestStoreProvider } from '@/components/Production/adhocStore';
import { RemakeRequestStoreProvider } from '@/components/Production/remakeStore';
import { HubUnlockStoreProvider } from '@/components/Production/hubUnlockStore';
import { HubOverrideStoreProvider } from '@/components/Production/hubOverrideStore';
import { DispatchTransferStoreProvider } from '@/components/Production/dispatchStore';
import { DemoNotificationsProvider } from '@/components/Production/demoNotificationsStore';
import { HybridOrderStoreProvider } from '@/components/Production/hybridOrderStore';
import { ProductionSiteProvider } from '@/components/Production/ProductionSiteContext';

/**
 * Shared provider stack for hub-operator surfaces (Production, Dispatch,
 * and any future top-level operator areas). These were originally inlined
 * in `app/production/layout.tsx`; lifting them into a single component
 * means new sibling areas can opt in with one wrapper instead of
 * duplicating the same eight providers, and adding a new store stays a
 * one-place change.
 *
 * Keep the order stable — descendants like the dispatch flow read from
 * several stores at once and the nesting matches what every existing
 * hook + selector expects.
 */
export default function HubOperatorProviders({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <PlanStoreProvider>
        <SpokeRejectStoreProvider>
          <AdhocRequestStoreProvider>
            <RemakeRequestStoreProvider>
              <HubUnlockStoreProvider>
                <HubOverrideStoreProvider>
                  <DispatchTransferStoreProvider>
                    <DemoNotificationsProvider>
                      <HybridOrderStoreProvider>
                        <ProductionSiteProvider>{children}</ProductionSiteProvider>
                      </HybridOrderStoreProvider>
                    </DemoNotificationsProvider>
                  </DispatchTransferStoreProvider>
                </HubOverrideStoreProvider>
              </HubUnlockStoreProvider>
            </RemakeRequestStoreProvider>
          </AdhocRequestStoreProvider>
        </SpokeRejectStoreProvider>
      </PlanStoreProvider>
    </RoleProvider>
  );
}
