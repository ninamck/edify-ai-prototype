'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { SiteId, SkuId } from './fixtures';

/**
 * Hub-side "Extras" — off-list units a hub manager adds to a recipe row on
 * top of the per-spoke allocations. Used for production that isn't formally
 * on any spoke's order: deli walk-ins the manager wants to cover, a sample
 * tray for the new spoke trial, replacement units for a delivery that
 * arrived short, etc.
 *
 * Distinct from overrides:
 *   • Override (`hubOverrideStore`) replaces a SPOKE's submitted number.
 *     Counted in that spoke's allocation; the spoke owes the difference.
 *   • Extras here are an ADDITIONAL bake, never attributed to any spoke.
 *     They roll into the hub's row total (and the day's make-total) so the
 *     bench has a complete number to bake against — but no spoke column
 *     ever sees an inflated figure.
 *
 * Keyed `${hubId}|${skuId}|${forDate}` so a hub can stamp extras on any
 * (recipe, day) tuple independently. In-memory store mirroring the
 * override pattern — values reset on refresh, which is what the demo
 * wants (extras express today's off-list demand, not policy).
 */

type Key = string;
const keyFor = (hubId: SiteId, skuId: SkuId, forDate: string): Key =>
  `${hubId}|${skuId}|${forDate}`;

type Store = {
  extras: Record<Key, number>;
  setExtras: (hubId: SiteId, skuId: SkuId, forDate: string, units: number) => void;
  clearExtras: (hubId: SiteId, skuId: SkuId, forDate: string) => void;
  getExtras: (hubId: SiteId, skuId: SkuId, forDate: string) => number;
  /** Number of recipe rows carrying extras for `(hubId, forDate)`. */
  extrasRowCount: (hubId: SiteId, forDate: string) => number;
  /** Total extra units across every row for `(hubId, forDate)`. */
  extrasTotalUnits: (hubId: SiteId, forDate: string) => number;
};

const HubExtrasContext = createContext<Store | null>(null);

export function HubExtrasStoreProvider({ children }: { children: React.ReactNode }) {
  const [extras, setExtrasState] = useState<Record<Key, number>>({});

  const setExtras = useCallback(
    (hubId: SiteId, skuId: SkuId, forDate: string, units: number) => {
      const k = keyFor(hubId, skuId, forDate);
      const safe = Math.max(0, Math.round(units));
      setExtrasState(prev => {
        // Zero clears the entry so the row stops counting as "has extras".
        if (safe <= 0) {
          if (!(k in prev)) return prev;
          const next = { ...prev };
          delete next[k];
          return next;
        }
        return { ...prev, [k]: safe };
      });
    },
    [],
  );

  const clearExtras = useCallback(
    (hubId: SiteId, skuId: SkuId, forDate: string) => {
      const k = keyFor(hubId, skuId, forDate);
      setExtrasState(prev => {
        if (!(k in prev)) return prev;
        const next = { ...prev };
        delete next[k];
        return next;
      });
    },
    [],
  );

  const getExtras = useCallback(
    (hubId: SiteId, skuId: SkuId, forDate: string) =>
      extras[keyFor(hubId, skuId, forDate)] ?? 0,
    [extras],
  );

  const extrasRowCount = useCallback(
    (hubId: SiteId, forDate: string) => {
      const prefix = `${hubId}|`;
      const suffix = `|${forDate}`;
      return Object.keys(extras).reduce(
        (acc, k) =>
          k.startsWith(prefix) && k.endsWith(suffix) && extras[k] > 0 ? acc + 1 : acc,
        0,
      );
    },
    [extras],
  );

  const extrasTotalUnits = useCallback(
    (hubId: SiteId, forDate: string) => {
      const prefix = `${hubId}|`;
      const suffix = `|${forDate}`;
      let total = 0;
      for (const k of Object.keys(extras)) {
        if (k.startsWith(prefix) && k.endsWith(suffix)) total += extras[k] ?? 0;
      }
      return total;
    },
    [extras],
  );

  const value = useMemo<Store>(
    () => ({
      extras,
      setExtras,
      clearExtras,
      getExtras,
      extrasRowCount,
      extrasTotalUnits,
    }),
    [extras, setExtras, clearExtras, getExtras, extrasRowCount, extrasTotalUnits],
  );

  return <HubExtrasContext.Provider value={value}>{children}</HubExtrasContext.Provider>;
}

export function useHubExtras(): Store {
  const ctx = useContext(HubExtrasContext);
  if (!ctx) {
    // No-op fallback so consumers don't have to null-check when they're
    // rendered outside the provider (e.g. unit tests, ad-hoc storybook).
    return {
      extras: {},
      setExtras: () => {},
      clearExtras: () => {},
      getExtras: () => 0,
      extrasRowCount: () => 0,
      extrasTotalUnits: () => 0,
    };
  }
  return ctx;
}
