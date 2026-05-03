'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  PRET_SPOKE_REJECT_SEEDS,
  getRecipe,
  getSite,
  type SpokeReject,
  type SpokeRejectId,
  type SpokeRejectLine,
  type SiteId,
  type SkuId,
} from './fixtures';

/**
 * In-memory store for spoke reject records (PAC140 / PAC141 / PAC142).
 * Mirrors the shape of `dispatchStore`: a provider mounted high in the
 * production tree so the spoke / dispatch / amounts surfaces all share
 * the same picture, plus a `useSpokeRejects()` hook with a no-op fallback
 * so anything rendered outside the provider doesn't crash.
 *
 * The store is seeded from `PRET_SPOKE_REJECT_SEEDS` on first render so
 * the demo opens with one reject already on the loop (Clapham · 3
 * croissants damaged), exercising every downstream surface — hub waste,
 * dispatch acknowledge, and the next-drop roll-forward chip.
 *
 * State shape: `Record<SpokeRejectId, SpokeReject>` keyed by id so updates
 * are O(1) and the lifecycle helpers (`acknowledge`, `markRolled`) can
 * mutate one record without rebuilding the whole list.
 */

type SpokeRejectStore = {
  rejects: Record<SpokeRejectId, SpokeReject>;
  /** Append a fresh record (used by the spoke-side log form). */
  recordReject: (reject: SpokeReject) => void;
  /** Hub manager taps "Acknowledge" — flips `hubAcknowledged: true`. */
  acknowledge: (id: SpokeRejectId) => void;
  /** Roll-forward marker — set when the next dispatch is sent. */
  markRolled: (id: SpokeRejectId) => void;
  /** Undo the spoke-side submit (in case a row was logged in error). */
  undo: (id: SpokeRejectId) => void;
  /** All rejects across the estate — for callers that filter themselves. */
  all: SpokeReject[];
  /** Rejects targeting a particular hub (for the IncomingRejectsStrip). */
  forHub: (hubId: SiteId) => SpokeReject[];
  /** Rejects this spoke recorded (for the spoke history list). */
  forSpoke: (spokeId: SiteId) => SpokeReject[];
  /** Sum of unrolled reject units for (hub, spoke, sku) — used by PAC142. */
  unrolledUnitsFor: (hubId: SiteId, spokeId: SiteId, skuId: SkuId) => number;
};

const SpokeRejectContext = createContext<SpokeRejectStore | null>(null);

export function SpokeRejectStoreProvider({ children }: { children: React.ReactNode }) {
  const [rejects, setRejects] = useState<Record<SpokeRejectId, SpokeReject>>(() => {
    const seeded: Record<SpokeRejectId, SpokeReject> = {};
    for (const r of PRET_SPOKE_REJECT_SEEDS) seeded[r.id] = r;
    return seeded;
  });

  const recordReject = useCallback((reject: SpokeReject) => {
    setRejects(prev => ({ ...prev, [reject.id]: reject }));
  }, []);

  const acknowledge = useCallback((id: SpokeRejectId) => {
    setRejects(prev => {
      const r = prev[id];
      if (!r || r.hubAcknowledged) return prev;
      return { ...prev, [id]: { ...r, hubAcknowledged: true } };
    });
  }, []);

  const markRolled = useCallback((id: SpokeRejectId) => {
    setRejects(prev => {
      const r = prev[id];
      if (!r || r.rolledIntoNext) return prev;
      return { ...prev, [id]: { ...r, rolledIntoNext: true } };
    });
  }, []);

  const undo = useCallback((id: SpokeRejectId) => {
    setRejects(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const all = useMemo(() => Object.values(rejects), [rejects]);

  const forHub = useCallback(
    (hubId: SiteId) => all.filter(r => r.hubId === hubId),
    [all],
  );
  const forSpoke = useCallback(
    (spokeId: SiteId) => all.filter(r => r.spokeId === spokeId),
    [all],
  );
  const unrolledUnitsFor = useCallback(
    (hubId: SiteId, spokeId: SiteId, skuId: SkuId) => {
      let total = 0;
      for (const r of all) {
        if (r.hubId !== hubId || r.spokeId !== spokeId || r.rolledIntoNext) continue;
        for (const ln of r.lines) {
          if (ln.skuId === skuId) total += ln.rejectedUnits;
        }
      }
      return total;
    },
    [all],
  );

  const value = useMemo<SpokeRejectStore>(
    () => ({
      rejects,
      recordReject,
      acknowledge,
      markRolled,
      undo,
      all,
      forHub,
      forSpoke,
      unrolledUnitsFor,
    }),
    [rejects, recordReject, acknowledge, markRolled, undo, all, forHub, forSpoke, unrolledUnitsFor],
  );

  return (
    <SpokeRejectContext.Provider value={value}>
      {children}
    </SpokeRejectContext.Provider>
  );
}

export function useSpokeRejects(): SpokeRejectStore {
  const ctx = useContext(SpokeRejectContext);
  if (!ctx) {
    return {
      rejects: {},
      recordReject: () => {},
      acknowledge: () => {},
      markRolled: () => {},
      undo: () => {},
      all: [],
      forHub: () => [],
      forSpoke: () => [],
      unrolledUnitsFor: () => 0,
    };
  }
  return ctx;
}

/**
 * Build a fresh `SpokeReject` from a list of rejected lines + metadata.
 * Centralised here so the spoke-side log form and any future bulk-import
 * paths emit the same shape.
 */
/**
 * Live Quinn nudge derived from current reject state. Emitted as a single
 * nudge that summarises every unacknowledged reject targeting `hubId`,
 * with a body that names the spoke + the headline line ("Clapham · 3
 * croissants damaged"). Disappears once the hub manager acknowledges
 * (and re-appears if a new reject comes in).
 */
export type RejectNudge = {
  id: string;
  tone: 'error' | 'warning' | 'info';
  title: string;
  body: string;
  cta: { label: string; href: string };
};

export function useRejectNudges(hubId: SiteId): RejectNudge[] {
  const { forHub } = useSpokeRejects();
  return useMemo(() => {
    const all = forHub(hubId);
    const unack = all.filter(r => !r.hubAcknowledged);
    if (unack.length === 0) return [];

    const totalUnits = unack.reduce((a, r) => a + r.totalRejectedUnits, 0);
    const first = unack[0];
    const firstSpoke = getSite(first.spokeId)?.name ?? first.spokeId;
    const firstLine = first.lines[0];
    const firstRecipe = firstLine ? getRecipe(firstLine.recipeId) : undefined;

    return [
      {
        id: 'rejects-incoming',
        tone: 'error',
        title:
          unack.length === 1
            ? `${firstSpoke} flagged ${first.totalRejectedUnits} reject${first.totalRejectedUnits === 1 ? '' : 's'}`
            : `${unack.length} spoke reject record${unack.length === 1 ? '' : 's'} need acknowledging`,
        body:
          unack.length === 1 && firstRecipe
            ? `${first.totalRejectedUnits}× ${firstRecipe.name} from yesterday's drop. Acknowledge on dispatch and the qty rolls into tomorrow's drop automatically.`
            : `${totalUnits} unit${totalUnits === 1 ? '' : 's'} across ${unack.length} record${unack.length === 1 ? '' : 's'}. Open dispatch to acknowledge + log to hub waste.`,
        cta: { label: 'Open dispatch', href: '/production/dispatch' },
      },
    ];
  }, [forHub, hubId]);
}

export function buildSpokeReject(args: {
  spokeId: SiteId;
  hubId: SiteId;
  forDate: string;
  recordedBy: string;
  transferId?: string;
  lines: SpokeRejectLine[];
}): SpokeReject {
  const totalRejectedUnits = args.lines.reduce((a, ln) => a + ln.rejectedUnits, 0);
  return {
    id: `reject-${args.spokeId}-${args.forDate}-${Date.now()}`,
    spokeId: args.spokeId,
    hubId: args.hubId,
    forDate: args.forDate,
    recordedAtISO: new Date().toISOString(),
    recordedBy: args.recordedBy,
    transferId: args.transferId,
    lines: args.lines,
    totalRejectedUnits,
    hubAcknowledged: false,
    rolledIntoNext: false,
  };
}
