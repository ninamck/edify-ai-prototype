'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  getSite,
  type SiteId,
  type SkuId,
  type SpokeUnlock,
} from './fixtures';

/**
 * In-memory store for hub-side spoke unlocks (PAC-unlock).
 *
 * One unlock per `(hubId, spokeId, forDate)`. The hub manager unlocks
 * with a mandatory reason; the spoke sees the open window and can add
 * additions on top of the locked baseline; the dispatch send closes the
 * loop and clears the unlock.
 *
 * Lifecycle:
 *   unlock         → active (spoke can edit)
 *   markConsumed   → spoke resubmitted; baseline replaced with new totals
 *                    (record stays for audit visibility)
 *   markClosed     → dispatch sent; the unlock affordance is gone
 *   clear          → drop entirely (used by the dispatch store as the
 *                    canonical "clean up after Send" path)
 *
 * The composite key is encoded into a single string so React state stays
 * happy and the store is trivial to serialize later.
 */

function unlockKey(hubId: SiteId, spokeId: SiteId, forDate: string): string {
  return `${hubId}:${spokeId}:${forDate}`;
}

type Store = {
  unlocks: Record<string, SpokeUnlock>;
  unlock: (args: {
    hubId: SiteId;
    spokeId: SiteId;
    forDate: string;
    unlockedBy: string;
    reason: string;
    baselineBySku: Record<SkuId, number>;
  }) => void;
  /**
   * Spoke has resubmitted — the order is no longer in "open editing"
   * but the unlock record stays for audit/visibility until the dispatch
   * goes out.
   */
  markConsumed: (hubId: SiteId, spokeId: SiteId, forDate: string) => void;
  /**
   * Dispatch went out — close the unlock entirely so the spoke side
   * stops showing the "open" banner.
   */
  markClosed: (hubId: SiteId, spokeId: SiteId, forDate: string) => void;
  /** Drop the unlock entirely (called by the dispatch store auto-clear). */
  clear: (hubId: SiteId, spokeId: SiteId, forDate: string) => void;
  /** True if there's an active (not yet consumed) unlock for this triple. */
  isActive: (hubId: SiteId, spokeId: SiteId, forDate: string) => boolean;
  /** True if there's any unlock record (active OR consumed but not closed). */
  hasRecord: (hubId: SiteId, spokeId: SiteId, forDate: string) => boolean;
  /** Read the unlock record (for showing audit info). */
  get: (hubId: SiteId, spokeId: SiteId, forDate: string) => SpokeUnlock | undefined;
  /** All unlocks for a hub, used by the matrix to render badges. */
  forHub: (hubId: SiteId) => SpokeUnlock[];
  /** All unlocks targeting a spoke, used by the spoke page. */
  forSpoke: (spokeId: SiteId) => SpokeUnlock[];
};

const HubUnlockContext = createContext<Store | null>(null);

export function HubUnlockStoreProvider({ children }: { children: React.ReactNode }) {
  const [unlocks, setUnlocks] = useState<Record<string, SpokeUnlock>>({});

  const unlock = useCallback(
    ({
      hubId,
      spokeId,
      forDate,
      unlockedBy,
      reason,
      baselineBySku,
    }: {
      hubId: SiteId;
      spokeId: SiteId;
      forDate: string;
      unlockedBy: string;
      reason: string;
      baselineBySku: Record<SkuId, number>;
    }) => {
      const k = unlockKey(hubId, spokeId, forDate);
      setUnlocks(prev => ({
        ...prev,
        [k]: {
          hubId,
          spokeId,
          forDate,
          unlockedAtISO: new Date().toISOString(),
          unlockedBy,
          reason,
          baselineBySku,
        },
      }));
    },
    [],
  );

  const markConsumed = useCallback((hubId: SiteId, spokeId: SiteId, forDate: string) => {
    const k = unlockKey(hubId, spokeId, forDate);
    setUnlocks(prev => {
      const cur = prev[k];
      if (!cur || cur.consumedAtISO) return prev;
      return { ...prev, [k]: { ...cur, consumedAtISO: new Date().toISOString() } };
    });
  }, []);

  const markClosed = useCallback((hubId: SiteId, spokeId: SiteId, forDate: string) => {
    const k = unlockKey(hubId, spokeId, forDate);
    setUnlocks(prev => {
      const cur = prev[k];
      if (!cur) return prev;
      return { ...prev, [k]: { ...cur, closedAtISO: new Date().toISOString() } };
    });
  }, []);

  const clear = useCallback((hubId: SiteId, spokeId: SiteId, forDate: string) => {
    const k = unlockKey(hubId, spokeId, forDate);
    setUnlocks(prev => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, []);

  const isActive = useCallback(
    (hubId: SiteId, spokeId: SiteId, forDate: string) => {
      const k = unlockKey(hubId, spokeId, forDate);
      const u = unlocks[k];
      return !!u && !u.consumedAtISO && !u.closedAtISO;
    },
    [unlocks],
  );

  const hasRecord = useCallback(
    (hubId: SiteId, spokeId: SiteId, forDate: string) => {
      const k = unlockKey(hubId, spokeId, forDate);
      const u = unlocks[k];
      return !!u && !u.closedAtISO;
    },
    [unlocks],
  );

  const get = useCallback(
    (hubId: SiteId, spokeId: SiteId, forDate: string) => unlocks[unlockKey(hubId, spokeId, forDate)],
    [unlocks],
  );

  const all = useMemo(() => Object.values(unlocks), [unlocks]);
  const forHub = useCallback((hubId: SiteId) => all.filter(u => u.hubId === hubId), [all]);
  const forSpoke = useCallback((spokeId: SiteId) => all.filter(u => u.spokeId === spokeId), [all]);

  const value = useMemo<Store>(
    () => ({
      unlocks,
      unlock,
      markConsumed,
      markClosed,
      clear,
      isActive,
      hasRecord,
      get,
      forHub,
      forSpoke,
    }),
    [unlocks, unlock, markConsumed, markClosed, clear, isActive, hasRecord, get, forHub, forSpoke],
  );

  return <HubUnlockContext.Provider value={value}>{children}</HubUnlockContext.Provider>;
}

export function useHubUnlocks(): Store {
  const ctx = useContext(HubUnlockContext);
  if (!ctx) {
    // Safe defaults so components don't blow up when used outside provider
    return {
      unlocks: {},
      unlock: () => {},
      markConsumed: () => {},
      markClosed: () => {},
      clear: () => {},
      isActive: () => false,
      hasRecord: () => false,
      get: () => undefined,
      forHub: () => [],
      forSpoke: () => [],
    };
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quinn nudges
// ─────────────────────────────────────────────────────────────────────────────

export type UnlockNudge = {
  id: string;
  tone: 'success' | 'warning' | 'info';
  title: string;
  body: string;
  cta: { label: string; href: string };
};

/** Spoke-facing: pinned while there's an active unlock waiting for them. */
export function useSpokeUnlockNudges(spokeId: SiteId): UnlockNudge[] {
  const { forSpoke } = useHubUnlocks();
  return useMemo(() => {
    const active = forSpoke(spokeId).filter(u => !u.consumedAtISO && !u.closedAtISO);
    if (active.length === 0) return [];
    const u = active[0];
    const hubName = getSite(u.hubId)?.name ?? u.hubId;
    return [
      {
        id: `unlock-${u.hubId}-${u.spokeId}-${u.forDate}`,
        tone: 'success',
        title: `${hubName} unlocked your ${u.forDate} order`,
        body:
          `${u.unlockedBy} reopened the order past cutoff: "${u.reason}". ` +
          `Add what you need — quantities can only be increased on top of the locked baseline.`,
        cta: { label: 'Add to order', href: '/production/spokes' },
      },
    ];
  }, [forSpoke, spokeId]);
}
