'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { SiteId, SkuId } from './fixtures';

/**
 * In-memory store for hub-side per-spoke overrides — the numbers a hub
 * manager directly overwrites when they take control of a spoke's order
 * from the hub grid (Today / Run sheet recipe-first view).
 *
 * Distinct from the unlock flow:
 *   • Unlock = "open the order back up so the SPOKE can add to it"
 *     (audit-trailed, reason required, additive only).
 *   • Override = "I, the hub, am overwriting this spoke's number"
 *     (no spoke involvement, no reason, fully replaces the value).
 *
 * Keyed `${hubId}|${spokeId}|${skuId}|${forDate}` so a hub can override
 * any (spoke, SKU, day) tuple independently. Reading falls through to
 * the spoke's submission when no override is set.
 */

type Key = string;
const keyFor = (
  hubId: SiteId,
  spokeId: SiteId,
  skuId: SkuId,
  forDate: string,
): Key => `${hubId}|${spokeId}|${skuId}|${forDate}`;

type Store = {
  overrides: Record<Key, number>;
  setOverride: (
    hubId: SiteId,
    spokeId: SiteId,
    skuId: SkuId,
    forDate: string,
    units: number,
  ) => void;
  clearOverride: (hubId: SiteId, spokeId: SiteId, skuId: SkuId, forDate: string) => void;
  getOverride: (
    hubId: SiteId,
    spokeId: SiteId,
    skuId: SkuId,
    forDate: string,
  ) => number | undefined;
  /** Count of overrides for `(hubId, forDate)` — drives the toolbar caption. */
  overrideCount: (hubId: SiteId, forDate: string) => number;
};

const HubOverrideContext = createContext<Store | null>(null);

export function HubOverrideStoreProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<Key, number>>({});

  const setOverride = useCallback(
    (hubId: SiteId, spokeId: SiteId, skuId: SkuId, forDate: string, units: number) => {
      const k = keyFor(hubId, spokeId, skuId, forDate);
      setOverrides(prev => ({ ...prev, [k]: Math.max(0, Math.round(units)) }));
    },
    [],
  );

  const clearOverride = useCallback(
    (hubId: SiteId, spokeId: SiteId, skuId: SkuId, forDate: string) => {
      const k = keyFor(hubId, spokeId, skuId, forDate);
      setOverrides(prev => {
        if (!(k in prev)) return prev;
        const next = { ...prev };
        delete next[k];
        return next;
      });
    },
    [],
  );

  const getOverride = useCallback(
    (hubId: SiteId, spokeId: SiteId, skuId: SkuId, forDate: string) =>
      overrides[keyFor(hubId, spokeId, skuId, forDate)],
    [overrides],
  );

  const overrideCount = useCallback(
    (hubId: SiteId, forDate: string) => {
      const prefix = `${hubId}|`;
      const suffix = `|${forDate}`;
      return Object.keys(overrides).reduce(
        (acc, k) => (k.startsWith(prefix) && k.endsWith(suffix) ? acc + 1 : acc),
        0,
      );
    },
    [overrides],
  );

  const value = useMemo<Store>(
    () => ({ overrides, setOverride, clearOverride, getOverride, overrideCount }),
    [overrides, setOverride, clearOverride, getOverride, overrideCount],
  );

  return <HubOverrideContext.Provider value={value}>{children}</HubOverrideContext.Provider>;
}

export function useHubOverrides(): Store {
  const ctx = useContext(HubOverrideContext);
  if (!ctx) {
    return {
      overrides: {},
      setOverride: () => {},
      clearOverride: () => {},
      getOverride: () => undefined,
      overrideCount: () => 0,
    };
  }
  return ctx;
}
