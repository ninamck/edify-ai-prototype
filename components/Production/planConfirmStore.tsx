'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * In-memory store for next-day plan confirmations.
 *
 * The planning ritual: a manager drafts tomorrow's bake on the Plan
 * screen around midday the day before, then *confirms* it. Confirming
 * is a soft commit — it locks the plan read-only and "flows it through"
 * to that day's Run production (the Today / Run-sheet / Benches surfaces
 * all read the same resolved plan, so once confirmed those numbers are
 * the committed bake target). Reopen is one click away, mirroring the
 * End-production soft-commit pattern.
 *
 * One confirmation per `(siteId, date)`. We keep this in a shared
 * context (not local component state like EndProductionControl) precisely
 * because the confirmation has to survive the Plan → Run navigation: the
 * Run screen reads it to show "this is today's committed plan".
 */

export type PlanConfirmation = {
  siteId: string;
  date: string;
  /** Display name of the manager who confirmed. */
  confirmedBy: string;
  confirmedAtISO: string;
};

export type PlanDayUnlock = {
  siteId: string;
  date: string;
  unlockedBy: string;
  unlockedAtISO: string;
};

function confirmKey(siteId: string, date: string): string {
  return `${siteId}:${date}`;
}

type Store = {
  confirmations: Record<string, PlanConfirmation>;
  confirm: (args: { siteId: string; date: string; confirmedBy: string }) => void;
  reopen: (siteId: string, date: string) => void;
  isConfirmed: (siteId: string, date: string) => boolean;
  get: (siteId: string, date: string) => PlanConfirmation | undefined;
  /**
   * Explicit unlock of a day that is locked by default (the live day —
   * today's plan was committed yesterday and is already in production).
   * Lets the manager reopen it for edits, with a one-click re-lock.
   */
  unlocks: Record<string, PlanDayUnlock>;
  unlockDay: (args: { siteId: string; date: string; unlockedBy: string }) => void;
  relockDay: (siteId: string, date: string) => void;
  isDayUnlocked: (siteId: string, date: string) => boolean;
  getUnlock: (siteId: string, date: string) => PlanDayUnlock | undefined;
};

const PlanConfirmContext = createContext<Store | null>(null);

export function PlanConfirmStoreProvider({ children }: { children: React.ReactNode }) {
  const [confirmations, setConfirmations] = useState<Record<string, PlanConfirmation>>({});
  const [unlocks, setUnlocks] = useState<Record<string, PlanDayUnlock>>({});

  const confirm = useCallback(
    ({ siteId, date, confirmedBy }: { siteId: string; date: string; confirmedBy: string }) => {
      const k = confirmKey(siteId, date);
      setConfirmations(prev => ({
        ...prev,
        [k]: { siteId, date, confirmedBy, confirmedAtISO: new Date().toISOString() },
      }));
    },
    [],
  );

  const reopen = useCallback((siteId: string, date: string) => {
    const k = confirmKey(siteId, date);
    setConfirmations(prev => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, []);

  const isConfirmed = useCallback(
    (siteId: string, date: string) => !!confirmations[confirmKey(siteId, date)],
    [confirmations],
  );

  const get = useCallback(
    (siteId: string, date: string) => confirmations[confirmKey(siteId, date)],
    [confirmations],
  );

  const unlockDay = useCallback(
    ({ siteId, date, unlockedBy }: { siteId: string; date: string; unlockedBy: string }) => {
      const k = confirmKey(siteId, date);
      setUnlocks(prev => ({
        ...prev,
        [k]: { siteId, date, unlockedBy, unlockedAtISO: new Date().toISOString() },
      }));
    },
    [],
  );

  const relockDay = useCallback((siteId: string, date: string) => {
    const k = confirmKey(siteId, date);
    setUnlocks(prev => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, []);

  const isDayUnlocked = useCallback(
    (siteId: string, date: string) => !!unlocks[confirmKey(siteId, date)],
    [unlocks],
  );

  const getUnlock = useCallback(
    (siteId: string, date: string) => unlocks[confirmKey(siteId, date)],
    [unlocks],
  );

  const value = useMemo<Store>(
    () => ({
      confirmations,
      confirm,
      reopen,
      isConfirmed,
      get,
      unlocks,
      unlockDay,
      relockDay,
      isDayUnlocked,
      getUnlock,
    }),
    [
      confirmations,
      confirm,
      reopen,
      isConfirmed,
      get,
      unlocks,
      unlockDay,
      relockDay,
      isDayUnlocked,
      getUnlock,
    ],
  );

  return <PlanConfirmContext.Provider value={value}>{children}</PlanConfirmContext.Provider>;
}

export function usePlanConfirm(): Store {
  const ctx = useContext(PlanConfirmContext);
  if (!ctx) {
    // Safe defaults so components don't blow up outside the provider.
    return {
      confirmations: {},
      confirm: () => {},
      reopen: () => {},
      isConfirmed: () => false,
      get: () => undefined,
      unlocks: {},
      unlockDay: () => {},
      relockDay: () => {},
      isDayUnlocked: () => false,
      getUnlock: () => undefined,
    };
  }
  return ctx;
}
